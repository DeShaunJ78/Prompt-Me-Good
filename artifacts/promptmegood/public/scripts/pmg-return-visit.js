/* ============================================================================
 * pmg-return-visit.js (rv-1)
 * ----------------------------------------------------------------------------
 * Return-visit purchase prompt. Tracks visit count locally (one increment per
 * browser session, so refreshes don't count) and, from the SECOND visit on,
 * shows a small dismissible banner pointing to the purchase options on
 * /pricing.html. Never shows on the very first visit. Dismissal is permanent.
 * Suppressed for signed-in paid users (Founding / Pro / Pro Studio) via
 * window.__pmgServerProfile — the banner waits for the profile check to
 * settle before rendering, and removes itself if a paid plan appears later.
 *
 * Keys:
 *   localStorage['pmg.return_visit.count.v2']     — total distinct visits
 *   localStorage['pmg.return_visit.dismissed.v2'] — '1' = never show again
 *   sessionStorage['pmg.return_visit.session.v2'] — this-session guard
 *
 * Kill-switches (standard pattern):
 *   URL:    ?noreturnvisit
 *   Device: localStorage.pmg_return_visit_disable='1'
 *
 * API: window.pmgReturnVisit.{show, dismiss, reset, getCount}
 * ============================================================================ */
(function () {
  'use strict';

  var COUNT_KEY = 'pmg.return_visit.count.v2';
  var DISMISS_KEY = 'pmg.return_visit.dismissed.v2';
  var SESSION_KEY = 'pmg.return_visit.session.v2';
  var BANNER_ID = 'pmg-return-visit-banner';
  var STYLE_ID = 'pmg-return-visit-style';
  var PROFILE_WAIT_MS = 5000; /* give pmg-ux's /api/me/profile fetch time to land */
  var PAID_PLANS = { founding: 1, pro: 1, pro_studio: 1 };

  try {
    if (/[?&]noreturnvisit\b/.test(location.search)) return;
    if (localStorage.getItem('pmg_return_visit_disable') === '1') return;
  } catch (_) { return; }

  function getCount() {
    try { return parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0; } catch (_) { return 0; }
  }

  function isDismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  }

  function isPaid() {
    try {
      var sp = window.__pmgServerProfile;
      return !!(sp && sp.plan && PAID_PLANS[String(sp.plan).toLowerCase()]);
    } catch (_) { return false; }
  }

  /* Count this visit exactly once per browser session. */
  var count = getCount();
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      count += 1;
      localStorage.setItem(COUNT_KEY, String(count));
    }
  } catch (_) {}

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
    remove();
  }

  function remove() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#' + BANNER_ID + '{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
      'z-index:99990;max-width:min(560px,calc(100vw - 24px));box-sizing:border-box;' +
      'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;' +
      'background:var(--color-surface, #0d2b26);border:1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 35%, transparent);' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--color-text, #eafff6);font-size:14px;line-height:1.45;}' +
      '#' + BANNER_ID + ' a.pmg-rv-cta{flex-shrink:0;font-weight:700;text-decoration:none;' +
      'padding:8px 14px;border-radius:9px;background:var(--color-primary, #3ee0a0);color:#062018;}' +
      '#' + BANNER_ID + ' a.pmg-rv-cta:hover,#' + BANNER_ID + ' a.pmg-rv-cta:focus{filter:brightness(1.08);}' +
      '#' + BANNER_ID + ' button.pmg-rv-close{flex-shrink:0;background:none;border:none;cursor:pointer;' +
      'color:var(--color-text-muted, #9fc4b8);font-size:18px;line-height:1;padding:4px 6px;border-radius:6px;}' +
      '#' + BANNER_ID + ' button.pmg-rv-close:hover,#' + BANNER_ID + ' button.pmg-rv-close:focus{color:var(--color-text, #eafff6);}' +
      '@media (max-width:560px){#' + BANNER_ID + '{flex-wrap:wrap;font-size:13px;}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function show() {
    if (document.getElementById(BANNER_ID)) return;
    injectStyle();
    var el = document.createElement('div');
    el.id = BANNER_ID;
    /* data-pmg-overlay-root: chassis-v3's universal hide rule erases unmarked
       body-level elements — this attribute is the required opt-out. */
    el.setAttribute('data-pmg-overlay-root', '1');
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Upgrade offer for returning visitors');
    el.innerHTML =
      '<span>Welcome back! Enjoying PromptMeGood? Lock in <strong>lifetime access for a one-time $79</strong> — first 500 buyers only.</span>' +
      '<a class="pmg-rv-cta" href="/pricing.html#founding-checkout-card">See plans</a>' +
      '<button type="button" class="pmg-rv-close" aria-label="Dismiss this message">&times;</button>';
    el.querySelector('.pmg-rv-close').addEventListener('click', dismiss);
    (document.body || document.documentElement).appendChild(el);
  }

  function maybeShow() {
    if (isDismissed() || count < 2) return;
    if (isPaid()) return;
    show();
    /* If the paid profile lands after we rendered, pull the banner. */
    var checks = 0;
    var iv = setInterval(function () {
      checks += 1;
      if (isPaid()) { remove(); clearInterval(iv); }
      else if (checks >= 10) clearInterval(iv);
    }, 2000);
  }

  function boot() {
    if (isDismissed() || count < 2) return;
    /* Wait for the profile fetch to settle so paid users never see a flash. */
    var waited = 0;
    var iv = setInterval(function () {
      waited += 500;
      if (isPaid()) { clearInterval(iv); return; }
      if (window.__pmgServerProfile || waited >= PROFILE_WAIT_MS) {
        clearInterval(iv);
        maybeShow();
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgReturnVisit = {
    show: show,
    dismiss: dismiss,
    reset: function () {
      try {
        localStorage.removeItem(COUNT_KEY);
        localStorage.removeItem(DISMISS_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (_) {}
      remove();
    },
    getCount: getCount
  };
})();
