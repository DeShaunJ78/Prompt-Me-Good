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
*   **Cache-buster:** Bump `?v=cv2-N` on both `pmg-chassis-v2.css` and `pmg-chassis-v2.js` script/link tags in `app.html` whenever you change either file. Currently `cv2-7`.
*   **Rail is its own scroll container:** `.pmgv2-rail` sets `max-height: calc(100vh - 100px); overflow-y: auto;` so vault/templates lists scroll inside the rail without dragging the main page. Anything that calls `scrollIntoView` on a rail descendant should use `block: 'nearest'` to avoid yanking the whole viewport.
*   **Empty result panel is hidden, not dimmed:** `html.pmg-chassis-v2 .pmgv2-thread #result-panel:not(.has-result)` is `display: none` (desktop AND mobile). The composer is the focal point until generation populates the panel.
*   **Generated image visibility in chassis:** legacy `body:not(.image-mode) #imageResultSection` hides the result section. Chassis adds `html.pmg-chassis-v2 #imageResultSection:not([hidden]) { display: block !important; }` so generation handlers (which clear `[hidden]`) succeed regardless of `image-mode`.

## Pointers

*   **Validation Skill:** See `validation` skill for running `overflow-360` playwright tests.
*   **OpenAPI Spec:** Refer to `openapi.yaml` for API endpoint details.
*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
*   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
*   **Vite Docs:** [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
*   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)