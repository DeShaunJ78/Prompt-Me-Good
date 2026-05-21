import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

type FeaturePhase = {
  id: number;
  title: string;
  status: "active" | "pending" | "done";
  platform: string;
  prompt: string;
  scopeLock: string[];
  expectedResult: string;
  manualTests: string[];
  receipt: string[];
};

type FeatureSubSpec = {
  "FEATURE_SPEC.md": string;
  "SCOPE_LOCK.md": string;
  "INTEGRATION_PLAN.md": string;
  "CONFLICT_WARNINGS.md": string;
  featurePhases: FeaturePhase[];
};

// ---------------------------------------------------------------------------
// Offline fallback
// ---------------------------------------------------------------------------
function buildFallback(featureDescription: string, existingSpec: string): FeatureSubSpec {
  const featureName = featureDescription.slice(0, 60);
  const slug = slugify(featureDescription);

  return {
    "FEATURE_SPEC.md": `# FEATURE_SPEC.md — Feature Specification\n\n## 🧩 Feature\n${featureDescription}\n\n## User Stories\n- As a user, I want to ${featureDescription.toLowerCase()}.\n\n## Acceptance Criteria\n- [ ] Feature works as described\n- [ ] No existing features broken\n- [ ] Error states handled\n- [ ] Mobile-responsive\n`,
    "SCOPE_LOCK.md": `# SCOPE_LOCK.md — Scope Lock\n\n## 🔒 Guardrail\n\`\`\`\n### 🔒 SCOPE LOCK — ${featureName}\n- **Allowed Files:** [see INTEGRATION_PLAN.md]\n- **DO NOT TOUCH:** Any file not listed above.\n- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.\n- **CRITICAL:** Do NOT change the database schema unless strictly required.\n- **CRITICAL:** Preserve all existing styles and routes.\n- **Rule:** STOP and ask permission before touching anything outside allowed files.\n\`\`\`\n`,
    "INTEGRATION_PLAN.md": `# INTEGRATION_PLAN.md — Integration Plan\n\n## Phase 1 — Create Feature Files\nCreate new files only. Touch zero existing files.\n\n## Phase 2 — Hook into App\nMinimal 1-3 line edit to the entry point or router.\n\n## Phase 3 — Test & Verify\nManual regression testing.\n`,
    "CONFLICT_WARNINGS.md": `# CONFLICT_WARNINGS.md\n\n## ⚠️ Review Required\n- Check if feature needs a new DB table → add Phase 0 migration first\n- Check for route conflicts → use namespaced paths\n- Check for CSS leaks → scope styles to feature component\n`,
    featurePhases: [
      {
        id: 1, title: "Create Feature Files", status: "active", platform: "Replit Agent",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 1)\n- **Goal:** Create all new files for the feature.\n- **Allowed Files:** New files only\n- **DO NOT TOUCH:** Any existing file.\n- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.\n- **CRITICAL:** Do NOT change the database schema unless strictly required.\n- **Rule:** STOP and ask permission before touching anything outside allowed files.\n\n**Feature:** ${featureDescription}\n\n**Instructions:**\n1. Create the new component/module files needed.\n2. Do NOT wire them into the app yet — that's Phase 2.\n3. Render in isolation with placeholder props.`,
        scopeLock: ["[new feature files — to be created]"],
        expectedResult: "New feature files created and render in isolation. Zero existing files modified.",
        manualTests: ["New file(s) created", "Renders without console errors", "No existing files modified (check git diff)"],
        receipt: ["Feature file created", "Renders without errors", "Zero existing files modified"],
      },
      {
        id: 2, title: "Hook into Existing App", status: "pending", platform: "Replit Agent",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 2)\n- **Goal:** Wire the feature into the app with a minimal surgical edit.\n- **Allowed Files:** Entry point or router file (1-2 files only)\n- **DO NOT TOUCH:** Any other file.\n- **CRITICAL:** 1-3 line edit maximum per file. Do NOT refactor.\n- **Rule:** STOP and ask permission before touching anything outside allowed files.\n\n**Instructions:**\n1. Add import for new feature (1 line).\n2. Mount feature at correct location (1-2 lines).\n3. Do NOT reorganize or clean up surrounding code.`,
        scopeLock: ["[entry point — identify from architecture]"],
        expectedResult: "Feature is live in the app. All existing features still work.",
        manualTests: ["Feature visible in correct location", "All existing features work", "No layout shifts"],
        receipt: ["Feature mounted correctly", "No existing APIs changed", "No unrelated code modified"],
      },
      {
        id: 3, title: "Test & Verify", status: "pending", platform: "Manual",
        prompt: `### 🔒 SCOPE LOCK — ${featureName} (Phase 3)\n- **Goal:** Verify correctness and zero regressions.\n- **Allowed Files:** None — manual testing only.\n\n**Test the feature end-to-end, check all adjacent features, test on mobile (375px).**`,
        scopeLock: [],
        expectedResult: "Feature works. No regressions. No console errors. Mobile-responsive.",
        manualTests: ["Feature works end-to-end", "No existing features broken", "No console errors", "Works on mobile 375px"],
        receipt: ["Feature verified", "Zero regressions", "Zero console errors", "Mobile-responsive"],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// POST /api/feature
// ---------------------------------------------------------------------------
router.post("/feature", async (req, res) => {
  const { existingSpec, featureDescription } = req.body as {
    existingSpec?: string;
    featureDescription?: string;
  };

  if (!featureDescription || typeof featureDescription !== "string" || featureDescription.trim().length < 5) {
    res.status(400).json({ error: "featureDescription is required (min 5 chars)." });
    return;
  }

  const safeFeature = featureDescription.trim().slice(0, 1000);
  const safeSpec    = (existingSpec ?? "").trim().slice(0, 6000);
  const featureName = safeFeature.slice(0, 60);

  // The Scope Lock guardrail template injected into every phase prompt
  const scopeLockTemplate = `### 🔒 SCOPE LOCK — {PHASE_TITLE}
- **Goal:** {GOAL}
- **Allowed Files:** {FILES}
- **DO NOT TOUCH:** {EXCLUDED}
- **CRITICAL:** Do NOT rewrite the app. Add, don't replace.
- **CRITICAL:** Do NOT change the database schema unless strictly required by this feature.
- **CRITICAL:** Preserve all existing component APIs, routes, and styles.
- **Rule:** STOP and ask permission before touching anything outside allowed files.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Project Brain's Feature Architect — a specialist in adding features to existing codebases with surgical precision and zero side effects.

Your job: analyze an existing project spec and generate a Feature Sub-Spec that adds ONLY the requested feature, touching the minimum possible files.

Return ONLY a JSON object with these FIVE keys:

"FEATURE_SPEC.md" (string): Feature specification markdown. Include: Feature name, what it does, 2-3 user stories, acceptance criteria (checkbox list), technical approach (brief), and any dependencies on existing components.

"SCOPE_LOCK.md" (string): The Scope Lock guardrail document. CRITICAL FORMAT:
## 🔒 The Scope Lock Guardrail
[include a fenced code block containing the ready-to-paste Scope Lock for ALL phases combined]
## ✅ Files to CHANGE
[table: File | Change Type | Reason] — be SPECIFIC with real filenames from the existing spec
## ❌ Files to LEAVE ALONE
[table: File | Why] — list important files explicitly preserved
## 🚦 Database Change Required?
YES or NO with a one-sentence explanation. If YES, describe the migration.

"INTEGRATION_PLAN.md" (string): Integration plan with 2-4 phases. EACH PHASE must embed the Scope Lock using this template:
${scopeLockTemplate.replace(/\{[A-Z_]+\}/g, "[fill in]")}
Be specific: list EXACT filenames, EXACT line changes.

"CONFLICT_WARNINGS.md" (string): Conflict analysis. Check for: DB schema conflicts, route naming conflicts, global state conflicts, CSS conflicts, component API incompatibilities. If none: write "✅ No conflicts detected — safe to proceed." Start each conflict with ⚠️. End with a pre-flight checklist.

"featurePhases" (array): 2-4 phase objects. EACH object must have:
{
  "id": number,
  "title": string,
  "status": "active" (first) or "pending" (rest),
  "platform": "Replit Agent" | "Manual",
  "prompt": string (FULL markdown prompt WITH Scope Lock header embedded at the top, specific instructions, specific filenames from the existing spec),
  "scopeLock": string[] (SPECIFIC file paths only — the exact allowed files),
  "expectedResult": string,
  "manualTests": string[] (3-5 specific, testable items),
  "receipt": string[] (3-5 verifiable completion criteria)
}

CRITICAL RULES:
1. Phase 1 MUST only create NEW files — zero edits to existing files
2. Phase 2 MUST make the SMALLEST possible edit to existing files (1-3 lines)
3. Database changes MUST be a separate phase if needed
4. Every phase prompt MUST start with the complete Scope Lock header
5. scopeLock arrays MUST contain specific file paths, not placeholders
6. Be specific to THIS feature and THIS codebase — no generic placeholders
7. If the existing spec mentions specific files/components/routes, reference them by name`,
        },
        {
          role: "user",
          content: `Existing Project Context:
${safeSpec || "(No existing spec provided — infer from the feature description what a typical project would look like)"}

New Feature to Add:
${safeFeature}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      res.json(buildFallback(safeFeature, safeSpec));
      return;
    }

    const p = parsed as Record<string, unknown>;
    const requiredKeys = ["FEATURE_SPEC.md", "SCOPE_LOCK.md", "INTEGRATION_PLAN.md", "CONFLICT_WARNINGS.md", "featurePhases"];

    if (!requiredKeys.every((k) => k in p)) {
      res.json(buildFallback(safeFeature, safeSpec));
      return;
    }

    if (!Array.isArray(p.featurePhases) || p.featurePhases.length === 0) {
      (p as Record<string, unknown>).featurePhases = buildFallback(safeFeature, safeSpec).featurePhases;
    } else {
      // Enforce status: first phase active, rest pending
      (p.featurePhases as FeaturePhase[]).forEach((phase, i) => {
        phase.status = i === 0 ? "active" : "pending";
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error("[feature] AI call failed:", err);
    res.json(buildFallback(safeFeature, safeSpec));
  }
});

export default router;
