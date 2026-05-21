import { useState } from "react";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";

// ---------------------------------------------------------------------------
// Entry type metadata
// ---------------------------------------------------------------------------
const TYPE_META = {
  spec_gen:       { icon: "📋", label: "Spec Generated",  borderClass: "border-primary",   badgeClass: "text-primary bg-primary/8 border-primary/25"     },
  feature_add:    { icon: "🧩", label: "Feature Added",   borderClass: "border-secondary", badgeClass: "text-secondary bg-secondary/8 border-secondary/25" },
  launch_score:   { icon: "🚀", label: "Launch Scored",   borderClass: "border-success",   badgeClass: "text-success bg-success/8 border-success/25"       },
  phase_complete: { icon: "✅", label: "Phase Complete",  borderClass: "border-primary",   badgeClass: "text-primary bg-primary/8 border-primary/25"       },
  bug_fix:        { icon: "🔧", label: "Recovery Used",   borderClass: "border-warning",   badgeClass: "text-warning bg-warning/8 border-warning/25"       },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(ts) {
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Date.now() - ts;

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;

  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function groupByDay(entries) {
  const groups = new Map();
  [...entries].reverse().forEach((entry) => {
    const d         = new Date(entry.timestamp);
    const now       = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    let key;
    if (d.toDateString() === now.toDateString())       key = "Today";
    else if (d.toDateString() === yesterday.toDateString()) key = "Yesterday";
    else key = d.toLocaleDateString([], { month: "long", day: "numeric" });

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

// ---------------------------------------------------------------------------
// Single entry card
// ---------------------------------------------------------------------------
function EntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[entry.type] ?? TYPE_META.spec_gen;

  return (
    <div className={cn("rounded-lg border-l-2 pl-3 pr-3 py-2.5 bg-canvas", meta.borderClass)}>
      {/* Type badge + timestamp row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] text-subtle font-medium">
          {meta.icon} {formatTime(entry.timestamp)}
        </span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0", meta.badgeClass)}>
          {meta.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-heading leading-snug mb-0.5">{entry.title}</p>

      {/* Summary */}
      {entry.summary && (
        <p className="text-xs text-muted leading-relaxed">{entry.summary}</p>
      )}

      {/* Expand detail */}
      {entry.detail && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-[10px] text-subtle hover:text-body transition-colors"
          >
            {expanded ? "▲ Less" : "▼ Details"}
          </button>
          {expanded && (
            <div className="mt-1.5 px-3 py-2 rounded-lg bg-elevated text-[11px] text-body leading-relaxed whitespace-pre-wrap font-mono max-h-40 overflow-y-auto border border-panel">
              {entry.detail}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-elevated text-xl">
        🗒️
      </div>
      <p className="text-sm font-semibold text-heading">No events yet</p>
      <p className="text-xs text-subtle leading-relaxed max-w-[180px]">
        Your project history will appear here as you generate specs, add features, and fix bugs.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlightRecorder panel
// ---------------------------------------------------------------------------
export default function FlightRecorder() {
  const { flightLog, clearFlightLog } = useProjectBrain();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const groups = groupByDay(flightLog);
  const isEmpty = flightLog.length === 0;

  const handleClear = () => {
    if (showClearConfirm) {
      clearFlightLog();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-panel flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-subtle">Flight Recorder</h2>
          {flightLog.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-elevated text-subtle border border-panel">
              {flightLog.length}
            </span>
          )}
        </div>
        {flightLog.length > 0 && (
          <button
            onClick={handleClear}
            className={cn(
              "text-[10px] transition-colors",
              showClearConfirm ? "text-error font-semibold" : "text-subtle hover:text-body",
            )}
          >
            {showClearConfirm ? "Tap again to clear" : "Clear"}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {[...groups.entries()].map(([dayLabel, dayEntries]) => (
              <div key={dayLabel} className="flex flex-col gap-2">
                {/* Day divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-panel" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-subtle shrink-0 px-1">
                    {dayLabel}
                  </span>
                  <div className="flex-1 h-px bg-panel" />
                </div>

                {/* Entries for this day (newest first) */}
                {dayEntries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="px-4 py-2 border-t border-panel shrink-0">
          <p className="text-[10px] text-subtle text-center">
            {flightLog.length} event{flightLog.length !== 1 ? "s" : ""} recorded · stored locally
          </p>
        </div>
      )}
    </div>
  );
}
