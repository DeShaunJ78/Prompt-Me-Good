import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
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

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 10;
const ipHits = new Map<string, number[]>();

function getClientKey(req: Request): string {
  // Use Express's req.ip, which honors the app-level `trust proxy` setting
  // (1 hop = the Replit front proxy). User-supplied X-Forwarded-For from beyond
  // the trusted hop is ignored, so attackers cannot spoof their way past the
  // 10/min cap by injecting headers.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = getClientKey(req);
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const arr = (ipHits.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_PER_WINDOW) {
    res.status(429).json({
      success: false,
      ok: false,
      error: "Too many requests. Please wait a moment and try again.",
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

const STATS_DIR = path.resolve(process.cwd(), "data");
const STATS_FILE = path.join(STATS_DIR, "pmg_stats.json");
const STATS_FLUSH_MS = 1000;

function readPromptCountFromDisk(): number {
  try {
    const raw = fs.readFileSync(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const n = Number(parsed?.promptCount);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writePromptCountToDisk(n: number): void {
  try {
    if (!fs.existsSync(STATS_DIR)) {
      fs.mkdirSync(STATS_DIR, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify({ promptCount: n }));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "stats write failed",
    );
  }
}

// In-memory authoritative counter — eliminates the read-modify-write race that
// existed when each request re-read the file before incrementing. Disk writes
// are debounced to at most one per second; on flush we persist the latest
// in-memory value, so concurrent bumps never lose increments.
let promptCountCache = readPromptCountFromDisk();
let lastWrittenValue = promptCountCache;
let flushTimer: NodeJS.Timeout | null = null;

function flushPromptCount(): void {
  flushTimer = null;
  if (promptCountCache !== lastWrittenValue) {
    const value = promptCountCache;
    writePromptCountToDisk(value);
    lastWrittenValue = value;
  }
}

function bumpPromptCount(): void {
  promptCountCache += 1;
  if (flushTimer) return;
  flushTimer = setTimeout(flushPromptCount, STATS_FLUSH_MS);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

function readPromptCount(): number {
  return promptCountCache;
}

const GENERATE_MAX_INPUT = 4000;
const GENERATE_GOAL_MAX = 500;
const GENERATE_MAX_OUTPUT_TOKENS = 600;
const GENERATE_MODEL = "gpt-4o-mini";
const STREAM_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are an expert prompt engineer. Your job is to take the user's goal and settings and write the most effective, structured AI prompt possible.\n\n" +
  "Always include:\n" +
  "- A role assignment (\"Act as...\")\n" +
  "- The user's goal stated clearly\n" +
  "- Specific constraints (tone, experience level, output format)\n" +
  "- Instructions to avoid vague or generic advice\n" +
  "- A closing instruction to end with the top 3 next actions\n\n" +
  "If Money Mode is active: prioritize fast, practical, income-focused execution. Avoid theory.\n" +
  "If Human Voice Mode is active: write in a natural, conversational tone. Avoid robotic phrasing.\n" +
  "If Clarity Boost is active: add extra structure, headers, and explicit formatting instructions.\n" +
  "If Expert Mode is active: skip simplified explanations. Assume advanced knowledge.\n\n" +
  "Personality instructions:\n" +
  "- Bold & Persuasive: write with confidence and conviction\n" +
  "- Friendly & Conversational: warm, approachable, encouraging\n" +
  "- Direct & Straightforward: no preamble, action-first\n" +
  "- Faith-Based & Convicting: grounded in purpose and values\n" +
  "- Street-Smart & Practical: real-world, no-nonsense\n" +
  "- Luxury Brand Voice: elevated, aspirational, premium\n" +
  "- Viral Social Media Voice: punchy, hook-driven, shareable\n\n" +
  "Output ONLY the finished prompt text the user can paste directly into ChatGPT, Claude, Gemini, or another AI tool. No markdown fences, no preamble, no headers like 'Prompt:', no commentary.";

const PERSONALITY_LABELS: Record<string, string> = {
  bold: "Bold & Persuasive",
  friendly: "Friendly & Conversational",
  direct: "Direct & Straightforward",
  faith: "Faith-Based & Convicting",
  street: "Street-Smart & Practical",
  luxury: "Luxury Brand Voice",
  viral: "Viral Social Media Voice",
};

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  spanish: "Spanish",
  portuguese: "Portuguese",
  russian: "Russian",
  french: "French",
  german: "German",
};

type StructuredPayload = {
  goal?: unknown;
  category?: unknown;
  experience?: unknown;
  skillLevel?: unknown;
  tone?: unknown;
  format?: unknown;
  outputFormat?: unknown;
  language?: unknown;
  outputLanguage?: unknown;
  personality?: unknown;
  extraDetails?: unknown;
  avoid?: unknown;
  guardrails?: unknown;
  moneyMode?: unknown;
  humanVoice?: unknown;
  humanTone?: unknown;
  clarityBoost?: unknown;
  expertMode?: unknown;
};

function titleCase(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function buildUserMessageFromPayload(p: StructuredPayload): string {
  const lines: string[] = [];
  const goal = clampString(p.goal, GENERATE_GOAL_MAX);
  if (goal) lines.push(`Goal: ${goal}`);

  const category = clampString(p.category, 100);
  if (category) lines.push(`Category: ${titleCase(category)}`);

  const experience = clampString(p.experience ?? p.skillLevel, 100);
  if (experience) lines.push(`Experience level: ${titleCase(experience)}`);

  const tone = clampString(p.tone, 100);
  if (tone) lines.push(`Tone: ${titleCase(tone)}`);

  const format = clampString(p.format ?? p.outputFormat, 100);
  if (format) lines.push(`Output format: ${titleCase(format)}`);

  const langKey = clampString(p.language ?? p.outputLanguage, 32).toLowerCase();
  if (langKey && langKey !== "english") {
    lines.push(`Output language: ${LANGUAGE_LABELS[langKey] ?? titleCase(langKey)}`);
  }

  const persKey = clampString(p.personality, 32).toLowerCase();
  if (persKey && persKey !== "none" && PERSONALITY_LABELS[persKey]) {
    lines.push(`Personality: ${PERSONALITY_LABELS[persKey]}`);
  }

  const extra = clampString(p.extraDetails, 1500);
  if (extra) lines.push(`Extra details: ${extra}`);

  const avoid = clampString(p.avoid ?? p.guardrails, 1000);
  if (avoid) lines.push(`Avoid: ${avoid}`);

  const modes: string[] = [];
  if (p.moneyMode === true || p.moneyMode === "true") modes.push("Money Mode");
  if (p.humanVoice === true || p.humanTone === true) modes.push("Human Voice Mode");
  if (p.clarityBoost === true || p.clarityBoost === "true") modes.push("Clarity Boost");
  if (p.expertMode === true || p.expertMode === "true") modes.push("Expert Mode");
  if (modes.length) lines.push(`Active modes: ${modes.join(", ")}`);

  return lines.join("\n");
}

function isStructuredPayload(body: unknown): body is StructuredPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b["goal"] === "string" && typeof b["prompt"] !== "string";
}

function buildMessages(
  body: unknown,
):
  | { ok: true; messages: { role: "system" | "user"; content: string }[] }
  | { ok: false; status: number; error: string } {
  if (isStructuredPayload(body)) {
    const goalRaw = typeof (body as StructuredPayload).goal === "string"
      ? ((body as StructuredPayload).goal as string).trim()
      : "";
    if (!goalRaw) {
      return { ok: false, status: 400, error: "Field 'goal' is required." };
    }
    if (goalRaw.length > GENERATE_GOAL_MAX) {
      return {
        ok: false,
        status: 400,
        error: `Your goal is too long. Please keep it under ${GENERATE_GOAL_MAX} characters.`,
      };
    }
    const userMsg = buildUserMessageFromPayload(body as StructuredPayload);
    return {
      ok: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    };
  }

  // Legacy {prompt} shape (used by Improve with AI button)
  const raw = (body as { prompt?: unknown } | null | undefined)?.prompt;
  if (typeof raw !== "string") {
    return { ok: false, status: 400, error: "Field 'prompt' must be a string." };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, status: 400, error: "Field 'prompt' is required." };
  }
  if (trimmed.length > GENERATE_MAX_INPUT) {
    return {
      ok: false,
      status: 400,
      error: `Prompt is too long. Max ${GENERATE_MAX_INPUT} characters.`,
    };
  }
  return {
    ok: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
  };
}

router.post("/generate", rateLimit, async (req, res) => {
  const built = buildMessages(req.body);
  if (!built.ok) {
    res.status(built.status).json({ success: false, ok: false, error: built.error });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: GENERATE_MODEL,
      max_completion_tokens: GENERATE_MAX_OUTPUT_TOKENS,
      messages: built.messages,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      res.status(502).json({
        success: false,
        ok: false,
        error: "AI returned an empty response.",
      });
      return;
    }
    bumpPromptCount();
    res.json({ success: true, ok: true, output: text, prompt: text, result: text });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "generate failed");
    res.status(502).json({
      success: false,
      ok: false,
      error: "AI service is unavailable. Try again.",
    });
  }
});

router.post("/generate-stream", rateLimit, async (req, res) => {
  const built = buildMessages(req.body);
  if (!built.ok) {
    res.status(built.status).json({ success: false, ok: false, error: built.error });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as unknown as { flushHeaders: () => void }).flushHeaders();
  }

  let total = 0;
  try {
    const stream = await openai.chat.completions.create({
      model: STREAM_MODEL,
      max_completion_tokens: GENERATE_MAX_OUTPUT_TOKENS,
      stream: true,
      messages: built.messages,
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content ?? "";
      if (text) {
        total += text.length;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    if (total > 0) bumpPromptCount();
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI service error";
    logger.error({ err: message }, "generate-stream failed");
    try {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch {
      // socket already closed
    }
  }
});

router.get("/stats", (_req, res) => {
  const promptCount = readPromptCount();
  res.json({ promptCount });
});

router.post("/generate-prompt", rateLimit, async (req, res) => {
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

router.post("/refine-prompt", rateLimit, async (req, res) => {
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

router.post("/image-prompt", rateLimit, async (req, res) => {
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
