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
    *   `pmg-adv-mirror.{css,js}` — Mirrors `<details id="advanced-options">` (Growth Mode / Human Voice / Clarity Boost) inside `#tuning-panel`. See **adv-mirror gotchas** below.
    *   `pmg-tune-chips.{css,js}` — "Prompt Tuning" pill in voice row → opens full `.tuning-section`. See **tune-chips gotchas** below.
*   `artifacts/promptmegood/public/sitemap.xml` + `robots.txt` — SEO surface (AI crawlers allowed).
*   `artifacts/promptmegood/playwright.config.ts` — Frontend test config.

## Architecture

*   **Three-panel inline architecture:** `body[data-active-panel="text|photography|video"]` swaps which `#pmgv3-panel-*` is visible. Tabs call `window.pmgChassisV3.setActivePanel(name)`. No modals for panel switches.
*   **Chassis v3 reparents legacy DOM** (`#goal`, `#settingsPanel`, `#generateBtn`, `#resultBox`) into v3 slots. Universal hide rule `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses everything outside the chassis root.
*   **Panel-scoped IDs:** `#pmg-vs-image-*` / `#pmg-vs-video-*` (goal/refined/generate-btn/copy) — see `pmg-visual-studio.js`.
*   **Photo Suite relocation:** Legacy `#photo-suite-section` moved into `#pmg-vs-photo-suite-container` by `relocatePhotoSuite()` (200ms poll, max 30 ticks). `body.image-mode` is the trigger CSS class — toggled by `setActivePanel('photography')`.
*   **Refresh = clean slate (refresh-clears-1):** True browser reload (F5/Cmd-R) wipes `sessionStorage['pmgv3:session']` AND `localStorage['pmgv3:draft']` BEFORE chassis-v3 boots, via inline IIFE in `app.html` `<head>`. Detection: `performance.getEntriesByType('navigation')[0].type === 'reload'`. Cold opens / back-forward / reopened tabs are NOT reloads. Disable: `localStorage.pmg_refresh_clears_disable='1'`.
*   **Local-first state:** Vault, picks, theme in `localStorage`; only AI-feature inputs leave the device.
*   **Light/dark locked to dark:** `pmg-g-theme.css` L11–22 forces dark teal for both `[data-theme]` values.
*   **Expert Command Center is paywalled** after `BETA_END`.

## Product

Three Panels (Text / Photography / Video) · Image Workshop (15 enhancement chips → `gpt-image-1`) · Reverse Engine (image → prompt via GPT-4o vision) · Prompt DNA Card (1080×1350 share PNG) · Storyboard (5-shot cinematic, send to Video panel) · Pro Tuning (presets/boosts/modes) · Auto-Boost / Auto-Tune · Run With AI (GPT-4o in-app) · Prompt Vault · Brand Voice Profiles (Pro) · Voice Input · Expert Command Center (paid).

## User preferences

Concise, direct communication. Iterative dev — explain high-level impact before details. Ask before major architectural changes or new external dependencies.

## Gotchas

### Universal rules (apply when adding ANY new code)

*   **Cache-busters:** Bump `?v=` query string on changed `pmg-*.{css,js}`. Brand assets `?v=5`. Current chassis CSS: `?v=cta-color-token-2-sendto-2line-mhdr2-stream2-clamp1-runstatus1-cv3-62-desktop-cap`.
*   **HTML never cached (ns-1):** `server.mjs` `cacheHeaderFor()` returns `no-store` for `.html` / directory roots / 404. Static assets under `/assets/`, `/scripts/`, `/images/`, `/fonts/` keep long cache headers.
*   **overflow-360 stale-spec ignore list (ov-1):** `playwright.config.ts` ignores 7 spec files (`handoff`, `photo-suite-handoff`, `photo-suite-mobile-polish`, `power-moves`, `replay-tour-dropdown`, `workstation-tour-mobile`, `share`) whose assertions reference DOM that has drifted. Static-page horizontal-overflow + scan-hidden coverage still runs. To rescue: remove from `STALE_OVERFLOW_360_SPECS`, run locally, update assertions. Don't add new specs without a comment.
*   **Theme tokens, never hardcoded teal.** Use `var(--color-primary, #3ee0a0)` / `var(--color-text-inverse)` / `color-mix(in srgb, var(--color-primary) X%, transparent)`. `html[data-accent="blue|purple|gold|slate"]` flips `--color-primary`.
*   **Body-appended overlays + toasts** must carry `data-pmg-overlay-root` or the chassis universal-hide rule erases them.
*   **Saved-To-Vault indicator:** Code persisting to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Empty-state action gating:** New post-result action buttons need IDs in `EMPTY_BTN_IDS` in `app.html`'s `watchResultBox()`.
*   **New top-level pages:** Register in `vite.config.ts` `rollupOptions.input` AND `public/sitemap.xml`.
*   **Tap targets:** Topbar icons (`.pmgv3-ico`) hard-set to 44×44 `!important`. ≤400px breakpoint shrinks only the glyph `font-size`.
*   **Panel tabs at ≤480px (mhdr-2):** 3 module tabs use `flex: 1 1 0` + `text-overflow: ellipsis` + `white-space: nowrap`. Don't reintroduce per-tab `min-width` or padding ≥10px — breaks 320px fit. Photography Suite at the same breakpoint has defensive `min-width:0` + `overflow-wrap:anywhere` + `transform:none` on `:hover`.
*   **No custom pull-to-refresh.** `pmg-pull-refresh.js` was removed (hijacked touch, wiped textarea). Rely on browser native.

