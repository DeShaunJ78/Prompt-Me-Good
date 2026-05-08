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

*   **Monorepo:** pnpm workspaces · **Runtime:** Node.js v24 · **TypeScript:** v5.9
*   **API:** Express 5 · **ORM:** Drizzle · **Validation:** Zod, `drizzle-zod`
*   **API Codegen:** Orval · **Build:** Vite (frontend), esbuild (backend)

## Where things live

*   `artifacts/promptmegood/`: Frontend — `index.html` (marketing landing), `app.html` (workstation UI), plus `guide.html`, `manual.html`, `help.html`, `contact.html`, `pricing.html`, `privacy.html`, `terms.html`, `review.html`, `404.html`. Chassis v3 is the only chassis loaded.
*   `packages/api/`, `packages/db/`, `packages/shared/`: Backend services, schema, shared types.
*   `openapi.yaml`: API contracts.
*   `artifacts/promptmegood/public/styles/` + `public/scripts/`: Workstation runtime stylesheets and scripts.
    *   `pmg-g-theme.css` — G "Warm Dark Hybrid" override (theme tokens).
    *   `pmg-chassis-v3.{css,js}` — Workstation shell (definitive redesign).
    *   `pmg-visual-studio.{css,js}` — Inline Photo + Video panel mounters (Reverse Engine, Image Workshop, DNA Card, Sora video).
    *   `pmg-storyboard.{css,js}` — Storyboard Studio modal (text → 5-shot cinematic storyboard → handoff to Video panel).
    *   `pmg-auto-boost.{css,js}` — Per-panel ✨ Auto-Boost button.
    *   `pmg-ux.js` — Photo Suite GROUPS, presets, Surprise Me, demoteButtons, etc.
*   `artifacts/promptmegood/public/sitemap.xml` + `public/robots.txt`: SEO surface (AI crawlers explicitly allowed).
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test config.

## Architecture decisions

*   **Monorepo with pnpm:** Shared code, consistent dev.
*   **Three-panel inline architecture:** `data-active-panel="text|photography|video"` swaps which `#pmgv3-panel-*` is visible. No modals for panel switches.
*   **Client-side quick-win flow:** First-time onboarding uses sequential client-side API calls.
*   **Accessibility Guard:** Continuous check that interactive elements are clickable + visible.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions.
*   **Expert Command Center is paywalled** after `BETA_END`.
*   **G theme overlay:** Visual language layered via token+skin override stylesheet — no markup rewrites.
*   **Local-first state:** Vault, picks, theme, returning-user state live in `localStorage`; only AI-feature inputs leave the device.
*   **Light/dark mode is locked to dark:** `pmg-g-theme.css` lines 11–22 force the same dark teal palette for both `[data-theme="light"]` and `[data-theme="dark"]`. A real light mode would need a separate token set there.

## Product

*   **Three Panels:** Text Prompts · Photography · Video — inline switchers, shared canvas.
*   **Image Workshop:** Upload → 15 enhancement chips → gpt-image-1 enhance, PNG/SVG download.
*   **Reverse Engine:** Image → prompt via GPT-4o vision, pre-fills Photo Suite picks.
*   **Prompt DNA Card:** 1080×1350 share PNG (image + originating prompt).
*   **Storyboard:** 5-shot cinematic storyboard → Send to Video panel.
*   **Pro Tuning:** Photo + Video presets/boosts/modes; Money Mode for text.
*   **Auto-Boost / Auto-Tune:** One-click prompt rewrite + idea-driven pill auto-pick.
*   **Run With AI:** GPT-4o execution in-app.
*   **Prompt Vault:** Save, organize, compare, export/import.
*   **Brand Voice Profiles (Pro):** Customized AI tone.
*   **Voice Input:** Web Speech API.
*   **Expert Command Center (paid):** Diagnose · Engineer · Tune · Variations · Save.

## User preferences

I prefer concise and direct communication. Iterative dev — explain the high-level impact before diving into details. Ask before major architectural changes or new external dependencies.

## Gotchas

