import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";
import { TIER_META, USAGE_LIMITS, FEATURE_USAGE_LABELS, TOP_UP_PACKS, FEATURE_TOPUP_PACK } from "@/lib/tiers";

function UsageBar({ used, limit, credits, unlimited }) {
  if (unlimited) {
    return (
      <div className="w-full bg-panel rounded-full h-2 overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full rounded-full bg-success/60 w-full" />
      </div>
    );
  }
  const total     = limit + credits;
  const pctSub    = total > 0 ? Math.min(100, Math.round((Math.min(used, limit) / total) * 100)) : 0;
  const pctCredit = credits > 0 && used > limit
    ? Math.min(100, Math.round(((used - limit) / total) * 100))
    : 0;
  const pctUsed    = pctSub + pctCredit;
  const isWarning  = pctUsed >= 80;
  const isExhausted = used >= total;

  return (
    <div className="w-full bg-panel rounded-full h-2 overflow-hidden relative">
      <div
        className={cn(
          "absolute left-0 top-0 h-full rounded-full transition-all",
          isExhausted ? "bg-error" : isWarning ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${pctSub}%` }}
      />
      {pctCredit > 0 && (
        <div
          className="absolute top-0 h-full rounded-full bg-warning"
          style={{ left: `${pctSub}%`, width: `${pctCredit}%` }}
        />
      )}
    </div>
  );
}

function FeatureRow({ feature, item, tier, onTopUp, unlimited }) {
  const { used, limit, credits, label } = item;
  const total     = limit + credits;
  const remaining = unlimited ? "∞" : Math.max(0, total - used);
  const isExhausted = !unlimited && used >= total;
  const isWarning   = !unlimited && !isExhausted && total > 0 && (used / total) >= 0.8;
  const packKey     = FEATURE_TOPUP_PACK[feature];
  const pack        = packKey ? TOP_UP_PACKS[packKey] : null;

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-panel last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-heading">{label}</span>
            {unlimited && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/25">
                Unlimited
              </span>
            )}
            {!unlimited && isExhausted && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-error/15 text-error border border-error/25">
                Cap reached
              </span>
            )}
            {!unlimited && isWarning && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/25">
                Running low
              </span>
            )}
          </div>
          <UsageBar used={used} limit={limit} credits={credits} unlimited={unlimited} />
        </div>

        <div className="text-right shrink-0">
          <p className={cn("text-sm font-bold tabular-nums", isExhausted ? "text-error" : "text-heading")}>
            {used}{unlimited ? "" : <span className="text-subtle font-normal"> / {total}</span>}
          </p>
          <p className="text-[11px] text-muted">{unlimited ? "no cap" : `${remaining} remaining`}</p>
        </div>
      </div>

      {!unlimited && credits > 0 && (
        <p className="text-[11px] text-muted">
          Includes {credits} top-up credit{credits !== 1 ? "s" : ""} added this month
        </p>
      )}

      {!unlimited && (isExhausted || isWarning) && pack && (
        <button
          onClick={() => onTopUp(feature, label, used, limit, credits)}
          className="self-start text-xs font-semibold text-primary hover:underline transition-colors"
        >
          + Top up ({pack.description} · {pack.price}) →
        </button>
      )}

      {!unlimited && (isExhausted || isWarning) && !pack && tier !== "pro" && (
        <p className="text-xs text-muted">Upgrade your plan to increase this allowance.</p>
      )}
    </div>
  );
}

// Founder countdown card
function FounderCard({ daysLeft, expiry, isAdmin }) {
  if (isAdmin) {
    return (
      <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/5 p-5 flex items-start gap-4">
        <span className="text-2xl shrink-0">⚡</span>
        <div>
          <p className="text-sm font-bold text-warning mb-1">Admin Access — Full Unrestricted Access</p>
          <p className="text-xs text-muted leading-relaxed">
            You have full admin access to every feature with no usage caps. This access does not expire.
          </p>
        </div>
      </div>
    );
  }

  if (daysLeft > 0) {
    const expiryDate = expiry ? new Date(expiry).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    return (
      <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-4 mb-3">
          <span className="text-2xl shrink-0">🌟</span>
          <div>
            <p className="text-sm font-bold text-primary mb-1">Founding Member — Full Access</p>
            <p className="text-xs text-muted leading-relaxed">
              You have complete Pro-level access to every feature with no usage caps. This is your reward for being an early builder.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-primary/15">
          <div>
            <p className="text-xs text-muted">Access expires</p>
            <p className="text-sm font-semibold text-heading">{expiryDate}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Days remaining</p>
            <p className={cn(
              "text-2xl font-bold tabular-nums",
              daysLeft <= 7 ? "text-warning" : "text-primary",
            )}>
              {daysLeft}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Expired
  return (
    <div className="mb-6 rounded-2xl border border-panel bg-elevated p-5">
      <div className="flex items-start gap-4 mb-3">
        <span className="text-2xl shrink-0">⏱️</span>
        <div>
          <p className="text-sm font-bold text-heading mb-1">Your founding member period has ended.</p>
          <p className="text-xs text-muted leading-relaxed">
            Thanks for being an early builder. Choose a plan to keep building — your projects and specs are safe.
          </p>
        </div>
      </div>
      <a
        href="/pricing"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all"
      >
        Choose a plan →
      </a>
    </div>
  );
}

export default function UsageDashboard() {
  const [, setLocation] = useLocation();
  const { isSignedIn }  = useUser();
  const { tier, usageData, showTopup, isAdmin, hasFullAccess, isFounderActive, founderDaysLeft, founderAccessExpiry } = useTier();

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-muted mb-4">Sign in to view your usage dashboard.</p>
          <button
            onClick={() => setLocation("/sign-in")}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const effectiveTier = hasFullAccess ? "pro" : tier;
  const limits  = USAGE_LIMITS[effectiveTier] ?? USAGE_LIMITS.free;
  const meta    = TIER_META[effectiveTier] ?? TIER_META.free;

  const features = usageData?.features ?? Object.keys(FEATURE_USAGE_LABELS).map((feature) => ({
    feature,
    label:   FEATURE_USAGE_LABELS[feature],
    used:    0,
    limit:   limits[feature] ?? 0,
    credits: 0,
  }));

  const periodLabel = (() => {
    const now  = new Date();
    const end  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const days = end.getDate() - now.getDate();
    return `${now.toLocaleString("default", { month: "long" })} · ${days} day${days !== 1 ? "s" : ""} remaining`;
  })();

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Back */}
        <button
          onClick={() => setLocation("/")}
          className="text-xs text-subtle hover:text-body transition-colors mb-8 flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Founder / Admin card */}
        {(hasFullAccess || (isFounderActive !== undefined && founderDaysLeft === 0 && usageData?.founderExpired)) && (
          <FounderCard
            daysLeft={founderDaysLeft}
            expiry={founderAccessExpiry}
            isAdmin={isAdmin}
          />
        )}
        {isFounderActive && !isAdmin && (
          <FounderCard
            daysLeft={founderDaysLeft}
            expiry={founderAccessExpiry}
            isAdmin={false}
          />
        )}
        {isAdmin && (
          <FounderCard daysLeft={0} expiry={null} isAdmin={true} />
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-heading mb-1">Usage this month</h1>
            <p className="text-xs text-muted">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs px-2 py-1 rounded-full border font-semibold", meta.badgeClass)}>
              {hasFullAccess ? (isAdmin ? "⚡ Admin" : "🌟 Founding Member") : meta.label}
            </span>
            {!hasFullAccess && (
              <button
                onClick={() => setLocation("/pricing")}
                className="text-xs text-primary hover:underline transition-colors"
              >
                {tier !== "pro" ? "Upgrade →" : "Manage billing →"}
              </button>
            )}
          </div>
        </div>

        {/* Usage list */}
        <div className="rounded-2xl border border-panel bg-surface px-6">
          {features.map((item) => (
            <FeatureRow
              key={item.feature}
              feature={item.feature}
              item={item}
              tier={effectiveTier}
              onTopUp={showTopup}
              unlimited={hasFullAccess}
            />
          ))}
        </div>

        {/* Credits tip — hide for full-access users */}
        {!hasFullAccess && (
          <div className="mt-6 rounded-xl bg-elevated border border-panel p-4">
            <p className="text-xs text-muted leading-relaxed">
              <span className="text-body font-semibold">About credits:</span> When you purchase a top-up, credits are added to your balance and deducted after your subscription allowance is exhausted. Credits roll over until used.
            </p>
          </div>
        )}

        {/* Billing link — hide for admins */}
        {!isAdmin && (
          <div className="mt-6 text-center">
            <a
              href="/api/stripe/portal"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline transition-colors"
            >
              Manage your billing →
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
