import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { openai } from "../lib/openai-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const TEXT_MODEL = "gpt-5.4";
const IMAGE_MODEL = "gpt-image-1";

const MAX_INPUT_CHARS = 6000;

function clampString(value: unknown, max = MAX_INPUT_CHARS): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 40;
const ipHits = new Map<string, number[]>();

function getClientKey(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  if (Array.isArray(fwd) && fwd[0]) return fwd[0];
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = getClientKey(req);
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const arr = (ipHits.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_PER_WINDOW) {
    res.status(429).json({
      ok: false,
      error: "Too many requests. Please wait a few minutes and try again.",
    });
    return;
  }
  arr.push(now);
  ipHits.set(key, arr);
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.length === 0 || v[v.length - 1]! < cutoff) ipHits.delete(k);
    }
  }
  next();
}

router.use(rateLimit);

const GENERATE_MAX_INPUT = 4000;
const GENERATE_MAX_OUTPUT_TOKENS = 1024;
const GENERATE_MODEL = "gpt-4o-mini";

router.post("/generate", async (req, res) => {
  const raw = req.body?.prompt;
  if (typeof raw !== "string") {
    res.status(400).json({ success: false, error: "Field 'prompt' must be a string." });
    return;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    res.status(400).json({ success: false, error: "Field 'prompt' is required." });
    return;
  }
  if (trimmed.length > GENERATE_MAX_INPUT) {
    res.status(400).json({
      success: false,
      error: `Prompt is too long. Max ${GENERATE_MAX_INPUT} characters.`,
    });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: GENERATE_MODEL,
      max_completion_tokens: GENERATE_MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "You are PromptMeGood — a concise, expert prompt engineer. Take the user's input and return a single high-quality, structured prompt they can paste into ChatGPT, Claude, Gemini, or another AI tool. The output prompt must be self-contained and specify role, context, constraints, tone, output format, and clear next actions. Keep it tight — no markdown fences, no headers like 'Prompt:', no commentary. Output ONLY the prompt text.",
        },
        { role: "user", content: trimmed },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res.status(502).json({ success: false, error: "AI returned an empty response." });
      return;
    }
    res.json({ success: true, output: text });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "generate failed");
    res.status(502).json({ success: false, error: "AI service is unavailable. Try again." });
  }
});

router.post("/generate-prompt", async (req, res) => {
  const goal = clampString(req.body?.goal);
  const context = clampString(req.body?.context, 2000);
  if (!goal) {
    res.status(400).json({ ok: false, error: "Missing 'goal' field." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are PromptMeGood — an expert prompt engineer. Generate a single high-quality prompt for an AI assistant (ChatGPT, Claude, etc.) based on the user's goal. The prompt must be self-contained, specify role, context, constraints, tone, output format, and end with clear next actions. Do NOT include meta commentary, headers like 'Prompt:', or markdown fences. Output ONLY the prompt text the user will paste into their AI tool.",
        },
        {
          role: "user",
          content: context
            ? `Goal: ${goal}\n\nContext: ${context}`
            : `Goal: ${goal}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res
        .status(502)
        .json({ ok: false, error: "AI returned an empty response." });
      return;
    }
    res.json({ ok: true, result: text });
  } catch (err) {
    logger.error({ err }, "generate-prompt failed");
    res
      .status(502)
      .json({ ok: false, error: "AI service is unavailable. Try again." });
  }
});

router.post("/refine-prompt", async (req, res) => {
  const prompt = clampString(req.body?.prompt);
  const instruction = clampString(req.body?.instruction, 1000);
  if (!prompt) {
    res.status(400).json({ ok: false, error: "Missing 'prompt' field." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "You are PromptMeGood — an expert prompt-refinement engine. Improve the user's existing prompt for clarity, specificity, structure, and AI-tool effectiveness. Preserve the user's intent. Strengthen role, context, constraints, output format, and next actions. Do NOT include meta commentary, headers, or markdown fences. Output ONLY the improved prompt text.",
        },
        {
          role: "user",
          content: instruction
            ? `Refine this prompt with the following guidance: ${instruction}\n\n---\n${prompt}`
            : `Refine this prompt:\n\n${prompt}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res
        .status(502)
        .json({ ok: false, error: "AI returned an empty response." });
      return;
    }
    res.json({ ok: true, result: text });
  } catch (err) {
    logger.error({ err }, "refine-prompt failed");
    res
      .status(502)
      .json({ ok: false, error: "AI service is unavailable. Try again." });
  }
});

router.post("/image-prompt", async (req, res) => {
  const subject = clampString(req.body?.subject);
  const style = clampString(req.body?.style, 500);
  if (!subject) {
    res.status(400).json({ ok: false, error: "Missing 'subject' field." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are PromptMeGood's image-prompt engine. Convert the user's subject into a single richly-described image generation prompt suitable for tools like Midjourney, DALL·E, or Stable Diffusion. Include subject, composition, lighting, color palette, mood, art style, camera/lens details if relevant, and quality modifiers. Output ONLY the prompt text — no headers, no markdown, no commentary.",
        },
        {
          role: "user",
          content: style
            ? `Subject: ${subject}\nStyle: ${style}`
            : `Subject: ${subject}`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res
        .status(502)
        .json({ ok: false, error: "AI returned an empty response." });
      return;
    }
    res.json({ ok: true, result: text });
  } catch (err) {
    logger.error({ err }, "image-prompt failed");
    res
      .status(502)
      .json({ ok: false, error: "AI service is unavailable. Try again." });
  }
});

export { IMAGE_MODEL };
export default router;
