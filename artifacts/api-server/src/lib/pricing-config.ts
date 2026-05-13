/* ============================================================================
 * PromptMeGood — Centralized Pricing & Caps Config (Backend)
 * ----------------------------------------------------------------------------
 * Single source of truth for prices, plan limits, and trial windows on the
 * server side. Mirrors `artifacts/promptmegood/public/scripts/pmg-pricing-config.js`.
 * Stripe Price IDs continue to live in environment variables — this module
 * never holds a Stripe identifier, only the dollar values used in user-facing
 * copy and the per-plan daily caps used by `userCaps.ts`.
 *
 * pricing-rebalance-1 (2026-05-12): unit-economics rebalance after the
 * RUN_MAX_INPUT/OUTPUT bump (run-cap-2) raised per-Run worst-case cost ~4x.
 *   - Free Run cap 3 → 2 (lower exposure on the loss-leader tier).
 *   - Founding caps cut to keep $79 lifetime sustainable: run 30→15,
 *     img 15→8, analyze 10→5, vid 5→3.
 *   - Pro Monthly: $9 → $14 with caps run 60→25, img 30→12, analyze 20→8,
 *     vid 10→5. ($9 was loss-making at heavy use.)
 *   - Pro Yearly: $79 → $129 (≈23% off monthly, no longer collides with
 *     the Founding lifetime price).
 *   - NEW Pro Studio tier: $29/mo or $290/yr, caps run 75, img 30,
 *     analyze 20, vid 10. Self-selecting tier for actual heavy users so
 *     they pay their own freight instead of subsidizing on Pro $14.
 *     Studio caps are defined here for future userCaps wiring; no Stripe
 *     IDs exist yet (pricing.html marks it Coming Soon).
 * Also: routes/ai.ts /run handler now routes Free-plan users through
 * gpt-4.1-mini (~5x cheaper) so the Free tier is nearly costless to
 * operate while paid tiers keep gpt-4.1.
 * ============================================================================ */

export const PMG_PRICING = {
  FOUNDING_PRICE_USD: 79,
  PRO_MONTHLY_USD: 14,
  PRO_YEARLY_USD: 129,
  PRO_STUDIO_MONTHLY_USD: 29,
  PRO_STUDIO_YEARLY_USD: 290,
  FOUNDING_LIMIT: 500,
  FOUNDING_DEADLINE_COPY: "Checkout Opening Soon (First 500 Buyers Lock In $79 For Life)",
  TRIAL_DAYS: 7,
  // Per-day per-feature caps for every plan. None of the paid tiers are
  // unlimited — they have generous fair-use caps so unit economics stay
  // predictable. Trial caps apply to free users in their first 7 days
  // since account creation; standard free caps apply afterward.
  // pricing-rebalance-1 (2026-05-12): caps tightened — see header comment.
  TRIAL_DAILY_CAPS:       { run: 6,  img: 3,  analyze: 2,  vid: 0 },
  FREE_DAILY_CAPS:        { run: 2,  img: 1,  analyze: 1,  vid: 0 },
  FOUNDING_DAILY_CAPS:    { run: 15, img: 8,  analyze: 5,  vid: 3 },
  PRO_DAILY_CAPS:         { run: 25, img: 12, analyze: 8,  vid: 5 },
  PRO_STUDIO_DAILY_CAPS:  { run: 75, img: 30, analyze: 20, vid: 10 },
  PRICE_LOCK_TAGLINE: "price locked for life",
  // Expert Command Center is a paid feature (Founding Member + Pro).
  // During the open beta (free for everyone until BETA_END), free users
  // can still open it; outside beta the gate kicks in. Mirrors the
  // matching constants in pmg-pricing-config.js for the frontend.
  EXPERT_CENTER_PAID_TIERS: ["founding", "pro_monthly", "pro_yearly", "pro_studio_monthly", "pro_studio_yearly"] as const,
  BETA_END: "2026-06-01T05:00:00.000Z",
} as const;

export type PmgFeature = "run" | "img" | "analyze" | "vid";
export type PmgPlan = "free" | "founding" | "pro" | "pro_studio";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isInTrial(createdAtMs: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return false;
  return now - createdAtMs < PMG_PRICING.TRIAL_DAYS * DAY_MS;
}

export function trialDaysLeft(createdAtMs: number, now: number = Date.now()): number {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return 0;
  const remainingMs = PMG_PRICING.TRIAL_DAYS * DAY_MS - (now - createdAtMs);
  return Math.max(0, Math.ceil(remainingMs / DAY_MS));
}

export interface DailyCaps {
  run: number;
  img: number;
  analyze: number;
  vid: number;
}

/** Returns the effective per-day caps for the user. No tier is unlimited:
 *  founding/pro have generous fair-use caps, free users in their 7-day
 *  trial get the higher trial caps, and the rest get standard free caps. */
export function effectiveCaps(
  plan: PmgPlan,
  createdAtMs: number,
  now: number = Date.now(),
): DailyCaps {
  if (plan === "pro_studio") return { ...PMG_PRICING.PRO_STUDIO_DAILY_CAPS };
  if (plan === "pro") return { ...PMG_PRICING.PRO_DAILY_CAPS };
  if (plan === "founding") return { ...PMG_PRICING.FOUNDING_DAILY_CAPS };
  return isInTrial(createdAtMs, now)
    ? { ...PMG_PRICING.TRIAL_DAILY_CAPS }
    : { ...PMG_PRICING.FREE_DAILY_CAPS };
}
