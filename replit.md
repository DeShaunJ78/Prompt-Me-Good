# Overview

PromptMeGood is an AI prompt builder designed to enhance AI interactions and user productivity by offering smart suggestions, auto-optimization, and quality checks. It operates on a "Free" and "PRO" tier model, aiming to be a leading tool in AI prompt engineering.

# User Preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

# System Architecture

## Monorepo Structure
The project utilizes a pnpm workspace monorepo for organizing various packages.

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
This is a static HTML AI prompt builder (`index.html`) built with vanilla JavaScript and Vite, complemented by static pages for guides, pricing, reviews, privacy, and terms.

### UI/UX and Design Decisions
-   **Color Scheme:** CSS variables with a default teal palette.
-   **Responsive Design:** Optimized for mobile and desktop.
-   **Form Layout:** Dedicated areas for prompt generation and an always-visible Prompt Tuning section.
-   **Prompt Tuning Section:** Persistent `<section id="settingsPanel">` for controlling category, tone, output format, personality, max length, language, extra details, and avoid-lists.
-   **Keyboard Shortcuts:** Discoverable via a floating "?" button.
-   **User Guidance:** Includes onboarding flows, modals, toasts, and "Expert Mode."
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags.
-   **Accessibility:** Fully opaque topbar, clear visual cues, and universal close affordances.

