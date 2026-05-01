/* =====================================================================
 * PromptMeGood — Task #50 — Improve Your Prompt: history rewind +
 * preview-on-hover for the quick-tweak buttons.
 *
 * Adds three things to the existing #improve-block panel WITHOUT touching
 * any other panel or the main app IIFE in index.html:
 *
 *   1. In-memory history strip — every time a quick-tweak (More
 *      Detailed / More Bold & Direct / Beginner Friendly / Improve
 *      With AI / Fine-Tune Update Prompt) changes the prompt, the
 *      previous version is captured as a chip the user can click to
 *      restore. The current state is also a chip. Cleared whenever
 *      the user runs Fix My Prompt for a new goal.
 *
 *   2. Preview-on-hover/focus — hovering or focusing a [data-remix]
 *      quick-tweak button shows a small popover with a preview of the
 *      tweaked prompt. Nothing is committed. Hides on mouseleave/blur
 *      and Escape.
 *
 *   3. Keyboard navigation for the history strip — roving tabindex,
 *      Arrow Left/Right to move, Home/End to jump, Enter/Space to
 *      restore.
 *
 * Hard-rule compliance:
 *   - In-memory only. No localStorage. Cleared on full page reload.
 *   - No new dependencies. Pure vanilla JS.
 *   - No edits to existing panels' wiring. Hooks via window.__pmgText
 *     (already exposed in index.html) and a passive MutationObserver
 *     on #resultBox.
 *   - Escape hatches: append `?noimprovehistory` to the URL or run
 *     `localStorage.pmg_improvehistory_disable = '1'` to disable.
 *   - Hard try/catch wrapper so a bug here can never break the page.
 * ===================================================================== */
