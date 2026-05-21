import { useTier } from "@/context/TierContext";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function SmartUpgradeNudge() {
  const { upgradeNudge, clearNudge, tier } = useTier();
  const [, setLocation] = useLocation();

  if (!upgradeNudge.show) return null;

  const nextTierId = tier === "free" ? "builder" : tier === "builder" ? "pro" : null;

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 animate-in slide-in-from-bottom-2 duration-300",
    )}>
      <div className="flex items-start gap-3 bg-surface border border-primary/30 rounded-2xl shadow-xl shadow-black/30 px-5 py-4">
        <span className="text-lg shrink-0">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-heading mb-0.5">Smart upgrade suggestion</p>
          <p className="text-xs text-body leading-relaxed">{upgradeNudge.message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {nextTierId && (
            <button
              onClick={() => { clearNudge(); setLocation(`/checkout/${nextTierId}`); }}
              className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Switch now →
            </button>
          )}
          <button
            onClick={clearNudge}
            className="text-subtle hover:text-body transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
