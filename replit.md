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

*   `artifacts/promptmegood/`: Frontend — `index.html` (marketing landing), `app.html` (workstation UI), `guide.html`, `manual.html`, `help.html`, `contact.html`, `pricing.html`, `privacy.html`, `terms.html`, `review.html`, `404.html`. Chassis v3 is the only chassis loaded.
*   `packages/api/`: Backend API services.
*   `packages/db/`: Database schema and migrations.
*   `packages/shared/`: Shared utilities and types.
*   `openapi.yaml`: OpenAPI Specification (API contracts).
*   `artifacts/promptmegood/src/styles/`: Theme files (CSS variables).
*   `artifacts/promptmegood/public/styles/pmg-g-theme.css`: G "Warm Dark Hybrid" override stylesheet.
*   `artifacts/promptmegood/public/styles/pmg-chassis-v3.css` + `public/scripts/pmg-chassis-v3.js`: Workstation chassis layout and styling (definitive redesign).
*   `artifacts/promptmegood/public/styles/pmg-visual-studio.css` + `public/scripts/pmg-visual-studio.js`: Inline Photo + Video panel mounters (Reverse Engine, Image Workshop, DNA Card, Sora video).
*   `artifacts/promptmegood/public/styles/pmg-storyboard.css` + `public/scripts/pmg-storyboard.js`: Storyboard Studio modal (text → 5-shot cinematic storyboard → handoff to Video panel).
*   `artifacts/promptmegood/public/sitemap.xml` + `public/robots.txt`: SEO surface (lastmod 2026-05-08; AI crawlers explicitly allowed).
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test configuration.

## Architecture decisions

*   **Monorepo with pnpm:** Facilitates shared code and consistent development.
*   **Three-panel inline architecture:** `data-active-panel="text|photography|video"` swaps which `#pmgv3-panel-*` is visible. No modals.
*   **Client-side quick-win flow:** First-time user onboarding uses sequential client-side API calls for immediate engagement.
*   **Accessibility Guard:** Global, continuous accessibility check ensures interactive elements are clickable and visible.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions for a focused first-prompt experience.
*   **Expert Command Center as Paid Feature:** Advanced prompt engineering tools are paywalled after beta.
*   **G theme overlay:** Visual language is layered via a token+skin override stylesheet without markup rewrites.
*   **Local-first state:** Vault, picks, theme, and returning-user state live in browser localStorage; only AI-feature inputs leave the device.

## Product

*   **AI Prompt Builder:** Craft effective prompts with smart suggestions, auto-optimization, and quality checks.
*   **Three Panels:** Text Prompts · Photography · Video — inline panel switchers, all share the same canvas.
*   **Image Workshop:** Upload → 15 enhancement chips → gpt-image-1 enhance, with PNG/SVG download.
*   **Reverse Engine:** Image-to-prompt via GPT-4o vision; pre-fills Photo Suite picks.
*   **Prompt DNA Card:** 1080×1350 share PNG pairing image with the prompt that made it.
*   **Storyboard:** 5-shot cinematic storyboard generator → Send to Video panel.
*   **Pro Tuning:** Photo + Video presets/boosts/modes; Money Mode for text.
*   **Run With AI:** GPT-4o execution in-app.
*   **Prompt Vault:** Save, organize, compare, export/import.
*   **Brand Voice Profiles (Pro):** Customize AI responses with specific brand voices.
*   **Voice Input:** Web Speech API for prompt input with language selection.
*   **Expert Command Center (paid):** Diagnose · Engineer · Tune · Variations · Save.

## User preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

## Gotchas