### Architecture details

*   **Route split:** `/` = marketing (auto-redirects returning users to `/app`; `?stay=1` bypasses), `/app` = workstation. `?panel=photography|video` deep-links into a panel after chassis builds.
*   **First-impression layout:** `.pmgv3-right-placeholder` shows the empty-state intro, auto-hides on `body.pmg-has-result`. `.pmgv3-bottom` footer hidden on all viewports (markup preserved). `#goal` textarea is the single entry point.
*   **Image-mode is a chassis-v3 tab, not a global toggle (Task #140).** `window.setMode`, `#modeSwitch`, `#image-generate-btn`, `.image-mode-hint` are gone. Use `window.pmgChassisV3.setActivePanel('photography')`. `body.image-mode` still toggled because the relocated Photo Suite's CSS keys off it.
*   **Mobile accordions (≤768px):** Text panel `.tuning-section` collapsed behind `#tuning-mobile-toggle`; Photo Suite behind `#pmg-vs-photo-acc-toggle`. Toggling adds `is-mobile-open`.
*   **Storyboard concept source:** `getGoalText()` reads `#pmg-vs-video-goal` first, falls back to `#goal`. Empty → inline ⚠️, modal does NOT open.

### State persistence

*   **Session:** Idea + tuning + generated prompt → `sessionStorage['pmgv3:session']` (7-day TTL) via `wirePersistence()` in `pmg-chassis-v3.js`. `sessionStorage` not `localStorage` — survives backgrounding, clears on full tab close. `writeSession()` skips when goal AND prompt are both empty. Disable: `?fresh=1`, `localStorage.pmgv3_persist_disable='1'`.
*   **Tuning mirror (mux-1):** Inline IIFE at end of `app.html` mirrors `personality`, `tone`, `outputFormat`, `maxLength` to `localStorage` under `pmg-{field}` keys. Server enum `TUNE_ENUMS.personality` in `routes/ai.ts` MUST match the `<select id="personality">` options or auto-tune silently clamps to "none".
*   **Draft Recovery (dr-1):** `writeSession()` also mirrors to `localStorage['pmgv3:draft']`. On boot, if sessionStorage empty AND fresh (<7d) draft exists, `wireDraftRecovery()` shows a floating Restore/Dismiss banner (id `pmg-draft-recovery`, `data-pmg-overlay-root`). Auto-clears on `pmg:vault-saved`.

### Send-To / handoff

*   **Send to AI (silent + return-toast):** Gemini ignores `?q=`/`?text=`/`?prompt=`; ChatGPT and Claude honor `?q=`. Silent clipboard copy + open destination, NO launch toast. `armReturnToast()` shows "✓ Your prompt is still on your clipboard" only if user returns within 60s.
*   **Send-to buttons are ghost-style (mux-3).** `.pmgv3-send-grid` buttons are forced transparent w/ 1px subtle border, scoped under `html.pmg-chassis-v3` w/ `!important`. `.btn-run-primary` is the hero (teal glow); `.pmgv3-send-label` is muted 11px uppercase.

### Visual Studio (Photo/Video panels)

*   **Live Preview + Advanced Tuning accordion (mux-2):** Both panels have a read-only `.pmg-vs-live-preview` under the goal textarea, fed by `assembleImagePrompt()` / `assembleVideoPrompt()`. Re-renders via `wireLivePreview()` — input/change listeners + per-panel MutationObserver on `aria-pressed`/`data-pmgv3-base-style`/`class` (pill toggles flip aria-pressed via JS without firing `change`). All non-essential controls in `.pmg-vs-adv-tuning` accordion (collapsed by default). Top "✨ Generate" does build → reveal → auto-call `generate*()` then hides; refined section's "🔄 Regenerate with edits" becomes the single CTA.
*   **Guided Intake (gi-1, gi-2):** Mode persists per-panel in `localStorage['pmgv3:vs:intake-mode:{image|video}']` (default `'guided'`). Field values persist in `sessionStorage['pmgv3:vs:intake:{panel}']` (gi-2 — was localStorage, leaked content across full app close). One-time auto-migration on first read moves legacy localStorage values into sessionStorage. Disable: `?noguided`, `localStorage.pmg_guided_intake_disable='1'`.

### Adv-mirror gotchas (`pmg-adv-mirror.{css,js}`)

The adv-mirror panel mirrors `<details id="advanced-options">` (Growth Mode / Human Voice / Clarity Boost) into the tuning surface. Built up over 11 iterations — keep these invariants:

*   **Mount point:** LAST CHILD of `#pmgv3-epic-tuning`. Earlier sibling-insert (adv-mirror-2) was orphaned into `#prompt-form` by `pmg-ux.js`'s `reorderForm()`. Child-of-epic travels with epic-tuning's life cycle and self-heals if anything reparents it.
*   **No duplicate IDs:** Mirror toggles use their own IDs (`pmg-adv-mirror-{money,human,clarity}`). Bidirectional sync via change/input listeners + per-original MutationObserver on `checked`.
*   **Money Mode Pro mirroring (adv-mirror-4/-6/-7):** The MMPro panel (`#pmg-mmpro-panel` from `pmg-money-mode-pro.js`) is CLONED beneath the mirror's Growth Mode row as `#pmg-mmpro-panel-mirror` (all child IDs suffixed `-mirror`, `<label for>` / `aria-controls` rewritten). Both clone AND original are wrapped in collapsed sub-`<details>` (`#pmg-mmpro-mirror-collapse` + `#pmg-mmpro-orig-collapse`, summary "Show Pro options"). Auto-opens when `#moneyMode` is toggled on. **Original stays in its original spot inside `#settingsPanel` — never relocate it.** State is single-source on the original; clone is pure UI. MutationObserver on the original (subtree, attrs `class|checked|value`, childList, characterData) + capture-phase `change` listener mirrors UI updates back to the clone.
*   **Open-state persistence:** main mirror → `localStorage['pmg:advmirror:open']`; sub-collapses → `localStorage['pmg:advmirror:mmpro:{open|orig:open}']`.
*   **Smooth scroll-into-view (adv-mirror-8):** When any mirror `<details>` opens, page smoothly scrolls so element top sits ~14px below the sticky `.pmgv3-topbar` (52px). No-op when already comfortably positioned (24px tolerance). Walks ancestors via `pickScroller()` to find the real overflow container; `window` fallback. Two `requestAnimationFrame` ticks before measuring.
*   **Smart exit on close (adv-mirror-11):** Main mirror gear card snapshots all input/select/checkbox states on open; on close, compares. **Dirty** → clicks `#pmg-tune-done` (collapses Tuning + fires Build). **Clean** → smooth-scrolls back to `.tuning-section` header. Sub-collapses opt OUT of smart exit.
*   **Expert Command Center entry (adv-mirror-5):** `⚙ Open Expert Command Center` button (`#pmg-adv-mirror-ecc-open`) at bottom of mirror body — calls `window.PMGExpertCenter.requestOpen()` (paywall + warning gating handled internally). No ECC content is duplicated.
*   Disable: `?noadvmirror`, `localStorage.pmg_adv_mirror_disable='1'`.

### Tune-chips gotchas (`pmg-tune-chips.{css,js}`)

Single quiet "Prompt Tuning" pill, opens the full `.tuning-section`. Built up over 9 iterations:

*   **Mount strategy:** Try voice row (`.pmg-voice-row[data-pmg-voice-for="goal"]`) first; if pmg-voice hasn't mounted yet, drop a `.pmg-chip-row--single` fallback after `#goal`. Boot poller (10s) calls `relocateIntoVoiceRow()` every tick to upgrade and remove the empty fallback row.
*   **Hide-by-default rule:** `body.pmg-tune-chips-on:not(.pmg-tune-section-shown)` hides `.tuning-section`. Two MutationObservers enforce: (a) auto-open guard re-hides `#tuning-panel` if revealed without the body class (kills `restoreSession()` / Analyze auto-reveal); (b) panel-switch auto-close watches `.pmgv3-body[data-active-panel]` (NOT `document.body` — chassis writes the attribute on the inner `.pmgv3-body`) and closes when leaving Text panel.
*   **Desktop scroll math (tc-9l):** Unified with adv-mirror-8 — `pickTuneScroller()` walks ancestors for a real `overflow:auto/scroll` container with `scrollHeight > clientHeight`, then shifts by the delta to land header 14px below sticky topbar. Earlier per-container `scrollTop` math worked on mobile but landed wrong on desktop (chassis has its own inner scroller).
*   **Done bar (tc-9m):** `#pmg-tune-done` ("✓ Done — Build My Prompt") + `#pmg-tune-ecc-link` appended to bottom of `.tuning-section`. Done auto-fires `#generateBtn.click()` after 60ms tick (no second click needed). Bar uses `position: sticky; bottom: -16px` with backdrop blur so it's always visible regardless of internal scroll.
*   **Desktop right-column relocation (tc-9n):** On desktop (≥769px), opening Tune physically moves `#tuning-panel` into `.pmgv3-right` via `relocateTuningToRight()`. Body class `pmg-tune-desktop-right` then (a) hides everything else in the right column (`.pmgv3-right > *:not(#tuning-panel)`) so the section owns the right side, and (b) reorders the section's children via flex `order` so priority fields surface first: `.tuning-header` (0) → `#pmgv3-epic-tuning` (1, How Should AI Think? + Who is this for? + AOS mirror) → `.pmgv3-tuning-host` (2, dense pill grid) → `.pmg-tune-done-bar` (3). On close, `restoreTuningToLeft()` puts it back in its original parent before Build fires. Original parent + nextSibling are remembered on first open. matchMedia listener snaps section back/forth across the 768/769 breakpoint mid-session. Mobile is no-op.
*   **Build safety net + top CTA (tc-9o):** Two follow-ups so the right-column hide rule never strands a result. (1) `armBuildSafetyNet()` installs a capture-phase click listener on `#generateBtn` / `#image-generate-btn` / `.btn-run-primary` that calls `restoreTuningToLeft()` BEFORE the click handler runs — covers users who fire Build from the legacy left-column button instead of our Done bar. Excludes `#pmg-tune-done` / `#pmg-tune-done-top` (they already tear down via `closeFullTuningAndBuild`). (2) `MutationObserver` on `document.body` class — if `pmg-has-result` ever flips on while `pmg-tune-desktop-right` is still active, force a teardown so the result has a clean column to land in. Without these, clicking the legacy Build left placeholder + result + relocated tuning all visible at once ("right column became a huge mess"). Also injects a header-level `#pmg-tune-done-top` ("✓ Done — Build My Prompt") into `.tuning-header` so the obvious next-step CTA is at the TOP of the relocated section (the sticky-bottom Done bar can sit below the fold).
*   **Desktop section max-height (cv3-62):** `.tuning-section` cap relaxed to `calc(100vh - 120px)` on screens ≥769px (mobile keeps the 360px accordion cap). Worst-case (AOS + MMPro both expanded) bounds itself to viewport.
*   **Photo + Video ECC links:** Subtle `Open Expert Command Center` button appended into `#pmg-vs-image-adv-tuning-content` / `#pmg-vs-video-adv-tuning-content` (already collapsed accordions, so quiet entry without competing with their own CTAs).
*   Disable: `?nochips`, `localStorage.pmg_tune_chips_disable='1'`.

### Overlays & one-off panels

*   **Business Mode is a header-icon drawer (bm-2),** not a tab. 💼 (`#pmgv3-business`) opens `#pmg-bm-drawer` + `#pmg-bm-overlay` (both `data-pmg-overlay-root`). Brand Voice → `localStorage['pmgv3:bm:brand']` `{audience, tone}`. Build Prompt fills `#goal` and `requestSubmit()`s `#prompt-form`. `brandSuffix()` reads LIVE drawer inputs (not localStorage) to avoid debounce race. API: `window.pmgBusinessMode.{open, close}`.
*   **Whisperer collapsed-by-default (mux-3).** `.pmgv3-whisperer-wrap` w/ `#pmgv3-whisperer-toggle` + `#pmgv3-whisperer-bar.is-collapsed[hidden]`. State → `localStorage['pmgv3:whisperer:open']`. `pmg-spark-panel.js` polls + wires Spark unconditionally — DOM nodes always exist.

### Backend-touching features

*   **Auto-Tune** (`POST /api/auto-tune`, JSON-mode, 250 tokens): hooked from chassis-v3 `wireActions()` Analyze handler. Server hard-clamps to `TUNE_ENUMS`. 12s abort, silent fallback. Disable: `?noautotune`, `localStorage.pmg_autotune_disable='1'`.
*   **Expert Mode = Chain-of-Thought (cot-1):** When `expertMode:true` is in the payload, `SYSTEM_PROMPT` (`routes/ai.ts` L133) instructs the building engine to tell the downstream AI to think step by step internally before writing the final answer. Backend-only — no UI change.
*   **Auto-Boost** (`pmg-auto-boost.{js,css}`): Two-step `POST /api/clarify` → optional Q&A card → `POST /api/boost`. Mounts in result panel actions row after `#copy-btn` (text), `#pmg-vs-image-copy` (photo), `#pmg-vs-video-copy` (video). Text variant hidden until result exists. On success force-sets strength to 100%. Disable: `?noautoboost`, `localStorage.pmg_autoboost_disable='1'`.
*   **Pricing waitlist** → `POST /api/waitlist` → Postgres `waitlist_signups` (Drizzle schema in `lib/db/src/schema/waitlist.ts`, unique on `email`). `onConflictDoNothing` returns `{ok:true, duplicate:true}` for resubmits. Frontend payload: `{email, source}` only. Abuse controls: Cloudflare Turnstile (server-verified when `TURNSTILE_SECRET_KEY` set, skipped in local dev; site key via `/api/public-config`); per-IP rate limit (5/10min); emails NOT logged plaintext — only `emailFp` fingerprint.
*   **Founding checkout (anonymous, purchase-first)** → `POST /api/founding-checkout` (no auth, rate-limited 5/10min/IP) → Stripe Checkout `mode='payment'` with `customer_creation='always'`, metadata `{tier:'founding',flow:'anonymous'}`. Browser redirects to `/founding-success.html?session_id=...`. Webhook `handleCheckoutCompleted` records the row in `founding_purchases` (UNIQUE on `stripe_session_id` for idempotent retries) THEN calls `supabaseAdmin.auth.admin.inviteUserByEmail` (new buyers) with fallback to `generateLink({type:'magiclink'})` (existing). Bootstraps `profiles` row with `plan='founding'`, `subscription_status='lifetime'`. Magic-link send failures are LOGGED but NOT thrown — manual re-invite path is `select * from founding_purchases where supabase_user_id is null`. Authenticated `/api/create-checkout-session` for `tier=founding` flows through the same recording path.
*   **Founding seat enforcement** → `GET /api/founding-checkout/status` returns `{sold, limit, remaining, soldOut}` (15s cached, public). Both checkout endpoints pre-check `SELECT count(*) FROM founding_purchases < FOUNDING_LIMIT (500)` and return 409 `sold_out` when at cap. Fail-closed if count throws. Race window on the 500th seat is acceptable (manual refund). Pricing-page CTA renders the live counter and disables Buy at 500.

### Self-contained UX scripts

Per-script gotchas (mount-bus, voice, command palette, cheatsheet, stats, text-feedback, coach, quick-chips, target-platform, magic-flow) live in [`docs/scripts.md`](./docs/scripts.md). Read that file before editing any `pmg-*.js` mounter or adding a new one. All listed scripts share: `?nameKey` URL kill-switch + `localStorage.pmg_{name}_disable='1'`.

## Pointers

*   **Validation:** `validation` skill — `overflow-360` Playwright tests.
*   **OpenAPI:** `openapi.yaml`.
*   **Docs:** [Drizzle](https://orm.drizzle.team/docs/overview) · [Zod](https://zod.dev) · [Orval](https://orval.dev) · [Vite](https://vitejs.dev/guide/) · [Express](https://expressjs.com)
