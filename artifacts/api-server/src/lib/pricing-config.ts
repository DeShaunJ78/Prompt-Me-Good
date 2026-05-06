/* ============================================================================
 * PromptMeGood — Centralized Pricing & Caps Config (Backend)
 * ----------------------------------------------------------------------------
 * Single source of truth for prices, plan limits, and trial windows on the
 * server side. Mirrors `artifacts/promptmegood/public/scripts/pmg-pricing-config.js`.
 * Stripe Price IDs continue to live in environment variables — this module
 * never holds a Stripe identifier, only the dollar values used in user-facing
 * copy and the per-plan daily caps used by `userCaps.ts`.
 * ============================================================================ */

export const PMG_PRICING = {
  FOUNDING_PRICE_USD: 79,
  PRO_MONTHLY_USD: 9,
  PRO_YEARLY_USD: 79,
  FOUNDING_LIMIT: 500,
  FOUNDING_DEADLINE_COPY: "Offer Ends July 1 Or At 500 Founding Members — Whichever Comes First",
  TRIAL_DAYS: 7,
  // Per-day per-feature caps for every plan. None of the paid tiers are
  // unlimited — they have generous fair-use caps so unit economics stay
  // predictable. Trial caps apply to free users in their first 7 days
  // since account creation; standard free caps apply afterward.
  TRIAL_DAILY_CAPS:    { run: 10, img: 5,  analyze: 3,  vid: 0 },
  FREE_DAILY_CAPS:     { run: 3,  img: 1,  analyze: 1,  vid: 0 },
  FOUNDING_DAILY_CAPS: { run: 30, img: 15, analyze: 10, vid: 5 },
  PRO_DAILY_CAPS:      { run: 60, img: 30, analyze: 20, vid: 10 },
  PRICE_LOCK_TAGLINE: "price locked for life",
  // Expert Command Center is a paid feature (Founding Member + Pro).
  // During the open beta (free for everyone until BETA_END), free users
  // can still open it; outside beta the gate kicks in. Mirrors the
  // matching constants in pmg-pricing-config.js for the frontend.
  EXPERT_CENTER_PAID_TIERS: ["founding", "pro_monthly", "pro_yearly"] as const,
  BETA_END: "2026-06-01T05:00:00.000Z",
} as const;

export type PmgFeature = "run" | "img" | "analyze" | "vid";
export type PmgPlan = "free" | "founding" | "pro";

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
  if (plan === "pro") return { ...PMG_PRICING.PRO_DAILY_CAPS };
  if (plan === "founding") return { ...PMG_PRICING.FOUNDING_DAILY_CAPS };
  return isInTrial(createdAtMs, now)
    ? { ...PMG_PRICING.TRIAL_DAILY_CAPS }
    : { ...PMG_PRICING.FREE_DAILY_CAPS };
}