*   **Cache-buster:** `pmg-auto-boost.css` + `pmg-auto-boost.js` at `ab-2`. `pmg-chassis-v3.css` at `cv3-35`, `pmg-chassis-v3.js` at `cv3-34`. `pmg-visual-studio.css` + `pmg-visual-studio.js` at `vs-20-image-workshop`; `pmg-storyboard.css` at `sb-7`, `pmg-storyboard.js` at `sb-8`. `pmg-ux.js` at `cv3-28-camera-angle`. Brand assets (`pmg-logo.png`, `favicon-32.png`, `favicon-48.png`) use `?v=5`.
*   **Accessibility State:** Verify `inert`/`aria-hidden` states after DOM manipulations.
*   **Quick Win Overlay:** Ensure `html.pmg-qw-pending` is applied via inline script for first-time users.
*   **Expert Command Center Gating:** Expert Mode becomes a paid feature after `BETA_END`; ensure UI reflects this.
*   **Empty-state action gating:** New post-result actions need IDs added to `EMPTY_BTN_IDS` in `index.html`'s `watchResultBox()`.
*   **Saved-To-Vault indicator:** Any code persisting a prompt to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Body-appended overlays:** New runtime overlays mounted directly under `<body>` must have `data-pmg-overlay-root`.
*   **Waitlist anchors:** `pricing.html` uses three IDs (`#early-access`, `#founding-member-waitlist`, `#pro-early-access`) for its single waitlist form.
*   **Adding new top-level HTML pages:** Register new HTML files in `artifacts/promptmegood/vite.config.ts` `rollupOptions.input` AND add to `public/sitemap.xml`.
*   **Guide vs Manual split:** `guide.html` is the short orientation; `manual.html` is the long-form reference. Cross-link both and keep `help.html` pointing to both.
*   **Route split (`/` vs `/app`):** `/` is marketing landing, `/app` is workstation. Landing auto-redirects returning users to `/app`; use `?stay=1` to bypass.
*   **`?panel=X` deep-link:** `?panel=photography` or `?panel=video` on `/app.html` auto-switches to that panel after the chassis builds. Useful for tests, screenshots, and bookmarkable links.
*   **No custom pull-to-refresh:** `pmg-pull-refresh.js` was removed (was hijacking touch events mid-scroll, triggering false reloads that wiped the textarea). Rely on the browser's native pull-to-refresh. If a custom one is ever re-added, gate it on `e.touches[0].clientY === 0 && document.scrollingElement.scrollTop === 0` and hard-cancel as soon as the user moves horizontally or downward.
*   **Topbar icon tap targets:** `.pmgv3-ico` is hard-set to 44×44 (width, height, min-width, min-height — all `!important`) on the base rule, no media-query gate. The ≤400px breakpoint only shrinks the glyph `font-size` to 14px; box stays 44×44. Don't reintroduce `width: 32px` or `width: 36px` overrides.
*   **v3 Run with AI visibility:** `#prompt-output-box` is rendered with inline `style="display:none !important"`. The Generate click handler force-reveals it via `setProperty('display','block','important')` (clearing inline `!important` via `style.display=''` is unreliable in some browsers) and also explicitly unhides `#run-with-ai-btn`. CSS safety net `body.pmg-has-result #run-with-ai-btn { display: block !important }` defends against any legacy script that re-stamps `display:none`.
*   **Auto-Tune (cv3-31, audit 2.1):** New `POST /api/auto-tune` endpoint (`artifacts/api-server/src/routes/ai.ts` — uses `rateLimit`, JSON-mode, 250 max tokens) takes `{idea: string}` and returns `{picks: {category, skillLevel, tone, outputFormat, maxLength, outputLanguage, personality}}`. Server hard-clamps each value to a server-side `TUNE_ENUMS` constant — guards against the model going off-script and against arbitrary string injection downstream. Frontend hook in chassis-v3 `wireActions()` calls `autoTuneFromIdea()` from the Analyze handler immediately after revealing the tuning section: writes returned values via `<select>.value = v; dispatchEvent('change')` so the existing pill sync repaints. Pick-count badge briefly shows "AI tuning…" while in flight. Disable hatches: `?noautotune` query param, `localStorage.pmg_autotune_disable='1'`. 12s abort timeout, silent fallback. User can still hit Generate without ever touching pills (audit goal: "make 7 micro-decisions optional, not required").
*   **Mobile tuning accordion (cv3-30):** Audit 3.1 — text panel's `.tuning-section` is now a tap-to-expand accordion below 768px so Generate stays above the fold on a 390px viewport. The header is rendered as a `<button class="tuning-header" id="tuning-mobile-toggle">` containing title + `.tuning-pick-count` badge (live-updated every 1.2s, counts `.pmg-tune-pill.is-active`/`.pmg-pill.is-active`) + `.tuning-chevron`. Click toggles `is-mobile-open` on `#tuning-panel`; CSS hides `.pmgv3-tuning-host` (not `#settingsPanel` directly — avoids fighting inline `display: none`) and `.tuning-hint` when not open. Desktop unaffected: chevron `display: none`, header has `cursor: default`, section is always open. Analyze handler force-adds `is-mobile-open` on desktop / removes on mobile.
*   **First-impression cleanup (cv3-29):** (1) `.pmgv3-right-placeholder` (built into the text panel right column) shows "Your engineered prompt will appear here" intro card with 3 numbered steps. Auto-hides via `body.pmg-has-result`. (2) `.pmgv3-bottom` quick-entry footer is hidden across ALL viewports (was desktop-only); the markup is preserved so existing `#quick-entry`/`#quick-entry-submit` handlers remain intact but visually gone. The main `#goal` textarea is the single, unambiguous entry point. (3) Mobile pill compaction extended to `.pmg-photo-pill`, `.pmg-pill`, and `.pmg-vs-pill` (32px min-height, 5px 10px padding, 12px font) so Photography Suite + Sora groups don't tower past the fold on 390px.
*   **Auto-Boost (ab-2):** `pmg-auto-boost.{js,css}` mounts a `✨ Auto-Boost Prompt/Brief` button into each suite — **text** mounts directly **after `#pmgv3-strength-slot`** (the v3 strength bar, visible) instead of after `#copy-btn` (which lives in `.actions-row`, hidden by chassis-v3 — caused the button to render but be invisible in v3). Photo mounts after `#pmg-vs-image-copy`, video after `#pmg-vs-video-copy`. Two-step server flow: `POST /api/clarify` → `{questions:[]}` (0–2, JSON-mode); if non-empty, renders an inline `.pmg-ab-card` above the prompt with text inputs + "Got it, now boost" / "Skip, boost anyway"; then `POST /api/boost` with optional `answers` map → `{result}`. Boost rewrites with explicit Role/Context/Constraints/Tone/Format (text), Style/Camera/Lens/Lighting/Composition/Palette (photo), or Scene/Movement/Pacing (video). On success: writes back to `#resultBox` / `#pmg-vs-image-refined` / `#pmg-vs-video-refined`, force-sets strength to 100% via `#strength-score-pct=100` (so chassis-v3 `mirrorStrength()` 1.5s tick keeps it pinned), updates `#strength-fill`/`#strength-status`/`#strength-score-badge` directly, and pulses `#pmgv3-strength-slot`. Same file also restyles `.pmg-send-to-shell .pmg-send-to-main-btn`/`.pmg-send-to-caret-btn` to bright mint gradient. Disable hatches: `?noautoboost`, `localStorage.pmg_autoboost_disable='1'`, or global `pmg_disable='1'`. Mount uses 200ms poll (≤30s) + MutationObserver to catch late-mounted visual-studio panels.
*   **Light/dark mode is intentionally locked to dark:** The G theme overlay (`pmg-g-theme.css` lines 11-22) forces the same dark teal palette for both `[data-theme="light"]` and `[data-theme="dark"]`. Any future "real light mode" requires a separate token set in that overlay.

