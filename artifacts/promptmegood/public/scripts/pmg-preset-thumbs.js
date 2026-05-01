/* =============================================================
 * pmg-preset-thumbs.js  (Task #51)
 *
 * Adds a small representative thumbnail to every Quick-Style
 * preset button across all five Photography Suite groups
 * (Style, Camera & Lens, Lighting & Mood, Composition, Color
 * Palette) so users can recognise presets at a glance instead
 * of guessing from text labels.
 *
 * Thumbnails are inline SVGs — zero network requests, instantly
 * available, no decoding stalls, and they re-style cleanly in
 * dark mode and reduce-motion contexts.
 *
 * Lazy-load strategy:
 *   • Module is loaded with `defer` so it never blocks parsing.
 *   • A MutationObserver waits for the photo suite to mount
 *     (pmg-ux.js renders it asynchronously after init).
 *   • An IntersectionObserver injects each thumbnail only when
 *     its preset button scrolls into view, so off-screen presets
 *     never render their SVG.
 *
 * Accessibility:
 *   • Thumbnails are decorative (aria-hidden="true"). The button
 *     label already announces the preset name to AT.
 *   • aria-label and visible text are unchanged.
 *
 * Strict additive: never replaces the button text, never alters
 * click handlers, never blocks interactions. If anything inside
 * this module throws, the suite keeps working.
 *
 * Disable hatch: ?nopresetthumbs query param OR
 *                localStorage.pmg_presetthumbs_disable = '1'.
 * ============================================================= */