*   **Cache-busters (current):** `pmg-chassis-v3.css` `cv3-48-nav-reset`, `pmg-chassis-v3.js` `cv3-52-toast-visible`, `pmg-visual-studio.{css,js}` `vs-22-photo-accordion`, `pmg-storyboard.css` `sb-7`, `pmg-storyboard.js` `sb-9`, `pmg-auto-boost.css` `ab-4-ghost-send`, `pmg-auto-boost.js` `ab-3`, `pmg-ux.js` `cv3-39-photo-hints`, `pmg-send-to.js` `sendto-4-silent`. Brand assets `?v=5`. Bump only what changed.
*   **Send to AI platforms (silent + return-toast):** Verified in a real browser — `gemini.google.com/app` ignores `?q=`, `?text=`, `?prompt=`, and hash variants; ChatGPT and Claude DO honor `?q=`. UX: silent clipboard copy + open the destination — NO toast/banner on launch (logged-in users with working prefill never see a useless message). `armReturnToast()` arms a one-shot `visibilitychange` listener; if user returns to PMG within 60s (signal: prefill failed or they bounced), show a single toast "✓ Your prompt is still on your clipboard — paste it when you're ready." Applied in both `pmg-chassis-v3.js` `.btn-send-to` handler and `pmg-send-to.js` `sendToCore`. **Toast nodes MUST carry `data-pmg-overlay-root`** or the chassis `body > *:not(...)` universal-hide rule (CSS line 51) makes them invisible — `flash()` and `pmg-send-to.js`'s `toast()` both set this.
*   **Session persistence (cv3-49+):** Idea + tuning + generated prompt persist to `localStorage.pmgv3:session` (7-day TTL) via `wirePersistence()` in `pmg-chassis-v3.js`. Saves debounced 400ms on `#goal` input + tuning select changes + `#resultBox` MutationObserver + `visibilitychange`/`pagehide`/`beforeunload` (covers iOS Safari unloading the backgrounded tab when user opens Gemini). Restore on boot re-fills goal, dispatches `change` on selects, writes prompt back to `#resultBox`, reveals `#prompt-output-box` + `#run-with-ai-btn`, hides `#analyze-btn` (post-analyze surface). `doStartOver()` suspends persistence for 700ms and clears the session twice. `writeSession()` skips when both goal AND prompt are empty — default tuning alone is NOT user signal (otherwise pagehide on a freshly reset page re-writes junk). Disable hatches: `?fresh=1`, `localStorage.pmgv3_persist_disable='1'`.
*   **Empty-state action gating:** New post-result actions need IDs added to `EMPTY_BTN_IDS` in `app.html`'s `watchResultBox()`.
*   **Saved-To-Vault indicator:** Any code persisting to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Body-appended overlays:** Runtime overlays mounted directly under `<body>` need `data-pmg-overlay-root`.
*   **Adding new top-level HTML pages:** Register in `vite.config.ts` `rollupOptions.input` AND add to `public/sitemap.xml`.
*   **Guide vs Manual split:** `guide.html` = short orientation; `manual.html` = long-form reference. Cross-link both; `help.html` points to both.
*   **Route split (`/` vs `/app`):** `/` = marketing, `/app` = workstation. Landing auto-redirects returning users to `/app`; `?stay=1` bypasses.
*   **`?panel=X` deep-link:** `?panel=photography|video` on `/app.html` auto-switches to that panel after the chassis builds.
*   **Waitlist anchors:** `pricing.html` uses `#early-access`, `#founding-member-waitlist`, `#pro-early-access` for its single waitlist form.
*   **Topbar icon tap targets:** `.pmgv3-ico` is hard-set to 44×44 (all four dimensions, `!important`) on the base rule — no media-query gate. The ≤400px breakpoint shrinks only the glyph `font-size`. Don't reintroduce 32/36px overrides.
*   **No custom pull-to-refresh:** `pmg-pull-refresh.js` was removed (was hijacking touch events mid-scroll, wiping the textarea). Rely on the browser native. If re-added, gate on `e.touches[0].clientY === 0 && document.scrollingElement.scrollTop === 0` and hard-cancel on horizontal/downward movement.
*   **v3 Run with AI visibility:** `#prompt-output-box` ships with inline `style="display:none !important"`. The Generate handler force-reveals it via `setProperty('display','block','important')` (clearing inline `!important` via `style.display=''` is unreliable in some browsers) and explicitly unhides `#run-with-ai-btn`. CSS safety net: `body.pmg-has-result #run-with-ai-btn { display: block !important }`.
*   **Storyboard concept source:** `getGoalText()` reads `#pmg-vs-video-goal` first (Video panel — Storyboard launches from there), falls back to `#goal`. If both empty, click handler shows inline ⚠️ and does NOT open the modal. Don't reintroduce reading `#goal` first.
*   **Photography Suite mobile accordion (≤768px):** The dense Style/Camera/Lighting/Composition pill grid (relocated into `#pmg-vs-photo-suite-container`) is collapsed behind a "🎛️ Tune Your Image" toggle (`#pmg-vs-photo-acc-toggle`). Click flips `is-mobile-open` on the accordion section + `aria-expanded` on the button. Desktop default (>768px) hides the header and shows the suite always. Without this, the suite pushed `✨ Build My Image Prompt` far below the fold on 390px.
*   **Mobile tuning accordion (≤768px):** Text panel's `.tuning-section` is a tap-to-expand accordion with header `<button class="tuning-header" id="tuning-mobile-toggle">` + `.tuning-pick-count` badge (live-updated every 1.2s) + `.tuning-chevron`. Click toggles `is-mobile-open` on `#tuning-panel`. CSS hides `.pmgv3-tuning-host` (NOT `#settingsPanel` — avoids fighting inline `display:none`) and `.tuning-hint` when not open. Desktop unaffected. Analyze handler force-adds `is-mobile-open` on desktop / removes on mobile.
*   **Auto-Tune:** `POST /api/auto-tune` (`artifacts/api-server/src/routes/ai.ts` — `rateLimit`, JSON-mode, 250 max tokens) takes `{idea}` → `{picks:{category, skillLevel, tone, outputFormat, maxLength, outputLanguage, personality}}`. Server hard-clamps each value to `TUNE_ENUMS`. Frontend hook in chassis-v3 `wireActions()` calls `autoTuneFromIdea()` from the Analyze handler after revealing the tuning section: writes via `<select>.value = v; dispatchEvent('change')`. Pick-count badge briefly shows "AI tuning…". Disable hatches: `?noautotune`, `localStorage.pmg_autotune_disable='1'`. 12s abort timeout, silent fallback.
*   **Auto-Boost:** `pmg-auto-boost.{js,css}` mounts `✨ Auto-Boost Prompt/Brief` per panel — **text** mounts after `#pmgv3-strength-slot` (NOT after `#copy-btn`, which lives in `.actions-row` hidden by chassis-v3). Photo after `#pmg-vs-image-copy`, video after `#pmg-vs-video-copy`. Two-step server flow: `POST /api/clarify` → `{questions:[]}` (0–2, JSON-mode); if non-empty, renders inline `.pmg-ab-card` above the prompt with text inputs + "Got it, now boost"/"Skip, boost anyway"; then `POST /api/boost` with optional `answers` → `{result}`. Boost rewrites with explicit Role/Context/Constraints/Tone/Format (text), Style/Camera/Lens/Lighting/Composition/Palette (photo), Scene/Movement/Pacing (video). On success: writes back to the panel's refined output, force-sets strength to 100% via `#strength-score-pct=100` (chassis-v3 `mirrorStrength()` 1.5s tick keeps it pinned), updates `#strength-fill`/`#strength-status`/`#strength-score-badge`, pulses `#pmgv3-strength-slot`. Disable hatches: `?noautoboost`, `localStorage.pmg_autoboost_disable='1'`, `pmg_disable='1'`. Mount uses 200ms poll (≤30s) + MutationObserver.
*   **First-impression layout:** (1) `.pmgv3-right-placeholder` shows the empty-state intro card (3 numbered steps); auto-hides via `body.pmg-has-result`. (2) `.pmgv3-bottom` quick-entry footer is hidden across ALL viewports; markup preserved so `#quick-entry`/`#quick-entry-submit` handlers stay intact but visually gone. The main `#goal` textarea is the single entry point. (3) Mobile pill compaction (`.pmg-photo-pill`, `.pmg-pill`, `.pmg-vs-pill`): 32px min-height, 5px 10px padding, 12px font.

