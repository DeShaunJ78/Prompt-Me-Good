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
    FOUNDING_DEADLINE_COPY: 'Checkout Opening Soon (First 500 Buyers Lock In $79 For Life)',
    TRIAL_DAYS: 7,
    /* Per-plan daily caps. Mirrors api-server/src/lib/pricing-config.ts. */
    TRIAL_DAILY_CAPS:    { run: 10, img: 5,  analyze: 3  },
    FREE_DAILY_CAPS:     { run: 3,  img: 1,  analyze: 1  },
    FOUNDING_DAILY_CAPS: { run: 30, img: 15, analyze: 10 },
    PRO_DAILY_CAPS:      { run: 60, img: 30, analyze: 20 },
    PRICE_LOCK_TAGLINE: 'price locked for life',
    /* ----- Feature gating ----- */
    /* Expert Command Center is a paid feature (Founding Member + Pro).
       During the open beta (free for everyone until BETA_END), free users
       can still open it; outside beta the gate kicks in. The drawer code
       reads BETA_END to decide whether to show the upgrade paywall. */
    EXPERT_CENTER_PAID_TIERS: ['founding', 'pro_monthly', 'pro_yearly'],
    BETA_END: '2026-06-01T05:00:00.000Z'
  };
})();
