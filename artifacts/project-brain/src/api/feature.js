// ---------------------------------------------------------------------------
// feature.js — client for POST /api/feature (Feature Sub-Spec generation)
//
// Response shape: {
//   "FEATURE_SPEC.md":      string,
//   "SCOPE_LOCK.md":        string,
//   "INTEGRATION_PLAN.md":  string,
//   "CONFLICT_WARNINGS.md": string,
//   featurePhases: Phase[]
// }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Offline fallback — generated locally when the API server is unreachable
// ---------------------------------------------------------------------------
function buildFallbackFeatureSubSpec({ existingSpec, featureDescription }) {
  const featureName = featureDescription.slice(0, 60);
  const today = new Date().toISOString().split("T")[0];

  return {
    "FEATURE_SPEC.md": `# FEATURE_SPEC.md — Feature Specification

## 🧩 Feature Name
${featureName}

## 📋 What This Feature Does
${featureDescription}

## 👤 User Stories
- As a user, I want to ${featureDescription.toLowerCase()}, so that I can achieve my goal more efficiently.
- As a user, I want the new feature to work with my existing data, so that nothing is lost.
- As a user, I want clear feedback when the feature is active or inactive.

## ✅ Acceptance Criteria
- [ ] The feature works as described in the user stories above
- [ ] Existing functionality is not broken
- [ ] The feature handles error states gracefully
- [ ] The feature is accessible on mobile

## 🏗️ Technical Approach
_Determine from your existing architecture (see SCOPE_LOCK.md for files to change)._

## 📅 Created
${today}
`,

    "SCOPE_LOCK.md": `# SCOPE_LOCK.md — Scope Lock Guardrail

## 🔒 The Scope Lock Guardrail
_Paste this at the top of every prompt you give your AI coding tool._

\`\`\`
### 🔒 SCOPE LOCK — ${featureName}
- **Goal:** Add "${featureName}" to the existing project.
- **Allowed Files:** [fill in from INTEGRATION_PLAN.md phases]
- **DO NOT TOUCH:** Any file not listed in Allowed Files above.
- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.
- **CRITICAL:** Do NOT change the database schema unless strictly required.
- **CRITICAL:** Preserve all existing component APIs, routes, and styles.
- **Rule:** STOP and ask permission before touching anything outside allowed files.
\`\`\`

## ✅ Files to CHANGE
_Determined from your existing architecture. Review INTEGRATION_PLAN.md for specifics._

| File | Change Type | Reason |
|------|-------------|--------|
| \`new-feature.tsx\` | Create | New feature component |
| \`App.tsx\` or entry point | Edit (1 line) | Import + mount new component |

## ❌ Files to LEAVE ALONE
- Database schema — no DB changes needed for this feature (unless explicitly required)
- All other components not listed above
- Existing routes and API endpoints
- Global styles and design tokens

## 🚦 Database Change Required?
Review your feature description. If it needs persistent data not in your existing schema, you MUST add a Phase 0 to create the migration first.

## 📋 Existing Spec Context
\`\`\`
${existingSpec.slice(0, 500)}${existingSpec.length > 500 ? "\n…[truncated]" : ""}
\`\`\`
`,

    "INTEGRATION_PLAN.md": `# INTEGRATION_PLAN.md — Integration Phases

## Overview
Adding: **${featureName}**

_These phases use minimal file scope. Each phase has its own Scope Lock embedded in the prompt._

---

## Phase 1 — Create Feature Files (New Files Only)

### 🔒 SCOPE LOCK — Phase 1
- **Goal:** Create all new files for the feature. Touch ZERO existing files.
- **Allowed Files:** New files only (to be created)
- **DO NOT TOUCH:** Any existing file.
- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.
- **CRITICAL:** Do NOT change the database schema unless strictly required.
- **CRITICAL:** Preserve all existing component APIs, routes, and styles.
- **Rule:** STOP and ask permission before touching anything outside allowed files.

**Instructions:**
1. Create the new feature component/module files.
2. Do not import or wire them into the app yet — that's Phase 2.
3. Write the component in isolation with placeholder props.
4. Add a basic render test.

**Expected Result:** New feature files exist and render in isolation without errors.

---

## Phase 2 — Hook into Existing App (Minimal Edits)

### 🔒 SCOPE LOCK — Phase 2
- **Goal:** Wire the new feature into the existing app with surgical, minimal edits.
- **Allowed Files:** Entry point or router file (1-2 files maximum)
- **DO NOT TOUCH:** Any other existing file.
- **CRITICAL:** Make the SMALLEST possible edit — typically 1-3 lines per file.
- **CRITICAL:** Do NOT refactor anything while integrating.
- **Rule:** STOP and ask permission before touching anything outside allowed files.

**Instructions:**
1. Import the new feature component in the entry point or router.
2. Add it to the appropriate location (route, slot, or section).
3. Pass any required props from existing state.
4. Do NOT reorganize or refactor surrounding code.

**Expected Result:** The feature appears in the app and is functional.

---

## Phase 3 — Test & Verify

### 🔒 SCOPE LOCK — Phase 3
- **Goal:** Verify the feature works and existing functionality is unbroken.
- **Allowed Files:** None — this phase is testing only.
- **DO NOT TOUCH:** Any file.

**Manual Tests:**
- [ ] New feature works as described
- [ ] All existing features still work (regression test)
- [ ] Feature handles error states gracefully
- [ ] Feature works on mobile (375px)
`,

    "CONFLICT_WARNINGS.md": `# CONFLICT_WARNINGS.md — Conflict Analysis

_This file was generated from your project context. Review before starting._

## ⚠️ Manual Review Required

The AI analysis is not available (offline mode). Please manually check for these common conflicts before starting:

### 🗄️ Database Conflicts
- Does the new feature require storing new data?
- If yes: add a Phase 0 to create the DB migration BEFORE any UI changes.
- Rule: Never store user data without a corresponding DB schema.

### 🔀 Route Conflicts
- Does the new feature add new API routes?
- If yes: check that the route path doesn't conflict with existing routes.
- Pattern: \`/api/features/[resource]\` — use namespaced paths.

### 🎨 Style Conflicts
- Does the new feature use custom CSS that could leak into other components?
- Recommendation: Use CSS Modules or Tailwind utility classes scoped to the feature.

### 📦 State Conflicts
- Does the new feature need global state?
- If the app uses a Context, check if you can read from it without adding to it.
- Avoid adding new root-level state providers if possible.

### ✅ Checklist Before Starting
- [ ] Read SCOPE_LOCK.md and fill in the allowed files list
- [ ] Confirm no database migration is needed (or add Phase 0 if it is)
- [ ] Confirm route namespace doesn't conflict
- [ ] Start with Phase 1 (new files only) before touching any existing file
`,

    featurePhases: [
      {
        id: 1,
        title: "Create Feature Files",
        status: "active",
        platform: "Replit Agent",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 1)
- **Goal:** Create all new files for the feature. Touch ZERO existing files.
- **Allowed Files:** New files only (to be created — see instructions)
- **DO NOT TOUCH:** Any existing file in the project.
- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.
- **CRITICAL:** Do NOT change the database schema unless strictly required.
- **CRITICAL:** Preserve all existing component APIs, routes, and styles.
- **Rule:** STOP and ask permission before touching anything outside allowed files.

**Feature to add:** ${featureDescription}

**Instructions:**
1. Create the new component or module file(s) needed for this feature.
2. Do NOT import or wire them into the existing app yet.
3. Write the feature in isolation — use placeholder props and mocked data.
4. The feature should render without errors when viewed in isolation.

**Do NOT yet:**
- Import the new files into App.tsx, router, or any existing file
- Modify any existing component, route, or style
- Change the database schema`,
        scopeLock: ["[new feature files — to be created]"],
        expectedResult: "New feature files exist and render in isolation without errors. No existing files were modified.",
        manualTests: [
          "New feature file(s) exist in the project",
          "Feature renders without console errors",
          "All existing pages still load and work correctly",
          "No existing files were modified (check git diff)",
        ],
        receipt: [
          "New feature component file created",
          "Feature renders without errors",
          "Zero existing files modified",
          "No breaking changes to existing functionality",
        ],
      },
      {
        id: 2,
        title: "Hook into Existing App",
        status: "pending",
        platform: "Replit Agent",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 2)
- **Goal:** Wire the new feature into the app with minimal, surgical edits.
- **Allowed Files:** Entry point or router file (1-2 files maximum)
- **DO NOT TOUCH:** Any file not listed above.
- **CRITICAL:** Make the SMALLEST possible edit — typically 1-3 lines per file.
- **CRITICAL:** Do NOT refactor anything while integrating.
- **CRITICAL:** Preserve all existing functionality.
- **Rule:** STOP and ask permission before touching anything outside allowed files.

**Feature to wire in:** ${featureDescription}

**Instructions:**
1. Find the correct mount point (route, slot, or component slot) in the existing app.
2. Add an import for the new feature component (1 line).
3. Add the feature to the appropriate location (1-2 lines).
4. Pass only the props that are absolutely required.
5. Do NOT refactor, reorganize, or "clean up" surrounding code while you're in there.`,
        scopeLock: ["[entry point or router file — identify from architecture]"],
        expectedResult: "The new feature is visible and functional within the existing app. All other existing features work correctly.",
        manualTests: [
          "New feature appears in the correct location in the app",
          "Feature functions as described",
          "All pre-existing features still work (regression check)",
          "No layout shifts or broken styles in existing UI",
        ],
        receipt: [
          "Feature is mounted at the correct location",
          "Required props are passed correctly",
          "No existing component APIs were changed",
          "No unrelated code was modified",
        ],
      },
      {
        id: 3,
        title: "Test & Verify",
        status: "pending",
        platform: "Manual",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 3)
- **Goal:** Verify the feature works correctly and no regressions were introduced.
- **Allowed Files:** None — this phase is manual testing only.
- **DO NOT TOUCH:** Any file.

**What to test:**
1. Test the new feature end-to-end as a user would use it.
2. Test all adjacent existing features to ensure no regressions.
3. Test on mobile (375px width).
4. Check the browser console for errors.
5. Test the error state — what happens if something goes wrong?`,
        scopeLock: [],
        expectedResult: "The feature works end-to-end. No regressions. No console errors. Works on mobile.",
        manualTests: [
          `Feature works: ${featureDescription}`,
          "All previously working features still work",
          "No errors in browser console",
          "Feature works on 375px mobile width",
          "Error states are handled gracefully (not blank screens)",
        ],
        receipt: [
          "Feature works end-to-end",
          "Zero regressions in existing functionality",
          "Zero console errors",
          "Mobile-responsive at 375px",
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// generateFeatureSubSpec — calls POST /api/feature
// ---------------------------------------------------------------------------
export async function generateFeatureSubSpec({ existingSpec, featureDescription }) {
  try {
    const response = await fetch("/api/feature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ existingSpec, featureDescription }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Feature server returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err instanceof TypeError) {
      console.warn("[generateFeatureSubSpec] API server unreachable, using local fallback:", err.message);
      return buildFallbackFeatureSubSpec({ existingSpec, featureDescription });
    }
    throw err;
  }
}
