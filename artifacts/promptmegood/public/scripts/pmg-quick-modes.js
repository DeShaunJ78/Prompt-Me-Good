/* pmg-quick-modes.js — IA-restructure-1
 *
 * Replaces the Advanced Output Settings drop-down (now hidden + its
 * mirror disabled) with a single quiet chip row at the top of the
 * #tuning-panel .tuning-section. Each chip toggles an existing legacy
 * checkbox (#moneyMode, #humanTone, #clarityBoost, plus the calibrated-
 * confidence toggle if present) so every downstream prompt-injection
 * path keeps working unchanged.
 *
 * Also injects a small "Your preferences · set once" divider before
 * #category inside the same section so the overlay reads as TWO zones:
 *   (1) tune this prompt   (2) personal preferences
 *
 * Visual aesthetic: matches existing .pmg-chip pills. No loud emoji,
 * no big colored panels. Active chips fill with the primary token.
 *
 * Kill switches:
 *   ?noqm   |   localStorage.pmg_quick_modes_disable = '1'
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  try {
    var qs = (location && location.search) || '';
    if (/[?&]noqm(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_quick_modes_disable') === '1') return;
  } catch (_) {}

  var MODES = [
    { id: 'moneyMode',    label: 'Growth',     hint: 'Biases output toward sales, marketing, and conversion-focused phrasing.' },
    { id: 'humanTone',    label: 'Human',      hint: 'Adds natural phrasing and reduces obvious robotic patterns.' },
    { id: 'clarityBoost', label: 'Clear',      hint: 'Improves structure and makes the response easier to scan and act on.' },
    { id: 'pmgv3-calibrated-confidence', label: 'Fact-check', hint: 'Asks the model to flag uncertain claims instead of guessing.' }
  ];

  function $(id) { return document.getElementById(id); }

  function resolveSource(id) {
    // Tolerate either the canonical id, a chassis-prefixed one, or a
    // camelCase/kebab-case sibling — the chassis sometimes exposes
    // controls under different naming conventions.
    var kebab = id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return $(id) ||
           $('pmg-' + id) ||
           $('pmgv3-' + id) ||
           $(kebab) ||
           $('pmgv3-' + kebab) ||
           null;
  }

  function reflect(chip, src) {
    var on = !!src.checked;
    chip.classList.toggle('is-on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function makeChip(def) {
    var src = resolveSource(def.id);
    if (!src || (src.type && src.type !== 'checkbox')) return null;

    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pmg-chip pmg-qm-chip';
    chip.setAttribute('aria-pressed', src.checked ? 'true' : 'false');
    chip.setAttribute('data-qm-id', def.id);
    chip.title = def.hint;

    var label = document.createElement('span');
    label.className = 'pmg-chip__label pmg-qm-chip__label';
    label.textContent = def.label;

    var dot = document.createElement('span');
    dot.className = 'pmg-qm-chip__dot';
    dot.setAttribute('aria-hidden', 'true');

    chip.appendChild(dot);
    chip.appendChild(label);
    if (src.checked) chip.classList.add('is-on');

    chip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      src.checked = !src.checked;
      try {
        src.dispatchEvent(new Event('input', { bubbles: true }));
        src.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
      reflect(chip, src);
    });

    // Two-way sync: if anything else toggles the underlying checkbox,
    // mirror the visual state back onto the chip.
    src.addEventListener('change', function () { reflect(chip, src); });
    src.addEventListener('input',  function () { reflect(chip, src); });

    return chip;
  }

  var modesMounted = false;
  function mountModesRow() {
    if (modesMounted) return true;
    var panel = $('tuning-panel');
    if (!panel) return false;
    var section = panel.querySelector('.tuning-section') || panel;
    if (!section || section.querySelector('#pmg-qm-row')) { modesMounted = true; return true; }

    var row = document.createElement('div');
    row.id = 'pmg-qm-row';
    row.className = 'pmg-qm-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Quick modes');

    var heading = document.createElement('div');
    heading.className = 'pmg-qm-row__heading';
    var h = document.createElement('span');
    h.className = 'pmg-qm-row__title';
    h.textContent = 'Quick modes';
    var sub = document.createElement('span');
    sub.className = 'pmg-qm-row__sub';
    sub.textContent = 'Tap a chip to toggle. Hover for what it does.';
    heading.appendChild(h);
    heading.appendChild(sub);
    row.appendChild(heading);

    var chipWrap = document.createElement('div');
    chipWrap.className = 'pmg-qm-chips';
    var made = 0;
    MODES.forEach(function (def) {
      var c = makeChip(def);
      if (c) { chipWrap.appendChild(c); made++; }
    });
    if (!made) return false;
    row.appendChild(chipWrap);
    section.insertBefore(row, section.firstChild);
    modesMounted = true;
    return true;
  }

  var prefDividerMounted = false;
  function mountPreferencesDivider() {
    if (prefDividerMounted) return true;
    var panel = $('tuning-panel');
    if (!panel) return false;
    var cat = panel.querySelector('#category');
    if (!cat) return false;
    if (panel.querySelector('#pmg-pref-divider')) { prefDividerMounted = true; return true; }

    // Walk up to the closest "row-ish" wrapper that is a direct child
    // of the tuning-section, so the divider lands ABOVE the whole
    // Category form-field group rather than mid-field.
    var section = panel.querySelector('.tuning-section') || panel;
    var anchor = cat;
    while (anchor && anchor.parentNode && anchor.parentNode !== section) {
      anchor = anchor.parentNode;
    }
    if (!anchor || anchor === section) anchor = cat;

    var div = document.createElement('div');
    div.id = 'pmg-pref-divider';
    div.className = 'pmg-pref-divider';
    var t = document.createElement('h4');
    t.className = 'pmg-pref-divider__title';
    t.textContent = 'Your preferences';
    var s = document.createElement('p');
    s.className = 'pmg-pref-divider__sub';
    s.textContent = 'Set these once — they stay the same across prompts.';
    div.appendChild(t);
    div.appendChild(s);
    anchor.parentNode.insertBefore(div, anchor);
    prefDividerMounted = true;
    return true;
  }

  function tick() {
    var a = mountModesRow();
    var b = mountPreferencesDivider();
    return a && b;
  }

  function boot() {
    if (tick()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (tick() || tries > 80) clearInterval(iv);
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
