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
  TRIAL_DAILY_CAPS: { run: 10, img: 5, analyze: 3 },
  FREE_DAILY_CAPS: { run: 3, img: 1, analyze: 1 },
  PRICE_LOCK_TAGLINE: "price locked for life",
} as const;

export type PmgFeature = "run" | "img" | "analyze";
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
}

/** Returns the effective per-day caps for the user, or `null` when unlimited
 *  (Founding / Pro). Free users in the first 7 days since account creation
 *  get the higher trial caps; otherwise the standard free caps. */
export function effectiveCaps(
  plan: PmgPlan,
  createdAtMs: number,
  now: number = Date.now(),
): DailyCaps | null {
  if (plan === "founding" || plan === "pro") return null;
  return isInTrial(createdAtMs, now)
    ? { ...PMG_PRICING.TRIAL_DAILY_CAPS }
    : { ...PMG_PRICING.FREE_DAILY_CAPS };
}
