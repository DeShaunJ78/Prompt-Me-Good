import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import { useTier } from "@/context/TierContext";
import IdeaFlow from "@/components/intake/IdeaFlow";
import FeatureBuilder from "@/components/intake/FeatureBuilder";
import LaunchCoach from "@/components/intake/LaunchCoach";
import BugTranslator from "@/components/debugger/BugTranslator";

const INTAKE_MODE = { IDEA: "idea", FEATURE: "feature", LAUNCH: "launch", DEBUG: "debug" };

const MODE_TABS = [
  { id: INTAKE_MODE.IDEA,    icon: "💡", label: "New Project",  mobileLabel: "New",     feature: null              },
  { id: INTAKE_MODE.FEATURE, icon: "🧩", label: "Add a Feature", mobileLabel: "Feature", feature: "feature_builder" },
  { id: INTAKE_MODE.LAUNCH,  icon: "🚀", label: "Launch Coach",  mobileLabel: "Launch",  feature: "launch_coach"    },
  { id: INTAKE_MODE.DEBUG,   icon: "🐛", label: "Debugger",      mobileLabel: "Debug",   feature: null              },
];

const HEADER_META = {
  [INTAKE_MODE.FEATURE]: {
    badge: "Feature Builder", badgeClass: "text-secondary", dotClass: "bg-secondary",
    h1:  "Add a feature to your existing project.",
    sub: "Paste your existing spec or describe your stack. We'll generate a Feature Sub-Spec with strict Scope Lock guardrails.",
  },
  [INTAKE_MODE.LAUNCH]: {
    badge: "Launch Coach", badgeClass: "text-success", dotClass: "bg-success",
    h1:  "Is your app ready to launch?",
    sub: "Describe your app and we'll score it across Production, Security, Database, Legal, and Mobile — with a checklist so you know exactly what to fix.",
  },
  [INTAKE_MODE.DEBUG]: {
    badge: "Bug Translator", badgeClass: "text-error", dotClass: "bg-error",
    h1:  "What broke? I'll translate it.",
    sub: "Paste your error, stack trace, or describe what went wrong. I'll explain it in plain English and give you the exact prompt to fix it — without breaking anything else.",
  },
};

