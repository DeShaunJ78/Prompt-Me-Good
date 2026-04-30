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
-   **Text Studio Pro · Top-Nav Entry Point (no tabs):** The in-studio "Build A Prompt" / "Transform Text" tab system was removed. The studio panel now renders always-visible inside a `<section id="transform-studio">` wrapper appended after the prompt builder form. The top nav surfaces a "Transform Text Pro" link (`href="#transform-studio"`) in the slot that previously held "Examples". Anchor scroll is handled by the browser; `scroll-margin-top: 88px` (76px ≤640px) keeps the studio header below the sticky topbar after the jump. Cache buster: `?v=11-no-tabs-no-examples`.
-   **Examples Surface Removed:** The hero "See What It Can Do / Real Examples, Real Results" CTA, the entire "Popular Uses" use-case cards section (`#use-cases` with `.popular-use-card` buttons + `🎲 Need Ideas?` dice button), the in-builder `.examples-block` quick-start chips, the `#usecases-modal` "Choose A Starting Point" picker dialog, the `setupUseCasesModalAndDice` IIFE (~205 lines, including the curated `POOL` of 39 idea starters and re-roll logic), and the Smart Assist "Use Cases" Stage-2 button + `openUseCases()` helper were all removed from `index.html`. The post-tour banner copy was updated to point at Transform Text Pro instead of Use Cases. Dead JS handlers in `pmg-ux.js` that queried `#use-cases`, `#hero-usecases-cta`, `#usecases-dice-btn`, and `.popular-use-card` are null-safe and remain in place as no-ops. Dead CSS rules in `index.html` for `.popular-uses`, `.popular-use-card`, etc. are retained because they're still referenced by `.uc-modal-grid` (rendered nowhere now but the cousins share class names) — removing them is a follow-up cleanup.
-   **Text Studio Pro:** Editable textarea, file upload, 20 transformation modes (2 free, 18 Pro), dynamic action button, and structured output area. Cards 1–9 are the original set (Speed Upgrade, Analyze The Weak Spots, Turn It Into Money, Find The Hook, Multiply Into Variants, Remix It, Make It Record-Ready, Translate For An Audience, Expand Into A Brief). Cards 10–20 are the Pro expansion set: Simplify To Plain English, Add Emotional Punch, Make It More Persuasive, Tighten The Structure, Turn It Into A Story, Sharpen The Ending, Add Proof And Credibility, Challenge The Reader, Generate Variations, Restore Original Voice, and Add Your Own Twist. Cards stack in a 2-column grid on desktop (`grid-template-columns: repeat(2, minmax(0, 1fr))`) and collapse to a single column at ≤540px. Supports various text-based file formats (1MB size cap, 12k character cap). Active tab no longer persists across page loads. Action button always enabled (except while a transformation is in flight). AI calls wrapped in try/catch; `refreshActionButton()` early-returns while `inFlight`.
-   **Text Studio Pro · Custom Twist Field:** An "Add A Custom Twist (Optional)" input lives between the cards grid and the action button. The text (capped at 500 chars) persists across card switches via `state.customTwist` in `localStorage`. For cards 1–19 the twist is appended to the prompt as an "ADDITIONAL USER REFINEMENT" block (fenced with `~~~` to neutralize prompt injection). For card 20 ("Add Your Own Twist", `requiresTwist: true`) it becomes the PRIMARY USER INSTRUCTION, the wrapper gains an `.is-required` class (dashed border + " · Required For This Card" pseudo-element), and `runTransformation()` blocks empty submissions with the inline status "Add A Custom Instruction To Use This Option." while focusing the field. Typing into the twist input clears that stale required-error status.
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