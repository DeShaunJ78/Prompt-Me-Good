import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";
import { TIER_META, TIER_ORDER } from "@/lib/tiers";

const TIER_EMOJI = { free: "✨", builder: "⚡", pro: "🚀" };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function BillingToggle({ billing, onChange }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => onChange("monthly")}
        className={cn(
          "text-sm font-semibold transition-colors",
          billing === "monthly" ? "text-body" : "text-subtle hover:text-body",
        )}
      >
        Monthly
      </button>

      <button
        onClick={() => onChange(billing === "monthly" ? "annual" : "monthly")}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
          billing === "annual"
            ? "bg-primary border-primary/60"
            : "bg-elevated border-panel",
        )}
        role="switch"
        aria-checked={billing === "annual"}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            billing === "annual" ? "translate-x-5.5" : "translate-x-1",
          )}
        />
      </button>

      <button
        onClick={() => onChange("annual")}
        className={cn(
          "flex items-center gap-1.5 text-sm font-semibold transition-colors",
          billing === "annual" ? "text-body" : "text-subtle hover:text-body",
        )}
      >
        Annual
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success border border-success/25 font-bold">
          Save 20%
        </span>
      </button>
    </div>
  );
}

function CheckIcon({ included }) {
  return included ? (
    <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center text-success text-[10px] font-bold shrink-0">✓</span>
  ) : (
    <span className="w-4 h-4 rounded-full bg-panel flex items-center justify-center text-subtle text-[10px] shrink-0">✕</span>
  );
}

