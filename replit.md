# Overview

PromptMeGood is a pnpm workspace monorepo project designed as a sophisticated AI prompt builder. Its main goal is to offer a structured interface for users to create precise AI prompts, improving clarity and effectiveness. The project aims to simplify AI interaction through smart suggestions, auto-optimization, and quality checks, ultimately boosting prompt effectiveness. It supports both beginners with guided modes and advanced users with an "Expert Mode." PromptMeGood plans to offer "Free" and "PRO" tiers, aiming to become a leading tool for better AI interactions and productivity.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure

The project is organized as a pnpm workspace monorepo, including packages such as `@workspace/api-spec`, `@workspace/db`, and `@workspace/api-server`.

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

PromptMeGood is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite. It includes companion static pages like `guide.html`, `pricing.html`, `review.html`, `privacy.html`, and `terms.html`.

### UI/UX and Design Decisions

-   **Color Scheme:** CSS variables for theming, with a default teal palette.
-   **Responsive Design:** Adapts layout for mobile and desktop.
-   **Form Layout:** "Generate" button is placed under the "Goal" field. Settings are in a collapsible `<details>` panel that is closed by default. "Expert Mode" expands relevant panels.
-   **User Guidance:** Employs onboarding tours, modals, and toasts, suppressing the welcome tour for returning visitors.
-   **Theme Accent:** Footer-based picker with 5 swatches, persisted in `localStorage`.
-   **Canonical Domain:** `https://www.promptmegood.com` with apex domain redirect to www.
-   **SEO:** Comprehensive meta-tags, optimized `<title>`, `<meta name="description">`, Open Graph, Twitter Card tags, and `SoftwareApplication` JSON-LD.
-   **Two-Column Build Area:** The main build area is split into two columns: the left for text prompt workflow and the right for image prompt workflow, including the Photography Suite.
-   **Image Column Flow:** Improved inline typing panel with a "Next" CTA, repositioned "Surprise Me" button, hidden "Clear Picks," and updated camera icon.
-   **Column Cleanup:** Removed redundant elements in the left workspace column, widened main columns, and loosened Photography Suite pill chips. The image before/after block is moved and updated with real cat photos.
-   **Symmetric Help Me Start Callouts:** Redesigned "Help Me Start" buttons for visual prominence and consistency across both text and image prompt columns.
-   **Per-Column Inline Typing Panel:** Added collapsible inline typing fields below "Help Me Start" callouts in each column, linked to the canonical `#goal` field.
-   **Image Prompt Wizard:** Implemented a 5-step modal for image prompt creation, composing selections into the `#goal` field.
-   **Unified Photo Flow:** Consolidated Photography Suite and "Create An Image" UI, adding a `📋 Copy Prompt` button and reframing the send button to `🎨 Generate Image Here`.

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form with fields for goal, category, skill level, tone, output format, language, personality, details, guardrails, and max response length. Includes "Boost Toggles."
-   **Smart Systems:**
    -   **Smart Suggestions:** Keyword analysis for prompt parameters.
    -   **Auto Optimize:** Applies suggestions to untouched fields.
    -   **AI Tool Recommender:** Suggests AI tools based on keywords.
    -   **Prompt Strength Score:** Heuristic-based score with insights.
-   **Weekly Focus:** Rotating curated goal pin.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Features for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode:** Opt-in mode hiding guidance and revealing advanced controls, with state persisted in `localStorage`.
-   **API Server Layout:** Cross-cutting middleware in `artifacts/api-server/src/middlewares/` for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):**
    -   `POST /api/generate`: Accepts both legacy and structured prompt payloads using `gpt-4o-mini`.
    -   `POST /api/generate-stream`: Streams structured payloads as Server-Sent Events (SSE).
    -   `POST /api/run`: Streams `gpt-4o` responses as SSE for in-app "Run With AI."
    -   `GET /api/stats`: Returns `{promptCount, runCount}`.
    -   `GET /health`, `GET /api/health`: Return `{status:"ok"}`.
    -   **Rate Limiting:** Per-IP rate limits for generate (20/hr) and run (5/hr).
    -   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` for `/generate` endpoints and a daily $3 USD cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides `generateStream`, `generateStructured`, `generateRaw`, `generate`, `refine`, and `imagePrompt` with a streaming-first fallback chain. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel powered by `window.runWithAI` and `window.copyAIResponse`, streaming `gpt-4o` responses live into `#aiResponseOutput`. Pings `/api/health` to keep the dyno warm.