### Chassis v3 (definitive redesign)

*   **Shell:** `pmg-chassis-v3.{css,js}` implements dark teal #0d2b1e bg, #00c896 mint, 52px topbar + 44px module tabs (Text|Photography|Video) + 2-col body (1fr 1fr) + 64px bottom-bar quick-entry. v3 builds `#pmg-chassis-v3-root` then REPARENTS `#goal` (via `.field.field-primary`), `#settingsPanel`, `#generateBtn`, `#resultBox`, `#strength-score`, `#aiResponseSection` into v3 slots — `form="prompt-form"` attribute is set on relocated `#goal`/`#generateBtn` to preserve form-submit semantics. Universal hide `body > *:not(#pmg-chassis-v3-root):not(script)…` suppresses the legacy DOM. `#generateBtnTop` (cloned by `pmg-ux.js`) is hidden by CSS AND scrubbed every 200ms (max 30 ticks). GEN_LABEL re-asserter writes `'✨ Generate My Prompt'` to #generateBtn every 800ms (other scripts overwrite to "Fix My Prompt"). Mirror legacy `#strength-score-pct` → spec `#strength-score-badge` on a 1500ms tick.
*   **Form ownership:** `reparent()` step 0 moves `#prompt-form` from its native legacy DOM location into `<body>` and force-hides it (`display: none !important`). Visible inputs use the HTML5 `form="prompt-form"` attribute to stay associated. The form's submit listener (bound at app.html ~L8843) survives because the form element itself is preserved. Generate button click handler calls `e.preventDefault()` then `form.requestSubmit()` because the reparented button is no longer a form descendant. A defensive MutationObserver re-rescues the form to body if any late-loading legacy script reparents it.

