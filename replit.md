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

PromptMeGood is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite. It includes companion static pages like `guide.html`, `pricing.html`, `review.html`, `privacy.html`, and `terms.html`, all registered as Vite rollup inputs.

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
    -   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` for `/generate` endpoints and a daily $3 USD cost cap enforced via `costCheck` middleware and explicit `chargeCost`.
-   **AI Frontend Client:** `window.__pmgAI` provides `generateStream`, `generateStructured`, `generateRaw`, `generate`, `refine`, and `imagePrompt` with a streaming-first fallback chain. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel powered by `window.runWithAI` and `window.copyAIResponse`, streaming `gpt-4o` responses live into `#aiResponseOutput`. Pings `/api/health` to keep the dyno warm.
-   **Hero Usage Counter:** Displays combined prompt and run counts from `/api/stats` when exceeding 100.
-   **Dev-Only Code Review Tool:** `POST /api/review` (production-gated) streams a structured Claude review of bundled source files to `/review.html`.
-   **Defensive Photo Group Toggle + Use As Reference Description:** Implemented a capture-phase click listener for photo group toggles and added a description for "Use As Reference" functionality.
-   **T36 Centered Foot Meta:** Unified the inline-typing foot row to a single centered meta line.
-   **T37 Group Init + Pill Descriptions:** Collapses ALL Photography Suite groups on init (including Style) and appends a "See Descriptions →" toggle inside each group body that reveals an inline catalog of every pill's meaning (style/camera/lighting/composition/palette).
-   **T38 Toggle Override (final fix):** T24's `MutationObserver` was unconditionally re-adding `is-collapsed` to non-Style groups every time anything in the body mutated, snapping user-toggled groups back closed. T38 introduces a parallel `data-pmg-state="open|closed"` attribute on each group plus `!important` CSS that makes the visual state follow the attribute (the `is-collapsed` class is now visually inert). A window-capture click listener (fires before document-capture) toggles the attribute, with a 250 ms per-group debounce to absorb double-fired clicks from synthetic pointer sources. Initial state for each group is mirrored from `is-collapsed` on first sight.
-   **T42 Open-Beta Paywall Switch (2026-04-29):** Central `isPaywallActive()` helper in `artifacts/api-server/src/lib/paywall.ts`, driven by two Replit Secrets: `OPEN_BETA_MODE` (anything other than the literal string `"true"` forces paywall ON immediately) and `PAYWALL_ACTIVATES_AT` (ISO timestamp; before this moment the paywall is OFF, after it the paywall flips ON automatically with no code change). Boot-time line `Paywall: ON|OFF (...)` logged by `logPaywallStatusOnce()` in `src/index.ts`, gated to non-production. `/api/public-config` spreads `getPaywallStatus()` into its response (`paywallActive`, `openBetaMode`, `paywallActivatesAt`) with `Cache-Control: max-age=30`. **Frontend implementation** lives at the bottom of `artifacts/promptmegood/public/scripts/pmg-ux.js` as a self-contained IIFE that fetches `/api/public-config` independently of T40, then: when `paywallActive===false` it adds `pmg-beta-mode` + `pmg-is-pro` body classes (via `pmgUnlockPro()`) so every gated panel unlocks for everyone, renders sticky banner `#pmg-t42-beta-banner` ("Free Beta Access Until June 1, 2026 — Founding Member Access Available Now.") at the top of `<body>` (dismissable per session via `sessionStorage["promptmegood:t42-banner-dismissed"]`; on `/pricing.html` the founding-member phrase is plain text, elsewhere it links to `./pricing.html`), and injects an override CSS rule `body.pmg-beta-mode.pmg-is-pro .pmg-upgrade-btn[data-pmg-upgrade] { display: inline-flex !important }` to defeat T41's "hide upgrade buttons when pro" rule so checkout CTAs stay visible as soft nudges. **Critical revoke design:** T42 uses a separate marker `localStorage["promptmegood:t42-beta-unlock:v1"]="1"` to remember it (not real Stripe) was the source of the unlock; the moment the fetched config returns `paywallActive===true`, `revokeBetaUnlock()` clears `promptmegood:pro:v1`, removes both body classes, and removes the marker — but only when the marker is present, so genuine Stripe-paid users with `pmg-is-pro` and no marker are NEVER touched. Same fail-safe revoke runs if the config fetch errors. Console log `[pmg-t42] Paywall: OFF|ON (...)` is gated to non-`*.replit.app` hosts. Stripe checkout, magic-link auth, webhook → Supabase profile pipeline, and T41 plan-sync logic are all untouched.
-   **T41 Stripe Checkout (Pro + Founding Member):** Two upgrade tiers wired through one button surface (`[data-pmg-upgrade]` on `pricing.html` plus an auto-injected inline CTA on the homepage). Each button declares its tier with `data-pmg-tier="pro"` (default) or `data-pmg-tier="founding"`. Clicks run through `pmg-ux.js` `startCheckout()`, which (a) waits up to 5s for T40's Supabase client to bootstrap, (b) calls `client.auth.getSession()` to read the LIVE session from localStorage (NOT the T40 cached `currentUser`, which is populated asynchronously and was the root cause of the "Sign In To Upgrade" false negative), (c) POSTs `{tier}` to `/api/create-checkout-session` with a Bearer JWT, and (d) redirects to Stripe Checkout. The backend maps `tier` → env-controlled price ID server-side: `pro` uses `STRIPE_PRICE_ID` with `mode:'subscription'`; `founding` uses `STRIPE_FOUNDING_PRICE_ID` with `mode:'payment'` (one-time $49 lifetime). The selected tier is stamped onto `metadata.tier` and surfaced back as `?upgrade=success&tier=…` so the post-Stripe poller toasts the right label. Webhook is the **source of truth** — `POST /api/stripe-webhook` (mounted BEFORE `express.json()`, with `express.raw`) writes plan/status/period to Supabase `profiles`. `handleCheckoutCompleted` flips `plan='founding'` + `subscription_status='lifetime'` immediately when `session.mode==='payment' && metadata.tier==='founding' && payment_status==='paid'`. `handleSubscriptionUpsert` and `handleSubscriptionDeleted` skip writing the `plan` column when the user is already founding via an `isFoundingMember()` guard, so a future canceled trial subscription can never downgrade a paid lifetime customer. Frontend `applyProfileToCache` treats `plan==='pro' || plan==='founding'` as paid, so the `pmg-is-pro` body class and `promptmegood:pro:v1` localStorage cache are never cleared on founding members during the 60s sync poll. T41 BUG FIX (2026-04-29): `init()` now calls `fetchConfigAndInit()` unconditionally (previously gated on `buildPanel()` succeeding, which required `#builder` — a node only present on `index.html` — so Supabase auth never booted on `pricing.html` and other static pages). Required Replit Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_FOUNDING_PRICE_ID` (one-time $49 product), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. SQL + Stripe webhook setup steps in `artifacts/promptmegood/SUPABASE-SETUP.md` sections 3–4. pmg-pro.js was NOT modified.
-   **T40 Supabase Auth + Save Best Prompts:** New "Save Your Best Prompts" panel (collapsed by default, sits above `#builder`) lets a signed-in user save the current goal + AI output and reload past prompts into the builder. Magic-link email auth via Supabase JS browser SDK loaded from `cdn.jsdelivr.net`. Supabase URL + publishable (anon) key live in Replit Secrets as `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`; the api-server exposes them at `GET /api/public-config` (`artifacts/api-server/src/routes/public-config.ts`) so they're never hardcoded. All UI/auth/save/load logic lives in the T40 IIFE at the bottom of `pmg-ux.js`, idempotent via `window.__pmgT40Init`. Save Prompt button is hidden until a prompt is generated (MutationObserver on `#aiResponseOutput`). Storage uses a Supabase `prompts` table (`id`, `user_id`, `input`, `output`, `created_at`) protected by RLS policies "Users Can Read Own Prompts" and "Users Can Insert Own Prompts" — one-time SQL setup in `artifacts/promptmegood/SUPABASE-SETUP.md`. Magic-link redirect URLs must be allowlisted in the Supabase dashboard for both `https://www.promptmegood.com` and the dev preview domain.
-   **T39 Image Upload + Vision Analyze:** Both inline-typing panels (`#pmg-inline-typing-text` and `#pmg-inline-typing-image`) now show a "📎 Or Upload An Image — We'll Describe It For You" button below the textarea. Picking a JPG/PNG (≤ 10 MB) POSTs `multipart/form-data` to the existing `/api/analyze` endpoint with a side-specific describe prompt (text-side: subject + tone; image-side: subject + setting + lighting + composition). The AI's response fills the textarea and dispatches `input` so it syncs to `#goal`, after which the user proceeds normally — Fix My Prompt on the text side, Photography Suite + Generate Image Here on the image side. Idempotent via `window.__pmgT39Init`; decoration is per-panel via `data-pmg-t39` and uses an interval + MutationObserver because the panels are built lazily.
-   **Unified Photo Flow:** Consolidated Photography Suite and "Create An Image" UI, adding a `📋 Copy Prompt` button and reframing the send button to `🎨 Generate Image Here`.
-   **Renderer Stability:** `T26 ObserverGuard` monkey-patches `window.MutationObserver` to coalesce records via `requestAnimationFrame` and auto-disconnect runaway observers to prevent renderer overload.
-   **Image Generation UX:** Enhancements to `runImageGeneration()` including live progress, success callout, restyled download button, retry button on errors, and a `MutationObserver` to reset the generate button label.
-   **Use Demo Values UX:** Button (`#fill-demo`) to load sample prompts with visual feedback and guidance.
-   **Smart Assist:** Inactivity-driven helper providing guidance, with debounced activity timers.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.