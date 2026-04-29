/* ============================================================================
 * Paywall mode controller (T42 Open Beta)
 * ----------------------------------------------------------------------------
 * Single source of truth for whether the PromptMeGood paywall is currently
 * enforced. Used by every route that gates Pro features and surfaced to the
 * frontend through /api/public-config so the browser can match.
 *
 * Rules (in priority order):
 *   1. If OPEN_BETA_MODE is anything other than the literal string "true",
 *      the paywall is ALWAYS enforced. This is the manual override —
 *      flipping the flag off ships the paid product immediately, regardless
 *      of date.
 *   2. If OPEN_BETA_MODE === "true" and PAYWALL_ACTIVATES_AT is a valid
 *      future ISO timestamp, the paywall is OFF until that moment, then
 *      automatically ON.
 *   3. If OPEN_BETA_MODE === "true" but PAYWALL_ACTIVATES_AT is missing or
 *      unparseable, the paywall stays OFF (open beta indefinitely) and we
 *      log a warning at boot so an operator notices.
 *
 * Usage in routes:
 *
 *   import { isPaywallActive } from "../lib/paywall";
 *   if (!isPaywallActive()) return next();   // free during beta
 *
 * The frontend gets the same answer via /api/public-config so UI gating
 * stays in sync with backend gating.
 * ========================================================================= */

import { logger } from "./logger";

const RAW_OPEN_BETA = (process.env["OPEN_BETA_MODE"] ?? "").trim().toLowerCase();
const RAW_ACTIVATES_AT = (process.env["PAYWALL_ACTIVATES_AT"] ?? "").trim();

const OPEN_BETA_MODE = RAW_OPEN_BETA === "true";

let activatesAtMs: number | null = null;
if (RAW_ACTIVATES_AT) {
  const parsed = Date.parse(RAW_ACTIVATES_AT);
  if (Number.isFinite(parsed)) {
    activatesAtMs = parsed;
  } else {
    logger.warn(
      { PAYWALL_ACTIVATES_AT: RAW_ACTIVATES_AT },
      "Paywall: PAYWALL_ACTIVATES_AT could not be parsed as a date — treating as missing.",
    );
  }
}

/**
 * Returns true ONLY when the paywall should be enforced right now.
 *
 * Cheap (a Date.now() and two comparisons) — safe to call on every request.
 */
export function isPaywallActive(now: number = Date.now()): boolean {
  // Manual override wins over the calendar.
  if (!OPEN_BETA_MODE) return true;
  // Open-beta-forever if no activation date is configured.
  if (activatesAtMs === null) return false;
  return now >= activatesAtMs;
}

/**
 * Public snapshot of the current paywall state, suitable for shipping
 * to the browser via /api/public-config.
 */
export function getPaywallStatus(): {
  paywallActive: boolean;
  openBetaMode: boolean;
  paywallActivatesAt: string | null;
} {
  return {
    paywallActive: isPaywallActive(),
    openBetaMode: OPEN_BETA_MODE,
    paywallActivatesAt: activatesAtMs !== null ? new Date(activatesAtMs).toISOString() : null,
  };
}

/**
 * Boot-time visibility line so an operator can confirm the deploy is in the
 * mode they expected. Per the spec, only logs in development.
 */
export function logPaywallStatusOnce(): void {
  if (process.env["NODE_ENV"] === "production") return;
  const active = isPaywallActive();
  if (active) {
    logger.info(
      { openBetaMode: OPEN_BETA_MODE, paywallActivatesAt: activatesAtMs && new Date(activatesAtMs).toISOString() },
      "Paywall: ON (Enforced)",
    );
  } else {
    logger.info(
      { openBetaMode: OPEN_BETA_MODE, paywallActivatesAt: activatesAtMs && new Date(activatesAtMs).toISOString() },
      "Paywall: OFF (Beta Mode)",
    );
  }
}
