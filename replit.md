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
*   `pmg-adv-mirror.{css,js}` — Mirrors `<details id="advanced-options">` (Growth Mode / Human Voice / Clarity Boost) inside `#tuning-panel`, mounted as the LAST CHILD of `#pmgv3-epic-tuning` (adv-mirror-2: sibling-insert was orphaned into `#prompt-form` by `pmg-ux.js`'s `reorderForm()`; child-of-epic travels with epic-tuning's life cycle and self-heals if anything reparents it). Mirror toggles have their own IDs (`pmg-adv-mirror-{money,human,clarity}`) — no duplicate IDs in the DOM. Bidirectional sync via change/input listeners + per-original MutationObserver on `checked`. **Money Mode Pro panel mirroring (adv-mirror-4, adv-mirror-6):** the Money Mode Pro panel from `pmg-money-mode-pro.js` (id `#pmg-mmpro-panel`) is CLONED beneath the mirror's Growth Mode row as `#pmg-mmpro-panel-mirror`, with all child IDs suffixed `-mirror` (and `<label for>` / `aria-controls` rewritten). adv-mirror-6: clone is wrapped in a collapsed sub-`<details id="pmg-mmpro-mirror-collapse">` (summary "Show Pro options") so the default Advanced Output Settings view stays short and matches the calm reference layout. Sub state persists in `localStorage['pmg:advmirror:mmpro:open']`. Stale sub is cleaned up alongside stale clone in tryMount() self-heal. **adv-mirror-7:** the ORIGINAL `#pmg-mmpro-panel` inside `#settingsPanel` is also wrapped in a matching collapsed `<details id="pmg-mmpro-orig-collapse">` so the legacy panel matches the calm format on both desktop and mobile. Wrapper is inserted in-place around the original (no DOM relocation), so `pmg-money-mode-pro.js` continues to operate on `#pmg-mmpro-panel` unchanged. State persists in `localStorage['pmg:advmirror:mmpro:orig:open']`. Auto-opens when `#moneyMode` checkbox is toggled on (or already checked at boot) so the panel is visible the moment it becomes relevant. Original stays in its original spot inside `#settingsPanel`. Clone forwards user actions (preset clicks, select changes, boost checkboxes, upgrade CTA, tooltip) to the original; a MutationObserver on the original (subtree, attrs `class|checked|value`, childList, characterData) plus a capture-phase `change` listener mirrors UI updates (locked state, is-active rows, feedback line, select values) back to the clone. State stays single-source on the original; clone is pure UI. **Expert Command Center entry (adv-mirror-5):** a small `⚙ Open Expert Command Center` button (`#pmg-adv-mirror-ecc-open`) is appended at the bottom of the mirror body — calls `window.PMGExpertCenter.requestOpen()` (paywall + warning gating handled internally by ECC). No ECC content is duplicated. Mirror open state persists in `localStorage['pmg:advmirror:open']`. Disable: `?noadvmirror`, `localStorage.pmg_adv_mirror_disable='1'`.
*   `pmg-tune-chips.{css,js}` — Single quiet "Prompt Tuning" pill injected INTO the existing `.pmg-voice-row[data-pmg-voice-for="goal"]` (same line as Voice Input + en-US, right-aligned via `margin-left:auto`, smaller font/padding via `.is-in-voice-row`). Mount strategy: try voice row first; if pmg-voice hasn't mounted yet, drop a `.pmg-chip-row--single` fallback after `#goal`, then the boot poller (10s) calls `relocateIntoVoiceRow()` every tick to upgrade the pill into the voice row when it appears (and removes the empty fallback row). Click → opens `.tuning-section` (hidden by default via `body.pmg-tune-chips-on:not(.pmg-tune-section-shown)` rule). The `.tuning-section` Done bar contains TWO buttons: `⚙ Open Expert Command Center` (calls `window.PMGExpertCenter.requestOpen()`) and `✓ Done — Build My Prompt` (closes panel + auto-fires `#generateBtn.click()` after 60ms tick — no second click needed). Photo + Video panels each get a subtle ECC link appended into their existing `#pmg-vs-image-adv-tuning-content` / `#pmg-vs-video-adv-tuning-content` accordions (already collapsed by default, so it's a quiet entry point that doesn't compete with their own prompt-build CTAs). Two MutationObservers: (a) auto-open guard on `#tuning-panel` re-hides it any time it gets revealed without `body.pmg-tune-section-shown` (kills `restoreSession()` / Analyze auto-reveal); (b) panel-switch auto-close watches `.pmgv3-body[data-active-panel]` (NOT `document.body` — chassis writes the attribute on the inner `.pmgv3-body`) and removes `pmg-tune-section-shown` when leaving the Text panel. Chip/popover infrastructure kept dormant inside the script for possible future revival. Disable: `?nochips`, `localStorage.pmg_tune_chips_disable='1'`.
*   `artifacts/promptmegood/public/sitemap.xml` + `robots.txt` — SEO surface (AI crawlers allowed).
*   `artifacts/promptmegood/playwright.config.ts` — Frontend test config.

