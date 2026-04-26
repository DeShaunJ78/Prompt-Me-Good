# Overview

This project is a pnpm workspace monorepo using TypeScript, designed to build a sophisticated AI prompt builder named "PromptMeGood". The core purpose of PromptMeGood is to provide a structured interface for users to craft precise prompts for AI, ensuring clear communication of intent and desired output.

PromptMeGood aims to simplify and enhance the AI interaction experience by offering features like smart suggestions, auto-optimization, and quality checks, thereby increasing the effectiveness of AI prompts. The project targets a wide user base, from casual users to power users, with features like guided modes for beginners and an "Expert Mode" for advanced control.

The business vision includes a "Free" tier and a "PRO" tier (coming soon), indicating a potential for subscription-based revenue, and an early-access program to gather user interest and feedback. The project's ambition is to become a leading tool in the AI prompting space, fostering better AI interactions and productivity.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure

The project is structured as a pnpm workspace monorepo, with each package managing its own dependencies. Key packages include `@workspace/api-spec`, `@workspace/db`, and `@workspace/api-server`.

## Tech Stack

-   **Monorepo Tool:** pnpm workspaces
-   **Node.js:** v24
-   **Package Manager:** pnpm
-   **TypeScript:** v5.9
-   **API Framework:** Express 5
-   **Database:** PostgreSQL with Drizzle ORM
-   **Validation:** Zod (v4) and `drizzle-zod`
-   **API Codegen:** Orval (from OpenAPI spec)
-   **Build Tool:** esbuild (CJS bundle)

## PromptMeGood Artifact (`artifacts/promptmegood`)

PromptMeGood is a single-file static HTML AI prompt builder (`index.html`) built with vanilla JavaScript and Vite for preview. It includes companion pages for a `guide.html` (long-form manual) and `pricing.html`.

### UI/UX and Design Decisions

-   **Color Scheme:** Utilizes CSS variables for theming, including a teal border (`#0f766e`) and background (`#DAF1EE`) for specific elements.
-   **Interaction Feedback:** Implements `_webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, and `:active { transform: scale(0.98); }` for improved responsiveness on touch devices and visual feedback on clicks.
-   **Responsive Design:** Adjusts element positioning and padding (e.g., use-case confirmation banner) for mobile (≤600px) and desktop.
-   **Onboarding Tour:** Features a multi-step in-app onboarding tour (`OB_STEPS`) and a demo walkthrough (`DEMO_STEPS`).
-   **Modals and Toasts:** Extensive use of modals (`#guided-mode-dialog`, `#expert-warning-dialog`) and toasts (`showToast`, use-case confirmation banner) for user guidance and feedback.

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form with fields like goal, category, skill level, tone, output format, output language, personality, details, guardrails, and max response length.
-   **Boost Toggles:** Four boost options (Money, Human Voice, Clarity, Photo) are grouped under a collapsible "Advanced Options" section.
-   **Smart Systems:**
    -   **Smart Suggestions:** Keyword analysis of the goal field to recommend categories, tones, output formats, and max lengths.
    -   **Auto Optimize:** Automatically applies suggestions to untouched fields, with user preference persistence via `localStorage`.
    -   **AI Tool Recommender:** Suggests relevant AI tools (ChatGPT, Claude, Perplexity) based on prompt goal keywords.
    -   **Prompt Strength Score:** Heuristic-based 0-100% score with insights, calculated based on various prompt parameters.
