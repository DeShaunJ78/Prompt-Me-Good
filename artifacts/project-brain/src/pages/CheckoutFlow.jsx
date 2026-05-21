import { useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useTier } from "@/context/TierContext";
import { TIER_META } from "@/lib/tiers";
import { createCheckoutSession } from "@/api/stripe";
import { useQueryClient } from "@tanstack/react-query";

const TIER_EMOJI = { builder: "⚡", pro: "🚀" };

// ---------------------------------------------------------------------------
// Utility: card number formatter "1234 5678 9012 3456"
// ---------------------------------------------------------------------------
function formatCardNumber(val) {
  return val
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

// ---------------------------------------------------------------------------
// Order summary — left column
// ---------------------------------------------------------------------------
function OrderSummary({ tierId, meta, billing }) {
  const isAnnual    = billing === "annual";
  const price       = isAnnual ? meta.priceAnnual : meta.price;
  const period      = isAnnual ? "/ mo, billed annually" : "/ month";
  const annualTotal = isAnnual && tierId === "builder" ? "$276 / year" : isAnnual && tierId === "pro" ? "$660 / year" : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-3">Order Summary</p>
        <div className="rounded-2xl border border-panel bg-surface p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-xl border",
              tierId === "builder" ? "bg-primary/10 border-primary/25" : "bg-secondary/10 border-secondary/25",
            )}>
              {TIER_EMOJI[tierId]}
            </div>
            <div>
              <p className="font-bold text-heading">{meta.label} Plan</p>
              <p className="text-xs text-subtle">{isAnnual ? "Annual billing" : "Monthly billing"}</p>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-3xl font-bold text-heading">{price}</span>
            <span className="text-sm text-subtle">{period}</span>
          </div>
          {annualTotal && (
            <p className="text-xs text-success font-semibold mb-3">{annualTotal} · saves 20%</p>
          )}

          <div className="border-t border-panel pt-3 mt-3 space-y-2">
            {meta.features
              .filter((f) => f.included)
              .map((f) => (
                <div key={f.text} className="flex items-center gap-2">
                  <span className="text-success text-xs">✓</span>
                  <span className="text-xs text-body">{f.text}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-elevated border border-panel p-4">
        <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-2">Secure checkout</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>🔒 256-bit SSL</span>
          <span>·</span>
          <span>Cancel anytime</span>
          <span>·</span>
          <span>Instant access</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment form — right column
// ---------------------------------------------------------------------------
function PaymentForm({ tierId, meta, billing, onSuccess }) {
  const { user }       = useUser();
  const queryClient    = useQueryClient();

  const isAnnual = billing === "annual";
  const price    = isAnnual ? meta.priceAnnual : meta.price;
  const period   = isAnnual ? "/mo" : "/mo";

  const [form, setForm] = useState({
    name:       user?.fullName ?? "",
    email:      user?.primaryEmailAddress?.emailAddress ?? "",
    cardNumber: "",
    expiry:     "",
    cvc:        "",
  });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())                                    e.name       = "Name is required.";
    if (!form.email.includes("@"))                            e.email      = "Valid email is required.";
    if (form.cardNumber.replace(/\s/g, "").length < 16)      e.cardNumber = "Enter a complete card number.";
    if (form.expiry.length < 5)                              e.expiry     = "Enter a valid expiry date.";
    if (form.cvc.length < 3)                                 e.cvc        = "Enter your 3-digit CVC.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setApiError("");
    try {
      await createCheckoutSession({
        tier:    tierId,
        billing: billing,
        email:   form.email,
        name:    form.name,
      });
      await queryClient.invalidateQueries({ queryKey: ["tier"] });
      onSuccess();
    } catch (err) {
      setApiError(err.message ?? "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => cn(
    "w-full bg-elevated border rounded-xl px-3.5 py-2.5 text-sm text-body placeholder:text-muted focus:outline-none transition-colors",
    errors[field] ? "border-error/60 focus:border-error" : "border-panel focus:border-primary/50",
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-1">Payment details</p>

      {/* Name */}
      <div>
        <label className="block text-xs text-subtle mb-1.5">Cardholder name</label>
        <input
          type="text"
          className={inputClass("name")}
          placeholder="Jane Smith"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoComplete="name"
        />
        {errors.name && <p className="text-xs text-error mt-1">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs text-subtle mb-1.5">Email</label>
        <input
          type="email"
          className={inputClass("email")}
          placeholder="jane@example.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
        />
        {errors.email && <p className="text-xs text-error mt-1">{errors.email}</p>}
      </div>

      {/* Card number */}
      <div>
        <label className="block text-xs text-subtle mb-1.5">Card number</label>
        <div className="relative">
          <input
            type="text"
            className={cn(inputClass("cardNumber"), "pr-24 font-mono tracking-wider")}
            placeholder="1234 5678 9012 3456"
            value={form.cardNumber}
            onChange={(e) => update("cardNumber", formatCardNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 text-muted text-xs font-bold">
            <span>VISA</span><span>MC</span>
          </div>
        </div>
        {errors.cardNumber && <p className="text-xs text-error mt-1">{errors.cardNumber}</p>}
      </div>

      {/* Expiry + CVC */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-subtle mb-1.5">Expiry date</label>
          <input
            type="text"
            className={cn(inputClass("expiry"), "font-mono")}
            placeholder="MM/YY"
            value={form.expiry}
            onChange={(e) => update("expiry", formatExpiry(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-exp"
          />
          {errors.expiry && <p className="text-xs text-error mt-1">{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-xs text-subtle mb-1.5">CVC</label>
          <input
            type="text"
            className={cn(inputClass("cvc"), "font-mono")}
            placeholder="123"
            value={form.cvc}
            onChange={(e) => update("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="cc-csc"
          />
          {errors.cvc && <p className="text-xs text-error mt-1">{errors.cvc}</p>}
        </div>
      </div>

      {apiError && (
        <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/25 text-error text-sm">
          {apiError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
          tierId === "builder"
            ? "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20"
            : "bg-secondary text-white hover:opacity-90 shadow-lg shadow-secondary/20",
          loading && "opacity-60 cursor-not-allowed",
        )}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          `Pay ${price}${period} →`
        )}
      </button>

      <p className="text-center text-[11px] text-muted">
        By subscribing you agree to our Terms of Service. Cancel anytime from your billing portal.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------
function SuccessScreen({ tierId, meta, onContinue }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6 max-w-md mx-auto">
      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 border-2",
        tierId === "builder" ? "bg-primary/10 border-primary/30" : "bg-secondary/10 border-secondary/30",
      )}>
        {TIER_EMOJI[tierId]}
      </div>

      <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success text-2xl font-bold mb-6 -mt-10 ml-10">
        ✓
      </div>

      <h1 className="text-2xl font-bold text-heading mb-3">
        Welcome to {meta.label}!
      </h1>
      <p className="text-sm text-muted leading-relaxed mb-8">
        Your {meta.label} subscription is now active.
        {tierId === "builder"
          ? " You now have 30 Spec Packs, 100 Companion messages, Launch Coach, and all platform adapters every month."
          : " You now have full access to every CodeMeGood feature — including 100 Spec Packs, Repo Doctor, Pro Mode, and Flight Recorder."}
      </p>

      <div className="w-full rounded-2xl border border-panel bg-surface p-5 mb-8 text-left space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-3">What's unlocked</p>
        {meta.features
          .filter((f) => f.included)
          .map((f) => (
            <div key={f.text} className="flex items-center gap-2">
              <span className="text-success text-xs">✓</span>
              <span className="text-sm text-body">{f.text}</span>
            </div>
          ))}
      </div>

      <button
        onClick={onContinue}
        className={cn(
          "w-full py-3.5 rounded-xl font-bold text-sm transition-all",
          tierId === "builder"
            ? "bg-primary text-white hover:opacity-90"
            : "bg-secondary text-white hover:opacity-90",
        )}
      >
        Go to dashboard →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CheckoutFlow page
// ---------------------------------------------------------------------------
export default function CheckoutFlow() {
  const params        = useParams();
  const search        = useSearch();
  const [, setLocation] = useLocation();
  const { isSignedIn }  = useUser();

  const tierId  = params.tier ?? "builder";
  const billing = new URLSearchParams(search).get("billing") ?? "monthly";
  const meta    = TIER_META[tierId];

  const [stage, setStage] = useState("form");

  if (!meta || tierId === "free") {
    setLocation("/pricing");
    return null;
  }

  if (!isSignedIn) {
    setLocation(`/sign-up?redirect=/checkout/${tierId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Nav */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="flex items-center shrink-0">
            <img
              src="/CodeMeGood_Logo.png"
              alt="CodeMeGood"
              className="h-7 w-auto object-contain"
              style={{ maxWidth: 120 }}
            />
          </a>
          {stage === "form" && (
            <button
              onClick={() => setLocation("/pricing")}
              className="text-xs text-subtle hover:text-body transition-colors flex items-center gap-1"
            >
              ← Back to pricing
            </button>
          )}
        </div>

        {/* Brand header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-subtle mb-1">CodeMeGood</p>
          {stage === "form" ? (
            <h1 className="text-2xl font-bold text-heading">
              Upgrade to {meta.label} {TIER_EMOJI[tierId]}
            </h1>
          ) : null}
        </div>

        {stage === "success" ? (
          <SuccessScreen tierId={tierId} meta={meta} onContinue={() => setLocation("/")} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <OrderSummary tierId={tierId} meta={meta} billing={billing} />
            <div className="rounded-2xl border border-panel bg-surface p-6">
              <PaymentForm
                tierId={tierId}
                meta={meta}
                billing={billing}
                onSuccess={() => setStage("success")}
              />
            </div>
          </div>
        )}

        {/* Test-mode notice */}
        {stage === "form" && (
          <p className="text-center text-[11px] text-muted mt-8">
            ⚡ Payments are in test mode — no real charge will be made. Stripe keys will be added before launch.
          </p>
        )}

      </div>
    </div>
  );
}
