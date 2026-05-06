# PromptMeGood

PromptMeGood is an AI prompt builder designed to enhance AI interactions and user productivity by offering smart suggestions, auto-optimization, and quality checks.

## Run & Operate

*   **Run:** `pnpm start`
*   **Build:** `pnpm build`
*   **Typecheck:** `pnpm typecheck`
*   **Codegen:** `pnpm codegen`
*   **DB Push:** `pnpm db:push`
*   **Required Env Vars:** `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BETA_END`

## Stack

*   **Monorepo:** pnpm workspaces
*   **Runtime:** Node.js v24
*   **TypeScript:** v5.9
*   **API Framework:** Express 5
*   **ORM:** Drizzle ORM
*   **Validation:** Zod, `drizzle-zod`
*   **API Codegen:** Orval
*   **Build Tool:** Vite (frontend), esbuild (backend)

## Where things live

*   `artifacts/promptmegood/`: Main static AI prompt builder (frontend).
*   `artifacts/promptmegood/index.html`: Marketing **landing page** (lightweight, ~10kB). Auto-redirects returning users to `/app` based on localStorage signals (`pmg_visited`, `pmg_prompt_count`, `promptmegood:templates:v1`, `pmg.workstationTourSeen`, `pmg.quickWinSeen`); add `?stay=1` to view it on purpose.
*   `artifacts/promptmegood/app.html`: The 12,700-line **workstation** (formerly `index.html`). Served at `/app` and `/app/` by `server.mjs` (rewrite to `/app.html`). Includes a `#pmg-splash` loader (dark teal bg, mint spinner, auto-fade on `window.load + 120ms`, 4s safety timeout, prefers-reduced-motion aware) painted before chassis JS runs so users never see a blank-workstation flash. **Dev caveat:** Vite dev server doesn't rewrite `/app` → `app.html`; in dev navigate to `/app.html` directly. Production (`server.mjs`) handles both.
*   `packages/api/`: Backend API services.
*   `packages/db/`: Database schema and migrations.
*   `packages/shared/`: Shared utilities and types.
*   `openapi.yaml`: OpenAPI Specification (API contracts).
*   `artifacts/promptmegood/src/styles/`: Theme files (CSS variables).
*   `artifacts/promptmegood/public/styles/pmg-g-theme.css`: G "Warm Dark Hybrid" override stylesheet (loaded after inline `<style>` so cascade wins).
*   `artifacts/promptmegood/public/styles/pmg-chassis-v2.css` + `public/scripts/pmg-chassis-v2.js`: 3-column workstation chassis (top bar / Vault rail / thread+composer / chain gutter / Visual Asset Engine / status bar). **Polish pass (May 2026)** lives at the bottom of the CSS file: composer is `position:sticky; bottom:0` so it pins to viewport while long threads scroll past; empty `#result-panel:not(.has-result)` dimmed to 0.78 opacity with sample pills desaturated and placeholder text italic at 0.42 alpha; `≤900px` mobile rules set 16px min font on chassis-relocated inputs/textareas (iOS no-zoom) and 44px min tap targets on dock + top-bar + new-prompt + template-picker + master-link switch; `≤600px` tightens column padding and lets template picker shrink. **Mobile fixes round 2 (May 2026)** — dock was rendering inline at y=2254 because `#pmg-chassis-v2-root > * { position:relative; z-index:1 }` (line 60) overrides the dock's `position:fixed`; the round-2 block forces `position: fixed !important` to beat that specificity trap. Same block hides `.pmgv2-crumb/.pmgv2-vbar/.pmgv2-kbd/.pmgv2-expert` at ≤900px (top bar collapses to brand + ? + avatar; was overflowing to 105px tall and clipping the right cluster), hides empty `#result-panel:not(.has-result)` and `#imageResultWrap:has(.image-placeholder)` on mobile only so the composer is reachable in one screen (was at y=1219 of 844px viewport), and adds 56px bottom padding to `.pmgv2-main` to clear the fixed dock. **If you re-add anything to the top bar, scope it under the same media query as `display:none`** or it will overflow on phones. The ONLY experience — the legacy single-page view has been retired and there is no opt-out flag. NOTE: the chassis is a layout shell that relocates legacy DOM nodes (`#prompt-form`, `#result-panel`, `#history`, `#templates`, `#photo-suite-section`) from the original `index.html` into chassis slots. The legacy markup remains the source of truth for behaviour; the chassis only restructures presentation. All CSS scoped under `html.pmg-chassis-v2`. Phase 2 wired: `relocateLegacy()` MOVES (not clones) `#prompt-form`, `#result-panel`, `#history`, `#templates`, `#photo-suite-section` into the chassis slots after DOMContentLoaded — preserves all legacy event listeners and IDs. Slots are marked with `data-pmgv2-target` attrs; relocated nodes get `data-pmgv2-relocated="1"` + `.pmgv2-relocated` class for scoped CSS overrides. Phase 3 wired: `wireMasterLink()` toggles `<html data-pmgv2-master-link="on|off">` (persisted via `pmgChassisV2:masterLink` localStorage key) which drives the chain-gutter glow + pulse animation and lights up the Master Link card and Master Actionable Plan card. Vault rail buttons forced into a tidy vertical column with truncation-safe styling; photo-suite headings capped at 18px so they don't bleed past the 320px tools column. Phase 4 wired: Quick Win overlay is suppressed and marked seen whenever the chassis flag is on (the chassis IS the workstation); the legacy yellow `#pmg-t42-beta-banner` is hidden via CSS in chassis mode, and `wireBetaPill()` polls for it (max 5s) to mirror its date into a compact mint/amber pill in the status bar that links to pricing.html. Phase 5 wired: `wireExportPlan()` adds a Copy Plan button to the Master Plan card that reads `#goal` (Soul) + the result panel text (Body), composes a markdown plan, copies to clipboard with toast confirmation, and is gated on Master Link via a MutationObserver on the `data-pmgv2-master-link` attribute. `wireMobileDock()` mounts a fixed bottom-dock nav with Vault/Workstation/Visual tabs that toggle `<html data-pmgv2-mobile-tab>`; under 900px only the active column renders, so phones get a tabbed Claude/ChatGPT-style experience instead of a long-scroll page. Tab choice persisted via `pmgChassisV2:mobileTab` localStorage key.
*   `artifacts/promptmegood/help.html`: Branded meta-refresh redirect to `/guide.html` (registered in `vite.config.ts` rollup inputs).
*   `artifacts/promptmegood/404.html`: Branded not-found page; served by `server.mjs` for any unknown route with HTTP 404.
*   `artifacts/promptmegood/public/site.webmanifest` + `public/favicon.ico` (PNG copy of `favicon-32`): browser/PWA polish — referenced from `index.html` `<head>`.
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test configuration.

