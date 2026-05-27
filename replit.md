# PromptMeGood

PromptMeGood is an AI prompt builder designed to enhance AI interactions and user productivity by offering smart suggestions, auto-optimization, and quality checks.

## Run & Operate

*   **Run:** `pnpm --filter @workspace/promptmegood run start` (frontend) + `pnpm --filter @workspace/api-server run start` (API after build) · **Build:** `PORT=8081 BASE_PATH=/ pnpm build` · **Typecheck:** `pnpm typecheck` · **Codegen:** `pnpm --filter @workspace/api-spec run codegen` · **DB Push:** `pnpm --filter @workspace/db run push`
*   **Required Env Vars:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, OpenAI credentials (`AI_INTEGRATIONS_OPENAI_API_KEY` or `OPENAI_API_KEY` depending on route), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; optional secret `OWNER_USER_ID` enables owner bypass and should not be committed.

## Stack

pnpm workspaces · Node v24 · TS 5.9 · Express 5 · Drizzle ORM · Zod · Orval (API codegen) · Vite (frontend) · esbuild (backend).

## Where things live

*   `artifacts/promptmegood/` — Frontend. Pages: `index.html` (marketing), `app.html` (workstation), `guide.html`, `manual.html`, `help.html`, `contact.html`, `pricing.html`, `privacy.html`, `terms.html`, `404.html`. Chassis v3 is the only chassis loaded; `/review.html` is dev-only and intentionally excluded from production builds.
*   `artifacts/api-server/` — Express API and backend integrations.
*   `lib/db/`, `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` — Drizzle schema, OpenAPI source, generated Zod schemas, and generated React client.
*   `lib/api-spec/openapi.yaml` — API contract source for Orval codegen.
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
*   **Expert Command Center is paywalled** after `PAYWALL_ACTIVATES_AT`.

## Product

Three Panels (Text / Photography / Video) · Image Workshop (15 enhancement chips → `gpt-image-1`) · Reverse Engine (image → prompt via GPT-4o vision) · Prompt DNA Card (1080×1350 share PNG) · Storyboard (5-shot cinematic, send to Video panel) · Pro Tuning (presets/boosts/modes) · Auto-Boost / Auto-Tune · Run With AI (GPT-4o in-app) · Prompt Vault · Brand Voice Profiles (Pro) · Voice Input · Expert Command Center (paid).

## User preferences

Concise, direct communication. Iterative dev — explain high-level impact before details. Ask before major architectural changes or new external dependencies.

## Post-launch backlog

