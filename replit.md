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
*   `artifacts/promptmegood/index.html`: Marketing landing page.
*   `artifacts/promptmegood/app.html`: The main workstation UI, served at `/app`.
*   `artifacts/promptmegood/guide.html`: Concise 60-second Quick Guide (links to manual).
*   `artifacts/promptmegood/manual.html`: Detailed step-by-step user manual (TOC + 13 sections).
*   `artifacts/promptmegood/help.html`: Lightweight help splash that links to both guide and manual.
*   `artifacts/promptmegood/contact.html`: Email-routing contact page (linked from every footer).
*   `packages/api/`: Backend API services.
*   `packages/db/`: Database schema and migrations.
*   `packages/shared/`: Shared utilities and types.
*   `openapi.yaml`: OpenAPI Specification (API contracts).
*   `artifacts/promptmegood/src/styles/`: Theme files (CSS variables).
*   `artifacts/promptmegood/public/styles/pmg-g-theme.css`: G "Warm Dark Hybrid" override stylesheet.
*   `artifacts/promptmegood/public/styles/pmg-chassis-v2.css` + `public/scripts/pmg-chassis-v2.js`: Workstation chassis layout and styling, including mobile adaptations.
*   `artifacts/promptmegood/404.html`: Branded not-found page.
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test configuration.

## Architecture decisions

*   **Monorepo with pnpm:** Facilitates shared code and consistent development across frontend and backend.
*   **Client-side quick-win flow:** First-time user onboarding leverages sequential client-side API calls for immediate engagement.
*   **Accessibility Guard:** A global, continuous accessibility check ensures interactive elements are clickable and visible.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions to provide a focused first-prompt experience.
*   **Expert Command Center as Paid Feature:** Advanced prompt engineering tools are paywalled after beta.
*   **G theme overlay (Brand Teal):** Visual language is layered via a token+skin override stylesheet without markup rewrites.
*   **Accent picker shared across legacy + chassis:** Both legacy and chassis accent pickers write to the same `localStorage` key, ensuring sync.

## Product

*   **AI Prompt Builder:** Craft effective prompts with smart suggestions, auto-optimization, and quality checks.
*   **Quick Win Mode:** Streamlined onboarding for first-time users.
*   **Expert Command Center:** Advanced tools for prompt diagnosis, engineering, and workflow saving (paid feature).
*   **Image Generation:** Generate image prompts with aspect ratio controls and style variations.
*   **Run With AI:** Integrate directly with `gpt-4o` for immediate prompt execution.
*   **Prompt Vault:** Save, organize, and compare prompts with tagging and filtering.
*   **Command Palette (⌘K):** Global search and execution for commands, modes, and vault items.
*   **Brand Voice Profiles (Pro):** Customize AI responses with specific brand voices.
*   **Voice Input:** Utilize Web Speech API for prompt input with language selection.

## User preferences

I prefer concise and direct communication. When making changes, prioritize iterative development and explain the high-level impact before diving into details. Please ask for confirmation before making any major architectural changes or introducing new external dependencies.

## Gotchas

