/* pmg-quick-modes.js — IA-restructure-3 (5-section overlay)
 *
 * Builds the /app "Prompt Tuning" overlay as FIVE conceptual section
 * cards so users can scan-and-pick instead of facing a wall of fields.
 *
 * Sections (top to bottom):
 *   1. Quick modes      — 3 chip toggles (Growth / Human / Clear)
 *   2. Style            — How AI thinks + Strict Fact-Check + Audience
 *                         + Voice + Tone
 *   3. Output           — Output Format + Max Length + Language +
 *                         Target Platform
 *   4. Your preferences — Auto-Optimize + Category + Experience Level
 *   5. Expert Command   — Highlighted card at bottom (the standout);
 *      Center             no badge — the visual treatment IS the signal.
 *
 * IA-restructure-3 fixes the homepage bleed introduced by IA-restructure-2.
 * Strategy: do NOT force the legacy <details id="settingsPanel"> open
 * on boot. Instead, wait for the chip overlay to open (body class
 * `pmg-tune-overlay-open`), then build the sections inside the already-
 * reparented #tuning-panel. The companion CSS reveals #settingsPanel's
 * body and the Auto-Optimize mirror ONLY while the overlay is open.
 *
 * Chip row still mounts on boot inside #tuning-panel — that panel is
 * CSS-hidden on the homepage so the chips are DOM-present but invisible
 * until the overlay shows the panel.
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

  // Chips = STYLE only (Growth / Human / Clear). Fact-check absorbed
  // by the labeled Strict Fact-Checking toggle in #pmgv3-epic-tuning.
  var MODES = [
    { id: 'moneyMode',    label: 'Growth', hint: 'Biases output toward sales, marketing, and conversion-focused phrasing.' },
    { id: 'humanTone',    label: 'Human',  hint: 'Adds natural phrasing and reduces obvious robotic patterns.' },
    { id: 'clarityBoost', label: 'Clear',  hint: 'Improves structure and makes the response easier to scan and act on.' }
  ];

  function $(id) { return document.getElementById(id); }

  function resolveSource(id) {
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

    src.addEventListener('change', function () { reflect(chip, src); });
    src.addEventListener('input',  function () { reflect(chip, src); });

    return chip;
  }

  // ----- Chip row (mounted inside #tuning-panel on boot; hidden by
  // ----- the panel's own hide rule until overlay shows the panel) -----
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

    // No internal heading — the parent section card carries the title.
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

  // ----- 5-section card build (inside the open chip overlay) -----
  var SECTIONS = [
    { id: 'pmg-section-modes',  variant: 'modes',  title: 'Quick modes',           sub: 'Tap a chip to toggle.' },
    { id: 'pmg-section-style',  variant: 'style',  title: 'Style',                 sub: 'How it sounds and how it thinks.' },
    { id: 'pmg-section-output', variant: 'output', title: 'Output',                sub: "How it's delivered." },
    { id: 'pmg-section-prefs',  variant: 'prefs',  title: 'Your preferences',      sub: 'Set once — stays the same across prompts.' },
    { id: 'pmg-section-expert', variant: 'expert', title: 'Expert Command Center', sub: 'Full control for power users.' }
  ];

  // DOM routing: id -> section variant
  function fieldWrapper(scope, id) {
    var el = scope.querySelector('#' + CSS.escape(id));
    if (!el) return null;
    var wrap = el.closest ? el.closest('.field') : null;
    return wrap || el.parentNode;
  }

  function makeSectionCard(def) {
    var card = document.createElement('section');
    card.id = def.id;
    card.className = 'pmg-section-card pmg-section-card--' + def.variant;
    card.setAttribute('data-section', def.variant);
    card.innerHTML =
      '<header class="pmg-section-card__head">' +
        '<h3 class="pmg-section-card__title">' + def.title + '</h3>' +
        '<p class="pmg-section-card__sub">' + def.sub + '</p>' +
      '</header>' +
      '<div class="pmg-section-card__body" data-section-body="' + def.variant + '"></div>';
    return card;
  }

  var sectionsBuilt = false;
  function buildFiveSections() {
    if (sectionsBuilt) return true;
    var panel = $('tuning-panel');
    if (!panel) return false;

    // Wait for chassis to have finished injecting #pmgv3-epic-tuning.
    if (!panel.querySelector('#pmgv3-epic-tuning #pmgv3-reasoning-select')) return false;

    var section = panel.querySelector('.tuning-section') || panel;
    if (section.querySelector('#pmg-section-modes')) { sectionsBuilt = true; return true; }

    var sp = panel.querySelector('#settingsPanel');
    if (!sp) return false;
    var grid = sp.querySelector('.settings-grid') || sp;

    // Build all 5 cards, insert at top of section in order.
    var cards = {};
    var i;
    for (i = SECTIONS.length - 1; i >= 0; i--) {
      var c = makeSectionCard(SECTIONS[i]);
      section.insertBefore(c, section.firstChild);
      cards[SECTIONS[i].variant] = c.querySelector('.pmg-section-card__body');
    }

    // ----- Section 1: Quick modes (chip row) -----
    var qm = section.querySelector('#pmg-qm-row');
    if (qm) cards.modes.appendChild(qm);

    // ----- Section 2: Style (epic-tuning + Voice + Tone) -----
    var epic = panel.querySelector('#pmgv3-epic-tuning');
    if (epic) cards.style.appendChild(epic);
    ['personality', 'tone'].forEach(function (id) {
      var w = fieldWrapper(grid, id);
      if (w) cards.style.appendChild(w);
    });

    // ----- Section 3: Output (Format / Length / Language / Platform) -----
    ['outputFormat', 'maxLength', 'outputLanguage'].forEach(function (id) {
      var w = fieldWrapper(grid, id);
      if (w) cards.output.appendChild(w);
    });
    // Platform field is mounted by pmg-target-platform.js as a wrap
    // (id "pmg-target-platform-field"), not via the standard .field
    // pattern — look for it directly.
    var platformWrap = document.getElementById('pmg-target-platform-field');
    if (platformWrap) cards.output.appendChild(platformWrap);

    // ----- Section 4: Preferences (Auto-Optimize mirror first, then
    // Category + Experience). Auto-Optimize mirror is the ONLY visible
    // entry point because chassis-v3 globally hides .auto-optimize-row;
    // companion CSS re-reveals it within the overlay-open scope. -----
    var autoOpt = grid.querySelector('#auto-optimize-row-inside-settings');
    if (autoOpt) cards.prefs.appendChild(autoOpt);
    ['category', 'skillLevel'].forEach(function (id) {
      var w = fieldWrapper(grid, id);
      if (w) cards.prefs.appendChild(w);
    });

    // ----- Section 5: Expert Command Center (the standout) -----
    // INVARIANT (IA-restructure-3): the expert nodes are intentionally
    // relocated PERMANENTLY into the overlay on first open. The chip
    // overlay is now their single home — the builder header no longer
    // surfaces an Expert entry point. Do not add a "restore on close"
    // path; that would re-introduce the visual noise we just removed.
    // Other scripts (pmg-expert-center, pmg-ux, post-spec) query the
    // nodes by global ID so the move is wiring-safe.
    var expertHint = document.getElementById('builder-expert-hint');
    var expertToggleWrap = document.getElementById('expert-mode-toggle-wrap');
    var expertLink = document.getElementById('expert-mode-link');
    if (expertHint) cards.expert.appendChild(expertHint);
    if (expertToggleWrap) cards.expert.appendChild(expertToggleWrap);
    if (expertLink) {
      var linkRow = document.createElement('div');
      linkRow.className = 'pmg-expert-cta-row';
      linkRow.appendChild(expertLink);
      cards.expert.appendChild(linkRow);
    }

    // Clean up the now-redundant IA-restructure-1 divider if present
    // (it sat above #category and is replaced by the prefs card head).
    var oldDivider = section.querySelector('#pmg-pref-divider');
    if (oldDivider) oldDivider.remove();

    sectionsBuilt = true;
    return true;
  }

  // ----- Overlay-open observer: triggers section build only inside the
  // ----- chip overlay so the homepage stays clean. Idempotent + retries
  // ----- for up to ~6 seconds in case chassis injection lags. ---------
  function scheduleBuildInsideOverlay() {
    if (sectionsBuilt) return;
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (buildFiveSections() || attempts > 60) clearInterval(iv);
    }, 100);
  }

  // pmg-tune-chips.js exposes TWO open paths that surface the tuning
  // section to the user: openOverlay() (adds `pmg-tune-overlay-open`)
  // and openFullTuning() (adds `pmg-tune-section-shown`). The "Prompt
  // Tuning" pill on /app currently uses the latter, so we must observe
  // BOTH classes or the 5-section build will never run.
  function isOverlayOpen() {
    var b = document.body;
    return !!b && (
      b.classList.contains('pmg-tune-overlay-open') ||
      b.classList.contains('pmg-tune-section-shown')
    );
  }

  function observeOverlayOpen() {
    if (!document.body) return;
    if (isOverlayOpen()) scheduleBuildInsideOverlay();
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'class' && isOverlayOpen()) {
          scheduleBuildInsideOverlay();
        }
      }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function tickChips() {
    return mountModesRow();
  }

  function boot() {
    if (!tickChips()) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (tickChips() || tries > 80) clearInterval(iv);
      }, 200);
    }
    observeOverlayOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
