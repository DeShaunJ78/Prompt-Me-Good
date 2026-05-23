CONFLICT RESOLUTION — ANSWERS TO ALL QUESTIONS
Proceed with building after reading this in full.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 1 — TEMPLATE BROWSER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUESTION A — pmg-ux.js and the 28 TEMPLATES[]:
  Do NOT touch pmg-ux.js. Not even surgically.
  Instead: delete <section id="templates"> and its entire
  contents from app.html. That's all. renderTemplates()
  will find no #templates-grid to render into and will
  fail silently — that's acceptable. The dead TEMPLATES[]
  const in pmg-ux.js is harmless. Leave it.

QUESTION B — pmg-templates.js:
  Yes, replace it entirely. Do this:
    1. Delete the existing <script> tag for pmg-templates.js
       from app.html.
    2. Do NOT keep pmg-templates.js as a file — it will
       be fully superseded by pmg-template-browser.js.
    3. The <link> for any pmg-templates.css (if one exists)
       should also be removed from app.html.
    4. Add the new <link> pmg-template-browser.css and
       <script> pmg-template-browser.js at the END of
       their respective blocks, as the spec states.

QUESTION C — Button placement in top nav:
  Place #pmg-template-browser-btn between "Vault" and
  "Expert" in the nav. That's where it belongs — templates
  feed into the vault workflow, and Expert is the power
  user tier. It sits naturally in that sequence.
  Label: "Templates"
  Class: btn btn-secondary (or match the existing ghost
  nav link style — mirror whatever Vault and Expert use,
  don't introduce a new visual style).

QUESTION D — Command Palette 📋 Templates link:
  Repurpose it to open the new browser.
  Change its behavior so clicking it either:
    - Dispatches a click event on #pmg-template-browser-btn
    OR
    - Calls the new modal's open function directly
  Whichever is cleaner given how pmg-template-browser.js
  exposes its open method. Do not leave it pointing at
  the now-deleted #templates section.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 2 — MULTI-MODEL COMPARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confirmed: the existing compare feature is vault-to-vault
prompt diffing — a completely different feature. No conflict.

Build Spec 2 exactly as specified.
Place #result-top-compare after #result-top-refine.
Do not touch #compare-two, #compare-banner,
#compare-overlay, pmg-diff.js, or pmg-fix-diff.js.
Those stay exactly as they are.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 3 — PROMPT VERSIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No conflicts. Build as specified.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPEC 4 — DEVELOPER API: DB SCHEMA LOCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Drizzle schema files live here:
  lib/db/src/schema/

Files currently in that directory:
  founding-purchases.ts
  waitlist.ts
  index.ts

Create your new file at:
  lib/db/src/schema/api-keys.ts

Then add the export to:
  lib/db/src/schema/index.ts

The drizzle config is at:
  lib/db/drizzle.config.ts

Run migrations with:
  pnpm --filter @workspace/db run generate
  pnpm --filter @workspace/db run migrate

No api_keys table exists yet — confirmed clear to create.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PMG-UX.JS STANDING RULE — CONFIRMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pmg-ux.js is never touched. For any conflict where
pmg-ux.js would need to change, the solution is always
one of these two approaches:
  1. Remove the DOM target so existing pmg-ux.js code
     has nothing to act on (as with the templates section).
  2. Override behavior from a new external script using
     event interception or MutationObserver.
If neither approach works for a future conflict, stop
and report before proceeding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOU ARE NOW CLEAR TO BUILD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build order:
  Spec 1 → verify live → Spec 2 → verify live →
  Spec 3 → verify live → Spec 4 → verify live.

Remember the standing rule: if anything unexpected comes
up during the build, stop and report before continuing.
