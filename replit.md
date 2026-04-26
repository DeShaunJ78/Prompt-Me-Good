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
-   **AI Routes (Backend):** `POST /api/generate` is the primary endpoint, using `gpt-4o-mini` with strict input validation and rate limiting (40 requests/hour/IP). Other endpoints (`/api/generate-prompt`, `/api/refine-prompt`, `/api/image-prompt`) use `gpt-5.4`. All AI calls use OpenAI via a secure client that prevents API key exposure.
-   **AI Frontend Client:** `window.__pmgAI` provides `generateRaw`, `generate`, `refine`, and `imagePrompt` functions. It enforces per-month `localStorage` usage caps (100 generates, 50 refines, 10 image prompts) and handles fallbacks to local builder logic or alternative actions upon AI failure or limit exceeding.
-   **Use Demo Values UX:** Button (`#fill-demo`) to load sample prompts, with visual feedback, loading states, and inline guidance.
-   **Smart Assist:** Inactivity-driven helper providing guidance, with debounced activity timers and suppression logic to prevent interference.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.