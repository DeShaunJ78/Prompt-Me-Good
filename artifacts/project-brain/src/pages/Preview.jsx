import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", icon: "🖥", width: null,    frame: null  },
  { id: "tablet",  label: "Tablet",  icon: "⬜", width: "768px", frame: "md"  },
  { id: "mobile",  label: "Mobile",  icon: "📱", width: "390px", frame: "sm"  },
];

function LoadingShimmer() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0F1117]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#9CA3AF] font-medium">Building your prototype…</p>
        <p className="text-xs text-[#4B5563]">This usually takes 10–20 seconds</p>
      </div>
      <div className="flex flex-col gap-2 w-64 mt-4">
        {[80, 60, 70, 50].map((w, i) => (
          <div key={i} className="h-2 rounded-full bg-[#1F2937] overflow-hidden">
            <div className="h-full bg-[#14B8A6]/30 rounded-full animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanionMessage({ role, text }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[88%] px-3 py-2 rounded-xl text-xs leading-relaxed",
        role === "user"
          ? "bg-primary/15 text-primary rounded-br-sm"
          : "bg-elevated text-body border border-panel rounded-bl-sm"
      )}>
        {text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-elevated border border-panel px-3 py-2.5 rounded-xl rounded-bl-sm">
        <span className="inline-flex gap-1 items-center">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 bg-subtle rounded-full animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export default function Preview() {
  const { project, specPack, previewHtml, previewLoading, generatePreview } = useProjectBrain();
  const [, setLocation] = useLocation();

  const [viewport, setViewport]   = useState("desktop");
  const [showCode, setShowCode]   = useState(false);
  const [messages, setMessages]   = useState([
    { role: "assistant", text: "I can help you refine this prototype. Try: \"Make the header teal\", \"Add a dark mode toggle\", or \"Show a login modal\"." },
  ]);
  const [input, setInput]         = useState("");
  const [refining, setRefining]   = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  const vp = VIEWPORTS.find((v) => v.id === viewport) ?? VIEWPORTS[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, refining]);

  const handleRefine = useCallback(async (msg) => {
    const trimmed = msg.trim();
    if (!trimmed || refining || previewLoading) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setRefining(true);
    try {
      await generatePreview(trimmed);
      setMessages((prev) => [...prev, { role: "assistant", text: "Done! The prototype has been updated. Let me know if you want any other changes." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong generating the update. Please try again." }]);
    } finally {
      setRefining(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [refining, previewLoading, generatePreview]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(input); }
  };

  const copyCode = () => {
    if (previewHtml) navigator.clipboard.writeText(previewHtml);
  };

  const isLoading = previewLoading || refining;

  return (
    <div className="min-h-screen flex flex-col bg-canvas overflow-hidden" style={{ height: "100dvh" }}>

      {/* ── Top bar ── */}
      <div className="h-12 flex items-center px-3 gap-2 shrink-0 bg-surface border-b border-panel">
        <button
          onClick={() => setLocation("/cockpit")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-panel bg-elevated text-subtle hover:text-body transition-all shrink-0"
        >
          ← Back
        </button>

        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-heading truncate">{project.name || "Prototype"}</span>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              Generating…
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-elevated border border-panel rounded-lg p-0.5 ml-auto">
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewport(v.id)}
              title={v.label}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                viewport === v.id
                  ? "bg-surface text-heading shadow-sm border border-panel"
                  : "text-subtle hover:text-body"
              )}
            >
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden">{v.icon}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCode((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0",
            showCode
              ? "bg-secondary/12 text-secondary border-secondary/30"
              : "bg-elevated text-subtle border-panel hover:text-body"
          )}
        >
          <span className="font-mono">&lt;/&gt;</span>
          <span className="hidden sm:inline">Code</span>
        </button>

        <button
          onClick={() => generatePreview()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-elevated text-subtle border-panel hover:text-body transition-all shrink-0 disabled:opacity-40"
        >
          ↺ <span className="hidden sm:inline">Regen</span>
        </button>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Preview / Code area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          {showCode ? (
            /* ── Code View ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 shrink-0 bg-surface border-b border-panel">
                <span className="text-xs font-mono text-subtle">index.html</span>
                <button
                  onClick={copyCode}
                  className="px-2.5 py-1 rounded-lg text-xs border bg-elevated text-subtle border-panel hover:text-body transition-all"
                >
                  Copy
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-body leading-relaxed whitespace-pre-wrap break-words">
                {previewHtml ?? "Your prototype code will appear here once you've run a Live Render."}
              </pre>
            </div>
          ) : previewLoading && !previewHtml ? (
            /* ── Initial load shimmer ── */
            <LoadingShimmer />
          ) : (
            /* ── Viewport + iframe ── */
            <div className="flex-1 flex items-start justify-center overflow-auto p-4">
              <div
                className={cn(
                  "relative h-full bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300 flex flex-col",
                  vp.frame === "sm" && "ring-4 ring-[#1F2937] ring-offset-0 rounded-[2rem]",
                  vp.frame === "md" && "ring-2 ring-[#1F2937]",
                )}
                style={{
                  width:    vp.width  ?? "100%",
                  minWidth: vp.width  ?? "100%",
                  minHeight: "100%",
                }}
              >
                {/* Mobile notch decoration */}
                {vp.frame === "sm" && (
                  <div className="shrink-0 flex items-center justify-center bg-[#0F1117] py-2">
                    <div className="w-20 h-1.5 bg-[#374151] rounded-full" />
                  </div>
                )}

                {previewLoading && previewHtml ? (
                  /* Overlay shimmer during refinement */
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0F1117]/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-[#9CA3AF]">Updating prototype…</p>
                    </div>
                  </div>
                ) : null}

                <iframe
                  key={previewHtml?.slice(0, 40)}
                  srcDoc={previewHtml ?? ""}
                  sandbox="allow-scripts allow-forms allow-modals"
                  title="App Preview"
                  className="flex-1 w-full border-none"
                />

                {/* Mobile home indicator */}
                {vp.frame === "sm" && (
                  <div className="shrink-0 flex items-center justify-center bg-[#0F1117] py-2">
                    <div className="w-28 h-1 bg-[#374151] rounded-full" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Companion panel ── */}
        <div className="w-72 shrink-0 flex flex-col border-l border-panel bg-surface overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 shrink-0 border-b border-panel">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <p className="text-xs font-semibold uppercase tracking-widest text-subtle">Build Companion</p>
            </div>
            <p className="text-xs text-muted mt-0.5 leading-snug">Describe a change and I'll re-render the prototype</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {messages.map((m, i) => (
              <CompanionMessage key={i} role={m.role} text={m.text} />
            ))}
            {refining && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts (only when idle and no user messages) */}
          {messages.length === 1 && !refining && (
            <div className="px-3 pb-2 flex flex-col gap-1.5 shrink-0">
              <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">Try asking:</p>
              {[
                "Switch to light mode",
                "Add a navigation sidebar",
                "Make the primary color purple",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => handleRefine(s)}
                  disabled={isLoading}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-panel bg-elevated text-subtle hover:text-body hover:border-primary/40 transition-all disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 shrink-0 border-t border-panel">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 min-w-0 bg-elevated border border-panel rounded-lg px-3 py-2 text-xs text-body placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors"
                placeholder={isLoading ? "Generating…" : "Describe a change…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                onClick={() => handleRefine(input)}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