-   **Weekly Focus:** Rotating curated goal pin (`#weekly-goal-pin`) updated weekly, with persistence tracking in `localStorage` for "New" badge display.
-   **Guided Mode:** A 4-question modal to help users formulate goals, details, and guardrails.
-   **Refinement and Quality Check:** Features for refining prompts, undoing changes, and a "Quality Checker" that provides suggestions based on heuristics.
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash for shareable links, with prefilling logic on `hashchange`.
-   **Expert Mode:** An opt-in mode that hides guidance, reveals advanced controls, and introduces keyboard hints. State and activation count are persisted in `localStorage`. Tour resilience ensures guided elements remain visible during onboarding.
-   **Manual/Guide:** Split into a quick-start on `index.html` and a comprehensive `guide.html` with a table of contents and reorganized content.
-   **Theme Accent:** Footer-based picker (`.site-footer-personalize`) with 5 swatches — PromptMeGood Green (default), Deep Blue, Royal Purple, Warm Gold, Slate. Swaps `--color-primary` (and `--color-primary-hover`/`--color-primary-highlight`, or `--color-primary-strong` on pricing.html) via `<html data-accent="X">`. Persisted in `localStorage` under `promptmegood:themeAccent:v1`. A synchronous bootstrap script in `<head>` on all 3 HTML pages applies the saved accent before paint to avoid flash; CSS overrides are placed at the end of each page's stylesheet so they win equal-specificity cascade ties over the base `:root` / `[data-theme="light"]` declarations.
-   **Canonical Domain:** `https://www.promptmegood.com` is the primary canonical host. The apex (`promptmegood.com`) is mirrored to www via a tiny synchronous redirect script placed at the very top of `<head>` on `index.html`, `guide.html`, and `pricing.html` — checks `location.hostname === 'promptmegood.com'` and `location.replace()`s to the www variant, preserving path/search/hash. This requires both apex and www to be linked as custom domains in the Replit Publishing UI (and DNS records pointed at Replit) so the redirect script actually executes. Canonical/og:url tags use `https://www.promptmegood.com`.
-   **SEO:** `index.html` has a full meta-tag set in `<head>` — SEO-optimized `<title>` and `<meta name="description">`, `<link rel="canonical" href="https://www.promptmegood.com">`, Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`), and Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:description`). Heading hierarchy: single visible H1 in the hero (`AI Prompt Generator That Actually Gets Results`), and four keyword-rich H2s — `Build Better Prompts for ChatGPT, Claude, and Any AI Tool` (hero card), `Start With a Prompt or Explore Use Cases` (popular uses), `Why Most AI Prompts Fail` (dedicated section between use cases and builder intro, id `#why-prompts-fail`), `How It Works` (builder intro). Fontshare CSS uses `preconnect` + `preload` + `display=swap` for fast first paint; Clarity script is async.
-   **Globals:** `window.__pmgSmartSystems` (for `markAllTouched`, `clearTouched`, `recompute`) and `window.__pmgStrengthScore` (for `render`, `hide`) are exposed for smart system functionality.
-   **Builder Layout Order:** Inside the builder section, the children of `.form-wrap` are intentionally ordered: (1) `#guided-cta-row` (Guide Me card with `.guided-cta-recommended-badge` "Recommended First Step"), (2) `#weekly-goal-pin` (Weekly Focus), (3) the `<form>` (Auto Optimize toggle, Goal field, etc.). A small `#builder-expert-hint` ("Power user? Turn on Expert Mode for full control.") sits next to the Expert Mode toggle in the builder header.
-   **Build A Prompt CTA Enhancement:** The hero `#hero-build-cta` click handler intercepts (preventDefault on real left-click only — programmatic `.click()` allowed via `typeof e.button === 'number' && e.button > 0` early-return), smooth-scrolls to `#builder`, glows the builder panel, and immediately reveals `#build-cta-guidance` (5s auto-dismiss, or earlier if `#guided-mode-btn` is clicked) plus pulses `#guided-cta-row` with `.is-build-cta-highlight`. Guidance reveal happens immediately (no setTimeout wrapper) for reliability.
-   **Smart Assist:** Inactivity-driven helper at bottom-right (bottom-center on mobile). Stage 1 fires at 4s ("Need help getting started?" + Guide Me + Try Demo). Stage 2 fires at Stage 1 + 5s, OR direct 9s ("Still stuck?" + Guide Me + Try Demo + Use Cases + Tour + Dismiss). Activity events (scroll, click, keydown, focus, mousemove, touchstart) debounced 120ms reset timers. Suppression: `isTourActive()` (obIsOpen/tour-banner), `#fill-demo[data-busy="1"]`, `isAnyDialogOpen()` (native `<dialog>` + non-native overlays `#usecases-modal`, `#compare-overlay`, `#bk-overlay`, `#ob-overlay` checked via `hidden`/`aria-hidden`/`is-open`), prompt count >=1, sessionStorage `pmg_smart_assist_shown` / `pmg_smart_assist_dismissed`, user typing (focusin on input/textarea/contenteditable). Stage 2 promotion bypasses 'session' suppression when `currentStage === 1 && !root.hidden`. Markup uses `role="region"` (not `dialog`) since it is a non-modal helper.
-   **Desktop Visual Polish (≥769px):** Inside `@media (min-width: 769px)` near end of `<style>` (line ~2442): topbar gets thinner padding (`10px`), defined bottom border, and a soft shadow; nav buttons in `.top-actions` are uniform 38px-tall pill buttons with even 16px padding. Hero card padding bumped to `clamp(space-6, 2.4vw, space-8)` with increased badge/title/list spacing for breathing room. Hero CTA row uses `gap: 14px` and `min-height: 52px` so primary/secondary buttons align. Smart Assist anchored at `right:28px; bottom:28px; max-width:340px` to prevent overlap with use-cases or CTAs. All polish is desktop-only — mobile layout unchanged.
-   **AI Routes (Backend):** `artifacts/api-server/src/routes/ai.ts` exposes `POST /api/generate-prompt`, `POST /api/refine-prompt`, `POST /api/image-prompt`. All call OpenAI via `artifacts/api-server/src/lib/openai-client.ts`, which instantiates the `openai` SDK using `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` (set by Replit AI Integrations — never exposed to the frontend). Model: `gpt-5.4`, max_completion_tokens 8192 (2048 for image-prompt). System prompts instruct the model to output ONLY the prompt text — no headers, fences, or commentary. All inputs are clamped (`MAX_INPUT_CHARS = 6000`; context/style/instruction smaller). Responses follow `{ ok: true, result: string }` or `{ ok: false, error: string }`. A router-level in-memory rate limiter caps each client IP at 40 requests/hour across the 3 routes (returns HTTP 429) — defensive cost guard since the localStorage UX limits are bypassable. IP read from `x-forwarded-for` first, then `req.ip`. Map auto-prunes when it exceeds 5000 entries. Routes mounted in `routes/index.ts` via `aiRouter`.
-   **AI Frontend Client (`window.__pmgAI`):** Last IIFE in `index.html` (line ~8179) exposes `window.__pmgAI` with `generate(goal, context)`, `refine(prompt, instruction)`, `imagePrompt(subject, style)`. Each enforces a per-month localStorage usage cap keyed `pmg_ai_usage:YYYY-MM` (UTC) — 100 generates, 50 refines, 10 image prompts. Limit-exceeded throws `{code: 'LIMIT'}` so callers can show the toast `"You've reached the free monthly limit. PRO access will unlock more soon."`. `callAI()` uses fetch with a 60s `AbortController` timeout. Visible button: `#improve-with-ai-btn` (✨ "Improve with AI", `.btn-ai` gradient pill) sits at top of the refine actions-row. Click handler: rejects placeholder text, refuses if at limit, sets `aria-busy`, calls `__pmgAI.refine`, then dispatches `focus` → mutates `resultBox.textContent` → dispatches `input` (bubbles) → dispatches `blur` so the existing undo/edit pipeline (line ~7119 input listener) records the change correctly. On AI failure (network/server), falls back to clicking `[data-remix="detailed"]` (the local "More Detailed" remix) so users are never stuck. Status messages render in `#improve-status`. Uses `window.showToast` if available, otherwise inline status fallback.
-   **Use Demo Values UX:** The "Use Demo Values" button (`#fill-demo`) sits in a `.demo-stack` flex column inside `.actions-row` so its helper microcopy ("See how it works — loads a sample prompt instantly.") and transient loading line ("Generating demo prompt…") render directly under the button only — never under Generate or Random Prompt. Stack is `max-width: 220px` on desktop and full-width at `≤640px` (matching the actions-row column-stack breakpoint). Click handler: `dataset.busy` double-tap guard, "Loading Demo…" disabled label, 1000ms delayed loading-line reveal, 800ms goal-field teal glow (`.demo-glow` keyframe), `requestSubmit()` to trigger the form (which auto-scrolls), then 60ms post-submit: success toast ("Demo loaded — here's what a finished prompt looks like."), 800ms result-box glow, and inline guidance line `#demo-next-step` ("This is a sample prompt. Copy it, refine it, or go back and enter your own goal.") that auto-dismisses on any button click inside `#result-panel`. All side-effect paths are wrapped in `try/catch/finally` so `restoreBtn()` (clears slowTimer, hides loading line, re-enables button, restores label/aria-busy) always runs even if `requestSubmit()` throws.

# External Dependencies

-   **PostgreSQL:** Used as the primary database.
-   **Drizzle ORM:** ORM for interacting with PostgreSQL.
-   **OpenAPI Specification:** Used for defining API contracts and generating client-side code via Orval.
-   **Vite:** Build tool for the PromptMeGood frontend.
-   **Zod:** Schema declaration and validation library.