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
    *   `pmg-business-mode.{css,js}` — Business Mode header-icon drawer (💼 in topbar → right slide-in with Brand Voice + Social Packs + Platform Builder accordions; Build Prompt fills `#goal` and submits `#prompt-form`).
    *   `pmg-guided-intake.{css,js}` — Guided 4-field intake (Subject / Environment / Action / Style) injected ABOVE `#pmg-vs-image-goal` and `#pmg-vs-video-goal`, with a persistent ↻ toggle to freeform.
*   `artifacts/promptmegood/public/sitemap.xml` + `robots.txt` — SEO surface (AI crawlers allowed).
*   `artifacts/promptmegood/playwright.config.ts` — Frontend test config.

## Architecture

*   **Three-panel inline architecture:** `body[data-active-panel="text|photography|video"]` swaps which `#pmgv3-panel-*` is visible. Tabs call `window.pmgChassisV3.setActivePanel(name)`. No modals for panel switches.
*   **Chassis v3 reparents legacy DOM** (`#goal`, `#settingsPanel`, `#generateBtn`, `#resultBox`, etc.) into v3 slots. Universal hide rule `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses everything outside the chassis root.
*   **Panel-scoped IDs** (avoid collisions with text panel): `#pmg-vs-image-goal` / `#pmg-vs-video-goal`, `#pmg-vs-image-refined` / `#pmg-vs-video-refined`, `#pmg-vs-image-generate-btn` / `#pmg-vs-video-generate-btn`, etc. — see `pmg-visual-studio.js`.
*   **Photo Suite relocation:** Legacy `#photo-suite-section` is moved into `#pmg-vs-photo-suite-container` by `relocatePhotoSuite()` (200ms poll, max 30 ticks). `body.image-mode` is the trigger CSS class — toggled by `setActivePanel('photography')`.
*   **Local-first state:** Vault, picks, theme live in `localStorage`; only AI-feature inputs leave the device.
*   **Light/dark locked to dark:** `pmg-g-theme.css` L11–22 forces the dark teal palette for both `[data-theme]` values.
*   **Expert Command Center is paywalled** after `BETA_END`.

## Product

Three Panels (Text / Photography / Video) · Image Workshop (15 enhancement chips → `gpt-image-1`) · Reverse Engine (image → prompt via GPT-4o vision) · Prompt DNA Card (1080×1350 share PNG) · Storyboard (5-shot cinematic, send to Video panel) · Pro Tuning (presets/boosts/modes) · Auto-Boost / Auto-Tune · Run With AI (GPT-4o in-app) · Prompt Vault · Brand Voice Profiles (Pro) · Voice Input · Expert Command Center (paid).

## User preferences

Concise, direct communication. Iterative dev — explain high-level impact before details. Ask before major architectural changes or new external dependencies.

## Gotchas

