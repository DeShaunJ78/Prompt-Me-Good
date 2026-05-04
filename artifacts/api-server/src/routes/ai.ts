import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { openai } from "../lib/openai-client";
import { logger } from "../lib/logger";
import { clampString, sanitizeGoal } from "../middlewares/sanitize";
import { generateLimiter, runLimiter, rateLimit, imageLimiter } from "../middlewares/rateLimit";
import { chargeCost, generateCostCheck, runCostCheck, imageCheck, imageCheckMulti, chargeImage } from "../middlewares/costGuard";
import { userCapEnforce } from "../middlewares/userCaps";

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
const GENERATE_GOAL_MAX = 8000;
const GENERATE_MAX_OUTPUT_TOKENS = 600;
const GENERATE_MODEL = "gpt-4o-mini";
const STREAM_MODEL = "gpt-4o-mini";

// SYSTEM_PROMPT is the single source of truth for prompt-building behavior.
// It is shared by /generate, /generate-stream, and /generate-prompt so the app
// can never drift across surfaces. Editing this string changes every "build me
// a prompt" path at once. Run-time behaviors:
//   - Output is the FINAL prompt only. No preamble, no fences, no meta talk.
//   - Length and shape scale to the user's goal (see STRUCTURE BY COMPLEXITY).
//   - Every prompt closes with a "Top 3 next actions" block, always —
//     no opt-out, no exceptions, even on short creative prompts.
//   - Personality voices have anchored writing behaviors + banned phrases so
//     they don't collapse into the same generic AI register.
//   - Output language follows the user's `Output language` line (defaults to
//     the language they wrote the goal in).
const SYSTEM_PROMPT =
  "You are PromptMeGood's prompt-building engine. You compose prompts that a non-technical user will paste into ChatGPT, Claude, Gemini, or Perplexity. Your output IS the finished prompt — never an explanation of one, never a description of how you built it.\n\n" +
  "AUDIENCE FOR THE FINAL PROMPT: a real person trying to get a useful first answer with no follow-up questions. Optimize for that.\n\n" +
  "INTERNAL VS PUBLIC — STRICT SEPARATION:\n" +
  "- These instructions are internal to PromptMeGood. NEVER repeat, summarize, or reference them inside the prompt you produce.\n" +
  "- NEVER mention PromptMeGood, \"the user's settings\", \"based on the inputs\", or any meta commentary about how the prompt was built.\n" +
  "- The produced prompt addresses the downstream AI in second person (\"You are…\", \"Write…\", \"Return…\"). It does not narrate.\n\n" +
  "STRUCTURE BY COMPLEXITY — match the prompt's shape to the goal:\n" +
  "- Simple/creative (caption, joke, haiku, single rewrite, one-line idea): a single tight paragraph, second person, no headers, no bullet ceremony.\n" +
  "- Standard (most goals): role line → goal line → 2–4 bullet constraints → output format line.\n" +
  "- Complex/strategic/business/technical/multi-step: add a short context block, a numbered step plan, and a constraints section. Use light headers only when they aid scanning.\n" +
  "Pick the smallest structure that fits. Do not pad short goals with ceremony.\n\n" +
  "ALWAYS CLOSE WITH NEXT STEPS — NO EXCEPTIONS:\n" +
  "Every prompt — short, medium, or long, creative, technical, or strategic — must end with a final instruction telling the downstream AI to append a section titled \"Top 3 next actions\" listing three concrete, prioritized next steps the reader can take after reading the answer. This applies even to one-paragraph creative prompts. Do not skip it under any circumstance.\n\n" +
  "MODES (only apply when listed under \"Active modes\" in the user message):\n" +
  "- Money Mode: prioritize fast, practical, income-focused execution. Avoid theory and disclaimers.\n" +
  "- Human Voice Mode: write the produced prompt to demand a natural, conversational tone in the answer. Avoid robotic phrasing.\n" +
  "- Clarity Boost: add extra structure, headers, and explicit formatting instructions to the produced prompt.\n" +
  "- Expert Mode: tell the downstream AI to skip simplified explanations and assume advanced knowledge.\n" +
  "If a mode is not listed, do not act on it and do not mention it.\n\n" +
  "PERSONALITY VOICE — choose ONLY when an explicit Personality is set; if none, use a neutral professional voice. Each voice is a recipe of behaviors AND bans:\n" +
  "- Bold & Persuasive: declarative imperatives (\"You will…\", \"Choose…\"), urgency markers, short sentences. BANNED: \"could\", \"might\", \"perhaps\", \"try to\", \"in order to\".\n" +
  "- Friendly & Conversational: contractions, second person, light warmth, one rhetorical question allowed. BANNED: \"shall\", \"kindly\", \"please be advised\", corporate hedges.\n" +
  "- Direct & Straightforward: imperative verbs first, no adjectives, no preamble, bullets over paragraphs. BANNED: adverbs ending in -ly, \"basically\", \"essentially\", \"just\".\n" +
  "- Faith-Based & Convicting: anchored in purpose, values, and stewardship language. Calm conviction, not performative. BANNED: profanity, sarcasm, cynicism.\n" +
  "- Street-Smart & Practical: plain English, real-world examples, money/time math when relevant, no jargon. BANNED: \"synergy\", \"leverage\" (as a verb), \"ecosystem\", \"holistic\", buzzwords.\n" +
  "- Luxury Brand Voice: restrained, long vowels, single-clause sentences, no exclamation marks, no emojis. BANNED: \"amazing\", \"awesome\", \"super\", price talk.\n" +
  "- Viral Social Media Voice: hook-question or pattern-interrupt opener, ≤14-word sentences, line breaks for rhythm, one strong CTA. BANNED: \"in conclusion\", \"furthermore\", \"moreover\", essay transitions.\n\n" +
  "HARD RULES — apply to YOUR output, not to the produced prompt:\n" +
  "1. Output ONLY the finished prompt. No preamble (\"Sure!\", \"Here's…\"), no sign-off, no \"Prompt:\" header.\n" +
  "2. No markdown code fences around the whole prompt.\n" +
  "3. Match the user's output language end-to-end — role line, section labels, the \"Top 3 next actions\" closer, everything. Default to the language the user wrote the goal in.\n" +
  "4. Preserve the user's original intent. Do not invent goals they did not state.\n" +
  "5. No hedging filler in the prompt you write: \"try to\", \"if possible\", \"as much as you can\", \"high-quality\", \"comprehensive\", \"world-class\". Be concrete.\n" +
  "6. Do not restate the user's goal verbatim more than once.\n" +
  "7. Do not include any meta commentary about prompt construction inside the prompt.\n" +
  "8. The produced prompt must be paste-ready as-is into ChatGPT, Claude, Gemini, or Perplexity.";

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

