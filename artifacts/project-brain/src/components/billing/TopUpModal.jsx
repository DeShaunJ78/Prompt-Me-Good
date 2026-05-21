import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";
import { TIER_META, TOP_UP_PACKS, FEATURE_TOPUP_PACK } from "@/lib/tiers";
import { purchaseTopup } from "@/api/usage";
import { useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// TopUpModal — shown when a user hits their monthly cap on any feature
// ---------------------------------------------------------------------------
export default function TopUpModal() {
  const { topupModal, closeTopup, tier, setUpgradeNudge } = useTier();
  const [, setLocation] = useLocation();
  const queryClient     = useQueryClient();

  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(null);
  const [apiError, setApiError] = useState("");

  const { open, feature, label, used, limit, credits } = topupModal;

  if (!open) return null;

  const packKey     = feature ? FEATURE_TOPUP_PACK[feature] : null;
  const pack        = packKey ? TOP_UP_PACKS[packKey] : null;
  const bundlePack  = TOP_UP_PACKS.builder_boost_bundle;

  const nextTierName = tier === "free" ? "Builder" : tier === "builder" ? "Pro" : null;
  const nextTierId   = tier === "free" ? "builder" : tier === "builder" ? "pro" : null;
  const nextMeta     = nextTierId ? TIER_META[nextTierId] : null;

  const handleTopup = async (selectedPack) => {
    setLoading(true);
    setApiError("");
    try {
      const result = await purchaseTopup(selectedPack);
      await queryClient.invalidateQueries({ queryKey: ["usage"] });
      await queryClient.invalidateQueries({ queryKey: ["tier"] });
      setSuccess(result.label);
      if (result.nudge?.show) {
        setUpgradeNudge(result.nudge.message);
      }
      setTimeout(() => { setSuccess(null); closeTopup(); }, 2500);
    } catch (err) {
      setApiError("Something went wrong with the purchase — your card wasn't charged. Try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-panel shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl mb-2">📦</div>
              <h2 className="text-base font-bold text-heading">
                You've used all {limit} of your {label ?? "uses"} this month
              </h2>
              <p className="text-xs text-muted mt-1">
                You've used {used} / {limit}{credits > 0 ? ` + ${credits} credits` : ""}. No worries — you have two ways to keep going.
              </p>
            </div>
            <button
              onClick={closeTopup}
              className="text-subtle hover:text-body transition-colors shrink-0 mt-1 text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* Success screen */}
        {success && (
          <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success text-xl">✓</div>
            <p className="font-semibold text-heading">{success} added!</p>
            <p className="text-xs text-muted">Your credits are ready to use.</p>
          </div>
        )}

        {!success && (
          <div className="px-6 py-5 flex flex-col gap-4">

            {apiError && (
              <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/25 text-error text-sm">
                {apiError}
              </div>
            )}

            {/* Option A — Top-Up Pack */}
            {(pack || bundlePack) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2">Option A — One-Time Top-Up</p>
                <div className="flex flex-col gap-2">

                  {/* Feature-specific pack */}
                  {pack && packKey && (
                    <button
                      onClick={() => handleTopup(packKey)}
                      disabled={loading}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border border-panel bg-elevated hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-heading">{pack.description}</p>
                        <p className="text-xs text-muted mt-0.5">{pack.label} · one-time</p>
                      </div>
                      <span className="text-sm font-bold text-primary shrink-0">{pack.price}</span>
                    </button>
                  )}

                  {/* Bundle — always shown for paid tiers */}
                  {tier !== "free" && (
                    <button
                      onClick={() => handleTopup("builder_boost_bundle")}
                      disabled={loading}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-semibold text-heading">{bundlePack.label}</p>
                        <p className="text-xs text-muted mt-0.5">{bundlePack.description}</p>
                      </div>
                      <span className="text-sm font-bold text-primary shrink-0">{bundlePack.price}</span>
                    </button>
                  )}

                  {loading && (
                    <div className="flex items-center justify-center gap-2 py-1 text-xs text-subtle">
                      <span className="w-3 h-3 border border-primary/50 border-t-primary rounded-full animate-spin" />
                      Processing…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Option B — Upgrade */}
            {nextMeta && nextTierId && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2">Option B — Upgrade Your Plan</p>
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    nextTierId === "builder"
                      ? "border-primary/40 bg-primary/5"
                      : "border-secondary/40 bg-secondary/5",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-heading">{nextMeta.label} Plan</p>
                    <span className={cn("text-sm font-bold", nextTierId === "builder" ? "text-primary" : "text-secondary")}>
                      {nextMeta.price}/mo
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-3 leading-relaxed">
                    {nextTierId === "builder"
                      ? `Get 30 Spec Packs, 100 Companion messages, 30 Bug Translator uses, and 5 Live Renders every month — plus all platform adapters.`
                      : `Get 100 Spec Packs, 500 Companion messages, 10 Repo Doctor runs, Pro Mode, and 50 Live Renders every month.`}
                  </p>
                  <button
                    onClick={() => { closeTopup(); setLocation(`/checkout/${nextTierId}`); }}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
                      nextTierId === "builder"
                        ? "bg-primary text-white hover:opacity-90"
                        : "bg-secondary text-white hover:opacity-90",
                    )}
                  >
                    Upgrade to {nextMeta.label} →
                  </button>
                </div>
              </div>
            )}

            {/* No upgrade path (already Pro) */}
            {!nextMeta && (
              <p className="text-xs text-center text-muted py-2">
                You're on the Pro plan. Top up above or{" "}
                <a href="/api/stripe/portal" target="_blank" className="text-primary hover:underline">manage your billing</a>.
              </p>
            )}

            <p className="text-center text-[11px] text-muted">
              ⚡ Payments are in test mode — no real charge will be made.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
