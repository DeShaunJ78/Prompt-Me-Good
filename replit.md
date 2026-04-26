# Overview

This project, "PromptMeGood", is a pnpm workspace monorepo using TypeScript, designed to be a sophisticated AI prompt builder. Its core purpose is to provide a structured interface for users to craft precise prompts for AI, enhancing clarity and desired output. PromptMeGood aims to simplify and improve AI interaction through features like smart suggestions, auto-optimization, and quality checks, thereby increasing prompt effectiveness. It targets a broad user base with features like guided modes for beginners and an "Expert Mode" for advanced users. The project envisions a "Free" and future "PRO" tier, indicating a subscription-based revenue model, and aims to become a leading tool in the AI prompting space to foster better AI interactions and productivity.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure

The project is a pnpm workspace monorepo, with packages like `@workspace/api-spec`, `@workspace/db`, and `@workspace/api-server`.

## Tech Stack

-   **Monorepo Tool:** pnpm workspaces
-   **Node.js:** v24
-   **Package Manager:** pnpm
-   **TypeScript:** v5.9
-   **API Framework:** Express 5
-   **Database ORM:** Drizzle ORM
-   **Validation:** Zod and `drizzle-zod`
-   **API Codegen:** Orval (from OpenAPI spec)
-   **Build Tool:** esbuild (CJS bundle)

## PromptMeGood Artifact (`artifacts/promptmegood`)

PromptMeGood is a single-file static HTML AI prompt builder (`index.html`) built with vanilla JavaScript and Vite. It includes companion pages for a `guide.html` and `pricing.html`.

### UI/UX and Design Decisions

-   **Color Scheme:** CSS variables for theming, with a default teal palette.
-   **Interaction Feedback:** Improved responsiveness for touch devices with visual feedback on clicks.
-   **Responsive Design:** Adapts layout for mobile and desktop views.
-   **User Guidance:** Utilizes onboarding tours, modals, and toasts.
-   **Theme Accent:** Footer-based picker with 5 swatches, persisted in `localStorage` and applied synchronously to avoid flash.
-   **Canonical Domain:** `https://www.promptmegood.com` with apex domain redirect to www for consistency.
-   **SEO:** Comprehensive meta-tags, optimized `<title>`, `<meta name="description">`, Open Graph, and Twitter Card tags. Strategic heading hierarchy and font loading optimization.

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form with fields for goal, category, skill level, tone, output format, language, personality, details, guardrails, and max response length. Includes "Boost Toggles" in an "Advanced Options" section.
-   **Smart Systems:**
    -   **Smart Suggestions:** Keyword analysis to recommend prompt parameters.
    -   **Auto Optimize:** Applies suggestions to untouched fields, persisting user preferences.
    -   **AI Tool Recommender:** Suggests AI tools based on prompt goal keywords.
    -   **Prompt Strength Score:** A heuristic-based score with insights.