## Architecture

*   **Three-panel inline architecture:** `body[data-active-panel="text|photography|video"]` swaps which `#pmgv3-panel-*` is visible. Tabs call `window.pmgChassisV3.setActivePanel(name)`. No modals for panel switches.
*   **Chassis v3 reparents legacy DOM** (`#goal`, `#settingsPanel`, `#generateBtn`, `#resultBox`, etc.) into v3 slots. Universal hide rule `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses everything outside the chassis root.
*   **Panel-scoped IDs** (avoid collisions with text panel): `#pmg-vs-image-goal` / `#pmg-vs-video-goal`, `#pmg-vs-image-refined` / `#pmg-vs-video-refined`, `#pmg-vs-image-generate-btn` / `#pmg-vs-video-generate-btn`, etc. — see `pmg-visual-studio.js`.
*   **Photo Suite relocation:** Legacy `#photo-suite-section` is moved into `#pmg-vs-photo-suite-container` by `relocatePhotoSuite()` (200ms poll, max 30 ticks). `body.image-mode` is the trigger CSS class — toggled by `setActivePanel('photography')`.
*   **Refresh = clean slate (refresh-clears-1):** A true browser reload (F5 / Cmd-R / pull-to-refresh) wipes `sessionStorage['pmgv3:session']` AND `localStorage['pmgv3:draft']` BEFORE chassis-v3 boots, via an inline IIFE early in `app.html` `<head>`. Detection: `performance.getEntriesByType('navigation')[0].type === 'reload'` (with `performance.navigation.type === 1` legacy fallback). Cold opens, back/forward nav, and reopening a closed tab are NOT treated as reloads — those still benefit from session/draft restore. Disable: `localStorage.pmg_refresh_clears_disable='1'`.
*   **Local-first state:** Vault, picks, theme live in `localStorage`; only AI-feature inputs leave the device.
*   **Light/dark locked to dark:** `pmg-g-theme.css` L11–22 forces the dark teal palette for both `[data-theme]` values.
*   **Expert Command Center is paywalled** after `BETA_END`.

## Product

Three Panels (Text / Photography / Video) · Image Workshop (15 enhancement chips → `gpt-image-1`) · Reverse Engine (image → prompt via GPT-4o vision) · Prompt DNA Card (1080×1350 share PNG) · Storyboard (5-shot cinematic, send to Video panel) · Pro Tuning (presets/boosts/modes) · Auto-Boost / Auto-Tune · Run With AI (GPT-4o in-app) · Prompt Vault · Brand Voice Profiles (Pro) · Voice Input · Expert Command Center (paid).

## User preferences

Concise, direct communication. Iterative dev — explain high-level impact before details. Ask before major architectural changes or new external dependencies.

## Gotchas

### Universal rules (apply when adding ANY new code)

