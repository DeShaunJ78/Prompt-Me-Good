/* =============================================================
 * pmg-quick-chips.js  (chips-1)
 *
 * Photo + Video Quick Enhancement chips. Mounts a single muted
 * row of small additive chips below the goal textarea on each
 * visual panel. Tapping a chip APPENDS a directive phrase to the
 * existing goal text (never clears or replaces).
 *
 * Scope intentionally narrow — only chips that don't duplicate
 * existing pill / preset / select surfaces:
 *   Photo: Leica Look
 *   Video: Viral · Luxury
 *
 * The Live Preview observers in pmg-visual-studio.js will pick
 * up the textarea change event automatically, so the assembled
 * prompt updates without further wiring.
 *
 * Strict additive: zero backend calls, zero overrides of
 * existing controls.
 *
 * Disable: ?nochips OR localStorage.pmg_chips_disable = "1".
 * Public API: window.pmgQuickChips.{ refresh, dismiss }.
 * ============================================================= */
(function () {
  'use strict';

  if (window.__pmgQuickChipsInit) return;
  window.__pmgQuickChipsInit = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('nochips') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_chips_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-quick-chips-styles';

  var PANELS = {
    image: {
      goalId: 'pmg-vs-image-goal',
      anchorId: 'pmg-coach-image',
      rootId: 'pmg-quick-chips-image',
      title: 'Quick add',
      chips: [
        {
          id: 'leica-look',
          label: 'Leica Look',
          phrase: 'shot on a Leica with its rich color signature, gentle film highlights, and distinctive Leica color rendition'
        }
      ]
    },
    video: {
      goalId: 'pmg-vs-video-goal',
      anchorId: 'pmg-coach-video',
      rootId: 'pmg-quick-chips-video',
      title: 'Quick add',
      chips: [
        {
          id: 'viral',
          label: 'Viral',
          phrase: 'punchy first-frame hook, 3-second pattern interrupt, optimized for thumb-stopping social feeds'
        },
        {
          id: 'luxury',
          label: 'Luxury',
          phrase: 'high-end commercial polish, expensive product feel, restrained motion, cinematic depth'
        }
      ]
    }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#pmg-quick-chips-image, #pmg-quick-chips-video { display: flex; align-items: center; gap: 6px;' +
      '  flex-wrap: wrap; margin: 4px 0 8px; padding: 0; }' +
      '.pmg-quick-chips-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;' +
      '  color: color-mix(in srgb, var(--color-text, #ece9e2) 55%, transparent); margin-right: 4px; }' +
      '.pmg-quick-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;' +
      '  border-radius: 999px; border: 1px solid color-mix(in srgb, var(--color-text, #ece9e2) 18%, transparent);' +
      '  background: transparent; color: var(--color-text, #ece9e2); font-size: 12px; line-height: 1.3;' +
      '  cursor: pointer; transition: all .14s ease; }' +
      '.pmg-quick-chip::before { content: "+"; opacity: .55; font-weight: 700; margin-right: 2px; }' +
      '.pmg-quick-chip:hover, .pmg-quick-chip:focus-visible {' +
      '  border-color: var(--color-primary, #3ee0a0);' +
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 10%, transparent);' +
      '  color: var(--color-primary, #3ee0a0); outline: none; }' +
      '.pmg-quick-chip[data-just-added="1"] {' +
      '  border-color: var(--color-primary, #3ee0a0);' +
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 18%, transparent);' +
      '  color: var(--color-primary, #3ee0a0); }';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function appendPhrase(textarea, phrase) {
    if (!textarea) return;
    var current = (textarea.value || '').replace(/\s+$/, '');
    if (current.length === 0) {
      textarea.value = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    } else {
      var sep = /[.!?]$/.test(current) ? ' ' : ' — ';
      textarea.value = current + sep + phrase;
    }
    /* Fire input + change so the Live Preview MutationObserver in
       pmg-visual-studio.js picks up the new value. */
    try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    /* Move caret to the end and refocus for keyboard users. */
    try {
      textarea.focus();
      var len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    } catch (_) {}
  }

  function buildRow(panel, cfg) {
    var el = document.createElement('div');
    el.id = cfg.rootId;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', (panel === 'image' ? 'Photo' : 'Video') + ' quick-add chips');
    el.innerHTML =
      '<span class="pmg-quick-chips-label">' + cfg.title + ':</span>' +
      cfg.chips.map(function (c) {
        return '<button type="button" class="pmg-quick-chip" data-chip-id="' + c.id + '" ' +
               'title="Append: ' + escapeAttr(c.phrase) + '">' + escapeHtml(c.label) + '</button>';
      }).join('');
    el.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('.pmg-quick-chip');
      if (!btn) return;
      var id = btn.getAttribute('data-chip-id');
      var chip = cfg.chips.find(function (c) { return c.id === id; });
      if (!chip) return;
      var ta = document.getElementById(cfg.goalId);
      appendPhrase(ta, chip.phrase);
      btn.setAttribute('data-just-added', '1');
      setTimeout(function () { btn.removeAttribute('data-just-added'); }, 900);
    });
    return el;
  }

  function ensureMounted(panel) {
    var cfg = PANELS[panel];
    if (document.getElementById(cfg.rootId)) return;
    /* Mount AFTER the coach card if present, otherwise after the live
       preview, otherwise after the goal textarea. */
    var anchor = document.getElementById(cfg.anchorId)
              || document.getElementById('pmg-vs-' + panel + '-live-preview')
              || document.getElementById(cfg.goalId);
    if (!anchor || !anchor.parentNode) return;
    var row = buildRow(panel, cfg);
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
  }

  function observeReady() {
    function tick() { Object.keys(PANELS).forEach(ensureMounted); }
    if (window.pmgMountBus && window.pmgMountBus.isActive()) {
      window.pmgMountBus.subscribe(tick);
      return;
    }
    var observer = new MutationObserver(tick);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { observer.disconnect(); } catch (_) {} }, 30000);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function boot() {
    injectStyles();
    Object.keys(PANELS).forEach(ensureMounted);
    observeReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgQuickChips = {
    refresh: function () { Object.keys(PANELS).forEach(ensureMounted); },
    dismiss: function () {
      Object.keys(PANELS).forEach(function (p) {
        var el = document.getElementById(PANELS[p].rootId);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
  };
})();
