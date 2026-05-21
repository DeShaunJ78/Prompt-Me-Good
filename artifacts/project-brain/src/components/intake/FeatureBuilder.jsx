import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const ANALYSIS_STEPS = [
  "Analyzing existing architecture…",
  "Identifying minimum files to touch…",
  "Designing Scope Lock guardrails…",
  "Checking for potential conflicts…",
  "Building integration plan…",
];

const EXAMPLES = [
  "Add a dark mode toggle that persists in localStorage",
  "Add email notifications when a user is mentioned",
  "Add a CSV export button to the data table",
  "Add a search bar that filters the list in real-time",
  "Add Stripe payments to the existing checkout flow",
];

export default function FeatureBuilder({ onSubmit }) {
  const [existingSpec, setExistingSpec]         = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [loading, setLoading]                   = useState(false);
  const [analysisStep, setAnalysisStep]         = useState(0);

  const isValid =
    existingSpec.trim().length >= 30 &&
    featureDescription.trim().length >= 10;

  // Cycle through analysis step labels while loading
  useEffect(() => {
    if (!loading) { setAnalysisStep(0); return; }
    const id = setInterval(() =>
      setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
    2200);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await onSubmit({
        existingSpec: existingSpec.trim(),
        featureDescription: featureDescription.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-secondary/30" />
          <div className="absolute inset-0 rounded-full border-2 border-t-secondary border-r-secondary border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🔒</div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-heading">Building Feature Sub-Spec</p>
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
                i <= analysisStep ? "w-5 bg-secondary" : "w-2 bg-panel"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Existing context */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-semibold text-heading">
            Your existing project context
          </label>
          <span className={cn(
            "text-xs transition-colors",
            existingSpec.length > 200 ? "text-primary" : "text-subtle"
          )}>
            {existingSpec.length} chars
            {existingSpec.length < 30 && existingSpec.length > 0 && " — add more"}
            {existingSpec.length >= 30 && existingSpec.length < 100 && " — good"}
            {existingSpec.length >= 100 && " ✓"}
          </span>
        </div>
        <textarea
          rows={7}
          value={existingSpec}
          onChange={(e) => setExistingSpec(e.target.value)}
          placeholder={`Paste your SPEC.md, describe your stack, or drop in your RULES.md…\n\nExample:\n"React + Vite + Tailwind frontend, Express backend, PostgreSQL DB. Users can sign up and manage a list of bookmarked URLs. Auth via Replit Auth. Two routes: GET /api/bookmarks and POST /api/bookmarks. One table: bookmarks(id, user_id, url, title, created_at)."`}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none bg-elevated border border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-secondary transition-colors leading-relaxed"
        />
        <p className="text-xs text-subtle leading-snug">
          The more context you give, the tighter the Scope Lock will be — and the fewer files your AI tool will accidentally touch.
        </p>
      </div>

      {/* Feature description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-semibold text-heading">
            What new feature do you want to add?
          </label>
          <span className={cn(
            "text-xs transition-colors",
            featureDescription.length >= 10 ? "text-primary" : "text-subtle"
          )}>
            {featureDescription.length >= 10 ? "✓" : `${featureDescription.length}/10 min`}
          </span>
        </div>
        <textarea
          rows={3}
          value={featureDescription}
          onChange={(e) => setFeatureDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && isValid) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Be specific. e.g., 'Add a dark mode toggle that saves to localStorage' or 'Add an export to CSV button on the table page'"
          className="w-full rounded-xl px-4 py-3 text-sm resize-none bg-elevated border border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-secondary transition-colors leading-relaxed"
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setFeatureDescription(ex)}
              className="text-xs px-2.5 py-1 rounded-full border border-panel text-subtle hover:text-body hover:border-panel/60 transition-all bg-elevated"
            >
              {ex.slice(0, 35)}{ex.length > 35 ? "…" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Scope Lock preview badge */}
      <div className={cn(
        "rounded-xl px-4 py-3 flex items-start gap-3 border transition-all",
        isValid
          ? "bg-secondary/8 border-secondary/25"
          : "bg-elevated border-panel opacity-50"
      )}>
        <span className="text-xl shrink-0">🔒</span>
        <div>
          <p className="text-xs font-semibold text-secondary">
            Scope Lock system will activate
          </p>
          <p className="text-xs text-subtle mt-0.5 leading-snug">
            Your Feature Sub-Spec will include explicit guardrails: which files to touch,
            which to leave alone, and a pre-built prompt you can paste directly into Replit Agent or Cursor.
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
            : "bg-elevated text-subtle cursor-not-allowed"
        )}
      >
        <span>🔒</span>
        Generate Feature Sub-Spec
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {!isValid && (existingSpec.length > 0 || featureDescription.length > 0) && (
        <p className="text-xs text-center text-subtle -mt-3">
          {existingSpec.trim().length < 30
            ? "Add at least 30 characters of project context above."
            : "Add at least 10 characters describing the new feature."}
        </p>
      )}
    </div>
  );
}
