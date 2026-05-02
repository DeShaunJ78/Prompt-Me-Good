/* =============================================================
 * pmg-text-feedback.js  (Task #48)
 *
 * Text Builder live feedback layer for "Create A Text Prompt"
 * mode. Mounts a single panel just above the "Fix My Prompt"
 * action row that:
 *
 *   1. Live preview pane — collapsible <details> showing the
 *      currently-assembled prompt (mirrors what the form would
 *      send if the user hit "Fix My Prompt" right now). Updates
 *      live as the user types in goal/details/rules or limits
 *      and as they change any select/checkbox.
 *
 *   2. Confidence meter — three-state strip ("Too vague" /
 *      "Getting there" / "Specific enough") driven by goal
 *      length, presence of details/rules/length limit, and
 *      vague-word count. Tone matches the existing
 *      strength-score "weak / ok / strong" colors.
 *
 *   3. Token / character estimate — char count + rough token
 *      estimate (chars / 4) with a soft visual warning at
 *      ~3000 tokens (well inside every modern model's context).
 *      Just an estimate — per-model accuracy is out of scope.
 *
 *   4. Lightweight linter — flags vague words ("good", "nice",
 *      "thing(s)", "stuff", "something", "somehow", "whatever",
 *      "awesome", "great", "amazing") inline as small chips with
 *      hover-tip suggestions for stronger replacements. No
 *      auto-rewrite (that's Fix My Prompt's job).
 *
 * Strict additive: only renders inside the text-builder mode
 * (body.pmg-text-sibling). Hides itself when image mode is
 * active. Never reads/writes anything from the backend, never
 * touches Stripe/Supabase/Auth/AI, never renames an ID.
 *
 * Reuses the form's existing assembler via window.__pmgText
 * (exposed from the main app IIFE in index.html). If that hook
 * isn't ready yet, we just defer work via a short retry loop.
 *
 * Disable hatch: ?notextfeedback query param OR
 *                localStorage.pmg_textfeedback_disable = '1'.
 * ============================================================= */