*   **Cache-busters:** Bump `?v=` query string on changed `pmg-*.{css,js}`. Brand assets `?v=5`. Current chassis CSS: `?v=cta-color-token-2-sendto-2line-mhdr2`.
*   **HTML never cached (ns-1):** `server.mjs` `cacheHeaderFor()` returns `no-store, no-cache, must-revalidate, max-age=0` for `.html` / directory roots / 404. A redeploy is visible on the very next request — old browser tabs cannot serve a stale shell. Static assets under `/assets/`, `/scripts/`, `/images/`, `/fonts/` keep their long cache headers; only the HTML shell re-downloads each visit.
*   **overflow-360 stale-spec ignore list (ov-1):** `playwright.config.ts` ignores 7 spec files (`handoff`, `photo-suite-handoff`, `photo-suite-mobile-polish`, `power-moves`, `replay-tour-dropdown`, `workstation-tour-mobile`, `share`) whose assertions reference DOM/behavior that has drifted, even though the underlying features still work. Static-page horizontal-overflow + scan-hidden coverage still runs. To rescue any one: remove its entry from `STALE_OVERFLOW_360_SPECS`, run locally, update assertions to match current DOM. Don't add new specs to the ignore list without a comment explaining why.
*   **Theme tokens, never hardcoded teal.** New CTAs must use `var(--color-primary, #3ee0a0)` / `var(--color-text-inverse)` / `color-mix(in srgb, var(--color-primary) X%, transparent)`. `html[data-accent="blue|purple|gold|slate"]` flips `--color-primary` — hardcoded `#00c896` won't follow.
*   **Body-appended overlays + toasts** must carry `data-pmg-overlay-root` or the chassis universal-hide rule erases them.
*   **Saved-To-Vault indicator:** Code persisting to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Empty-state action gating:** New post-result action buttons need IDs in `EMPTY_BTN_IDS` in `app.html`'s `watchResultBox()`.
*   **New top-level pages:** Register in `vite.config.ts` `rollupOptions.input` AND `public/sitemap.xml`.
*   **Tap targets:** Topbar icons (`.pmgv3-ico`) hard-set to 44×44 `!important`. No 32/36px overrides — the ≤400px breakpoint shrinks only the glyph `font-size`.
*   **Panel tabs at ≤480px (mhdr-2):** The 3 module tabs use `flex: 1 1 0` + `text-overflow: ellipsis` + `white-space: nowrap` to equal-distribute and truncate gracefully. Earlier `overflow-x: auto` (≤768 rule) created horizontal scroll with no visible affordance — "Video" got clipped on iPhone 16 (393px), Pixel (393), iPhone SE (375), Galaxy S24 (412), and iPhone SE 1st-gen (320). Don't reintroduce per-tab `min-width` or padding ≥10px — it breaks 320px fit. Photography Suite at the same breakpoint has defensive `min-width:0` + `overflow-wrap:anywhere` + `transform:none` on `:hover` to absorb worst-case "busy pill selection" overflow.
*   **No custom pull-to-refresh.** `pmg-pull-refresh.js` was removed (hijacked touch, wiped textarea). Rely on browser native.

### Architecture details

