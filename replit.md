# Overview

PromptMeGood is an AI prompt builder designed to streamline the creation of effective AI prompts. It offers smart suggestions, auto-optimization, and quality checks to enhance AI interactions and user productivity. The project operates on a "Free" and "PRO" tier model and aims to be a leading tool in AI prompt engineering.

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
This is a static HTML AI prompt builder (`index.html`) using vanilla JavaScript and Vite, alongside static pages for guides, pricing, reviews, privacy, and terms.

### UI/UX and Design Decisions
-   **Color Scheme:** CSS variables with a default teal palette.
-   **Responsive Design:** Adapts for mobile and desktop.
-   **Form Layout:** Dedicated areas for the "Generate" button and an always-visible Prompt Tuning section.
-   **Text Prompt Builder:** Linear flow: goal textarea → optional file upload → Prompt Tuning section → "Fix My Prompt" action. Includes empty, loading, and error states for results.
-   **Prompt Tuning Section:** Always-visible `<section id="settingsPanel">` for category, tone, output format, personality, max length, language, extra details, and avoid-list controls.
-   **Keyboard Shortcuts:** Discoverable cheatsheet for global, builder, and photo suite shortcuts via a floating "?" button.
-   **User Guidance:** Onboarding flows, modals, toasts, and "Expert Mode."
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags.
-   **Two-Column Build Area:** Separate areas for text and image prompts.
-   **Image Prompt Wizard:** A 5-step modal for creating image prompts.
-   **Accessibility:** Fully opaque topbar, clear visual cues, and universal close affordances.

### Key Features and Technical Implementations
-   **Prompt Builder:** Dynamic form with parameters and "Boost Toggles."
-   **Smart Systems:** Smart Suggestions, Auto Optimize, AI Tool Recommender, and Prompt Strength Score.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Tools for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode:** Opt-in mode with advanced controls, state persisted in `localStorage`.
-   **API Server Layout:** Cross-cutting middleware for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):** Includes `POST /api/generate` (legacy/structured payloads, `gpt-4o-mini`), `POST /api/generate-stream` (SSE for structured payloads), `POST /api/run` (SSE for `gpt-4o` responses), and `GET /api/stats`.
-   **Rate Limiting:** Per-IP rate limits (20/hr for generate, 5/hr for run).
-   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` and a daily $3 USD cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides generate, refine, and image prompt functions with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel using `gpt-4o` responses.
-   **Hero Usage Counter:** Displays combined prompt and run counts over 100.
-   **Image Upload + Vision Analyze:** Allows uploading images for AI analysis via `/api/analyze` to describe content and fill the prompt textarea.
-   **Paywall Switch (Open-Beta):** `isPaywallActive()` controlled by Replit Secrets.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for saving/reloading prompts and AI outputs.
-   **Image Generation UX:** Polished waiting card with staggered pulsing dots, phased status messages, elapsed-seconds chip, and asymptotic progress bar. Honors `prefers-reduced-motion`.
-   **Photography Suite Saved Combos (My Combos):** Power users can save current pill selections across five groups under a custom name, persisting in `localStorage`.
-   **Photography Suite Pin Surprise:** After "Surprise Me," a "Pin This Surprise" CTA appears to save random pill sets to the Recent row.
-   **Recent Combo Preview Tooltip:** Tooltip shows a preview of what a chip will activate before tapping.
-   **Smart Assist:** Inactivity-driven helper for guidance.
-   **Storage Write Warning Banner:** Displays a dismissible banner when `localStorage` persistence fails.
-   **Text Builder Live Feedback:** Shows a live-feedback panel with a confidence meter, token estimate, vague-word linter, and collapsible "Live Preview Of Your Prompt."
-   **Fix My Prompt Diff (Side-By-Side):** Opens a diff panel for reviewing and accepting/rejecting structural changes suggested by "Fix My Prompt."
-   **Improve Your Prompt: History + Hover Preview:** "Refine Your Prompt" panel gains an in-memory history strip for previous prompt versions and a hover/focus preview popover for quick tweaks.
-   **Image Generator Variations + Compare + Use-Style Handoff:**
    -   **Generate 4 Variations:** Allows generating multiple image variants simultaneously.
    -   **Before/After slider:** Compares the current image with the previously generated one.
    -   **Use This Style On A New Photo:** Handoff functionality to apply image generation styles to new text prompts.
-   **Photography Suite Preset Thumbnails:** Small representative SVG thumbnails for each Quick-Style preset button.
-   **Smarter Vault:** Enhancements to the Vault (`#history` section) including multi-tag chip filters (AND logic), four sort modes (persisted), and "Compare Many" (2–5 prompts) functionality.
-   **Command Palette (⌘K):** Global keyboard-driven palette (⌘K/Ctrl+K) for searching and executing commands, modes, actions, presets, and vault items, with cross-mode discoverability.
-   **Unified Share Button:** Single entry point for sharing in both Text and Image modes, offering "Copy link" (self-contained URL hash encoding) and "Export as image card" (HTML5 Canvas PNG export). Includes authoritative restore and focus trapping.
-   **Smart Pill Suggestions + Negative Pills:**
    -   **"You Might Also Like":** Suggests contextually relevant pills based on active selections.
    -   **Per-group Avoid mode:** Allows marking pills as "negative" to exclude their influence from prompt generation.
    -   **Generated prompt assembly:** Appends "Avoid: name1, name2, name3." to the goal value if negatives are present.
-   **Surprise Me Dial + Cross-Mode Handoff:**
    -   **Surprise Me Dial:** 3-step segmented control ("Close To My Style," "Mix It Up," "Go Wild") for randomized pill selection.
    -   **Auto-save to Recent Combos:** Each dial roll persists to `localStorage`.
    -   **Cross-mode handoff:** Buttons to try text prompts in image mode and vice-versa, preserving relevant settings.
-   **Global Undo Stack (Task #55):** A shared LIFO undo/redo stack (`window.__pmgUndo`) with a 50-entry cap, tracking state changes across both Text and Image modes (prompt edits, mode switches, photo-suite pill toggles, image generation completions). Includes keyboard shortcuts (⌘/Ctrl+Z, ⇧⌘Z/Ctrl+Y) and an editable-field guard.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.