# Overview

PromptMeGood is a pnpm workspace monorepo project focused on building an AI prompt builder. Its primary goal is to provide an intuitive interface for crafting effective AI prompts through smart suggestions, auto-optimization, and quality checks. The project aims to enhance AI interactions and productivity for users, offering "Free" and "PRO" tiers, with the ultimate ambition of becoming a leading tool in AI prompt engineering.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure

The project utilizes a pnpm workspace monorepo, organizing packages such as `@workspace/api-spec`, `@workspace/db`, and `@workspace/api-server`.

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

PromptMeGood is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite, complemented by static pages for guides, pricing, reviews, privacy, and terms.

### UI/UX and Design Decisions

-   **Color Scheme:** CSS variables for theming with a default teal palette.
-   **Responsive Design:** Adapts layout for mobile and desktop.
-   **Form Layout:** Specific placement for the "Generate" button and a collapsible settings panel.
-   **Text Prompt Builder:** Features a linear column flow for prompt creation, including a goal textarea, export CTA, optional file upload, and a "Help Me Start" guide. The result panel includes empty, loading, and error states.
-   **Text Builder Sibling Flow:** Restructures the "Create A Text Prompt" column to visually align with the Photography Suite using stack-card-style step headers and re-skinned collapsibles.
-   **Keyboard Shortcuts:** A discoverable cheatsheet for global, builder, studio, and photo suite shortcuts, triggered by a floating "?" button.
-   **Prompt Improvement Chips:** A guided chip row ("More Specific," "More Persuasive," etc.) prepended to the "Improve Your Prompt" collapsible, driving existing Text Studio modes.
-   **User Guidance:** Onboarding flows, modals, toasts, and "Expert Mode."
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags.
-   **Two-Column Build Area:** Dedicated areas for text and image prompts.
-   **Image Prompt Wizard:** A 5-step modal for creating image prompts.
-   **Accessibility:** Fully opaque topbar and clear visual cues for interactive elements.
-   **Universal Close Affordances:** Modals, overlays, panels, and toasts can be closed via multiple methods.

### Key Features and Technical Implementations

-   **Prompt Builder:** Dynamic form for prompt parameters (goal, category, tone, output format) and "Boost Toggles."
-   **Smart Systems:** Includes Smart Suggestions, Auto Optimize, AI Tool Recommender, and Prompt Strength Score.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Features for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode:** Opt-in mode revealing advanced controls, with state persisted in `localStorage`.
-   **API Server Layout:** Cross-cutting middleware for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):** Includes `POST /api/generate` (legacy/structured payloads, `gpt-4o-mini`), `POST /api/generate-stream` (SSE for structured payloads), `POST /api/run` (SSE for `gpt-4o` responses), and `GET /api/stats`.
-   **Rate Limiting:** Per-IP rate limits for generate (20/hr) and run (5/hr).
-   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` and a daily $3 USD cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides generate, refine, and image prompt functions with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel utilizing `gpt-4o` responses.
-   **Hero Usage Counter:** Displays combined prompt and run counts when exceeding 100.
-   **Image Upload + Vision Analyze:** Allows uploading images for AI analysis via `/api/analyze` to describe content and fill the prompt textarea.
-   **Paywall Switch (Open-Beta):** Central helper `isPaywallActive()` controlled by Replit Secrets for beta access and paywall activation.
-   **Text Studio Pro:** Offers an editable textarea, file upload, 20 transformation modes (2 free, 18 Pro), a dynamic action button, and structured output with a "Custom Twist" field.
-   **Text Studio Pro · From My Vault:** Modal for browsing and inserting previously saved prompts from `localStorage`.
-   **More Control:** Advanced settings panel toggle chip.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for users to save and reload prompts and AI outputs.
-   **Renderer Stability:** `T26 ObserverGuard` monkey-patches `window.MutationObserver` for stability.
-   **Image Generation UX:** Live progress, success callout, restyled download button, and retry on errors.
-   **Smart Assist:** Inactivity-driven helper providing guidance.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.