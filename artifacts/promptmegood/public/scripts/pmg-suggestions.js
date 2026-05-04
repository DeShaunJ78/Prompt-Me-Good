/* =============================================================
 * pmg-suggestions.js  (Task #58)
 *
 * Smart pill suggestions + negative pills.
 *
 * Two additive features layered onto the Photography Suite pill
 * picker (#pmg-photo-suite) without renaming or removing any
 * existing IDs, classes, or handlers:
 *
 *   1. "YOU MIGHT ALSO LIKE" ROW — once the user has at least one
 *      active pill, a small horizontal row of 3-5 contextually
 *      relevant pill suggestions appears just below the saved /
 *      recent rows. Tapping a suggestion activates that pill
 *      (same effect as clicking it inside its group). The row
 *      updates live as picks change, and has a dismiss button
 *      that hides it until the next pick change.
 *
 *   2. "AVOID" MODE PER GROUP — every Photography Suite group head
 *      gains a tiny "Avoid" toggle. While Avoid is on for a
 *      group, clicking a pill marks it as a NEGATIVE pill (red
 *      outline, "✕ " prefix) instead of toggling its positive
 *      state. Negative picks are tracked separately, never
 *      counted in the existing positive selection, and rendered
 *      as a single "Avoid: a, b, c" chip line under the live
 *      summary. When the user sends to the image generator (or
 *      runs any image-mode generation), the wrapper appends
 *      "Avoid: ..." to the goal text so DALL·E sees it.
 *
 * Strict additive rules:
 *   - No backend / API / DB / payment / secret changes.
 *   - No edits to existing IDs, class names, or JS variables.
 *   - Reuses existing .pmg-photo-pill elements; adds a new
 *     .is-negative class + new auxiliary elements only.
 *   - Wraps window.generateImage with a no-op fallback when no
 *     negatives exist so the original behavior is unchanged for
 *     users who never enter Avoid mode.
 *
 * Disable hatches:
 *   ?nosuggestions               query param
 *   localStorage.pmg_suggestions_disable = '1'
 *   localStorage.pmg_disable             = '1'   (global PMG disable)
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgSuggestionsLoaded) return;
  window.__pmgSuggestionsLoaded = true;

  /* -------- Disable hatches -------- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nosuggestions\b/.test(qs)) return;
    if (localStorage.getItem('pmg_suggestions_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var SCRIPT_VERSION = 'task58-5';

  var SUITE_ID    = 'pmg-photo-suite';
  var SUMMARY_ID  = 'pmg-photo-summary';
  var SUGGEST_ID  = 'pmg-photo-suggest-row';
  var NEG_ROW_ID  = 'pmg-photo-neg-row';
  var STYLE_ID    = 'pmg-suggestions-style';

  var MAX_SUGGESTIONS    = 5;
  var DISMISS_RESET_KEY  = '__pmgSuggestDismissed';

  /* ------------------------------------------------------------
   * Static co-occurrence map. Each key is a pill value (case-
   * sensitive, must match the GROUPS catalog in pmg-ux.js
   * exactly). Each value is a hand-picked list of related pill
   * values that often go well with it. Pills not in the map
   * contribute zero suggestions — that's fine, the row just
   * doesn't appear if no active pill has any suggestions.
   *
   * Suggestions are ranked by total vote count (one vote per
   * active pill that suggests them), then capped at
   * MAX_SUGGESTIONS. Already-active and already-negative pills
   * are filtered out.
   * ------------------------------------------------------------ */
  var SUGGESTION_MAP = {
    /* style group */
    'Cinematic':           ['Dramatic Shadows', 'Cinematic Low-Key', 'Teal & Orange', '85mm Portrait', 'Dutch Angle'],
    'Portrait':            ['85mm Portrait', 'Studio Softbox', 'Natural Window Light', 'Centered', 'Close-Up'],
    'Documentary':         ['35mm Wide', 'Natural Window Light', 'Rule Of Thirds', 'Muted Earth', 'Black & White'],
    'Editorial':           ['Studio Softbox', 'Fashion', 'High Contrast', '85mm Portrait', 'Pastel Soft'],
    'Street Photography':  ['35mm Wide', 'Black & White', 'Leading Lines', 'Documentary', 'Harsh Noon'],
    'Fashion':             ['Editorial', 'Studio Softbox', 'High Contrast', 'Pastel Soft', '85mm Portrait'],
    'Landscape':           ['Wide Shot', 'Golden Hour', 'Drone Aerial', 'Forest Greens', 'Rule Of Thirds'],
    'Surreal':             ['Dramatic Shadows', 'Neon Glow', 'Dutch Angle', 'Neon Saturated', 'Worm\'s-Eye View'],
    'Vintage':             ['Film Grain', 'Sepia', 'Muted Earth', 'Polaroid', 'Warm Tones'],
    'Hyperrealistic':      ['DSLR', 'Macro', 'High Contrast', 'Natural Window Light', 'Studio Softbox'],
    'Black & White':       ['Dramatic Shadows', 'High Contrast', 'Cinematic Low-Key', 'Documentary', 'Monochrome'],
    'Polaroid':            ['Vintage', 'Film Grain', 'Pastel Soft', 'Centered', 'Natural Window Light'],

    /* camera group */
    '85mm Portrait':       ['Portrait', 'Studio Softbox', 'Centered', 'Natural Window Light', 'Close-Up'],
    '35mm Wide':           ['Street Photography', 'Documentary', 'Rule Of Thirds', 'Natural Window Light'],
    '50mm Standard':       ['Portrait', 'Documentary', 'Rule Of Thirds', 'Natural Window Light'],
    'Macro':               ['Hyperrealistic', 'Studio Softbox', 'Centered', 'High Contrast', 'Close-Up'],
    'Telephoto':           ['Landscape', 'Wide Shot', 'Drone Aerial', 'Golden Hour'],
    'Fisheye':             ['Surreal', 'Dutch Angle', 'Wide Shot', 'GoPro Action'],
    'DSLR':                ['Hyperrealistic', '85mm Portrait', 'Studio Softbox', 'Portrait'],
    'Mirrorless':          ['DSLR', '85mm Portrait', 'Portrait', 'Hyperrealistic'],
    'Film Grain':          ['Vintage', 'Polaroid', 'Sepia', 'Muted Earth'],
    'Drone Aerial':        ['Landscape', 'Bird\'s-Eye View', 'Wide Shot', 'Forest Greens'],
    'GoPro Action':        ['Wide Shot', 'Dutch Angle', 'High Contrast', 'Fisheye'],
    'iPhone Snap':         ['Documentary', 'Natural Window Light', 'Rule Of Thirds'],

    /* lighting group */
    'Golden Hour':         ['Landscape', 'Warm Tones', 'Sunset Reds', 'Natural Window Light', 'Wide Shot'],
    'Blue Hour':           ['Cool Blues', 'Cinematic', 'Cinematic Low-Key', 'Landscape'],
    'Studio Softbox':      ['Portrait', 'Editorial', 'Fashion', '85mm Portrait', 'Centered'],
    'Backlit':             ['Portrait', 'Dramatic Shadows', 'Golden Hour', 'Cinematic'],
    'Natural Window Light':['Portrait', 'Documentary', 'Pastel Soft', 'Centered'],
    'Dramatic Shadows':    ['Cinematic', 'Black & White', 'Cinematic Low-Key', 'High Contrast'],
    'Neon Glow':           ['Surreal', 'Neon Saturated', 'Cool Blues', 'Cinematic'],
    'Candle Lit':          ['Warm Tones', 'Vintage', 'Cinematic Low-Key', 'Close-Up'],
    'Overcast Diffused':   ['Documentary', 'Muted Earth', 'Pastel Soft', 'Forest Greens'],
    'Moonlit':             ['Cool Blues', 'Cinematic Low-Key', 'Surreal', 'Landscape'],
    'Harsh Noon':          ['Documentary', 'High Contrast', 'Street Photography'],
    'Cinematic Low-Key':   ['Cinematic', 'Dramatic Shadows', 'Black & White', 'Backlit'],

    /* composition group */
    'Rule Of Thirds':      ['Documentary', 'Landscape', 'Street Photography', '35mm Wide'],
    'Centered':            ['Portrait', 'Symmetrical', '85mm Portrait', 'Studio Softbox'],
    'Symmetrical':         ['Centered', 'Frame Within A Frame', 'Studio Softbox'],
    'Close-Up':            ['Portrait', 'Macro', '85mm Portrait', 'Studio Softbox'],
    'Wide Shot':           ['Landscape', 'Drone Aerial', 'GoPro Action', 'Golden Hour'],
    'Bird\'s-Eye View':    ['Drone Aerial', 'Landscape', 'Wide Shot'],
    'Worm\'s-Eye View':    ['Surreal', 'Dutch Angle', 'Dramatic Shadows'],
    'Dutch Angle':         ['Surreal', 'GoPro Action', 'Cinematic', 'Fisheye'],
    'Leading Lines':       ['Street Photography', 'Landscape', '35mm Wide'],
    'Negative Space':      ['Portrait', 'Centered', 'Symmetrical', 'Pastel Soft'],
    'Frame Within A Frame':['Symmetrical', 'Centered', 'Leading Lines'],

    /* palette group */
    'Warm Tones':          ['Golden Hour', 'Sunset Reds', 'Vintage', 'Candle Lit'],
    'Cool Blues':          ['Blue Hour', 'Moonlit', 'Neon Glow', 'Cinematic'],
    'Monochrome':          ['Black & White', 'High Contrast', 'Dramatic Shadows'],
    'Pastel Soft':         ['Natural Window Light', 'Polaroid', 'Negative Space', 'Editorial'],
    'High Contrast':       ['Black & White', 'Dramatic Shadows', 'Cinematic Low-Key', 'Editorial'],
    'Muted Earth':         ['Documentary', 'Vintage', 'Forest Greens', 'Overcast Diffused'],
    'Neon Saturated':      ['Neon Glow', 'Surreal', 'Teal & Orange'],
    'Sepia':               ['Vintage', 'Film Grain', 'Muted Earth'],
    'Teal & Orange':       ['Cinematic', 'Sunset Reds', 'High Contrast'],
    'Forest Greens':       ['Landscape', 'Muted Earth', 'Overcast Diffused'],
    'Sunset Reds':         ['Golden Hour', 'Warm Tones', 'Teal & Orange']
  };

  /* In-memory dismiss flag — cleared on any pick change so the
     row reappears the next time the user adjusts their selection. */
  var dismissed = false;
  /* Per-group avoid-mode flag. Lazily populated. */
  var avoidMode = Object.create(null);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* "You might also like" suggestion row. Sits in the same
         band as #pmg-photo-saved / #pmg-photo-recent so it inherits
         the suite's natural rhythm. */
      '#' + SUGGEST_ID + ' {',
      '  display: flex; flex-wrap: wrap; align-items: center;',
      '  gap: 8px; padding: 10px 12px; margin-bottom: var(--space-3, 12px);',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border));',
      '  border-radius: var(--radius-md, 8px);',
      '}',
      '#' + SUGGEST_ID + '[hidden] { display: none !important; }',
      '#' + SUGGEST_ID + ' .pmg-suggest-label {',
      '  font-size: 12px; font-weight: 700; letter-spacing: 0.04em;',
      '  text-transform: uppercase; color: var(--color-primary);',
      '  margin-right: 4px;',
      '}',
      '#' + SUGGEST_ID + ' .pmg-suggest-pill {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  padding: 4px 10px; font-size: 13px; font-weight: 600;',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));',
      '  border-radius: var(--radius-full, 999px); cursor: pointer;',
      '  transition: background 150ms ease, transform 150ms ease;',
      '}',
      '#' + SUGGEST_ID + ' .pmg-suggest-pill:hover,',
      '#' + SUGGEST_ID + ' .pmg-suggest-pill:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));',
      '  transform: translateY(-1px); outline: none;',
      '}',
      '#' + SUGGEST_ID + ' .pmg-suggest-pill .pmg-suggest-pill-group {',
      '  font-size: 10px; font-weight: 600; opacity: 0.65;',
      '  text-transform: uppercase; letter-spacing: 0.04em;',
      '}',
      '#' + SUGGEST_ID + ' .pmg-suggest-dismiss {',
      '  margin-left: auto; padding: 4px 8px; font-size: 11px;',
      '  font-weight: 600; background: transparent; color: var(--color-text-muted);',
      '  border: 1px solid transparent; border-radius: var(--radius-full, 999px);',
      '  cursor: pointer;',
      '}',
      '#' + SUGGEST_ID + ' .pmg-suggest-dismiss:hover,',
      '#' + SUGGEST_ID + ' .pmg-suggest-dismiss:focus-visible {',
      '  color: var(--color-text); background: var(--color-surface-2);',
      '  border-color: var(--color-border); outline: none;',
      '}',

      /* Avoid mode toggle: lives at the BOTTOM of each group's body,
         after the pill grid, so the top of the open dropdown stays
         clean. The toggle still lives outside the head <button>
         (the browser blocks click events on interactive content
         nested inside another button). */
      '#' + SUITE_ID + ' .pmg-avoid-toggle {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  margin: 10px 0 2px auto; padding: 4px 12px;',
      '  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;',
      '  text-transform: uppercase; color: var(--color-text-muted);',
      '  background: transparent;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: var(--radius-full, 999px); cursor: pointer;',
      '  transition: color 150ms ease, background 150ms ease, border-color 150ms ease;',
      '  align-self: flex-end;',
      '  min-height: 32px;',
      '}',
      /* The body is a flex column, so margin-left:auto on a flex item
         won\'t right-align unless the parent is row-flex. Use a tiny
         row wrapper around the toggle to right-align it cleanly. */
      '#' + SUITE_ID + ' .pmg-avoid-toggle-row {',
      '  display: flex; justify-content: flex-end; width: 100%;',
      '  margin-top: 8px;',
      '}',
      '#' + SUITE_ID + ' .pmg-avoid-toggle:hover,',
      '#' + SUITE_ID + ' .pmg-avoid-toggle:focus-visible {',
      '  color: #b91c1c; border-color: #fca5a5; outline: none;',
      '}',
      '[data-theme="dark"] #' + SUITE_ID + ' .pmg-avoid-toggle:hover,',
      '[data-theme="dark"] #' + SUITE_ID + ' .pmg-avoid-toggle:focus-visible {',
      '  color: #fca5a5; border-color: #fca5a5;',
      '}',
      '#' + SUITE_ID + ' .pmg-avoid-toggle.is-on {',
      '  color: #fff; background: #b91c1c; border-color: #b91c1c;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-group.is-avoiding .pmg-photo-group-body {',
      '  background: color-mix(in srgb, #b91c1c 5%, transparent);',
      '}',

      /* Distinct visual style for negative pills. */
      '#' + SUITE_ID + ' .pmg-photo-pill.is-negative {',
      '  background: color-mix(in srgb, #b91c1c 10%, var(--color-surface)) !important;',
      '  color: #b91c1c !important;',
      '  border: 1px solid color-mix(in srgb, #b91c1c 40%, var(--color-border)) !important;',
      '  text-decoration: line-through;',
      '  text-decoration-color: color-mix(in srgb, #b91c1c 60%, transparent);',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pill.is-negative::before {',
      '  content: "✕ "; font-weight: 700; text-decoration: none;',
      '  display: inline-block; margin-right: 2px;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pill.is-negative:hover {',
      '  background: color-mix(in srgb, #b91c1c 18%, var(--color-surface)) !important;',
      '}',
      /* Belt-and-suspenders: a pill should never be both at once,
         but if anything mistakenly tries, the negative styling wins
         visually because the active rule from pmg-ux.js applies an
         ::before checkmark which would conflict. */
      '#' + SUITE_ID + ' .pmg-photo-pill.is-active.is-negative::before {',
      '  content: "✕ ";',
      '}',

      /* "Avoid: a, b, c" chip line under the live summary. */
      '#' + NEG_ROW_ID + ' {',
      '  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;',
      '  margin-top: 8px; padding: 8px 12px;',
      '  background: color-mix(in srgb, #b91c1c 6%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, #b91c1c 25%, var(--color-border));',
      '  border-radius: var(--radius-md, 8px);',
      '  color: #b91c1c; font-size: 13px; font-weight: 600;',
      '}',
      '#' + NEG_ROW_ID + '[hidden] { display: none !important; }',
      '#' + NEG_ROW_ID + ' .pmg-neg-label {',
      '  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;',
      '  text-transform: uppercase;',
      '}',
      '#' + NEG_ROW_ID + ' .pmg-neg-clear {',
      '  margin-left: auto; padding: 2px 10px; font-size: 11px;',
      '  font-weight: 700; color: #b91c1c; background: transparent;',
      '  border: 1px solid color-mix(in srgb, #b91c1c 30%, transparent);',
      '  border-radius: var(--radius-full, 999px); cursor: pointer;',
      '}',
      '#' + NEG_ROW_ID + ' .pmg-neg-clear:hover,',
      '#' + NEG_ROW_ID + ' .pmg-neg-clear:focus-visible {',
      '  background: color-mix(in srgb, #b91c1c 12%, transparent); outline: none;',
      '}',
      '[data-theme="dark"] #' + SUITE_ID + ' .pmg-photo-pill.is-negative { color: #fca5a5 !important; }',
      '[data-theme="dark"] #' + NEG_ROW_ID + ' { color: #fca5a5; }',
      '[data-theme="dark"] #' + NEG_ROW_ID + ' .pmg-neg-clear { color: #fca5a5; border-color: color-mix(in srgb, #fca5a5 35%, transparent); }',
      '[data-theme="dark"] #' + NEG_ROW_ID + ' .pmg-neg-clear:hover, [data-theme="dark"] #' + NEG_ROW_ID + ' .pmg-neg-clear:focus-visible { background: color-mix(in srgb, #fca5a5 12%, transparent); }',

      /* Reduced-motion users get no transforms. */
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + SUGGEST_ID + ' .pmg-suggest-pill { transition: none; }',
      '  #' + SUGGEST_ID + ' .pmg-suggest-pill:hover { transform: none; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------
   * Selection helpers — read straight off the DOM so they always
   * reflect the live state, regardless of what other scripts may
   * be doing.
   * ------------------------------------------------------------ */
  function getActivePills() {
    var out = [];
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active');
    for (var i = 0; i < nodes.length; i++) {
      out.push({
        group: nodes[i].getAttribute('data-group'),
        value: nodes[i].getAttribute('data-value')
      });
    }
    return out;
  }

  function getNegativePills() {
    var out = [];
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-negative');
    for (var i = 0; i < nodes.length; i++) {
      out.push({
        group: nodes[i].getAttribute('data-group'),
        value: nodes[i].getAttribute('data-value')
      });
    }
    return out;
  }

  function findPill(value) {
    /* Suggestions are looked up by value alone (groups are
       implicit in the catalog). The Photography Suite never
       repeats the same value across groups, so a single
       attribute selector resolves uniquely. */
    var sel = '#' + SUITE_ID + ' .pmg-photo-pill[data-value="' +
      String(value).replace(/"/g, '\\"') + '"]';
    return document.querySelector(sel);
  }

  function groupLabelFor(groupId) {
    /* Cheap lookup — read the group head text node from the DOM.
       Falls back to the raw id when the head can't be found
       (e.g. during very early init). */
    var head = document.querySelector(
      '#' + SUITE_ID + ' .pmg-photo-group[data-group="' + groupId + '"] .pmg-photo-group-head'
    );
    if (!head) return groupId;
    var span = head.querySelector('span > span');
    if (span && span.textContent && span.textContent.trim()) {
      /* The first inner span is the icon. The label sits in the
         outer span text node, so grab the parent and strip the
         icon text. */
      var outer = head.querySelector('span');
      if (outer) {
        var raw = outer.textContent.replace(span.textContent, '').trim();
        if (raw) return raw;
      }
    }
    return groupId;
  }

  /* ------------------------------------------------------------
   * Suggestion ranking. Tally votes from each active pill, drop
   * already-active and already-negative pills, then take the top
   * MAX_SUGGESTIONS by vote count.
   * ------------------------------------------------------------ */
  function computeSuggestions() {
    var active = getActivePills();
    if (!active.length) return [];
    var negative = getNegativePills();

    var blocked = Object.create(null);
    active.forEach(function (p) { blocked[p.value] = true; });
    negative.forEach(function (p) { blocked[p.value] = true; });

    var votes = Object.create(null);
    active.forEach(function (p) {
      var list = SUGGESTION_MAP[p.value];
      if (!list) return;
      list.forEach(function (v, idx) {
        if (blocked[v]) return;
        /* Earlier entries in each pill's suggestion list count
           slightly more. Tiny weighting so order in SUGGESTION_MAP
           reads like a priority list. */
        var weight = 10 - Math.min(idx, 5);
        votes[v] = (votes[v] || 0) + weight;
      });
    });

    var ranked = Object.keys(votes).map(function (v) {
      return { value: v, score: votes[v] };
    });
    ranked.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.value.localeCompare(b.value);
    });

    /* Resolve to {value, group} pairs by looking up the pill in
       the DOM. Drop anything that doesn't resolve (e.g. a pill
       added to the catalog later than this script). */
    var out = [];
    for (var i = 0; i < ranked.length && out.length < MAX_SUGGESTIONS; i++) {
      var pill = findPill(ranked[i].value);
      if (!pill) continue;
      out.push({
        value: ranked[i].value,
        group: pill.getAttribute('data-group')
      });
    }
    return out;
  }

  /* ------------------------------------------------------------
   * Render the "You might also like" row. Hidden when there are
   * no suggestions or the user has dismissed it for the current
   * pick state.
   * ------------------------------------------------------------ */
  function renderSuggestions() {
    var row = document.getElementById(SUGGEST_ID);
    if (!row) return;
    var suggestions = computeSuggestions();
    if (!suggestions.length || dismissed) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    var parts = ['<span class="pmg-suggest-label">You Might Also Like</span>'];
    suggestions.forEach(function (s) {
      parts.push(
        '<button type="button" class="pmg-suggest-pill" ' +
          'data-suggest-value="' + escapeHtml(s.value) + '" ' +
          'data-suggest-group="' + escapeHtml(s.group) + '" ' +
          'aria-label="Add ' + escapeHtml(s.value) + ' from ' + escapeHtml(s.group) + '">' +
          escapeHtml(s.value) +
          ' <span class="pmg-suggest-pill-group">' + escapeHtml(s.group) + '</span>' +
        '</button>'
      );
    });
    parts.push(
      '<button type="button" class="pmg-suggest-dismiss" aria-label="Dismiss suggestions">Dismiss</button>'
    );
    row.innerHTML = parts.join('');
    row.hidden = false;
  }

  /* ------------------------------------------------------------
   * Render the "Avoid: a, b, c" chip line under the live summary.
   * ------------------------------------------------------------ */
  function renderNegativeChip() {
    var row = document.getElementById(NEG_ROW_ID);
    if (!row) return;
    var negs = getNegativePills();
    if (!negs.length) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    var values = negs.map(function (p) { return p.value; });
    row.innerHTML =
      '<span class="pmg-neg-label">Avoid:</span>' +
      '<span class="pmg-neg-list">' + escapeHtml(values.join(', ')) + '</span>' +
      '<button type="button" class="pmg-neg-clear" aria-label="Clear all avoids">Clear Avoids</button>';
    row.hidden = false;
  }

  function refreshAll() {
    renderSuggestions();
    renderNegativeChip();
  }

  /* ------------------------------------------------------------
   * Avoid mode helpers.
   * ------------------------------------------------------------ */
  function isAvoiding(groupId) {
    return !!avoidMode[groupId];
  }

  function setAvoiding(groupId, on) {
    avoidMode[groupId] = !!on;
    var grp = document.querySelector(
      '#' + SUITE_ID + ' .pmg-photo-group[data-group="' + groupId + '"]'
    );
    if (grp) grp.classList.toggle('is-avoiding', !!on);
    var btn = document.querySelector(
      '#' + SUITE_ID + ' .pmg-avoid-toggle[data-group="' + groupId + '"]'
    );
    if (btn) {
      btn.classList.toggle('is-on', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '✕ Avoid: On' : '✕ Avoid';
    }
    /* Re-run the suite's summary refresh so the Send button gating
       picks up the new avoid signal — an avoid-only setup is a real
       user choice and must enable Send. */
    try {
      if (typeof window.__pmgPhotoRefreshSummary === 'function') {
        window.__pmgPhotoRefreshSummary();
      }
    } catch (_) { /* no-op */ }
  }

  function clearAllNegatives() {
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-negative');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-negative');
    dismissed = false;
    refreshAll();
  }

  /* ------------------------------------------------------------
   * Mount: inject the suggestions row + negatives chip into the
   * existing suite, plus an Avoid toggle in every group head.
   * Idempotent — re-runs are safe.
   * ------------------------------------------------------------ */
  function mount() {
    var suite = document.getElementById(SUITE_ID);
    if (!suite) return false;
    injectStyles();

    /* Suggestion row sits between the existing recent row and the
       first group. The recent row uses #pmg-photo-recent; if it's
       not in the DOM (very old builds) we anchor on the first
       group instead. */
    if (!document.getElementById(SUGGEST_ID)) {
      var row = document.createElement('div');
      row.id = SUGGEST_ID;
      row.hidden = true;
      var anchor = suite.querySelector('#pmg-photo-recent') ||
                   suite.querySelector('#pmg-photo-saved') ||
                   suite.querySelector('.pmg-photo-group');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
      } else {
        suite.appendChild(row);
      }
    }

    /* Negatives chip sits directly after the live summary so the
       user sees their full positive-and-negative read-out side by
       side. */
    if (!document.getElementById(NEG_ROW_ID)) {
      var neg = document.createElement('div');
      neg.id = NEG_ROW_ID;
      neg.hidden = true;
      var summary = document.getElementById(SUMMARY_ID);
      if (summary && summary.parentNode) {
        summary.parentNode.insertBefore(neg, summary.nextSibling);
      } else {
        suite.appendChild(neg);
      }
    }

    /* Add an Avoid toggle to every group. The group head is a real
       <button> (collapse trigger) and the browser refuses to fire
       clicks on interactive content nested inside another button.
       Place the toggle at the BOTTOM of the group body so the top
       of the open dropdown stays clean. Wrapped in a flex row so it
       right-aligns regardless of the body\'s flex direction. */
    var groups = suite.querySelectorAll('.pmg-photo-group');
    for (var i = 0; i < groups.length; i++) {
      var grp = groups[i];
      var groupId = grp.getAttribute('data-group');
      if (!groupId) continue;
      if (groupId === 'aspect') continue;
      var body = grp.querySelector(':scope > .pmg-photo-group-body');
      if (!body) continue;
      /* Idempotent: if a row already exists, leave it alone. Also
         migrate any legacy top-level toggle (sibling of the head)
         into the new bottom row. */
      var legacy = grp.querySelector(':scope > .pmg-avoid-toggle');
      if (legacy && legacy.parentNode === grp) {
        try { legacy.parentNode.removeChild(legacy); } catch (_) {}
      }
      if (body.querySelector(':scope > .pmg-avoid-toggle-row')) continue;
      var row = document.createElement('div');
      row.className = 'pmg-avoid-toggle-row';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'pmg-avoid-toggle';
      toggle.setAttribute('data-group', groupId);
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Toggle Avoid mode for this group');
      toggle.textContent = '✕ Avoid';
      row.appendChild(toggle);
      body.appendChild(row);
    }

    wireOnce(suite);
    refreshAll();
    return true;
  }

  /* ------------------------------------------------------------
   * Event wiring (idempotent via a sentinel on the suite).
   * ------------------------------------------------------------ */
  function wireOnce(suite) {
    if (suite.__pmgSuggestionsWired) return;
    suite.__pmgSuggestionsWired = true;

    /* Avoid toggle: it lives as a sibling of the head <button>, not
       inside it, so a normal bubble-phase click handler is enough.
       We still stopPropagation so any future delegated clickers on
       the group container don't double-fire. */
    suite.addEventListener('click', function (e) {
      var t = e.target.closest('.pmg-avoid-toggle');
      if (!t) return;
      e.stopPropagation();
      e.preventDefault();
      var groupId = t.getAttribute('data-group');
      setAvoiding(groupId, !isAvoiding(groupId));
    }, false);

    /* Pill intercept (capture phase, runs BEFORE the original
       toggle handler in pmg-ux.js). Three scenarios:
         - Avoid mode is ON for this pill's group → swallow the
           original click, toggle .is-negative instead.
         - Avoid mode is OFF and this pill is currently a negative
           → swallow the click, just clear the negative state.
           Without this, the original handler would also flip
           .is-active, leaving the pill in a weird "both" state.
         - Otherwise → let the original handler run. We piggy-back
           via a bubble-phase listener (below) to refresh
           suggestions afterward. */
    suite.addEventListener('click', function (e) {
      var pill = e.target.closest('.pmg-photo-pill');
      if (!pill) return;
      var groupId = pill.getAttribute('data-group');
      if (isAvoiding(groupId)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        /* If the pill was previously a positive pick, take it off
           first so we don't end up with both states. */
        pill.classList.remove('is-active');
        pill.classList.toggle('is-negative');
        dismissed = false;
        try {
          if (typeof window.__pmgPhotoRefreshSummary === 'function') {
            window.__pmgPhotoRefreshSummary();
          }
        } catch (_) {}
        refreshAll();
        return;
      }
      if (pill.classList.contains('is-negative')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        pill.classList.remove('is-negative');
        dismissed = false;
        refreshAll();
        return;
      }
    }, true);

    /* Bubble-phase: after pmg-ux.js's toggle handler runs, refresh
       the suggestion list. */
    suite.addEventListener('click', function (e) {
      var pill = e.target.closest('.pmg-photo-pill');
      if (!pill) return;
      dismissed = false;
      refreshAll();
    }, false);

    /* Suggestion row clicks. Activates the underlying pill (which
       triggers pmg-ux's own click handler so summary + count
       badges update for free). */
    suite.addEventListener('click', function (e) {
      var dismiss = e.target.closest('#' + SUGGEST_ID + ' .pmg-suggest-dismiss');
      if (dismiss) {
        e.preventDefault();
        dismissed = true;
        renderSuggestions();
        return;
      }
      var sug = e.target.closest('#' + SUGGEST_ID + ' .pmg-suggest-pill');
      if (sug) {
        e.preventDefault();
        var v = sug.getAttribute('data-suggest-value');
        var pill = findPill(v);
        if (pill) {
          /* Synthesize a click on the real pill so the existing
             pmg-ux handler (toggle + refreshSummary) runs. The
             bubble-phase listener above will refresh suggestions. */
          pill.click();
        }
      }
    }, false);

    /* Negative chip "Clear Avoids" button. */
    suite.addEventListener('click', function (e) {
      var clr = e.target.closest('#' + NEG_ROW_ID + ' .pmg-neg-clear');
      if (!clr) return;
      e.preventDefault();
      clearAllNegatives();
    }, false);

    /* Watch for class changes on pills so external mutations
       (Surprise Me, presets, recent combos, handoff seeding) also
       refresh the suggestions row. Scoped to .pmg-photo-pill
       elements only to keep churn cheap.

       This same observer also enforces the "a pill cannot be
       active AND negative at the same time" invariant. The pill
       click interceptor handles the direct-click case, but
       programmatic .is-active adds from preset/surprise/combo/
       handoff paths in pmg-ux.js bypass that interceptor. When
       the observer sees a pill that has BOTH classes, the newest
       state wins: if .is-active was just added, it implies the
       user wants a positive pick, so .is-negative is removed (and
       vice versa is impossible because our own avoid handler
       always removes .is-active before adding .is-negative).
       Guarded by a sentinel to avoid recursion (the fix below
       triggers another mutation record). */
    var fixingDualState = false;
    try {
      var mo = new MutationObserver(function (records) {
        var poked = false;
        var dualStateNodes = [];
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (!r.target || !r.target.classList) continue;
          if (!r.target.classList.contains('pmg-photo-pill')) continue;
          poked = true;
          if (
            r.target.classList.contains('is-active') &&
            r.target.classList.contains('is-negative')
          ) {
            dualStateNodes.push(r.target);
          }
        }
        if (dualStateNodes.length && !fixingDualState) {
          fixingDualState = true;
          try {
            for (var j = 0; j < dualStateNodes.length; j++) {
              dualStateNodes[j].classList.remove('is-negative');
            }
          } finally {
            fixingDualState = false;
          }
        }
        if (poked) refreshAll();
      });
      mo.observe(suite, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
      });
    } catch (_) {}

    /* "Clear Picks" should ALSO wipe negatives — otherwise they
       silently leak through into the next prompt. The original
       button is in pmg-ux.js; we hook in via bubble phase. */
    var clearBtn = suite.querySelector('.pmg-photo-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var nodes = document.querySelectorAll(
          '#' + SUITE_ID + ' .pmg-photo-pill.is-negative'
        );
        for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-negative');
        dismissed = false;
        refreshAll();
      }, false);
    }
  }

  /* ------------------------------------------------------------
   * Generated-prompt assembly: append "Avoid: ..." to goal.value
   * before image generation fires. The image entry points are
   * BOTH `window.generateImage` and `window.runImageGeneration`
   * (aliased at index.html:9731 — `window.generateImage =
   * window.runImageGeneration`). The inline `onclick="runImage
   * Generation()"` on the primary `#image-generate-btn` calls the
   * runImageGeneration alias DIRECTLY, so wrapping only the
   * generateImage alias would let users skip the suffix on the
   * main path. We wrap a single shared helper and assign both
   * globals to it.
   * ------------------------------------------------------------ */
  function wrapGenerateImage() {
    if (window.__pmgSuggestionsWrappedGen) return;
    var origGen = typeof window.generateImage === 'function'
      ? window.generateImage : null;
    var origRun = typeof window.runImageGeneration === 'function'
      ? window.runImageGeneration : null;
    if (!origGen && !origRun) return;
    window.__pmgSuggestionsWrappedGen = true;
    /* Pick a single underlying function. If both exist and they're
       the same reference (the common case after the alias on line
       9731), great; if for some reason they diverge later, prefer
       runImageGeneration — that's the one the inline onclick on
       the primary button targets. */
    var orig = origRun || origGen;
    /* Matches a trailing ". Avoid: x, y." clause we may have
       appended on a previous run. Anchored to end-of-string so we
       never accidentally strip user-typed text earlier in the
       prompt. */
    var AVOID_RE = /\s*\.\s*Avoid:\s*[^.]*\.?\s*$/i;
    var wrapper = function () {
      try {
        var goal = document.getElementById('goal');
        if (goal && typeof goal.value === 'string') {
          /* ALWAYS strip any prior Avoid clause first so each
             generation reflects the CURRENT negatives — without
             this, changing or clearing avoid pills between two
             runs would silently leak the old list into the new
             prompt. */
          var base = goal.value.replace(AVOID_RE, '').replace(/\s+$/, '');
          var negs = getNegativePills();
          if (base && negs.length) {
            var values = negs.map(function (p) { return p.value; });
            var trimmed = base.replace(/[.\s]+$/, '');
            goal.value = trimmed + '. Avoid: ' + values.join(', ') + '.';
          } else if (base !== goal.value) {
            /* No current negatives but stale clause was present —
               restore the bare prompt. */
            goal.value = base;
          }
        }
      } catch (_) {}
      return orig.apply(this, arguments);
    };
    window.generateImage = wrapper;
    window.runImageGeneration = wrapper;
  }

  /* ------------------------------------------------------------
   * Boot: try mount immediately; if the suite isn't in the DOM
   * yet (pmg-ux.js builds it on DOMContentLoaded too), retry on
   * a short interval. Capped retries so we never spin forever.
   * ------------------------------------------------------------ */
  function boot() {
    if (mount()) {
      wrapGenerateImage();
      return;
    }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (mount() || tries > 40) {
        clearInterval(iv);
        wrapGenerateImage();
      }
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Expose a tiny API for tests + debugging. */
  var AVOID_RE_API = /\s*\.\s*Avoid:\s*[^.]*\.?\s*$/i;
  function applyAvoidClause() {
    var goal = document.getElementById('goal');
    if (!goal || typeof goal.value !== 'string') return;
    var base = goal.value.replace(AVOID_RE_API, '').replace(/\s+$/, '');
    var negs = getNegativePills();
    if (base && negs.length) {
      var values = negs.map(function (p) { return p.value; });
      var trimmed = base.replace(/[.\s]+$/, '');
      goal.value = trimmed + '. Avoid: ' + values.join(', ') + '.';
    } else if (base !== goal.value) {
      goal.value = base;
    }
  }

  window.__pmgSuggestions = {
    version: SCRIPT_VERSION,
    compute: computeSuggestions,
    getNegatives: getNegativePills,
    setAvoiding: setAvoiding,
    isAvoiding: isAvoiding,
    clearNegatives: clearAllNegatives,
    refresh: refreshAll,
    applyAvoidClause: applyAvoidClause
  };
})();
