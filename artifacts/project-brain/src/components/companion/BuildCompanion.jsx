import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import FeedbackButtons from "./FeedbackButtons";

// ---------------------------------------------------------------------------
// Static mock phases — standard (non-feature, non-launch) mode
// ---------------------------------------------------------------------------
const MOCK_PHASES = [
  { id: 1, title: "Scaffold the UI Shell", status: "done", prompt: "", scopeLock: [], expectedResult: "", manualTests: [], receipt: [], platform: null },
  { id: 2, title: "Generate Spec Pack", status: "done", prompt: "", scopeLock: [], expectedResult: "", manualTests: [], receipt: [], platform: null },
  {
    id: 3,
    title: "Build Companion Flow",
    status: "active",
    platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK
- **Goal:** Implement the step-by-step Build Companion flow in the Center Panel.
- **Allowed Files:** \`src/components/companion/BuildCompanion.jsx\`, \`src/components/companion/FeedbackButtons.jsx\`
- **DO NOT TOUCH:** Artifact Viewer, Chat interface, Live Render Screen.
- **Rule:** If you need to modify anything outside the allowed files, STOP and ask for permission.

**Instructions:**
1. Create a \`BuildCompanion\` component that reads the current phase from the \`BUILD_PLAN.md\`.
2. Display the current phase's Prompt, Scope Lock, Expected Result, and Manual Tests.
3. Add platform-specific "Where to paste this" instructions.
4. Build the \`FeedbackButtons\` component with: "Yes, it worked", "Mostly", "No, it failed", "I don't know".
5. Implement feedback logic with Build Receipt and Recovery Prompt flows.`,
    scopeLock: ["src/components/companion/BuildCompanion.jsx", "src/components/companion/FeedbackButtons.jsx"],
    expectedResult: "The Center Panel shows the current phase card with a structured prompt, scope lock, expected result, and manual tests. Feedback buttons appear below.",
    manualTests: [
      "Center Panel shows Phase 3 card with a structured prompt block",
      "Clicking 'Yes, it worked' shows a checklist — Continue button stays disabled until all items are checked",
      "Clicking 'No, it failed' shows a text input and 'Generate Recovery Prompt' button",
      "Recovery Prompt is copyable with a single click",
      "Clicking 'I don't know' shows guidance on how to self-check",
      "'Try a different response' returns to the 4-button grid",
    ],
    receipt: [
      "BuildCompanion component renders in the Center Panel without errors",
      "Phase title, prompt, scope lock, and expected result all display correctly",
      "FeedbackButtons renders all 4 options in a 2×2 grid",
      "Build Receipt checklist is interactive — each item toggles independently",
      "Recovery Prompt generates from user-entered issue text",
      "Recovery Prompt copy button works and shows confirmation",
      "Navigating to 'Next Phase' advances the phase counter",
    ],
  },
  {
    id: 4, title: "Connect Backend API", status: "pending", platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Connect the React frontend to the Express API Server artifact.\n- **Allowed Files:** \`src/api/client.js\`, \`src/hooks/useApi.js\`, API Server route files\n- **DO NOT TOUCH:** UI components, ProjectBrainContext shape.\n\n**Instructions:**\n1. Create \`src/api/client.js\` with a base fetch wrapper.\n2. Create a \`useApi\` hook.\n3. Replace mock calls with real API calls.\n4. Add error boundary handling.`,
    scopeLock: ["src/api/client.js", "src/hooks/useApi.js"],
    expectedResult: "The app calls real API endpoints. Network tab shows actual requests to /api/analyze and /api/generate.",
    manualTests: ["POST /api/analyze fires on idea submission", "POST /api/generate fires after questions", "Disconnect network — app shows a clear error state"],
    receipt: ["API client exists", "useApi hook handles loading/error/data", "analyzeIdea and generateSpecPack call real endpoints", "Error states display user-friendly messages"],
  },
  {
    id: 5, title: "AI Integration", status: "pending", platform: "Replit Agent",
    prompt: `### 🔒 SCOPE LOCK\n- **Goal:** Replace all mock AI functions with real Replit AI Integration calls.\n- **Allowed Files:** API Server \`src/routes/analyze.ts\`, \`src/routes/generate.ts\`\n- **DO NOT TOUCH:** Frontend components, context.\n\n**Instructions:**\n1. Use the Replit OpenAI-compatible AI Integration.\n2. Write structured prompts for idea classification and spec generation.`,
    scopeLock: ["artifacts/api-server/src/routes/analyze.ts", "artifacts/api-server/src/routes/generate.ts"],
    expectedResult: "Idea classification and spec pack generation are powered by a real LLM.",
    manualTests: ["Submit a real idea — SPEC.md reflects the actual project", "Generation takes under 10 seconds"],
    receipt: ["AI Integration configured", "analyzeIdea returns real LLM classification", "generateSpecPack returns contextual markdown"],
  },
];