## Chassis v3 (definitive redesign)

*   **Shell:** Dark teal `#0d2b1e` bg, `#00c896` mint, 52px topbar + 44px module tabs (Text|Photography|Video) + 2-col body (1fr 1fr) + 64px bottom-bar quick-entry. v3 builds `#pmg-chassis-v3-root` then REPARENTS `#goal` (via `.field.field-primary`), `#settingsPanel`, `#generateBtn`, `#resultBox`, `#strength-score`, `#aiResponseSection` into v3 slots — `form="prompt-form"` set on relocated `#goal`/`#generateBtn` to preserve form-submit semantics. Universal hide `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses legacy DOM. `#generateBtnTop` (cloned by `pmg-ux.js`) is hidden by CSS AND scrubbed every 200ms (max 30 ticks). `GEN_LABEL` re-asserter writes `'✨ Generate My Prompt'` to `#generateBtn` every 800ms (other scripts overwrite to "Fix My Prompt"). Mirror legacy `#strength-score-pct` → spec `#strength-score-badge` on a 1500ms tick.
*   **Topbar buttons:** `❓` Help (`<a>` to `/guide.html` target=_blank) · 🗄️ Vault · ⚙️ Settings · `Upgrade` (→ `/pricing.html`). Vault opens a right-side drawer overlay (`#pmgv3-vault-drawer`) that reparents the legacy `#history` section into itself on first open — necessary because the chassis universal-hide rule otherwise hides the vault entirely. Settings (⚙️) opens the Expert Command Center via `window.PMGExpertCenter.requestOpen()` — the gear is the power-user entry point (Diagnose / Engineer / Tune / Variations / Save). Falls back to the in-flow `#settingsPanel` scroll+pulse if the Expert Center script hasn't loaded. The basic tuning accordion is still reachable via its own "🎛️ Tune Your Prompt" header, so the gear is reserved for the deeper surface.
*   **Form ownership:** `reparent()` step 0 moves `#prompt-form` into `<body>` and force-hides it. Visible inputs use `form="prompt-form"` to stay associated. The form's submit listener (`app.html` ~L8843) survives because the form element is preserved. Generate click handler calls `e.preventDefault()` then `form.requestSubmit()` because the reparented button is no longer a form descendant. A defensive MutationObserver re-rescues the form to body if any late-loading legacy script reparents it.

