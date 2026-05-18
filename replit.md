# PromptMeGood

PromptMeGood is an AI prompt builder designed to enhance AI interactions and user productivity by offering smart suggestions, auto-optimization, and quality checks.

## Run & Operate

*   **Run:** `pnpm start` · **Build:** `pnpm build` · **Typecheck:** `pnpm typecheck` · **Codegen:** `pnpm codegen` · **DB Push:** `pnpm db:push`
*   **Required Env Vars:** `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BETA_END`

## Stack

pnpm workspaces · Node v24 · TS 5.9 · Express 5 · Drizzle ORM · Zod · Orval (API codegen) · Vite (frontend) · esbuild (backend).

## Where things live

*   `artifacts/promptmegood/` — Frontend. Pages: `index.html` (marketing), `app.html` (workstation), `guide.html`, `manual.html`, `help.html`, `contact.html`, `pricing.html`, `privacy.html`, `terms.html`, `review.html`, `404.html`. Chassis v3 is the only chassis loaded.
*   `packages/api/`, `packages/db/`, `packages/shared/` — Backend services, schema, shared types.
*   `openapi.yaml` — API contracts.
*   `artifacts/promptmegood/public/styles/` + `public/scripts/` — Workstation runtime:
    *   `pmg-g-theme.css` — Dark teal theme tokens.
    *   `pmg-chassis-v3.{css,js}` — Workstation shell + segmented panels (Text/Photography/Video).
    *   `pmg-visual-studio.{css,js}` — Inline Photo + Video panel mounters (Reverse Engine, Image Workshop, DNA Card, Sora video).
    *   `pmg-storyboard.{css,js}` — Storyboard Studio modal.
    *   `pmg-auto-boost.{css,js}` — Per-panel ✨ Auto-Boost.
    *   `pmg-ux.js` — Photo Suite GROUPS, presets, Surprise Me, demoteButtons.
    *   `pmg-business-mode.{css,js}` — Business Mode header-icon drawer (💼 → right slide-in: Brand Voice + Social Packs + Platform Builder).
    *   `pmg-guided-intake.{css,js}` — Guided 4-field intake (Subject/Environment/Action/Style) above `#pmg-vs-image-goal` / `#pmg-vs-video-goal`, with ↻ toggle to freeform.
    *   `pmg-adv-mirror.{css,js}` — Mirrors `<details id="advanced-options">` (Growth Mode / Human Voice / Clarity Boost) inside `#tuning-panel`. See [adv-mirror gotchas](./docs/gotchas.md#adv-mirror-gotchas-pmg-adv-mirrorcssjs).
    *   `pmg-tune-chips.{css,js}` — "Prompt Tuning" pill in voice row → opens full `.tuning-section`. See [tune-chips gotchas](./docs/gotchas.md#tune-chips-gotchas-pmg-tune-chipscssjs).
    *   `pmg-std-examples.js` — Makes "See The Difference" before/after rows clickable; populates `#goal` with the Before text, switches to Text panel, scrolls + pulses the textarea. Stops short of auto-generating.
*   `artifacts/promptmegood/public/sitemap.xml` + `robots.txt` — SEO surface (AI crawlers allowed).
*   `artifacts/promptmegood/playwright.config.ts` — Frontend test config.

## Architecture

*   **Three-panel inline architecture:** `body[data-active-panel="text|photography|video"]` swaps which `#pmgv3-panel-*` is visible. Tabs call `window.pmgChassisV3.setActivePanel(name)`. No modals for panel switches.
*   **Chassis v3 reparents legacy DOM** (`#goal`, `#settingsPanel`, `#generateBtn`, `#resultBox`) into v3 slots. Universal hide rule `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses everything outside the chassis root.
*   **Panel-scoped IDs:** `#pmg-vs-image-*` / `#pmg-vs-video-*` (goal/refined/generate-btn/copy) — see `pmg-visual-studio.js`.
*   **Photo Suite relocation:** Legacy `#photo-suite-section` moved into `#pmg-vs-photo-suite-container` by `relocatePhotoSuite()` (200ms poll, max 30 ticks). `body.image-mode` is the trigger CSS class — toggled by `setActivePanel('photography')`.
*   **Refresh = clean slate (refresh-clears-1):** True browser reload (F5/Cmd-R) wipes `sessionStorage['pmgv3:session']` AND `localStorage['pmgv3:draft']` BEFORE chassis-v3 boots, via inline IIFE in `app.html` `<head>`. Detection: `performance.getEntriesByType('navigation')[0].type === 'reload'`. Cold opens / back-forward / reopened tabs are NOT reloads. Disable: `localStorage.pmg_refresh_clears_disable='1'`.
*   **Session TTL = 30 minutes (stale-session-1):** `SESSION_TTL_MS` in `pmg-chassis-v3.js` was cut from 7 days to 30 minutes. Visiting `/app` after a longer gap renders blank instead of silently re-hydrating stale goal/tuning/prompt. Longer-term recovery is delegated to the Draft Recovery banner (dr-1, also 30-min freshness window via the same constant).
*   **Local-first state:** Vault, picks, theme in `localStorage`; only AI-feature inputs leave the device.
*   **Light/dark locked to dark:** `pmg-g-theme.css` L11–22 forces dark teal for both `[data-theme]` values.
*   **Expert Command Center is paywalled** after `BETA_END`.

## Product

Three Panels (Text / Photography / Video) · Image Workshop (15 enhancement chips → `gpt-image-1`) · Reverse Engine (image → prompt via GPT-4o vision) · Prompt DNA Card (1080×1350 share PNG) · Storyboard (5-shot cinematic, send to Video panel) · Pro Tuning (presets/boosts/modes) · Auto-Boost / Auto-Tune · Run With AI (GPT-4o in-app) · Prompt Vault · Brand Voice Profiles (Pro) · Voice Input · Expert Command Center (paid).

## User preferences

Concise, direct communication. Iterative dev — explain high-level impact before details. Ask before major architectural changes or new external dependencies.

## Post-launch backlog

*   Collect real testimonials from the first 10 paying Founding Members (with permission to publish) and add a social-proof block to `index.html` and `pricing.html`. Until then, zero fabricated testimonials/user counts/star ratings — see §10 audit notes.
*   Privacy.html DNT/GPC documentation (deferred from §15 audit).
*   Remove the dead legacy image-mode code path (follow-up refs #146, #147).

## Gotchas

Hard-won invariants — universal rules, architecture details, state persistence, send-to/handoff, Visual Studio, adv-mirror, tune-chips, overlays, and backend-touching features — live in [`docs/gotchas.md`](./docs/gotchas.md). Read the relevant section before editing the surface it covers.

Per-script (`pmg-*.js` mounter) gotchas live in [`docs/scripts.md`](./docs/scripts.md). Read that file before editing any mounter or adding a new one. All listed scripts share: `?nameKey` URL kill-switch + `localStorage.pmg_{name}_disable='1'`.

## SEO auditing

*   **Audit the production custom domain, not the Replit dev preview.** Replit dev preview URLs (`*.janeway.replit.dev`, `*.replit.dev`) automatically respond with `X-Robots-Tag: none, noindex, noarchive, nofollow, nositelinkssearchbox, noimageindex`. This is platform behavior to keep dev URLs out of Google and **cannot be removed from the dev preview**. Lighthouse / SEO crawlers run against the dev preview will report "Page is blocked from indexing" on every page — false positive.
*   **Real audit URL:** `https://www.promptmegood.com/` (and any sub-page). The custom domain serves no `X-Robots-Tag`, and per-page `<meta name="robots" …>` is the only signal.
*   `/review.html` intentionally 404s in production (removed from `vite.config.ts` `rollupOptions.input` per audit brief 12); the 404 fallback page carries `noindex` which is correct.

## Pointers

*   **Validation:** `validation` skill — `overflow-360` Playwright tests.
*   **OpenAPI:** `openapi.yaml`.
*   **Docs:** [Drizzle](https://orm.drizzle.team/docs/overview) · [Zod](https://zod.dev) · [Orval](https://orval.dev) · [Vite](https://vitejs.dev/guide/) · [Express](https://expressjs.com)
