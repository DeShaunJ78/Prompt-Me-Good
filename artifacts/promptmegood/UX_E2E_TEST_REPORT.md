# PromptMeGood — Automated End-to-End UX Test Report

This file is the recorded, machine-checkable pass/fail summary for the
automated end-to-end UX walkthrough that was originally deferred during
the v7/v8 retirement task because the testing service had a transient
DNS outage. Re-running it once the service was back was tracked as
Task #5 ("Re-run automated end-to-end UX tests when the testing service
is back").

If this scenario regresses, this file is the reference for what an
end-to-end pass looks like and how to verify it.

## Run metadata

- App under test: `artifacts/promptmegood` (web artifact, served at `/`)
- Path tested: `/`
- Viewport: 1280 × 900
- Browser driver: Playwright (run via the platform testing service)
- Backend note: there is no real `/api/image` endpoint in the dev
  environment, so real image generation cannot complete. The
  post-generation UI is verified by setting the same body classes
  (`pmg-has-result`, `pmg-has-generated`) that `pmg-ux.js` would set
  after a real generation. This is the documented test pattern.

## Pass/fail summary

| # | Check | Result |
|---|---|---|
| 1 | Hero CTA hierarchy: primary "Build…" CTA + outlined secondary "See Use Cases" (`#hero-usecases-cta`) | PASS |
| 2 | Builder section appears above marketing sections (use cases / how it works / pricing / testimonials / why prompt / faq) | PASS |
| 3 | Mode pill switching: clicking `#imageModeBtn` adds `body.image-mode` and toggles `.active` correctly | PASS |
| 4 | Photographer accordion (`#pmg-photo-accordion`) renders question cards in image mode | PASS |
| 5 | Photographer accordion question-by-question flow can be answered card-by-card until `#pmg-build-image-btn.pmg-ready` | PASS |
| 6 | "Build My Image" composes answers into the goal field (`#goal`) — non-empty composed prompt with photographer-style language | PASS |
| 7 | Post-generation action stack mounts inside `#what-next` with Run with AI / Copy / Refine | PASS |
| 8 | No JavaScript console errors during the run | PASS |

Overall: **PASS (8/8)**.

## Evidence captured during the final run

For check 7 (post-generation action stack), the test evaluated the
following inside the page after `pmg-has-result` was applied:

```js
const wn = document.getElementById('what-next');
const cs = getComputedStyle(wn);
const stack = wn.querySelector('.pmg-action-stack');
const btnLabels = stack
  ? Array.from(stack.querySelectorAll('.pmg-action-btn'))
      .map(b => b.textContent.trim())
  : [];
({
  exists: !!wn,
  display: cs.display,
  visibility: cs.visibility,
  height: wn.offsetHeight,
  width: wn.offsetWidth,
  hasStack: !!stack,
  btnLabels,
  bodyClasses: document.body.className,
});
```

Observed return value:

```json
{
  "exists": true,
  "display": "block",
  "visibility": "visible",
  "height": 355,
  "width": 456,
  "hasStack": true,
  "btnLabels": ["▶ Run With AI", "Copy Prompt", "Refine It"],
  "bodyClasses": "has-mobile-sticky image-mode pmg-image-reordered pmg-has-generated pmg-has-result"
}
```

For check 6 (Build My Image composes into `#goal`), an example value
captured from `#goal.value` after stepping through the photographer
accordion and clicking "Build My Image":

> Extreme Close-Up of studio portrait, Wide Angle lens, Golden Hour,
> Cinematic & Dramatic

For check 8 (no console errors), the captured `console.error` list was
empty (`[]`).

## How to re-run

1. Ensure the workflow `artifacts/promptmegood: web` is running.
2. From the workspace, drive an end-to-end test against `/` covering
   the eight checks above. The test plan that produced this report
   is documented in Task #5 (`.local/tasks/task-5.md`) and in the
   commit message accompanying this report.
3. Acceptable evidence of a pass is the same set of literal
   evaluations producing equivalent results, plus an empty
   `console.error` list (favicon/404/`/api/image` network errors are
   acceptable in dev).

## Relevant files

- `artifacts/promptmegood/index.html`
- `artifacts/promptmegood/public/scripts/pmg-ux.js`
  (`rebuildPostGenStack`, `buildPhotoAccordion`, `setMode` glue)
- `artifacts/promptmegood/public/scripts/pmg-image-fix.js`
- `artifacts/promptmegood/public/scripts/post-spec.js`