const PLATFORM_INSTRUCTIONS = {
  "Replit Agent": {
    icon: "🤖",
    steps: [
      "Open the Replit Agent chat panel",
      "Paste the prompt below exactly as shown",
      "Wait for the agent to finish — do not interrupt",
      "Run the manual tests before marking this phase done",
    ],
  },
  "Cursor": {
    icon: "⌨️",
    steps: [
      "Open Cursor in your project directory",
      "Press ⌘K or open the AI panel",
      "Paste the prompt and include the file paths in the Scope Lock",
      "Review all diffs before accepting",
    ],
  },
  "Manual": {
    icon: "✍️",
    steps: [
      "Follow the instructions below step by step",
      "Create or edit each file mentioned in the Scope Lock",
      "Test each change before moving to the next",
    ],
  },
};

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------
function CopyButton({ text, label = "Copy prompt" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className={cn("text-xs px-3 py-1 rounded-md transition-all shrink-0 border", copied ? "bg-primary/15 text-primary border-primary" : "bg-elevated text-muted border-panel hover:text-body")}>
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

function SectionCard({ label, accentClass = "text-subtle", children }) {
  return (
    <div className="rounded-xl overflow-hidden border border-panel">
      <div className="px-4 py-2 bg-surface border-b border-panel">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", accentClass)}>{label}</span>
      </div>
      <div className="px-4 py-3 bg-canvas">{children}</div>
    </div>
  );
}

function PhaseNav({ phases, currentIdx, onSelect }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 shrink-0">
      {phases.map((phase, i) => (
        <button key={phase.id} onClick={() => phase.status !== "pending" && onSelect(i)}
          className={cn("shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
            i === currentIdx ? "bg-primary/12 text-primary border-primary/30"
            : phase.status === "done" ? "bg-elevated text-primary border-panel cursor-pointer hover:bg-panel"
            : "bg-surface text-subtle border-panel cursor-default")}>
          {phase.status === "done" && <span>✓</span>}
          {phase.status === "active" && <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-primary" />}
          <span>P{phase.id}</span>
        </button>
      ))}
    </div>
  );
}

function ConflictWarnings({ content }) {
  const [open, setOpen] = useState(true);
  if (!content) return null;
  const hasConflicts = content.includes("⚠️");
  return (
    <div className={cn("rounded-xl border overflow-hidden shrink-0", hasConflicts ? "border-warning/30" : "border-success/20")}>
      <button onClick={() => setOpen((v) => !v)} className={cn("w-full flex items-center justify-between px-4 py-2.5 text-left", hasConflicts ? "bg-warning/8" : "bg-success/8")}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{hasConflicts ? "⚠️" : "✅"}</span>
          <span className={cn("text-xs font-semibold", hasConflicts ? "text-warning" : "text-success")}>
            {hasConflicts ? "Conflict Warnings — read before starting" : "No conflicts detected — safe to proceed"}
          </span>
        </div>
        <span className="text-xs text-subtle ml-2">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-3 bg-canvas max-h-44 overflow-y-auto">
          <p className="text-xs text-body leading-relaxed whitespace-pre-wrap font-mono">{content}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Launch Coach companion
// ---------------------------------------------------------------------------
const PRIORITY_META = {
  critical: { label: "Critical", cls: "text-error bg-error/10 border-error/25" },
  high:     { label: "High",     cls: "text-warning bg-warning/10 border-warning/25" },
  medium:   { label: "Medium",   cls: "text-primary bg-primary/8 border-primary/20" },
  low:      { label: "Low",      cls: "text-subtle bg-elevated border-panel" },
};

function ScoreBar({ score }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!score) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * score));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  const info =
    score >= 81 ? { color: "text-success", bar: "bg-success", label: "Launch Ready! 🚀" } :
    score >= 61 ? { color: "text-primary",  bar: "bg-primary",  label: "Almost Ready"     } :
    score >= 31 ? { color: "text-warning",  bar: "bg-warning",  label: "Needs Work"        } :
                 { color: "text-error",    bar: "bg-error",    label: "Not Ready"          };

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className={cn("text-5xl font-black tabular-nums leading-none", info.color)}>
        {display}%
      </div>
      <div className={cn("text-sm font-semibold", info.color)}>{info.label}</div>
      <div className="w-full max-w-[200px] h-2 rounded-full bg-canvas overflow-hidden mt-1">
        <div className={cn("h-full rounded-full transition-all duration-[1200ms]", info.bar)} style={{ width: `${display}%` }} />
      </div>
    </div>
  );
}

