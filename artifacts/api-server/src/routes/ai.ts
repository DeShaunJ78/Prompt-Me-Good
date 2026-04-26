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

function getClientKey(req: Request): string {
  // Use Express's req.ip, which honors the app-level `trust proxy` setting
  // (1 hop = the Replit front proxy). User-supplied X-Forwarded-For from beyond
  // the trusted hop is ignored, so attackers cannot spoof their way past the
  // per-endpoint caps by injecting headers.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// Per-endpoint sliding-window rate limiter factory. Each endpoint gets its own
// independent Map so a flood of /generate requests cannot starve /run.
function makeRateLimiter(opts: { windowMs: number; max: number; label: string }) {
  const hits = new Map<string, number[]>();
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = getClientKey(req);
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= opts.max) {
      res.status(429).json({
        success: false,
        ok: false,
        error: opts.label === "run"
          ? "Too many AI executions. Please wait before trying again."
          : opts.label === "generate"
          ? "Too many prompt generations. Please wait before trying again."
          : "Too many requests. Please wait a moment and try again.",
      });
      return;
    }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.length === 0 || v[v.length - 1]! < cutoff) hits.delete(k);
      }
    }
    next();
  };
}

const HOUR_MS = 60 * 60 * 1000;
// Generate (build the optimized prompt) — capped at 20/hour/IP per spec.
const generateLimiter = makeRateLimiter({ windowMs: HOUR_MS, max: 20, label: "generate" });
// Run (execute the prompt against gpt-4o) — capped at 5/hour/IP per spec.
const runLimiter = makeRateLimiter({ windowMs: HOUR_MS, max: 5, label: "run" });
// Legacy/utility endpoints — keep the existing 10/min limiter for back-compat.
const rateLimit = makeRateLimiter({ windowMs: 60 * 1000, max: 10, label: "general" });

// --- Prompt-injection sanitizer for the structured /generate goal field ---
// Blocks the obvious "ignore previous instructions" family of jailbreaks before
// they ever reach the model. Server-side only; the frontend already enforces the
// 500-char goal cap.
const INJECTION_BLOCKLIST = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "disregard your instructions",
  "disregard all instructions",
  "you are now",
  "forget everything",
  "forget all previous",
];

function sanitizeGoal(goal: string): { ok: true } | { ok: false; status: number; error: string } {
  const lower = goal.toLowerCase();
  if (INJECTION_BLOCKLIST.some((phrase) => lower.includes(phrase))) {
    return { ok: false, status: 400, error: "Invalid input detected." };
  }
  return { ok: true };
}

// --- Daily cost guard ($3/day hard ceiling) ---
// In-memory tally keyed by UTC date (YYYY-MM-DD) so concurrent requests cannot
// race past the cap. Debounced disk flush (1s) keeps the running total durable
// across deploys without blocking on every increment.
const DATA_DIR = path.resolve(process.cwd(), "data");
const COST_FILE = path.join(DATA_DIR, "pmg_cost.json");
const DAILY_COST_LIMIT_USD = 3.0;
const COST_PER_GENERATE = 0.004; // ~400 in + 300 out tokens, gpt-4o-mini
const COST_PER_RUN = 0.01; // ~500 in + 800 out tokens, gpt-4o
const COST_FLUSH_MS = 1000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCostFromDisk(): { date: string; spent: number } {
  try {
    const raw = fs.readFileSync(COST_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const date = typeof parsed?.date === "string" ? parsed.date : todayKey();
    const spent = Number(parsed?.spent);
    return {
      date,
      spent: Number.isFinite(spent) && spent >= 0 ? spent : 0,
    };
  } catch {
    return { date: todayKey(), spent: 0 };
  }
}

let costState = readCostFromDisk();
let costFlushTimer: NodeJS.Timeout | null = null;
let lastFlushedSpent = costState.spent;
let lastFlushedDate = costState.date;

function flushCostToDisk(): void {
  costFlushTimer = null;
  if (costState.date === lastFlushedDate && costState.spent === lastFlushedSpent) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COST_FILE, JSON.stringify(costState));
    lastFlushedSpent = costState.spent;
    lastFlushedDate = costState.date;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "cost write failed",
    );
  }
}

function rollDayIfNeeded(): void {
  const today = todayKey();
  if (costState.date !== today) {
    costState = { date: today, spent: 0 };
    lastFlushedSpent = 0;
    lastFlushedDate = today;
    if (!costFlushTimer) {
      costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
      if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
    }
  }
}

// Cost guard split into two pieces to avoid budget-drain abuse:
//   1. `makeCostCheck` runs as middleware — purely READ-ONLY, just gates
//      requests when the budget would be exceeded. It does NOT charge.
//   2. `chargeCost` is called EXPLICITLY by each handler AFTER the request
//      has passed body validation AND is about to actually hit OpenAI.
// This means malformed / oversized / empty payloads cannot drain the daily $3
// budget — only requests we genuinely act on are charged.
function costForEndpoint(endpoint: "generate" | "run"): number {
  return endpoint === "run" ? COST_PER_RUN : COST_PER_GENERATE;
}

function makeCostCheck(endpoint: "generate" | "run") {
  return function costCheckMiddleware(_req: Request, res: Response, next: NextFunction): void {
    rollDayIfNeeded();
    const cost = costForEndpoint(endpoint);
    if (costState.spent + cost > DAILY_COST_LIMIT_USD) {
      res.status(429).json({
        success: false,
        ok: false,
        error: "Daily usage limit reached. Service resets at midnight UTC. Try again tomorrow.",
      });
      return;
    }
    next();
  };
}

function chargeCost(endpoint: "generate" | "run"): void {
  rollDayIfNeeded();
  costState.spent += costForEndpoint(endpoint);
  if (!costFlushTimer) {
    costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
    if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
  }
}

const generateCostCheck = makeCostCheck("generate");
const runCostCheck = makeCostCheck("run");

// Stats counter: tracks both promptCount (generations) and runCount (executions).
// In-memory authoritative state with debounced disk flush — eliminates the
// read-modify-write race that would otherwise lose increments under concurrency.
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

export { IMAGE_MODEL };
export default router;
