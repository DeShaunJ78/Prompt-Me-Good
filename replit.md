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
-   **Form Layout:** Specific placement for the "Generate" button and an always-visible Prompt Tuning section.
-   **Text Prompt Builder:** Features a linear column flow for prompt creation: goal textarea → optional file upload → always-visible Prompt Tuning section (Step 1.5) → "Fix My Prompt" action. The result panel includes empty, loading, and error states.
-   **Prompt Tuning Section:** First-class always-visible `<section id="settingsPanel">` styled with the same stack-card chrome as the Photography Suite Vibe Controls. Houses category, tone, output format, personality, max length, language, extra details, and avoid-list controls.
-   **Text Builder Sibling Flow:** The "Create A Text Prompt" column visually aligns with the Photography Suite using stack-card-style step headers.
-   **Keyboard Shortcuts:** A discoverable cheatsheet for global, builder, and photo suite shortcuts, triggered by a floating "?" button.
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
-   **Prompt Tuning Panel:** Always-visible advanced settings (category, tone, output format, personality, max length, language, extra details, avoid list) styled to mirror the Photography Suite Vibe Controls. Replaces the legacy collapsible "More Control" chip.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for users to save and reload prompts and AI outputs.
-   **Renderer Stability:** `T26 ObserverGuard` monkey-patches `window.MutationObserver` for stability.
-   **Image Generation UX:** Polished waiting card during the ~10–25s wait — three staggered pulsing dots, phased status messages that crossfade between stages ("Reading your prompt…" → "Sketching the composition…" → … → "Adding finishing touches…" → "Almost ready…"), an elapsed-seconds chip, and an asymptotic progress bar capped at 94% (snapped to 100% on completion). Plus success callout, restyled download button, and retry on errors. Honors `prefers-reduced-motion` (no pulse, no crossfade, no animated fill) and announces phase changes — not the per-second tick — to screen readers via a polite live region.
-   **Photography Suite Saved Combos (My Combos):** Power users can save the current pill selection across all five Photography Suite groups under a custom name. Saved combos persist in `localStorage` (`pmg.photo.savedCombos`, raw pill values), appear above the auto-tracked Recent row, and can be re-applied with one click or removed with a × button. Save This Combo button sits next to Surprise Me / Clear Picks and is disabled while no pills are active.
-   **Photography Suite Pin Surprise:** After Surprise Me runs, a transient "Pin This Surprise" CTA appears next to Surprise Me. Clicking it persists the random pill set into the same Recent row used by preset combos under an auto-generated label (e.g. "Surprise: Cinematic, 35mm Wide, Golden Hour, Rule Of Thirds…"). The Recent row storage (`pmg.photo.recentPresets`) now uses a tagged shape that supports both preset combos (`{kind:'preset', entries:[{group,idx},...]}`) and raw pill combos (`{kind:'raw', label, picks}`), with backwards compatibility for the legacy bare-array format. The Pin CTA auto-dismisses on any pill change, preset apply, clear, saved-combo apply, or send.
-   **Recent Combo Preview Tooltip:** Reuses the Quick-Style preset preview tooltip (`#pmg-photo-preset-tooltip`, Task #34) on the Recent Combos row so users can see what a chip will activate before tapping. Hover, keyboard-focus, or a ~700ms touch long-press on any `.pmg-photo-recent-btn` shows one chip per pill, prefixed with the group label from the GROUPS catalog (e.g. "Style: Cinematic", "Lighting & Mood: Golden Hour", "Lighting & Mood: Natural Window Light"), ordered by GROUPS so the layout is stable. Implemented by extracting per-button hover/focus/touch wiring into `wirePreviewHover(btn)` (shared with preset buttons), routing the recent-button case through `presetPreviewLabels` → `recentComboPreviewLabels`, and re-attaching handlers from `renderRecentRow()` after each row re-render. The delegated click on `#pmg-photo-recent` honors `presetTooltipState.suppressClick` so a touch long-press cannot accidentally apply the combo. One-tap apply behavior is unchanged. Cache buster: `pmg-ux.js?v=task43-1`.
-   **Smart Assist:** Inactivity-driven helper providing guidance.
-   **Storage Write Warning Banner:** When `saveHistory()` in `artifacts/promptmegood/index.html` cannot persist to `localStorage` (private mode, quota exceeded, or storage blocked), it surfaces an inline dismissible banner above `#history-list` styled in the same red family as `.pmg-history-error-card`. The CSS, DOM scaffolding (`#pmg-history-write-warning` with `role="status"`, `aria-live="polite"`), and `showWriteError(msg)` / `hideWriteError()` helpers live in `artifacts/promptmegood/public/scripts/pmg-history-states.js` (cache-busted as `?v=3-task42`) and are exposed on `window.__pmgHistoryStates`. Quota errors message "We're out of room…" while generic blocked storage shows "Your browser isn't letting us save…". The banner clears the moment a save succeeds, and re-shows on every subsequent failed save after a manual dismiss. Honors `prefers-reduced-motion` (no slide-in animation).
-   **Text Builder Live Feedback:** The "Create A Text Prompt" mode shows a live-feedback panel (`#pmg-tf-feedback`) anchored above the action row in `#tour-step-generate`. It surfaces (1) a confidence meter with three bands — "Too vague" (<35), "Getting there" (35–69), "Specific enough" (≥70) — driven by a small additive heuristic over goal length, presence of details/rules/max length, personality, and non-default category/tone/format/skill picks (minus 4 per vague word, capped at -16); (2) a `chars · ~tokens` estimate (chars/4) with a soft `· long` warning past 3,000 tokens; (3) a vague-word linter that scans goal+details+rules in one regex pass and renders one chip per unique word with a stronger-word suggestion (`good`→`effective/high-quality/measurable`, `stuff`→`materials/inputs`, `things`→`items/components`, plus 13 more); and (4) a collapsible "Live Preview Of Your Prompt" `<details>` that mirrors the assembled prompt as the user types/toggles, persisted via `localStorage` (`pmg.textfeedback.preview.collapsed`). All updates are debounced 150ms and announced via `aria-live="polite"`. The feature only renders when `body.pmg-text-sibling` is set (text-builder mode); a body-class MutationObserver tracks mode changes but only fires when `BODY_CLASS` actually toggles, so unrelated body-class churn from sticky bars/tour scripts cannot reset the debounce timer (this was the bug found in Task #48 — the feedback panel was correctly attached but the renderer never settled until that filter was added). The exact assembler is reused via `window.__pmgText = { getFormData, generatePrompt }`, exposed inline near the original IIFE in `index.html`. Disable hatch: `?notextfeedback` query string or `localStorage.setItem('pmg_textfeedback_disable','1')`. Cache buster: `pmg-text-feedback.js?v=task48-5`.
-   **Mobile Overflow Guard (Playwright):** `artifacts/promptmegood/tests/horizontal-overflow.spec.ts` (run via `pnpm --filter @workspace/promptmegood run test:overflow`, registered as the `overflow-360` validation command) loads the homepage at a 360×800 viewport against the running dev server (`http://localhost:80`, override with `PMG_BASE_URL`) and asserts (1) `documentElement.scrollWidth <= viewport + 1px tolerance`, and (2) neither `<html>` nor `<body>` uses `overflow-x:hidden` as a band-aid. On failure it walks the DOM and prints up to 25 visible elements whose right edge exceeds the viewport (skipping anything clipped by an ancestor with `overflow:hidden|clip|scroll|auto`), with selector, computed right edge, width, and a text snippet so the next agent can fix the regression at source.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.