*   **Route split:** `/` = marketing (auto-redirects returning users to `/app`; `?stay=1` bypasses), `/app` = workstation. `?panel=photography|video` deep-links into a panel after chassis builds.
*   **First-impression layout:** `.pmgv3-right-placeholder` shows the empty-state intro, auto-hides on `body.pmg-has-result`. `.pmgv3-bottom` footer hidden on all viewports (markup preserved). `#goal` textarea is the single entry point.
*   **Image-mode is a chassis-v3 tab, not a global toggle (Task #140).** `window.setMode`, `#modeSwitch`, `#image-generate-btn`, `.image-mode-hint` are gone. To enter image mode: `window.pmgChassisV3.setActivePanel('photography')`. `body.image-mode` is still toggled because the relocated Photo Suite's CSS keys off it.
*   **Mobile accordions (≤768px):** Text panel `.tuning-section` collapsed behind `#tuning-mobile-toggle`; Photo Suite behind `#pmg-vs-photo-acc-toggle`. Toggling adds `is-mobile-open`.
*   **Storyboard concept source:** `getGoalText()` reads `#pmg-vs-video-goal` first, falls back to `#goal`. Empty → inline ⚠️, modal does NOT open.

### State persistence

*   **Session:** Idea + tuning + generated prompt → `sessionStorage['pmgv3:session']` (7-day TTL) via `wirePersistence()` in `pmg-chassis-v3.js`. **`sessionStorage` not `localStorage`** — survives backgrounding, clears on full tab close. `writeSession()` skips when goal AND prompt are both empty. Disable: `?fresh=1`, `localStorage.pmgv3_persist_disable='1'`.
*   **Tuning mirror (mux-1):** A small inline IIFE at the end of `app.html` mirrors `personality`, `tone`, `outputFormat`, `maxLength` to `localStorage` under `pmg-{field}` keys for cross-session restore. Server enum `TUNE_ENUMS.personality` in `routes/ai.ts` MUST match the `<select id="personality">` options or auto-tune silently clamps to "none".
*   **Draft Recovery (dr-1):** `writeSession()` also mirrors to `localStorage['pmgv3:draft']`. On boot, if sessionStorage is empty AND a fresh (<7d) draft exists, `wireDraftRecovery()` shows a floating Restore/Dismiss banner (id `pmg-draft-recovery`, has `data-pmg-overlay-root`). Restore mirrors back to sessionStorage THEN calls `restoreSession()`. Dismiss writes a 5-min cooldown. Auto-clears on `pmg:vault-saved`. Same kill-switches as session.

### Send-To / handoff

*   **Send to AI (silent + return-toast):** Gemini ignores `?q=`/`?text=`/`?prompt=`; ChatGPT and Claude honor `?q=`. UX: silent clipboard copy + open destination, NO launch toast. `armReturnToast()` shows "✓ Your prompt is still on your clipboard" only if user returns within 60s.
*   **Send-to buttons are ghost-style (mux-3).** `.pmgv3-send-grid` buttons are forced transparent w/ 1px subtle border, scoped under `html.pmg-chassis-v3` w/ `!important`. `.btn-run-primary` is the hero (teal glow); `.pmgv3-send-label` is muted 11px uppercase so it reads as a quiet handoff.

### Visual Studio (Photo/Video panels)

*   **Panel-scoped IDs:** `#pmg-vs-image-*` / `#pmg-vs-video-*` (goal/refined/generate-btn/copy etc.) — see `pmg-visual-studio.js`.
*   **Photo Suite relocation:** Legacy `#photo-suite-section` is moved into `#pmg-vs-photo-suite-container` by `relocatePhotoSuite()` (200ms poll, max 30 ticks). `body.image-mode` is the trigger CSS class.
*   **Live Preview + Advanced Tuning accordion (mux-2):** Both panels have a read-only `.pmg-vs-live-preview` under the goal textarea, fed by pure `assembleImagePrompt()`/`assembleVideoPrompt()`. Re-renders via `wireLivePreview()` — input/change listeners + a per-panel MutationObserver on `aria-pressed`/`data-pmgv3-base-style`/`class` (pill toggles flip aria-pressed via JS without firing `change`). All non-essential controls wrapped in `.pmg-vs-adv-tuning` accordion (collapsed by default). The top "✨ Generate" button does build → reveal → auto-call `generate*()` then hides; refined section's "🔄 Regenerate with edits" becomes the single CTA.
*   **Guided Intake (gi-1, gi-2):** `pmg-guided-intake.{js,css}` injects 4 labeled fields (Subject/Environment/Action/Style) above `#pmg-vs-image-goal`/`#pmg-vs-video-goal` w/ a "↻ Or write freeform instead" toggle. The legacy textarea remains source-of-truth — guided mode hides it and writes its `.value` from the assembled string. Mode persists per-panel in `localStorage['pmgv3:vs:intake-mode:image'|':video']` (default `'guided'`); **field values now persist in `sessionStorage['pmgv3:vs:intake:{panel}']`** (gi-2 — was localStorage, leaked content across full app close). One-time auto-migration on first read moves any legacy localStorage values into sessionStorage and removes the localStorage copy. Photo and Video have INDEPENDENT mode prefs. Disable: `?noguided`, `localStorage.pmg_guided_intake_disable='1'`.

### Overlays & one-off panels

*   **Business Mode is a header-icon drawer (bm-2),** not a tab. 💼 (`#pmgv3-business`) opens `#pmg-bm-drawer` + `#pmg-bm-overlay` (both `data-pmg-overlay-root`). Brand Voice → `localStorage['pmgv3:bm:brand']` `{audience, tone}`. Build Prompt fills `#goal` and `requestSubmit()`s `#prompt-form`. NO new backend routes. `brandSuffix()` reads LIVE drawer inputs (not localStorage) to avoid debounce race. API: `window.pmgBusinessMode.{open, close}`.
*   **Whisperer collapsed-by-default (mux-3).** `.pmgv3-whisperer-wrap` w/ `#pmgv3-whisperer-toggle` + `#pmgv3-whisperer-bar.is-collapsed[hidden]`. Wired by `wireWhispererToggle()`; open state → `localStorage['pmgv3:whisperer:open']`. `pmg-spark-panel.js` polls + wires Spark unconditionally — DOM nodes always exist.

### Backend-touching features

*   **Auto-Tune** (`POST /api/auto-tune`, JSON-mode, 250 tokens): hooked from chassis-v3 `wireActions()` Analyze handler. Server hard-clamps to `TUNE_ENUMS`. 12s abort, silent fallback. Disable: `?noautotune`, `localStorage.pmg_autotune_disable='1'`.
*   **Expert Mode = Chain-of-Thought (cot-1):** When `expertMode:true` is in the payload, `SYSTEM_PROMPT` (`routes/ai.ts` L133) instructs the building engine to tell the downstream AI to think step by step internally BEFORE writing the final answer (and BEFORE the "Top 3 next actions" closer), without exposing the scratch reasoning unless the goal asks for it. Backend-only — no UI change. To roll back: revert that one line in `SYSTEM_PROMPT` to its prior wording.
*   **Auto-Boost** (`pmg-auto-boost.{js,css}`): Two-step `POST /api/clarify` → optional Q&A card → `POST /api/boost`. Mounts in result panel actions row after `#copy-btn` (text), `#pmg-vs-image-copy` (photo), `#pmg-vs-video-copy` (video). Text variant hidden until result exists. On success force-sets strength to 100%. Disable: `?noautoboost`, `localStorage.pmg_autoboost_disable='1'`.
*   **Pricing waitlist** → `POST /api/waitlist` → Postgres `waitlist_signups` (Drizzle schema in `lib/db/src/schema/waitlist.ts`, unique on `email`). `onConflictDoNothing` returns `{ok:true, duplicate:true}` for resubmits. Frontend payload: `{email, source}` only. Abuse controls: (1) Cloudflare Turnstile, server-verified when `TURNSTILE_SECRET_KEY` set (skipped in local dev); site key via `/api/public-config` as `turnstileSiteKey`. (2) Per-IP rate limit (5/10min). (3) Emails NOT logged plaintext — only `emailFp` fingerprint. Query: `select * from waitlist_signups order by created_at desc`.
*   **Founding checkout (anonymous, purchase-first)** → `POST /api/founding-checkout` (no auth, rate-limited 5/10min/IP) → Stripe Checkout in `mode='payment'` with `customer_creation='always'`, metadata `{tier:'founding',flow:'anonymous'}`. Browser redirects to `/founding-success.html?session_id=...`. Stripe webhook (`stripe-webhook.ts` `handleCheckoutCompleted`) records the row in `founding_purchases` (Drizzle schema in `lib/db/src/schema/founding-purchases.ts`, UNIQUE on `stripe_session_id` for idempotent retries) THEN calls `supabaseAdmin.auth.admin.inviteUserByEmail` (new buyers, sends magic-link email + creates user) with fallback to `generateLink({type:'magiclink'})` (existing buyers). Bootstraps `profiles` row with `plan='founding'`, `subscription_status='lifetime'` linked to the new `auth.users` row. Magic-link send failures are LOGGED but NOT thrown — purchase is preserved, manual re-invite path is `select * from founding_purchases where supabase_user_id is null`. Authenticated `/api/create-checkout-session` for `tier=founding` flows through the same recording path (`flow:'authenticated'`).
*   **Founding seat enforcement** → `GET /api/founding-checkout/status` returns `{sold, limit, remaining, soldOut}` (15s cached, public). Both `POST /api/founding-checkout` AND `POST /api/create-checkout-session` (when `tier=founding`) pre-check `SELECT count(*) FROM founding_purchases < FOUNDING_LIMIT (500)` and return 409 `sold_out` when at cap. Fail-closed if the count query throws. Race window on the 500th seat is acceptable (operator manually refunds the rare overshoot via Stripe dashboard). Pricing-page CTA renders the live counter on load and disables the Buy button at 500. Sold-out copy redirects users to the Pro waitlist below.

### Self-contained UX scripts

Per-script gotchas (mount-bus, voice, command palette, cheatsheet, stats, text-feedback, coach, quick-chips, target-platform, magic-flow) live in [`docs/scripts.md`](./docs/scripts.md). Read that file before editing any `pmg-*.js` mounter or adding a new one. All listed scripts share the convention: `?nameKey` URL kill-switch + `localStorage.pmg_{name}_disable='1'` per-device kill-switch.

## Pointers

*   **Validation:** `validation` skill — `overflow-360` Playwright tests.
*   **OpenAPI:** `openapi.yaml`.
*   **Docs:** [Drizzle](https://orm.drizzle.team/docs/overview) · [Zod](https://zod.dev) · [Orval](https://orval.dev) · [Vite](https://vitejs.dev/guide/) · [Express](https://expressjs.com)