*   **Cache-busters:** Bump query string on changed `pmg-*.{css,js}` (current image-mode-cleanup buster: `t140-image-mode-removed`). Brand assets `?v=5`.
*   **Body-appended overlays + toasts** must carry `data-pmg-overlay-root` or the chassis universal-hide rule erases them. Applies to `flash()` and `pmg-send-to.js` `toast()`.
*   **Saved-To-Vault indicator:** Code persisting to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Empty-state action gating:** New post-result action buttons need IDs in `EMPTY_BTN_IDS` in `app.html`'s `watchResultBox()`.
*   **Adding new top-level pages:** Register in `vite.config.ts` `rollupOptions.input` AND `public/sitemap.xml`.
*   **Route split:** `/` = marketing (auto-redirects returning users to `/app`; `?stay=1` bypasses), `/app` = workstation. `?panel=photography|video` deep-links into a specific panel after chassis builds.
*   **Send to AI (silent + return-toast):** Gemini ignores `?q=`/`?text=`/`?prompt=`; ChatGPT and Claude honor `?q=`. UX: silent clipboard copy + open destination, NO launch toast. `armReturnToast()` shows a one-shot "✓ Your prompt is still on your clipboard" toast only if user returns within 60s.
*   **Session persistence:** Idea + tuning + generated prompt persist to `sessionStorage.pmgv3:session` (7-day TTL) via `wirePersistence()` in `pmg-chassis-v3.js`. **`sessionStorage` not `localStorage`** — survives backgrounding (iOS Safari unload), clears on full tab close. `writeSession()` skips when both goal AND prompt are empty so default tuning alone isn't treated as user signal. Disable: `?fresh=1`, `localStorage.pmgv3_persist_disable='1'`.
*   **No custom pull-to-refresh:** `pmg-pull-refresh.js` was removed (hijacked touch mid-scroll, wiped textarea). Rely on browser native.
*   **Topbar icons** (`.pmgv3-ico`) hard-set to 44×44 `!important` on the base rule. ≤400px breakpoint shrinks only the glyph `font-size`. No 32/36px overrides.
*   **Mobile accordions (≤768px):** Text panel `.tuning-section` is collapsed behind `#tuning-mobile-toggle`; Photo Suite is collapsed behind `#pmg-vs-photo-acc-toggle`. Toggling adds `is-mobile-open`. Desktop unaffected.
*   **First-impression layout:** `.pmgv3-right-placeholder` shows the empty-state intro (3 numbered steps), auto-hides on `body.pmg-has-result`. `.pmgv3-bottom` quick-entry footer is hidden on all viewports (markup preserved). `#goal` textarea is the single entry point.
*   **Storyboard concept source:** `getGoalText()` reads `#pmg-vs-video-goal` first (Video panel), falls back to `#goal`. If both empty, shows inline ⚠️ and does NOT open the modal.
*   **Auto-Tune** (`POST /api/auto-tune`, JSON-mode, 250 tokens): hooked from chassis-v3 `wireActions()` Analyze handler. Server hard-clamps to `TUNE_ENUMS`. 12s abort, silent fallback. Disable: `?noautotune`, `localStorage.pmg_autotune_disable='1'`.
*   **Guided Intake** (`pmg-guided-intake.{js,css}`, gi-1): Variant A from the canvas review. Mounts via MutationObserver as soon as `#pmg-vs-image-goal` / `#pmg-vs-video-goal` exist, injects 4 labeled fields above each (Subject / Environment / Action / Style) and a persistent toggle "↻ Or write freeform instead". The legacy textareas remain the source-of-truth that `buildImagePrompt()` / `buildVideoPrompt()` read — in guided mode the textarea is `display:none` and we set its `.value` from the assembled `subject, environment, action, style style` string and dispatch input/change so auto-boost & session persistence react. Mode persists per-panel in `localStorage['pmgv3:vs:intake-mode:image'|':video']` (`'guided'|'freeform'`, default `'guided'`); field values in `localStorage['pmgv3:vs:intake:image'|':video']`. Photo and Video have INDEPENDENT mode preferences. The Build button has a capture-phase listener that focuses the first guided field when the assembled prompt is empty (since the hidden textarea's `.focus()` is a no-op). Disable: `?noguided`, `localStorage.pmg_guided_intake_disable='1'`.
*   **Auto-Boost** (`pmg-auto-boost.{js,css}`): Two-step `POST /api/clarify` → optional Q&A card → `POST /api/boost`. Mounts inside the result panel actions row after `#copy-btn` (text — bm-3, was previously the `.output-box` wrapper which made the button float at the top of the right column), `#pmg-vs-image-copy` (photo), `#pmg-vs-video-copy` (video). The text variant is intentionally hidden until a result exists (it inherits the actions row's visibility); `mountTarget()` returns null when `#copy-btn` isn't yet present so `mountFor()` retries on the next observer tick. On success force-sets strength to 100%. Disable: `?noautoboost`, `localStorage.pmg_autoboost_disable='1'`.
*   **Business Mode is a header-icon drawer, not a tab (bm-2).** The 💼 button (`#pmgv3-business`) in `.pmgv3-tb-r` opens a right-side slide-in (`#pmg-bm-drawer` + `#pmg-bm-overlay`, both carry `data-pmg-overlay-root`). Brand Voice persists to `localStorage['pmgv3:bm:brand']` (`{audience, tone}`). Build Prompt assembles a string, calls `pmgChassisV3.setActivePanel('text')`, sets `#goal.value`, dispatches input/change, and `requestSubmit()`s `#prompt-form` so the existing generatePrompt flow runs unchanged. NO new backend routes. `brandSuffix()` reads LIVE drawer inputs (not localStorage) to avoid the 250ms debounce race. `window.pmgBusinessMode.{open,close}` exposed for tests. The old 4th tab + `#pmgv3-panel-business` were removed; `validNames` and the `?panel=` allowlist no longer include `business`.
*   **Image-mode is now a chassis-v3 tab (not a global toggle).** `window.setMode`, `window.runImageGeneration`, `#modeSwitch`, `#imageModeBtn`/`#writeModeBtn`, `#image-generate-btn`, `.image-mode-hint` are all gone (Task #140). To enter image mode programmatically, call `window.pmgChassisV3.setActivePanel('photography')`. The class `body.image-mode` is still toggled by chassis-v3 because the relocated Photo Suite's CSS keys off it. `pmg-share.js` and `pmg-handoff.js` route through `setActivePanel`; remaining `typeof window.setMode === 'function'` references are inert no-ops.

## Pointers

*   **Validation:** `validation` skill — `overflow-360` Playwright tests.
*   **OpenAPI:** `openapi.yaml`.
*   **Docs:** [Drizzle](https://orm.drizzle.team/docs/overview) · [Zod](https://zod.dev) · [Orval](https://orval.dev) · [Vite](https://vitejs.dev/guide/) · [Express](https://expressjs.com)
