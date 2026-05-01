/* =============================================================
 * pmg-preset-thumbs.js  (Task #51)
 *
 * Adds a small representative thumbnail to every Quick-Style
 * preset button across all five Photography Suite groups
 * (Style, Camera & Lens, Lighting & Mood, Composition, Color
 * Palette) so users can recognise presets at a glance instead
 * of guessing from text labels.
 *
 * Thumbnails are static SVG files served from
 * /images/presets/<group>-<slug>.svg. Each <img> uses native
 * loading="lazy" and decoding="async" so the browser defers the
 * fetch until the preset scrolls near the viewport.
 *
 * Lazy-load strategy:
 *   • Module is loaded with `defer` so it never blocks parsing.
 *   • A MutationObserver waits for the photo suite to mount
 *     (pmg-ux.js renders it asynchronously after init).
 *   • Each <img> uses native loading="lazy" — no per-image JS
 *     observer needed, the browser handles deferral.
 *
 * Accessibility:
 *   • Each <img> has descriptive alt text (e.g. "Cinematic style
 *     thumbnail: dark widescreen frame with lens flare") so a
 *     screen-reader user gets the same visual hint as a sighted
 *     one. The button's existing aria-label is unchanged.
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
  var BASE_PATH   = '/images/presets/';

  /* ---------------------------------------------------------------
   * Thumbnail manifest — keyed by [group][presetIndex] to match
   * the PRESETS map in pmg-ux.js. Order MUST stay in sync with that
   * file's preset order; if a preset is added or reordered there,
   * add a matching manifest entry here AND a matching SVG file
   * under public/images/presets/. Falls back to a generic dot if a
   * preset has no entry.
   * --------------------------------------------------------------- */
  var THUMBS = {
    style: [
      { file: 'style-cinematic.svg',
        alt:  'Cinematic style thumbnail: dark widescreen frame with letterbox bars and a lens flare highlight.' },
      { file: 'style-editorial.svg',
        alt:  'Editorial style thumbnail: clean light surface with stacked headline and body text bars.' },
      { file: 'style-vintage-film.svg',
        alt:  'Vintage Film style thumbnail: warm sepia gradient with film grain speckles.' },
      { file: 'style-minimalist.svg',
        alt:  'Minimalist style thumbnail: a single small dark dot centred on a calm off-white field.' }
    ],

    camera: [
      { file: 'camera-portrait-lens.svg',
        alt:  'Portrait Lens thumbnail: a sharp central subject surrounded by soft out-of-focus bokeh circles.' },
      { file: 'camera-wide-landscape.svg',
        alt:  'Wide Landscape thumbnail: blue sky with a low sun above a wide range of green mountain peaks.' },
      { file: 'camera-macro-detail.svg',
        alt:  'Macro Detail thumbnail: tight concentric green rings suggesting an extreme close-up.' },
      { file: 'camera-telephoto-action.svg',
        alt:  'Telephoto Action thumbnail: orange and white motion-blur streaks racing across a dark frame.' }
    ],

    lighting: [
      { file: 'lighting-golden-hour.svg',
        alt:  'Golden Hour lighting thumbnail: warm amber-to-magenta sky with a low glowing sun.' },
      { file: 'lighting-studio-softbox.svg',
        alt:  'Studio Softbox lighting thumbnail: soft white-to-grey radial glow on a neutral background.' },
      { file: 'lighting-moody-low-key.svg',
        alt:  'Moody Low Key lighting thumbnail: near-black frame split by a single warm slash of light.' },
      { file: 'lighting-overcast.svg',
        alt:  'Overcast lighting thumbnail: flat grey sky with two soft diffused cloud forms.' }
    ],

    composition: [
      { file: 'composition-rule-of-thirds.svg',
        alt:  'Rule Of Thirds composition thumbnail: a 3 by 3 grid with a teal dot on the upper-right intersection.' },
      { file: 'composition-centered-symmetry.svg',
        alt:  'Centered Symmetry composition thumbnail: a vertical centre axis with mirrored triangle shapes either side.' },
      { file: 'composition-leading-lines.svg',
        alt:  'Leading Lines composition thumbnail: two converging perspective lines drawing the eye to a central vanishing point.' },
      { file: 'composition-wide-establishing.svg',
        alt:  'Wide Establishing composition thumbnail: a panoramic field showing sky, horizon and ground bands.' }
    ],

    palette: [
      { file: 'palette-warm-sunset.svg',
        alt:  'Warm Sunset palette thumbnail: three vertical swatches in yellow, orange and crimson red.' },
      { file: 'palette-cool-blue.svg',
        alt:  'Cool Blue palette thumbnail: three vertical swatches from light cyan through mid blue to deep navy.' },
      { file: 'palette-earthy-neutrals.svg',
        alt:  'Earthy Neutrals palette thumbnail: three vertical swatches in tan, warm brown and forest green.' },
      { file: 'palette-high-contrast-bold.svg',
        alt:  'High Contrast Bold palette thumbnail: three vertical swatches in pure black, white and a bold red.' }
    ]
  };

  /* Generic fallback used when a preset has no manifest entry. */
  var FALLBACK = {
    file: '',
    alt:  'Preset thumbnail.'
  };

  function thumbFor(group, idx) {
    var arr = THUMBS[group];
    if (arr && arr[idx]) return arr[idx];
    return FALLBACK;
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
      '  display: inline-block;',
      '  border-radius: 5px; overflow: hidden;',
      '  background: transparent;',
      '  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  transition: transform 160ms ease, box-shadow 160ms ease;',
      '  vertical-align: middle;',
      '}',
      '#' + SUITE_ID + ' .pmg-preset-thumb img {',
      '  width: 100%; height: 100%; display: block;',
      '  object-fit: cover;',
      '}',
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
    var meta = thumbFor(group, idx);
    if (!meta.file) {
      /* No file mapped — skip silently rather than render a broken
         <img>. Still mark done so we don\'t loop. */
      btn.setAttribute(THUMB_ATTR, DONE_VALUE);
      return;
    }
    var wrap = document.createElement('span');
    wrap.className = 'pmg-preset-thumb';
    var img = document.createElement('img');
    img.src    = BASE_PATH + meta.file;
    img.alt    = meta.alt;
    img.width  = 18;
    img.height = 18;
    img.loading  = 'lazy';
    img.decoding = 'async';
    /* Defensive: if the SVG ever 404s we don\'t want a broken-image
       glyph cluttering the pill. Hide the wrapper instead. */
    img.addEventListener('error', function () {
      wrap.style.display = 'none';
    });
    wrap.appendChild(img);
    /* Insert at the very start of the button so the existing label
       text follows it naturally. */
    btn.insertBefore(wrap, btn.firstChild);
    btn.setAttribute(THUMB_ATTR, DONE_VALUE);
  }

  function processButtons(root) {
    if (!root || !root.querySelectorAll) return;
    var buttons = root.querySelectorAll('.pmg-photo-preset');
    if (!buttons.length) return;
    buttons.forEach(injectThumb);
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
            injectThumb(n);
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
