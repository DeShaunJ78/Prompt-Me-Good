import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";

// ---------------------------------------------------------------------------
// Builder type cards
// ---------------------------------------------------------------------------
const BUILDER_TYPES = [
  { value: "web_app",  label: "Web App or SaaS",          emoji: "🌐" },
  { value: "website",  label: "Website or Landing Page",   emoji: "🪟" },
  { value: "mobile",   label: "Mobile App",                emoji: "📱" },
  { value: "game",     label: "Game",                      emoji: "🎮" },
  { value: "ai",       label: "AI or Automation Tool",     emoji: "🤖" },
  { value: "unsure",   label: "Not sure yet",              emoji: "🧭" },
];

// ---------------------------------------------------------------------------
// Experience level cards
// ---------------------------------------------------------------------------
const EXPERIENCE_LEVELS = [
  { value: "beginner",     label: "Complete beginner",    sub: "I've never written code" },
  { value: "some",         label: "Some experience",      sub: "I've tried a few things" },
  { value: "comfortable",  label: "Comfortable",          sub: "I use AI tools regularly" },
  { value: "experienced",  label: "Experienced",          sub: "I know what I'm doing" },
];

// ---------------------------------------------------------------------------
// Personalized completion message
// ---------------------------------------------------------------------------
function getPersonalizedMessage(builderType, experienceLevel) {
  const builderLabels = {
    web_app: "Web App & SaaS",
    website: "Website & Landing Page",
    mobile:  "Mobile App",
    game:    "Game Builder",
    ai:      "AI & Automation",
    unsure:  null,
  };

  const experienceNotes = {
    beginner:    "Your Build Companion will guide you through every step, question by question. No experience needed — just your vision.",
    some:        "Guided mode will walk you through each question at your own pace. You can switch to Pro Mode anytime.",
    comfortable: "Guided mode is on by default. Pro Mode is one click away when you want to move faster.",
    experienced: "Pro Mode is highlighted for you — drop your brief directly and skip the intake flow.",
  };

  const label = builderLabels[builderType];
  const note  = experienceNotes[experienceLevel] ?? experienceNotes.some;

  return {
    heading: label ? `Perfect. You're set up for ${label} mode.` : "You're all set.",
    body:    note,
  };
}

// ---------------------------------------------------------------------------
// Step dot indicator
// ---------------------------------------------------------------------------
function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current   ? "w-6 h-2 bg-primary"         : "",
            i < current     ? "w-2 h-2 bg-primary/50"      : "",
            i > current     ? "w-2 h-2 bg-panel"            : "",
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OnboardingFlow — renders as a full-screen overlay
// ---------------------------------------------------------------------------
const STEP = { WELCOME: 0, BUILDER_TYPE: 1, EXPERIENCE: 2, DONE: 3 };

