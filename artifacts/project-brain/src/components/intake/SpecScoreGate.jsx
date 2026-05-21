import { cn } from "@/lib/utils";

// ─── Circular SVG ring ────────────────────────────────────────────────────────
const RADIUS = 52;
const CX     = 64;
const CIRCUM = 2 * Math.PI * RADIUS; // ≈ 326.7

function scoreColor(score) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function dimColor(val, max = 20) {
  const pct = val / max;
  if (pct >= 0.8) return "bg-success";
  if (pct >= 0.6) return "bg-warning";
  return "bg-error";
}

function CircularRing({ score }) {
  const color  = scoreColor(score);
  const filled = CIRCUM * (score / 100);
  const offset = CIRCUM - filled;

  return (
    <div className="relative flex items-center justify-center w-36 h-36 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        {/* Track */}
        <circle cx={CX} cy={CX} r={RADIUS} fill="none" stroke="currentColor"
          strokeWidth="10" className="text-panel" />
        {/* Fill */}
        <circle
          cx={CX} cy={CX} r={RADIUS} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUM}`}
          strokeDashoffset={0}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[10px] text-subtle mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Dimension bar ────────────────────────────────────────────────────────────
const DIMS = [
  { key: "clarity",   label: "Clarity",         max: 20 },
  { key: "userFlow",  label: "User Flow",        max: 20 },
  { key: "dataModel", label: "Data Model",       max: 20 },
  { key: "auth",      label: "Auth & Access",    max: 20 },
  { key: "edgeCases", label: "Edge Cases",       max: 20 },
];

function DimBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-subtle w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-panel rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", dimColor(value, max))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-body w-8 text-right">{value}/{max}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SpecScoreGate({ scoreData, loading, onGenerate, onFixGaps }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-5">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-heading">Scoring your spec…</p>
          <p className="text-xs text-subtle">Checking clarity, user flow, data model, auth & edge cases.</p>
        </div>
        <div className="flex flex-col gap-1.5 w-48 mt-1">
          {["Clarity", "User flow", "Data model", "Auth readiness", "Edge cases"].map((d, i) => (
            <div key={d} className="flex items-center gap-2 text-xs text-subtle">
              <span className="w-3 h-3 border border-primary/50 border-t-transparent rounded-full animate-spin"
                style={{ animationDelay: `${i * 150}ms` }} />
              Evaluating {d}…
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!scoreData) return null;

  const { score, breakdown, gaps, summary } = scoreData;
  const color        = scoreColor(score);
  const canGenerate  = score >= 80;
  const allGapsFixed = false; // controlled from parent when gap-fix chat is done

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: color + "22", color }}>
            {score >= 80 ? "✓" : score >= 60 ? "!" : "✗"}
          </div>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
            Spec Quality Score
          </span>
        </div>
        <h2 className="text-2xl font-bold text-heading">
          {canGenerate ? "Your spec is ready to build." : "Your spec needs a little work."}
        </h2>
      </div>

      {/* Score ring + breakdown */}
      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-start bg-elevated border border-panel rounded-xl p-5">
        <CircularRing score={score} />

        <div className="flex-1 w-full flex flex-col gap-3">
          <p className="text-sm text-body leading-relaxed">{summary}</p>
          <div className="flex flex-col gap-2.5 mt-1">
            {DIMS.map((d) => (
              <DimBar key={d.key} label={d.label} value={breakdown?.[d.key] ?? 10} max={d.max} />
            ))}
          </div>
        </div>
      </div>

      {/* Gaps */}
      {gaps && gaps.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-subtle">
            {canGenerate ? "Recommendations" : "What's Missing"}
          </p>
          <ul className="flex flex-col gap-2">
            {gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-body">
                <span className="mt-0.5 text-base leading-none shrink-0"
                  style={{ color: canGenerate ? "#f59e0b" : "#ef4444" }}>
                  {canGenerate ? "·" : "✗"}
                </span>
                <span className="leading-relaxed">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {canGenerate ? (
          <>
            <button
              onClick={onGenerate}
              className="w-full py-3.5 rounded-xl bg-success text-white font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all shadow-md"
            >
              ✓ Generate my Spec Pack
            </button>
            {gaps?.length > 0 && (
              <button
                onClick={onFixGaps}
                className="w-full py-2.5 rounded-xl border border-panel bg-elevated text-body font-semibold text-sm hover:border-primary/40 hover:text-heading transition-all"
              >
                💬 Fix remaining gaps with Build Companion
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={onFixGaps}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all shadow-md"
            >
              💬 Fix these gaps with Build Companion
            </button>
            <button
              onClick={onGenerate}
              className="w-full py-2.5 rounded-xl border border-error/40 bg-error/5 text-error/80 font-semibold text-sm hover:bg-error/10 transition-all"
            >
              Generate Anyway <span className="font-normal opacity-70">(Not Recommended)</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