function TierCard({ tierId, meta, isCurrent, billing, isSignedIn, tier: currentTier, onFree }) {
  const [, setLocation] = useLocation();
  const isAnnual    = billing === "annual";
  const price       = isAnnual ? meta.priceAnnual : meta.price;
  const priceLabel  = isAnnual ? meta.priceAnnualMonthly : meta.priceMonthly;
  const isDowngrade = TIER_ORDER.indexOf(tierId) < TIER_ORDER.indexOf(currentTier ?? "free");
  const isPaid      = tierId !== "free";

  const handleClick = () => {
    if (isCurrent || isDowngrade) return;
    if (tierId === "free") { onFree?.(); return; }
    if (!isSignedIn) { setLocation("/sign-up"); return; }
    setLocation(`/checkout/${tierId}?billing=${billing}`);
  };

  return (
    <div className={cn(
      "relative flex flex-col rounded-2xl border p-6 transition-all",
      meta.highlight
        ? "border-primary/50 bg-primary/5 shadow-xl shadow-primary/10"
        : "border-panel bg-surface",
      isCurrent && "ring-2 ring-primary/40",
    )}>
      {/* Badge */}
      {meta.highlight && !isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-primary text-canvas uppercase tracking-wider shadow-lg">
            Most Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-elevated text-subtle border border-panel uppercase tracking-wider">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{TIER_EMOJI[tierId]}</span>
          <h3 className="font-bold text-heading text-lg">{meta.label}</h3>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold ml-auto", meta.badgeClass)}>
            {meta.badge}
          </span>
        </div>

        {/* Price */}
        <div className="mb-1">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-heading">{price}</span>
            {price !== "$0" && <span className="text-sm text-subtle">/ mo</span>}
          </div>
          <p className="text-xs text-muted mt-0.5">{priceLabel}</p>
          {isAnnual && meta.savings && (
            <p className="text-xs text-success font-semibold mt-1">{meta.savings}</p>
          )}
        </div>

        <p className="text-xs text-muted leading-relaxed mt-3">{meta.description}</p>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {meta.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5">
            <CheckIcon included={f.included} />
            <span className={cn("text-xs leading-relaxed", f.included ? "text-body" : "text-subtle line-through")}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleClick}
        disabled={isCurrent || isDowngrade}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition-all",
          isCurrent
            ? "bg-elevated text-subtle border border-panel cursor-default"
            : isDowngrade
            ? "bg-elevated text-muted border border-panel cursor-not-allowed opacity-50"
            : tierId === "free"
            ? "bg-elevated text-body border border-panel hover:border-primary/40 hover:text-primary"
            : meta.highlight
            ? "bg-cta text-inverse hover:opacity-90 shadow-glow-primary"
            : "bg-elevated text-body border border-panel hover:border-primary/40 hover:text-primary",
        )}
      >
        {isCurrent ? "Current Plan" : isDowngrade ? "Current plan is higher" : meta.cta}
      </button>

      {/* Top-up nudge for paid tiers */}
      {isPaid && !isDowngrade && (
        <p className="text-center text-[11px] text-muted mt-3">
          Need more? Top up anytime.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
const FAQ_ITEMS = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free tier requires no payment details. Upgrade when you're ready.",
  },
  {
    q: "Can I downgrade my plan?",
    a: "Yes, you can switch plans at any time from your billing portal. Downgrades take effect at the end of your billing period.",
  },
  {
    q: "What counts as a Spec Pack?",
    a: "A Spec Pack is one set of output files (SPEC.md, RULES.md, BUILD_PLAN.md, etc.) generated from a project idea.",
  },
  {
    q: "What is the annual discount?",
    a: "Annual plans are billed once per year at a 20% discount vs. monthly. Builder is $276/yr ($23/mo), Pro is $660/yr ($55/mo).",
  },
  {
    q: "What happens when I hit my monthly cap?",
    a: "You'll see a friendly modal — not a hard block — with two options: purchase a one-time top-up credit pack, or upgrade your plan. You can top up Spec Packs ($4.99/+10), Companion messages ($2.99/+50), Live Renders ($4.99/+10), or Repo Doctor runs ($5.99/+3).",
  },
  {
    q: "Is the Flight Recorder saved to the cloud?",
    a: "Yes — on Pro, your flight log is saved with your project and persists across sessions.",
  },
  {
    q: "What platforms do the adapters support?",
    a: "Builder and Pro include tailored prompt packs for Cursor, Replit Agent, and Lovable — each optimised for that tool's strengths.",
  },
];

// ---------------------------------------------------------------------------
// Main Pricing page
// ---------------------------------------------------------------------------
export default function Pricing() {
  const [, setLocation]       = useLocation();
  const { isSignedIn }        = useUser();
  const { tier }              = useTier();
  const [billing, setBilling] = useState("monthly");

  return (
    <div className="min-h-screen bg-canvas px-4 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Nav */}
        <div className="flex items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center shrink-0">
              <img
                src="/CodeMeGood_Logo.png"
                alt="CodeMeGood"
                className="h-7 w-auto object-contain"
                style={{ maxWidth: 120 }}
              />
            </a>
            <button
              onClick={() => setLocation("/")}
              className="text-xs text-subtle hover:text-body transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</span>
          </div>
          <h1 className="text-4xl font-bold text-heading mb-3">
            Build smarter, ship faster
          </h1>
          <p className="text-base text-muted max-w-lg mx-auto leading-relaxed mb-8">
            Start free and upgrade when you need more power. Every tier includes AI-generated spec packs to guide your build.
          </p>

          {/* Billing toggle */}
          <BillingToggle billing={billing} onChange={setBilling} />
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {TIER_ORDER.map((tierId) => (
            <TierCard
              key={tierId}
              tierId={tierId}
              meta={TIER_META[tierId]}
              isCurrent={tier === tierId}
              billing={billing}
              isSignedIn={isSignedIn}
              tier={tier}
              onFree={() => setLocation("/")}
            />
          ))}
        </div>

        {/* Feature comparison note */}
        <div className="flex items-center justify-center gap-3 mb-16 flex-wrap">
          {[
            { icon: "🔒", text: "Cancel anytime" },
            { icon: "⚡", text: "Instant activation" },
            { icon: "🛡️", text: "256-bit SSL" },
            { icon: "💳", text: "All major cards accepted" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-panel text-xs text-subtle">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="border-t border-panel pt-10">
          <h2 className="text-base font-bold text-heading text-center mb-6">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q} className="rounded-xl bg-surface border border-panel p-4">
                <p className="text-sm font-semibold text-heading mb-1">{q}</p>
                <p className="text-xs text-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Billing management link */}
        {isSignedIn && tier !== "free" && (
          <div className="mt-12 text-center">
            <p className="text-xs text-subtle mb-2">Already subscribed?</p>
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
