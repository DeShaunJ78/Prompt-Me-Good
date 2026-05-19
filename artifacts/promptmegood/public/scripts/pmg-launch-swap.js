/* =============================================================================
 * pmg-launch-swap.js (launch-swap-1, 2026-05-13)
 * -----------------------------------------------------------------------------
 * Single-purpose runtime that swaps beta-era copy for post-launch copy on
 * pricing.html and index.html when the backend's paywall flag flips on
 * (July 1, 2026 by default — controlled by `OPEN_BETA_MODE` /
 * `PAYWALL_ACTIVATES_AT` server-side, surfaced via /api/public-config).
 *
 * Authoritative source: backend. The browser MUST NOT trust its own clock —
 * an operator could flip OPEN_BETA_MODE earlier or later than July 1, and
 * the page must follow.
 *
 * Tagging convention (mirrors the existing data-pmg-cap / data-pmg-price
 * pattern on these surfaces):
 *
 *   <span data-pmg-beta-only>(free through July 1, 2026)</span>
 *   <span data-pmg-post-launch hidden>Subscribe · $14/mo</span>
 *
 * Default state = beta visible, post-launch hidden. The swap only runs
 * when /api/public-config returns paywallActive: true. No flash of wrong
 * copy on July 2 because /api/public-config is cheap and called early
 * (the script loads `defer`, after the DOM is parsed but before user
 * interaction).
 *
 * Disable for debugging:
 *   localStorage.pmg_launch_swap_disable = '1'
 * Or via the standard kill-switch URL param:
 *   ?launchSwap=off
 *
 * Read-only — never writes to the DOM beyond toggling the [hidden] attr.
 * Failure mode: leave the page as-is (beta state). A network blip on
 * July 1 must NOT brick the pricing page — it just shows the beta copy
 * for one extra page load until the next visit.
 * ========================================================================= */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  /* Standard kill-switches — same convention as every other pmg-* mounter. */
  try {
    if (localStorage.getItem('pmg_launch_swap_disable') === '1') return;
    var qs = new URLSearchParams(window.location.search);
    if ((qs.get('launchSwap') || '').toLowerCase() === 'off') return;
  } catch (_) { /* localStorage may be unavailable in private browsing */ }

  /* tour-tier-1 (2026-05-19): read the user's plan from the DOM hints
     written by pmg-ux.js / chassis-v3 / api response. Default to 'free'
     if unknown — that's the safer post-launch state (show the Free
     onboarding copy rather than the "Welcome Back" Paid copy). */
  function readPlan() {
    try {
      var attr = (document.documentElement && document.documentElement.getAttribute('data-plan')) ||
                 (document.body && document.body.getAttribute('data-plan')) || '';
      if (attr) return String(attr).toLowerCase();
      if (window.PMG_USER && window.PMG_USER.plan) return String(window.PMG_USER.plan).toLowerCase();
    } catch (_) {}
    return 'free';
  }

  function applyTourTierSwap(paywallActive) {
    /* During beta: leave default DOM (everyone sees Paid "Welcome Back").
       Post-launch + free plan: swap to the Free "Welcome To" copy.
       Post-launch + paid plan: leave default DOM (Paid copy). */
    if (!paywallActive) return;
    var plan = readPlan();
    if (plan !== 'free') return;
    try {
      var def = document.querySelector('[data-pmg-tour-default]');
      var freeEl = document.querySelector('[data-pmg-tour-free-post-launch]');
      if (def) def.setAttribute('hidden', '');
      if (freeEl) freeEl.removeAttribute('hidden');
    } catch (_) {}
  }

  function applySwap(paywallActive) {
    if (!paywallActive) return; /* default DOM state is correct */
    try {
      var betaEls = document.querySelectorAll('[data-pmg-beta-only]');
      for (var i = 0; i < betaEls.length; i++) {
        betaEls[i].setAttribute('hidden', '');
      }
      var postEls = document.querySelectorAll('[data-pmg-post-launch]');
      for (var j = 0; j < postEls.length; j++) {
        postEls[j].removeAttribute('hidden');
      }
      applyTourTierSwap(true);
      try { console.log('[pmg-launch-swap] active — swapped ' + betaEls.length + ' beta / ' + postEls.length + ' post-launch elements'); } catch (_) {}
    } catch (err) {
      try { console.warn('[pmg-launch-swap] swap failed', err); } catch (_) {}
    }
  }

  function fetchAndApply() {
    fetch('/api/public-config', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || typeof cfg.paywallActive !== 'boolean') return;
        applySwap(cfg.paywallActive);
      })
      .catch(function (err) {
        try { console.warn('[pmg-launch-swap] /api/public-config fetch failed', err); } catch (_) {}
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAndApply, { once: true });
  } else {
    fetchAndApply();
  }
})();
