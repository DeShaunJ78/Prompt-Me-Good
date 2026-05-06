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
*   `packages/api/`: Backend API services.
*   `packages/db/`: Database schema and migrations.
*   `packages/shared/`: Shared utilities and types.
*   `openapi.yaml`: OpenAPI Specification (API contracts).
*   `artifacts/promptmegood/src/styles/`: Theme files (CSS variables).
*   `artifacts/promptmegood/public/styles/pmg-g-theme.css`: G "Warm Dark Hybrid" override stylesheet (loaded after inline `<style>` so cascade wins).
*   `artifacts/promptmegood/public/styles/pmg-chassis-v2.css` + `public/scripts/pmg-chassis-v2.js`: 3-column workstation chassis (top bar / Vault rail / thread+composer / chain gutter / Visual Asset Engine / status bar). Activated by `?chassis=v2` URL param or `localStorage.pmgChassisV2 = "true"`. All CSS scoped under `html.pmg-chassis-v2`; legacy site is bit-identical when flag is off. Disable with `?chassis=off`. Phase 2 wired: `relocateLegacy()` MOVES (not clones) `#prompt-form`, `#result-panel`, `#history`, `#templates`, `#photo-suite-section` into the chassis slots after DOMContentLoaded — preserves all legacy event listeners and IDs. Slots are marked with `data-pmgv2-target` attrs; relocated nodes get `data-pmgv2-relocated="1"` + `.pmgv2-relocated` class for scoped CSS overrides. Phase 3 wired: `wireMasterLink()` toggles `<html data-pmgv2-master-link="on|off">` (persisted via `pmgChassisV2:masterLink` localStorage key) which drives the chain-gutter glow + pulse animation and lights up the Master Link card and Master Actionable Plan card. Vault rail buttons forced into a tidy vertical column with truncation-safe styling; photo-suite headings capped at 18px so they don't bleed past the 320px tools column. Phase 4 wired: Quick Win overlay is suppressed and marked seen whenever the chassis flag is on (the chassis IS the workstation); the legacy yellow `#pmg-t42-beta-banner` is hidden via CSS in chassis mode, and `wireBetaPill()` polls for it (max 5s) to mirror its date into a compact mint/amber pill in the status bar that links to pricing.html.
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

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)