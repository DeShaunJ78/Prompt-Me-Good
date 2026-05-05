# Overview

PromptMeGood is an AI prompt builder designed to enhance AI interactions and user productivity. It offers smart suggestions, auto-optimization, and quality checks to help users craft effective prompts. The project aims to be a leading tool in AI prompt engineering, operating on a "Free" and "PRO" tier model.

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
-   **Color Scheme:** CSS variables with a default teal palette. Shared semantic color tokens (`--color-danger`, `--color-danger-light`, `--color-danger-strong`, `--color-danger-hover`, `--color-danger-vivid`, `--color-warning`, `--color-warning-subtle`, `--color-muted`) are defined in light/dark theme blocks for single-point theme edits.
-   **Responsive Design:** Optimized for mobile and desktop.
-   **Form Layout:** Dedicated areas for prompt generation and an always-visible Prompt Tuning section.
-   **Prompt Tuning Section:** Persistent `<section id="settingsPanel">` for controlling various prompt parameters.
-   **User Guidance:** Includes onboarding flows, modals, toasts, and "Expert Mode." Adaptive Goal Box (T102) detects returning power users (3+ prompts) and adapts the UX. T103 UX Overhaul adds: P1 mobile first-use compression (textarea + Fix My Prompt above fold on 390x844), P2 mobile result hierarchy (tighter spacing), P3 image generation loading state ("Generating Image" / "Your Image Is Ready"), P4 post-response conversion nudge (session-dismissible, links to Founding Waitlist), P5 returning user Command Center (Welcome Back with Continue Last Prompt, Start New, Open Workspace + 6 secondary workflow links), P6 before/after proof block (collapsed "See Example" on ALL screen sizes, compact padding, title margin only when expanded). May 4 UX audit fixes: proof block collapsed on desktop too (Fix My Prompt above fold on 1440x900), Run This Prompt panel compacted for mobile (row layout, hidden "or" divider, normal-height button), scroll jumps reduced (block:'nearest' targeting #resultBox), duplicate #generateBtnTop gets aria-hidden/inert/tabindex=-1 sync via resize listener. T122 Workstation Tour: after first AI response, a non-blocking invite banner offers a guided 6-stop walkthrough (Original Idea, Better Prompt, Run With AI, Power Moves, Prompt Vault, Photography Suite) with its own highlight overlay; dismissible, skippable, mobile-compact, stored in localStorage (`pmg.workstationTourSeen`).
-   **Canonical Domain & SEO:** `https://www.promptmegood.com` with comprehensive meta-tags.
-   **Accessibility:** Fully opaque topbar, clear visual cues, and universal close affordances. Hidden panels (`#nudge-banner`, `#tour-banner`, `#keyboard-hints`, `#compare-overlay`, `#bk-overlay`, `#ob-overlay`, `#pmg-post-run-intro`, `#smart-assist`, mobile-sticky-bar, post-tour-banner, demo-helper) get the `inert` attribute when hidden and have it removed when shown, enforced by a MutationObserver that syncs `inert` with `hidden`/`display:none`. Result box (`.result-box`) and AI response (`#aiResponseOutput`) are clamped with max-height and "Show Full Prompt"/"Collapse" toggles so action buttons stay visible. AI response Copy/Run Again buttons are placed above the response output. Image generation errors use inline `#image-gen-hint` messages instead of `alert()` dialogs. Comprehensive `broadInert` sweep (`syncAll()`) runs on load + deferred + on body class/DOM changes via MutationObserver. It manages inert state for: mobile nav (when closed on mobile), photo accordion/suite/assistant (when not in image-mode), post-gen elements (when pre-gen), dialogs (when closed), mmpro panel (when locked), compare banner (when inactive), shortcuts panel (when hidden), collapsed upload field, settings panel (on mobile when collapsed), and collapsed card bodies. Reversible tabindex=-1 applied to toggle switch hidden inputs, file inputs, mobile-only buttons on desktop, and zero-size controls. Result top actions row (`#result-top-actions`) with Copy Prompt + Run With AI buttons placed above the prompt body for immediate post-generation access. **Global Accessibility Guard (`pmgGlobalAccessibilityGuard` in pmg-ux.js):** system-wide safety net that continuously enforces "any button/link/input visually on screen must be clickable". Runs on a 2.5s heartbeat, on `pmg:builder-finalized`, on body class mutations, and synchronously on `pointerdown` capture (the synchronous pointerdown handler walks the click target's ancestor chain and clears stale inert/aria-hidden BEFORE the click event fires, eliminating dead-first-click oscillation). Visibility heuristic checks computed display/visibility/opacity, both viewport axes, and skips screen-reader-only patterns (≤4px elements, restrictive clip-path/clip rect with absolute positioning) so genuine sr-only content keeps its accessibility marks. Permanently immunizes the codebase against state-flag-driven inert/aria-hidden bugs (e.g. localStorage failures in incognito). **Quiet Onboarding (`pmgQuietOnboarding` in pmg-ux.js):** for 45 seconds after the very first `pmg:builder-finalized` in a session (race-free session latch — independent of body-class timing), `body.pmg-quiet-mode` is set and an injected stylesheet display:nones noisy nudges (#nudge-banner, #tour-banner, #pmg-conversion-nudge, #keyboard-hints, #compare-banner, #weekly-goal-pin, #post-tour-banner, .pmg-promo-banner, mobile sticky tabs) so only the priority "Your First Prompt Is Done" intro modal shows. Quiet mode ends early when the user clicks Skip or Show Me Around. **broadInert overlay loop fix:** treats both `is-open` AND `is-visible` class markers as "open" (the post-run-intro modal uses `is-visible`, which the original code did not recognize → buttons stayed inert).

### Key Features and Technical Implementations
-   **Quick Win Mode ("Earn the Workstation"):** First-time visitors see a focused single-screen overlay (`#pmg-quick-win-overlay`) with one input + 3 example chips instead of the full workstation. They type an idea and click **Generate Starter Blueprint**. The flow runs **two sequential `/api/generate` calls** (call 1 = refined idea + strong prompt in one structured request; call 2 = 3 next-steps tailored to the actual generated prompt). A keyword-rules client-side classifier picks a suggested mode (Photography Suite / Master Link / Prompt Engine). The blueprint card shows refined idea, strong prompt with copy button, 3 next steps, and suggested mode badge. Clicking **Open Workstation** carries the refined idea into `#goal`, sets `pmg.quickWinSeen` + `pmg.postRunIntroSeen`, and triggers a 700ms cross-fade reveal animation (respects prefers-reduced-motion). Failure UX is inline retry + secondary "Skip to Workstation" link. Returning users (any of `pmg.quickWinSeen` / `pmg.workstationTourSeen` / `pmg.hasGenerated` / `sessionStorage.pmg.quickWinShown`) skip the overlay entirely — an inline `<head>` script applies `html.pmg-qw-pending` BEFORE first paint to prevent any workstation-flash for first-timers. The workstation stays mounted (visibility:hidden, not display:none) so reveal is instant. Files: `index.html` (inline detection script + overlay HTML + CSS, near body open) and `public/scripts/pmg-quick-win.js` (controller). The existing **Expert Mode** entry (`#expert-mode-link`) already opens the Expert Command Center dialog — no change needed for pick 6A.
-   **Prompt Builder:** Dynamic form with parameters and "Boost Toggles."
-   **Smart Systems:** Smart Suggestions, Auto Optimize (manages category, tone, format, length, boost toggles, and personality based on goal keywords — resets to neutral defaults when no keywords match), AI Tool Recommender, and Prompt Strength Score.
-   **Guided Mode:** Structured modal for prompt formulation.
-   **Refinement and Quality Check:** Tools for prompt refinement, undo, and a "Quality Checker."
-   **Prompt Sharing:** Encodes prompt parameters into a URL hash.
-   **Expert Mode → Expert Command Center (Paid):** The existing single ⚙ Expert Mode entry point opens a hidden, full-screen-on-mobile / right-side-on-desktop drawer with five tabs: **Diagnose** (prompt strength + weaknesses + one-tap fixes), **Engineer** (Off / Auto / Custom controls for role, audience, format, examples, success criteria, and more, with live preview), **Tune** (style/behavior toggles + 6 sliders), **Variations** (Fast & Simple / Detailed & Strategic / Bold & Persuasive rewrites), and **Save** (workflows + reusable presets). Drawer supports focus trap, ESC close, and a small "Expert Settings Applied" pill near the goal box. Expert Command Center is a **paid feature** (Founding Member + Pro tiers per `EXPERT_CENTER_PAID_TIERS` in `pmg-pricing-config.js` and `pricing-config.ts`); free during the open beta until `BETA_END` (2026-06-01), after which free-tier users see an upgrade paywall. Pricing/Terms/Guide all reflect this gating.
-   **API Server Layout:** Cross-cutting middleware for rate limiting, sanitization, and cost guarding.
-   **AI Routes (Backend):** Includes `POST /api/generate`, `POST /api/generate-stream` (SSE), `POST /api/run` (SSE for `gpt-4o`), and `GET /api/stats`.
-   **Rate Limiting:** Per-IP rate limits for API calls.
-   **Cost Protection:** In-memory `INJECTION_BLOCKLIST` and a daily cost cap.
-   **AI Frontend Client:** `window.__pmgAI` provides generate, refine, and image prompt functions with streaming-first fallback. `localStorage` caps apply per month.
-   **Run With AI (Frontend):** Post-generation panel utilizing `gpt-4o` responses.
-   **Post-Generate Actions Consolidation:** Refine block consolidation with "Tell AI What To Change…" button and an integrated "Run This Prompt" panel with primary "Run With AI Here" and secondary "Send To" options for other AI services.
-   **Brand Voice Profiles (Pro):** Allows Pro users to configure and inject brand voice into prompts, persisted in `localStorage`.
-   **Hero Usage Counter:** Displays combined prompt and run counts.
-   **Image Upload + Vision Analyze:** Allows image uploads for AI analysis via `/api/analyze` to describe content and populate the prompt textarea.
-   **Paywall Switch (Open-Beta):** Controlled by Replit Secrets.
-   **Supabase Auth + Save Best Prompts:** Magic-link email authentication for saving/reloading prompts and AI outputs.
-   **Image Generation UX:** Polished waiting card with progress indicators.
-   **Photography Suite Aspect Ratio:** Single-select Aspect Ratio pill group (Square 1:1, Portrait 3:4, Landscape 4:3, Auto) that maps to `gpt-image-1` size parameters (`1024x1024`, `1024x1536`, `1536x1024`, `auto`). Aspect is a size parameter only — not included in prompt text synthesis. No Avoid toggle for this group.
-   **Photography Suite Saved Combos (My Combos):** Allows saving current pill selections across five groups.
-   **Text Builder Live Feedback:** Live-feedback panel with confidence meter, token estimate, vague-word linter, and "Live Preview Of Your Prompt."
-   **Fix My Prompt Diff (Side-By-Side):** Diff panel for reviewing and accepting/rejecting suggested structural changes.
-   **Use Your Prompt In (Tool Cards) + Post-Prompt Footer:** Post-generation result panel shows a 4-tool card grid (ChatGPT / Claude / Perplexity / Gemini) and a combined keyboard shortcuts/pricing note footer.
-   **Improve Your Prompt: History + Hover Preview:** In-memory history strip for previous prompt versions and hover preview popover.
-   **Image Generator Variations + Compare + Use-Style Handoff:** Generates 4 image variants, provides a before/after slider for comparison, and allows applying styles to new photos.
-   **Photography Suite Preset Thumbnails:** Small representative SVG thumbnails for Quick-Style preset buttons.
-   **Smarter Vault:** Enhancements to the Vault (`#history` section) including multi-tag chip filters, four sort modes, and "Compare Many" functionality.
-   **Result Column Friction Fixes (T99):** CSS-only flex `order` reorder of `#tour-final-actions` so the dedicated `#runSection` (Run With AI) and the in-result actions row sit ABOVE the Prompt Strength meter / Check Quality row — the meter is a status indicator, not the next action. Most Loved badge gets `margin-top: 18px` clearance on `#pmg-help-me-start-btn` so the gold pill (T97 lift) has its own breathing room. Top duplicate `#result-top-run` is hidden via `body.pmg-has-result` once the dedicated run section becomes visible. **Single-glow controller (`pmg-next-action.js`) extended** with Stage 0 (glow Help Me Start when `#goal` is empty) and Stage 4 (glow Improve With AI after the user has used Run + Run Again). Tracks new `improveConsumed` flag, reset on `pmg:builder-finalized`, consumed via the existing capture-phase click handler. `tourActive()` now also suppresses glow while any native `<dialog open>` is open (HMS, expert warning, privacy, terms). Bumped script cache-bust to `v=5`.
-   **Power Moves MVP (T101):** After the first prompt is generated, a compact "Power Moves" action row appears near the result with 6 contextual chips: Improve With AI, More Detailed, Beginner Friendly, Try Image Mode, Save To Vault, Check Quality. Each chip wires to an existing feature (no dead buttons — chips whose target DOM element is missing are automatically excluded). Hidden until `body.pmg-has-result`. Desktop: 3-column grid; mobile: 2-column grid. Tests in `tests/power-moves.spec.ts`.
-   **Above-Fold CTA (T100):** Second "Fix My Prompt" button injected inside `.field.field-primary` right under the goal textarea for instant new-user access. MutationObserver mirrors the original button's loading state. Original `#generateBtn` untouched.
-   **Expert Command Center Label Clarity (T102):** Targeted copy/UX update inside the existing 5-tab drawer (`pmg-expert-center.js`). Added a per-tab `help` tooltip (rendered as `title` on each tab button), short intro paragraph (`.pmg-ec-intro`) at the top of every pane, section helper paragraphs (`.pmg-ec-section-helper`) under each `<h3>`, per-section helper paragraph inside Architect rows (`.pmg-ec-engineer-helper`, sourced from a new optional `helper` field on `ENGINEER_SECTIONS`), and `title` tooltips on the five Diagnose One-Tap Fix buttons. Diagnose section labels updated to brief vocabulary: "Prompt Strength Analyzer" / "Biggest Fix" / "Missing Context Detector" / "One-Tap Fixes". Variations subtitles rewritten in plain-language form. Save section heading renamed "Save Current Setup" → "Save As Workflow". **Engineer tab visible label renamed to "Architect"** (internal tab id `engineer` preserved so analytics, switchTab references, ESC handling, `_bodies.engineer`, and the `expert_center_apply` source label stay intact); the Diagnose CTA now reads "Switch To Architect". No DOM rewiring, no rename of any ID/handler, no DB/API/storage changes, no new features added (Brand Voice Profile / Project Context Pack / Prompt Template / Compare Versions from the brief were not invented — only existing features were relabeled). Bumped script cache-bust `v=4` → `v=5`.
-   **Command Palette (⌘K):** Global keyboard-driven palette for searching and executing commands, modes, actions, presets, and vault items.
-   **Unified Share Button:** Single entry point for sharing, offering "Copy link" and "Export as image card."
-   **Smart Pill Suggestions + Negative Pills:** "You Might Also Like" suggestions and per-group "Avoid mode" for excluding pill influence from prompts.
-   **Surprise Me Dial + Cross-Mode Handoff:** 3-step segmented control for randomized pill selection with auto-save to Recent Combos and cross-mode handoff.
-   **Global Undo Stack:** Shared LIFO undo/redo stack (`window.__pmgUndo`) with a 50-entry cap for tracking state changes across Text and Image modes.
-   **Pricing & Plan Messaging:** Three-tier framing — Free, Founding Member, Pro Monthly.
-   **Legal Pages:** `privacy.html` and `terms.html` with condensed versions embedded in `index.html`.
-   **Pro Upgrade Modal:** CTAs for Stripe checkout and a "Notify Me When Pro Launches" link.
-   **Voice Input + Language Picker:** Microphone button on textareas (Web Speech API) with language selection persisting to `localStorage`. Single-active-mic arbitration.

# Validation

Named pre-release validation steps (see the `validation` skill — register/run via `setValidationCommand` / `startValidationRun`).

-   **`overflow-360`** — runs `pnpm --filter @workspace/promptmegood run test:overflow`, which executes the full Playwright suite under `artifacts/promptmegood/tests/` (config: `artifacts/promptmegood/playwright.config.ts`). This is the canonical homepage guard run and covers:
    -   `textarea-above-fold.spec.ts` — text-mode #goal must stay above the fold at 360x800 + 1280x800; Fix My Prompt / Run with AI buttons must work on first load; image-mode regression guards (no auto-scroll on mode switch, generate path stays wired).
    -   `horizontal-overflow.spec.ts` — no horizontal overflow at 360-width across text + image modes.
    -   Other specs in the same folder (`vault-smart`, `command-palette-smoke`, `share`, `handoff`, `photo-suite-*`, `undo-stack`, `whatnext`, `suggestions`, `photo-prompt-toggle-removed`).
    Run this before merging any homepage / image-mode / vault / share change.

# External Dependencies

-   **PostgreSQL:** Primary database.
-   **OpenAPI Specification:** For API definition.
-   **Vite:** Frontend build tool.
-   **Zod:** Schema validation.
-   **Stripe:** Payment processing for subscriptions.
-   **Supabase:** Authentication and database for user-saved prompts.