## Architecture decisions

*   **Monorepo with pnpm:** Facilitates shared code and consistent development across frontend and backend.
*   **Client-side quick-win flow:** First-time user onboarding leverages sequential client-side API calls to immediately engage users without full workstation exposure.
*   **Accessibility Guard:** A global, continuous accessibility check ensures all interactive elements are clickable and visible, mitigating state-flag-driven `inert`/`aria-hidden` bugs.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions to provide a focused first-prompt experience.
*   **Expert Command Center as Paid Feature:** Advanced prompt engineering tools are paywalled after beta, driving PRO tier conversions.
*   **G theme overlay (Brand Teal):** Visual language is layered on top of the legacy single-file `index.html` via a token+skin override stylesheet (`public/styles/pmg-g-theme.css`) — no markup rewrites. Forces deep teal (`#0a2420` bg, `#0e3a36` surfaces) with mint accent (`#3ee0a0/#5fe6b0`) pulled from the PMG logo. Inter + JetBrains Mono. Accent-picker friendly: `--color-primary` is scoped to `html:not([data-accent])` and `html[data-accent="green"]` so the legacy footer swatches (blue / purple / gold / slate) still take effect; non-green accents are re-affirmed with `!important` overrides for the dark surface.
*   **Accent picker shared across legacy + chassis:** The legacy footer's "Personalize" swatches (`.accent-swatch[data-accent]`) and the chassis status-bar swatches (`.pmgv2-sw[data-accent]`) both write to the same `promptmegood:themeAccent:v1` localStorage key and toggle `<html data-accent>`. Either surface can change the accent; both stay in sync on the next reload.

