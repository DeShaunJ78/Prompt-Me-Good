/* PromptMeGood — Task #56: Unified Share button (link or image card export)
 *
 * Adds a single Share entry point that works the same in BOTH Text and Image
 * modes. Clicking opens a small sheet with two options:
 *   1. Copy link              — encodes prompt + active pills + builder
 *                              settings + mode in the URL hash. No server
 *                              storage. Pasting the link elsewhere restores
 *                              the state.
 *   2. Export as image card   — renders a branded PNG of the prompt + key
 *                              pill picks (and the generated image when in
 *                              image mode) via the Canvas API and triggers a
 *                              download.
 *
 * Hash format: #pmgshare=<base64url(JSON)> (distinct from legacy #share= to
 * avoid colliding with the older builder-fields-only restorer in index.html).
 *
 * Escape hatches:
 *   - URL query: ?noshare
 *   - localStorage: pmg_share_disable=1
 *   - localStorage: pmg_disable=1 (master kill)
 *
 * Idempotent: window.__pmgShareLoaded prevents double-init.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__pmgShareLoaded) return;
  window.__pmgShareLoaded = true;

  /* ------------------------------ kill switch ------------------------------ */
  try {
    var qs = new URLSearchParams(window.location.search || '');
    if (qs.has('noshare')) return;
  } catch (_) { /* ignore */ }
  try {
    if (window.localStorage) {
      if (localStorage.getItem('pmg_share_disable') === '1') return;
      if (localStorage.getItem('pmg_disable') === '1') return;
    }
  } catch (_) { /* ignore */ }

  /* ============================== utilities ============================== */

  function $(id) { return document.getElementById(id); }
  function txt(s) { return (s == null ? '' : String(s)); }
  function trim(s) { return txt(s).replace(/\s+/g, ' ').trim(); }

  function toast(msg) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    } catch (_) { /* fall through */ }
    /* Lightweight inline fallback so users always get feedback even if the
       app's main toast isn't initialised yet. */
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('role', 'status');
    t.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
      'background:rgba(15,23,42,.92)', 'color:#fff', 'padding:10px 16px',
      'border-radius:999px', 'font:600 13px/1.2 system-ui,-apple-system,sans-serif',
      'box-shadow:0 8px 24px rgba(15,23,42,.25)', 'z-index:2147483646',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 2200);
  }

  function isImageMode() {
    var b = document.body;
    if (!b) return false;
    return b.classList.contains('image-mode') || b.classList.contains('photo-mode-active');
  }

  /* base64url helpers (unicode-safe via TextEncoder/Decoder fallback). */
  function toBase64Url(str) {
    var bytes;
    try {
      bytes = new TextEncoder().encode(str);
    } catch (_) {
      /* legacy fallback */
      bytes = new Uint8Array(unescape(encodeURIComponent(str)).split('').map(function (c) {
        return c.charCodeAt(0);
      }));
    }
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = btoa(bin);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(b64u) {
    var pad = b64u.length % 4 === 0 ? '' : new Array(5 - (b64u.length % 4)).join('=');
    var b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + pad;
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder().decode(bytes); }
    catch (_) { return decodeURIComponent(escape(bin)); }
  }

  /* ============================ state capture ============================ */

  /* Same field set as the legacy in-page restorer in index.html so the new
     link is at least as expressive. */
  var TEXT_BUILDER_KEYS = [
    'category', 'skillLevel', 'tone', 'outputFormat', 'outputLanguage',
    'personality', 'details', 'rules or limits', 'maxLength', 'maxLengthCustom'
  ];
  var BOOL_BUILDER_KEYS = ['moneyMode', 'humanTone', 'clarityBoost'];

  function captureBuilderSettings() {
    var s = {};
    TEXT_BUILDER_KEYS.forEach(function (k) {
      var el = $(k); if (!el) return;
      var v = trim(el.value);
      if (v) s[k] = v;
    });
    BOOL_BUILDER_KEYS.forEach(function (k) {
      var el = $(k); if (!el) return;
      if (el.checked) s[k] = 1;
    });
    return s;
  }

  function captureActivePills() {
    var out = [];
    /* Photo Suite pills (data-group + data-value). */
    try {
      var pills = document.querySelectorAll('.pmg-photo-pill.is-active[data-group][data-value]');
      Array.prototype.forEach.call(pills, function (el) {
        out.push({
          k: 'photo',
          g: el.getAttribute('data-group') || '',
          v: el.getAttribute('data-value') || ''
        });
      });
      /* Photo Suite presets. */
      var presets = document.querySelectorAll('.pmg-photo-preset.is-active[data-group][data-preset-index]');
      Array.prototype.forEach.call(presets, function (el) {
        out.push({
          k: 'preset',
          g: el.getAttribute('data-group') || '',
          i: el.getAttribute('data-preset-index') || ''
        });
      });
    } catch (_) { /* ignore */ }
    return out;
  }

  function captureGoal() {
    var el = $('goal');
    return el ? trim(el.value) : '';
  }

  function capturePrompt() {
    var el = $('resultBox');
    if (!el) return '';
    /* textContent strips formatting; keep newlines collapsed. */
    return (el.textContent || '').trim();
  }

  function captureImageUrl() {
    try {
      var wrap = $('imageResultWrap');
      if (!wrap) return '';
      var img = wrap.querySelector('img');
      return img ? (img.getAttribute('src') || '') : '';
    } catch (_) { return ''; }
  }

  function captureShareState() {
    return {
      v: 2,
      m: isImageMode() ? 'image' : 'text',
      g: captureGoal(),
      p: capturePrompt(),
      pl: captureActivePills(),
      s: captureBuilderSettings()
    };
  }

  function buildShareLink(state) {
    var json = JSON.stringify(state || captureShareState());
    var encoded = toBase64Url(json);
    return location.origin + location.pathname + '#pmgshare=' + encoded;
  }

  /* ============================ state restore ============================ */

  function setFieldValue(id, val) {
    var el = $(id); if (!el) return false;
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      var want = !!val;
      if (el.checked !== want) {
        el.checked = want;
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }
      return true;
    }
    if (el.value !== val) {
      el.value = val;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }
    return true;
  }

  function applyMode(mode) {
    if (mode !== 'image' && mode !== 'text') return;
    var want = mode === 'image';
    if (isImageMode() === want) return;
    /* Task #140: legacy window.setMode + #imageModeBtn/#writeModeBtn are gone.
       Photography is now a chassis-v3 tab. */
    try {
      if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
        window.pmgChassisV3.setActivePanel(want ? 'photography' : 'text');
        return;
      }
    } catch (_) {}
    /* Last-ditch: click the matching chassis tab if present. */
    var tabSel = want ? '.pmgv3-tab[data-module="photography"]' : '.pmgv3-tab[data-module="text"]';
    var tab = document.querySelector(tabSel);
    if (tab) try { tab.click(); } catch (_) {}
  }

  function applyPills(pills) {
    if (!pills || !pills.length) return;
    pills.forEach(function (p) {
      try {
        var sel;
        if (p.k === 'photo' && p.g && p.v) {
          sel = '.pmg-photo-pill[data-group="' + cssEscape(p.g) + '"][data-value="' + cssEscape(p.v) + '"]';
        } else if (p.k === 'preset' && p.g && p.i != null) {
          sel = '.pmg-photo-preset[data-group="' + cssEscape(p.g) + '"][data-preset-index="' + cssEscape(String(p.i)) + '"]';
        }
        if (!sel) return;
        var el = document.querySelector(sel);
        if (!el) return;
        var already = el.classList.contains('is-active');
        if (!already) {
          try { el.click(); } catch (_) {}
        }
      } catch (_) { /* ignore individual pill */ }
    });
  }

  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
    return String(s).replace(/["\\]/g, '\\$&');
  }

  /* Authoritative state reset — the share link IS the full snapshot; any
     pre-existing UI state on the recipient must be cleared so the result is
     deterministic regardless of what the recipient had selected. */
  function clearAuthoritativeState(payloadKeys) {
    /* 1. Toggle off any currently-active photo pills not in the payload. */
    try {
      var activePills = document.querySelectorAll('.pmg-photo-pill.is-active[data-group][data-value]');
      var keep = {};
      (payloadKeys.pills || []).forEach(function (k) { keep[k] = true; });
      Array.prototype.forEach.call(activePills, function (el) {
        var key = (el.getAttribute('data-group') || '') + '|' + (el.getAttribute('data-value') || '');
        if (!keep[key]) {
          try { el.click(); } catch (_) {}
        }
      });
      /* Same treatment for active presets. */
      var activePresets = document.querySelectorAll('.pmg-photo-preset.is-active[data-group][data-preset-index]');
      var keepPreset = {};
      (payloadKeys.presets || []).forEach(function (k) { keepPreset[k] = true; });
      Array.prototype.forEach.call(activePresets, function (el) {
        var key = (el.getAttribute('data-group') || '') + '|' + (el.getAttribute('data-preset-index') || '');
        if (!keepPreset[key]) {
          try { el.click(); } catch (_) {}
        }
      });
    } catch (_) { /* ignore */ }

    /* 2. Reset known boolean builder keys not in the payload. */
    BOOL_BUILDER_KEYS.forEach(function (k) {
      if (payloadKeys.bools[k]) return;
      var el = $(k);
      if (el && el.checked) {
        el.checked = false;
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }
    });
  }

  function applyShareHash() {
    var hash = window.location.hash || '';
    var m = hash.match(/^#pmgshare=([A-Za-z0-9_-]+)$/);
    if (!m) return false;
    var data;
    try { data = JSON.parse(fromBase64Url(m[1])); }
    catch (_) { return false; }
    if (!data || data.v !== 2) return false;

    /* 1. Mode (do this first so subsequent restores affect the right surface). */
    applyMode(data.m);

    /* 2. Index payload pills/bools so we can authoritatively clear stale UI
       state on the recipient before applying the snapshot. */
    var payloadKeys = { pills: [], presets: [], bools: {} };
    (data.pl || []).forEach(function (p) {
      if (p.k === 'photo' && p.g != null && p.v != null) payloadKeys.pills.push(p.g + '|' + p.v);
      else if (p.k === 'preset' && p.g != null && p.i != null) payloadKeys.presets.push(p.g + '|' + p.i);
    });
    Object.keys((data.s || {})).forEach(function (k) {
      if (BOOL_BUILDER_KEYS.indexOf(k) !== -1 && data.s[k]) payloadKeys.bools[k] = true;
    });
    clearAuthoritativeState(payloadKeys);

    /* 3. Builder settings + goal. setFieldValue is called for every known
       text key so empty payload values explicitly clear stale recipient
       text fields too. */
    setFieldValue('goal', data.g || '');
    TEXT_BUILDER_KEYS.forEach(function (k) {
      var v = (data.s && data.s[k] != null) ? data.s[k] : '';
      setFieldValue(k, v);
    });

    /* 4. Pills — defer slightly so any module that builds the photo suite on
       mode-change has time to render the buttons. Two-phase retry covers the
       common case where the suite is created lazily. */
    var attempts = 0;
    function tryPills() {
      applyPills(data.pl || []);
      attempts++;
      if (attempts < 3) setTimeout(tryPills, 250);
    }
    setTimeout(tryPills, 80);

    /* 4. Prompt text — paint into resultBox via the canonical bridge so the
       app's internal "has-result" gating fires. */
    if (data.p) {
      setTimeout(function () {
        try {
          if (window.__pmgText && typeof window.__pmgText.setPromptText === 'function') {
            window.__pmgText.setPromptText(data.p);
          } else {
            var rb = $('resultBox');
            if (rb) rb.textContent = data.p;
            try { document.body.classList.add('pmg-has-result'); } catch (_) {}
          }
        } catch (_) { /* ignore */ }
      }, 120);
    }

    /* 5. Strip the hash so a refresh doesn't re-apply stale state. */
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}

    return true;
  }

  /* ============================== sheet UI ============================== */

  var SHEET_ID = 'pmg-share-sheet';

  function ensureStyles() {
    if ($('pmg-share-styles')) return;
    var css = [
      '#' + SHEET_ID + '-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);',
      '  z-index:2147483640;display:none;align-items:flex-end;justify-content:center;',
      '  animation:pmgShareFade 160ms ease}',
      '#' + SHEET_ID + '-backdrop.is-open{display:flex}',
      '@media (min-width:640px){#' + SHEET_ID + '-backdrop{align-items:center}}',
      '#' + SHEET_ID + '{background:#fff;color:#0f172a;width:100%;max-width:480px;',
      '  border-radius:18px 18px 0 0;padding:20px 18px 22px;box-shadow:0 -8px 32px rgba(15,23,42,.2);',
      '  font:14px/1.4 system-ui,-apple-system,sans-serif;animation:pmgShareSlide 200ms ease}',
      '@media (min-width:640px){#' + SHEET_ID + '{border-radius:18px;margin:0 16px}}',
      '#' + SHEET_ID + ' h2{margin:0 0 4px;font-size:17px;font-weight:700}',
      '#' + SHEET_ID + ' p.pmg-share-sub{margin:0 0 14px;color:#475569;font-size:13px}',
      '#' + SHEET_ID + ' .pmg-share-opt{display:flex;align-items:flex-start;gap:12px;width:100%;',
      '  text-align:left;padding:14px 14px;background:#f8fafc;border:1px solid #e2e8f0;',
      '  border-radius:12px;cursor:pointer;font:inherit;color:inherit;margin-top:8px;',
      '  min-height:56px;transition:background 120ms,border-color 120ms}',
      '#' + SHEET_ID + ' .pmg-share-opt:hover{background:#eef2ff;border-color:#c7d2fe}',
      '#' + SHEET_ID + ' .pmg-share-opt:focus-visible{outline:2px solid #4f46e5;outline-offset:2px}',
      '#' + SHEET_ID + ' .pmg-share-opt-ico{font-size:22px;line-height:1;flex:0 0 auto;margin-top:1px}',
      '#' + SHEET_ID + ' .pmg-share-opt-body{flex:1 1 auto;min-width:0}',
      '#' + SHEET_ID + ' .pmg-share-opt-title{font-weight:700;font-size:14px;color:#0f172a}',
      '#' + SHEET_ID + ' .pmg-share-opt-desc{font-size:12.5px;color:#64748b;margin-top:2px}',
      '#' + SHEET_ID + ' .pmg-share-close{position:absolute;top:10px;right:10px;background:none;',
      '  border:0;font-size:22px;line-height:1;color:#64748b;cursor:pointer;padding:6px 10px;',
      '  border-radius:8px}',
      '#' + SHEET_ID + ' .pmg-share-close:hover{background:#f1f5f9;color:#0f172a}',
      '#' + SHEET_ID + '-wrap{position:relative;width:100%;display:flex;justify-content:center}',
      '#pmg-share-btn-image{margin-left:0}',
      '@keyframes pmgShareFade{from{opacity:0}to{opacity:1}}',
      '@keyframes pmgShareSlide{from{transform:translateY(20px);opacity:.4}to{transform:none;opacity:1}}',
      '[data-theme="dark"] #' + SHEET_ID + '{background:var(--color-surface,#1c1b18);color:var(--color-text,#ece9e2)}',
      '[data-theme="dark"] #' + SHEET_ID + ' p.pmg-share-sub{color:var(--color-text-muted,#b9b4ab)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-opt{background:var(--color-surface-2,#23211f);border-color:var(--color-border,#34312d);color:var(--color-text,#ece9e2)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-opt:hover{background:rgba(91,168,176,0.12);border-color:rgba(91,168,176,0.35)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-opt-title{color:var(--color-text,#ece9e2)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-opt-desc{color:var(--color-text-muted,#b9b4ab)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-close{color:var(--color-text-muted,#b9b4ab)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-close:hover{background:var(--color-surface-2,#23211f);color:var(--color-text,#ece9e2)}',
      '[data-theme="dark"] #' + SHEET_ID + ' .pmg-share-opt:focus-visible{outline-color:#818cf8}',
      '[data-theme="dark"] #' + SHEET_ID + ' h2{color:var(--color-text,#ece9e2)}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'pmg-share-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  var lastTrigger = null;

  function buildSheet() {
    if ($(SHEET_ID + '-backdrop')) return;
    ensureStyles();
    var bd = document.createElement('div');
    bd.id = SHEET_ID + '-backdrop';
    bd.setAttribute('role', 'presentation');
    /* share-rescue-1: without this attribute the chassis-v3 universal
       hide rule (pmg-chassis-v3.css L51) suppresses the whole sheet —
       it is appended to <body> outside #pmg-chassis-v3-root. */
    bd.setAttribute('data-pmg-overlay-root', '1');

    var wrap = document.createElement('div');
    wrap.id = SHEET_ID + '-wrap';

    var sheet = document.createElement('div');
    sheet.id = SHEET_ID;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', SHEET_ID + '-title');
    sheet.innerHTML = [
      '<button class="pmg-share-close" type="button" id="' + SHEET_ID + '-close" aria-label="Close share menu">×</button>',
      '<h2 id="' + SHEET_ID + '-title">Share</h2>',
      '<p class="pmg-share-sub">Send your prompt setup to anyone — no account needed.</p>',
      '<button class="pmg-share-opt" type="button" id="' + SHEET_ID + '-link">',
      '  <span class="pmg-share-opt-ico" aria-hidden="true">🔗</span>',
      '  <span class="pmg-share-opt-body">',
      '    <span class="pmg-share-opt-title">Copy link</span>',
      '    <span class="pmg-share-opt-desc">Encodes your prompt, pills, and settings in the URL.</span>',
      '  </span>',
      '</button>',
      '<button class="pmg-share-opt" type="button" id="' + SHEET_ID + '-image">',
      '  <span class="pmg-share-opt-ico" aria-hidden="true">🖼️</span>',
      '  <span class="pmg-share-opt-body">',
      '    <span class="pmg-share-opt-title">Export as image card</span>',
      '    <span class="pmg-share-opt-desc">Save a branded PNG of your prompt to share anywhere.</span>',
      '  </span>',
      '</button>'
    ].join('');

    wrap.appendChild(sheet);
    bd.appendChild(wrap);
    document.body.appendChild(bd);

    bd.addEventListener('click', function (e) {
      if (e.target === bd) closeSheet();
    });
    $(SHEET_ID + '-close').addEventListener('click', closeSheet);
    $(SHEET_ID + '-link').addEventListener('click', function () { handleCopyLink(); });
    $(SHEET_ID + '-image').addEventListener('click', function () { handleExportImage(); });

    document.addEventListener('keydown', function (e) {
      var open = $(SHEET_ID + '-backdrop');
      if (!open || !open.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet();
        return;
      }
      /* Focus trap — keep Tab cycling inside the dialog so keyboard users
         can't reach background controls behind the modal. */
      if (e.key === 'Tab') {
        var focusables = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        var visible = Array.prototype.filter.call(focusables, function (el) {
          return !el.disabled && el.offsetParent !== null;
        });
        if (!visible.length) return;
        var first = visible[0];
        var last = visible[visible.length - 1];
        var active = document.activeElement;
        if (e.shiftKey && (active === first || !sheet.contains(active))) {
          e.preventDefault();
          try { last.focus(); } catch (_) {}
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          try { first.focus(); } catch (_) {}
        }
      }
    });
  }

  function openSheet(triggerEl) {
    buildSheet();
    lastTrigger = triggerEl || null;
    var bd = $(SHEET_ID + '-backdrop');
    if (!bd) return;
    bd.classList.add('is-open');
    /* Move focus to the first option for keyboard users. */
    setTimeout(function () {
      var first = $(SHEET_ID + '-link');
      if (first) try { first.focus(); } catch (_) {}
    }, 50);
  }

  function closeSheet() {
    var bd = $(SHEET_ID + '-backdrop');
    if (!bd) return;
    bd.classList.remove('is-open');
    if (lastTrigger) {
      try { lastTrigger.focus(); } catch (_) {}
    }
  }

  /* ============================ link copying ============================ */

  function copyTextSync(text) {
    /* Synchronous fallback works in headless test environments where the
       async clipboard API may hang on permission prompts. */
    var ok = false;
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) { /* ignore */ }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        var p = navigator.clipboard.writeText(text);
        if (p && typeof p.then === 'function') p.then(function () {}, function () {});
      } catch (_) { /* ignore */ }
    }
    return ok;
  }

  function handleCopyLink() {
    var state = captureShareState();
    var link = buildShareLink(state);
    /* Expose the most recent payload for tests / debugging. */
    try { window.__pmgShareLastLink = link; } catch (_) {}
    var ok = copyTextSync(link);
    closeSheet();
    toast(ok ? 'Share link copied to clipboard.' : 'Could not copy. Long-press the address bar to copy manually.');
  }

  /* ========================= image card export ========================= */

  /* Wraps text into lines that fit `maxWidth` at the current font. */
  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var paragraphs = String(text || '').split(/\n+/);
    paragraphs.forEach(function (para) {
      var words = para.split(/\s+/);
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    });
    return lines;
  }

  function loadImageWithFallback(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function summarisePills() {
    var out = [];
    try {
      var pills = document.querySelectorAll('.pmg-photo-pill.is-active[data-group][data-value]');
      Array.prototype.forEach.call(pills, function (el) {
        var g = el.getAttribute('data-group') || '';
        var v = el.getAttribute('data-value') || '';
        if (v) out.push({ g: g, v: v });
      });
    } catch (_) { /* ignore */ }
    return out;
  }

  function drawCard(promptText, pills, image, mode) {
    var W = 1200, H = 1500;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    /* Background gradient. */
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#eef2ff');
    bg.addColorStop(1, '#fdf4ff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Card surface. */
    var P = 64;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, P, P, W - P * 2, H - P * 2, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99,102,241,.18)';
    ctx.lineWidth = 2;
    ctx.stroke();

    var x = P + 48;
    var y = P + 56;
    var contentW = W - (P + 48) * 2;

    /* Wordmark. */
    ctx.fillStyle = '#4f46e5';
    ctx.font = '800 42px system-ui,-apple-system,"Segoe UI",sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('PromptMeGood', x, y);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 18px system-ui,-apple-system,"Segoe UI",sans-serif';
    ctx.fillText(mode === 'image' ? 'Image prompt' : 'Text prompt', x, y + 52);
    y += 110;

    /* Optional image (image mode). Reserve up to 520px height. */
    var imgH = 0;
    if (image) {
      var maxImgH = 520;
      var ratio = image.width / image.height || 1;
      var drawW = contentW;
      var drawH = drawW / ratio;
      if (drawH > maxImgH) {
        drawH = maxImgH;
        drawW = drawH * ratio;
      }
      var imgX = x + (contentW - drawW) / 2;
      ctx.save();
      roundRect(ctx, imgX, y, drawW, drawH, 18);
      ctx.clip();
      ctx.drawImage(image, imgX, y, drawW, drawH);
      ctx.restore();
      imgH = drawH + 28;
      y += imgH;
    }

    /* Prompt block. */
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 22px system-ui,-apple-system,"Segoe UI",sans-serif';
    ctx.fillText('Prompt', x, y);
    y += 36;

    ctx.fillStyle = '#1e293b';
    ctx.font = '400 24px Georgia,"Times New Roman",serif';
    var lineH = 36;
    var maxLines = pills.length ? 14 : 22;
    if (image) maxLines = 8;
    var lines = wrapText(ctx, promptText || '(no prompt yet)', contentW);
    var truncated = lines.length > maxLines;
    if (truncated) lines = lines.slice(0, maxLines);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (truncated && i === lines.length - 1) line = line.replace(/\.{0,3}\s*$/, '') + ' …';
      ctx.fillText(line, x, y);
      y += lineH;
    }
    y += 16;

    /* Pill chips. */
    if (pills.length) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 22px system-ui,-apple-system,"Segoe UI",sans-serif';
      ctx.fillText('Selections', x, y);
      y += 32;
      var px = x;
      var py = y;
      var rowH = 44;
      var gap = 10;
      ctx.font = '600 18px system-ui,-apple-system,"Segoe UI",sans-serif';
      for (var p = 0; p < pills.length; p++) {
        var label = (pills[p].g ? pills[p].g + ': ' : '') + pills[p].v;
        var padW = 18;
        var w = ctx.measureText(label).width + padW * 2;
        if (px + w > x + contentW) {
          px = x;
          py += rowH + gap;
        }
        if (py + rowH > H - P - 100) break; /* leave room for footer */
        ctx.fillStyle = '#eef2ff';
        roundRect(ctx, px, py, w, rowH, 22);
        ctx.fill();
        ctx.strokeStyle = '#c7d2fe';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#3730a3';
        ctx.fillText(label, px + padW, py + 11);
        px += w + gap;
      }
      y = py + rowH + 24;
    }

    /* Footer. */
    var footerY = H - P - 60;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px system-ui,-apple-system,"Segoe UI",sans-serif';
    ctx.fillText('promptmegood.com', x, footerY);
    ctx.textAlign = 'right';
    ctx.fillText('Built with PromptMeGood', x + contentW, footerY);
    ctx.textAlign = 'left';

    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function downloadCanvas(canvas, filename) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) {
            /* Fallback to data URL if toBlob is unavailable / tainted. */
            try {
              var url = canvas.toDataURL('image/png');
              triggerDownload(url, filename);
              resolve(true);
              return;
            } catch (_) { resolve(false); return; }
          }
          var url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 4000);
          resolve(true);
        }, 'image/png');
      } catch (_) {
        try {
          var url2 = canvas.toDataURL('image/png');
          triggerDownload(url2, filename);
          resolve(true);
        } catch (_e) { resolve(false); }
      }
    });
  }

  function triggerDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); } catch (_) {} }, 500);
  }

  function handleExportImage() {
    var mode = isImageMode() ? 'image' : 'text';
    var prompt = capturePrompt() || captureGoal();
    var pills = summarisePills();
    var imgUrl = mode === 'image' ? captureImageUrl() : '';
    closeSheet();
    toast('Building image card…');
    loadImageWithFallback(imgUrl).then(function (img) {
      var canvas = drawCard(prompt, pills, img, mode);
      if (!canvas) { toast('Could not build the image card.'); return; }
      var stamp = new Date().toISOString().slice(0, 10);
      downloadCanvas(canvas, 'promptmegood-' + mode + '-' + stamp + '.png').then(function (ok) {
        toast(ok ? 'Image card downloaded.' : 'Could not save the image card.');
        try { window.__pmgShareLastCardSize = { w: canvas.width, h: canvas.height }; } catch (_) {}
      });
    });
  }

  /* ========================= button placement ========================= */

  function styleBtn(btn) {
    btn.classList.add('btn', 'btn-secondary');
    btn.style.cssText = (btn.style.cssText || '') + ';display:inline-flex;align-items:center;gap:6px';
  }

  /* Image mode share button — injected into .image-result-actions next to
     the Download button. Shown only once a generated image exists. */
  function ensureImageShareButton() {
    var actions = document.querySelector('#imageResultSection .image-result-actions');
    if (!actions) return null;
    var existing = $('pmg-share-btn-image');
    if (existing) return existing;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-share-btn-image';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-label', 'Share this image prompt');
    btn.textContent = '↗ Share';
    styleBtn(btn);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openSheet(btn);
    });
    /* Insert immediately after the Download button when present, otherwise
       at the start of the action row. */
    var dl = $('imageDownloadBtn');
    if (dl && dl.parentNode === actions) {
      actions.insertBefore(btn, dl.nextSibling);
    } else {
      actions.insertBefore(btn, actions.firstChild);
    }
    syncImageShareVisibility();
    return btn;
  }

  function syncImageShareVisibility() {
    var btn = $('pmg-share-btn-image');
    if (!btn) return;
    var dl = $('imageDownloadBtn');
    /* Mirror the Download button's visibility — it's the canonical signal
       that the image is ready to share. */
    var ready = !!(dl && dl.classList.contains('pmg-ready'));
    var want = ready ? 'inline-flex' : 'none';
    if (btn.style.display !== want) btn.style.display = want;
  }

  /* Text mode — re-route the existing #share-btn through the unified sheet
     so both modes use the same UI. The original button stays in the same
     visual position; we just hijack its click. */
  function rewireTextShareButton() {
    var btn = $('share-btn');
    if (!btn || btn.__pmgShareWired) return;
    /* cloneNode(true) does NOT copy custom JS properties, so we have to
       mark the *clone* (not the original) to break the rewire loop. */
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.id = 'share-btn'; /* keep id stable for cheatsheet/palette */
    clone.textContent = '↗ Share';
    clone.setAttribute('aria-haspopup', 'dialog');
    clone.setAttribute('aria-label', 'Share this prompt');
    clone.addEventListener('click', function (e) {
      e.preventDefault();
      openSheet(clone);
    });
    clone.__pmgShareWired = true;
  }

  /* ============================== boot ============================== */

  function init() {
    rewireTextShareButton();
    ensureImageShareButton();

    /* Watch the DOM for late-mounted action rows + image readiness. */
    var mo = new MutationObserver(function () {
      rewireTextShareButton();
      ensureImageShareButton();
      syncImageShareVisibility();
    });
    try {
      mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    } catch (_) { /* ignore */ }

    /* Apply incoming share hash on first paint AND on hashchange. */
    applyShareHash();
    window.addEventListener('hashchange', applyShareHash);

    /* Public API for tests + debugging. */
    window.__pmgShare = {
      open: function () { openSheet(); },
      close: closeSheet,
      capture: captureShareState,
      buildLink: function () { return buildShareLink(); },
      apply: applyShareHash,
      copyLink: handleCopyLink,
      exportImage: handleExportImage,
      _decode: function (b64u) { try { return JSON.parse(fromBase64Url(b64u)); } catch (_) { return null; } }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