-   **Hero Usage Counter:** Displays combined prompt and run counts from `/api/stats` when exceeding 100.
-   **Dev-Only Code Review Tool:** `POST /api/review` (production-gated) streams a structured Claude review of bundled source files to `/review.html`.
-   **Image Upload + Vision Analyze:** Allows uploading images (JPG/PNG ≤ 10 MB) which are then analyzed by AI via `/api/analyze` to describe their content, filling the prompt textarea.
-   **Paywall Switch (Open-Beta):** A central `isPaywallActive()` helper driven by `OPEN_BETA_MODE` and `PAYWALL_ACTIVATES_AT` Replit Secrets, controlling beta access and paywall activation. Frontend adapts UI based on `paywallActive` status from `/api/public-config`. **T43:** During open beta, `POST /api/create-checkout-session` rejects `tier:"pro"` requests with HTTP 403 (Founding tier always passes through), and the frontend hides every Pro upgrade CTA — only the Founding `data-pmg-tier="founding"` button is restored by T42 beta-mode CSS overrides. Also fixed a pre-existing bug where `buildSuite()` in `pmg-ux.js` would append the Photography Suite to `<body>` on pages without `#builder` (pricing.html, guide.html, etc.); it now early-returns instead.
-   **T44 — Pricing & Builder Polish:** (1) `pricing.html` now shows a 4-card 2x2 grid with a new **PRO Yearly $79/year** display-only tier ("Coming Soon — Available After Beta"); the card has an outlined "Notify Me When Yearly Launches" CTA and a callout pointing to the June 1, 2026 beta end — no purchase button while the beta is active. (2) The **"📌 This Week's Focus"** weekly-goal pin (`#weekly-goal-pin`) is now promoted out of the form-wrap and rendered as the first child of `#builder` (inside `#pmg-weekly-pin-wrap`, class `pmg-weekly-pin-promoted`), centered above the two workspace columns and visible on initial load (was previously hidden until first generation). The promote IIFE polls until both elements are mounted and re-hides the pin in image-mode. Because the `#goal` textarea on the home page is hidden by default behind the T31 "Help Me Start" callout, clicking the pin's `#weekly-goal-cta` would otherwise stuff the value into an invisible textarea; a capture-phase click listener now programmatically clicks `#pmg-text-help-row-skip` first to reveal the textarea before the original `applyWeeklyGoal()` handler runs, so the focus + scroll lands on a visible element. (3) Removed the orphan **"No Signup. Free."** sub-label and the **duplicate outlined "Help Me Start"** button that used to render directly under "Fix My Prompt" in the left column: `addGenerateSubLabel()` now early-returns and removes any existing `#pmg-generate-sublabel`; `reorderHelpMeStart()` no longer relocates `#guided-mode-btn` next to "Fix My Prompt" and instead hides `#guided-cta-row` + `#guided-mode-btn`. Defensive CSS in the same T44 IIFE force-hides `#pmg-generate-sublabel`, `#pmg-help-me-start-helper`, `#guided-mode-btn`, `#guided-cta-row`, `#pmg-help-me-start-recommend-row`, and `#pmg-helpstart-pair-row` (using `[id]` selectors to beat legacy `!important` rules) so the late-mounting T15/T16/T17 pill IIFEs cannot un-hide them.
-   **T46 — Text Studio Pro:** New "Transform Text" tab inside the prompt builder, implemented as a self-contained script `artifacts/promptmegood/public/scripts/pmg-text-studio.js` (cache-busted via `?v=3` in `index.html`). Adds a tab bar at the top of `.form-wrap` with two tabs: "Build A Prompt" (the existing form) and "Transform Text" (new). When the new tab is active, body class `pmg-ts-active` hides `#prompt-form`, the weekly-goal pin, the guided CTA row, the examples block, the Help-Me-Start row, and the right `#result-panel`, and the panel renders a strict linear flow: editable textarea + file upload, 9 vertically-stacked transformation modes (Speed Upgrade, Analyze, Turn It Into Money, Find The Hook, Multiply Into Content, Remix The Voice, Make It Record-Ready, Translate For An Audience, Expand The Idea — 2 free, 7 Pro), a dynamic action button, and a structured output area with Copy / Save / Remix Again / Restore Original controls. Pro lock defers to `window.pmgIsPro()` (beta unlocks all). Transformations call `window.__pmgAI.generateRaw` with a per-mode markdown-section template and parse `## Section` headers into cards. State and last 20 saved versions persist in `localStorage`. Upload accepts a wide range of text-based formats (.txt, .md, .markdown, .rtf, .csv, .tsv, .json, .html, .xml, .yaml, .log, .srt, .vtt, .tex, .css, .js, .ts, .py, .sql, .ini, .conf, .env), with a 1 MB size cap, balanced-brace RTF metadata-group stripping (drops `fonttbl`, `colortbl`, `stylesheet`, `info`, `pict`, etc.) plus control-word/unicode-escape stripping, a binary-content heuristic that rejects renamed PDFs/DOCX/images with a friendly hint pointing back to the existing PDF analyzer, and a 12k character cap on loaded text. Escape hatches: `?notextstudio`, `localStorage pmg_textstudio_disable`. Existing flows (Build A Prompt form, Fix My Prompt, Money Mode Pro panel, `#upload-field` PDF/image analyzer, Stripe/Supabase/auth) are untouched — Text Studio uses unique `pmg-ts-*` IDs/classes only.
-   **T45 — Builder/Header Cleanup:** Four photo-driven follow-ups, all implemented as additional CSS appended to the existing T44 IIFE in `pmg-ux.js` (no new IIFE, no HTML edits). (1) **Removed the yellow "★ Most Loved" Help Me Start pill** (`#pmg-help-me-start-btn`) above "Fix My Prompt" — user reversed their earlier T44 keep-decision; the pill duplicated the larger Help Me Start callout at the top of the same column. (2) **Removed the "Quick Start Ideas" chip block** (`.examples-block[aria-label="Example prompts"]` with chips: "Make money online fast", "Find a winning dropshipping product", "Go viral on TikTok", "Fix a business problem") under More Control — the same ideas already exist in the use-cases carousel and the Need Ideas dice. (3) **Stopped the topbar nav buttons from wrapping onto two lines** at narrow desktop widths (~900–1180px): `.topbar .ghost-link, .theme-toggle, #expert-mode-btn, [data-pmg-expert-toggle], #replay-tour-btn` get `white-space: nowrap !important`, plus a media-query that tightens padding (12px) and font-size (13px) so every button stays on a single line at 1024px without collapsing to the mobile burger. (4) **Killed the dark-teal "ghost" artifact in the upper-left** the user reported. Root cause: the sticky `.topbar` was a frosted-glass bar (`background: color-mix(--color-bg 84%, transparent)` + `backdrop-filter: blur(14px)`); dark-teal elements (rounded top of `.builder-intro-speech` bubble, "Create A Text Prompt" pill button) passed BEHIND the 16% translucent glass and their blurred silhouette bled through. Fix: `header.topbar[class] { background: var(--color-bg) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }` — fully opaque topbar, no see-through, artifact gone. The PMG brand logo + "PromptMeGood" wordmark are intentionally preserved.
-   **Stripe Checkout:** Integrates Stripe for "Pro" and "Founding Member" tiers. Handled via `startCheckout()` which redirects to Stripe Checkout, with webhook acting as the source of truth for updating user profiles in Supabase.
-   **Supabase Auth + Save Best Prompts:** Implements magic-link email authentication via Supabase JS SDK. Allows authenticated users to save current prompts and AI outputs to a `prompts` table in Supabase and reload past prompts.
-   **Renderer Stability:** `T26 ObserverGuard` monkey-patches `window.MutationObserver` to coalesce records and auto-disconnect runaway observers.
-   **Image Generation UX:** Enhancements to `runImageGeneration()` including live progress, success callout, restyled download button, and retry button on errors.
-   **Use Demo Values UX:** Button (`#fill-demo`) to load sample prompts with visual feedback and guidance.
-   **Smart Assist:** Inactivity-driven helper providing guidance, with debounced activity timers.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions and one-time payments.
-   **Supabase:** Authentication and database for user-saved prompts.