import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const ANALYSIS_STEPS = [
  "Reading project spec…",
  "Evaluating production requirements…",
  "Running security checks…",
  "Checking database setup…",
  "Reviewing legal requirements…",
  "Calculating launch readiness score…",
];

const WHAT_TO_INCLUDE = [
  "What your app does and who uses it",
  "Your tech stack (React, Node, PostgreSQL…)",
  "Whether auth, payments, and a database are implemented",
  "Any existing deployment or hosting setup",
];

const EXAMPLES = [
  "A React + Express app with PostgreSQL, user auth via JWT, Stripe payments",
  "A static marketing site built with Next.js, no auth, no DB",
  "A mobile-first todo app, React Native, Supabase backend, push notifications",
];

export default function LaunchCoach({ onSubmit }) {
  const [projectSpec, setProjectSpec]   = useState("");
  const [loading, setLoading]           = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  const isValid = projectSpec.trim().length >= 20;

  useEffect(() => {
    if (!loading) { setAnalysisStep(0); return; }
    const id = setInterval(
      () => setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      2000,
    );
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await onSubmit({ projectSpec: projectSpec.trim() });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-success/30" />
          <div className="absolute inset-0 rounded-full border-2 border-t-success border-r-success border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🚀</div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-heading">Analyzing Launch Readiness</p>
          <p className="text-sm text-muted transition-all duration-500">
            {ANALYSIS_STEPS[analysisStep]}
          </p>
        </div>
        <div className="flex gap-1 mt-1">
          {ANALYSIS_STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i <= analysisStep ? "w-5 bg-success" : "w-2 bg-panel",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* What to include hint */}
      <div className="rounded-xl border border-panel bg-elevated px-4 py-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-heading">What to include in your spec</p>
        <ul className="flex flex-col gap-1">
          {WHAT_TO_INCLUDE.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-muted">
              <span className="shrink-0 text-success mt-0.5">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Textarea */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-semibold text-heading">
            Describe your app or paste your existing spec
          </label>
          <span className={cn(
            "text-xs transition-colors",
            projectSpec.length >= 20 ? "text-success" : "text-subtle",
          )}>
            {projectSpec.length >= 20 ? "✓ ready" : `${projectSpec.length}/20 min`}
          </span>
        </div>
        <textarea
          rows={7}
          value={projectSpec}
          onChange={(e) => setProjectSpec(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && isValid) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={`Paste your SPEC.md, describe your stack, or just tell us what your app does.\n\nExample: "${EXAMPLES[0]}"`}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none bg-elevated border border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-success transition-colors leading-relaxed"
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setProjectSpec(ex)}
              className="text-xs px-2.5 py-1 rounded-full border border-panel text-subtle hover:text-body hover:border-panel/60 transition-all bg-elevated"
            >
              {ex.slice(0, 40)}…
            </button>
          ))}
        </div>
      </div>

      {/* Score preview callout */}
      <div className={cn(
        "rounded-xl px-4 py-3 flex items-start gap-3 border transition-all",
        isValid ? "bg-success/8 border-success/25" : "bg-elevated border-panel opacity-50",
      )}>
        <span className="text-xl shrink-0">🏆</span>
        <div>
          <p className="text-xs font-semibold text-success">Launch Readiness Score</p>
          <p className="text-xs text-subtle mt-0.5 leading-snug">
            We'll score your app 0–100% across five categories: Production, Security, Database, Legal, and Mobile — with a checklist you can tick off as you fix things.
          </p>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid}
        className={cn(
          "w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
          isValid
            ? "bg-cta text-inverse cursor-pointer shadow-glow-primary hover:opacity-90"
            : "bg-elevated text-subtle cursor-not-allowed",
        )}
      >
        <span>🚀</span>
        Analyze Launch Readiness
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {!isValid && projectSpec.length > 0 && (
        <p className="text-xs text-center text-subtle -mt-3">
          Add a bit more detail (at least 20 characters) for a meaningful analysis.
        </p>
      )}
    </div>
  );
}
