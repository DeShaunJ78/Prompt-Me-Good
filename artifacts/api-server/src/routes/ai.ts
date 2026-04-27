import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { openai } from "../lib/openai-client";
import { logger } from "../lib/logger";
import { clampString, sanitizeGoal } from "../middlewares/sanitize";
import { generateLimiter, runLimiter, rateLimit, imageLimiter } from "../middlewares/rateLimit";
import { chargeCost, generateCostCheck, runCostCheck, imageCheck, chargeImage } from "../middlewares/costGuard";

const router: IRouter = Router();

const TEXT_MODEL = "gpt-5.4";
const IMAGE_MODEL = "gpt-image-1";

// Stats counter: tracks both promptCount (generations) and runCount (executions).
// In-memory authoritative state with debounced disk flush — eliminates the
// read-modify-write race that would otherwise lose increments under concurrency.
const DATA_DIR = path.resolve(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "pmg_stats.json");
const STATS_FLUSH_MS = 1000;

type StatsState = { promptCount: number; runCount: number };

function readStatsFromDisk(): StatsState {
  try {
    const raw = fs.readFileSync(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const promptCount = Number(parsed?.promptCount);
    const runCount = Number(parsed?.runCount);
    return {
      promptCount: Number.isFinite(promptCount) && promptCount >= 0 ? Math.floor(promptCount) : 0,
      runCount: Number.isFinite(runCount) && runCount >= 0 ? Math.floor(runCount) : 0,
    };
  } catch {
    return { promptCount: 0, runCount: 0 };
  }
}

function writeStatsToDisk(state: StatsState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(state));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "stats write failed",
    );
  }
}

const statsCache: StatsState = readStatsFromDisk();
let lastWrittenStats: StatsState = { ...statsCache };
let statsFlushTimer: NodeJS.Timeout | null = null;

function flushStats(): void {
  statsFlushTimer = null;
  if (
    statsCache.promptCount !== lastWrittenStats.promptCount ||
    statsCache.runCount !== lastWrittenStats.runCount
  ) {
    const snapshot: StatsState = { ...statsCache };
    writeStatsToDisk(snapshot);
    lastWrittenStats = snapshot;
  }
}

function scheduleStatsFlush(): void {
  if (statsFlushTimer) return;
  statsFlushTimer = setTimeout(flushStats, STATS_FLUSH_MS);
  if (typeof statsFlushTimer.unref === "function") statsFlushTimer.unref();
}

function bumpPromptCount(): void {
  statsCache.promptCount += 1;
  scheduleStatsFlush();
}

function bumpRunCount(): void {
  statsCache.runCount += 1;
  scheduleStatsFlush();
}