### Key Features and Technical Implementations
-   **Prompt Builder:** Dynamic form with parameters and "Boost Toggles."
-   **Smart Systems:** Smart Suggestions, Auto Optimize, AI Tool Recommender, and Prompt Strength Score.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Tools for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode:** Opt-in mode with advanced controls, state persisted in `localStorage`.
-   **API Server Layout:** Cross-cutting middleware for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):** Includes `POST /api/generate`, `POST /api/generate-stream` (SSE), `POST /api/run` (SSE for `gpt-4o`), and `GET /api/stats`.
-   **Rate Limiting:** Per-IP rate limits (20/hr for generate, 5/hr for run).
-   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` and a daily $3 USD cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides generate, refine, and image prompt functions with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel utilizing `gpt-4o` responses.
-   **Post-Generate Actions Consolidation:** Refine block consolidation with "Tell AI What To Change…" button and an integrated "Run This Prompt" panel with primary "Run With AI Here" and secondary "Send To" options for other AI services.
-   **Brand Voice Profiles (Pro):** Allows Pro users to configure and inject brand voice into prompts, persisted in `localStorage`.
-   **Hero Usage Counter:** Displays combined prompt and run counts over 100.
-   **Image Upload + Vision Analyze:** Allows image uploads for AI analysis via `/api/analyze` to describe content and populate the prompt textarea.
-   **Paywall Switch (Open-Beta):** Controlled by Replit Secrets.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for saving/reloading prompts and AI outputs.
-   **Image Generation UX:** Polished waiting card with progress indicators.
-   **Photography Suite Saved Combos (My Combos):** Allows saving current pill selections across five groups.
-   **Text Builder Live Feedback:** Live-feedback panel with confidence meter, token estimate, vague-word linter, and "Live Preview Of Your Prompt."
-   **Fix My Prompt Diff (Side-By-Side):** Diff panel for reviewing and accepting/rejecting suggested structural changes.
-   **Use Your Prompt In (Tool Cards) + Post-Prompt Footer:** Post-generation result panel shows a 4-tool card grid (ChatGPT / Claude / Perplexity / Gemini) and a combined keyboard shortcuts/pricing note footer.
-   **Improve Your Prompt: History + Hover Preview:** In-memory history strip for previous prompt versions and hover preview popover.
-   **Image Generator Variations + Compare + Use-Style Handoff:** Generates 4 image variants, provides a before/after slider for comparison, and allows applying styles to new photos.
-   **Photography Suite Preset Thumbnails:** Small representative SVG thumbnails for Quick-Style preset buttons.
-   **Smarter Vault:** Enhancements to the Vault (`#history` section) including multi-tag chip filters, four sort modes, and "Compare Many" functionality.
-   **Command Palette (⌘K):** Global keyboard-driven palette for searching and executing commands, modes, actions, presets, and vault items.
-   **Unified Share Button:** Single entry point for sharing, offering "Copy link" and "Export as image card."
-   **Smart Pill Suggestions + Negative Pills:** "You Might Also Like" suggestions and per-group "Avoid mode" for excluding pill influence from prompts.
-   **Surprise Me Dial + Cross-Mode Handoff:** 3-step segmented control for randomized pill selection with auto-save to Recent Combos and cross-mode handoff.
-   **Global Undo Stack (Task #55):** Shared LIFO undo/redo stack (`window.__pmgUndo`) with a 50-entry cap for tracking state changes across Text and Image modes.
-   **Pricing & Plan Messaging:** Three-tier framing — Free (no account, daily limits), Founding Member ($49 one-time lifetime), Pro Monthly ($9/mo, "Coming Soon — June 1, 2026").
-   **Legal Pages:** `privacy.html` and `terms.html` with condensed versions embedded in `index.html`.
-   **Pro Upgrade Modal:** Two CTAs for Founding Member Stripe checkout and a "Notify Me When Pro Launches" link.
-   **UX Polish Pass:** Standardized CTA to **Fix My Prompt**, inline examples, repositioned **Help Me Start** copy, discoverable tooltips, persistent post-result actions including **⬇ Download .txt** and **✓ Saved To Vault** indicator, and updated Prompt Vault subhead.
-   **Print / Save PDF (Task #92):** Fixed two bugs — (1) printing produced many trailing blank pages because `@media print` used `visibility:hidden` (which preserves layout); now uses `display:none` on body siblings + `display:block;position:static` on `#print-area`, eliminating the phantom layout space. (2) Two duplicate print affordances were visible (the bulky **Print / Save PDF** pill in the actions row + the compact printer icon next to "Your Fixed Prompt" added by T22); the pill is now hidden via T19 CSS while staying in the DOM so the icon's `printBtn.click()` delegation still fires. The small icon is the sole visible print entry point.
-   **Audit-Pass Polish (Task #93 — "get over 9"):** Four strictly-additive fixes from the user audit. (1) Tour titles "Click Generate" / "Step 2: Click Generate" relabeled to "Tap Fix My Prompt" / "Step 2: Tap Fix My Prompt" — the static How It Works section was already correct; the stale labels lived only in the product tour. (2) New T24 IIFE injects a confirmation line ("✓ Your prompt is ready. Copy it, run it, or refine it.") directly after `#resultBox`, gated on the existing `body.pmg-has-result` class so it appears the instant a real prompt lands. (3) Action hierarchy sharpened: `#copy-btn` in the result actions row was `btn-primary` and competed with **Run With AI** even though T22 already exposed Copy Prompt as a secondary pill — visually demoted to a ghost-style outline (class untouched), and `#runBtn` elevated (52px min-height, larger shadow, hover lift) so it's the single dominant CTA. (4) Middle-page workspace cluster: injected a "Your Workspace" eyebrow above `#dashboard` and tightened the inter-section padding for `#dashboard` / `#templates` / `#history` so they read as one grouped area rather than three competing widgets.
-   **Surprise Banner Demote (Task #94 — "make it read optional"):** Follow-up audit feedback that the T34 "Need Ideas? Try An Example" banner at the top of the Photography Suite read as a required step, not an optional helper. New T94 IIFE in `pmg-ux.js` strictly-additively demotes the cluster: (a) banner background changed from teal-tinted card with dashed teal border → muted `--color-surface-2` with hairline solid `--color-border`; (b) Surprise Me button changed from filled-teal `!important` → ghost outline (cream surface, dark text, no shadow) so it stops competing with the pill groups and Send To Image Generator; (c) headline gets a small "OPTIONAL" eyebrow chip prepended to make the row's role unmistakable; (d) Surprise Dial wrap chrome quieted to match. Selector specificity bumped to `body #pmg-t34-surprise-top-row …` so the rules win over T34's earlier `!important` declarations by source-order tie-break. Cache buster bumped to `?v=task94-optional-surprise`.
-   **Voice Input + Language Picker:** Microphone button on the **Your Goal** and post-generate **Fine-Tune** textareas (Web Speech API) with a small ▾ caret that opens a popover for picking the recognition language (en-US, en-GB, es-ES, fr-FR, de-DE, pt-BR, ja-JP, zh-CN, hi-IN). The selection persists to `localStorage` (`pmg.voice.lang.v1`) and the active code is shown in the mic tooltip; takes effect on the next recording session. Single-active-mic arbitration ensures only one recognizer runs at a time across both fields.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.