## Segmented panels

*   **Architecture:** `buildShell()` builds three siblings inside `.pmgv3-body`: `#pmgv3-panel-text`, `#pmgv3-panel-photo`, `#pmgv3-panel-video`. Body has `data-active-panel="text|photography|video"`; CSS hides inactive panels (`!important`). Tab clicks call `window.pmgChassisV3.setActivePanel(name)`. Each panel `display: grid; grid-template-columns: 1fr 1fr`, stacks at ≤768px. `pmg-visual-studio.js` exposes `window.mountVisualStudioPanels({photoLeft, photoRight, videoLeft, videoRight})` which v3 polls until ready then calls. `window.openVisualStudio({mode})` is a back-compat shim that just calls `setActivePanel(...)`.
*   **Panel-scoped IDs (avoid collisions):** `#pmg-vs-image-goal` / `#pmg-vs-video-goal`, `#pmg-vs-image-refined` / `#pmg-vs-video-refined`, `#pmg-vs-image-generate-btn` / `#pmg-vs-video-generate-btn`, `#pmg-vs-image-actions` / `#pmg-vs-video-actions`, `#pmg-vs-image-placeholder` / `#pmg-vs-video-placeholder`, `#pmg-vs-image-save` / `#pmg-vs-video-save`, `#pmg-vs-image-regen` / `#pmg-vs-video-regen`. Image-only: `#pmg-vs-reverse-engineer-btn`, `#pmg-vs-reverse-input`, `#pmg-vs-reverse-status`, `#pmg-vs-generated-image`, `#pmg-vs-download-dna`, `#pmg-vs-share-dna`. Video-only: `#pmg-vs-generated-video`. Reverse Engine POSTs `/api/vision-analyze`, pre-fills `#pmg-vs-image-goal`. Sora video POSTs `/api/video` with paywall fallback (upgrade card → `/pricing.html#founding-member-waitlist`).
*   **Photo Suite relocation:** Legacy `#photo-suite-section` / `#pmg-photo-suite` is moved into `#pmg-vs-photo-suite-container` inside the Photo panel by `relocatePhotoSuite()` (200ms poll, max 30 ticks).
*   **Storyboard mount:** `pmg-storyboard.js` `injectTrigger` only mounts into `#pmgv3-storyboard-mount` (Video panel left). `sendToVideoStudio` calls `setActivePanel('video')` then prefills `#pmg-vs-video-goal` 80ms later.

## Photo + Video features