*   Collect real testimonials from the first 10 paying Founding Members (with permission to publish) and add a social-proof block to `index.html` and `pricing.html`. Until then, zero fabricated testimonials/user counts/star ratings — see §10 audit notes.
*   Privacy.html DNT/GPC documentation (deferred from §15 audit).
*   Remove the dead legacy image-mode code path (follow-up refs #146, #147).
*   **§11/14/16 audit follow-ups** (audit deferred 2026-05-18). Five batch sections (§11-14, §16) closed with surgical fixes; remaining items need either human-in-the-loop or deliberate refactor:
    1.  **Manual smoke test of Build flow on production.** §14 (AI Output Quality) cannot be verified programmatically without burning OpenAI credits. Code paths inspected: `ai.ts` has distinct `/boost` (L1597) and `/auto-tune` (L1684) endpoints — Auto-Boost is real differentiated work, not rephrasing. `TEXT_MODEL` correctly pinned to `gpt-4.1` after the May 17 model-fix. On launch day, manually run 3-5 representative prompts through `/app` on `promptmegood.com` and verify: (a) output is coherent + on-topic, (b) no system-prompt fragments leak (look for "You are a...", "Always respond with...", "##" markers in user-facing output), (c) Auto-Boost output is structurally improved (more specific, better tuned) vs. just reworded.
    2.  **Rollback path verification.** §16 (Observability). Replit deployments expose rollback via the Deployments dashboard — verify before launch that the most recent green deploy is one click away. Documented in `.local/skills/deployment` for the user-facing workflow.
    3.  **Switch route handlers from global `logger` to `req.log`** (§16 finding). `pnpm-workspace` skill recommends `req.log` for auto-correlation with request id (already injected by pino-http in `app.ts` L26). 26 sites in `ai.ts` alone use `logger.error/warn` directly — losing the request-id auto-tag in those log lines. Functional today (logs ARE produced with operation tags), but request correlation across services would be cleaner. Low-priority refactor.
    4.  **A11y micro-fixes** (§11 finding). Two bare `outline: none` declarations without paired keyboard-visible focus indicator: `pmg-spark-panel.css:83` (input) and `pmg-prompt-coach.css:109/174` (chip + input). The main-input pattern (`pmg-g-theme.css:130` `outline:none` paired with `box-shadow` ring) is correct and should be the template for these two. Affects ~3 interactive elements only — LOW severity.
*   **§4 perf follow-ups** (audit deferred 2026-05-18). Lighthouse-proper run is owed on the production custom domain (Replit dev preview is unrepresentative — proxy overhead + `X-Robots-Tag` noise). When you run it, two items are pre-scoped:
    1.  **Lazy-load heavy feature modules** (Option B from §4 audit). `pmg-expert-center.js` (89 KB), `pmg-storyboard.js` (30 KB), and `pmg-visual-studio.js` (92 KB) — ~210 KB combined — currently load on every `/app` visit despite being feature-gated entry points. Refactor each to defer the script tag injection until first user interaction with the feature (e.g. click on Expert Center icon, click on Storyboard launcher, switch to Photography/Video panel). Each module's mount/init pattern must be verified to survive delayed load — they all use `pmgMountBus` so the pattern is consistent. Medium risk; architect review required.
    2.  **Split `pmg-ux.js`** (Option C from §4 audit). 797 KB / 17,848 lines / 534 functions — by far the single largest perf liability on `/app` (9× the next-largest external script, bigger than the entire HTML page). Self-described as "consolidated from pmg-bugfix + pmg-fixes-v2/v3/v4/v5/v6" with 12 stacked UX phases (T14 through T25). The accreted structure makes a clean split realistic over 1–2 dedicated sessions, not as part of a wider audit. Approach: identify which IIFE blocks affect first-paint (Photo Suite GROUPS, presets, reorderForm) vs. post-interaction (Surprise Me, demoteButtons, T26 MutationObserver guard), split into two files, lazy-load the post-interaction half. Estimated 400–500 KB removable from initial parse. High risk; needs dedicated work + before/after Lighthouse comparison.
*   **§3 overlay architecture refactor** (audit deferred 2026-05-18). Three known issues need deliberate work, not a single-line patch:
    1.  **Scroll-lock counter.** Today every overlay sets `body { overflow:hidden }` as a binary toggle. When modals stack (e.g. Business Mode drawer → Upgrade modal), closing the inner modal removes the lock even though the parent is still open, leaking background scroll. Fix: implement a refcount stack on `document.body` (e.g. `data-pmg-scroll-locks="N"`) so the lock only releases when the count hits zero.
    2.  **ESC key discipline.** Multiple overlays register global ESC listeners without `stopPropagation` or open-stack checks. ESC closes too many things (e.g. Command Palette on top of Expert Center closes both). Fix: a shared `pmg-overlay-stack` module that owns the ESC listener and dispatches to the top-most open surface only.
    3.  **Backdrop over-dismissal.** Stacked modals each render their own scrim; clicking the inner scrim sometimes dismisses both. Fix: route backdrop clicks through the same overlay-stack module, so each scrim only closes its own surface.

    Single-value z-index fixes shipped in §3 (upgrade modal 200→100001, toast 9999→100002) cover the most visible bug (cap modal hidden behind Magic Flow takeover). The three items above are real but each requires a refactor touching multiple files — flag, don't patch.

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
