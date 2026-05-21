import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";
import { TIER_META, TIER_ORDER, requiredTierForFeature, FEATURE_LABELS } from "@/lib/tiers";

const TIER_EMOJI = { free: "✨", builder: "⚡", pro: "🚀" };

export default function UpgradeModal() {
  const { upgradeModal, closeUpgrade, tier } = useTier();
  const [, setLocation] = useLocation();

  if (!upgradeModal.open) return null;

  const feature     = upgradeModal.feature;
  const isLimit     = feature === "spec_pack_limit";
  const required    = isLimit ? "builder" : requiredTierForFeature(feature);
  const featureLabel = isLimit
    ? "Unlimited Spec Packs"
    : (FEATURE_LABELS[feature] ?? "this feature");
  const requiredMeta = TIER_META[required] ?? TIER_META.builder;
  const currentIdx   = TIER_ORDER.indexOf(tier);
  const requiredIdx  = TIER_ORDER.indexOf(required);

  // Which tier jump(s) to show as CTAs
  const ctas = TIER_ORDER.slice(requiredIdx).map((t) => TIER_META[t]);

  const handleGoToPricing = () => {
    closeUpgrade();
    setLocation("/pricing");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={closeUpgrade}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-panel bg-surface shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-panel">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl">
                  🔒
                </div>
                <div>
                  <h2 className="font-bold text-heading text-base leading-tight">
                    {TIER_EMOJI[required]} Upgrade to {requiredMeta.label}
                  </h2>
                  <p className="text-xs text-subtle mt-0.5">
                    {isLimit
                      ? "You've used all 3 of your free Spec Packs this month."
                      : `${featureLabel} requires ${requiredMeta.label} or above.`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeUpgrade}
                className="text-subtle hover:text-body transition-colors text-lg leading-none mt-0.5"
              >
                ×
              </button>
            </div>
          </div>

          {/* What you unlock */}
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-3">
              Unlocked with {requiredMeta.label}
            </p>
            <ul className="space-y-2">
              {requiredMeta.features
                .filter((f) => f.included)
                .slice(0, 5)
                .map((f) => (
                  <li key={f.text} className="flex items-center gap-2 text-sm text-body">
                    <span className="text-success text-xs">✓</span>
                    {f.text}
                  </li>
                ))}
            </ul>
          </div>

          {/* CTAs */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            <button
              onClick={handleGoToPricing}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-cta text-inverse hover:opacity-90 transition-all"
            >
              See all plans →
            </button>
            <button
              onClick={closeUpgrade}
              className="w-full py-2.5 rounded-xl text-sm text-subtle border border-panel hover:text-body transition-all"
            >
              Maybe later
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