*   **Image Workshop:** Photo panel left "🖼️ Image Workshop". Drop/upload JPG/PNG/WEBP ≤10MB, toggle 15 enhancement chips (Upscale, Color Pop, Cinematic Grade, Remove BG, Restore, Day↔Night, Vector Style, Anime, Oil, Watercolor, B&W Film, 35mm Grain, Studio Lighting, Clean BG, HDR), optional note → `POST /api/image-edit` (`ai.ts` ~L845, `openai.images.edit` `gpt-image-1`, reuses `imageLimiter` + `userCapEnforce("img", 1)`, shares daily image budget with `/api/image`). Returns `data:image/png;base64,…`. Frontend offers Download PNG + 🎨 Save as SVG (raster wrapped in SVG `<image>` — true raster-to-vector tracing intentionally NOT implemented). Generic `wireDropZone(zoneId, onFile)` wraps both `#pmg-vs-edit-dropzone` and `#pmg-vs-reverse-dropzone`. Chip directives concatenated under "preserve subject and composition" guardrail.
*   **Pro Tuning Layer:** Each panel has "⚡ Pro Tuning" with three sub-sections: Quick Start presets, Pro Boosts, Modes. Driven by `PHOTO_PRESETS/BOOSTS/MODES` + `VIDEO_PRESETS/BOOSTS/MODES` in `pmg-visual-studio.js`. Each boost/mode has a `directive` appended via `collectProDirectives(scope)` inside `buildImagePrompt`/`buildVideoPrompt`. Capture-phase delegation: `[data-vs-pro-boost]` toggles `aria-pressed`; `[data-vs-pro-preset]` invokes `applyPreset`; modes are native `<input type="checkbox" data-vs-pro-mode>`.
*   **Photo Suite + Sora pills:** `setActivePanel('photography')` toggles `body.image-mode` so the legacy Photo Suite renders inside `#pmgv3-panel-photo` (defensive CSS overrides legacy `[hidden]`/`is-collapsed`). Photo Suite GROUPS in `pmg-ux.js`: Style / Camera & Lens (subgroups Focal Length, Body, Aperture, Shutter, ISO, Film Stock — labels carry plain-language hints, e.g. "Aperture (Depth Of Field)") / Lighting & Mood / Composition / Camera Angle (10 angles) / Color Palette / Aspect. Quick Pick presets render as a tinted mint card. Below 768px all groups start collapsed. Sora video uses `.pmg-vs-pill[data-vs-sora-group][data-vs-sora-value]` with single-select groups: Shot Type / Camera Movement / Camera Angle / Mood & Lighting / Style / Focus / Easing / Duration / Resolution (config in `SORA_OPTIONS`, consumed by `buildVideoPrompt`). When extending: add to GROUPS AND to flat `pills` union so Surprise Me / applyPreset / refreshSummary keep working.

## Three signature features

*   **Reverse Engine** — `[📸 Reverse Engineer an Image]` below `#pmg-vs-image-goal`. POSTs image (jpg/png/webp ≤10MB) to `/api/vision-analyze` (gpt-4o vision). Returns `{prompt, suite_settings:{...}}`. Pre-fills image goal + best-effort programmatic-clicks Photo Suite pills.
*   **Prompt DNA Card** — `[🧬 DNA Card]` + `[↗ Share]` in post-generate row (image-only). Pure-frontend: composes 1080×1350 canvas (image 1080×1080 + prompt strip + brand stamp), PNG download. Web Share API hidden when `!navigator.share`. Image loaded `crossOrigin="anonymous"`; if tainted, falls back to brand-only card.
*   **Prompt Storyboard** — `[🎞️ Generate Storyboard]` mounts in Video panel left. POSTs to `/api/storyboard` (gpt-4o-mini, returns `{panels:[5 strings]}`), then fires up to 2 parallel `/api/image` calls. `[🎬 Send to Video Studio]` calls `setActivePanel('video')` + pre-fills `#pmg-vs-video-goal`. Modal `#pmg-storyboard-modal`; entry points `window.openStoryboard(concept)` and `[data-pmg-open-storyboard]`.

## Misc

*   **`demoteButtons()` excludes image generators:** `pmg-ux.js` `demoteButtons()` intentionally OMITS `image-generate-btn` and `imageBtn`.
*   **Result panel hide signal:** `body.pmg-has-result` to hide `#result-panel` until generation completes.

## Pointers

*   **Validation:** See `validation` skill for `overflow-360` playwright tests.
*   **OpenAPI:** `openapi.yaml` for endpoint details.
*   **Drizzle ORM:** https://orm.drizzle.team/docs/overview · **Zod:** https://zod.dev · **Orval:** https://orval.dev · **Vite:** https://vitejs.dev/guide/ · **Express:** https://expressjs.com
