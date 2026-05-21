import { createContext, useContext, useState } from "react";
import { generateSpecPack } from "@/api/generate";
import { generateFeatureSubSpec } from "@/api/feature";
import { generateLaunchReport } from "@/api/launch";
import { createProject, updateProject } from "@/api/projects";
import { generateRenderHtml } from "@/api/render";

// ---------------------------------------------------------------------------
// Flight Recorder helpers
// ---------------------------------------------------------------------------
const LOG_STORAGE_KEY = "project-brain:flight-log";
const MAX_LOG_ENTRIES = 100;

function loadFlightLog() {
  try { return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveFlightLog(log) {
  try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log)); }
  catch {}
}

function makeEntry(fields) {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ProjectBrainContext = createContext(null);

export function ProjectBrainProvider({ children }) {
  const [currentPage, setCurrentPage]           = useState("landing");
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const [project, setProject] = useState({
    name: "My Project",
    buildProgress: 35,
    currentStep: "Scaffolding UI",
    ideaText: "",
    analysis: null,
    answers: {},
    isGameMode: false,
    isFeatureMode: false,
    isLaunchMode: false,
    featurePhases: [],
    launchData: null,
    steps: [
      { id: 1, label: "Project Setup",    status: "done"    },
      { id: 2, label: "UI Shell",         status: "active"  },
      { id: 3, label: "API Integration",  status: "pending" },
      { id: 4, label: "AI Logic",         status: "pending" },
      { id: 5, label: "Deploy",           status: "pending" },
    ],
  });

  const [runtimeArtifacts, setRuntimeArtifacts] = useState([
    { id: "api-server",    label: "API Server",    kind: "api", status: "running" },
    { id: "project-brain", label: "Project Brain", kind: "web", status: "running" },
  ]);

  const [specPack, setSpecPack]               = useState(null);
  const [specPackLoading, setSpecPackLoading] = useState(false);

  const [previewHtml, setPreviewHtml]       = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      role: "assistant",
      text: "Welcome to Project Brain! I'm your build companion. What are we working on today?",
    },
  ]);

  const [companionSteps, setCompanionSteps] = useState([
    { id: 1, label: "Define your project goal",  status: "done"    },
    { id: 2, label: "Choose your stack",          status: "done"    },
    { id: 3, label: "Scaffold the UI shell",      status: "active"  },
    { id: 4, label: "Connect backend API",        status: "pending" },
    { id: 5, label: "Integrate AI features",      status: "pending" },
  ]);

  const [flightLog, setFlightLog] = useState(() => loadFlightLog());

  const addLogEntry = (fields) => {
    const entry = makeEntry(fields);
    setFlightLog((prev) => {
      const next = [...prev, entry].slice(-MAX_LOG_ENTRIES);
      saveFlightLog(next);
      return next;
    });
  };

  const clearFlightLog = () => {
    setFlightLog([]);
    saveFlightLog([]);
  };

  // ---------------------------------------------------------------------------
  // Misc helpers
  // ---------------------------------------------------------------------------
  const addChatMessage = (role, text) =>
    setChatMessages((prev) => [...prev, { id: Date.now(), role, text }]);

  const updateProgress = (progress) =>
    setProject((prev) => ({ ...prev, buildProgress: progress }));

  // ---------------------------------------------------------------------------
  // saveCurrentProject — called by the Header "Save" button
  // Accepts userId from the calling component (which has Clerk access)
  // ---------------------------------------------------------------------------
  const saveCurrentProject = async ({ userId }) => {
    if (!userId) return null;

    const payload = {
      name: project.name,
      mode: project.isLaunchMode ? "launch" : project.isFeatureMode ? "feature" : "spec",
      ideaText: project.ideaText,
      specPack,
      flightLog,
      launchScore: project.launchData?.score ?? null,
    };

    try {
      if (currentProjectId) {
        const updated = await updateProject(currentProjectId, payload);
        return updated.id;
      } else {
        const created = await createProject(payload);
        setCurrentProjectId(created.id);
        return created.id;
      }
    } catch (err) {
      console.error("[saveCurrentProject]", err);
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // generatePreview — builds (or refines) a single-file HTML prototype
  // ---------------------------------------------------------------------------
  const generatePreview = async (message) => {
    setPreviewLoading(true);
    try {
      const html = await generateRenderHtml({
        specPack,
        ideaText:     project.ideaText,
        previousHtml: message ? previewHtml : null,
        message,
      });
      setPreviewHtml(html);
    } catch (err) {
      console.error("[generatePreview]", err);
      throw err;
    } finally {
      setPreviewLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // restoreProject — called from the Saved Projects dashboard
  // ---------------------------------------------------------------------------
  const restoreProject = (savedProject) => {
    const { id, name, mode, ideaText, specPack: pack, flightLog: log, launchScore } = savedProject;

    setCurrentProjectId(id);

    const isFeatureMode = mode === "feature";
    const isLaunchMode  = mode === "launch";

    setProject((prev) => ({
      ...prev,
      name,
      ideaText: ideaText ?? "",
      isFeatureMode,
      isLaunchMode,
      isGameMode: false,
      featurePhases: [],
      launchData: isLaunchMode ? { score: launchScore, categories: [] } : null,
      buildProgress: launchScore ?? (pack ? 40 : 20),
      currentStep: isLaunchMode ? `Launch score: ${launchScore}%` : "Spec pack ready",
      steps: [
        { id: 1, label: "Project restored",   status: "done"   },
        { id: 2, label: "Spec pack loaded",   status: "done"   },
        { id: 3, label: "Continue building",  status: "active" },
        { id: 4, label: "AI Logic",           status: "pending"},
        { id: 5, label: "Deploy",             status: "pending"},
      ],
    }));

    if (pack) setSpecPack(pack);

    if (log && Array.isArray(log)) {
      setFlightLog(log);
      saveFlightLog(log);
    }

    setChatMessages([{
      id: Date.now(),
      role: "assistant",
      text: `Welcome back! I've restored "${name}". Your spec pack and flight history are loaded — ready to continue building?`,
    }]);

    setCurrentPage("cockpit");
  };

  // ---------------------------------------------------------------------------
  // initializeProject — Idea Doctor
  // ---------------------------------------------------------------------------
  const initializeProject = async ({ ideaText, analysis, answers, isGameMode = false, userId = null }) => {
    const projectName = ideaText.length > 40 ? ideaText.slice(0, 40).trim() + "…" : ideaText;

    setProject((prev) => ({
      ...prev,
      name: projectName,
      ideaText,
      analysis,
      answers,
      isGameMode,
      isFeatureMode: false,
      isLaunchMode: false,
      featurePhases: [],
      launchData: null,
      buildProgress: 20,
      currentStep: "Generating spec pack…",
      steps: [
        { id: 1, label: "Idea captured & diagnosed", status: "done"    },
        { id: 2, label: "Generate spec pack",         status: "active"  },
        { id: 3, label: "API Integration",            status: "pending" },
        { id: 4, label: "AI Logic",                   status: "pending" },
        { id: 5, label: "Deploy",                     status: "pending" },
      ],
    }));
    setSpecPack(null);
    setCurrentProjectId(null);
    setChatMessages([{
      id: Date.now(),
      role: "assistant",
      text: `Got it! Generating your spec pack for: "${ideaText.slice(0, 80)}${ideaText.length > 80 ? "…" : ""}"`,
    }]);
    setCurrentPage("cockpit");

    setSpecPackLoading(true);
    try {
      const pack = await generateSpecPack({ ideaText, analysis, answers, isGameMode });
      setSpecPack(pack);

      const appType   = analysis?.appMeta?.label ?? "Unknown";
      const fileCount = Object.keys(pack).length;

      setProject((prev) => ({
        ...prev,
        buildProgress: 40,
        currentStep: "Spec pack ready",
        steps: [
          { id: 1, label: "Idea captured & diagnosed", status: "done"    },
          { id: 2, label: "Generate spec pack",         status: "done"    },
          { id: 3, label: "API Integration",            status: "active"  },
          { id: 4, label: "AI Logic",                   status: "pending" },
          { id: 5, label: "Deploy",                     status: "pending" },
        ],
      }));

      addLogEntry({
        type: "spec_gen",
        title: `Generated Spec Pack — "${projectName}"`,
        summary: `App classified as ${appType}. ${fileCount} spec files generated.`,
        detail: `Idea: ${ideaText}\n\nApp type: ${appType}\nFiles: ${Object.keys(pack).join(", ")}\nGame mode: ${isGameMode}`,
        projectName,
      });

      // Auto-save to DB if signed in
      if (userId) {
        try {
          const saved = await createProject({
            name: projectName,
            mode: "spec",
            ideaText,
            specPack: pack,
            flightLog: [],
            launchScore: null,
          });
          setCurrentProjectId(saved.id);
        } catch (err) {
          console.error("[initializeProject] auto-save failed:", err);
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          text: "Your spec pack is ready! Open SPEC.md, RULES.md, BUILD_PLAN.md, TEST_PLAN.md, and APP_MAP.md in the Artifact Viewer on the left.",
        },
      ]);
    } finally {
      setSpecPackLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // initializeFeature — Feature Builder
  // ---------------------------------------------------------------------------
  const initializeFeature = async ({ existingSpec, featureDescription, userId = null }) => {
    const projectName = featureDescription.length > 40 ? featureDescription.slice(0, 40).trim() + "…" : featureDescription;

    setProject((prev) => ({
      ...prev,
      name: projectName,
      ideaText: featureDescription,
      isFeatureMode: true,
      isGameMode: false,
      isLaunchMode: false,
      featurePhases: [],
      launchData: null,
      buildProgress: 20,
      currentStep: "Building Feature Sub-Spec…",
      steps: [
        { id: 1, label: "Feature captured",          status: "done"    },
        { id: 2, label: "Generate Feature Sub-Spec", status: "active"  },
        { id: 3, label: "Review Scope Lock",         status: "pending" },
        { id: 4, label: "Implement feature",         status: "pending" },
        { id: 5, label: "Verify & test",             status: "pending" },
      ],
    }));
    setSpecPack(null);
    setCurrentProjectId(null);
    setChatMessages([{
      id: Date.now(),
      role: "assistant",
      text: `🔒 Feature Builder Mode activated. Analyzing your architecture for: "${featureDescription.slice(0, 60)}${featureDescription.length > 60 ? "…" : ""}"\n\nCheck CONFLICT_WARNINGS.md before you start.`,
    }]);
    setCurrentPage("cockpit");

    setSpecPackLoading(true);
    try {
      const result = await generateFeatureSubSpec({ existingSpec, featureDescription });
      const { featurePhases = [], ...files } = result;

      setSpecPack(files);
      setProject((prev) => ({
        ...prev,
        featurePhases,
        buildProgress: 40,
        currentStep: "Feature Sub-Spec ready",
        steps: [
          { id: 1, label: "Feature captured",          status: "done"   },
          { id: 2, label: "Generate Feature Sub-Spec", status: "done"   },
          { id: 3, label: "Review Scope Lock",         status: "active" },
          { id: 4, label: "Implement feature",         status: "pending"},
          { id: 5, label: "Verify & test",             status: "pending"},
        ],
      }));

      const hasConflicts = (files["CONFLICT_WARNINGS.md"] ?? "").includes("⚠️");
      const phaseCount   = featurePhases.length;

      addLogEntry({
        type: "feature_add",
        title: `Added Feature — "${projectName}"`,
        summary: `${phaseCount} phase${phaseCount !== 1 ? "s" : ""} generated. ${hasConflicts ? "⚠️ Conflicts detected." : "No conflicts."}`,
        detail: `Feature: ${featureDescription}\n\nPhases: ${phaseCount}\nConflicts: ${hasConflicts ? "Yes" : "None"}`,
        projectName,
      });

      if (userId) {
        try {
          const saved = await createProject({
            name: projectName,
            mode: "feature",
            ideaText: featureDescription,
            specPack: files,
            flightLog: [],
            launchScore: null,
          });
          setCurrentProjectId(saved.id);
        } catch (err) {
          console.error("[initializeFeature] auto-save failed:", err);
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          text: hasConflicts
            ? "⚠️ Feature Sub-Spec ready — conflict warnings detected. Open CONFLICT_WARNINGS.md first."
            : "✅ Feature Sub-Spec ready! No conflicts. Open SCOPE_LOCK.md and start Phase 1.",
        },
      ]);
    } finally {
      setSpecPackLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // initializeLaunch — Launch Coach
  // ---------------------------------------------------------------------------
  const initializeLaunch = async ({ projectSpec, userId = null }) => {
    const projectName = projectSpec.length > 40 ? projectSpec.slice(0, 40).trim() + "…" : projectSpec;

    setProject((prev) => ({
      ...prev,
      name: projectName,
      ideaText: projectSpec,
      isLaunchMode: true,
      isFeatureMode: false,
      isGameMode: false,
      featurePhases: [],
      launchData: null,
      buildProgress: 15,
      currentStep: "Analyzing launch readiness…",
      steps: [
        { id: 1, label: "Spec provided",            status: "done"    },
        { id: 2, label: "Analyze launch readiness", status: "active"  },
        { id: 3, label: "Review checklist",         status: "pending" },
        { id: 4, label: "Fix critical items",       status: "pending" },
        { id: 5, label: "Launch! 🚀",               status: "pending" },
      ],
    }));
    setSpecPack(null);
    setCurrentProjectId(null);
    setChatMessages([{
      id: Date.now(),
      role: "assistant",
      text: "🚀 Launch Coach activated! Analyzing across Production, Security, Database, Legal, and Mobile.",
    }]);
    setCurrentPage("cockpit");

    setSpecPackLoading(true);
    try {
      const result = await generateLaunchReport({ projectSpec });
      const { score, categories, ...files } = result;

      setSpecPack(files);
      setProject((prev) => ({
        ...prev,
        launchData: { score, categories },
        buildProgress: score,
        currentStep: `Launch score: ${score}%`,
        steps: [
          { id: 1, label: "Spec provided",            status: "done"   },
          { id: 2, label: "Analyze launch readiness", status: "done"   },
          { id: 3, label: "Review checklist",         status: "active" },
          { id: 4, label: "Fix critical items",       status: "pending"},
          { id: 5, label: "Launch! 🚀",               status: "pending"},
        ],
      }));

      const criticalCount = (categories ?? [])
        .flatMap((c) => c.items)
        .filter((i) => i.priority === "critical" && i.status !== "done").length;

      const scoreLabel =
        score >= 81 ? "Launch Ready! 🚀" :
        score >= 61 ? "Almost Ready" :
        score >= 31 ? "Needs Work" : "Not Ready";

      addLogEntry({
        type: "launch_score",
        title: `Launch Score: ${score}% — ${scoreLabel}`,
        summary: `${criticalCount} critical item${criticalCount !== 1 ? "s" : ""} remaining.`,
        detail: `Score: ${score}%\nLabel: ${scoreLabel}\nCritical: ${criticalCount}\nCategories: ${(categories ?? []).map((c) => c.label).join(", ")}`,
        projectName,
      });

      if (userId) {
        try {
          const saved = await createProject({
            name: projectName,
            mode: "launch",
            ideaText: projectSpec,
            specPack: files,
            flightLog: [],
            launchScore: score,
          });
          setCurrentProjectId(saved.id);
        } catch (err) {
          console.error("[initializeLaunch] auto-save failed:", err);
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          text: criticalCount > 0
            ? `Launch score: **${score}% — ${scoreLabel}**. ${criticalCount} critical item${criticalCount > 1 ? "s" : ""} need attention before going live.`
            : `Launch score: **${score}% — ${scoreLabel}**. No critical blockers! Work through the remaining items.`,
        },
      ]);
    } finally {
      setSpecPackLoading(false);
    }
  };

  return (
    <ProjectBrainContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        currentProjectId,
        project,
        setProject,
        runtimeArtifacts,
        setRuntimeArtifacts,
        specPack,
        specPackLoading,
        chatMessages,
        setChatMessages,
        addChatMessage,
        companionSteps,
        setCompanionSteps,
        updateProgress,
        initializeProject,
        initializeFeature,
        initializeLaunch,
        saveCurrentProject,
        restoreProject,
        previewHtml,
        setPreviewHtml,
        previewLoading,
        generatePreview,
        flightLog,
        addLogEntry,
        clearFlightLog,
      }}
    >
      {children}
    </ProjectBrainContext.Provider>
  );
}

export function useProjectBrain() {
  const ctx = useContext(ProjectBrainContext);
  if (!ctx) throw new Error("useProjectBrain must be used within ProjectBrainProvider");
  return ctx;
}
