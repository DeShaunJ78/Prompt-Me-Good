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
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test configuration.

## Architecture decisions

*   **Monorepo with pnpm:** Facilitates shared code and consistent development across frontend and backend.
*   **Client-side quick-win flow:** First-time user onboarding leverages sequential client-side API calls to immediately engage users without full workstation exposure.
*   **Accessibility Guard:** A global, continuous accessibility check ensures all interactive elements are clickable and visible, mitigating state-flag-driven `inert`/`aria-hidden` bugs.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions to provide a focused first-prompt experience.
*   **Expert Command Center as Paid Feature:** Advanced prompt engineering tools are paywalled after beta, driving PRO tier conversions.
*   **G theme overlay (Warm Dark Hybrid):** Visual language is layered on top of the legacy single-file `index.html` via a token+skin override stylesheet (`public/styles/pmg-g-theme.css`) — no markup rewrites. Forces warm dark (`#1a1410` bg, terracotta `#e57c4a/#f4a574` accent, Inter + JetBrains Mono) regardless of system preference. Re-skins the dynamically-injected T42 beta banner, Quick Win overlay, dialogs, scrollbars, and primary inputs.

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