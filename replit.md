# Overview

PromptMeGood is a pnpm workspace monorepo project focused on building a sophisticated AI prompt builder. Its core purpose is to provide a structured and intuitive interface for users to create clear, effective AI prompts through smart suggestions, auto-optimization, and quality checks. The project aims to enhance AI interactions and productivity for both beginners and advanced users, offering "Free" and "PRO" tiers, and striving to become a leading tool in the AI prompt engineering space.

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

PromptMeGood is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite, with companion static pages for guide, pricing, review, privacy, and terms.

### UI/UX and Design Decisions

-   **Color Scheme:** CSS variables for theming with a default teal palette.
-   **Responsive Design:** Layout adapts for mobile and desktop.
-   **Form Layout:** "Generate" button below "Goal" field; settings in a collapsible `<details>` panel.
-   **User Guidance:** Onboarding tours, modals, and toasts; "Expert Mode" expands relevant panels.
-   **Theme Accent:** Footer-based picker with 5 swatches, persisted in `localStorage`.
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags, Open Graph, Twitter Card, and `SoftwareApplication` JSON-LD.
-   **Two-Column Build Area:** Left for text prompt, right for image prompt (including Photography Suite).
-   **Symmetric Help Me Start Callouts:** Redesigned for visual prominence across both columns.
-   **Per-Column Inline Typing Panel:** Collapsible fields below "Help Me Start" callouts, linked to `#goal`.
-   **Image Prompt Wizard:** A 5-step modal for image prompt creation.
-   **Unified Photo Flow:** Consolidated Photography Suite and "Create An Image" UI, with `📋 Copy Prompt` and `🎨 Generate Image Here` buttons.
-   **Top Bar Navigation:** Ensured single-line display of nav buttons at narrow desktop widths.
-   **Accessibility:** Fully opaque topbar to prevent visual artifacts.

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form for goal, category, skill level, tone, output format, language, personality, details, guardrails, and max response length, including "Boost Toggles."
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
-   **AI Frontend Client:** `window.__pmgAI` provides `generateStream`, `generateStructured`, `generateRaw`, `generate`, `refine`, and `imagePrompt` with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel powered by `window.runWithAI` and `window.copyAIResponse`, streaming `gpt-4o` responses into `#aiResponseOutput`.
-   **Hero Usage Counter:** Displays combined prompt and run counts from `/api/stats` when exceeding 100.
-   **Image Upload + Vision Analyze:** Allows uploading images (JPG/PNG ≤ 10 MB) for AI analysis via `/api/analyze` to describe content and fill the prompt textarea.
-   **Paywall Switch (Open-Beta):** Central `isPaywallActive()` helper driven by Replit Secrets `OPEN_BETA_MODE` and `PAYWALL_ACTIVATES_AT` to control beta access and paywall activation.
-   **Text Studio Pro:** New "Transform Text" tab with an editable textarea, file upload, 9 transformation modes (2 free, 7 Pro), dynamic action button, and structured output area. Supports various text-based file formats (1MB size cap, 12k character cap). Active tab no longer persists across page loads — the page always opens in "Build Prompt" mode so the prompt builder is always visible on entry. The green action button is always enabled (except while a transformation is in flight) so empty-textarea clicks surface the "Drop in some text first." status instead of looking stuck. CSS distinguishes `:disabled` (cursor:not-allowed) from `.is-loading` (cursor:wait) so a disabled button no longer reads as a frozen pinwheel. AI calls are wrapped in try/catch so a synchronous client throw can't strand `inFlight=true` and lock the button forever; `refreshActionButton()` early-returns while `inFlight` so it can't re-enable the button or overwrite the loading label mid-run.
-   **Text Studio Pro · From My Vault:** A "📚 From My Vault" button in the textarea actions row opens a modal that reads the existing `localStorage['promptmegood:history:v1']` (read-only, no duplicate storage). Prompts are auto-categorised client-side via keyword regexes into Marketing, Email, Social, Code, Image, Video, Story, Music, Education, Business, and Other. The modal exposes a search box (matches across nickname, goal, details, tags, and prompt body), category filter chips with live counts, and a grouped scrollable list. Clicking an item inserts the prompt into `#pmg-ts-textarea`, persists state, refreshes the char counter and action button, and closes the modal. Backdrop click and ESC also close. Archived items are hidden. Empty state: "Your vault is empty. Generate a prompt first to fill it.".
-   **T51 De-Orphaned More Control:** The "More Control" advanced settings panel no longer renders as a standalone bar at the bottom of the form column. Its `<summary>` is hidden via CSS and the entire panel is hidden when collapsed. An inline "⚙ More Control" toggle chip is injected into the actions row next to "Fix My Prompt" and controls the panel's open state. The panel body appears in natural flow under the action row when expanded, and the auto-open / routed-notice flow from T49 still works.
-   **T42 Beta-Mode Silent Unlock:** `pmgUnlockPro()` accepts `{silent: true}` so the green "Pro Unlocked!" toast no longer fires on every page load during beta. Beta status is communicated solely by the persistent top banner. The toast still fires on real user-initiated unlocks (Stripe webhook return, manual unlock).
-   **Stripe Checkout:** Integration for "Pro" and "Founding Member" tiers, with webhooks updating user profiles in Supabase.
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