## Product

*   **AI Prompt Builder:** Craft effective prompts with smart suggestions, auto-optimization, and quality checks.
*   **Quick Win Mode:** Streamlined onboarding for first-time users to quickly generate their first prompt blueprint.
*   **Expert Command Center:** Advanced tools for prompt diagnosis, engineering, tuning, variations, and saving workflows (paid feature).
*   **Image Generation:** Generate image prompts with aspect ratio controls and style variations.
*   **Run With AI:** Integrate directly with `gpt-4o` for immediate prompt execution and refinement.
*   **Prompt Vault:** Save, organize, and compare prompts with tagging and filtering.
*   **Command Palette (⌘K):** Global search and execution for commands, modes, and vault items.
*   **Brand Voice Profiles (Pro):** Customize AI responses with specific brand voices.
*   **Voice Input:** Utilize Web Speech API for prompt input with language selection.

## User preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

## Gotchas

*   **Accessibility State:** While `pmgGlobalAccessibilityGuard` is robust, always verify `inert`/`aria-hidden` states, especially after complex DOM manipulations or new dialog implementations.
*   **Quick Win Overlay:** Ensure `html.pmg-qw-pending` is applied correctly via inline script to prevent workstation flash for first-time users.
*   **Expert Command Center Gating:** Remember that Expert Mode is free during beta but becomes a paid feature after `BETA_END`. Ensure pricing and UI reflect this.
*   **Empty-state action gating:** `watchResultBox()` in `index.html` toggles `disabled` on result-area buttons (`result-top-copy/run/refine`, `copy-btn`, `download-prompt-btn`, `print-btn`, `clear-prompt-btn`, `check-quality-btn`) based on whether `getPromptText()` has real content. If you add a new post-result action, append its ID to `EMPTY_BTN_IDS`.
*   **Saved-To-Vault indicator:** The `#pmg-vault-saved-indicator` pill is only shown by listening for the `pmg:vault-saved` DOM event. Any new code path that persists a prompt to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))` after a successful save — otherwise the user gets no confirmation.
*   **Body-appended overlays must be in the chassis allowlist:** `pmg-chassis-v2.css` hides every direct `body >` child except `#pmg-chassis-v2-root` and a canonical overlay allowlist (`#pmg-splash`, `#pmg-cmdk-backdrop`, `#pmg-expert-center-root`, `#pmg-shortcuts-backdrop`, `#pmg-share-sheet-backdrop`, `#pmg-upgrade-overlay`, `#pmg-bv-overlay`, `.pmg-toast-host`, plus anything carrying `[data-pmg-overlay-root]`). For any NEW runtime overlay that mounts directly under `<body>`, the easiest fix is to add `data-pmg-overlay-root` on the outer wrapper — otherwise it will silently `display:none` even when its own CSS sets `.is-open { display:flex }`. Do NOT broaden to `[role="dialog"]` — the legacy shell has static dialog nodes (`#pmg-quick-win-overlay`, `#pmg-post-run-intro`, `#compare-overlay`, etc.) that must stay hidden in chassis mode.
*   **Waitlist anchors:** `pricing.html` exposes three IDs at the single waitlist form (`#early-access`, `#founding-member-waitlist`, `#pro-early-access`). Tier CTAs link to the tier-specific anchor; the form itself is unified.
*   **Adding new top-level HTML pages:** Register the file in `artifacts/promptmegood/vite.config.ts` `rollupOptions.input` or it won't be copied to `dist/public` during build.
*   **Route split (`/` vs `/app`):** `/` serves the marketing landing (`index.html`); `/app` serves the workstation (`app.html`). The landing's inline script auto-redirects returning users to `/app` based on localStorage. If you add a new "first-time user" signal, register it in that detection list, and use `?stay=1` to bypass the redirect when testing the landing on a returning-user browser. **Never rename `app.html` back to `index.html`** — `server.mjs` and `vite.config.ts` both reference both filenames.

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)