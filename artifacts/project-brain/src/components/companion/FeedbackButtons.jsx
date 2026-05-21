import { useState } from "react";
import { cn } from "@/lib/utils";
import { generateRecoveryPrompt } from "@/api/companion";
import { useProjectBrain } from "@/context/ProjectBrainContext";

const BUTTONS = [
  { id: "yes",     label: "Yes, it worked", emoji: "✅", style: "success" },
  { id: "mostly",  label: "Mostly",          emoji: "🟡", style: "warn"    },
  { id: "no",      label: "No, it failed",  emoji: "❌", style: "danger"  },
  { id: "unknown", label: "I don't know",   emoji: "🤷", style: "muted"   },
];

const BTN_CLASSES = {
  success: { base: "bg-primary/8 border border-primary/25 text-primary", hover: "hover:bg-primary/16 hover:border-primary" },
  warn:    { base: "bg-warning/8 border border-warning/20 text-warning",  hover: "hover:bg-warning/15 hover:border-warning" },
  danger:  { base: "bg-error/8 border border-error/20 text-error",        hover: "hover:bg-error/15 hover:border-error"   },
  muted:   { base: "bg-elevated border border-panel text-body",           hover: "hover:bg-panel" },
};

function BuildReceipt({ phase, onNext }) {
  const { addLogEntry, project } = useProjectBrain();

  const [checked, setChecked] = useState(() =>
    Object.fromEntries((phase.receipt ?? []).map((_, i) => [i, false]))
  );
  const allChecked = Object.values(checked).every(Boolean);
  const toggle = (i) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const handleContinue = () => {
    addLogEntry({
      type: "phase_complete",
      title: `Phase ${phase.id} Complete — ${phase.title}`,
      summary: `All ${phase.receipt?.length ?? 0} receipt items confirmed. Ready to move to the next phase.`,
      detail: phase.receipt?.length
        ? `Receipt items confirmed:\n${phase.receipt.map((r) => `• ${r}`).join("\n")}`
        : "Phase marked complete.",
      projectName: project.name,
    });
    onNext();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl px-4 py-4 bg-primary/6 border border-primary/20">
        <p className="text-xs font-semibold mb-3 text-primary">🧾 Build Receipt — confirm before continuing</p>
        <div className="flex flex-col gap-2">
          {(phase.receipt ?? []).map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer" onClick={() => toggle(i)}>
              <div className={cn(
                "w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center transition-all border",
                checked[i] ? "bg-primary border-primary" : "bg-elevated border-panel"
              )}>
                {checked[i] && (
                  <svg className="w-2.5 h-2.5 text-inverse" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className={cn("text-sm leading-relaxed transition-colors", checked[i] ? "text-subtle line-through" : "text-body")}>
                {item}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!allChecked}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
          allChecked
            ? "bg-cta text-inverse cursor-pointer shadow-glow-primary-sm hover:opacity-90"
            : "bg-elevated text-subtle cursor-not-allowed"
        )}
      >
        Continue to Next Phase →
      </button>
      {!allChecked && <p className="text-xs text-center text-subtle">Check off all items to continue</p>}
    </div>
  );
}

