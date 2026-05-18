/*
 * pmg-deadclick-audit.js — regression guard for two bug classes
 * we hit in the May 2026 audit + post-audit follow-ups:
 *
 *   1. Button-styled <a> with no href and no onclick.
 *      These render as CTAs but do absolutely nothing on click unless
 *      a delegated listener happens to be wired. Caused 4 dead Pro/Studio
 *      Subscribe buttons on pricing.html (data-pmg-upgrade only, no
 *      fallback href — the T41 handler short-circuits during beta and
 *      the "let the href anchor work" comment assumed an href existed).
 *
 *   2. Body-level fixed overlays missing the chassis whitelist.
 *      The chassis-v3 universal-hide rule at pmg-chassis-v3.css:51 hides
 *      every direct <body> child except a whitelist (#pmg-chassis-v3-root,
 *      script, style, noscript, #pmg-splash, template,
 *      [data-pmg-overlay-root], .pmg-modal-overlay, #pmg-expert-center-root).
 *      Caused #bk-overlay (Backup/Restore), #compare-overlay, and
 *      #ob-overlay to silently disappear when opened.
 *
 * This script DOES NOT block, mutate, or fix anything. It only emits
 * console warnings so QA / devtools surfaces the issue before users do.
 * Runs once on DOMContentLoaded, ~10ms total walk.
 *
 * Disable: localStorage.pmg_deadclick_audit_disable = '1'
 *          or ?nodeadclick in URL.
 */
(function () {
  'use strict';
  try {
    if (localStorage.getItem('pmg_deadclick_audit_disable') === '1') return;
  } catch (_) {}
  if (/[?&]nodeadclick(=|&|$)/.test(location.search)) return;

  function audit() {
    var warnings = [];

    /* ---------- Rule 1: <a class*="btn"> with no href and no onclick ---------- */
    var anchors = document.querySelectorAll('a[class*="btn"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var hasHref = a.hasAttribute('href') && a.getAttribute('href') !== '';
      var hasOnClick = a.hasAttribute('onclick');
      if (hasHref || hasOnClick) continue;
      /* Known-wired hooks: presence of data-* attributes that delegated
         listeners key off of. We can't introspect addEventListener,
         so we only warn when there's no plausible wiring AT ALL. */
      var hasDataHook =
        a.hasAttribute('data-action') ||
        a.hasAttribute('data-pmg-action') ||
        a.hasAttribute('data-history-action') ||
        a.hasAttribute('data-remix') ||
        a.hasAttribute('data-testid');
      /* data-pmg-upgrade is wired by T41 (pmg-ux.js) — but ONLY for the
         "founding" tier during beta; non-founding tiers fall through
         silently. That's exactly the bug we just fixed by adding an
         href fallback. So data-pmg-upgrade WITHOUT href is still a
         candidate to warn about. */
      if (hasDataHook && !a.hasAttribute('data-pmg-upgrade')) continue;
      warnings.push({
        rule: 'button-styled <a> with no href / onclick',
        el: a,
        selector: shortSelector(a),
        hint: 'Add href="#fragment" or onclick, or confirm a delegated handler intentionally drives this.'
      });
    }

    /* ---------- Rule 2: body-level fixed overlays missing whitelist ---------- */
    /* Only run on pages that load the chassis (i.e. /app). Detect via
       presence of #pmg-chassis-v3-root OR html.pmg-chassis-v3 class. */
    var chassisLoaded = !!document.getElementById('pmg-chassis-v3-root') ||
                        document.documentElement.classList.contains('pmg-chassis-v3');
    if (chassisLoaded) {
      var WHITELIST_IDS = {
        'pmg-chassis-v3-root': 1,
        'pmg-splash': 1,
        'pmg-expert-center-root': 1
      };
      var bodyKids = document.body ? document.body.children : [];
      for (var j = 0; j < bodyKids.length; j++) {
        var el = bodyKids[j];
        var tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue;
        if (WHITELIST_IDS[el.id]) continue;
        if (el.hasAttribute('data-pmg-overlay-root')) continue;
        if (el.classList && el.classList.contains('pmg-modal-overlay')) continue;
        /* Only flag elements that LOOK like overlays: position:fixed + full inset. */
        var cs = null;
        try { cs = getComputedStyle(el); } catch (_) {}
        if (!cs || cs.position !== 'fixed') continue;
        /* Heuristic: full-screen overlay = inset:0 OR width/height ≥ 90vw/vh */
        var isFullscreen =
          (cs.inset === '0px' || (cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px')) ||
          (parseInt(cs.width, 10) >= window.innerWidth * 0.9 &&
           parseInt(cs.height, 10) >= window.innerHeight * 0.9);
        if (!isFullscreen) continue;
        warnings.push({
          rule: 'body-level fixed overlay missing chassis whitelist',
          el: el,
          selector: shortSelector(el),
          hint: 'Add data-pmg-overlay-root attribute (or class="pmg-modal-overlay") so the chassis universal-hide rule does not erase it on open.'
        });
      }
    }

    if (warnings.length === 0) return;
    /* Single grouped warn so noise is bounded. */
    try {
      console.groupCollapsed('[pmg-deadclick-audit] ' + warnings.length + ' candidate(s) — page: ' + location.pathname);
      for (var k = 0; k < warnings.length; k++) {
        var w = warnings[k];
        console.warn(w.rule + ' → ' + w.selector + '\n  ' + w.hint, w.el);
      }
      console.groupEnd();
    } catch (_) {}
  }

  function shortSelector(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (cls) s += '.' + cls;
    }
    return s;
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(audit, 100);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(audit, 100); });
  }
})();