function readStats(): StatsState {
  return { promptCount: statsCache.promptCount, runCount: statsCache.runCount };
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

// Pulls the user-provided text out of either the structured ({goal}) or
// legacy ({prompt}) payload so the injection sanitizer can inspect it
// without re-parsing the message shape.
function getUserTextForSanitize(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  if (typeof b["goal"] === "string") return b["goal"];
  if (typeof b["prompt"] === "string") return b["prompt"];
  return "";
}

router.post("/generate", generateLimiter, generateCostCheck, async (req, res) => {
  const sanitized = sanitizeGoal(getUserTextForSanitize(req.body));
  if (!sanitized.ok) {
    res.status(sanitized.status).json({ success: false, ok: false, error: sanitized.error });
    return;
  }
  const built = buildMessages(req.body);
  if (!built.ok) {
    res.status(built.status).json({ success: false, ok: false, error: built.error });
    return;
  }
  // Charge ONLY after validation — invalid bodies cannot drain the daily budget.
  chargeCost("generate");
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

router.post("/generate-stream", generateLimiter, generateCostCheck, async (req, res) => {
  const sanitized = sanitizeGoal(getUserTextForSanitize(req.body));
  if (!sanitized.ok) {
    res.status(sanitized.status).json({ success: false, ok: false, error: sanitized.error });
    return;
  }
  const built = buildMessages(req.body);
  if (!built.ok) {
    res.status(built.status).json({ success: false, ok: false, error: built.error });
    return;
  }
  // Charge ONLY after validation — invalid bodies cannot drain the daily budget.
  chargeCost("generate");

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

// /api/run — executes a user-provided prompt against gpt-4o and streams the
// model's response as Server-Sent Events. Distinct from /generate (which
// builds an optimized prompt template) — this is the "run with AI" feature
// that lets users see what their prompt actually produces, in-app.
const RUN_MODEL = "gpt-4o";
const RUN_MAX_INPUT = 2000;
const RUN_MAX_OUTPUT_TOKENS = 1000;
const RUN_SYSTEM_PROMPT =
  "You are a helpful, direct AI assistant. Execute the user's prompt exactly as instructed. Be specific, practical, and thorough.";

router.post("/run", runLimiter, runCostCheck, async (req, res) => {
  const promptRaw = req.body?.prompt;
  if (typeof promptRaw !== "string") {
    res.status(400).json({ success: false, ok: false, error: "A prompt is required." });
    return;
  }
  const prompt = promptRaw.trim();
  if (!prompt) {
    res.status(400).json({ success: false, ok: false, error: "A prompt is required." });
    return;
  }
  if (prompt.length > RUN_MAX_INPUT) {
    res.status(400).json({
      success: false,
      ok: false,
      error: "Prompt is too long. Please shorten it.",
    });
    return;
  }
  // Charge ONLY after validation — invalid bodies cannot drain the daily budget.
  chargeCost("run");

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
      model: RUN_MODEL,
      max_completion_tokens: RUN_MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [
        { role: "system", content: RUN_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content ?? "";
      if (text) {
        total += text.length;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    if (total > 0) bumpRunCount();
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI execution failed. Please try again.";
    logger.error({ err: message }, "run failed");
    try {
      res.write(`data: ${JSON.stringify({ error: "AI execution failed. Please try again." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch {
      // socket already closed
    }
  }
});


// /api/image — generates an image using DALL-E 3 from the user's prompt.
// The user's prompt is treated as a description — we enhance it automatically
// into a professional image prompt before sending to OpenAI.
const IMAGE_PROMPT_ENHANCER =
  "You are a professional photographer, art director, and AI image prompt specialist. " +
  "Take the user's description and rewrite it as a single, highly detailed image generation prompt. " +
  "Include: subject, setting, lighting, camera angle, mood, style, and technical quality descriptors. " +
  "Make it vivid and specific. Output ONLY the enhanced prompt — no commentary, no preamble.";

router.post("/image", imageLimiter, async (req: Request, res: Response) => {
  const descRaw = req.body?.prompt ?? req.body?.description ?? req.body?.goal;
  if (typeof descRaw !== "string" || !descRaw.trim()) {
    res.status(400).json({ success: false, ok: false, error: "A description is required." });
    return;
  }
  const description = descRaw.trim().slice(0, 1000);

  // Check image daily cost budget
  if (!imageCheck()) {
    res.status(429).json({
      success: false,
      ok: false,
      error: "Daily image limit reached. Resets at midnight UTC — try again tomorrow.",
    });
    return;
  }

  try {
    // Step 1: Enhance the user's plain description into a professional image prompt
    const enhancedPromptResult = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: IMAGE_PROMPT_ENHANCER },
        { role: "user", content: description },
      ],
    });

    const enhancedPrompt = enhancedPromptResult.choices[0]?.message?.content?.trim() ?? description;

    // Step 2: Generate the image with gpt-image-1 (Replit AI Integrations
    // proxy supports gpt-image-1, not dall-e-3). Returns base64 — we wrap it
    // as a data URL so the frontend can render it without a separate fetch.
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    const b64 = imageResult.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({
        success: false,
        ok: false,
        error: "Image generation returned no result. Please try again.",
      });
      return;
    }
    const imageUrl = `data:image/png;base64,${b64}`;

    // Charge cost only after successful generation
    chargeImage();
    bumpRunCount();

    res.json({
      success: true,
      ok: true,
      url: imageUrl,
      enhancedPrompt,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed.";
    logger.error({ err: message }, "image generation failed");

    // Handle OpenAI content policy rejection gracefully
    if (message.includes("content_policy") || message.includes("safety")) {
      res.status(400).json({
        success: false,
        ok: false,
        error: "Your description was flagged by content policy. Try rephrasing it.",
      });
      return;
    }

    res.status(502).json({
      success: false,
      ok: false,
      error: "Image generation failed. Please try again.",
    });
  }
});

router.get("/stats", (_req, res) => {
  const stats = readStats();
  res.json({ promptCount: stats.promptCount, runCount: stats.runCount });
});

// /api/health — duplicates the root /health endpoint at the /api/* path so the
// frontend keep-alive ping can reach it through the artifact path-based router
// (which only forwards /api/* to this api-server).
router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
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

/* ============================================================================
 * /api/analyze — file + image upload analysis
 * Accepts multipart/form-data with `prompt` (text goal) and optional `file`
 * (PDF, JPG, or PNG, ≤10MB). PDFs are parsed for text; images go to the
 * vision model. Files are processed in-memory and discarded after the call.
 * ============================================================================ */
const ANALYZE_MAX_BYTES = 10 * 1024 * 1024;
const ANALYZE_MAX_TEXT_CHARS = 12000;
const ANALYZE_MAX_GOAL_CHARS = 4000;
const ANALYZE_MAX_OUTPUT_TOKENS = 1500;
const ANALYZE_VISION_MODEL = "gpt-4o";
const ALLOWED_ANALYZE_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const analyzeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ANALYZE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ANALYZE_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_MIMETYPE"));
    }
  },
});

function handleAnalyzeUpload(req: Request, res: Response, next: NextFunction): void {
  analyzeUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const e = err as { code?: string; message?: string };
    if (e?.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ success: false, ok: false, error: "File too large. Maximum size is 10MB." });
      return;
    }
    if (e?.message === "INVALID_MIMETYPE") {
      res.status(400).json({ success: false, ok: false, error: "Unsupported file type. Use PDF, JPG, or PNG." });
      return;
    }
    logger.warn({ err: e?.message }, "analyze upload failed");
    res.status(400).json({ success: false, ok: false, error: "Upload failed. Please try a different file." });
  });
}

router.post(
  "/analyze",
  runLimiter,
  handleAnalyzeUpload,
  runCostCheck,
  async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const goalRaw = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    const goal = clampString(goalRaw, ANALYZE_MAX_GOAL_CHARS);

    if (!goal && !file) {
      res.status(400).json({ success: false, ok: false, error: "Provide a goal or attach a file." });
      return;
    }

    if (goal) {
      const sanitized = sanitizeGoal(goal);
      if (!sanitized.ok) {
        res.status(sanitized.status).json({ success: false, ok: false, error: sanitized.error });
        return;
      }
    }

    let extractedText = "";
    let isImage = false;

    if (file) {
      try {
        if (file.mimetype === "application/pdf") {
          const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
          const result = await parser.getText();
          extractedText = (result?.text ?? "").slice(0, ANALYZE_MAX_TEXT_CHARS).trim();
          if (!extractedText) {
            res.status(400).json({
              success: false,
              ok: false,
              error: "Could not extract text from this PDF. Try a different file.",
            });
            return;
          }
        } else if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
          isImage = true;
        }
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.message : "unknown" }, "analyze extract failed");
        res.status(400).json({
          success: false,
          ok: false,
          error: "Could not read this file. Please try another.",
        });
        return;
      }
    }

    const userGoal = goal || (isImage ? "Describe this image and suggest how I could use it." : "Summarize this document.");

    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content:
          "You are PromptMeGood's AI analysis engine. Read the user's goal and any attached reference (text or image) and produce a clear, practical, well-structured response that helps them accomplish their goal. Use plain language. Be specific.",
      },
    ];

    if (isImage && file) {
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userGoal },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
    } else if (extractedText) {
      messages.push({
        role: "user",
        content: `Goal: ${userGoal}\n\nReference document (${file?.originalname ?? "uploaded file"}):\n\n${extractedText}`,
      });
    } else {
      messages.push({ role: "user", content: userGoal });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: ANALYZE_VISION_MODEL,
        max_completion_tokens: ANALYZE_MAX_OUTPUT_TOKENS,
        messages: messages as never,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!responseText) {
        res.status(502).json({ success: false, ok: false, error: "AI returned an empty response. Please try again." });
        return;
      }

      bumpRunCount();

      const promptDescription = file
        ? `${userGoal} — with attachment: ${file.originalname}`
        : userGoal;

      res.json({ success: true, ok: true, prompt: promptDescription, response: responseText });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : "unknown" }, "analyze completion failed");
      res.status(502).json({ success: false, ok: false, error: "AI service is unavailable. Try again." });
    }
  },
);

export { IMAGE_MODEL };
export default router;
