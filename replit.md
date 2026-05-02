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
-   **Run With AI (Frontend):** Post-generation panel using `gpt-4o` responses. Streamer is defensive about non-SSE 200 responses (e.g. deploy gaps): it surfaces "AI service is temporarily unavailable" instead of leaving `#aiResponseOutput` empty (which would otherwise pin the box on its CSS `:empty::before` "Waiting for AI response…" placeholder forever).
-   **Help Me Start (Guided Wizard) Placement:** `pmg-linear-flow.js` mounts `#pmg-help-me-start-btn` as flex `order: 0` inside `#prompt-form`, *above* the Goal textarea (`.field.field-primary`, order 1), and slims the T24 chunky 56px pill to a 38–40px content-width pill (`align-self: flex-start`). DOM order matches visual order via `positionHelpMeStart()` (insertBefore primaryField) so tab focus is correct. This keeps the wizard a subtle helper next to the textbox instead of a competing CTA below all the action cards.
-   **Post-Generate Actions Consolidation (`pmg-postgen-actions.js`):** Two additive fixes for the post-generate UX. (1) **Refine block consolidation:** adds a 5th "Tell AI What To Change…" button to `#tour-step-improve` that toggles an inline textarea + "Apply Changes" panel. Apply mirrors text into `#fine-tune-input` and clicks `#fine-tune-btn` so the existing `runFineTune()` handler does the work (appends `\n\n- Special request: <text>` to the current prompt). The standalone `#tour-step-finalize` (legacy "Fine-Tune Your Prompt" section) is hidden via CSS. (2) **Run This Prompt panel:** inserted right after `#improve-block` with a primary `▶ Run With AI Here` (clicks `#runBtn` to fire in-house `runWithAI()` and scrolls `#aiResponseSection` into view) and a secondary split `↗ Send To <last>` button + caret menu wired to `window.__pmgSendTo.send(<key>)` (ChatGPT/Claude/Gemini/Perplexity, last-used persisted in `localStorage`). To prevent the existing `demoteRunWithAi()` dedup pass from hiding the new in-house button, `pmg-ux.js` was patched (T15.10b) to prefer a button inside `.pmg-run-panel` as the keeper before the legacy `.pmg-action-stack`/`.pmg-what-next-block` keepers.
-   **Brand Voice Profiles (Pro):** `pmg-pro.js` mounts a "Configure Brand Voice" button inside Power Ups (Advanced Options). Click opens `openBrandVoiceModal()` (5-field form: name, voice/tone, audience, signature words, words to avoid). Saved profile lives in `localStorage` under `pmg-brand-voice-v1`. When a profile exists, the row switches to an active state (solid border, green status dot, "Edit Brand Voice" label) and `attachBrandVoiceSubmitInjector()` adds a capture-phase listener to `#prompt-form` that temporarily appends the profile as `[Brand Voice Profile] …` into `#details` so the existing local builder + AI payload pick it up; the textarea value is restored in a microtask so the user never sees their details mutated. Public surface: `window.__pmgBrandVoice` (`load`/`save`/`clear`/`isActive`/`buildInjection`/`open`/`refresh`). Non-Pro users still see the upgrade modal.
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
-   **Fix My Prompt Diff (Side-By-Side):** Opens a diff panel for reviewing and accepting/rejecting structural changes suggested by "Fix My Prompt." Lands the user at the diff (deferred + retried `scrollIntoView` overrides other modules' post-generate scrolls; user wheel/touch/keydown cancels). Row Accept/Reject buttons are solid (never look greyed out, even when stale). Includes a "Done Reviewing" footer button that scrolls to `.pmg-run-panel`. The improve-history strip scrolls horizontally only (never the page) so it can't yank users past the diff.
-   **Use Your Prompt In (Tool Cards) + Post-Prompt Footer:** After a prompt is generated, the result panel shows a polished 4-tool card grid (ChatGPT / Claude / Perplexity / Gemini, 4→2→1 cols at 1280/980/640px). Each `.open-in-card` has a brand-color top accent stripe, a brand dot before the tool name, and per-tool tinted background via `:has([data-tool="..."])` selectors (chatgpt teal, claude amber, perplexity blue, gemini purple). Gemini is appended at runtime by `pmg-send-to.js` and inherits the same styling (`index.html` is the single source of truth for card theming). Section eyebrow "Use Your Prompt In" sits above the grid. Below the grid, `.post-prompt-footer` unifies the keyboard shortcuts line and the founding-member pricing note into one bordered chip strip; it's hidden pre-generation via `pmg-linear-flow.js` (`body:not(.pmg-has-result) #builder .post-prompt-footer { display: none }`).
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
-   **Pricing & Plan Messaging (May 2026 audit):** Three-tier framing — **Free** (no account, daily limits), **Founding Member** ($49 one-time lifetime, active in Stripe, primary CTA on pricing/upgrade flows), **Pro Monthly** ($9/mo, "Coming Soon — June 1, 2026", notify-only CTA, no active Stripe checkout). All marketing surfaces (`index.html`, `pricing.html`, `guide.html`, embedded privacy/terms modals, `pmg-pro.js` upgrade modal, `pmg-ux.js`) avoid fake metrics — no fabricated user counts, country counts, testimonials, or "Beta User" labels. Index hero has a benefit-grid "What You Get" section instead of testimonials. SoftwareApplication JSON-LD on `index.html` lists both Free + Founding Member offers; FAQ JSON-LD answers reflect daily-limit free tier and the upcoming Pro Monthly. Pro card on `pricing.html` shows a dashed "Not Yet For Sale" notice and routes to `#early-access`.
-   **Legal Pages (May 2026 rewrite):** `privacy.html` is a 17-section policy covering local-first free tier, AI provider routing (OpenAI), Supabase auth + profile fields, Stripe payments (we never see card data), Cloud Vault, FormSubmit.co email forms, Microsoft Clarity, sub-processor list, retention windows, GDPR/CCPA rights, and security. `terms.html` is a 15-section document including §3 Accounts, §7 Payments/plans/refunds (14-day Founding refund window with $5 AI-spend cap; non-refundable Pro Monthly billing period; price-change notice), §9 liability cap raised to greater of paid-12mo OR USD $50, and an anti-circumvention bullet. Embedded modals inside `index.html` (`#privacy-dialog`, `#terms-dialog`) carry condensed versions consistent with the full pages and link out to them. Last updated date: May 2, 2026.
-   **Pro Upgrade Modal (`pmg-pro.js`):** Two CTAs — primary `pmg-upgrade-btn[data-pmg-tier="founding"]` triggers Stripe checkout via the existing T41 IIFE handler with a fallback redirect to `pricing.html#founding-member`, secondary `Notify Me When Pro Launches` links to `pricing.html#early-access`. Styled with `.pmg-upgrade-cta-secondary` for visual hierarchy.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.