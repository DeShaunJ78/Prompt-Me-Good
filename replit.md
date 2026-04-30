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