export default function OnboardingFlow() {
  const { showOnboarding, finishOnboarding } = useTier();
  const [, setLocation] = useLocation();

  const [step,            setStep]            = useState(STEP.WELCOME);
  const [builderType,     setBuilderType]      = useState(null);
  const [experienceLevel, setExperienceLevel]  = useState(null);
  const [submitting,      setSubmitting]       = useState(false);
  const [error,           setError]            = useState("");

  if (!showOnboarding) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectBuilderType = (value) => {
    setBuilderType(value);
  };

  const handleSelectExperience = (value) => {
    setExperienceLevel(value);
  };

  const handleAdvanceFromBuilderType = () => {
    if (!builderType) return;
    setStep(STEP.EXPERIENCE);
  };

  const handleCompleteOnboarding = async () => {
    if (!builderType || !experienceLevel) return;
    setSubmitting(true);
    setError("");
    try {
      // Save to backend
      await finishOnboarding(builderType, experienceLevel);

      // Write to localStorage so IdeaFlow and mode selector pick it up instantly
      try {
        localStorage.setItem("cmg_builder_type", builderType);
        localStorage.setItem("cmg_experience_level", experienceLevel);
        localStorage.setItem("cmg_builder_mode", experienceLevel === "experienced" ? "pro" : "guided");
      } catch {}

      setStep(STEP.DONE);
    } catch (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartFirstProject = () => {
    setLocation("/");
  };

  const msg = getPersonalizedMessage(builderType, experienceLevel);

  // ── WELCOME ───────────────────────────────────────────────────────────────
  if (step === STEP.WELCOME) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl">
            🧠
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-heading leading-tight mb-4">
              Welcome to CodeMeGood.
            </h1>
            <p className="text-lg md:text-xl text-body font-medium leading-snug mb-4">
              You bring the vision. We bring the plan. The rest is history.
            </p>
            <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
              Before you start building, let's take 60 seconds to set you up. We'll ask you two quick questions so we can personalize your experience.
            </p>
          </div>

          <button
            onClick={() => setStep(STEP.BUILDER_TYPE)}
            className="mt-2 px-8 py-4 rounded-2xl bg-cta text-inverse font-bold text-base hover:opacity-90 transition-all shadow-glow-primary w-full max-w-xs"
          >
            Let's go →
          </button>
        </div>
      </div>
    );
  }

  // ── BUILDER TYPE ─────────────────────────────────────────────────────────
  if (step === STEP.BUILDER_TYPE) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col px-5 py-10 overflow-y-auto">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-6 flex-1">

          {/* Header */}
          <div className="flex flex-col gap-4">
            <StepDots current={0} total={2} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-1">Step 1 of 2</p>
              <h2 className="text-2xl md:text-3xl font-bold text-heading leading-tight">
                What are you building?
              </h2>
              <p className="text-sm text-muted mt-1">Pick your primary project type.</p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BUILDER_TYPES.map((bt) => (
              <button
                key={bt.value}
                onClick={() => handleSelectBuilderType(bt.value)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-2xl border p-4 md:p-5 text-left transition-all",
                  "min-h-[96px] active:scale-[0.98]",
                  builderType === bt.value
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                    : "border-panel bg-surface hover:border-primary/30 hover:bg-elevated",
                )}
              >
                <span className="text-2xl">{bt.emoji}</span>
                <span className={cn(
                  "text-sm font-semibold leading-snug",
                  builderType === bt.value ? "text-primary" : "text-heading",
                )}>
                  {bt.label}
                </span>
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3 mt-auto pt-4">
            <button
              onClick={handleAdvanceFromBuilderType}
              disabled={!builderType}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-base transition-all",
                builderType
                  ? "bg-cta text-inverse hover:opacity-90 shadow-glow-primary"
                  : "bg-elevated text-subtle cursor-not-allowed",
              )}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EXPERIENCE LEVEL ──────────────────────────────────────────────────────
  if (step === STEP.EXPERIENCE) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col px-5 py-10 overflow-y-auto">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-6 flex-1">

          {/* Header */}
          <div className="flex flex-col gap-4">
            <StepDots current={1} total={2} />
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => setStep(STEP.BUILDER_TYPE)}
                className="text-xs text-subtle hover:text-body transition-colors"
              >
                ← Back
              </button>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-1">Step 2 of 2</p>
              <h2 className="text-2xl md:text-3xl font-bold text-heading leading-tight">
                What's your experience level?
              </h2>
              <p className="text-sm text-muted mt-1">This helps us tune the Build Companion and the intake flow for you.</p>
            </div>
          </div>

          {/* Cards — single column, full width tap targets */}
          <div className="flex flex-col gap-3">
            {EXPERIENCE_LEVELS.map((el) => (
              <button
                key={el.value}
                onClick={() => handleSelectExperience(el.value)}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 md:p-5 text-left transition-all w-full",
                  "active:scale-[0.99]",
                  experienceLevel === el.value
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                    : "border-panel bg-surface hover:border-primary/30 hover:bg-elevated",
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  experienceLevel === el.value
                    ? "border-primary bg-primary"
                    : "border-subtle",
                )}>
                  {experienceLevel === el.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className={cn(
                    "font-semibold text-sm",
                    experienceLevel === el.value ? "text-primary" : "text-heading",
                  )}>
                    {el.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{el.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-error px-1">{error}</p>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3 mt-auto pt-4">
            <button
              onClick={handleCompleteOnboarding}
              disabled={!experienceLevel || submitting}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2",
                experienceLevel && !submitting
                  ? "bg-cta text-inverse hover:opacity-90 shadow-glow-primary"
                  : "bg-elevated text-subtle cursor-not-allowed",
              )}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Setting up…
                </>
              ) : "Let's go →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE — personalized message + CTA ────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">

        <div className="w-14 h-14 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center text-3xl">
          ✓
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-heading leading-tight mb-3">
            {msg.heading}
          </h2>
          <p className="text-sm text-body leading-relaxed max-w-sm mx-auto">
            {msg.body}
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {BUILDER_TYPES.find((b) => b.value === builderType) && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
              {BUILDER_TYPES.find((b) => b.value === builderType)?.emoji}{" "}
              {BUILDER_TYPES.find((b) => b.value === builderType)?.label}
            </span>
          )}
          {EXPERIENCE_LEVELS.find((e) => e.value === experienceLevel) && (
            <span className="text-xs px-3 py-1.5 rounded-full bg-elevated border border-panel text-body font-medium">
              {EXPERIENCE_LEVELS.find((e) => e.value === experienceLevel)?.label}
            </span>
          )}
        </div>

        <button
          onClick={handleStartFirstProject}
          className="mt-2 px-8 py-4 rounded-2xl bg-cta text-inverse font-bold text-base hover:opacity-90 transition-all shadow-glow-primary w-full max-w-xs"
        >
          Start your first project →
        </button>

        <p className="text-xs text-muted">
          You can change these in your profile settings anytime.
        </p>
      </div>
    </div>
  );
}