function RecoveryPanel({ phase, onRetry }) {
  const { project, addLogEntry } = useProjectBrain();
  const [issue, setIssue]     = useState("");
  const [prompt, setPrompt]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const generate = async () => {
    if (!issue.trim() || loading) return;
    setLoading(true);
    try {
      const result = await generateRecoveryPrompt({
        issue: issue.trim(),
        phase,
        projectBrain: project,
      });
      setPrompt(result);

      addLogEntry({
        type: "bug_fix",
        title: `Recovery Prompt — Phase ${phase.id}: ${phase.title}`,
        summary: `Issue: "${issue.trim().slice(0, 80)}${issue.trim().length > 80 ? "…" : ""}"`,
        detail: `Phase: ${phase.title}\nIssue reported: ${issue.trim()}\n\nRecovery prompt generated. Scope Lock: ${phase.scopeLock?.join(", ") || "N/A"}`,
        projectName: project.name,
      });
    } catch (err) {
      console.error("[RecoveryPanel] generateRecoveryPrompt error:", err);
      const fallback = `### 🔧 Recovery Prompt — ${phase.title}\n\n**Issue:** ${issue}\n\n**Recovery Steps:**\n1. Undo any partial changes.\n2. Re-read the Scope Lock: touch only \`${phase.scopeLock?.join("`, `") ?? "allowed files"}\`.\n3. Check the error message carefully.\n4. Paste the original phase prompt again.\n5. Run manual tests one by one.\n\nIf the issue persists, describe the exact error message.`;
      setPrompt(fallback);

      addLogEntry({
        type: "bug_fix",
        title: `Recovery Prompt — Phase ${phase.id}: ${phase.title}`,
        summary: `Issue: "${issue.trim().slice(0, 80)}${issue.trim().length > 80 ? "…" : ""}" (fallback used)`,
        detail: `Phase: ${phase.title}\nIssue reported: ${issue.trim()}\n\nFallback recovery prompt used (AI unavailable).`,
        projectName: project.name,
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl px-4 py-3 bg-error/6 border border-error/20">
        <p className="text-xs font-semibold mb-2 text-error">What went wrong?</p>
        <textarea
          className="w-full rounded-lg px-3 py-2 text-sm resize-none bg-canvas border border-panel text-heading placeholder:text-subtle caret-primary focus:outline-none focus:border-error transition-colors min-h-[72px]"
          placeholder="Describe the error or what didn't work as expected…"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          disabled={loading}
        />
        <button
          onClick={generate}
          disabled={!issue.trim() || loading}
          className={cn(
            "mt-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
            issue.trim() && !loading ? "bg-error text-white cursor-pointer hover:opacity-90" : "bg-elevated text-subtle cursor-not-allowed"
          )}
        >
          {loading && (
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "100ms" }} />
              <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "200ms" }} />
            </span>
          )}
          {loading ? "Generating…" : "Generate Recovery Prompt"}
        </button>
      </div>

      {prompt && (
        <div className="rounded-xl overflow-hidden border border-panel">
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-panel">
            <span className="text-xs font-semibold text-secondary">🔧 Recovery Prompt</span>
            <button
              onClick={copy}
              className={cn(
                "text-xs px-3 py-1 rounded-md transition-all border",
                copied ? "bg-primary/15 text-primary border-primary" : "bg-elevated text-muted border-panel hover:text-body"
              )}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <div className="px-4 py-3 text-xs leading-relaxed font-mono overflow-y-auto bg-canvas text-body max-h-[220px] whitespace-pre-wrap">
            {prompt}
          </div>
        </div>
      )}

      <button onClick={onRetry} className="text-xs transition-colors text-subtle hover:text-body">
        ← Try a different response
      </button>
    </div>
  );
}

function UnknownPanel({ onRetry }) {
  return (
    <div className="rounded-xl px-4 py-4 flex flex-col gap-3 bg-secondary/6 border border-secondary/20">
      <p className="text-sm font-semibold text-secondary">🛡 That's okay — here's how to check</p>
      <p className="text-sm leading-relaxed text-body">
        Run the manual tests listed above one by one. If they all pass, treat it as{" "}
        <strong className="text-heading">"Yes, it worked"</strong>. If any fail, choose{" "}
        <strong className="text-heading">"No, it failed"</strong> and describe what you saw.
      </p>
      <button onClick={onRetry} className="text-xs transition-colors text-secondary hover:text-body text-left">
        ← Choose a different answer
      </button>
    </div>
  );
}

export default function FeedbackButtons({ phase, onNextPhase }) {
  const [selected, setSelected] = useState(null);

  if (selected === "yes")                           return <BuildReceipt phase={phase} onNext={onNextPhase} />;
  if (selected === "mostly" || selected === "no")   return <RecoveryPanel phase={phase} onRetry={() => setSelected(null)} />;
  if (selected === "unknown")                       return <UnknownPanel onRetry={() => setSelected(null)} />;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold mb-1 text-subtle">Did this phase work as expected?</p>
      <div className="grid grid-cols-2 gap-2">
        {BUTTONS.map((btn) => {
          const s = BTN_CLASSES[btn.style];
          return (
            <button
              key={btn.id}
              onClick={() => setSelected(btn.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                s.base, s.hover
              )}
            >
              <span>{btn.emoji}</span>
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
