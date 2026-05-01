/* =============================================================
 * pmg-handoff.js  (Task #57)
 *
 * Surprise Me dial + cross-mode handoff (text <-> image).
 *
 * Three additive features layered onto the existing builders:
 *
 *   1. Surprise Me DIAL — a 3-step segmented control
 *      ("Close to my style" / "Mix it up" / "Go wild") that
 *      controls how adventurous the next Surprise Me roll is.
 *      Persists to localStorage so the user keeps their default.
 *      Intercepts the existing .pmg-photo-surprise (Photography
 *      Suite) and #random-prompt (Text mode dice) buttons on
 *      capture phase and runs a dial-aware roll in their place.
 *
 *   2. AUTO-SAVE — every Surprise Me result is automatically
 *      persisted to Recent Combos (Photography Suite) so happy
 *      accidents are never lost. The pre-existing manual "Pin
 *      This Surprise" button becomes redundant and is hidden.
 *
 *   3. CROSS-MODE HANDOFF —
 *      Text -> Image: after a text prompt is generated, a
 *        "Try This In Image Mode" pill appears in the result
 *        panel. Click it to switch to Image mode and pre-seed
 *        compatible Style / Lighting / Composition / Color
 *        pills from the text prompt's tone + category +
 *        personality.
 *      Image -> Text: after an image is generated, a "Write A
 *        Prompt About This" pill appears next to Download. Click
 *        to switch to Text mode and pre-seed goal + tone +
 *        category from the active photo pills.
 *
 * Strict additive: no backend / API / DB / payment / secret
 * changes; no ID, class, or JS variable renames; no rewrites of
 * any existing handler. The original Surprise Me / dice handlers
 * are short-circuited via stopImmediatePropagation in capture
 * phase (so they remain in code, just don't fire).
 *
 * Disable hatches:
 *   ?nohandoff   query param
 *   localStorage.pmg_handoff_disable = '1'
 *   localStorage.pmg_disable          = '1'   (global PMG disable)
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgHandoffLoaded) return;
  window.__pmgHandoffLoaded = true;

  /* -------- Disable hatches -------- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nohandoff\b/.test(qs)) return;
    if (localStorage.getItem('pmg_handoff_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var SCRIPT_VERSION = 'task57-1';

  /* ----- Constants shared with pmg-ux.js (intentionally
     duplicated — never mutated, only read/written so the same
     localStorage entries the Photography Suite uses are picked
     up by both modules). ----- */
  var SUITE_ID         = 'pmg-photo-suite';
  var RECENT_KEY       = 'pmg.photo.recentPresets';
  var RECENT_MAX       = 5;
  var DIAL_KEY         = 'pmg.surprise.dial.v1';
  var DIAL_DEFAULT     = 'mix';
  var DIAL_VALUES      = ['close', 'mix', 'wild'];
  var DIAL_LABEL       = { close: 'Close To My Style', mix: 'Mix It Up', wild: 'Go Wild' };
  var DIAL_SHORT_LABEL = { close: 'Close',             mix: 'Mix It Up', wild: 'Wild' };
  var SURPRISE_LABEL_VALUES = 4;

  /* Pill catalog mirrored from pmg-ux.js. The handoff needs to
     know which values are valid per group so it can apply pills
     by querying .pmg-photo-pill[data-group][data-value]. */
  var GROUPS = [
    { id: 'style', pills: [
      'Cinematic', 'Portrait', 'Documentary', 'Editorial',
      'Street Photography', 'Fashion', 'Landscape', 'Surreal',
      'Vintage', 'Hyperrealistic', 'Black & White', 'Polaroid'
    ]},
    { id: 'camera', pills: [
      '85mm Portrait', '35mm Wide', '50mm Standard', 'Macro',
      'Telephoto', 'Fisheye', 'DSLR', 'Mirrorless',
      'Film Grain', 'Drone Aerial', 'GoPro Action', 'iPhone Snap'
    ]},
    { id: 'lighting', pills: [
      'Golden Hour', 'Blue Hour', 'Studio Softbox', 'Backlit',
      'Natural Window Light', 'Dramatic Shadows', 'Neon Glow',
      'Candle Lit', 'Overcast Diffused', 'Moonlit',
      'Harsh Noon', 'Cinematic Low-Key'
    ]},
    { id: 'composition', pills: [
      'Rule Of Thirds', 'Centered', 'Symmetrical',
      'Close-Up', 'Wide Shot', "Bird's-Eye View",
      "Worm's-Eye View", 'Dutch Angle', 'Leading Lines',
      'Negative Space', 'Frame Within A Frame'
    ]},
    { id: 'palette', pills: [
      'Warm Tones', 'Cool Blues', 'Monochrome', 'Pastel Soft',
      'High Contrast', 'Muted Earth', 'Neon Saturated',
      'Sepia', 'Teal & Orange', 'Forest Greens', 'Sunset Reds'
    ]}
  ];

  /* Tone / Category / Personality -> pill mapping table (text -> image).
     Each entry contributes a *bias* (extra pills added to the active
     set per group). The handoff merges contributions from all
     matching keys, then truncates to a sensible default per group
     so the suite does not get overloaded. */
  var TONE_BIAS = {
    'professional': {
      style: ['Editorial'], lighting: ['Studio Softbox'],
      composition: ['Centered'], palette: ['Cool Blues']
    },
    'bold-direct': {
      style: ['Cinematic'], lighting: ['Dramatic Shadows', 'Cinematic Low-Key'],
      composition: ['Dutch Angle'], palette: ['High Contrast']
    },
    'casual': {
      style: ['Documentary'], lighting: ['Natural Window Light'],
      composition: ['Rule Of Thirds'], palette: ['Warm Tones']
    },
    'expert': {
      style: ['Editorial'], lighting: ['Studio Softbox'],
      composition: ['Symmetrical'], palette: ['Monochrome']
    }
  };
  var CATEGORY_BIAS = {
    'business':     { style: ['Editorial'], camera: ['DSLR'], palette: ['Cool Blues'] },
    'money':        { style: ['Editorial'], camera: ['DSLR'], palette: ['Cool Blues'] },
    'content':      { style: ['Documentary'], camera: ['35mm Wide'], lighting: ['Natural Window Light'] },
    'career':       { style: ['Portrait'], camera: ['85mm Portrait'], lighting: ['Studio Softbox'] },
    'personal':     { style: ['Documentary'], camera: ['iPhone Snap'], palette: ['Warm Tones'] },
    'productivity': { style: ['Editorial'], composition: ['Centered'] },
    'learning':     { style: ['Documentary'], composition: ['Rule Of Thirds'] },
    'faith':        { style: ['Cinematic'], lighting: ['Candle Lit'], palette: ['Warm Tones'] },
    'other':        { style: ['Cinematic'] }
  };
  var PERSONALITY_BIAS = {
    'direct':       { style: ['Editorial'], palette: ['Monochrome'] },
    'friendly':     { style: ['Documentary'], palette: ['Warm Tones'] },
    'bold':         { style: ['Cinematic'], lighting: ['Dramatic Shadows'], palette: ['High Contrast'] },
    'professional': { style: ['Editorial'], lighting: ['Studio Softbox'], palette: ['Cool Blues'] },
    'creative':     { style: ['Surreal'], palette: ['Neon Saturated'] },
    'faith':        { style: ['Cinematic'], lighting: ['Candle Lit'] },
    'street':       { style: ['Street Photography'], camera: ['35mm Wide'], lighting: ['Harsh Noon'] },
    'luxury':       { style: ['Editorial', 'Fashion'], lighting: ['Studio Softbox'], composition: ['Centered'], palette: ['Monochrome'] },
    'viral':        { style: ['Fashion'], lighting: ['Neon Glow'], palette: ['Neon Saturated', 'High Contrast'] }
  };

  /* Reverse mapping: photo pill -> suggested text (tone, category,
     personality, and a short noun phrase) used by the image -> text
     handoff. Keys are lowercase pill values for case-insensitive
     lookup. We only map the most evocative pills; everything else
     falls through to safe defaults (casual / personal / friendly). */
  var PILL_TO_TEXT = {
    /* style */
    'cinematic':         { tone: 'bold-direct',  category: 'content',  personality: 'bold',         topic: 'a cinematic visual' },
    'editorial':         { tone: 'professional', category: 'business', personality: 'professional', topic: 'an editorial photograph' },
    'documentary':       { tone: 'casual',       category: 'content',  personality: 'friendly',     topic: 'a documentary scene' },
    'portrait':          { tone: 'professional', category: 'career',   personality: 'professional', topic: 'a portrait' },
    'street photography':{ tone: 'casual',       category: 'content',  personality: 'street',       topic: 'a candid street scene' },
    'fashion':           { tone: 'expert',       category: 'content',  personality: 'luxury',       topic: 'a fashion editorial' },
    'landscape':         { tone: 'casual',       category: 'personal', personality: 'creative',     topic: 'a landscape' },
    'surreal':           { tone: 'expert',       category: 'content',  personality: 'creative',     topic: 'a surreal composition' },
    'vintage':           { tone: 'casual',       category: 'personal', personality: 'friendly',     topic: 'a vintage scene' },
    'hyperrealistic':    { tone: 'expert',       category: 'content',  personality: 'professional', topic: 'a hyperrealistic image' },
    'black & white':     { tone: 'expert',       category: 'content',  personality: 'professional', topic: 'a black-and-white photograph' },
    'polaroid':          { tone: 'casual',       category: 'personal', personality: 'friendly',     topic: 'a polaroid moment' },
    /* lighting */
    'golden hour':       { tone: 'casual',       category: 'personal', personality: 'creative',     topic: 'a golden-hour scene' },
    'cinematic low-key': { tone: 'bold-direct',  category: 'content',  personality: 'bold',         topic: 'a low-key cinematic scene' },
    'neon glow':         { tone: 'bold-direct',  category: 'content',  personality: 'viral',        topic: 'a neon-lit scene' },
    'studio softbox':    { tone: 'professional', category: 'business', personality: 'professional', topic: 'a studio portrait' }
  };

  function $id(id) { return document.getElementById(id); }
  function showToast(msg) {
    if (typeof window.showToast === 'function') { try { window.showToast(msg); return; } catch (_) {} }
    /* Quiet console fallback so the script never throws. */
    try { console.info('[pmg-handoff]', msg); } catch (_) {}
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["'\\]/g, '\\$&');
  }
  function isImageMode() {
    var b = document.body;
    if (!b) return false;
    return b.classList.contains('image-mode') || b.classList.contains('photo-mode-active');
  }

  /* -------- Dial state -------- */
  function readDial() {
    try {
      var v = localStorage.getItem(DIAL_KEY);
      if (v && DIAL_VALUES.indexOf(v) !== -1) return v;
    } catch (_) {}
    return DIAL_DEFAULT;
  }
  function writeDial(v) {
    if (DIAL_VALUES.indexOf(v) === -1) return;
    try { localStorage.setItem(DIAL_KEY, v); } catch (_) {}
    syncDialUI();
  }

  /* -------- Style injection -------- */
  function injectStyles() {
    if ($id('pmg-handoff-style')) return;
    var css = [
      /* Dial — segmented control. Lives inline next to Surprise
         Me. Compact on mobile, slightly roomier on desktop.    */
      '.pmg-handoff-dial {',
      '  display: inline-flex; align-items: center; gap: 8px;',
      '  flex-wrap: wrap; margin-right: auto;',
      '  font-size: var(--text-xs, 12px);',
      '  color: var(--color-text-muted, #5f6b75);',
      '}',
      '.pmg-handoff-dial-label {',
      '  font-weight: 700; letter-spacing: 0.04em;',
      '  text-transform: uppercase; font-size: 11px;',
      '}',
      '.pmg-handoff-dial-segments {',
      '  display: inline-flex; align-items: stretch;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid var(--color-border, #e3e3e7);',
      '  border-radius: 999px; padding: 2px;',
      '  gap: 2px;',
      '}',
      '.pmg-handoff-dial-seg {',
      '  appearance: none; background: transparent; border: 0;',
      '  padding: 6px 12px; min-height: 32px;',
      '  border-radius: 999px;',
      '  font-size: 12px; font-weight: 600;',
      '  color: var(--color-text-muted, #5f6b75); cursor: pointer;',
      '  transition: background 140ms ease, color 140ms ease;',
      '}',
      '.pmg-handoff-dial-seg:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 10%, transparent);',
      '  color: var(--color-text, #1d2a32);',
      '}',
      '.pmg-handoff-dial-seg[aria-pressed="true"] {',
      '  background: var(--color-primary);',
      '  color: var(--color-text-inverse, #fff);',
      '}',
      '.pmg-handoff-dial-seg:focus-visible {',
      '  outline: 2px solid var(--color-primary);',
      '  outline-offset: 2px;',
      '}',

      /* Hide the now-redundant Pin This Surprise button. The
         dial auto-saves every roll, so the manual pin step is
         no longer needed. We keep the DOM node so the original
         pinCurrentSurprise wiring keeps working harmlessly. */
      '#' + SUITE_ID + ' .pmg-photo-pin-surprise { display: none !important; }',

      /* Cross-mode handoff CTA — chip that sits inline in the
         result panel actions row / image actions row. Uses the
         same pill rhythm as other secondary buttons. */
      '.pmg-handoff-cta {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  min-height: 40px; padding: 8px 16px;',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface, #fff));',
      '  color: var(--color-primary);',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 35%, var(--color-border, #e3e3e7));',
      '  border-radius: 999px;',
      '  font-size: var(--text-sm, 14px); font-weight: 700;',
      '  cursor: pointer;',
      '  transition: background 160ms ease, transform 120ms ease;',
      '}',
      '.pmg-handoff-cta:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface, #fff));',
      '  transform: translateY(-1px);',
      '}',
      '.pmg-handoff-cta[hidden] { display: none !important; }',
      '.pmg-handoff-cta-emoji { font-size: 14px; }',

      /* Mobile tightening: dial wraps to its own row above the
         buttons in the surprise-top row. */
      '@media (max-width: 480px) {',
      '  .pmg-handoff-dial { width: 100%; justify-content: flex-start; }',
      '  .pmg-handoff-dial-segments { flex: 1 1 auto; }',
      '  .pmg-handoff-dial-seg { flex: 1 1 0; padding: 6px 4px; }',
      '}',

      /* Reduced motion: kill our hover transform. */
      '@media (prefers-reduced-motion: reduce) {',
      '  .pmg-handoff-dial-seg, .pmg-handoff-cta { transition: none; }',
      '  .pmg-handoff-cta:hover { transform: none; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'pmg-handoff-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* -------- Build dial UI -------- */
  function buildDialNode() {
    var wrap = document.createElement('div');
    wrap.className = 'pmg-handoff-dial';
    wrap.id = 'pmg-handoff-dial';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Surprise Me dial');

    var label = document.createElement('span');
    label.className = 'pmg-handoff-dial-label';
    label.textContent = 'Surprise Dial';
    wrap.appendChild(label);

    var seg = document.createElement('div');
    seg.className = 'pmg-handoff-dial-segments';
    DIAL_VALUES.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-handoff-dial-seg';
      btn.setAttribute('data-dial', v);
      btn.setAttribute('aria-pressed', 'false');
      btn.title = DIAL_LABEL[v];
      btn.textContent = DIAL_SHORT_LABEL[v];
      btn.addEventListener('click', function () {
        writeDial(v);
        showToast('Dial: ' + DIAL_LABEL[v]);
      });
      seg.appendChild(btn);
    });
    wrap.appendChild(seg);
    return wrap;
  }

  function syncDialUI() {
    var v = readDial();
    var nodes = document.querySelectorAll('.pmg-handoff-dial-seg');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', String(nodes[i].getAttribute('data-dial') === v));
    }
  }

  /* -------- Mount the dial inside the surprise-top host
     row (the prominent "Need Ideas?" row from T34). Falls back
     to inserting before .pmg-photo-actions if the top row is not
     found. Idempotent. -------- */
  function mountDial() {
    if ($id('pmg-handoff-dial')) { syncDialUI(); return true; }
    var top = $id('pmg-t34-surprise-top-row');
    if (top) {
      var dial = buildDialNode();
      var surpriseBtn = top.querySelector('.pmg-photo-surprise');
      if (surpriseBtn) {
        top.insertBefore(dial, surpriseBtn);
      } else {
        top.appendChild(dial);
      }
      syncDialUI();
      return true;
    }
    var actions = document.querySelector('#' + SUITE_ID + ' .pmg-photo-actions');
    if (actions && actions.parentNode) {
      var dial2 = buildDialNode();
      actions.parentNode.insertBefore(dial2, actions);
      syncDialUI();
      return true;
    }
    return false;
  }

  /* -------- Photo Surprise: dial-aware roll
     Reads current pills, then assembles a new set per the dial.
     - close: KEEP all current pills, replace pills in 1 random
              group and add a tiny accent pill in 1 other group
     - mix:   1-2 pills per group across all groups (default)
     - wild:  2-3 pills per group across all groups, more pills,
              skip nothing
     -------- */
  function readActivePills() {
    var picks = {};
    GROUPS.forEach(function (g) {
      picks[g.id] = [];
      var sel = '#' + SUITE_ID + ' .pmg-photo-pill.is-active[data-group="' + g.id + '"]';
      var nodes = document.querySelectorAll(sel);
      for (var i = 0; i < nodes.length; i++) {
        var v = nodes[i].getAttribute('data-value');
        if (v) picks[g.id].push(v);
      }
    });
    return picks;
  }

  function clearAllPhotoPicks() {
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-active');
  }
  function clearGroupPicks(gid) {
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active[data-group="' + gid + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-active');
  }
  function activatePill(gid, value) {
    var sel = '#' + SUITE_ID + ' .pmg-photo-pill[data-group="' + gid + '"][data-value="' + cssEscape(value) + '"]';
    var el = document.querySelector(sel);
    if (el) el.classList.add('is-active');
    return !!el;
  }
  function pickN(arr, n) {
    var pool = arr.slice();
    var out = [];
    for (var i = 0; i < n && pool.length > 0; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  function rollPicks(dial) {
    var picks;
    if (dial === 'close') {
      /* Keep current pills as-is, then refresh ONE random group
         (replace its pills with a new random pick). If no pills
         are currently active we fall back to mix behavior so the
         user still gets a meaningful roll. */
      picks = readActivePills();
      var hasAny = false;
      for (var k in picks) if (picks[k] && picks[k].length) { hasAny = true; break; }
      if (!hasAny) return rollPicks('mix');
      var idx = Math.floor(Math.random() * GROUPS.length);
      var g = GROUPS[idx];
      var n = Math.random() < 0.5 ? 1 : 2;
      picks[g.id] = pickN(g.pills, n);
      /* Add one accent pill in another group if missing/empty. */
      var other = GROUPS[(idx + 1 + Math.floor(Math.random() * (GROUPS.length - 1))) % GROUPS.length];
      if (!picks[other.id] || !picks[other.id].length) {
        picks[other.id] = pickN(other.pills, 1);
      }
      return picks;
    }
    if (dial === 'wild') {
      /* Fill every group with 2-3 pills. Maximum chaos. */
      picks = {};
      GROUPS.forEach(function (g) {
        var n = 2 + (Math.random() < 0.5 ? 0 : 1);
        picks[g.id] = pickN(g.pills, n);
      });
      return picks;
    }
    /* mix (default) — 1-2 pills per group across all groups */
    picks = {};
    GROUPS.forEach(function (g) {
      var n = Math.random() < 0.4 ? 2 : 1;
      picks[g.id] = pickN(g.pills, n);
    });
    return picks;
  }

  function applyPicksToDom(picks, dial) {
    if (dial === 'close') {
      /* Selectively rewrite — clear ONLY the groups present in picks
         that we want to refresh, then re-activate. We don't blow
         away groups that aren't in picks (close is additive). */
      Object.keys(picks).forEach(function (gid) {
        clearGroupPicks(gid);
        (picks[gid] || []).forEach(function (v) { activatePill(gid, v); });
      });
    } else {
      /* mix / wild — full reset, same as the original surpriseMe. */
      clearAllPhotoPicks();
      Object.keys(picks).forEach(function (gid) {
        (picks[gid] || []).forEach(function (v) { activatePill(gid, v); });
      });
    }
  }

  /* -------- Recent Combos: read + write the SAME storage
     pmg-ux.js uses (RECENT_KEY). We mirror the {kind:'raw',
     label, picks} shape and dedupe via a stable fingerprint
     so duplicate rolls don't bloat the row. We also re-render
     the row HTML directly (template mirrored from pmg-ux.js
     renderRecentRow) so the new entry appears immediately. -------- */
  function fingerprint(picks) {
    return GROUPS.map(function (g) {
      return g.id + ':' + ((picks[g.id] || []).slice().sort().join('|'));
    }).join('//');
  }
  function loadRecent() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function saveRecent(arr) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX))); } catch (_) {}
  }
  function buildSurpriseLabel(picks) {
    var values = [];
    GROUPS.forEach(function (g) {
      (picks[g.id] || []).forEach(function (v) { values.push(v); });
    });
    if (!values.length) return null;
    var shown = values.slice(0, SURPRISE_LABEL_VALUES);
    var suffix = values.length > SURPRISE_LABEL_VALUES ? ', \u2026' : '';
    return 'Surprise: ' + shown.join(', ') + suffix;
  }
  function persistSurpriseToRecent(picks) {
    var label = buildSurpriseLabel(picks);
    if (!label) return false;
    var clean = {};
    Object.keys(picks).forEach(function (gid) {
      if (picks[gid] && picks[gid].length) clean[gid] = picks[gid].slice();
    });
    var entry = { kind: 'raw', label: label, picks: clean };
    var key = fingerprint(picks);
    var existing = loadRecent();
    var filtered = existing.filter(function (c) {
      try { return fingerprint(c && c.picks ? c.picks : {}) !== key; }
      catch (_) { return true; }
    });
    filtered.unshift(entry);
    saveRecent(filtered);
    rerenderRecentRow();
    return true;
  }

  /* Re-render the Recent row using the same template + selectors
     pmg-ux.js uses. We only touch innerHTML; the row's delegated
     click listener (registered by pmg-ux.js wireSuite) keeps
     firing on the new buttons since delegation matches by class
     not by node identity. */
  function rerenderRecentRow() {
    var row = $id('pmg-photo-recent');
    if (!row) return;
    var combos = loadRecent();
    if (!combos.length) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    var html = ['<span class="pmg-photo-recent-label">Recent:</span>'];
    combos.forEach(function (combo, i) {
      var label = (combo && combo.kind === 'raw' && typeof combo.label === 'string')
        ? combo.label
        : '';
      if (!label) return;
      html.push(
        '<button type="button" class="pmg-photo-recent-btn" ' +
          'data-recent-index="' + i + '" ' +
          'aria-label="Re-apply ' + escHtml(label) + '">' +
          escHtml(label) +
        '</button>'
      );
    });
    html.push(
      '<button type="button" class="pmg-photo-recent-clear" ' +
        'aria-label="Clear recent presets">Clear</button>'
    );
    row.innerHTML = html.join('');
    row.hidden = false;
  }

  /* -------- Photo Surprise click intercept --------
     Capture-phase listener attached to the Photography Suite root.
     Fires before the existing pmg-ux.js bubble listener and calls
     stopImmediatePropagation so the original surpriseMe doesn't
     run — we replace it with our own dial-aware roll. */
  function attachPhotoSurpriseIntercept() {
    var suite = $id(SUITE_ID);
    if (!suite || suite.__pmgHandoffWired) return false;
    suite.__pmgHandoffWired = true;
    suite.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      var btn = (t.closest && t.closest('.pmg-photo-surprise')) ||
                (t.classList && t.classList.contains('pmg-photo-surprise') ? t : null);
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var dial = readDial();
      var picks = rollPicks(dial);
      applyPicksToDom(picks, dial);
      /* Notify any summary observers in pmg-ux.js — pmg-ux's
         refreshSummary fires from pill click handlers. We don't
         have access to refreshSummary so we synthesize a click
         on a hidden no-op pill: simpler and safer is dispatching
         a synthetic 'change' event on the suite which pmg-ux
         listens to in some places. The cleanest fallback is to
         fire a click on each newly active pill, but that would
         toggle them off. Instead we fire a custom event the
         module can ignore — the visual state already shows the
         active pills, and pmg-ux re-reads selections on every
         user interaction (Send, Save, Clear). */
      try {
        suite.dispatchEvent(new CustomEvent('pmg-handoff-surprise', {
          bubbles: true, detail: { dial: dial, picks: picks }
        }));
      } catch (_) {}
      /* Auto-save to Recent. */
      var savedActive = readActivePills();
      persistSurpriseToRecent(savedActive);
      /* Refresh the suite summary by simulating a click on a
         pill we just activated and immediately toggling it back.
         We pick the first active pill we find. This indirectly
         triggers pmg-ux's refreshSummary in a single round-trip
         without changing the final state. */
      refreshSuiteSummary();
      var nice = DIAL_LABEL[dial];
      showToast('Surprise (' + nice + ') applied — saved to Recent.');
    }, true);
    return true;
  }

  /* Trigger a no-op state change so pmg-ux.js's pill-click
     handlers refresh the summary line and Send button. We click
     a known pill twice (toggle on then off — but only if it
     wasn't active to begin with). Avoids reaching into pmg-ux
     closures. */
  function refreshSuiteSummary() {
    var pill = document.querySelector('#' + SUITE_ID + ' .pmg-photo-pill[data-group][data-value]');
    if (!pill) return;
    var wasActive = pill.classList.contains('is-active');
    /* Two clicks = back to original state, but each click
       triggers pmg-ux's listener which in turn calls
       refreshSummary(). We only do this if there are active
       pills somewhere — otherwise it's pointless. */
    var anyActive = !!document.querySelector('#' + SUITE_ID + ' .pmg-photo-pill.is-active');
    if (!anyActive) return;
    try {
      pill.click();
      pill.click();
      /* Defensive: ensure final state matches original. */
      if (pill.classList.contains('is-active') !== wasActive) {
        pill.classList.toggle('is-active', wasActive);
      }
    } catch (_) {}
  }

  /* -------- Text mode dice intercept --------
     #random-prompt is the "🎲 Dice Idea Generator" button. It's
     wired inline in index.html and we want to keep its existing
     behavior (random goal + category + skill + tone + format +
     personality) — but the dial should bias HOW adventurous
     the picks are. We replace the handler the same way we did
     for photo surprise: capture-phase intercept + replacement. */
  var TEXT_GOALS = [
    'Help me draft a one-page launch plan for a new side project',
    'Give me a 30-day plan to grow an audience from zero on one platform',
    'Outline a high-converting landing page for a productivity app',
    'Write a cold DM that gets a busy founder to reply within 24 hours',
    'Create a study plan to learn a new programming language in 30 days',
    'Brainstorm names for a new productivity app aimed at students',
    'Help me negotiate a raise — script, talking points, and counters',
    'Draft a personal mission statement based on what matters most to me',
    'Plan a no-budget weekend trip with friends that feels memorable',
    'Outline a 5-email welcome sequence for new newsletter subscribers'
  ];
  var TEXT_GOALS_WILD = [
    'Imagine I\u2019m launching a podcast about something controversial — script the first 60 seconds',
    'Pretend you\u2019re my brutally-honest mentor — tell me what to stop doing this week',
    'Roleplay a billionaire investor and pitch me on a hidden trillion-dollar opportunity',
    'Write a manifesto for a movement that doesn\u2019t exist yet but probably should',
    'Design a one-week experiment that would change how I think about money',
    'Invent a productivity ritual that would only work for someone exactly like me'
  ];
  function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function setVal(id, v) {
    var el = $id(id);
    if (el) el.value = v;
  }

  function textDiceClose() {
    /* Keep most current values; only randomize the goal. */
    setVal('goal', pickRand(TEXT_GOALS));
    /* Leave category/skill/tone/format/personality alone. */
  }
  function textDiceMix() {
    var categories    = ['business', 'money', 'content', 'career', 'personal', 'productivity', 'learning', 'faith', 'other'];
    var skills        = ['beginner', 'intermediate', 'advanced'];
    var tones         = ['professional', 'bold-direct', 'casual', 'expert'];
    var formats       = ['step-by-step', 'list', 'detailed breakdown'];
    var personalities = ['none', 'direct', 'friendly', 'bold', 'professional', 'creative', 'faith', 'street', 'luxury', 'viral'];
    setVal('goal',          pickRand(TEXT_GOALS));
    setVal('category',      pickRand(categories));
    setVal('skillLevel',    pickRand(skills));
    setVal('tone',           pickRand(tones));
    setVal('outputFormat',   pickRand(formats));
    setVal('personality',    pickRand(personalities));
    var mm = $id('moneyMode'); if (mm) mm.checked = Math.random() < 0.4;
  }
  function textDiceWild() {
    /* Wild draws from the spicier goal set + biases toward
       more dramatic personalities (viral / bold / creative /
       luxury) so the resulting prompt feels notably distinct
       from the safe defaults. */
    var categories    = ['content', 'personal', 'creative' === 'creative' ? 'other' : 'other', 'career', 'business'];
    var skills        = ['advanced', 'advanced', 'intermediate'];
    var tones         = ['bold-direct', 'expert', 'bold-direct'];
    var formats       = ['step-by-step', 'detailed breakdown'];
    var personalities = ['viral', 'bold', 'creative', 'luxury', 'street', 'faith'];
    setVal('goal',          pickRand(TEXT_GOALS_WILD));
    setVal('category',      pickRand(categories));
    setVal('skillLevel',    pickRand(skills));
    setVal('tone',           pickRand(tones));
    setVal('outputFormat',   pickRand(formats));
    setVal('personality',    pickRand(personalities));
    var mm = $id('moneyMode'); if (mm) mm.checked = Math.random() < 0.5;
  }

  function attachTextDiceIntercept() {
    var btn = $id('random-prompt');
    if (!btn || btn.__pmgHandoffWired) return false;
    btn.__pmgHandoffWired = true;
    btn.addEventListener('click', function (e) {
      var dial = readDial();
      e.preventDefault();
      e.stopImmediatePropagation();
      /* Clear details so randomized values don't fight stale
         constraints — matches the original handler's behavior. */
      var details = $id('details');
      if (details && dial !== 'close') details.value = '';
      if (dial === 'close')      textDiceClose();
      else if (dial === 'wild')  textDiceWild();
      else                       textDiceMix();
      /* Generate the prompt the same way the original handler
         did — via the page's __pmgText.generatePrompt + setPrompt
         bridge (exposed in index.html). */
      var bridge = window.__pmgText;
      if (!bridge || typeof bridge.generatePrompt !== 'function') return;
      var data = (typeof bridge.getFormData === 'function') ? bridge.getFormData() : {};
      var prompt = bridge.generatePrompt(data);
      if (typeof bridge.setPromptText === 'function') bridge.setPromptText(prompt);
      if (typeof window.__pmgClearUndo === 'function') window.__pmgClearUndo();
      var builder = $id('builder');
      if (builder) {
        try { builder.scrollIntoView({ behavior: window.PMG_A11Y && window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (_) {}
      }
      var nice = DIAL_LABEL[dial];
      showToast('Random prompt (' + nice + ').');
    }, true);
    return true;
  }

  /* -------- Cross-mode handoff: text -> image --------
     Adds a single "Try This In Image Mode" pill into the
     result-panel actions row. Only visible when:
       (a) we're in text mode (body has no image-mode class), AND
       (b) the result box has user-generated content (body has
           pmg-has-generated class — set by pmg-text-flow-v2 /
           the original generation flow).
     Click it: switch to image mode, pre-seed photo pills based
     on tone + category + personality, scroll to the suite. */
  var TEXT_HANDOFF_BTN_ID = 'pmg-handoff-text-to-image-btn';
  function mountTextToImageBtn() {
    if ($id(TEXT_HANDOFF_BTN_ID)) return;
    /* Insert into the result panel's actions-row beside Copy /
       Print / Clear. Falls back to result-wrap if actions-row
       isn't found. */
    var actions = document.querySelector('#result-panel .actions-row');
    var host = actions || document.querySelector('#result-panel .result-wrap');
    if (!host) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = TEXT_HANDOFF_BTN_ID;
    btn.className = 'pmg-handoff-cta';
    btn.hidden = true;
    btn.setAttribute('aria-label', 'Try this prompt in Image mode');
    btn.innerHTML =
      '<span class="pmg-handoff-cta-emoji" aria-hidden="true">\uD83C\uDFA8</span>' +
      '<span>Try This In Image Mode</span>';
    btn.addEventListener('click', textToImageHandoff);
    host.appendChild(btn);
  }

  function refreshTextToImageBtn() {
    var btn = $id(TEXT_HANDOFF_BTN_ID);
    if (!btn) return;
    /* Reveal once the result panel has visible content. Either
       body class signals "a text prompt was generated". We accept
       both since different code paths set different markers. */
    var b = document.body;
    var hasGenerated = !!b && (
      b.classList.contains('pmg-has-generated') ||
      b.classList.contains('pmg-has-result')
    );
    var visible = hasGenerated && !isImageMode();
    btn.hidden = !visible;
  }

  function gatherTextBias() {
    /* Accumulate per-group pill bias from the active text-mode
       form fields. We always include the user's tone, category,
       and personality biases. Returns { groupId: [pill, ...] }. */
    var picks = { style: [], camera: [], lighting: [], composition: [], palette: [] };
    function merge(src) {
      if (!src) return;
      Object.keys(src).forEach(function (gid) {
        if (!picks[gid]) return;
        src[gid].forEach(function (v) {
          if (picks[gid].indexOf(v) === -1) picks[gid].push(v);
        });
      });
    }
    var tone = ($id('tone') || {}).value || '';
    var cat  = ($id('category') || {}).value || '';
    var per  = ($id('personality') || {}).value || '';
    /* Merge order: personality (most explicit) first, then tone,
       then category. Earlier sources win when we cap per-group. */
    merge(PERSONALITY_BIAS[per]);
    merge(TONE_BIAS[tone]);
    merge(CATEGORY_BIAS[cat]);
    /* Cap per-group at 3 to avoid clutter without dropping the
       most distinctive personality cues. */
    Object.keys(picks).forEach(function (gid) {
      if (picks[gid].length > 3) picks[gid] = picks[gid].slice(0, 3);
    });
    return picks;
  }

  function textToImageHandoff() {
    var bias = gatherTextBias();
    /* Switch to image mode using the page's bridge. */
    if (typeof window.setMode === 'function') {
      try { window.setMode('image'); } catch (_) {}
    }
    /* Apply pill bias — clear current picks first so we don't
       blend with stale state, then activate the bias pills. */
    var hasAny = false;
    Object.keys(bias).forEach(function (gid) { if (bias[gid] && bias[gid].length) hasAny = true; });
    if (hasAny) {
      clearAllPhotoPicks();
      Object.keys(bias).forEach(function (gid) {
        bias[gid].forEach(function (v) { activatePill(gid, v); });
      });
      refreshSuiteSummary();
    }
    /* Scroll to the photo suite so the user can see the
       pre-seeded selection. */
    var suite = $id(SUITE_ID);
    if (suite) {
      try { suite.scrollIntoView({ behavior: window.PMG_A11Y && window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (_) {}
    }
    showToast('Switched to Image mode — starting hints applied.');
  }

  /* -------- Cross-mode handoff: image -> text --------
     "Write A Prompt About This" button injected into the
     #imageResultSection .image-result-actions row, hidden until
     an image has been generated (we mirror what pmg-share.js
     does — the Download button gets style.display set to
     inline-flex once the image renders, so we sync visibility
     to that). */
  var IMG_HANDOFF_BTN_ID = 'pmg-handoff-image-to-text-btn';
  function mountImageToTextBtn() {
    if ($id(IMG_HANDOFF_BTN_ID)) return;
    var host = document.querySelector('#imageResultSection .image-result-actions');
    if (!host) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = IMG_HANDOFF_BTN_ID;
    btn.className = 'pmg-handoff-cta';
    btn.hidden = true;
    btn.setAttribute('aria-label', 'Write a text prompt about this image');
    btn.innerHTML =
      '<span class="pmg-handoff-cta-emoji" aria-hidden="true">\u270D\uFE0F</span>' +
      '<span>Write A Prompt About This</span>';
    btn.addEventListener('click', imageToTextHandoff);
    host.appendChild(btn);
  }
  function refreshImageToTextBtn() {
    var btn = $id(IMG_HANDOFF_BTN_ID);
    if (!btn) return;
    /* Visible only when an image is rendered (download button
       has display !== 'none' OR there is an <img> inside the
       result wrap). */
    var dl = $id('imageDownloadBtn');
    var dlVisible = !!(dl && dl.style && dl.style.display && dl.style.display !== 'none');
    var hasImg = !!document.querySelector('#imageResultWrap img');
    btn.hidden = !(dlVisible || hasImg);
  }

  function deriveTextSeedFromPills() {
    /* Pick the FIRST active pill we recognize from PILL_TO_TEXT
       (across groups, in GROUPS order so style takes precedence).
       Returns null if no pills are active. */
    var pills = readActivePills();
    var allActive = [];
    GROUPS.forEach(function (g) {
      (pills[g.id] || []).forEach(function (v) { allActive.push(v); });
    });
    if (!allActive.length) return null;
    var seed = null;
    for (var i = 0; i < allActive.length; i++) {
      var lc = String(allActive[i]).toLowerCase();
      if (PILL_TO_TEXT[lc]) { seed = PILL_TO_TEXT[lc]; break; }
    }
    if (!seed) {
      /* Fallback for unmapped pills — use a safe default and
         describe the topic generically as "the image I just
         generated". */
      seed = { tone: 'casual', category: 'personal', personality: 'friendly', topic: 'the image I just generated' };
    }
    seed.activePills = allActive.slice(0, 6);
    return seed;
  }

  function imageToTextHandoff() {
    var seed = deriveTextSeedFromPills();
    if (!seed) {
      showToast('Add some Photography Suite pills first, then try again.');
      return;
    }
    /* Switch to text mode. */
    if (typeof window.setMode === 'function') {
      try { window.setMode('write'); } catch (_) {}
    }
    /* Pre-seed text fields. We don't blast away an in-progress
       goal — only overwrite if it's empty or holds the placeholder
       text. */
    var goalEl = $id('goal');
    if (goalEl) {
      var cur = (goalEl.value || '').trim();
      if (!cur) {
        var pillNames = (seed.activePills || []).join(', ');
        goalEl.value =
          'Write about ' + seed.topic +
          (pillNames ? ' featuring ' + pillNames : '') +
          ' — give me a vivid, well-structured piece I can build on.';
      }
    }
    /* Set tone/category/personality unobtrusively — only when
       the field is at its default value. */
    function setIfDefault(id, defaultVal, newVal) {
      var el = $id(id);
      if (!el) return;
      if (!el.value || el.value === defaultVal || el.value === '') {
        el.value = newVal;
      }
    }
    setIfDefault('tone',        'professional', seed.tone);
    setIfDefault('category',    'business',     seed.category);
    setIfDefault('personality', 'none',         seed.personality);

    /* Scroll to builder. */
    var builder = $id('builder');
    if (builder) {
      try { builder.scrollIntoView({ behavior: window.PMG_A11Y && window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (_) {}
    }
    /* Focus the goal field so the user can immediately edit. */
    if (goalEl) {
      try { goalEl.focus(); } catch (_) {}
    }
    showToast('Switched to Text mode — pre-seeded from your photo pills.');
  }

  /* -------- Watchers: keep handoff buttons in sync -------- */
  function watchBodyClass() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    try {
      var mo = new MutationObserver(function () {
        refreshTextToImageBtn();
        refreshImageToTextBtn();
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }

  function watchImageResult() {
    if (typeof MutationObserver !== 'function') return;
    var sec = $id('imageResultSection');
    if (!sec) return;
    try {
      var mo = new MutationObserver(function () { refreshImageToTextBtn(); });
      mo.observe(sec, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    } catch (_) {}
  }

  /* -------- Init -------- */
  function init() {
    if (!document.body) return;
    injectStyles();
    /* Attach intercepts as soon as the targets exist. */
    attachPhotoSurpriseIntercept();
    attachTextDiceIntercept();
    /* Mount UI hooks — these may not be in the DOM yet on first
       call; the retries below handle late-mounted suites. */
    mountDial();
    mountTextToImageBtn();
    mountImageToTextBtn();
    refreshTextToImageBtn();
    refreshImageToTextBtn();
    watchBodyClass();
    watchImageResult();
    /* A few delayed retries cover late suite injection by
       pmg-ux.js (the suite is built asynchronously after
       pmg-ux's init runs). */
    [80, 250, 600, 1500, 3000].forEach(function (ms) {
      setTimeout(function () {
        attachPhotoSurpriseIntercept();
        attachTextDiceIntercept();
        mountDial();
        mountTextToImageBtn();
        mountImageToTextBtn();
        refreshTextToImageBtn();
        refreshImageToTextBtn();
      }, ms);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* -------- Public API for tests + power users -------- */
  window.__pmgHandoff = {
    version:        SCRIPT_VERSION,
    readDial:       readDial,
    writeDial:      writeDial,
    rollPicks:      rollPicks,
    applyPicks:     applyPicksToDom,
    persistRecent:  persistSurpriseToRecent,
    rerenderRecent: rerenderRecentRow,
    textToImage:    textToImageHandoff,
    imageToText:    imageToTextHandoff,
    refresh:        function () {
      refreshTextToImageBtn();
      refreshImageToTextBtn();
    },
    /* Test seam — let tests trigger the handoffs without firing
       a synthetic click that might race the mount retries. */
    _gatherTextBias: gatherTextBias,
    _deriveTextSeed: deriveTextSeedFromPills
  };
})();
