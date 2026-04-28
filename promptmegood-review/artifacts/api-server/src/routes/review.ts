// Dev-only code-review endpoint.
//
// Sends a curated bundle of source files to Claude for a structured review and
// streams the model's response back to the browser as SSE. Mounted ONLY when
// NODE_ENV !== "production" (gated at routes/index.ts AND defensively in the
// handler itself, so even an accidental mount can't leak in production).
//
// Uses the Replit-managed Anthropic AI integration (no user-supplied API key
// required). Env vars AI_INTEGRATIONS_ANTHROPIC_BASE_URL and
// AI_INTEGRATIONS_ANTHROPIC_API_KEY are auto-provisioned.

import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// The artifact source files we want Claude to review. Paths are resolved
// relative to the monorepo root so this works whether the bundled api-server
// runs from `artifacts/api-server/dist/` or directly from source.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// dist/index.mjs lives at artifacts/api-server/dist/, src lives at
// artifacts/api-server/src/. Either way, the monorepo root is 3 levels up.
const MONOREPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const FILES_TO_REVIEW: ReadonlyArray<{ label: string; relPath: string }> = [
  { label: "artifacts/api-server/src/app.ts", relPath: "artifacts/api-server/src/app.ts" },
  { label: "artifacts/api-server/src/routes/index.ts", relPath: "artifacts/api-server/src/routes/index.ts" },
  { label: "artifacts/api-server/src/routes/ai.ts", relPath: "artifacts/api-server/src/routes/ai.ts" },
  { label: "artifacts/api-server/src/routes/health.ts", relPath: "artifacts/api-server/src/routes/health.ts" },
  { label: "artifacts/api-server/src/routes/review.ts", relPath: "artifacts/api-server/src/routes/review.ts" },
  { label: "artifacts/promptmegood/index.html", relPath: "artifacts/promptmegood/index.html" },
];

// Cap the per-file content we ship so a single huge file (index.html is large!)
// doesn't blow the model's context window. 80 KB per file is plenty for review.
const PER_FILE_MAX_BYTES = 80 * 1024;
const TOTAL_MAX_BYTES = 400 * 1024;

function readFileSafely(relPath: string): string {
  try {
    const full = path.join(MONOREPO_ROOT, relPath);
    if (!fs.existsSync(full)) return "[File not found]";
    const stat = fs.statSync(full);
    if (stat.size > PER_FILE_MAX_BYTES) {
      const truncated = fs.readFileSync(full, "utf8").slice(0, PER_FILE_MAX_BYTES);
      return `${truncated}\n\n[... file truncated — original size ${stat.size} bytes ...]`;
    }
    return fs.readFileSync(full, "utf8");
  } catch (err) {
    return `[Error reading file: ${err instanceof Error ? err.message : "unknown"}]`;
  }
}

function buildCodeStack(): string {
  let total = 0;
  const parts: string[] = [];
  for (const { label, relPath } of FILES_TO_REVIEW) {
    const content = readFileSafely(relPath);
    const block = `\n\n=== ${label} ===\n${content}`;
    if (total + block.length > TOTAL_MAX_BYTES) {
      parts.push(`\n\n=== ${label} ===\n[Skipped — total review payload exceeded ${TOTAL_MAX_BYTES} bytes]`);
      continue;
    }
    parts.push(block);
    total += block.length;
  }
  return parts.join("");
}

function buildReviewPrompt(codeStack: string): string {
  return `You are a senior full-stack engineer and UX reviewer doing a thorough code review of a TypeScript pnpm-monorepo app called PromptMeGood — a prompt builder that generates optimized AI prompts (gpt-4o-mini) and runs them via OpenAI gpt-4o.

Here is the complete code stack:
${codeStack}

Review it across these four areas and return ONLY a structured JSON response matching the schema below — no prose, no markdown, just valid JSON:

1. BUGS — Logic errors, broken flows, missing error handling, race conditions, anything that would cause the app to fail or behave incorrectly.
2. UX ISSUES — Confusing flows, missing feedback states, unclear labels, mobile problems, anything that would frustrate a real user.
3. SECURITY — Exposed secrets, missing input validation, injection risks, rate limiting gaps.
4. POLISH — Inconsistent naming, dead code, missing comments on complex logic, anything that makes the codebase harder to maintain.

For each issue, provide:
- The file and line/function where it occurs
- A clear description of the problem
- The exact fixed code to paste in (a complete function or block, not a diff)

JSON schema:
{
  "summary": "2-3 sentence overall assessment",
  "score": { "bugs": 0-10, "ux": 0-10, "security": 0-10, "polish": 0-10 },
  "issues": [
    {
      "area": "bugs|ux|security|polish",
      "severity": "critical|high|medium|low",
      "file": "filename",
      "location": "function name or line description",
      "problem": "clear description of what is wrong",
      "fix": "the complete corrected code block to replace it with"
    }
  ]
}`;
}

// Lazy-init the SDK so a missing env var only fails when /api/review is hit
// (not at server boot — which would break the whole api in production where
// the env vars may not be present).
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "Anthropic AI integration is not configured (AI_INTEGRATIONS_ANTHROPIC_BASE_URL or AI_INTEGRATIONS_ANTHROPIC_API_KEY missing).",
    );
  }
  anthropicClient = new Anthropic({ baseURL, apiKey });
  return anthropicClient;
}

router.post("/review", async (_req, res) => {
  // Defense-in-depth: even if mistakenly mounted in production, never run.
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Review endpoint disabled in production." });
    return;
  }

  const codeStack = buildCodeStack();
  const reviewPrompt = buildReviewPrompt(codeStack);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as unknown as { flushHeaders: () => void }).flushHeaders();
  }

  try {
    const client = getAnthropicClient();
    // claude-sonnet-4-6 is a balanced model that handles long-context structured
    // review tasks well. 8192 max tokens is the integration's recommended cap.
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: reviewPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        typeof event.delta.text === "string" &&
        event.delta.text.length > 0
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed.";
    logger.error({ err: message }, "review failed");
    try {
      res.write(`data: ${JSON.stringify({ error: `Review failed: ${message}` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch {
      // socket already closed
    }
  }
});

export default router;