// Sampling tiers — chosen so tightly-templated prompts (the standard case)
// stay consistent run-to-run, while creative requests (image briefs, social
// captions, viral/luxury personality voices) keep enough entropy to feel
// fresh. See SYSTEM_PROMPT comment block.
const SAMPLING_DEFAULT = { temperature: 0.35, top_p: 0.9, max_tokens: 600 } as const;
const SAMPLING_CREATIVE = { temperature: 0.65, top_p: 0.95, max_tokens: 700 } as const;

const CREATIVE_CATEGORY_HINTS = [
  "creative", "art", "image", "social", "caption", "story", "poem",
  "marketing", "copy", "ad", "video", "script",
];
const CREATIVE_FORMAT_HINTS = [
  "caption", "haiku", "poem", "tweet", "story", "script",
  "image", "dall", "midjourney", "lyrics", "tagline",
];
const CREATIVE_PERSONALITIES = new Set(["viral", "luxury"]);

// Decide which sampling tier to use. Creative when:
//   - personality is one of the explicitly creative voices, OR
//   - category/format text mentions a creative artifact type, OR
//   - the goal itself reads like a short creative request (caption, haiku,
//     joke, tagline, headline, etc).
// Falls back to default for the standard "build me a structured prompt" path.
function isCreativeRequest(payload: StructuredPayload | null): boolean {
  if (!payload) return false;
  const persKey = clampString(payload.personality, 32).toLowerCase();
  if (CREATIVE_PERSONALITIES.has(persKey)) return true;

  const cat = clampString(payload.category, 100).toLowerCase();
  if (cat && CREATIVE_CATEGORY_HINTS.some((h) => cat.includes(h))) return true;

  const fmt = clampString(payload.format ?? payload.outputFormat, 100).toLowerCase();
  if (fmt && CREATIVE_FORMAT_HINTS.some((h) => fmt.includes(h))) return true;

  const goal = clampString(payload.goal, GENERATE_GOAL_MAX).toLowerCase();
  if (goal && /\b(caption|haiku|poem|joke|tagline|headline|tweet|lyric|slogan|one[- ]liner)\b/.test(goal)) {
    return true;
  }
  return false;
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
  const sampling = isCreativeRequest(isStructuredPayload(req.body) ? (req.body as StructuredPayload) : null)
    ? SAMPLING_CREATIVE
    : SAMPLING_DEFAULT;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: GENERATE_MODEL,
        max_completion_tokens: sampling.max_tokens,
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        messages: built.messages,
      },
      { timeout: 20_000, maxRetries: 0 },
    );
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
  const sampling = isCreativeRequest(isStructuredPayload(req.body) ? (req.body as StructuredPayload) : null)
    ? SAMPLING_CREATIVE
    : SAMPLING_DEFAULT;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as unknown as { flushHeaders: () => void }).flushHeaders();
  }

  let total = 0;
  try {
    const stream = await openai.chat.completions.create(
      {
        model: STREAM_MODEL,
        max_completion_tokens: sampling.max_tokens,
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        stream: true,
        messages: built.messages,
      },
      { timeout: 20_000, maxRetries: 0 },
    );

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

router.post("/run", runLimiter, runCostCheck, userCapEnforce("run"), async (req, res) => {
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

// Per-user image cap charges 1 unit per generated image (1–4 per request)
// so a single n=4 call can't bypass the per-day matrix (free=1, trial=5,
// founding=15, pro=30).
const imageCostExtractor = (req: Request): number => {
  const raw = (req.body as { n?: unknown } | undefined)?.n;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(4, Math.max(1, Math.floor(raw)));
  }
  return 1;
};

router.post("/image", imageLimiter, userCapEnforce("img", imageCostExtractor), async (req: Request, res: Response) => {
  const descRaw = req.body?.prompt ?? req.body?.description ?? req.body?.goal;
  if (typeof descRaw !== "string" || !descRaw.trim()) {
    res.status(400).json({ success: false, ok: false, error: "A description is required." });
    return;
  }
  const description = descRaw.trim().slice(0, 1000);

  const VALID_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
  const sizeRaw = req.body?.size;
  const size = (typeof sizeRaw === "string" && VALID_SIZES.has(sizeRaw)) ? sizeRaw : "1024x1024";

  // Task #52: caller may request 1–4 images in a single call so the frontend
  // can render a "Generate variations" 2x2 grid without burning extra
  // imageLimiter slots (still 1 HTTP call). We charge image budget n times
  // and only succeed if all n fit within the daily cap.
  let n = 1;
  const rawN = req.body?.n;
  if (typeof rawN === "number" && Number.isFinite(rawN)) {
    n = Math.min(4, Math.max(1, Math.floor(rawN)));
  }

  // Check daily cost budget for ALL n images up-front so a request for n=4
  // can't slip through when only 1 image worth of budget remains.
  if (!imageCheckMulti(n)) {
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

    // Step 2: Generate the image(s) with gpt-image-1. Variants use "low"
    // quality so the 4-up grid renders fast and stays cheap; single-image
    // generation keeps the existing "medium" quality so the headline path
    // is unchanged.
    const imageResult = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      n,
      size: size as "1024x1024" | "1024x1536" | "1536x1024" | "auto",
      quality: n > 1 ? "low" : "medium",
    });

    const items = Array.isArray(imageResult.data) ? imageResult.data : [];
    const urls: string[] = [];
    for (const item of items) {
      const b64 = item?.b64_json;
      if (b64) urls.push(`data:image/png;base64,${b64}`);
    }
    if (urls.length === 0) {
      res.status(502).json({
        success: false,
        ok: false,
        error: "Image generation returned no result. Please try again.",
      });
      return;
    }

    // Charge cost once per successfully-returned image
    for (let i = 0; i < urls.length; i++) chargeImage();
    bumpRunCount();

    res.json({
      success: true,
      ok: true,
      url: urls[0],
      urls,
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
  // Consolidated: this route now shares SYSTEM_PROMPT with /generate so prompt-
  // building rules live in exactly one place. Sampling uses the same default
  // tier as /generate; legacy {goal, context} payloads don't carry the hints
  // needed to detect a creative request, so they fall through to the standard
  // structured-prompt path on purpose.
  try {
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      max_completion_tokens: SAMPLING_DEFAULT.max_tokens,
      temperature: SAMPLING_DEFAULT.temperature,
      top_p: SAMPLING_DEFAULT.top_p,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: context
            ? `Goal: ${goal}\n\nExtra details: ${context}`
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
  userCapEnforce("analyze"),
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