(function pmgImproveHistory() {
  'use strict';
  if (window.__pmgImproveHistoryInit) return;
  window.__pmgImproveHistoryInit = true;

  try {
    if (
      /[?&]noimprovehistory\b/.test(location.search) ||
      localStorage.getItem('pmg_improvehistory_disable') === '1'
    ) {
      console.info('[pmg-improve-history] disabled via escape hatch');
      return;
    }
  } catch (_) {}

  try {

  var MAX_ENTRIES        = 14;        /* keep the strip lean — older entries roll off */
  var TWEAK_TIMEOUT_MS   = 30000;     /* AI-improve can take a while */
  var HOVER_DELAY_MS     = 180;       /* avoid preview-flash on cursor pass-through */
  var PREVIEW_MAX_CHARS  = 360;       /* keep popover compact */

  var resultBox     = null;
  var improveBlock  = null;
  var entries       = [];   /* { id, text, label, time, kind } */
  var currentIndex  = -1;
  var nextId        = 1;
  var pendingTweak  = null; /* { label, kind, beforeText, deadline } */
  var stripWrap     = null;
  var stripList     = null;
  var stripEmpty    = null;
  var previewEl     = null;
  var previewAnchor = null; /* tracks button for aria-describedby cleanup */
  var hoverTimer    = null;
  var restoring     = false;
  var lastBoxText   = '';

  /* ---------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------- */
  function readBox() {
    return resultBox ? (resultBox.textContent || '').replace(/\u00A0/g, ' ') : '';
  }

  function isPlaceholder(t) {
    if (!t) return true;
    var s = String(t).trim();
    if (!s) return true;
    return s.indexOf('Your fixed prompt will appear here') === 0
        || s.indexOf('Please enter a goal') === 0
        || s.indexOf('Add a clear goal first') === 0;
  }

  function fmtTime(ts) {
    try {
      var d = new Date(ts);
      var h = d.getHours();
      var m = d.getMinutes();
      var ampm = h >= 12 ? 'p' : 'a';
      h = h % 12; if (h === 0) h = 12;
      return h + ':' + (m < 10 ? '0' : '') + m + ampm;
    } catch (_) { return ''; }
  }

  function shortLabelFor(kind) {
    switch (kind) {
      case 'detailed':       return 'More Detailed';
      case 'bold-direct':    return 'Bolder & Direct';
      case 'beginner':       return 'Beginner Friendly';
      case 'ai-improve':     return 'AI Rewrite';
      case 'fine-tune':      return 'Fine-Tune';
      case 'undo':           return 'Undo';
      case 'original':       return 'Original';
      default:               return 'Update';
    }
  }

  function summarize(text, n) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
  }

  /* ---------------------------------------------------------------
   * Styles
   * --------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('pmg-improve-history-style')) return;
    var css = [
      '.pmg-imphist {',
      '  margin-top: 14px; padding-top: 12px;',
      '  border-top: 1px dashed color-mix(in srgb, var(--color-text) 14%, transparent);',
      '}',
      '.pmg-imphist-head {',
      '  display: flex; align-items: baseline; justify-content: space-between;',
      '  gap: 8px; margin-bottom: 6px;',
      '}',
      '.pmg-imphist-title {',
      '  font-size: 12px; font-weight: 700; letter-spacing: 0.06em;',
      '  text-transform: uppercase; color: var(--color-text-muted);',
      '}',
      '.pmg-imphist-hint {',
      '  font-size: 11.5px; color: var(--color-text-muted);',
      '}',
      '.pmg-imphist-empty {',
      '  font-size: 12.5px; color: var(--color-text-faint);',
      '  padding: 6px 0; font-style: italic;',
      '}',
      '.pmg-imphist-list {',
      '  display: flex; flex-wrap: nowrap; gap: 6px;',
      '  overflow-x: auto; overflow-y: hidden;',
      '  padding: 4px 2px 8px;',
      '  scrollbar-width: thin;',
      '  -webkit-overflow-scrolling: touch;',
      '}',
      '.pmg-imphist-list::-webkit-scrollbar { height: 6px; }',
      '.pmg-imphist-list::-webkit-scrollbar-thumb {',
      '  background: color-mix(in srgb, var(--color-text) 18%, transparent);',
      '  border-radius: 999px;',
      '}',
      '.pmg-imphist-chip {',
      '  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 6px 10px; min-height: 30px;',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);',
      '  border-radius: 999px;',
      '  font-size: 12px; font-weight: 600; color: var(--color-text);',
      '  cursor: pointer; white-space: nowrap;',
      '  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;',
      '  max-width: 220px;',
      '}',
      '.pmg-imphist-chip:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);',
      '  transform: translateY(-1px);',
      '}',
      '.pmg-imphist-chip:focus-visible {',
      '  outline: 2px solid var(--color-primary); outline-offset: 2px;',
      '}',
      '.pmg-imphist-chip[aria-current="true"] {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));',
      '  border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);',
      '  color: var(--color-primary);',
      '}',
      '.pmg-imphist-chip[aria-current="true"]::before {',
      '  content: "●"; font-size: 9px; color: var(--color-primary);',
      '}',
      '.pmg-imphist-chip-label {',
      '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;',
      '}',
      '.pmg-imphist-chip-time {',
      '  font-size: 10.5px; font-weight: 500; color: var(--color-text-faint);',
      '}',
      '.pmg-imphist-chip[aria-current="true"] .pmg-imphist-chip-time {',
      '  color: color-mix(in srgb, var(--color-primary) 75%, var(--color-text));',
      '}',

      /* Preview popover for [data-remix] hover/focus */
      '.pmg-imphist-preview {',
      '  position: fixed; z-index: 240; max-width: min(420px, calc(100vw - 24px));',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));',
      '  border-radius: var(--radius-md, 12px);',
      '  box-shadow: 0 14px 40px rgba(0,0,0,0.18);',
      '  padding: 10px 12px;',
      '  font-size: 12.5px; line-height: 1.5;',
      '  pointer-events: none;',
      '  opacity: 0; transform: translateY(4px);',
      '  transition: opacity 140ms ease, transform 140ms ease;',
      '}',
      '.pmg-imphist-preview.is-open { opacity: 1; transform: translateY(0); }',
      '.pmg-imphist-preview-title {',
      '  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;',
      '  text-transform: uppercase; color: var(--color-primary);',
      '  margin-bottom: 6px;',
      '}',
      '.pmg-imphist-preview-body {',
      '  white-space: pre-wrap; word-break: break-word;',
      '  max-height: 180px; overflow: hidden;',
      '  color: var(--color-text-muted);',
      '}',
      '.pmg-imphist-preview-foot {',
      '  margin-top: 6px; font-size: 10.5px; color: var(--color-text-faint);',
      '  font-style: italic;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .pmg-imphist-chip, .pmg-imphist-preview { transition: none; }',
      '}',
      '@media (max-width: 420px) {',
      '  .pmg-imphist-chip-label { max-width: 96px; }',
      '  .pmg-imphist-preview { max-width: calc(100vw - 16px); font-size: 12px; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'pmg-improve-history-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------------------------------------------------------------
   * History strip rendering
   * --------------------------------------------------------------- */
  function ensureStripMounted() {
    if (stripWrap || !improveBlock) return;
    stripWrap = document.createElement('div');
    stripWrap.className = 'pmg-imphist';
    stripWrap.setAttribute('data-pmg-imphist', '1');
    stripWrap.innerHTML =
      '<div class="pmg-imphist-head">' +
        '<span class="pmg-imphist-title">Prompt History</span>' +
        '<span class="pmg-imphist-hint">Click any version to restore. ← → to navigate.</span>' +
      '</div>' +
      '<div class="pmg-imphist-empty" data-pmg-empty="1">' +
        'Quick-tweaks you make will appear here so you can rewind.' +
      '</div>' +
      '<div class="pmg-imphist-list" role="listbox" aria-label="Improve Your Prompt history" tabindex="-1"></div>';
    /* Insert just before the Fine-Tune block so it sits with the
       Refine/Undo controls instead of below the editor. */
    var fineTune = improveBlock.querySelector('.fine-tune');
    if (fineTune && fineTune.parentNode === improveBlock) {
      improveBlock.insertBefore(stripWrap, fineTune);
    } else {
      improveBlock.appendChild(stripWrap);
    }
    stripList = stripWrap.querySelector('.pmg-imphist-list');
    stripEmpty = stripWrap.querySelector('[data-pmg-empty]');

    stripList.addEventListener('keydown', onStripKeydown);
  }

  function renderStrip() {
    if (!stripList) return;
    if (!entries.length) {
      stripList.innerHTML = '';
      if (stripEmpty) stripEmpty.style.display = '';
      return;
    }
    if (stripEmpty) stripEmpty.style.display = 'none';
    var frag = document.createDocumentFragment();
    entries.forEach(function (entry, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-imphist-chip';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-pmg-entry-id', String(entry.id));
      btn.setAttribute('data-pmg-entry-index', String(i));
      var isCur = i === currentIndex;
      btn.setAttribute('aria-current', isCur ? 'true' : 'false');
      btn.setAttribute('aria-selected', isCur ? 'true' : 'false');
      btn.setAttribute('tabindex', isCur ? '0' : '-1');
      var title = entry.label + ' · ' + fmtTime(entry.time) +
                  (isCur ? ' (current)' : '') +
                  '\nClick to restore this version.';
      btn.title = title;
      btn.setAttribute('aria-label', entry.label + ', captured ' + fmtTime(entry.time) + (isCur ? ', current version' : ''));
      var labelSpan = document.createElement('span');
      labelSpan.className = 'pmg-imphist-chip-label';
      labelSpan.textContent = entry.label;
      var timeSpan = document.createElement('span');
      timeSpan.className = 'pmg-imphist-chip-time';
      timeSpan.textContent = fmtTime(entry.time);
      btn.appendChild(labelSpan);
      btn.appendChild(timeSpan);
      btn.addEventListener('click', function () { restoreEntryByIndex(i); });
      frag.appendChild(btn);
    });
    stripList.innerHTML = '';
    stripList.appendChild(frag);
    /* Scroll the current chip into view (tail of the strip is most
       recent) without page-jumping. */
    var curEl = stripList.querySelector('[aria-current="true"]');
    if (curEl && typeof curEl.scrollIntoView === 'function') {
      try { curEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------------
   * Entry mutation
   * --------------------------------------------------------------- */
  function pushEntry(text, label, kind) {
    if (!text || isPlaceholder(text)) return;
    /* Dedupe: if the new text matches an existing entry exactly, just
       move "current" to that entry instead of creating a duplicate. */
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].text === text) {
        currentIndex = i;
        renderStrip();
        return;
      }
    }
    entries.push({
      id: nextId++,
      text: text,
      label: label || 'Update',
      time: Date.now(),
      kind: kind || 'tweak'
    });
    if (entries.length > MAX_ENTRIES) {
      entries.shift();
    }
    currentIndex = entries.length - 1;
    renderStrip();
  }

  function resetEntries(seedText, seedLabel) {
    entries = [];
    currentIndex = -1;
    if (seedText && !isPlaceholder(seedText)) {
      pushEntry(seedText, seedLabel || 'Original', 'original');
    } else {
      renderStrip();
    }
  }

  function restoreEntryByIndex(i) {
    if (i < 0 || i >= entries.length) return;
    var entry = entries[i];
    if (!entry) return;
    var bridge = window.__pmgText;
    if (!bridge || typeof bridge.setPromptText !== 'function') return;
    restoring = true;
    try { bridge.setPromptText(entry.text); }
    catch (_) {}
    /* setPromptText hides the "Edited manually" indicator and resets the
       in-page Undo stack baseline; the resulting MutationObserver tick
       must NOT create a new entry. */
    setTimeout(function () { restoring = false; }, 60);
    currentIndex = i;
    lastBoxText = entry.text;
    renderStrip();
    /* Refocus the chip we just activated so keyboard users keep flow. */
    var chip = stripList && stripList.querySelector('[data-pmg-entry-index="' + i + '"]');
    if (chip && typeof chip.focus === 'function') {
      try { chip.focus(); } catch (_) {}
    }
    if (typeof window.showToast === 'function') {
      try { window.showToast('Restored: ' + entry.label); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------------
   * Keyboard navigation
   * --------------------------------------------------------------- */
  function onStripKeydown(e) {
    if (!entries.length) return;
    var t = e.target;
    if (!t || !t.matches || !t.matches('.pmg-imphist-chip')) return;
    var idx = parseInt(t.getAttribute('data-pmg-entry-index') || '-1', 10);
    if (idx < 0) return;
    var nextIdx = -1;
    switch (e.key) {
      case 'ArrowRight':
        nextIdx = Math.min(entries.length - 1, idx + 1);
        break;
      case 'ArrowLeft':
        nextIdx = Math.max(0, idx - 1);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = entries.length - 1;
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        restoreEntryByIndex(idx);
        return;
      default:
        return;
    }
    if (nextIdx === -1 || nextIdx === idx) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    /* Roving tabindex: move focus without restoring (preview only). */
    var chips = stripList.querySelectorAll('.pmg-imphist-chip');
    chips.forEach(function (c) { c.setAttribute('tabindex', '-1'); });
    var nextChip = chips[nextIdx];
    if (nextChip) {
      nextChip.setAttribute('tabindex', '0');
      try { nextChip.focus(); } catch (_) {}
      try { nextChip.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------------
   * Tweak interception (capture-phase, never blocks the click)
   * --------------------------------------------------------------- */
  function startPendingTweak(label, kind) {
    pendingTweak = {
      label: label,
      kind: kind,
      beforeText: readBox(),
      deadline: Date.now() + TWEAK_TIMEOUT_MS
    };
  }

  function attachTweakListeners() {
    if (!improveBlock || improveBlock.__pmgImpHistAttached) return;
    improveBlock.__pmgImpHistAttached = true;

    /* Quick-tweak pills */
    improveBlock.querySelectorAll('[data-remix]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startPendingTweak(shortLabelFor(btn.dataset.remix || ''), btn.dataset.remix || 'tweak');
      }, true);
    });

    /* AI improve */
    var aiBtn = document.getElementById('improve-with-ai-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', function () {
        startPendingTweak(shortLabelFor('ai-improve'), 'ai-improve');
      }, true);
    }

    /* Fine-tune update */
    var ftBtn = document.getElementById('fine-tune-btn');
    if (ftBtn) {
      ftBtn.addEventListener('click', function () {
        startPendingTweak(shortLabelFor('fine-tune'), 'fine-tune');
      }, true);
    }
    /* Fine-tune Enter-key path also fires the click handler indirectly,
       but its `runFineTune` is only triggered by Enter on the textarea
       — wire a capture-phase listener there too for parity. */
    var ftInput = document.getElementById('fine-tune-input');
    if (ftInput) {
      ftInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          startPendingTweak(shortLabelFor('fine-tune'), 'fine-tune');
        }
      }, true);
    }

    /* Undo button — when the existing Undo runs, the resultBox text
       changes back to a previous version. We don't add an entry; we
       let dedupe move "current" to whichever existing entry matches. */
    var undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        /* Mark this as a non-tweak so MutationObserver knows to only
           reconcile current pointer, not create a new chip. */
        startPendingTweak(shortLabelFor('undo'), 'undo');
      }, true);
    }
  }

  /* ---------------------------------------------------------------
   * MutationObserver — single source of truth for "the prompt text
   * just changed". Reacts to setPromptText, AI improve responses,
   * fine-tune updates, undo, and any other path.
   * --------------------------------------------------------------- */
  /* If the pre-tweak text isn't already in history (e.g. user manually
     edited #resultBox or Task #49's diff rewrote it before clicking a
     tweak), insert it as a checkpoint chip BEFORE the post-tweak chip
     so the rewind path still leads back to that exact state. */
  function reconcileBeforeText(beforeText) {
    if (!beforeText || isPlaceholder(beforeText)) return;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].text === beforeText) return; /* already represented */
    }
    var label = (currentIndex >= 0 && entries.length) ? 'Manual Edit' : 'Original';
    /* pushEntry handles cap + currentIndex bump; the post-tweak push
       that follows will move current to the new tail. */
    pushEntry(beforeText, label, 'checkpoint');
  }

  function startBoxObserver() {
    if (!resultBox || resultBox.__pmgImpHistObserved) return;
    resultBox.__pmgImpHistObserved = true;
    lastBoxText = readBox();
    var mo = new MutationObserver(function () {
      if (restoring) return;
      var txt = readBox();
      if (txt === lastBoxText) return;
      lastBoxText = txt;

      /* Always consume pendingTweak on the first observed mutation —
         this prevents a click handler that exits to placeholder
         ("Please enter a goal first…") from leaving pendingTweak live
         for up to 30s and mislabeling the next unrelated change. */
      var pt = pendingTweak;
      pendingTweak = null;
      var fresh = !!(pt && Date.now() < pt.deadline);
      var realTweak = fresh && !isPlaceholder(txt) && txt !== pt.beforeText;

      if (isPlaceholder(txt)) return;

      if (realTweak) {
        /* This was a real tweak that produced new non-placeholder text. */
        if (pt.kind === 'undo') {
          /* Move current pointer to the matching entry; do not push. */
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].text === txt) {
              currentIndex = i;
              renderStrip();
              return;
            }
          }
          /* User undid past anything we tracked — record as checkpoint. */
          pushEntry(txt, 'Undo Result', 'undo');
          return;
        }
        /* Reconcile the pre-tweak state first so the user can rewind
           to whatever was in the box at click-time, even if it was a
           manual edit or a fix-diff rewrite we never logged. */
        reconcileBeforeText(pt.beforeText);
        pushEntry(txt, pt.label, pt.kind);
        return;
      }

      /* Untracked change (manual edit in the contenteditable, or a
         script we don't intercept). If text matches an existing entry,
         silently move current pointer; otherwise leave history alone
         so we don't spam chips on every keystroke. */
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].text === txt) {
          currentIndex = j;
          renderStrip();
          return;
        }
      }
    });
    mo.observe(resultBox, { childList: true, characterData: true, subtree: true });
  }

  /* Listen for the Fix My Prompt finalize event so a fresh generation
     resets the strip with a new "Original" entry. */
  function attachFinalizedListener() {
    document.addEventListener('pmg:builder-finalized', function (e) {
      var newText = (e && e.detail && e.detail.promptText) || readBox();
      if (!newText) return;
      lastBoxText = newText;
      pendingTweak = null;
      resetEntries(newText, 'Original');
    });
  }

  /* ---------------------------------------------------------------
   * Preview-on-hover/focus for [data-remix] buttons
   * --------------------------------------------------------------- */
  function ensurePreviewEl() {
    if (previewEl) return previewEl;
    previewEl = document.createElement('div');
    previewEl.className = 'pmg-imphist-preview';
    previewEl.setAttribute('role', 'tooltip');
    previewEl.setAttribute('aria-hidden', 'true');
    previewEl.id = 'pmg-imphist-preview';
    previewEl.innerHTML =
      '<div class="pmg-imphist-preview-title" data-pmg-prev-title>Preview</div>' +
      '<div class="pmg-imphist-preview-body" data-pmg-prev-body></div>' +
      '<div class="pmg-imphist-preview-foot">Hover/focus only — nothing applied yet.</div>';
    document.body.appendChild(previewEl);
    return previewEl;
  }

  function positionPreview(anchor) {
    if (!previewEl || !anchor) return;
    var r = anchor.getBoundingClientRect();
    /* Render off-screen first to measure, then position. */
    previewEl.style.left = '-9999px';
    previewEl.style.top  = '-9999px';
    previewEl.style.display = 'block';
    var pw = previewEl.offsetWidth;
    var ph = previewEl.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* Prefer below; flip above if not enough room. */
    var top = r.bottom + 8;
    if (top + ph > vh - 8) {
      top = Math.max(8, r.top - ph - 8);
    }
    var left = Math.min(Math.max(8, r.left), vw - pw - 8);
    previewEl.style.left = left + 'px';
    previewEl.style.top  = top  + 'px';
  }

  function buildRemixPreviewText(remixKind) {
    var bridge = window.__pmgText;
    if (!bridge) return null;
    var data;
    try { data = bridge.getFormData ? bridge.getFormData() : null; }
    catch (_) { data = null; }
    if (!data || !data.goal) return null;
    try {
      var t = bridge.generatePrompt(data, remixKind);
      return t || null;
    } catch (_) { return null; }
  }

  function showPreviewFor(btn) {
    var kind = btn.getAttribute('data-remix') || '';
    if (!kind) return;
    var text = buildRemixPreviewText(kind);
    ensurePreviewEl();
    var titleEl = previewEl.querySelector('[data-pmg-prev-title]');
    var bodyEl  = previewEl.querySelector('[data-pmg-prev-body]');
    if (titleEl) titleEl.textContent = 'Preview · ' + shortLabelFor(kind);
    if (bodyEl) {
      if (!text) {
        bodyEl.textContent = 'Add a goal first to preview this tweak.';
      } else {
        bodyEl.textContent = summarize(text, PREVIEW_MAX_CHARS);
      }
    }
    positionPreview(btn);
    previewEl.classList.add('is-open');
    previewEl.setAttribute('aria-hidden', 'false');
    if (!btn.getAttribute('aria-describedby')) {
      btn.setAttribute('aria-describedby', 'pmg-imphist-preview');
      btn.__pmgImpHistDescribed = true;
    }
    previewAnchor = btn;
  }

  function hidePreview(btn) {
    if (previewEl) {
      previewEl.classList.remove('is-open');
      previewEl.setAttribute('aria-hidden', 'true');
      /* Hide after fade-out so the next show can re-measure. */
      setTimeout(function () {
        if (previewEl && !previewEl.classList.contains('is-open')) {
          previewEl.style.display = 'none';
        }
      }, 160);
    }
    /* Always strip aria-describedby from whichever button is currently
       described — caller doesn't have to know which one (Escape path). */
    var target = btn || previewAnchor;
    if (target && target.__pmgImpHistDescribed) {
      target.removeAttribute('aria-describedby');
      target.__pmgImpHistDescribed = false;
    }
    previewAnchor = null;
  }

  function attachPreviewListeners() {
    if (!improveBlock) return;
    var buttons = improveBlock.querySelectorAll('[data-remix]');
    buttons.forEach(function (btn) {
      if (btn.__pmgImpHistPrev) return;
      btn.__pmgImpHistPrev = true;
      var schedule = function () {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { showPreviewFor(btn); }, HOVER_DELAY_MS);
      };
      var dismiss = function () {
        clearTimeout(hoverTimer);
        hidePreview(btn);
      };
      btn.addEventListener('mouseenter', schedule);
      btn.addEventListener('mouseleave', dismiss);
      btn.addEventListener('focus', function () {
        clearTimeout(hoverTimer);
        showPreviewFor(btn);
      });
      btn.addEventListener('blur', dismiss);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && previewEl && previewEl.classList.contains('is-open')) {
        hidePreview();
      }
    });
    /* Hide if user scrolls the page or resizes the viewport — anchor
       coords would otherwise become stale. */
    window.addEventListener('scroll', function () {
      if (previewEl && previewEl.classList.contains('is-open')) hidePreview();
    }, true);
    window.addEventListener('resize', function () {
      if (previewEl && previewEl.classList.contains('is-open')) hidePreview();
    });
  }

  /* ---------------------------------------------------------------
   * Boot
   * --------------------------------------------------------------- */
  function boot() {
    resultBox    = document.getElementById('resultBox');
    improveBlock = document.getElementById('improve-block');
    if (!resultBox || !improveBlock) return false;
    injectStyles();
    ensureStripMounted();
    attachTweakListeners();
    attachPreviewListeners();
    attachFinalizedListener();
    startBoxObserver();
    /* If the page already has a non-placeholder prompt (e.g. dev reload
       after Fix My Prompt), seed the strip so the user can still rewind. */
    var initial = readBox();
    if (initial && !isPlaceholder(initial)) {
      resetEntries(initial, 'Current');
    } else {
      renderStrip();
    }
    return true;
  }

  function whenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  whenReady(function () {
    if (!boot()) {
      /* Some scripts (e.g. premium-polish) mutate the DOM after
         DOMContentLoaded. Try once more after a short delay. */
      setTimeout(boot, 250);
    }
  });

  /* Tiny test surface so Playwright can verify state without poking
     internals. Read-only snapshot. */
  window.__pmgImproveHistory = {
    snapshot: function () {
      return {
        count: entries.length,
        currentIndex: currentIndex,
        labels: entries.map(function (e) { return e.label; }),
        currentText: currentIndex >= 0 ? entries[currentIndex].text : ''
      };
    },
    restore: function (i) { restoreEntryByIndex(i); }
  };

  } catch (e) {
    try { console.warn('[pmg-improve-history] init failed', e); } catch (_) {}
  }
})();
