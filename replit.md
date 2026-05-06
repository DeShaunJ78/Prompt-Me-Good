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

*   `artifacts/promptmegood/`: Main static AI prompt builder (frontend), includes `index.html` (marketing landing), `app.html` (workstation UI), `guide.html`, `manual.html`, `help.html`, `contact.html`, and `404.html`.
*   `packages/api/`: Backend API services.
*   `packages/db/`: Database schema and migrations.
*   `packages/shared/`: Shared utilities and types.
*   `openapi.yaml`: OpenAPI Specification (API contracts).
*   `artifacts/promptmegood/src/styles/`: Theme files (CSS variables).
*   `artifacts/promptmegood/public/styles/pmg-g-theme.css`: G "Warm Dark Hybrid" override stylesheet.
*   `artifacts/promptmegood/public/styles/pmg-chassis-v2.css` + `public/scripts/pmg-chassis-v2.js`: Workstation chassis layout and styling.
*   `artifacts/promptmegood/playwright.config.ts`: Frontend test configuration.

## Architecture decisions

*   **Monorepo with pnpm:** Facilitates shared code and consistent development.
*   **Client-side quick-win flow:** First-time user onboarding uses sequential client-side API calls for immediate engagement.
*   **Accessibility Guard:** Global, continuous accessibility check ensures interactive elements are clickable and visible.
*   **Quiet Onboarding:** Suppresses non-essential UI nudges for new sessions for a focused first-prompt experience.
*   **Expert Command Center as Paid Feature:** Advanced prompt engineering tools are paywalled after beta.
*   **G theme overlay:** Visual language is layered via a token+skin override stylesheet without markup rewrites.
*   **Accent picker sync:** Both legacy and chassis accent pickers write to the same `localStorage` key.

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

