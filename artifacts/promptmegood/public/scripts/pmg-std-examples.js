/* pmg-std-examples.js (stde-1)
 * "See The Difference" before/after rows → clickable to populate #goal.
 *
 * Behavior:
 *   - Each .std-row[data-pmg-std-example] is a button (role + tabindex set in HTML).
 *   - Click / Enter / Space → switch to Text panel, populate #goal with the
 *     row's "Before" text, fire input event (so chassis-v3 autosave + counters
 *     react), focus + smooth-scroll #goal into view, brief 1.2s pulse on the
 *     textarea border to confirm the load landed.
 *   - Mobile (<=720px): a "Tap to try this prompt →" hint appears below each
 *     Before cell so the tap target is unambiguous.
 *
 * Standard kill-switches (per docs/scripts.md convention):
 *   - URL: ?nostd-examples
 *   - Per-device: localStorage.pmg_std_examples_disable = '1'
 *
 * Idempotent: marks each row with data-pmg-stde-bound="1" so reloads / re-runs
 * don't double-bind.
 */
(function () {
  'use strict';

  /* ---------- Kill switches ---------- */
  try {
    var u = new URL(location.href);
    if (u.searchParams.has('nostd-examples')) return;
  } catch (_) {}
  try {
    if (localStorage.getItem('pmg_std_examples_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-std-examples-style';
  var PULSE_CLASS = 'pmg-stde-loaded';
  var PULSE_MS = 1200;

  /* ---------- Style injection (self-contained, no .css file) ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* The whole row is the button — visual cue + a11y focus ring. */
      '.std-row[data-pmg-std-example] {',
      '  cursor: pointer;',
      '  border-radius: 14px;',
      '  transition: transform 140ms ease, box-shadow 140ms ease;',
      '  outline: none;',
      '}',
      '.std-row[data-pmg-std-example]:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-primary, #3ee0a0) 18%, transparent);',
      '}',
      '.std-row[data-pmg-std-example]:focus-visible {',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #3ee0a0) 55%, transparent);',
      '}',
      '.std-row[data-pmg-std-example]:active { transform: translateY(0); }',
      /* Mobile-only "Tap to try" hint under each Before cell. */
      '@media (max-width: 720px) {',
      '  .std-row[data-pmg-std-example] .std-before { position: relative; }',
      '  .std-row[data-pmg-std-example] .std-before::after {',
      '    content: "Tap to try this prompt \u2192";',
      '    display: block;',
      '    margin-top: 8px;',
      '    font-size: 12px;',
      '    font-weight: 600;',
      '    color: var(--color-primary, #3ee0a0);',
      '    letter-spacing: 0.2px;',
      '  }',
      '}',
      /* Brief pulse on #goal when an example loads. */
      '#goal.' + PULSE_CLASS + ' {',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #3ee0a0) 55%, transparent);',
      '  transition: box-shadow 240ms ease;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .std-row[data-pmg-std-example] { transition: none; }',
      '  .std-row[data-pmg-std-example]:hover { transform: none; }',
      '  #goal.' + PULSE_CLASS + ' { transition: none; }',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- Action: load example into #goal ---------- */
  function loadExample(text) {
    if (!text) return;

    /* Step 1: ensure Text panel is the active panel (the row sits below the
       workstation; user could be viewing Photo/Video when they click). */
    try {
      if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
        window.pmgChassisV3.setActivePanel('text');
      }
    } catch (_) {}

    /* Step 2: populate #goal. Try a couple of times in case chassis-v3 is
       still reparenting the legacy textarea into the v3 slot. */
    function fill(attempt) {
      var goal = document.getElementById('goal');
      if (!goal) {
        if (attempt < 8) return setTimeout(function () { fill(attempt + 1); }, 60);
        return; /* give up silently */
      }
      goal.value = text;
      try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { goal.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}

      /* Step 3: focus + smooth-scroll into view. */
      try { goal.focus({ preventScroll: true }); } catch (_) { try { goal.focus(); } catch (__) {} }
      try {
        goal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {
        try { goal.scrollIntoView(); } catch (__) {}
      }

      /* Step 4: brief visual pulse so the user knows the click landed. */
      goal.classList.add(PULSE_CLASS);
      setTimeout(function () {
        try { goal.classList.remove(PULSE_CLASS); } catch (_) {}
      }, PULSE_MS);
    }
    fill(0);
  }

  /* ---------- Bind rows ---------- */
  function bindRow(row) {
    if (!row || row.getAttribute('data-pmg-stde-bound') === '1') return;
    row.setAttribute('data-pmg-stde-bound', '1');

    row.addEventListener('click', function (e) {
      /* Allow text-selection inside the cells — only act on plain clicks. */
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.toString && sel.toString().length > 0) return;
      e.preventDefault();
      loadExample(row.getAttribute('data-pmg-std-example'));
    });

    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        loadExample(row.getAttribute('data-pmg-std-example'));
      }
    });
  }

  function bindAll() {
    var rows = document.querySelectorAll('.std-row[data-pmg-std-example]');
    for (var i = 0; i < rows.length; i++) bindRow(rows[i]);
  }

  /* ---------- Boot ---------- */
  function boot() {
    injectStyles();
    bindAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* Public API for command-palette / debug. */
  window.pmgStdExamples = {
    refresh: bindAll,
    load: loadExample
  };
})();
