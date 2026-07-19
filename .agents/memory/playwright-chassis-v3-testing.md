---
name: Playwright testing under chassis v3
description: Hard-won rules for making /app Playwright specs pass under the chassis-v3 shell (overlay hide rules, panel state, mocks, intentional-UX drift).
---

## Rules

- **Body-appended overlays need `data-pmg-overlay-root`.** The chassis universal hide rule (`body > *:not(#pmg-chassis-v3-root)…`) suppresses any element appended to `<body>` without that attribute. Any new modal/overlay (and any synthetic element a test appends to body) must set it or it renders `display:none`.
  **Why:** several tour/share specs failed only because the overlay was silently hidden, not broken.

- **Don't fight the chassis with reorder/mount scripts.** The chassis reparents legacy DOM and hard-removes a deny-list of ids at boot (`deleteTargets()`). Scripts that rebuild or reorder those nodes must detect removal and rebuild lazily (e.g. on open()), not assume boot-time DOM survives.

- **`data-active-panel` lives on `.pmgv3-body`, NOT `document.body`.** Any code or test reading the active panel from body silently gets null.

- **Mock API routes with JS-shaped responses where the app expects executable JS** (e.g. `/api/pricing-config.js`) — returning JSON breaks script-tag consumers; mock JS, not JSON.

- **Blanket state-class CSS collides across features.** `html.pmg-chassis-v3 .is-collapsed { display:none !important }` clobbered the Vault's `.history-item.is-collapsed` (which means "card collapsed", still visible). When a chassis-wide class rule hides something unexpectedly, check for semantic collision and scope with `:not(...)` rather than renaming.

- **Modals launched from inside the Vault drawer need z-index above 99991** (drawer z). The legacy Compare modal at z 40 was visible but click-intercepted by drawer content.

- **Tests asserting "visible on first load" can go stale against intentional UX gates**: analyze-first flow collapses `#generateBtn` until `#analyze-btn` is clicked; guided intake hides `#pmg-vs-image-goal` (pin `localStorage['pmgv3:vs:intake-mode:image']='freeform'` in tests that assert the freeform textarea). The old `#pmg-shortcuts-panel` is intentionally hidden under v3 — the live cheatsheet is `window.pmgCheatsheet` / `#pmg-cheatsheet`.

- **Ops:** run specs in ≤115s bash chunks (`timeout 113 npx playwright test <specs> --reporter=line`); parallel Playwright runs against the shared dev server contend and time out — run chunks sequentially. Baseline suspected pre-existing failures with `git show HEAD:path > file`, run, restore (no git state changes).