export default function Landing() {
  const { initializeProject, initializeFeature, initializeLaunch } = useProjectBrain();
  const { isSignedIn, user }  = useUser();
  const [, setLocation]       = useLocation();
  const { gate, can }         = useTier();
  const userId                = user?.id ?? null;

  const [intakeMode, setIntakeMode] = useState(INTAKE_MODE.IDEA);
  const [specLoading, setSpecLoading] = useState(false);

  const isIdeaMode = intakeMode === INTAKE_MODE.IDEA;

  const handleModeSwitch = (mode) => {
    const tab = MODE_TABS.find((t) => t.id === mode);
    if (tab?.feature && !gate(tab.feature)) return;
    setIntakeMode(mode);
  };

  const handleIdeaFlowComplete = async ({ rawIdea, analysis, answers, isGameMode }) => {
    setSpecLoading(true);
    try {
      await initializeProject({ ideaText: rawIdea, analysis: analysis ?? {}, answers, isGameMode, userId });
    } catch (err) {
      console.error("[handleIdeaFlowComplete]", err);
    } finally {
      setSpecLoading(false);
    }
  };

  const handleFeatureSubmit = async ({ existingSpec, featureDescription }) => {
    await initializeFeature({ existingSpec, featureDescription, userId });
  };

  const handleLaunchSubmit = async ({ projectSpec }) => {
    await initializeLaunch({ projectSpec, userId });
  };

  const meta = HEADER_META[intakeMode];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">

      {/* ── Top nav ── always visible ─────────────────────────────────────── */}
      <div className="shrink-0">
        {/* Primary row: logo + auth */}
        <div className={cn(
          "flex items-center justify-between gap-3 px-4",
          isIdeaMode ? "py-2.5 border-b border-panel/50" : "pt-4",
        )}>
          {/* Logo + tagline */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/CodeMeGood_Logo.png"
              alt="CodeMeGood"
              className="h-7 w-auto object-contain"
              style={{ maxWidth: 120 }}
            />
            <span className="hidden lg:block text-[11px] text-subtle group-hover:text-muted transition-colors border-l border-panel pl-2.5 leading-tight max-w-[200px]">
              You bring the vision. We bring the plan. The rest is history.
            </span>
          </a>

          {/* Mode tabs — desktop only in this row (hidden on mobile, shown in second row below) */}
          {isIdeaMode && (
            <div className="hidden sm:flex p-0.5 rounded-xl bg-elevated border border-panel">
              {MODE_TABS.map((tab) => {
                const isLocked = tab.feature && !can(tab.feature);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleModeSwitch(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all",
                      intakeMode === tab.id
                        ? "bg-canvas text-heading shadow-sm border border-panel"
                        : "text-subtle hover:text-body",
                      isLocked && "opacity-70",
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {isLocked && <span className="text-[9px] opacity-70">🔒</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Auth buttons */}
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <button
                onClick={() => setLocation("/projects")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-elevated border border-panel text-subtle hover:text-body hover:border-primary/40 transition-all"
              >
                <span className="hidden sm:inline">My Projects</span>
                <span className="sm:hidden">Projects</span>
                <span>→</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setLocation("/sign-in")}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-panel bg-elevated text-subtle hover:text-body transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setLocation("/sign-up")}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile-only second row: mode tabs */}
        {isIdeaMode && (
          <div className="sm:hidden flex p-1 border-b border-panel/40 bg-canvas gap-0.5">
            {MODE_TABS.map((tab) => {
              const isLocked = tab.feature && !can(tab.feature);
              return (
                <button
                  key={tab.id}
                  onClick={() => handleModeSwitch(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold transition-all min-w-0",
                    intakeMode === tab.id
                      ? "bg-elevated text-heading border border-panel shadow-sm"
                      : "text-subtle hover:text-body",
                    isLocked && "opacity-70",
                  )}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="truncate">{tab.mobileLabel}</span>
                  {isLocked && <span className="text-[9px] opacity-60 shrink-0">🔒</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── IDEA MODE: IdeaFlow owns the full remaining height ── */}
      {isIdeaMode && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <IdeaFlow
            onComplete={handleIdeaFlowComplete}
            userId={userId}
            loading={specLoading}
          />
        </div>
      )}

      {/* ── FEATURE / LAUNCH: centered layout with header ── */}
      {!isIdeaMode && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">

            {/* Header */}
            <div className="text-center flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", meta.dotClass)} />
                <span className={cn("text-xs font-semibold uppercase tracking-widest", meta.badgeClass)}>
                  {meta.badge}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold leading-tight text-heading">{meta.h1}</h1>
              <p className="text-base text-muted">{meta.sub}</p>
            </div>

            {/* Mode tabs */}
            <div className="flex p-1 rounded-xl bg-elevated border border-panel self-center">
              {MODE_TABS.map((tab) => {
                const isLocked = tab.feature && !can(tab.feature);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleModeSwitch(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                      intakeMode === tab.id
                        ? "bg-canvas text-heading shadow-sm border border-panel"
                        : "text-subtle hover:text-body",
                      isLocked && "opacity-70",
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {isLocked && <span className="text-[10px]">🔒</span>}
                  </button>
                );
              })}
            </div>

            {/* Feature Builder */}
            {intakeMode === INTAKE_MODE.FEATURE && (
              <FeatureBuilder onSubmit={handleFeatureSubmit} />
            )}

            {/* Launch Coach */}
            {intakeMode === INTAKE_MODE.LAUNCH && (
              <LaunchCoach onSubmit={handleLaunchSubmit} />
            )}

            {/* Bug Translator */}
            {intakeMode === INTAKE_MODE.DEBUG && (
              <BugTranslator />
            )}

          </div>
        </div>
      )}
    </div>
  );
}