*   **Accessibility State:** Verify `inert`/`aria-hidden` states after DOM manipulations.
*   **Quick Win Overlay:** Ensure `html.pmg-qw-pending` is applied via inline script for first-time users.
*   **Expert Command Center Gating:** Expert Mode becomes a paid feature after `BETA_END`; ensure UI reflects this.
*   **Empty-state action gating:** New post-result actions need IDs added to `EMPTY_BTN_IDS` in `index.html`'s `watchResultBox()`.
*   **Saved-To-Vault indicator:** Any code persisting a prompt to the vault MUST `document.dispatchEvent(new Event('pmg:vault-saved'))`.
*   **Body-appended overlays:** New runtime overlays mounted directly under `<body>` must have `data-pmg-overlay-root`.
*   **Waitlist anchors:** `pricing.html` uses three IDs (`#early-access`, `#founding-member-waitlist`, `#pro-early-access`) for its single waitlist form.
*   **Adding new top-level HTML pages:** Register new HTML files in `artifacts/promptmegood/vite.config.ts` `rollupOptions.input`.
*   **Guide vs Manual split:** `guide.html` is the short orientation; `manual.html` is the long-form reference. Cross-link both and keep `help.html` pointing to both.
*   **Route split (`/` vs `/app`):** `/` is marketing landing, `/app` is workstation. Landing auto-redirects returning users to `/app`; use `?stay=1` to bypass.
*   **Chassis rail card wrapping:** Vault `.history-list` / `.templates-grid` are forced to a single column in `.pmgv2-rail`.
*   **Cache-buster:** Bump `?v=cv2-N` on `pmg-chassis-v2.css` and `pmg-chassis-v2.js` in `app.html` on changes. Currently `cv2-23`.
*   **Light dock (cv2-23, mobile only):** `.pmgv2-dock` on `max-width:900px` uses cream `#f5efe1` background + brand-mint `#3ee0a0` top border. Inactive `.pmgv2-dock-btn` is deep teal `#0e3a36` text on transparent; active `[aria-pressed="true"]` is solid deep teal bg with cream text + mint border + halo. Selectors prefixed with `html.pmg-chassis-v2` to win cascade over the earlier dock rules at lines ~340 and ~900 without an !important war (only `background` and `border-top` use !important on `.pmgv2-dock` itself).
*   **Light/dark mode is intentionally locked to dark:** The G theme overlay (`pmg-g-theme.css` lines 11-22) forces the same dark teal palette for both `[data-theme="light"]` and `[data-theme="dark"]`. Any future "real light mode" requires a separate token set in that overlay.
*   **Collapsible composer (cv2-21, mobile only):** On `max-width:900px`, the composer-wrap is hidden by default and replaced with a 44px `.pmgv2-composer-tab` pill ("✏️ What do you want to build?") above the dock. State = single class `html.pmg-composer-collapsed`. Expand triggers: pill tap, #goal focus, "+ New Prompt", template-picker tap, Help Me Start completion (polls #goal value for 30s after dialog opens). Collapse triggers: `body.pmg-has-result` added (MutationObserver), #goal blur with empty value (300ms grace for iOS keyboard dismiss), switching to a non-Workstation dock tab. **Sticky-open guard:** `goalHasContent()` blocks auto-collapse if textarea has any non-whitespace content. **Desktop guarantee:** pill is `display: none` outside the media query AND a `matchMedia('change')` listener strips the collapsed class on phone-to-tablet rotation. JS lives in `initCollapsibleComposer()` in `pmg-chassis-v2.js`. Do NOT remove the MutationObserver on `body[class]` — it's the only signal we get for generation completion.
*   **Slim mobile composer (cv2-19/20, Option B):** On `max-width:900px`, composer-wrap is reduced to textarea + Fix My Prompt only (~165px). Hides `.field.field-primary > .field-label-row` (drops "Your Goal · Clear" row) and `#pmg-help-me-start-btn` via doubled-ID selector `#pmg-help-me-start-btn#pmg-help-me-start-btn` (specificity 0,2,0,1) needed to beat `pmg-linear-flow.js`'s injected `body:not(.image-mode) #pmg-help-me-start-btn[id] { display: inline-flex !important }` (equal 0,1,1,1, loaded later). Help Me Start now lives in the chassis top bar as `.pmgv2-help-start` pill that programmatically `.click()`s the legacy button (with `#guided-mode-btn` fallback). User flagged "too big" three times — do NOT add new buttons/badges/hints inside composer-wrap on mobile.
*   **Goal textarea aria-label (cv2-20):** Mobile chassis hides `.field-label-row` containing `<label for="goal">`, so `wireTopBarActions` patches `#goal` with `aria-label="Your goal — describe what you want"` (idempotent — only sets if absent) so screen readers still announce it. The in-row `#clear-goal-btn` is also hidden as collateral; rail's "+ New Prompt" covers the clear path.
*   **Mobile composer:** Limited to textarea and "Fix My Prompt" button. Do NOT add new elements to composer-wrap on mobile.
*   **Live Feedback panel:** Suppressed in chassis via CSS (`display: none !important`) due to re-mounting observers.
*   **Mobile composer (`position: fixed`):** Pinned to viewport bottom; `.pmgv2-main` gets `padding-bottom` to prevent content overlap.
*   **Hide `#pmg-result-confirm`:** Suppressed in chassis via CSS (`display: none !important`) due to re-injection.
*   **Slim mobile sticky composer:** Elements hidden or shrunk within `.pmgv2-composer-wrap` at `max-width:900px`.
*   **Hero gutter:** `.pmgv2-hero` left/right padding must match other column gutters.
*   **ChatGPT-style sticky composer:** `pmg-chassis-v2.js` `liftFormAuxIntoThread()` moves most `#prompt-form` children out of the composer.
*   **Rail scroll container:** `.pmgv2-rail` is its own scroll container with `overflow-y: auto;`.
*   **Result panel hide signal:** Use `body.pmg-has-result` to hide `#result-panel` until generation completes.
*   **`demoteButtons()` excludes image generators:** `pmg-ux.js` `demoteButtons()` intentionally OMITS `image-generate-btn` and `imageBtn`.

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)