(function () {
  'use strict';

  /* -------- Disable hatch -------- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('notextfeedback') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_textfeedback_disable') === '1') return;
  } catch (_) {}

  var BODY_CLASS = 'pmg-text-sibling';
  var PANEL_ID   = 'pmg-tf-feedback';
  var STYLE_ID   = 'pmg-text-feedback-css';
  var COLLAPSE_KEY = 'pmg.textfeedback.preview.collapsed';
  /* Task #74 — confidence-meter personalization. We persist the
     last N confidence scores at submit time so the bands can
     adapt to the user's typical prompt style. */
  var HIST_KEY     = 'pmg.textfeedback.history';
  var HIST_MAX     = 20;  /* keep last ~20 submits */
  var HIST_MIN_FIT = 5;   /* require this many before adapting */
  /* Default fixed thresholds — also the values we fall back to
     when storage is blocked or history is too short. */
  var DEFAULT_BANDS = { weak: 35, strong: 70 };

  /* -------- Vague-word lexicon. Lowercase keys; values are
     1–3 stronger alternatives. Word-boundary matched, case
     insensitive. We deliberately keep this list short — false
     positives erode trust faster than missed words. -------- */
  var VAGUE = {
    'good':      ['effective', 'profitable', 'high-converting'],
    'nice':      ['polished', 'welcoming', 'refined'],
    'great':     ['standout', 'measurable', 'high-impact'],
    'awesome':   ['standout', 'high-impact', 'memorable'],
    'amazing':   ['standout', 'high-impact', 'memorable'],
    'thing':     ['product', 'asset', 'deliverable'],
    'things':    ['products', 'assets', 'deliverables'],
    'stuff':     ['details', 'examples', 'materials'],
    'something': ['a specific tool', 'a specific outcome', 'a concrete example'],
    'somehow':   ['with a clear method', 'using a defined process'],
    'whatever':  ['any specific option', 'a defined choice']
  };

  /* -------- Small helpers -------- */
  function $id(id) { return document.getElementById(id); }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }
  function readCollapsed() {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (_) { return false; }
  }
  function writeCollapsed(v) {
    try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch (_) {}
  }

  /* -------- Confidence history (Task #74) ----------------------
     We store an array of integer scores in localStorage. Anything
     malformed gets thrown away so a user clearing storage or
     hand-editing it can't crash the panel. Storage failures
     (Safari private mode, quota, blocked cookies) are swallowed —
     the meter still works, it just falls back to default bands. */
  function readHistory() {
    try {
      var raw = localStorage.getItem(HIST_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var n = Number(arr[i]);
        if (isFinite(n) && n >= 0 && n <= 100) out.push(Math.round(n));
      }
      if (out.length > HIST_MAX) out = out.slice(out.length - HIST_MAX);
      return out;
    } catch (_) { return []; }
  }
  function writeHistory(list) {
    try {
      var trimmed = list.slice(Math.max(0, list.length - HIST_MAX));
      localStorage.setItem(HIST_KEY, JSON.stringify(trimmed));
    } catch (_) {}
  }
  function pushHistory(score) {
    var n = Math.round(Number(score));
    if (!isFinite(n) || n < 0 || n > 100) return;
    var list = readHistory();
    list.push(n);
    writeHistory(list);
    /* Force a re-render so the new bands take effect immediately
       on the next score (the user's *next* keystroke would also
       do it, but doing it now keeps the meter honest). */
    cachedBands = null;
    lastSig = '';
    renderDebounced();
  }
  function clearHistory() {
    try { localStorage.removeItem(HIST_KEY); } catch (_) {}
    cachedBands = null;
    lastSig = '';
    renderDebounced();
  }
  function median(sorted) {
    var n = sorted.length;
    if (n === 0) return 50;
    var mid = Math.floor(n / 2);
    return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  /* Compute personalized weak/strong thresholds from the user's
     history. Bands shift toward the user's typical score so
     "Specific enough" feels earned. We clamp the strong threshold
     into [50, 90] and force a >=15-pt gap so the bands can never
     invert and weak can never disappear entirely. */
  function computeBands() {
    var hist = readHistory();
    if (hist.length < HIST_MIN_FIT) {
      return { weak: DEFAULT_BANDS.weak, strong: DEFAULT_BANDS.strong, personalized: false, sample: hist.length };
    }
    var sorted = hist.slice().sort(function (a, b) { return a - b; });
    var med = median(sorted);
    var strong = Math.round(med);
    if (strong < 50) strong = 50;
    if (strong > 90) strong = 90;
    var weak = Math.round(med * 0.5);
    if (weak < 15) weak = 15;
    if (weak > strong - 15) weak = strong - 15;
    return { weak: weak, strong: strong, personalized: true, sample: hist.length };
  }
  /* Bands are recomputed only when history changes (on submit /
     clear). Holding a cached value keeps the per-keystroke render
     path allocation-free. */
  var cachedBands = null;
  function getBands() {
    if (!cachedBands) cachedBands = computeBands();
    return cachedBands;
  }

  /* -------- CSS — scoped to body.pmg-text-sibling so image
     mode and other pages are completely unaffected. Reuses the
     same CSS variables (--color-*, --space-*, --radius-*) the
     rest of the app uses, so the panel inherits both light and
     dark themes plus the user's accent color automatically. -- */
  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + PANEL_ID + ' { display: none; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' {',
      '  display: block;',
      '  margin: 14px 0 12px;',
      '  padding: 14px 16px 12px;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f6e6a) 18%, var(--color-border, #d8d4cd));',
      '  border-radius: var(--radius-lg, 14px);',
      '  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06));',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-head {',
      '  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;',
      '  margin-bottom: 10px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-eyebrow {',
      '  display: inline-flex; align-items: center; padding: 2px 10px;',
      '  border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, transparent);',
      '  color: var(--color-primary, #0f6e6a);',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-title {',
      '  margin: 0; font-size: 15px; font-weight: 800; color: var(--color-text, #1d2a32);',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-tip {',
      '  margin-left: auto; font-size: 12px; color: var(--color-text-muted, #5f6b75);',
      '}',
      /* Confidence row */
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-conf {',
      '  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 6px 0 10px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-conf-bar {',
      '  position: relative; flex: 1 1 200px; min-width: 160px; height: 8px;',
      '  background: color-mix(in srgb, var(--color-text, #1d2a32) 8%, transparent);',
      '  border-radius: 999px; overflow: hidden;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-conf-fill {',
      '  position: absolute; inset: 0 auto 0 0; width: 0%;',
      '  background: var(--color-primary, #0f6e6a);',
      '  border-radius: inherit;',
      '  transition: width 220ms ease, background-color 220ms ease;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="weak"]   .pmg-tff-conf-fill { background: #d96b6b; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="ok"]     .pmg-tff-conf-fill { background: #d4a13a; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="strong"] .pmg-tff-conf-fill { background: var(--color-primary, #0f6e6a); }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-conf-label {',
      '  font-size: 13px; font-weight: 700; color: var(--color-text, #1d2a32); min-width: 130px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="weak"]   .pmg-tff-conf-label { color: #b94a4a; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="ok"]     .pmg-tff-conf-label { color: #a07a18; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '[data-conf="strong"] .pmg-tff-conf-label { color: var(--color-primary, #0f6e6a); }',
      /* Tuned-bands "i" badge — sits between the label and the
         bar. Hidden until the user has enough submit history to
         personalize. Reuses the primary color so it reads as
         informational, not as an alert. */
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-tuned {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 18px; height: 18px; padding: 0; border-radius: 999px;',
      '  font-size: 11px; font-weight: 800; line-height: 1;',
      '  font-family: var(--font-body, inherit); font-style: italic;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, transparent);',
      '  color: var(--color-primary, #0f6e6a);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f6e6a) 40%, transparent);',
      '  cursor: help;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-tuned[hidden] { display: none; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-tuned:focus-visible {',
      '  outline: 2px solid var(--color-primary, #0f6e6a); outline-offset: 2px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-tokens {',
      '  font-size: 12px; color: var(--color-text-muted, #5f6b75); white-space: nowrap;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + '.pmg-tff-tokens-warn .pmg-tff-tokens {',
      '  color: #b94a4a; font-weight: 700;',
      '}',
      /* Linter chips */
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint {',
      '  margin: 6px 0 10px;',
      '  font-size: 13px; color: var(--color-text-muted, #5f6b75);',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint[hidden] { display: none; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint-title {',
      '  display: inline-block; font-weight: 700; color: var(--color-text, #1d2a32);',
      '  margin-right: 6px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint-list {',
      '  display: inline-flex; flex-wrap: wrap; gap: 6px; vertical-align: middle;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint-chip {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  padding: 2px 8px; border-radius: 999px;',
      '  background: color-mix(in srgb, #d4a13a 15%, transparent);',
      '  border: 1px solid color-mix(in srgb, #d4a13a 35%, transparent);',
      '  color: #855e0a; font-size: 12px; font-weight: 600; cursor: default;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint-chip-word { font-weight: 700; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-lint-chip-arrow { opacity: 0.7; }',
      /* Live preview */
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview {',
      '  margin-top: 8px;',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #1d2a32) 8%, transparent);',
      '  border-radius: 10px;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 3%, var(--color-surface, #fff));',
      '  overflow: hidden;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview > summary {',
      '  list-style: none; cursor: pointer;',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 10px 12px; font-weight: 700; font-size: 13px;',
      '  color: var(--color-text, #1d2a32);',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview > summary::-webkit-details-marker { display: none; }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview > summary::after {',
      '  content: "▾"; margin-left: auto; font-size: 12px; color: var(--color-text-muted, #5f6b75);',
      '  transition: transform 180ms ease;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview[open] > summary::after { transform: rotate(180deg); }',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview-body {',
      '  padding: 0 12px 12px;',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview-text {',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
      '  font-size: 12.5px; line-height: 1.55;',
      '  white-space: pre-wrap; word-wrap: break-word;',
      '  max-height: 220px; overflow: auto;',
      '  padding: 10px 12px;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #1d2a32) 6%, transparent);',
      '  border-radius: 8px;',
      '  color: var(--color-text, #1d2a32);',
      '}',
      'body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview-empty {',
      '  font-style: italic; color: var(--color-text-muted, #5f6b75);',
      '  font-family: var(--font-body, inherit);',
      '}',
      /* Reduced motion: kill our animations only — never touch globals */
      '@media (prefers-reduced-motion: reduce) {',
      '  body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-conf-fill,',
      '  body.' + BODY_CLASS + ' #' + PANEL_ID + ' .pmg-tff-preview > summary::after {',
      '    transition: none;',
      '  }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* -------- Build the panel DOM. We build it once, then reuse
     element refs on every recompute so we never thrash the DOM
     when the user is typing. -------- */
  var refs = null;
  function buildPanel() {
    if (refs) return refs;
    var panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Live prompt feedback');
    panel.innerHTML =
      '<div class="pmg-tff-head">' +
        '<span class="pmg-tff-eyebrow">Live Feedback</span>' +
        '<h3 class="pmg-tff-title">How Your Prompt Is Shaping Up</h3>' +
        '<span class="pmg-tff-tip" aria-hidden="true">Updates as you type</span>' +
      '</div>' +
      '<div class="pmg-tff-conf" role="status" aria-live="polite" aria-atomic="true">' +
        '<span class="pmg-tff-conf-label">Too vague</span>' +
        '<button type="button" class="pmg-tff-tuned" hidden ' +
                'aria-label="About these confidence bands" ' +
                'title="Tuned to your recent prompts">i</button>' +
        '<span class="pmg-tff-conf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Too vague (0 of 100)">' +
          '<span class="pmg-tff-conf-fill" aria-hidden="true"></span>' +
        '</span>' +
        '<span class="pmg-tff-tokens">0 chars · ~0 tokens</span>' +
      '</div>' +
      '<p class="pmg-tff-lint" hidden>' +
        '<span class="pmg-tff-lint-title">Vague words:</span>' +
        '<span class="pmg-tff-lint-list"></span>' +
      '</p>' +
      '<details class="pmg-tff-preview"' + (readCollapsed() ? '' : ' open') + '>' +
        '<summary><span class="pmg-tff-preview-summary-label">Live Preview Of Your Prompt</span></summary>' +
        '<div class="pmg-tff-preview-body">' +
          '<pre class="pmg-tff-preview-text"></pre>' +
        '</div>' +
      '</details>';

    refs = {
      panel:        panel,
      confLabel:    panel.querySelector('.pmg-tff-conf-label'),
      confTuned:    panel.querySelector('.pmg-tff-tuned'),
      confFill:     panel.querySelector('.pmg-tff-conf-fill'),
      confBar:      panel.querySelector('.pmg-tff-conf-bar'),
      tokens:       panel.querySelector('.pmg-tff-tokens'),
      lintWrap:     panel.querySelector('.pmg-tff-lint'),
      lintList:     panel.querySelector('.pmg-tff-lint-list'),
      preview:      panel.querySelector('.pmg-tff-preview'),
      previewText:  panel.querySelector('.pmg-tff-preview-text')
    };

    /* Tuned-bands "i" badge: native title for hover, a click
       handler to surface the same explanation for keyboard /
       touch users (no native title display on tap). The button
       has type="button" so it never submits the form. */
    if (refs.confTuned) {
      refs.confTuned.addEventListener('click', function (e) {
        e.preventDefault();
        var msg = refs.confTuned.getAttribute('title') ||
                  'Tuned to your recent prompts';
        if (typeof window.showToast === 'function') {
          try { window.showToast(msg); return; } catch (_) {}
        }
        try { window.alert(msg); } catch (_) {}
      });
    }

    /* Persist open/closed across reloads. The user only opens
       the live preview when they actually want it; remembering
       their choice keeps the page calm. */
    refs.preview.addEventListener('toggle', function () {
      writeCollapsed(!refs.preview.open);
    });

    return refs;
  }

  /* -------- Mount: place panel right above the action row so
     the live preview sits between the goal and the "Fix My
     Prompt" button. Idempotent + observed so other late-running
     scripts can't push our panel out of position. -------- */
  function mount() {
    var anchor = $id('tour-step-generate') ||
                 document.querySelector('[data-pmg-tour-id="tour-step-generate"]');
    if (!anchor || !anchor.parentNode) return false;
    var existing = $id(PANEL_ID);
    var panel = buildPanel().panel;
    if (existing && existing !== panel) {
      try { existing.remove(); } catch (_) {}
    }
    if (anchor.previousElementSibling !== panel) {
      anchor.parentNode.insertBefore(panel, anchor);
    }
    return true;
  }

  /* -------- Confidence scorer. Uses a 0–100 band aligned with
     the existing __pmgStrengthScore weak/ok/strong color stops.

       <  35: weak  → "Too vague"
       35–69: ok    → "Getting there"
       >= 70: strong→ "Specific enough"

     Heuristics — additive, capped at 100:
       + up to 35 pts for goal length (sweet spot at ~120 chars)
       + 12 pts if details present
       + 8  pts if rules-or-limits present
       + 8  pts if max length set
       + 8  pts if a personality is picked (not "none")
       + 4  pts each for non-default category/tone/format/skill
       − 4  pts per vague word (capped at -16) so a goal full of
              "good things" can't read as Specific Enough.
  -------- */
  function scoreConfidence(data, vagueCount, bands) {
    var goal = (data.goal || '').trim();
    var goalLen = goal.length;
    var s = 0;
    if (goalLen > 0) {
      s += Math.min(35, Math.round((goalLen / 120) * 35));
    }
    if ((data.details || '').trim()) s += 12;
    if ((data['rules or limits'] || '').trim()) s += 8;
    if (data.maxLength && data.maxLength > 0) s += 8;
    if (data.personality && data.personality !== 'none') s += 8;
    /* Only credit category/tone/format/skill when the user picked
       something other than the form's first-option defaults
       (`business`, `professional`, `step-by-step`, `beginner`).
       Otherwise the meter would read "Specific enough" before the
       user has even thought about the prompt. */
    if (data.category && data.category !== 'business') s += 4;
    if (data.tone && data.tone !== 'professional') s += 4;
    if (data.outputFormat && data.outputFormat !== 'step-by-step') s += 4;
    if (data.skillLevel && data.skillLevel !== 'beginner') s += 4;
    s -= Math.min(16, vagueCount * 4);
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    /* Bands default to the original fixed thresholds (35/70). When
       the user has accumulated enough submit history, getBands()
       will hand back personalized values clamped to a safe range. */
    var b = bands || DEFAULT_BANDS;
    var band, label;
    if (s < b.weak) { band = 'weak'; label = 'Too vague'; }
    else if (s < b.strong) { band = 'ok'; label = 'Getting there'; }
    else { band = 'strong'; label = 'Specific enough'; }
    return { score: s, band: band, label: label };
  }

  /* -------- Lint scanner. We scan goal + details + rules in a
     single pass with one regex, then aggregate counts. We only
     surface unique words (not every occurrence) so a goal that
     says "good good good" shows one chip, not three. -------- */
  var LINT_RE = (function () {
    return new RegExp('\\b(' + Object.keys(VAGUE).join('|') + ')\\b', 'gi');
  })();
  function scanVague(data) {
    var hay = [
      data.goal || '',
      data.details || '',
      data['rules or limits'] || ''
    ].join(' \n ');
    var found = Object.create(null);
    var total = 0;
    LINT_RE.lastIndex = 0;
    var m;
    while ((m = LINT_RE.exec(hay)) !== null) {
      var w = m[1].toLowerCase();
      if (!VAGUE[w]) continue;
      total += 1;
      if (!found[w]) found[w] = true;
    }
    var uniques = Object.keys(found);
    return { total: total, unique: uniques };
  }

  /* -------- Token estimator. Per-model accuracy is explicitly
     out of scope (see task #48 "Out of scope"). chars / 4 is the
     standard rough estimate used by OpenAI's own quickstart docs
     and is good enough for "will this fit" gut feel. -------- */
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.max(1, Math.round(text.length / 4));
  }

  /* -------- Renderer — single function, called every time any
     watched input changes (debounced). -------- */
  var lastSig = '';
  /* Most-recent confidence score from render(). Submit hook reads
     this so we don't have to re-grab the form data + re-score
     when the builder emits pmg:builder-finalized. */
  var lastConfScore = null;
  function render() {
    if (!refs) return;
    if (!isTextMode()) return;

    var hook = window.__pmgText;
    if (!hook || typeof hook.getFormData !== 'function' || typeof hook.generatePrompt !== 'function') {
      /* Hook not ready yet — try again shortly. The IIFE that
         exposes window.__pmgText runs on DOMContentLoaded just
         like us, so this only matters during the very first
         tick. */
      setTimeout(render, 100);
      return;
    }

    var data;
    try { data = hook.getFormData(); } catch (_) { return; }

    var assembled = '';
    try { assembled = hook.generatePrompt(data); } catch (_) { assembled = ''; }

    var lint = scanVague(data);
    var bands = getBands();
    var conf = scoreConfidence(data, lint.total, bands);
    /* Stash the latest score so the submit hook can record it
       without recomputing from form state. */
    lastConfScore = conf.score;
    var charCount = assembled.length;
    var tokenEstimate = estimateTokens(assembled);

    /* Signature: include the FULL assembled prompt so any edit
       that keeps the same length/first char (very common while
       typing) still triggers a preview refresh. String compare on
       ~1–4KB is cheap relative to the 150ms debounce. Avoids
       feedback loops with other MutationObservers on the page.
       Bands are part of the sig so a tuned-bands change after a
       submit also forces a label refresh on the next paint. */
    var sig = conf.score + '|' + conf.band + '|' + tokenEstimate +
              '|' + lint.unique.join(',') + '|' +
              bands.weak + ':' + bands.strong + ':' + (bands.personalized ? 'p' : 'd') +
              '|' + assembled;
    if (sig === lastSig) return;
    lastSig = sig;

    /* Confidence */
    refs.panel.setAttribute('data-conf', conf.band);
    refs.confFill.style.width = conf.score + '%';
    if (refs.confLabel.textContent !== conf.label) {
      refs.confLabel.textContent = conf.label;
    }
    /* role/min/max are static (set once in buildPanel); only the
       live values need updating here. */
    refs.confBar.setAttribute('aria-valuenow', String(conf.score));
    refs.confBar.setAttribute('aria-valuetext', conf.label + ' (' + conf.score + ' of 100)');

    /* Tuned-bands indicator: only visible once we've collected
       enough submits to actually personalize. The tooltip text
       includes the sample size + active bounds so power users
       can see exactly what was learned. */
    if (refs.confTuned) {
      if (bands.personalized) {
        var tip = 'Tuned to your recent prompts (' + bands.sample +
                  ' submits). Bands: vague <' + bands.weak +
                  ', specific ≥' + bands.strong + '.';
        refs.confTuned.setAttribute('title', tip);
        refs.confTuned.setAttribute('aria-label', tip);
        refs.confTuned.hidden = false;
      } else {
        refs.confTuned.hidden = true;
      }
    }

    /* Token / char estimate */
    var tokenText = charCount.toLocaleString() + ' chars · ~' +
                    tokenEstimate.toLocaleString() + ' tokens';
    if (tokenEstimate > 3000) {
      tokenText += ' · long';
      refs.panel.classList.add('pmg-tff-tokens-warn');
    } else {
      refs.panel.classList.remove('pmg-tff-tokens-warn');
    }
    if (refs.tokens.textContent !== tokenText) {
      refs.tokens.textContent = tokenText;
    }

    /* Linter */
    if (lint.unique.length === 0) {
      refs.lintWrap.hidden = true;
      refs.lintList.innerHTML = '';
    } else {
      var html = lint.unique.map(function (w) {
        var subs = VAGUE[w] || [];
        var tip = subs.length
          ? 'Try: ' + subs.join(', ')
          : 'Pick a more specific word.';
        return '<span class="pmg-tff-lint-chip" title="' + escHtml(tip) + '">' +
                 '<span class="pmg-tff-lint-chip-word">' + escHtml(w) + '</span>' +
                 '<span class="pmg-tff-lint-chip-arrow" aria-hidden="true">→</span>' +
                 '<span class="pmg-tff-lint-chip-sub">' + escHtml(subs[0] || 'be specific') + '</span>' +
               '</span>';
      }).join('');
      refs.lintList.innerHTML = html;
      refs.lintWrap.hidden = false;
    }

    /* Live preview pane */
    if (!data.goal) {
      refs.previewText.classList.add('pmg-tff-preview-empty');
      refs.previewText.textContent = 'Type your goal above and your prompt will appear here.';
    } else {
      refs.previewText.classList.remove('pmg-tff-preview-empty');
      refs.previewText.textContent = assembled;
    }
  }
  var renderDebounced = debounce(render, 150);

  /* -------- Listeners — one delegated input + change handler
     on the prompt form covers every textarea/select/checkbox
     the user can touch. We set up listeners ONCE, on the form,
     not per-input — so dynamically-injected fields (none today,
     but defensive) would still work. -------- */
  function attachListeners() {
    var form = $id('prompt-form');
    if (!form || form.__pmgTfBound) return;
    form.__pmgTfBound = true;
    form.addEventListener('input',  renderDebounced);
    form.addEventListener('change', renderDebounced);

    /* Task #74 — Record confidence at submit time. The main app
       fires pmg:builder-finalized after every successful prompt
       generation (form submit AND "Fix My Prompt" both go through
       finalize()), so subscribing here covers all submit paths
       without us having to wrap the form's submit handler. We
       prefer the cached lastConfScore (kept fresh by render() on
       every keystroke) so we never disagree with the on-screen
       meter; if we somehow missed a render we recompute from the
       event detail as a fallback. */
    document.addEventListener('pmg:builder-finalized', function (e) {
      var score = lastConfScore;
      if (score == null) {
        try {
          var d = (e && e.detail && e.detail.data) || null;
          if (d) {
            var lint = scanVague(d);
            score = scoreConfidence(d, lint.total, getBands()).score;
          }
        } catch (_) {}
      }
      if (score != null) pushHistory(score);
    });
  }

  /* Re-anchor watchdog: other scripts (pmg-ux.js relocations,
     pmg-text-flow-v2 step injections) may insert nodes between
     our panel and the action row. Mirror text-flow-v2's
     observer pattern so we re-run mount() if our anchor moves.
  -------- */
  function findAnchor() {
    return $id('tour-step-generate') ||
           document.querySelector('[data-pmg-tour-id="tour-step-generate"]');
  }
  function watchAnchor() {
    if (typeof MutationObserver !== 'function') return;
    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;
    var pending = false;
    var observedParent = anchor.parentNode;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      (window.requestAnimationFrame || setTimeout)(function () {
        pending = false;
        mount();
        /* If the anchor was reparented to a brand-new container
           (e.g. some other script swaps the action row's wrapper),
           re-bind the observer to the new parent so we keep
           catching reorders. */
        var current = findAnchor();
        if (current && current.parentNode && current.parentNode !== observedParent) {
          try { mo.disconnect(); } catch (_) {}
          observedParent = current.parentNode;
          mo.observe(observedParent, { childList: true });
        }
      }, 16);
    });
    mo.observe(observedParent, { childList: true });
  }

  /* Mode awareness — only render in text mode. Mirrors
     pmg-text-flow-v2's body class watcher. */
  function isTextMode() {
    return !!(document.body && document.body.classList.contains(BODY_CLASS));
  }
  function watchMode() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    /* Other scripts (sticky bars, tour overlays, etc.) toggle
       body classes constantly. We must only react when the
       text-mode body class itself flips, otherwise our debounce
       timer would be reset on every unrelated mutation and the
       renderer would never settle. */
    var lastMode = isTextMode();
    try {
      var mo = new MutationObserver(function () {
        var nowMode = isTextMode();
        if (nowMode === lastMode) return;
        lastMode = nowMode;
        /* Mode switched. Re-render so the panel hides/shows and
           contents reflect the current form state. */
        renderDebounced();
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }

  /* -------- Init -------- */
  function init() {
    if (!document.body) return;
    /* Only relevant on the main builder page. */
    if (!$id('prompt-form') || !$id('goal')) return;
    injectCss();
    var ok = mount();
    /* Belt + suspenders: pmg-text-flow-v2 may DOM-shuffle after
       us; retry a few times before giving up. */
    if (!ok) {
      setTimeout(mount, 100);
      setTimeout(mount, 500);
      setTimeout(mount, 1500);
    }
    attachListeners();
    watchAnchor();
    watchMode();
    /* First paint. */
    setTimeout(render, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* Debug hooks. */
  window.__pmgTextFeedback = {
    enable: function () {
      try { localStorage.removeItem('pmg_textfeedback_disable'); } catch (_) {}
      init();
    },
    disable: function () {
      try { localStorage.setItem('pmg_textfeedback_disable', '1'); } catch (_) {}
      var p = $id(PANEL_ID);
      if (p) p.remove();
    },
    refresh: function () { cachedBands = null; lastSig = ''; render(); },
    /* Task #74 — surfaced for tests + power-user diagnostics. */
    getHistory: readHistory,
    clearHistory: clearHistory,
    getBands: function () { cachedBands = null; return getBands(); },
    pushHistory: pushHistory
  };
})();