*   **Accessibility State:** Always verify `inert`/`aria-hidden` states, especially after complex DOM manipulations.
*   **Quick Win Overlay:** Ensure `html.pmg-qw-pending` is applied correctly via inline script for first-time users.
*   **Expert Command Center Gating:** Expert Mode becomes a paid feature after `BETA_END`; ensure UI reflects this.
*   **Empty-state action gating:** New post-result actions must have their IDs added to `EMPTY_BTN_IDS` in `index.html`'s `watchResultBox()` to be correctly disabled.
*   **Saved-To-Vault indicator:** Any code path persisting a prompt to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))` for the user to receive confirmation.
*   **Body-appended overlays:** New runtime overlays mounted directly under `<body>` must have `data-pmg-overlay-root` to be visible, as `pmg-chassis-v2.css` hides most direct `body >` children.
*   **Waitlist anchors:** `pricing.html` uses three IDs (`#early-access`, `#founding-member-waitlist`, `#pro-early-access`) for its single waitlist form; CTAs link to tier-specific anchors.
*   **Adding new top-level HTML pages:** Register new HTML files in `artifacts/promptmegood/vite.config.ts` `rollupOptions.input` for proper build output.
*   **Guide vs Manual split:** `guide.html` is the short orientation; `manual.html` is the long-form reference. Cross-link both whenever changing nav, and keep `help.html` pointing to both.
*   **Route split (`/` vs `/app`):** `/` serves the marketing landing, while `/app` serves the workstation. The landing page auto-redirects returning users to `/app`; use `?stay=1` to bypass this during testing. Do not rename `app.html` to `index.html`.
*   **Chassis rail card wrapping:** Vault `.history-list` / `.templates-grid` are forced to a single 1fr column inside `html.pmg-chassis-v2 .pmgv2-rail` (overriding legacy `minmax(240px,1fr)`); card descendants get `overflow-wrap: anywhere` to prevent horizontal overflow. Buttons/SVGs/`.template-card-delete` are excluded from the wrap rule.
*   **Cache-buster:** Bump `?v=cv2-N` on both `pmg-chassis-v2.css` and `pmg-chassis-v2.js` script/link tags in `app.html` whenever you change either file. Currently `cv2-15`.
*   **Composer is sticky-BOTTOM, not sticky-top (cv2-15):** `.pmgv2-composer-wrap` uses `position: sticky; bottom: 0` (desktop) and `bottom: 56px` (mobile, above the 56px fixed dock). Sticky-top was wrong because the composer is the LAST child of the column — sticky-top only engages once the user scrolls DOWN past it, so after a generation pushed Result panel + Run This Prompt above it, the composer sat below the fold on arrival and looked missing. Sticky-bottom pins to viewport bottom whenever natural position is below the fold, so Goal + Fix My Prompt are ALWAYS visible. Mobile `.pmgv2-main` gets `padding-bottom: 240px` so the last lifted aux item isn't permanently obscured behind the pinned composer.
*   **Hide `#pmg-result-confirm` in chassis:** `pmg-ux.js` injects a "✓ Your prompt is ready. Copy it, run it, or refine it." paragraph below the result text on every generation AND a MutationObserver re-injects it if removed. Chassis suppresses it with `html.pmg-chassis-v2 #pmg-result-confirm { display: none !important }` (CSS only — do NOT try to remove the node, the observer fights back). The Copy/Refine/Check Quality/Start Over buttons immediately above it already convey the same affordance.
*   **Slim mobile sticky composer (cv2-13):** Inside `.pmgv2-composer-wrap` at `max-width:900px`, the long Goal helper (`.field.field-primary > .helper`), `#image-gen-hint`, `.demo-stack`, and `#random-prompt` are hidden, `#goal` shrinks to `min-height:48px / max-height:120px`, and `#pmg-help-me-start-btn` becomes a 38px chip. The hidden elements still exist in the DOM (handlers intact) — most are already lifted into `#pmgv2-form-aux` for the scrolling region. Do NOT hide `#image-generate-btn` itself — image-mode needs it as the primary CTA (see `demoteButtons()` gotcha).
*   **Hero gutter must match column gutters:** `.pmgv2-hero` left/right padding MUST equal `.pmgv2-mode-bar` / `.pmgv2-thread` / `.pmgv2-composer-wrap` (28px desktop, 14px mobile) or the "Finally, AI That Understands You" heading sits flush left while the Template box / Fixed Prompt panel are indented, making the column look broken.
*   **ChatGPT-style sticky composer (cv2-11/15):** `pmg-chassis-v2.js` `liftFormAuxIntoThread()` runs after relocation and moves every `#prompt-form` child OUT of the composer and INTO `<div id="pmgv2-form-aux">` at the top of `.pmgv2-thread`, EXCEPT `.field.field-primary` (Goal), `#tour-step-generate` (Fix My Prompt actions), `#pmg-help-me-start-btn`, and `#goal`. The composer-wrap then has `position: sticky; bottom: 0` (see "Composer is sticky-BOTTOM" gotcha) so the slim Goal band stays pinned at the viewport bottom while the lifted aux (Auto Optimize, Upload, Prompt Tuning Step 1, etc.) scrolls above it. Safe because nothing in the codebase calls `FormData(form)` or `form.elements` — every handler queries by ID. If you add a NEW form-related node that MUST live inside `<form>` (e.g., a hidden input read via FormData), update `KEEP_IN_COMPOSER` in the lift function.
*   **Rail is its own scroll container:** `.pmgv2-rail` sets `max-height: calc(100vh - 100px); overflow-y: auto;` so vault/templates lists scroll inside the rail without dragging the main page. Anything that calls `scrollIntoView` on a rail descendant should use `block: 'nearest'` to avoid yanking the whole viewport.
*   **Result panel hide signal is `body.pmg-has-result`:** Hiding `#result-panel` until generation completes uses `html.pmg-chassis-v2 body:not(.pmg-has-result) .pmgv2-thread #result-panel`. The class IS set by `pmg-ux.js:306` after a real generation. Do NOT use `.has-result` on the panel itself — that selector never matches, swallows generated prompts, and looks broken.
*   **All `<dialog>`s under `<body>` need `data-pmg-overlay-root`:** chassis hides every direct body child not in the `body > *:not(...)` allow-list at line 21 of `pmg-chassis-v2.css`. `#guided-mode-dialog` lacking this attribute caused Help Me Start to "freeze" the app — the dialog opened but was display:none, leaving focus trapped on an invisible element. `#guided-mode-dialog`, `#privacy-dialog`, and `#terms-dialog` now all carry the attribute. Add it to any new top-level dialog/overlay.
*   **Generated image visibility in chassis:** legacy `body:not(.image-mode) #imageResultSection` hides the result section. Chassis adds `html.pmg-chassis-v2 #imageResultSection:not([hidden]) { display: block !important; }` so generation handlers (which clear `[hidden]`) succeed regardless of `image-mode`.
*   **`demoteButtons()` excludes image generators:** `pmg-ux.js` `demoteButtons()` intentionally OMITS `image-generate-btn` and `imageBtn` — they are the primary action in image mode, so the `.pmg-demoted` gray-out would make the free-tier Generate Image button look locked. Do not re-add them to the list.

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)