### Segmented panels (cv3-24 / vs-15 / sb-8)

*   **Panel architecture:** `buildShell()` builds three siblings inside `.pmgv3-body`: `#pmgv3-panel-text` (existing text workstation), `#pmgv3-panel-photo` (image goal + Reverse Engine + Photography Suite + Build Image Prompt + refined output + Generate + image surface + Save / 🧬 DNA Card / Share / Regenerate), `#pmgv3-panel-video` (video goal + Sora tuning grid + Storyboard launcher + Build Video Prompt + refined output + Generate + video surface + Save / Regenerate). The body has `data-active-panel="text|photography|video"` and CSS hides the inactive panels (`!important`). Tab clicks call `window.pmgChassisV3.setActivePanel(name)`. Each panel uses `display: grid; grid-template-columns: 1fr 1fr` and stacks at ≤768px. `pmg-visual-studio.js` exposes `window.mountVisualStudioPanels({photoLeft, photoRight, videoLeft, videoRight})` which v3 polls until ready then calls. `window.openVisualStudio({mode})` is kept as a back-compat shim that just calls `setActivePanel(mode === 'video' ? 'video' : 'photography')`.
*   **Panel-scoped IDs:** Image and video panels each have their own scoped IDs to avoid collisions: `#pmg-vs-image-goal` / `#pmg-vs-video-goal`, `#pmg-vs-image-refined` / `#pmg-vs-video-refined`, `#pmg-vs-image-generate-btn` / `#pmg-vs-video-generate-btn`, `#pmg-vs-image-actions` / `#pmg-vs-video-actions`, `#pmg-vs-image-placeholder` / `#pmg-vs-video-placeholder`, `#pmg-vs-image-save` / `#pmg-vs-video-save`, `#pmg-vs-image-regen` / `#pmg-vs-video-regen`. Singular shared image-only buttons: `#pmg-vs-reverse-engineer-btn`, `#pmg-vs-reverse-input`, `#pmg-vs-reverse-status`, `#pmg-vs-generated-image`, `#pmg-vs-generated-video`, `#pmg-vs-download-dna`, `#pmg-vs-share-dna`. Reverse Engine POSTs to `/api/vision-analyze` and pre-fills `#pmg-vs-image-goal`. DNA Card composes a 1080×1350 canvas from `#pmg-vs-generated-image` + `#pmg-vs-image-refined`. Sora video POSTs to `/api/video` with paywall fallback (renders an upgrade card linking to `/pricing.html#founding-member-waitlist`).
*   **Photography Suite relocation:** The legacy `#photo-suite-section` / `#pmg-photo-suite` is **moved into** `#pmg-vs-photo-suite-container` inside the Photo panel by `relocatePhotoSuite()`. Polled every 200ms (max 30 ticks) from chassis-v3 boot to catch late-loading suite mounts.
*   **Storyboard mount:** `pmg-storyboard.js` `injectTrigger` only mounts into `#pmgv3-storyboard-mount` (inside Video panel left) — if the slot doesn't exist yet it returns and waits for the search observer to retry. `sendToVideoStudio` calls `window.pmgChassisV3.setActivePanel('video')` then prefills `#pmg-vs-video-goal` 80ms later.

### Photo + Video features

