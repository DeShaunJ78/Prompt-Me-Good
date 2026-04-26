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
-   **Globals:** `window.__pmgSmartSystems` (for `markAllTouched`, `clearTouched`, `recompute`) and `window.__pmgStrengthScore` (for `render`, `hide`) are exposed for smart system functionality.

# External Dependencies

-   **PostgreSQL:** Used as the primary database.
-   **Drizzle ORM:** ORM for interacting with PostgreSQL.
-   **OpenAPI Specification:** Used for defining API contracts and generating client-side code via Orval.
-   **Vite:** Build tool for the PromptMeGood frontend.
-   **Zod:** Schema declaration and validation library.