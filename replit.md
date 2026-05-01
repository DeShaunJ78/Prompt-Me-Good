# Overview

PromptMeGood is a pnpm workspace monorepo project for building an AI prompt builder. It aims to provide an intuitive interface for creating effective AI prompts through smart suggestions, auto-optimization, and quality checks. The project focuses on enhancing AI interactions and productivity for all users, offering "Free" and "PRO" tiers, with the ambition of becoming a leading tool in AI prompt engineering.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure

The project uses a pnpm workspace monorepo, organizing packages like `@workspace/api-spec`, `@workspace/db`, and `@workspace/api-server`.

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

PromptMeGood is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite, with companion static pages for guide, pricing, review, privacy, and terms.

### UI/UX and Design Decisions

-   **Color Scheme:** CSS variables for theming with a default teal palette.
-   **Responsive Design:** Adapts layout for mobile and desktop.
-   **Form Layout:** Specific placement for "Generate" button and collapsible settings panel.
-   **Create A Text Prompt — Linear Column Flow (T15, 2026-04-30):** The text prompt column now flows strictly top-to-bottom: (1) Workspace header "Create A Text Prompt", (2) Goal label "What Do You Want AI To Help You With?", (3) Goal textarea (visible by default — no gating callout), (4) Primary "Export To Fix My Prompt" CTA, (5) Optional "Add A File Or Image (Optional)" upload box (Task #18), (6) Secondary "💡 Help Me Start (Answer 4 Quick Questions)" with the "★ Most Loved" badge, (7) Collapsed "⚙ More Control ▾" pill, (8) "Your Fixed Prompt" result panel, (9) Collapsed "Improve Your Prompt (Optional)" panel folding the Text Studio Pro under summary "Want To Make This Even Better?". Implemented as an additive overlay in `artifacts/promptmegood/public/scripts/pmg-linear-flow.js` so existing IDs, function names, and image-mode behavior remain untouched.
-   **Inline Optional File Upload In Text Mode (Task #18, 2026-04-30):** The pre-existing `#upload-field` ("Upload A File Or Image For Smarter Results") was previously hidden globally by an old T21 Phase A rule. That rule was rescoped to `body.image-mode #upload-field` so the upload box is now visible inline in Create A Text Prompt only. It is positioned via flex `order: 2` between Fix My Prompt and Help Me Start, tightened to a compact box (reduced padding, smaller controls, ellipsis filename truncation, no horizontal overflow), and falls back to a clean document-icon row (`.pmg-no-img` ::before) instead of a broken-image glyph when a non-image file (e.g. PDF) is selected or the preview `<img>` errors. Photography Suite remains visually identical — every override is text-mode-scoped.
-   **Result Panel Empty / Loading / Error Visuals (T29, 2026-05-01):** The homepage prompt builder's result area now matches the visual treatment introduced for the Image Generator (T24) and Transform Studio. A new additive overlay element (`.pmg-result-overlay`) is injected before `#resultBox` inside `.result-wrap` and switches between four states via `data-state`: `hidden` (real content streams into `#resultBox`), `empty` (styled "Your Fixed Prompt Will Appear Here" card on first arrival), `loading` (skeleton lines reusing the shared `.pmg-skeleton-shimmer` class from `pmg-image-fix.js`, so reduce-motion is honored automatically), and `error` (inline banner with title "We Couldn't Reach The AI" plus a "Try Again" button that re-fires the form via `requestSubmit()`, with an optional "Use Backup Prompt" link routed through the existing `finalize()` pipeline). State transitions are driven by a MutationObserver on `#resultBox` (catches streaming chunks and validation messages) and a capture-phase click handler on `#generateBtn` (skips the skeleton when the goal field is empty so the validation nudge shows immediately). The legacy silent local-prompt fallback in `useLocalFallback()` was rewired to surface the styled error banner instead of writing the local builder's text into `#resultBox` automatically. Implementation: new `artifacts/promptmegood/public/scripts/pmg-result-states.js` plus a small additive change in `artifacts/promptmegood/index.html`. Image mode (`body.image-mode`) self-disables the overlay because the image generator owns its own states. Public API: `window.__pmgResultStates.{showEmpty,showLoading,showError,hide,getState}()` and `window.__pmgUseFallbackPrompt(text)`.
-   **Make This Prompt Chip Row (T19, 2026-04-30):** A guided chip row "Make This Prompt:" (More Specific / More Persuasive / More Detailed / Beginner Friendly / Professional Tone) is prepended to the open body of the "Improve Your Prompt (Optional)" collapsible. Each chip drives the existing Text Studio MODES via `selectMode()` + `runTransformation()` (no new endpoint, no duplicate transform logic): the chip pre-fills `#pmg-ts-textarea` with the current `#resultBox` text, clicks the matching `.pmg-ts-mode-card`, then `#pmg-ts-action`. When the studio finishes, it dispatches a new `pmg-ts:transform-complete` CustomEvent (and `pmg-ts:transform-error` on failure) carrying the parsed first-section body; the chip listener writes that text back into `#resultBox` in place, then re-fires an `input` event so dependent UI (T26 strength score) refreshes. Run/Copy/Refine remain adjacent. Implementation lives in `artifacts/promptmegood/public/scripts/pmg-linear-flow.js` (chip row + listener) with two additive `dispatchEvent` calls in `artifacts/promptmegood/public/scripts/pmg-text-studio.js`. Image mode is untouched.
-   **User Guidance:** Onboarding, modals, toasts, and "Expert Mode" for advanced users.
-   **Theme Accent:** Footer-based picker with 5 swatches, persisted in `localStorage`.
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags for SEO.
-   **Two-Column Build Area:** Dedicated areas for text and image prompts.
-   **Help Me Start Callouts:** Redesigned for visual prominence.
-   **Image Prompt Wizard:** A 5-step modal for creating image prompts.
-   **Unified Photo Flow:** Consolidated Photography Suite and "Create An Image" UI.
-   **Top Bar Navigation:** Ensures single-line display at narrow desktop widths.
-   **Accessibility:** Fully opaque topbar.
-   **Click Affordance:** Clear visual cues for clickable, destructive, or focused elements (e.g., `.btn-destructive` class, dropdown chevrons, focus rings).
-   **Universal Close Affordances:** Modals, overlays, panels, and toasts can be closed via multiple methods (× button, ESC, backdrop click, selection).

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form for various prompt parameters (goal, category, tone, output format, etc.), including "Boost Toggles."
-   **Smart Systems:**
    -   **Smart Suggestions:** Keyword analysis for prompt parameters.
    -   **Auto Optimize:** Applies suggestions to untouched fields.
    -   **AI Tool Recommender:** Suggests AI tools based on keywords.
    -   **Prompt Strength Score:** Heuristic-based score with insights.
-   **Weekly Focus:** Rotating curated goal pin.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Features for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode:** Opt-in mode hiding guidance and revealing advanced controls, state persisted in `localStorage`.
-   **API Server Layout:** Cross-cutting middleware for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):**
    -   `POST /api/generate`: Accepts legacy and structured prompt payloads using `gpt-4o-mini`.
    -   `POST /api/generate-stream`: Streams structured payloads as Server-Sent Events (SSE).
    -   `POST /api/run`: Streams `gpt-4o` responses as SSE for in-app "Run With AI."
    -   `GET /api/stats`: Returns `{promptCount, runCount}`.
    -   `GET /health`, `GET /api/health`: Return `{status:"ok"}`.
    -   **Rate Limiting:** Per-IP rate limits for generate (20/hr) and run (5/hr).
    -   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` for `/generate` and a daily $3 USD cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides various generate, refine, and image prompt functions with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel powered by `window.runWithAI` and `window.copyAIResponse`, streaming `gpt-4o` responses into `#aiResponseOutput`.
-   **Hero Usage Counter:** Displays combined prompt and run counts from `/api/stats` when exceeding 100.
-   **Image Upload + Vision Analyze:** Allows uploading images for AI analysis via `/api/analyze` to describe content and fill the prompt textarea.
-   **Paywall Switch (Open-Beta):** Central `isPaywallActive()` helper driven by Replit Secrets `OPEN_BETA_MODE` and `PAYWALL_ACTIVATES_AT` to control beta access and paywall activation.
-   **Text Studio Pro:** Offers an editable textarea, file upload, 20 transformation modes (2 free, 18 Pro), a dynamic action button, and structured output. Supports various text-based file formats with size and character caps. Includes a "Custom Twist" field for user-defined instructions.
-   **Text Studio Pro · From My Vault:** A modal to browse and insert previously saved prompts from `localStorage`, with client-side categorization, search, and filtering.
-   **More Control:** Advanced settings panel toggle chip next to "Fix My Prompt" controls its visibility and open state.
-   **Beta-Mode Silent Unlock:** `pmgUnlockPro()` accepts `{silent: true}` to suppress "Pro Unlocked!" toast during beta.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for users to save and reload prompts and AI outputs.
-   **Renderer Stability:** `T26 ObserverGuard` monkey-patches `window.MutationObserver` to coalesce records and auto-disconnect runaway observers.
-   **Image Generation UX:** Live progress, success callout, restyled download button, and retry button on errors for `runImageGeneration()`.
-   **Use Demo Values UX:** `#fill-demo` button to load sample prompts.
-   **Smart Assist:** Inactivity-driven helper providing guidance.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.