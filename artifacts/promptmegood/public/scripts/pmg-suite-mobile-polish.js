/* =============================================================
 * pmg-suite-mobile-polish.js  (Task #110)
 *
 * Mobile-only polish for the Photography Suite:
 *   1. Injects a short "Photography Suite" intro strip above the
 *      group accordion so mobile users feel they have entered a
 *      destination, not just another list.
 *   2. Mounts a bottom-fixed "Build Image Prompt" CTA that becomes
 *      visible only when (a) the suite is intersecting the
 *      viewport AND (b) at least one pill is picked. Clicking it
 *      delegates to the existing .pmg-photo-send button so the
 *      build/dispatch pipeline is unchanged.
 *
 * All styling lives in pmg-ux.js (the FIX 8 / Task #110 block).
 * This module only handles DOM injection and visibility state.
 *
 * Strict additive: never replaces existing elements, never alters
 * click handlers, never blocks interactions. If anything throws,
 * the suite keeps working.
 *
 * Disable hatch: ?nosuitemobilepolish OR
 *                localStorage.pmg_suite_mobile_polish_disable = '1'.
 * ============================================================= */
(function () {
  'use strict';
  try {

  try {
    if (/[?&]nosuitemobilepolish(=|&|$)/.test(location.search)) return;
  } catch (_) {}
  try {
    if (window.localStorage &&
        localStorage.getItem('pmg_suite_mobile_polish_disable') === '1') return;
  } catch (_) {}

  var SUITE_ID    = 'pmg-photo-suite';
  var SECTION_ID  = 'photo-suite-section';
  var INTRO_ID    = 'pmg-photo-suite-intro';
  var CTA_ID      = 'pmg-photo-suite-sticky-cta';

  var suiteVisible = false;
  var hasPicks     = false;
  var ctaEl        = null;

  function injectIntro(suite) {
    if (document.getElementById(INTRO_ID)) return;
    if (!suite) return;
    var intro = document.createElement('div');
    intro.id = INTRO_ID;
    intro.setAttribute('role', 'note');
    var title = document.createElement('span');
    title.className = 'pmg-suite-intro-title';
    title.textContent = 'Photography Suite';
    var sub = document.createElement('span');
    sub.className = 'pmg-suite-intro-sub';
    sub.textContent = 'Pick a vibe in each group — we will build the prompt for you.';
    intro.appendChild(title);
    intro.appendChild(sub);
    /* Place it just inside the suite card, before the existing head,
       so it sits inside the same visual container rather than
       floating above the card edge. */
    var head = suite.querySelector('.pmg-stack-card-head');
    if (head && head.parentNode === suite) {
      suite.insertBefore(intro, head);
    } else {
      suite.insertBefore(intro, suite.firstChild);
    }
  }

  function ensureCta() {
    if (ctaEl && document.body.contains(ctaEl)) return ctaEl;
    ctaEl = document.createElement('button');
    ctaEl.type = 'button';
    ctaEl.id = CTA_ID;
    ctaEl.textContent = 'Build Image Prompt';
    ctaEl.setAttribute('aria-label', 'Build image prompt from current selections');
    /* suite-rescue-1 (2026-07-19): the CTA is appended to <body>, so
       the chassis-v3 universal hide rule suppresses it unless it
       opts out with data-pmg-overlay-root. */
    ctaEl.setAttribute('data-pmg-overlay-root', '1');
    ctaEl.addEventListener('click', function () {
      if (ctaEl.disabled || ctaEl.getAttribute('aria-disabled') === 'true') return;
      var send = document.querySelector('#' + SUITE_ID + ' .pmg-photo-send');
      if (send && !send.disabled) {
        send.click();
      }
    });
    document.body.appendChild(ctaEl);
    return ctaEl;
  }

  function refreshCtaVisibility() {
    if (!ctaEl) return;
    if (suiteVisible && hasPicks) {
      ctaEl.classList.add('is-visible');
    } else {
      ctaEl.classList.remove('is-visible');
    }
  }

  function refreshPickState(suite) {
    if (!suite) return;
    var anyActive = !!suite.querySelector(
      '.pmg-photo-pill.is-active, .pmg-photo-pill.selected, .pmg-photo-pill[aria-pressed="true"]'
    );
    /* The existing .pmg-photo-send button mirrors the same gating
       (disabled until at least one pill is picked); fall back to it
       so we never disagree with the canonical UI signal. */
    if (!anyActive) {
      var send = suite.querySelector('.pmg-photo-send');
      if (send && !send.disabled) anyActive = true;
    }
    if (anyActive !== hasPicks) {
      hasPicks = anyActive;
      refreshCtaVisibility();
    }
    /* Mirror canonical disabled state onto the sticky CTA so screen
       readers and assistive tech see the same gating. */
    if (ctaEl) {
      if (anyActive) {
        ctaEl.removeAttribute('disabled');
        ctaEl.setAttribute('aria-disabled', 'false');
      } else {
        ctaEl.setAttribute('disabled', '');
        ctaEl.setAttribute('aria-disabled', 'true');
      }
    }
  }

  function watchSuite(suite) {
    var section = document.getElementById(SECTION_ID) || suite;
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var nowVisible = entries[i].isIntersecting;
          if (nowVisible !== suiteVisible) {
            suiteVisible = nowVisible;
            refreshCtaVisibility();
          }
        }
      }, { threshold: 0.05 });
      io.observe(section);
    } else {
      suiteVisible = true;
      refreshCtaVisibility();
    }
    var mo = new MutationObserver(function () { refreshPickState(suite); });
    mo.observe(suite, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'disabled'],
      childList: true
    });
    refreshPickState(suite);
  }

  function boot() {
    var suite = document.getElementById(SUITE_ID);
    if (suite) {
      injectIntro(suite);
      ensureCta();
      watchSuite(suite);
      return;
    }
    var bodyMo = new MutationObserver(function () {
      var s = document.getElementById(SUITE_ID);
      if (s) {
        bodyMo.disconnect();
        injectIntro(s);
        ensureCta();
        watchSuite(s);
      }
    });
    bodyMo.observe(document.body, { childList: true, subtree: true });
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  whenReady(boot);

  /* Tiny test surface so Playwright can verify state. */
  window.__pmgSuiteMobilePolish = {
    introMounted: function () { return !!document.getElementById(INTRO_ID); },
    ctaMounted:   function () { return !!document.getElementById(CTA_ID); },
    ctaVisible:   function () {
      var el = document.getElementById(CTA_ID);
      return !!(el && el.classList.contains('is-visible'));
    },
    state: function () {
      return { suiteVisible: suiteVisible, hasPicks: hasPicks };
    }
  };

  } catch (e) {
    try { console.warn('[pmg-suite-mobile-polish] init failed', e); } catch (_) {}
  }
})();