function ChecklistItem({ item, checked, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const pm = PRIORITY_META[item.priority] ?? PRIORITY_META.medium;
  const isNa = item.status === "na";

  if (isNa) {
    return (
      <div className="flex items-start gap-3 px-1 py-1.5 opacity-50">
        <div className="w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border border-panel bg-elevated">
          <span className="text-[9px] text-subtle">N/A</span>
        </div>
        <span className="text-xs text-subtle flex-1 leading-relaxed">{item.label}</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg transition-all", checked ? "opacity-60" : "")}>
      <div className="flex items-start gap-3 px-1 py-1.5">
        <button
          onClick={() => onToggle(item.id)}
          className={cn(
            "w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center transition-all border cursor-pointer",
            checked ? "bg-primary border-primary" : "bg-elevated border-panel hover:border-primary/50",
          )}
        >
          {checked && (
            <svg className="w-2.5 h-2.5 text-inverse" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <span className={cn("text-xs flex-1 leading-relaxed transition-colors", checked ? "text-subtle line-through" : "text-body")}>
          {item.label}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", pm.cls)}>
            {pm.label}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center text-xs transition-all border",
              expanded ? "bg-secondary/15 text-secondary border-secondary/30" : "bg-elevated text-subtle border-panel hover:text-body",
            )}
            title="Explain this item"
          >
            ?
          </button>
        </div>
      </div>

      {expanded && item.explanation && (
        <div className="mx-7 mb-2 px-3 py-2.5 rounded-lg bg-secondary/6 border border-secondary/20">
          <p className="text-xs leading-relaxed text-body">{item.explanation}</p>
        </div>
      )}
    </div>
  );
}

function LaunchCompanion({ project, specPack, specPackLoading }) {
  const { score, categories } = project.launchData ?? {};

  const allItems = (categories ?? []).flatMap((c) => c.items);
  const nonNaItems = allItems.filter((i) => i.status !== "na");

  const [checkedItems, setCheckedItems] = useState(() =>
    new Set(allItems.filter((i) => i.status === "done").map((i) => i.id)),
  );

  // Re-init when categories change (new analysis)
  useEffect(() => {
    setCheckedItems(new Set(allItems.filter((i) => i.status === "done").map((i) => i.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const toggleItem = (id) => setCheckedItems((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const checkedCount = [...checkedItems].filter((id) => nonNaItems.some((i) => i.id === id)).length;
  const criticalLeft = nonNaItems.filter((i) => i.priority === "critical" && !checkedItems.has(i.id)).length;

  if (specPackLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-success/25" />
          <div className="absolute inset-0 rounded-full border-2 border-t-success border-r-success border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🚀</div>
        </div>
        <p className="text-sm font-semibold text-heading">Scoring Launch Readiness…</p>
        <p className="text-xs text-subtle">Evaluating production, security, database, legal, and mobile</p>
      </div>
    );
  }

  if (!score || !categories) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <span className="text-3xl">🚀</span>
        <p className="text-sm font-semibold text-heading">Launch Coach Ready</p>
        <p className="text-xs text-subtle">Your launch readiness report is loading…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-panel bg-success/4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs">🚀</span>
            <p className="text-xs font-semibold uppercase tracking-widest text-success">Launch Coach</p>
          </div>
          <h2 className="text-sm font-bold text-heading">Launch Readiness Checklist</h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-subtle">{checkedCount}/{nonNaItems.length} done</p>
          {criticalLeft > 0 && (
            <p className="text-xs font-semibold text-error">{criticalLeft} critical left</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Score hero */}
        <div className="rounded-xl border border-panel bg-elevated px-5 py-4 flex flex-col items-center gap-1 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-subtle mb-1">Launch Readiness Score</p>
          <ScoreBar score={score} />
          <div className="w-full h-px bg-panel my-2" />
          <div className="w-full flex justify-between items-center">
            <div className="w-full bg-canvas rounded-full overflow-hidden h-1.5">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: nonNaItems.length > 0 ? `${(checkedCount / nonNaItems.length) * 100}%` : "0%" }}
              />
            </div>
            <span className="text-xs text-subtle ml-3 shrink-0">{checkedCount}/{nonNaItems.length}</span>
          </div>
          <p className="text-xs text-subtle mt-0.5">Your progress (as you check items off)</p>
        </div>

        {/* Categories */}
        {categories.map((cat) => {
          const catChecked = cat.items.filter((i) => i.status !== "na" && checkedItems.has(i.id)).length;
          const catTotal   = cat.items.filter((i) => i.status !== "na").length;

          return (
            <div key={cat.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-xs font-semibold text-heading">{cat.label}</span>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  catChecked === catTotal ? "text-success" : "text-subtle",
                )}>
                  {catChecked}/{catTotal}
                </span>
              </div>
              <div className="rounded-xl border border-panel bg-canvas divide-y divide-panel overflow-hidden">
                {cat.items.map((item) => (
                  <div key={item.id} className="px-3">
                    <ChecklistItem
                      item={item}
                      checked={checkedItems.has(item.id)}
                      onToggle={toggleItem}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer hint */}
        <div className="rounded-xl border border-panel bg-elevated px-4 py-3 flex items-start gap-3">
          <span className="text-base shrink-0">💬</span>
          <p className="text-xs text-subtle leading-relaxed">
            Tap the <strong className="text-body">?</strong> next to any item for a plain-English explanation. Or ask in the Chat panel on the right — your companion can explain any term or suggest the simplest way to implement it.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Builder companion
// ---------------------------------------------------------------------------
function FeatureCompanion({ project, specPack, specPackLoading }) {
  const phases = project.featurePhases ?? [];
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState("Replit Agent");

  useEffect(() => { setPhaseIdx(0); }, [project.name]);

  const conflictContent = specPack?.["CONFLICT_WARNINGS.md"] ?? null;

  if (specPackLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-secondary/25" />
          <div className="absolute inset-0 rounded-full border-2 border-t-secondary border-r-secondary border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🔒</div>
        </div>
        <p className="text-sm font-semibold text-heading">Building Feature Sub-Spec…</p>
        <p className="text-xs text-subtle">Designing Scope Lock guardrails</p>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <span className="text-3xl">🧩</span>
        <p className="text-sm font-semibold text-heading">Feature Builder Ready</p>
        <p className="text-xs text-subtle leading-relaxed">Check the Artifact Viewer on the left to open SCOPE_LOCK.md, FEATURE_SPEC.md, and CONFLICT_WARNINGS.md.</p>
      </div>
    );
  }

  const phase = phases[Math.min(phaseIdx, phases.length - 1)];
  const platformInfo = PLATFORM_INSTRUCTIONS[selectedPlatform] ?? PLATFORM_INSTRUCTIONS["Replit Agent"];

  const handleNextPhase = () => {
    const next = Math.min(phaseIdx + 1, phases.length - 1);
    phase.status = "done";
    if (phases[next]) phases[next].status = "active";
    setPhaseIdx(next);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-panel bg-secondary/4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs">🧩</span>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Feature Builder</p>
          </div>
          <h2 className="text-sm font-bold text-heading">{phase.title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-secondary" />
          <span className="text-xs text-secondary">Phase {phase.id}</span>
        </div>
      </div>

      <div className="px-4 py-2 shrink-0 border-b border-panel">
        <PhaseNav phases={phases} currentIdx={phaseIdx} onSelect={setPhaseIdx} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <ConflictWarnings content={conflictContent} />

        <SectionCard label="📍 Where to paste this" accentClass="text-secondary">
          <div className="flex gap-2 mb-3">
            {Object.keys(PLATFORM_INSTRUCTIONS).map((p) => (
              <button key={p} onClick={() => setSelectedPlatform(p)}
                className={cn("text-xs px-3 py-1.5 rounded-lg transition-all border",
                  selectedPlatform === p ? "bg-secondary/18 text-secondary border-secondary/40" : "bg-elevated text-subtle border-panel hover:text-body")}>
                {PLATFORM_INSTRUCTIONS[p].icon} {p}
              </button>
            ))}
          </div>
          <ol className="flex flex-col gap-1.5">
            {platformInfo.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-body">
                <span className="shrink-0 font-semibold text-secondary">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <div className="rounded-xl overflow-hidden border border-panel">
          <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-panel">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">🔒 Prompt + Scope Lock</span>
            <CopyButton text={phase.prompt} />
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed font-mono overflow-y-auto bg-canvas text-body max-h-[220px] whitespace-pre-wrap">
            {phase.prompt}
          </div>
        </div>

        {phase.scopeLock?.length > 0 && (
          <SectionCard label="🔒 Scope Lock — allowed files only" accentClass="text-error">
            <ul className="flex flex-col gap-1.5">
              {phase.scopeLock.map((f, i) => (
                <li key={i}><span className="text-xs font-mono px-2 py-0.5 rounded bg-elevated text-primary">{f}</span></li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard label="🎯 Expected Result" accentClass="text-primary">
          <p className="text-sm leading-relaxed text-body">{phase.expectedResult}</p>
        </SectionCard>

        <SectionCard label="🧪 Manual Tests" accentClass="text-warning">
          <ul className="flex flex-col gap-2">
            {(phase.manualTests ?? []).map((test, i) => (
              <li key={i} className="flex gap-2 text-xs text-body">
                <span className="shrink-0 text-warning">→</span><span>{test}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <FeedbackButtons phase={phase} onNextPhase={handleNextPhase} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BuildCompanion — top-level router
// ---------------------------------------------------------------------------
export default function BuildCompanion() {
  const { project, specPack, specPackLoading } = useProjectBrain();

  if (project.isLaunchMode) {
    return <LaunchCompanion project={project} specPack={specPack} specPackLoading={specPackLoading} />;
  }

  if (project.isFeatureMode) {
    return <FeatureCompanion project={project} specPack={specPack} specPackLoading={specPackLoading} />;
  }

  // ---- Standard companion ----
  const [phaseIdx, setPhaseIdx]                 = useState(2);
  const [selectedPlatform, setSelectedPlatform] = useState("Replit Agent");

  const phase  = MOCK_PHASES[phaseIdx];
  const isDone = phase.status === "done";

  const handleNextPhase = () => {
    const nextIdx = Math.min(phaseIdx + 1, MOCK_PHASES.length - 1);
    MOCK_PHASES[phaseIdx].status = "done";
    if (nextIdx < MOCK_PHASES.length) MOCK_PHASES[nextIdx].status = "active";
    setPhaseIdx(nextIdx);
  };

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/12">
          <svg className="w-6 h-6 text-primary" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-heading">Phase {phase.id} Complete</p>
        <p className="text-xs text-subtle">Select another phase from the navigator above.</p>
      </div>
    );
  }

  if (phase.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-elevated">
          <svg className="w-5 h-5 text-subtle" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-heading">Phase {phase.id} — Upcoming</p>
        <p className="text-xs leading-relaxed text-subtle">Complete earlier phases to unlock this one.</p>
      </div>
    );
  }

  const platformInfo = PLATFORM_INSTRUCTIONS[selectedPlatform] ?? PLATFORM_INSTRUCTIONS["Replit Agent"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-panel">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Phase {phase.id}</p>
          <h2 className="text-sm font-bold mt-0.5 text-heading">{phase.title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary" />
          <span className="text-xs text-primary">Active</span>
        </div>
      </div>

      <div className="px-4 py-2 shrink-0 border-b border-panel">
        <PhaseNav phases={MOCK_PHASES} currentIdx={phaseIdx} onSelect={setPhaseIdx} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <SectionCard label="📍 Where to paste this" accentClass="text-secondary">
          <div className="flex gap-2 mb-3">
            {Object.keys(PLATFORM_INSTRUCTIONS).map((p) => (
              <button key={p} onClick={() => setSelectedPlatform(p)}
                className={cn("text-xs px-3 py-1.5 rounded-lg transition-all border",
                  selectedPlatform === p ? "bg-secondary/18 text-secondary border-secondary/40" : "bg-elevated text-subtle border-panel hover:text-body")}>
                {PLATFORM_INSTRUCTIONS[p].icon} {p}
              </button>
            ))}
          </div>
          <ol className="flex flex-col gap-1.5">
            {platformInfo.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-body">
                <span className="shrink-0 font-semibold text-secondary">{i + 1}.</span><span>{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <div className="rounded-xl overflow-hidden border border-panel">
          <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-panel">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">📋 Prompt</span>
            <CopyButton text={phase.prompt} />
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed font-mono overflow-y-auto bg-canvas text-body max-h-[200px] whitespace-pre-wrap">
            {phase.prompt}
          </div>
        </div>

        <SectionCard label="🔒 Scope Lock — allowed files only" accentClass="text-error">
          <ul className="flex flex-col gap-1.5">
            {phase.scopeLock.map((f, i) => (
              <li key={i}><span className="text-xs font-mono px-2 py-0.5 rounded bg-elevated text-primary">{f}</span></li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard label="🎯 Expected Result" accentClass="text-primary">
          <p className="text-sm leading-relaxed text-body">{phase.expectedResult}</p>
        </SectionCard>

        <SectionCard label="🧪 Manual Tests" accentClass="text-warning">
          <ul className="flex flex-col gap-2">
            {phase.manualTests.map((test, i) => (
              <li key={i} className="flex gap-2 text-xs text-body">
                <span className="shrink-0 text-warning">→</span><span>{test}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <FeedbackButtons phase={phase} onNextPhase={handleNextPhase} />
      </div>
    </div>
  );
}