*   **Image Workshop (vs-20):** Photo panel left column "🖼️ Image Workshop". Drop/upload JPG/PNG/WEBP ≤10MB, toggle 15 enhancement chips (Upscale, Color Pop, Cinematic Grade, Remove BG, Restore, Day↔Night, Vector Style, Anime, Oil, Watercolor, B&W Film, 35mm Grain, Studio Lighting, Clean BG, HDR), optional free-form note, then `POST /api/image-edit` (`ai.ts` ~L845 — `openai.images.edit` with `gpt-image-1`, reuses `imageLimiter` + `userCapEnforce("img", 1)`, shares daily image budget with `/api/image`). Returns `data:image/png;base64,…`. Frontend offers Download PNG + 🎨 Save as SVG (wraps raster in SVG `<image>` — true raster-to-vector tracing is intentionally NOT implemented). Generic `wireDropZone(zoneId, onFile)` helper wraps both `#pmg-vs-edit-dropzone` AND `#pmg-vs-reverse-dropzone`. Chip directives concatenated under "preserve subject and composition" guardrail.
*   **Pro Tuning Layer (vs-17):** Each panel has "⚡ Pro Tuning" with three sub-sections: Quick Start presets (one-click bundles), Pro Boosts (toggle enhancers), Modes (checkbox switches). Driven by `PHOTO_PRESETS/BOOSTS/MODES` + `VIDEO_PRESETS/BOOSTS/MODES` in `pmg-visual-studio.js`. Each boost/mode has a `directive` string appended via `collectProDirectives(scope)` inside `buildImagePrompt`/`buildVideoPrompt`. Click handlers (capture-phase delegation): `[data-vs-pro-boost]` toggles `aria-pressed`; `[data-vs-pro-preset]` invokes `applyPreset`; modes use native `<input type="checkbox" data-vs-pro-mode>`.
*   **Photography Suite + Sora pills (cv3-25 to cv3-28, vs-16 to vs-19):** `setActivePanel('photography')` toggles `body.image-mode` so the legacy Photo Suite renders inside `#pmgv3-panel-photo` (defensive CSS in `pmg-chassis-v3.css` overrides legacy `[hidden]`/`is-collapsed`). Photo Suite GROUPS in `pmg-ux.js`: Style / Camera & Lens (with subgroups for Focal Length, Body, Aperture, Shutter, ISO, Film Stock) / Lighting & Mood / Composition / Camera Angle (10 angles) / Color Palette / Aspect. Quick Pick presets render as a tinted mint card. Below 768px, all groups start collapsed. Sora video uses `.pmg-vs-pill[data-vs-sora-group][data-vs-sora-value]` with single-select groups: Shot Type / Camera Movement / Camera Angle / Mood & Lighting / Style / Focus / Easing / Duration / Resolution (config in `SORA_OPTIONS`; consumed by `buildVideoPrompt`). When extending: add to GROUPS and to flat `pills` union so Surprise Me / applyPreset / refreshSummary keep working.

### Three signature features (vs-2 / sb-1)

*   **Reverse Engine** — `[📸 Reverse Engineer an Image]` below `#pmg-vs-image-goal`. POSTs image (jpg/png/webp ≤10MB) to `/api/vision-analyze` (gpt-4o vision). Returns `{prompt, suite_settings:{...}}`. Pre-fills image goal + best-effort programmatic-clicks Photo Suite pills.
*   **Prompt DNA Card** — `[🧬 DNA Card]` + `[↗ Share]` in post-generate row (image-only). Pure-frontend: composes 1080×1350 canvas (image 1080×1080 + prompt strip + brand stamp), PNG download. Web Share API hidden when `!navigator.share`. Image loaded `crossOrigin="anonymous"`; if tainted, falls back to brand-only card.
*   **Prompt Storyboard** — `[🎞️ Generate Storyboard]` mounts in Video panel left. POSTs to `/api/storyboard` (gpt-4o-mini, returns `{panels:[5 strings]}`), then fires up to 2 parallel `/api/image` calls. `[🎬 Send to Video Studio]` calls `setActivePanel('video')` + pre-fills `#pmg-vs-video-goal`. Modal `#pmg-storyboard-modal`; entry points `window.openStoryboard(concept)` and `[data-pmg-open-storyboard]`.

### Misc still-relevant

*   **`demoteButtons()` excludes image generators:** `pmg-ux.js` `demoteButtons()` intentionally OMITS `image-generate-btn` and `imageBtn`.
*   **Result panel hide signal:** Use `body.pmg-has-result` to hide `#result-panel` until generation completes.

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)
