import { useState } from "react";
import { cn } from "@/lib/utils";
import { analyzeBug } from "@/api/debug";
import { useProjectBrain } from "@/context/ProjectBrainContext";

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-canvas border border-panel text-subtle hover:text-body hover:border-primary/40 transition-all shrink-0"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ─── Single output card ────────────────────────────────────────────────────────
function ResultCard({ icon, label, text, copyable = false, mono = false }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-panel bg-elevated p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-subtle">{label}</span>
        </div>
        {copyable && <CopyButton text={text} />}
      </div>
      {mono ? (
        <pre className="text-[13px] text-body font-mono leading-relaxed whitespace-pre-wrap break-words bg-canvas rounded-lg px-4 py-3 border border-panel/50">
          {text}
        </pre>
      ) : (
        <p className="text-sm text-body leading-relaxed">{text}</p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function BugTranslator() {
  const { addLogEntry } = useProjectBrain();

  const [errorText, setErrorText] = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const canAnalyze = errorText.trim().length >= 10 && !loading;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeBug({ errorText });
      setResult(data);

      // ── Flight Recorder ───────────────────────────────────────────────────
      const shortTitle = errorText.length > 60
        ? errorText.slice(0, 60).trim() + "…"
        : errorText.trim();

      addLogEntry({
        type:        "bug_fix",
        title:       `Bug Diagnosed — "${shortTitle}"`,
        summary:     data.rootCause,
        detail:      `Error:\n${errorText}\n\nExplanation:\n${data.explanation}\n\nRoot Cause:\n${data.rootCause}\n\nSafe Fix Prompt:\n${data.safeFixPrompt}\n\nPrevention Rule:\n${data.preventionRule}`,
        projectName: "(Debugger)",
      });
    } catch (err) {
      setError("Something went wrong while analyzing your error. Your input is still here — try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setErrorText("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* ── Input phase ─────────────────────────────────────────────────── */}
      {!result && (
        <>
          <textarea
            className="w-full min-h-[180px] md:min-h-[240px] bg-elevated border border-panel rounded-xl px-4 py-4 text-sm text-body placeholder:text-muted resize-none focus:outline-none focus:border-primary/50 leading-relaxed font-mono transition-colors"
            placeholder={
              "Paste your error, stack trace, or describe what broke…\n\nExamples:\n• TypeError: Cannot read properties of undefined (reading 'map')\n• My app crashes when I click submit\n• 500 Internal Server Error from /api/users"
            }
            value={errorText}
            onChange={(e) => setErrorText(e.target.value)}
            autoFocus
          />

          {error && (
            <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/25 text-sm text-error leading-relaxed">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-subtle hidden sm:block">
              Paste any error message, stack trace, or plain-English description.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto",
                canAnalyze
                  ? "bg-primary text-white hover:opacity-90 active:scale-[0.98]"
                  : "bg-elevated border border-panel text-muted cursor-not-allowed",
              )}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                "Analyze Bug →"
              )}
            </button>
          </div>
        </>
      )}

      {/* ── Results phase ───────────────────────────────────────────────── */}
      {result && (
        <>
          <div className="flex flex-col gap-3">
            <ResultCard
              icon="💬"
              label="What happened?"
              text={result.explanation}
            />
            <ResultCard
              icon="🔍"
              label="Root Cause"
              text={result.rootCause}
            />
            <ResultCard
              icon="🛠"
              label="Safe Fix Prompt — paste into your AI IDE"
              text={result.safeFixPrompt}
              copyable
              mono
            />
            <ResultCard
              icon="🛡"
              label="Prevention Rule — add to RULES.md"
              text={result.preventionRule}
              copyable
              mono
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-panel bg-elevated text-sm font-semibold text-subtle hover:text-body hover:border-primary/40 transition-all"
            >
              ← Analyze another bug
            </button>
            <span className="text-xs text-subtle">✓ Logged to your Flight Recorder.</span>
          </div>
        </>
      )}
    </div>
  );
}