(function () {
  'use strict';
  try {

  /* ---------------------------------------------------------------
   * Escape hatches
   * --------------------------------------------------------------- */
  try {
    if (/[?&]nopresetthumbs(=|&|$)/.test(location.search)) return;
  } catch (_) {}
  try {
    if (window.localStorage &&
        localStorage.getItem('pmg_presetthumbs_disable') === '1') return;
  } catch (_) {}

  var SUITE_ID    = 'pmg-photo-suite';
  var THUMB_ATTR  = 'data-pmg-thumb';
  var DONE_VALUE  = '1';

  /* ---------------------------------------------------------------
   * Thumbnail SVG library — keyed by [group][presetIndex] to match
   * the PRESETS map in pmg-ux.js. Order MUST stay in sync with that
   * file's preset order; if a preset is added or reordered there,
   * add a matching thumbnail here. Falls back to a generic dot if
   * a preset has no entry.
   * --------------------------------------------------------------- */
  var THUMBS = {
    style: [
      /* Cinematic — letterbox + lens flare highlight */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#1a1a1a"/>'
        + '<rect y="3.5" width="24" height="3" fill="#000"/>'
        + '<rect y="17.5" width="24" height="3" fill="#000"/>'
        + '<circle cx="16" cy="12" r="2.2" fill="#fff" opacity="0.9"/>'
        + '<circle cx="16" cy="12" r="4.5" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.35"/>'
        + '<circle cx="9" cy="14" r="1" fill="#ff9a3a" opacity="0.7"/>'
      + '</svg>',
      /* Editorial — clean type stack on bright surface */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#fafaf7"/>'
        + '<rect x="5" y="6" width="14" height="1.6" rx="0.4" fill="#1a1a1a"/>'
        + '<rect x="5" y="10" width="11" height="0.9" rx="0.3" fill="#888"/>'
        + '<rect x="5" y="13" width="13" height="0.9" rx="0.3" fill="#888"/>'
        + '<rect x="5" y="16" width="8"  height="0.9" rx="0.3" fill="#888"/>'
      + '</svg>',
      /* Vintage Film — sepia gradient + grain */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><linearGradient id="pmgVt1" x1="0" y1="0" x2="1" y2="1">'
        +   '<stop offset="0" stop-color="#c89567"/><stop offset="1" stop-color="#7a4a2a"/>'
        + '</linearGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgVt1)"/>'
        + '<circle cx="6"  cy="8"  r="0.7" fill="#fff" opacity="0.45"/>'
        + '<circle cx="14" cy="6"  r="0.5" fill="#fff" opacity="0.35"/>'
        + '<circle cx="18" cy="13" r="0.8" fill="#fff" opacity="0.4"/>'
        + '<circle cx="9"  cy="17" r="0.5" fill="#000" opacity="0.3"/>'
        + '<circle cx="16" cy="19" r="0.6" fill="#000" opacity="0.3"/>'
      + '</svg>',
      /* Minimalist — single dot on negative space */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#f4f3ef"/>'
        + '<circle cx="12" cy="12" r="2.4" fill="#222"/>'
      + '</svg>'
    ],

    camera: [
      /* Portrait Lens — sharp center subject + bokeh */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#262633"/>'
        + '<circle cx="6"  cy="6"  r="2.6" fill="#fff" opacity="0.22"/>'
        + '<circle cx="18" cy="7"  r="2.1" fill="#fff" opacity="0.3"/>'
        + '<circle cx="5"  cy="18" r="2.3" fill="#fff" opacity="0.22"/>'
        + '<circle cx="19" cy="18" r="2"   fill="#fff" opacity="0.3"/>'
        + '<circle cx="12" cy="12" r="3.2" fill="#fff"/>'
      + '</svg>',
      /* Wide Landscape — sky + mountains + sun */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><linearGradient id="pmgWL1" x1="0" y1="0" x2="0" y2="1">'
        +   '<stop offset="0" stop-color="#9ec8e8"/><stop offset="1" stop-color="#dde6e3"/>'
        + '</linearGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgWL1)"/>'
        + '<circle cx="18" cy="8" r="2.2" fill="#ffd56b"/>'
        + '<polygon points="2,18 8,11 13,17 18,12 22,18 22,22 2,22" fill="#5a7864"/>'
      + '</svg>',
      /* Macro Detail — concentric circles (extreme close-up feel) */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#243a26"/>'
        + '<circle cx="12" cy="12" r="9" fill="none" stroke="#7fc18a" stroke-width="0.8" opacity="0.5"/>'
        + '<circle cx="12" cy="12" r="6" fill="none" stroke="#7fc18a" stroke-width="1"   opacity="0.7"/>'
        + '<circle cx="12" cy="12" r="3" fill="#7fc18a"/>'
      + '</svg>',
      /* Telephoto Action — motion-blur diagonals */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#1a1a1a"/>'
        + '<line x1="2" y1="6"  x2="22" y2="10" stroke="#ff6b3d" stroke-width="2"   opacity="0.65"/>'
        + '<line x1="2" y1="12" x2="22" y2="16" stroke="#fff"    stroke-width="2.2" opacity="0.9"/>'
        + '<line x1="2" y1="18" x2="22" y2="22" stroke="#ff6b3d" stroke-width="1.6" opacity="0.45"/>'
      + '</svg>'
    ],

    lighting: [
      /* Golden Hour — warm sky gradient + low sun */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><linearGradient id="pmgGH1" x1="0" y1="0" x2="0" y2="1">'
        +   '<stop offset="0" stop-color="#ffb24a"/>'
        +   '<stop offset="0.55" stop-color="#ff7a3d"/>'
        +   '<stop offset="1" stop-color="#5a3a4a"/>'
        + '</linearGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgGH1)"/>'
        + '<circle cx="12" cy="14.5" r="3" fill="#ffe8b0" opacity="0.95"/>'
      + '</svg>',
      /* Studio Softbox — bright soft circle */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><radialGradient id="pmgSB1" cx="0.5" cy="0.4" r="0.6">'
        +   '<stop offset="0" stop-color="#fff"/>'
        +   '<stop offset="0.6" stop-color="#e8e8e8"/>'
        +   '<stop offset="1" stop-color="#999"/>'
        + '</radialGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgSB1)"/>'
      + '</svg>',
      /* Moody Low Key — dark with thin light slash */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#0e0e10"/>'
        + '<polygon points="9.5,2 14,2 11.5,22 7,22" fill="#e0c8a0" opacity="0.55"/>'
      + '</svg>',
      /* Overcast — flat gray sky with diffused clouds */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><linearGradient id="pmgOC1" x1="0" y1="0" x2="0" y2="1">'
        +   '<stop offset="0" stop-color="#cfd2d6"/><stop offset="1" stop-color="#a8acb1"/>'
        + '</linearGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgOC1)"/>'
        + '<ellipse cx="9"  cy="11" rx="5"   ry="2.2" fill="#e8eaec" opacity="0.85"/>'
        + '<ellipse cx="16" cy="14" rx="4.5" ry="2"   fill="#e0e2e5" opacity="0.85"/>'
      + '</svg>'
    ],

    composition: [
      /* Rule Of Thirds — 3x3 grid + intersection dot */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#f7f6f2"/>'
        + '<line x1="8"  y1="2" x2="8"  y2="22" stroke="#999" stroke-width="0.8"/>'
        + '<line x1="16" y1="2" x2="16" y2="22" stroke="#999" stroke-width="0.8"/>'
        + '<line x1="2" y1="8"  x2="22" y2="8"  stroke="#999" stroke-width="0.8"/>'
        + '<line x1="2" y1="16" x2="22" y2="16" stroke="#999" stroke-width="0.8"/>'
        + '<circle cx="16" cy="8" r="1.7" fill="#01696f"/>'
      + '</svg>',
      /* Centered Symmetry — mirrored triangles around center axis */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#f0e9e2"/>'
        + '<line x1="12" y1="2" x2="12" y2="22" stroke="#01696f" stroke-width="0.7" stroke-dasharray="2 1.5"/>'
        + '<polygon points="6,17 12,7 12,17" fill="#5a4a3a" opacity="0.85"/>'
        + '<polygon points="18,17 12,7 12,17" fill="#5a4a3a" opacity="0.85"/>'
      + '</svg>',
      /* Leading Lines — converging perspective */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#e8e4d8"/>'
        + '<polygon points="2,22 12,10 22,22" fill="#5a7864" opacity="0.4"/>'
        + '<line x1="2"  y1="22" x2="12" y2="10" stroke="#222" stroke-width="0.7"/>'
        + '<line x1="22" y1="22" x2="12" y2="10" stroke="#222" stroke-width="0.7"/>'
        + '<line x1="6"  y1="22" x2="12" y2="13" stroke="#222" stroke-width="0.4" opacity="0.6"/>'
        + '<line x1="18" y1="22" x2="12" y2="13" stroke="#222" stroke-width="0.4" opacity="0.6"/>'
      + '</svg>',
      /* Wide Establishing — sky + horizon + ground */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<defs><linearGradient id="pmgWE1" x1="0" y1="0" x2="0" y2="1">'
        +   '<stop offset="0" stop-color="#a8c5d8"/>'
        +   '<stop offset="0.55" stop-color="#dde6e3"/>'
        +   '<stop offset="0.55" stop-color="#5a7864"/>'
        +   '<stop offset="1" stop-color="#3a4a3e"/>'
        + '</linearGradient></defs>'
        + '<rect width="24" height="24" rx="4" fill="url(#pmgWE1)"/>'
      + '</svg>'
    ],

    palette: [
      /* Warm Sunset */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#fff"/>'
        + '<rect x="2"  y="3" width="6" height="18" fill="#ffc24a"/>'
        + '<rect x="9"  y="3" width="6" height="18" fill="#ff7a3d"/>'
        + '<rect x="16" y="3" width="6" height="18" fill="#c8364a"/>'
      + '</svg>',
      /* Cool Blue */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#fff"/>'
        + '<rect x="2"  y="3" width="6" height="18" fill="#9ed1e8"/>'
        + '<rect x="9"  y="3" width="6" height="18" fill="#3b82c6"/>'
        + '<rect x="16" y="3" width="6" height="18" fill="#1e3a8a"/>'
      + '</svg>',
      /* Earthy Neutrals */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#fff"/>'
        + '<rect x="2"  y="3" width="6" height="18" fill="#d8c39a"/>'
        + '<rect x="9"  y="3" width="6" height="18" fill="#9a7855"/>'
        + '<rect x="16" y="3" width="6" height="18" fill="#5a7864"/>'
      + '</svg>',
      /* High Contrast Bold */
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<rect width="24" height="24" rx="4" fill="#fff"/>'
        + '<rect x="2"  y="3" width="6" height="18" fill="#000"/>'
        + '<rect x="9"  y="3" width="6" height="18" fill="#fff" stroke="#ddd" stroke-width="0.5"/>'
        + '<rect x="16" y="3" width="6" height="18" fill="#e21a3a"/>'
      + '</svg>'
    ]
  };

  /* Generic fallback for any preset that doesn't have a curated SVG. */
  var FALLBACK_SVG =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + '<rect width="24" height="24" rx="4" fill="#e0ddd6"/>'
      + '<circle cx="12" cy="12" r="3" fill="#888"/>'
    + '</svg>';

  function svgFor(group, idx) {
    var arr = THUMBS[group];
    if (arr && arr[idx]) return arr[idx];
    return FALLBACK_SVG;
  }

  /* ---------------------------------------------------------------
   * Style injection — scoped to .pmg-photo-preset only so we never
   * affect other pills.
   * --------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('pmg-preset-thumbs-style')) return;
    var css = [
      '#' + SUITE_ID + ' .pmg-photo-preset {',
      '  display: inline-flex; align-items: center; gap: 7px;',
      '  padding-left: 10px;',
      '}',
      '#' + SUITE_ID + ' .pmg-preset-thumb {',
      '  flex: 0 0 auto;',
      '  width: 18px; height: 18px;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  border-radius: 5px; overflow: hidden;',
      '  background: transparent;',
      '  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  transition: transform 160ms ease, box-shadow 160ms ease;',
      '}',
      '#' + SUITE_ID + ' .pmg-preset-thumb svg { width: 100%; height: 100%; display: block; }',
      '#' + SUITE_ID + ' .pmg-photo-preset:hover .pmg-preset-thumb {',
      '  transform: scale(1.08);',
      '  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 50%, transparent);',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-preset.is-active .pmg-preset-thumb {',
      '  box-shadow: 0 0 0 1.5px var(--color-primary);',
      '}',
      /* Dark mode: add a subtle inner ring so light thumbs (Editorial,
         Minimalist, Overcast) don\'t blend into the dark surface. */
      '[data-theme="dark"] #' + SUITE_ID + ' .pmg-preset-thumb {',
      '  box-shadow: 0 0 0 1px color-mix(in srgb, #fff 18%, transparent);',
      '}',
      /* Reduce-motion: drop the hover transform but keep the ring change
         so feedback is still visible. */
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + SUITE_ID + ' .pmg-preset-thumb { transition: none; }',
      '  #' + SUITE_ID + ' .pmg-photo-preset:hover .pmg-preset-thumb { transform: none; }',
      '}',
      /* Mobile (≤420px): tighten the gap so a 4-preset row still fits
         the 360px viewport without horizontal overflow. */
      '@media (max-width: 420px) {',
      '  #' + SUITE_ID + ' .pmg-photo-preset {',
      '    padding-left: 8px; padding-right: 12px; gap: 5px;',
      '  }',
      '  #' + SUITE_ID + ' .pmg-preset-thumb { width: 16px; height: 16px; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-preset-thumbs-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------------------
   * Per-button thumbnail injection
   * --------------------------------------------------------------- */
  function injectThumb(btn) {
    if (!btn || btn.getAttribute(THUMB_ATTR) === DONE_VALUE) return;
    var group = btn.getAttribute('data-group');
    var idxRaw = btn.getAttribute('data-preset-index');
    var idx = parseInt(idxRaw, 10);
    if (!group || isNaN(idx)) {
      /* Mark as done anyway so we don\'t keep retrying a malformed
         button. */
      btn.setAttribute(THUMB_ATTR, DONE_VALUE);
      return;
    }
    var span = document.createElement('span');
    span.className = 'pmg-preset-thumb';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = svgFor(group, idx);
    /* Insert at the very start of the button so the existing label
       text follows it naturally. */
    btn.insertBefore(span, btn.firstChild);
    btn.setAttribute(THUMB_ATTR, DONE_VALUE);
  }

  /* ---------------------------------------------------------------
   * Lazy loader — IntersectionObserver injects each thumb only when
   * its preset button enters the viewport. Falls back to immediate
   * injection when IO is unavailable (very old browsers).
   * --------------------------------------------------------------- */
  var io = null;
  function ensureIO() {
    if (io || typeof IntersectionObserver !== 'function') return;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          injectThumb(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '120px 0px' });
  }

  function processButtons(root) {
    if (!root || !root.querySelectorAll) return;
    var buttons = root.querySelectorAll('.pmg-photo-preset');
    if (!buttons.length) return;
    ensureIO();
    buttons.forEach(function (btn) {
      if (btn.getAttribute(THUMB_ATTR) === DONE_VALUE) return;
      if (io) io.observe(btn);
      else injectThumb(btn); /* Fallback for ancient browsers */
    });
  }

  /* ---------------------------------------------------------------
   * Mount — inject styles once, then watch #pmg-photo-suite for new
   * preset buttons (the suite mounts asynchronously via pmg-ux.js).
   * --------------------------------------------------------------- */
  function boot() {
    injectStyles();
    var suite = document.getElementById(SUITE_ID);
    if (suite) {
      processButtons(suite);
      observeSuite(suite);
      return;
    }
    /* Suite not mounted yet — observe the body for it to appear. */
    var bodyMo = new MutationObserver(function () {
      var s = document.getElementById(SUITE_ID);
      if (s) {
        bodyMo.disconnect();
        processButtons(s);
        observeSuite(s);
      }
    });
    bodyMo.observe(document.body, { childList: true, subtree: true });
  }

  function observeSuite(suite) {
    /* Watch for any subsequent preset additions (e.g. a re-render
       triggered by personalisation or theme change). */
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('pmg-photo-preset')) {
            if (io) io.observe(n);
            else injectThumb(n);
          } else if (n.querySelectorAll) {
            processButtons(n);
          }
        }
      }
    });
    mo.observe(suite, { childList: true, subtree: true });
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
  window.__pmgPresetThumbs = {
    countInjected: function () {
      return document.querySelectorAll(
        '#' + SUITE_ID + ' .pmg-photo-preset[' + THUMB_ATTR + '="' + DONE_VALUE + '"]'
      ).length;
    },
    countTotal: function () {
      return document.querySelectorAll(
        '#' + SUITE_ID + ' .pmg-photo-preset'
      ).length;
    }
  };

  } catch (e) {
    try { console.warn('[pmg-preset-thumbs] init failed', e); } catch (_) {}
  }
})();
