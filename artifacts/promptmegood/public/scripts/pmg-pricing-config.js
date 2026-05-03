/* ============================================================================
 * PromptMeGood — Centralized Pricing & Caps Config (Frontend)
 * ----------------------------------------------------------------------------
 * Single source of truth for all dynamic JS surfaces (modals, CTAs, badges,
 * trial caps). Loaded BEFORE pmg-ux.js and pmg-pro.js so they can read the
 * authoritative numbers from `window.PMG_PRICING`.
 *
 * Static HTML and JSON-LD blocks still use price literals for SEO crawlers,
 * but the values must be kept in sync with the constants below. The mirror
 * config in `artifacts/api-server/src/lib/pricing-config.ts` carries the
 * same values for the backend.
 * ============================================================================ */
(function () {
  'use strict';
  if (window.PMG_PRICING) return;
  window.PMG_PRICING = {
    FOUNDING_PRICE_USD: 79,
    PRO_MONTHLY_USD: 9,
    PRO_YEARLY_USD: 79,
    FOUNDING_LIMIT: 500,
    PRO_LAUNCH_DATE: 'June 1, 2026',
    TRIAL_DAYS: 7,
    TRIAL_DAILY_CAPS: { run: 10, img: 5, analyze: 3 },
    FREE_DAILY_CAPS:  { run: 3,  img: 1, analyze: 1 },
    PRICE_LOCK_TAGLINE: 'price locked for life'
  };
})();