-   **Weekly Focus:** Rotating curated goal pin with persistence tracking.
-   **Guided Mode:** A structured modal to assist with prompt formulation.
-   **Refinement and Quality Check:** Features for prompt refinement, undo, and a "Quality Checker" providing heuristic-based suggestions.
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash for shareable links.
-   **Expert Mode:** Opt-in mode hiding guidance and revealing advanced controls, with state persisted in `localStorage`.
-   **AI Routes (Backend):** `POST /api/generate` accepts both legacy `{prompt}` (Improve with AI) and structured `{goal, category, experience, tone, format, language, personality, extraDetails, avoid, moneyMode, humanVoice, clarityBoost, expertMode}` payloads. `POST /api/generate-stream` streams the same structured payload as Server-Sent Events (`data: {"text":"…"}` chunks ending with `data: [DONE]`). `POST /api/run` (NEW) takes `{prompt}` and streams the **gpt-4o** response back as SSE — this powers the in-app "Run With AI" feature so users can execute their finished prompt and see results without leaving the page. `GET /api/stats` returns `{promptCount, runCount}` (both from an in-memory counter with debounced disk-flush at `data/pmg_stats.json`). `GET /health` (mounted at app root for direct ops monitoring) and `GET /api/health` (the path the frontend keep-alive pings every 4 minutes, since the artifact path-router only forwards `/api/*` to this api-server) both return `{status:"ok"}`. The generate endpoints use `gpt-4o-mini` with `max_completion_tokens: 600`; `/api/run` uses `gpt-4o` with `max_completion_tokens: 1000` and a 2000-char prompt cap. Per-endpoint rate limits: `generateLimiter` 20/hr, `runLimiter` 5/hr, legacy `rateLimit` 10/min — all keyed by `req.ip` with `trust proxy = 1`. **Cost protection:** an in-memory `INJECTION_BLOCKLIST` rejects classic prompt-injection patterns (`ignore previous instructions`, etc.) on `/generate` and `/generate-stream`; a daily $3 USD cost cap (in-memory tally keyed by UTC date, 1-second debounced flush to `data/pmg_cost.json`) is enforced via a two-stage guard — `costCheck` middleware GATES requests, while `chargeCost(endpoint)` is called explicitly INSIDE each handler AFTER body validation, so malformed/oversized payloads cannot drain the budget. Per-call rates: `COST_PER_GENERATE = 0.004`, `COST_PER_RUN = 0.010`. Other endpoints (`/api/generate-prompt`, `/api/refine-prompt`, `/api/image-prompt`) use `gpt-5.4`. All AI calls go through a secure server-side client.
-   **AI Frontend Client:** `window.__pmgAI` provides `generateStream`, `generateStructured`, `generateRaw`, `generate`, `refine`, and `imagePrompt`. The Generate form uses the streaming-first fallback chain `stream → structured → raw → local template` so a single transient backend failure never erases the user's prompt. The Improve with AI button continues to call legacy `/api/generate {prompt}`. Per-month `localStorage` caps (100 generates, 50 refines, 10 image prompts) still apply, and limit-reached errors trigger a non-destructive toast plus the local fallback.
-   **Run With AI (Frontend):** `window.runWithAI` and `window.copyAIResponse` (exposed via the `__pmgRun` IIFE) power the post-generation "Run This Prompt With AI" panel. The `#runSection` is hidden by default and revealed by `finalize()` after a prompt is generated. Clicking Run reads the (editable) prompt from `#resultBox.textContent`, POSTs to `/api/run`, parses the SSE stream (with `[DONE]` hard-stop and CRLF normalization), and streams tokens into `#aiResponseOutput` live. Errors (network / 429 / model failure) render inline. A separate IIFE pings `/api/health` every 4 minutes (only while the tab is visible) to keep the dyno warm during active sessions.
-   **Hero Usage Counter:** A hidden `#usageCounter` element in the hero loads `/api/stats` on page load and reveals itself only when the COMBINED count (`promptCount + runCount`) exceeds 100. Failures are silent so the hero is never broken by a stats outage.
-   **Dev-Only Code Review Tool:** `POST /api/review` (mounted in `routes/index.ts` only when `NODE_ENV !== "production"`, with a defensive in-handler 403 fallback) bundles a curated list of source files (`app.ts`, `routes/index.ts`, `routes/ai.ts`, `routes/health.ts`, `routes/review.ts`, `index.html` — capped at 80KB/file and 400KB total) and streams a structured Claude review (claude-sonnet-4-6 via the Replit-managed Anthropic AI integration; no user-supplied API key) back as SSE. The companion page at `/review.html` (registered as a Vite rollup input alongside main/guide/pricing) lets a developer click "Run Review", watch the stream live, then see scored cards (bugs/UX/security/polish 0-10), a summary, and filterable issue cards with "Show fix" / "Copy fix" affordances. Marked `noindex,nofollow`. The endpoint and page never expose secrets or write data.
-   **Use Demo Values UX:** Button (`#fill-demo`) to load sample prompts, with visual feedback, loading states, and inline guidance.
-   **Smart Assist:** Inactivity-driven helper providing guidance, with debounced activity timers and suppression logic to prevent interference.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.