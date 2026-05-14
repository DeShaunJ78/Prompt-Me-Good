/* =============================================================
 * pmg-undo.js  (Task #55)
 *
 * Global undo stack across both modes (Text + Image).
 *
 *   Tracks meaningful state changes:
 *     - Mode switch (Text <-> Image)             via window.setMode wrap
 *     - Prompt edits / Fix / Improve / presets   via __pmgText.setPromptText wrap
 *     - Photography-Suite pill toggles           via capture-phase click + diff
 *     - Quick-Style preset application           via capture-phase click + diff
 *     - Image generations                        via MutationObserver on #imageResultWrap
 *
 *   Keyboard:
 *     - Cmd/Ctrl + Z       -> Undo
 *     - Shift+Cmd+Z / Ctrl+Y -> Redo
 *     - Suppressed while typing in an input/textarea/contenteditable so
 *       the browser's native character-level undo keeps working in those
 *       fields. The result-box is contenteditable on purpose; native
 *       undo handles per-keystroke edits inside it. Our stack handles
 *       the BIG jumps (setPromptText, mode switch, pill change, image
 *       generation) that happen outside an editor field.
 *
 *   Visible feedback:
 *     A small "pip" toast appears at the bottom-right confirming the
 *     undo/redo (and "Nothing to undo / redo" when empty).
 *
 *   Out of scope (per task spec):
 *     - Persistence across page reloads. Stack is in-memory only.
 *
 *   Strictly additive:
 *     - No edits to existing handlers — we monkey-patch wrappers and
 *       use capture-phase listeners that fall through to the existing
 *       click pipeline.
 *     - No backend / API / Stripe / Supabase / auth changes.
 *     - Test surface: window.__pmgUndo = { push, undo, redo, getStack,
 *       getCursor, clear, canUndo, canRedo }.
 *     - Escape hatches: ?noundo, localStorage `pmg_undo_disable=1`,
 *       master `pmg_disable=1`.
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgUndoLoaded) return;
  window.__pmgUndoLoaded = true;

  /* -------- Escape hatch -------- */
  try {
    if (
      /[?&]noundo\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1' ||
      localStorage.getItem('pmg_undo_disable') === '1'
    ) {
      try { console.info('[pmg-undo] disabled via escape hatch'); } catch (_) {}
      return;
    }
  } catch (_) {}

  var MAX_STACK = 50;
  var PIP_ID = 'pmg-undo-pip';
  var IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');

  /* -------- Stack state -------- */
  var stack = [];        /* Array<{undo, redo, label, t}> */
  var cursor = 0;        /* number of committed (undoable) entries; entries [cursor..len) are redoable */
  var suppressDepth = 0; /* >0 means "we are running undo/redo internals; do not push" */

  function suppressed(fn) {
    suppressDepth++;
    try { return fn(); } finally { suppressDepth--; }
  }

  function push(entry) {
    if (suppressDepth > 0) return;
    if (!entry || typeof entry.undo !== 'function' || typeof entry.redo !== 'function') return;
    /* Truncate the redo branch — any new commit invalidates pending redos. */
    if (cursor < stack.length) stack.length = cursor;
    entry.t = Date.now();
    stack.push(entry);
    /* Cap stack size — drop oldest. */
    while (stack.length > MAX_STACK) stack.shift();
    cursor = stack.length;
  }

  function canUndo() { return cursor > 0; }
  function canRedo() { return cursor < stack.length; }

  function undo() {
    if (!canUndo()) {
      showPip('Nothing to undo');
      return false;
    }
    cursor--;
    var entry = stack[cursor];
    suppressed(function () { try { entry.undo(); } catch (e) { try { console.warn('[pmg-undo] undo failed', e); } catch (_) {} } });
    showPip('Undid: ' + (entry.label || 'change'));
    return true;
  }

  function redo() {
    if (!canRedo()) {
      showPip('Nothing to redo');
      return false;
    }
    var entry = stack[cursor];
    cursor++;
    suppressed(function () { try { entry.redo(); } catch (e) { try { console.warn('[pmg-undo] redo failed', e); } catch (_) {} } });
    showPip('Redid: ' + (entry.label || 'change'));
    return true;
  }

  function clear() {
    stack.length = 0;
    cursor = 0;
  }

  /* -------- Pip toast -------- */
  function injectStyles() {
    if (document.getElementById('pmg-undo-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-undo-styles';
    s.textContent = [
      '#' + PIP_ID + '{',
      '  position: fixed;',
      '  right: 14px;',
      '  bottom: calc(14px + env(safe-area-inset-bottom, 0px));',
      '  z-index: 250;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 8px 14px;',
      '  border-radius: 999px;',
      '  background: var(--color-text, #1a1a1a);',
      '  color: var(--color-text-inverse, #fff);',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  letter-spacing: 0.01em;',
      '  box-shadow: 0 6px 20px rgba(0,0,0,0.22);',
      '  opacity: 0;',
      '  transform: translateY(8px);',
      '  pointer-events: none;',
      '  transition: opacity 160ms ease, transform 160ms ease;',
      '}',
      '#' + PIP_ID + '.is-visible{ opacity: 1; transform: translateY(0); }',
      '#' + PIP_ID + ' .pmg-undo-pip-icon{ font-size: 14px; line-height: 1; }',
      '@media (prefers-reduced-motion: reduce){',
      '  #' + PIP_ID + '{ transition: none; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ensurePip() {
    var pip = document.getElementById(PIP_ID);
    if (pip) return pip;
    pip = document.createElement('div');
    pip.id = PIP_ID;
    pip.setAttribute('role', 'status');
    pip.setAttribute('aria-live', 'polite');
    /* Chassis-v3 universal-hide hides anything appended directly under
       <body> unless it carries data-pmg-overlay-root. Without this the
       pip technically toggles its `is-visible` class but stays
       display:none, so users (and tests) never see it. */
    pip.setAttribute('data-pmg-overlay-root', '');
    pip.innerHTML = '<span class="pmg-undo-pip-icon" aria-hidden="true">↶</span><span class="pmg-undo-pip-text"></span>';
    document.body.appendChild(pip);
    return pip;
  }

  var pipHideTimer = null;
  function showPip(text) {
    try {
      injectStyles();
      var pip = ensurePip();
      var t = pip.querySelector('.pmg-undo-pip-text');
      if (t) t.textContent = text;
      pip.classList.add('is-visible');
      if (pipHideTimer) clearTimeout(pipHideTimer);
      pipHideTimer = setTimeout(function () {
        var p = document.getElementById(PIP_ID);
        if (p) p.classList.remove('is-visible');
      }, 1500);
    } catch (_) {}
  }

  /* -------- Keyboard wiring -------- */
  function isEditableTarget(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input') {
      var type = (t.type || 'text').toLowerCase();
      /* Buttons / checkboxes / etc. don't accept text input — treat as
         non-editable so global undo still fires when they are focused. */
      return /^(text|search|email|url|tel|password|number)$/.test(type);
    }
    if (tag === 'textarea') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  function isAnyOverlayOpen() {
    /* Match the cheatsheet's safety gate: don't fight modals. We only
       block when there's a real visible overlay. */
    var dialogs = document.querySelectorAll('[role="dialog"], .pmg-upgrade-overlay');
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      if (d.getAttribute('aria-hidden') === 'true') continue;
      var cs = window.getComputedStyle(d);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      var rect = d.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    var mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (!mod) return;
    /* Inside an editable field, defer to the browser's own undo stack
       so character-level edits behave normally. Our wrappers still
       capture the bigger setPromptText jumps. */
    if (isEditableTarget(e.target)) return;
    /* If a modal is open, let it own keyboard input. */
    if (isAnyOverlayOpen()) return;

    if (key === 'z') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) redo(); else undo();
    } else if (key === 'y' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      redo();
    }
  }, true);

  /* -------- Instrumentation: window.setMode (legacy) -------- */
  function wrapSetMode() {
    var orig = window.setMode;
    if (typeof orig !== 'function') return false;
    if (orig.__pmgUndoWrapped) return true;
    var wrapped = function (mode) {
      var prev = document.body.classList.contains('image-mode') ? 'image' : 'write';
      var ret = orig.apply(this, arguments);
      var next = document.body.classList.contains('image-mode') ? 'image' : 'write';
      if (suppressDepth === 0 && prev !== next) {
        push({
          label: 'mode switch',
          undo: function () { try { orig.call(window, prev); } catch (_) {} },
          redo: function () { try { orig.call(window, next); } catch (_) {} }
        });
      }
      return ret;
    };
    wrapped.__pmgUndoWrapped = true;
    try { window.setMode = wrapped; } catch (_) { return false; }
    return true;
  }

  /* -------- Instrumentation: pmgChassisV3.setActivePanel --------
     Task #140 removed window.setMode in favour of the chassis-v3
     three-panel architecture (Text / Photography / Video). Wrap the
     new entry point so panel switches still land on the undo stack
     and the body.image-mode toggle (which gates the Photography
     Suite) remains undoable. */
  function wrapSetActivePanel() {
    var api = window.pmgChassisV3;
    if (!api || typeof api.setActivePanel !== 'function') return false;
    if (api.setActivePanel.__pmgUndoWrapped) return true;
    var orig = api.setActivePanel;
    var wrapped = function (name) {
      var prev = (document.body && document.body.getAttribute('data-active-panel')) || 'text';
      var ret = orig.apply(this, arguments);
      var next = (document.body && document.body.getAttribute('data-active-panel')) || 'text';
      if (suppressDepth === 0 && prev !== next) {
        push({
          label: 'panel switch',
          undo: function () { try { orig.call(api, prev); } catch (_) {} },
          redo: function () { try { orig.call(api, next); } catch (_) {} }
        });
      }
      return ret;
    };
    wrapped.__pmgUndoWrapped = true;
    try { api.setActivePanel = wrapped; } catch (_) { return false; }
    return true;
  }

  /* -------- Instrumentation: __pmgText.setPromptText -------- */
  function getResultBoxText() {
    var rb = document.getElementById('resultBox');
    if (!rb) return '';
    return (rb.textContent || '').replace(/\u00A0/g, ' ');
  }

  function wrapSetPromptText() {
    var bridge = window.__pmgText;
    if (!bridge || typeof bridge.setPromptText !== 'function') return false;
    if (bridge.setPromptText.__pmgUndoWrapped) return true;
    var orig = bridge.setPromptText;
    var wrapped = function (text) {
      var prev = getResultBoxText();
      var ret = orig.apply(this, arguments);
      var next = getResultBoxText();
      if (suppressDepth === 0 && prev !== next) {
        push({
          label: 'prompt edit',
          undo: function () { try { orig.call(bridge, prev); } catch (_) {} },
          redo: function () { try { orig.call(bridge, next); } catch (_) {} }
        });
      }
      return ret;
    };
    wrapped.__pmgUndoWrapped = true;
    try { bridge.setPromptText = wrapped; } catch (_) { return false; }
    return true;
  }

  /* -------- Instrumentation: photo pills + presets -------- */
  function pillKey(el) {
    return (el.getAttribute('data-group') || '') + '|' + (el.getAttribute('data-value') || '');
  }
  function snapshotPills() {
    var keys = [];
    var nodes = document.querySelectorAll('.pmg-photo-pill.is-active');
    for (var i = 0; i < nodes.length; i++) {
      var k = pillKey(nodes[i]);
      if (k !== '|') keys.push(k);
    }
    keys.sort();
    return keys;
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function restorePillsTo(targetKeys) {
    var want = Object.create(null);
    for (var i = 0; i < targetKeys.length; i++) want[targetKeys[i]] = true;
    var nodes = document.querySelectorAll('.pmg-photo-pill');
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      var k = pillKey(el);
      if (k === '|') continue;
      var should = want[k] === true;
      var is = el.classList.contains('is-active');
      if (should !== is) {
        /* Click the pill so its existing handler runs (toggles class +
           refreshes the live summary, count badges, Send button state).
           Suppression is active so we don't re-record this. */
        try { el.click(); } catch (_) { el.classList.toggle('is-active', should); }
      }
    }
  }

  document.addEventListener('click', function (e) {
    if (suppressDepth > 0) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var pill = t.closest('.pmg-photo-pill');
    var preset = t.closest('.pmg-photo-preset');
    if (!pill && !preset) return;
    var label = preset ? 'preset' : 'pill toggle';
    var before = snapshotPills();
    /* Snapshot AFTER the existing click handler has run. setTimeout(0)
       puts us at the end of the current task — by then pmg-ux's bubble
       handler has updated `.is-active` on the affected pill(s). */
    setTimeout(function () {
      if (suppressDepth > 0) return;
      var after = snapshotPills();
      if (sameSet(before, after)) return;
      push({
        label: label,
        undo: function () { restorePillsTo(before); },
        redo: function () { restorePillsTo(after); }
      });
    }, 0);
  }, true);

  /* -------- Instrumentation: image generation -------- */
  /* Watch #imageResultWrap. When an <img> element is committed (i.e.
     the wrap's innerHTML transitions from spinner/placeholder to a
     real image), record the previous innerHTML so undo can restore it.
     We intentionally use innerHTML — the wrap is a small leaf
     container whose markup the existing image pipeline replaces
     wholesale, so a snapshot is faithful and small. */
  var imageObserver = null;
  var lastImageWrapHtml = '';
  var lastDownloadSnap = null;
  function hasRealImage(wrap) {
    if (!wrap) return false;
    return !!wrap.querySelector('img[src]');
  }
  /* Capture the small bag of related UI state that changes alongside
     the result wrap when an image generation completes — the
     download CTA's href / display / className / pmg-ready class are
     all flipped in a separate code path (pmg-image-fix.js) but they
     read as one user-visible "image is ready" state. Without this
     snapshot, undo would leave the download button pointing at the
     just-undone image, which is a visible inconsistency. */
  function snapshotDownloadBtn() {
    var dl = document.getElementById('imageDownloadBtn');
    if (!dl) return null;
    return {
      href: dl.getAttribute('href') || '',
      display: dl.style.display || '',
      className: dl.className || '',
      download: dl.getAttribute('download') || ''
    };
  }
  function restoreDownloadBtn(snap) {
    var dl = document.getElementById('imageDownloadBtn');
    if (!dl || !snap) return;
    if (snap.href) dl.setAttribute('href', snap.href); else dl.removeAttribute('href');
    dl.style.display = snap.display;
    dl.className = snap.className;
    if (snap.download) dl.setAttribute('download', snap.download);
  }
  function setupImageObserver() {
    if (imageObserver) return;
    var wrap = document.getElementById('imageResultWrap');
    if (!wrap) return;
    lastImageWrapHtml = wrap.innerHTML;
    lastDownloadSnap = snapshotDownloadBtn();
    imageObserver = new MutationObserver(function () {
      try {
        if (suppressDepth > 0) {
          lastImageWrapHtml = wrap.innerHTML;
          lastDownloadSnap = snapshotDownloadBtn();
          return;
        }
        var hadImage = /<img\b/i.test(lastImageWrapHtml);
        var hasImage = hasRealImage(wrap);
        var nextHtml = wrap.innerHTML;
        /* Only record when the wrap has a real <img> AND its markup
           actually changed since our last commit. Spinner / loading
           transitions are skipped because they don't contain <img>. */
        if (hasImage && nextHtml !== lastImageWrapHtml) {
          var prevHtml = lastImageWrapHtml;
          var prevDl = lastDownloadSnap;
          lastImageWrapHtml = nextHtml;
          /* Sample the download-button state on a microtask so any
             "image ready" handlers that flip it after the wrap mutates
             have a chance to land before we snapshot. */
          var nextDlPromise = Promise.resolve().then(function () {
            return snapshotDownloadBtn();
          });
          /* Skip when the previous state had identical markup (no real
             change). */
          if (prevHtml !== nextHtml) {
            nextDlPromise.then(function (nextDl) {
              lastDownloadSnap = nextDl;
              push({
                label: hadImage ? 'new image' : 'image generation',
                undo: function () {
                  try {
                    var w = document.getElementById('imageResultWrap');
                    if (!w) return;
                    w.innerHTML = prevHtml;
                    lastImageWrapHtml = w.innerHTML;
                    restoreDownloadBtn(prevDl);
                    lastDownloadSnap = snapshotDownloadBtn();
                  } catch (_) {}
                },
                redo: function () {
                  try {
                    var w = document.getElementById('imageResultWrap');
                    if (!w) return;
                    w.innerHTML = nextHtml;
                    lastImageWrapHtml = w.innerHTML;
                    restoreDownloadBtn(nextDl);
                    lastDownloadSnap = snapshotDownloadBtn();
                  } catch (_) {}
                }
              });
            });
          }
        } else if (!hasImage) {
          /* Keep our reference fresh while the wrap is in a transient
             state (spinner / placeholder) so the next real-image
             commit knows what to roll back to. */
          lastImageWrapHtml = nextHtml;
          lastDownloadSnap = snapshotDownloadBtn();
        }
      } catch (_) {}
    });
    imageObserver.observe(wrap, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }

  /* -------- Boot: defer wiring to next tick so other deferred scripts
     (which create __pmgText / setMode) are guaranteed to have run. -------- */
  function boot() {
    injectStyles();
    var ok1 = wrapSetMode();
    var ok2 = wrapSetPromptText();
    var ok3 = wrapSetActivePanel();
    setupImageObserver();
    /* If a wrap target wasn't ready yet, retry briefly. Some inline
       scripts in index.html define their globals at the very tail of
       parsing; defer scripts run after parsing, but we also tolerate
       the rare case where a global is overwritten by a later module
       (e.g. command palette wrapping setMode). Re-wrapping is
       idempotent thanks to the __pmgUndoWrapped marker.
       wrapSetMode is allowed to remain false forever after Task #140;
       the new chassis-v3 wrap (ok3) is what matters in practice. */
    if (!ok2 || !ok3) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        wrapSetMode();
        var b = wrapSetPromptText();
        var c = wrapSetActivePanel();
        if ((b && c) || tries > 20) {
          clearInterval(iv);
        }
      }, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    /* Already past DOMContentLoaded (defer scripts run here). Run on
       the next microtask so that any other defer script that runs
       after us (alphabetic loading order, command palette, etc.) has
       finished its top-level work too. */
    setTimeout(boot, 0);
  }

  /* -------- Public test surface -------- */
  window.__pmgUndo = {
    push: push,
    undo: undo,
    redo: redo,
    clear: clear,
    canUndo: canUndo,
    canRedo: canRedo,
    getStack: function () { return stack.slice(); },
    getCursor: function () { return cursor; },
    /* For tests that want to assert the pip is up. */
    _pipId: PIP_ID
  };
})();
