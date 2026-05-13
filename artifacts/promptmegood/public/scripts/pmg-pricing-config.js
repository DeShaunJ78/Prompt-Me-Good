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
 *
 * pricing-rebalance-1 (2026-05-12): see header in pricing-config.ts.
 * ============================================================================ */
(function () {
  'use strict';
  if (window.PMG_PRICING) return;
  window.PMG_PRICING = {
    FOUNDING_PRICE_USD: 79,
    PRO_MONTHLY_USD: 14,
    PRO_YEARLY_USD: 129,
    PRO_STUDIO_MONTHLY_USD: 29,
    PRO_STUDIO_YEARLY_USD: 290,
    FOUNDING_LIMIT: 500,
    FOUNDING_DEADLINE_COPY: 'First 500 Buyers Lock In $79 For Life',
    TRIAL_DAYS: 7,
    /* Per-plan daily caps. Mirrors api-server/src/lib/pricing-config.ts. */
    TRIAL_DAILY_CAPS:       { run: 6,  img: 3,  analyze: 2  },
    FREE_DAILY_CAPS:        { run: 2,  img: 1,  analyze: 1  },
    FOUNDING_DAILY_CAPS:    { run: 15, img: 8,  analyze: 5  },
    PRO_DAILY_CAPS:         { run: 25, img: 12, analyze: 8  },
    PRO_STUDIO_DAILY_CAPS:  { run: 75, img: 30, analyze: 20 },
    PRICE_LOCK_TAGLINE: 'price locked for life',
    /* ----- Feature gating ----- */
    /* Expert Command Center is a paid feature (Founding Member + Pro).
       During the open beta (free for everyone until BETA_END), free users
       can still open it; outside beta the gate kicks in. The drawer code
       reads BETA_END to decide whether to show the upgrade paywall. */
    EXPERT_CENTER_PAID_TIERS: ['founding', 'pro_monthly', 'pro_yearly', 'pro_studio_monthly', 'pro_studio_yearly'],
    BETA_END: '2026-07-01T05:00:00.000Z'
  };
})();
