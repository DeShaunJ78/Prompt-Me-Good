/* pmg-fullscreen.js — reusable fullscreen reader/editor for prompts & responses.
   API:
     window.pmgFullscreen.open(targetEl, { title, editable })
     window.pmgFullscreen.bind(buttonEl, targetIdOrEl, { title, editable })
   Auto-binds buttons with [data-pmg-fullscreen-target="<id>"].
   Kill switch: ?fullscreen=0 OR localStorage.pmg_fullscreen_disable='1'. */
(function () {
  'use strict';

  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('fullscreen') === '0') return;
    if (localStorage.getItem('pmg_fullscreen_disable') === '1') return;
  } catch (e) { /* ignore */ }

  var overlay = null;
  var titleEl = null;
  var bodyEl = null;
  var closeBtn = null;
  var currentTarget = null;
  var currentMode = null; // 'textarea' | 'contenteditable' | 'readonly'
  var currentEditableEl = null;
  var lastFocus = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pmg-fs-overlay';
    overlay.className = 'pmg-fs-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('data-pmg-overlay-root', '1');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="pmg-fs-header">' +
        '<h2 class="pmg-fs-title" id="pmg-fs-title">Fullscreen View</h2>' +
        '<button type="button" class="pmg-fs-close" id="pmg-fs-close-btn" aria-label="Collapse and return">Collapse \u25B4</button>' +
      '</div>' +
      '<div class="pmg-fs-body"><div class="pmg-fs-body-inner" id="pmg-fs-body"></div></div>';
    document.body.appendChild(overlay);
    titleEl = overlay.querySelector('#pmg-fs-title');
    bodyEl = overlay.querySelector('#pmg-fs-body');
    closeBtn = overlay.querySelector('#pmg-fs-close-btn');
    closeBtn.addEventListener('click', close);
    overlay.setAttribute('aria-labelledby', 'pmg-fs-title');
    return overlay;
  }

  function detectMode(el, opts) {
    if (opts && opts.editable === false) return 'readonly';
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return 'textarea';
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return 'contenteditable';
    return 'readonly';
  }

  function open(target, opts) {
    if (!target) return;
    opts = opts || {};
    ensureOverlay();
    currentTarget = target;
    currentMode = detectMode(target, opts);
    lastFocus = document.activeElement;

    titleEl.textContent = opts.title || 'Fullscreen View';
    bodyEl.innerHTML = '';

    if (currentMode === 'textarea') {
      var ta = document.createElement('textarea');
      ta.className = 'pmg-fs-textarea';
      ta.value = target.value || '';
      ta.setAttribute('aria-label', opts.title || 'Editable content');
      bodyEl.appendChild(ta);
      currentEditableEl = ta;
      // live sync so other listeners on the original see updates
      ta.addEventListener('input', function () {
        target.value = ta.value;
        try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      });
    } else if (currentMode === 'contenteditable') {
      var div = document.createElement('div');
      div.className = 'pmg-fs-content';
      div.setAttribute('contenteditable', 'true');
      div.setAttribute('spellcheck', 'true');
      div.innerHTML = target.innerHTML || '';
      bodyEl.appendChild(div);
      currentEditableEl = div;
      div.addEventListener('input', function () {
        target.innerHTML = div.innerHTML;
        try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      });
    } else {
      var view = document.createElement('div');
      view.className = 'pmg-fs-content';
      view.innerHTML = target.innerHTML || target.textContent || '';
      bodyEl.appendChild(view);
      currentEditableEl = null;
    }

    overlay.hidden = false;
    document.body.classList.add('pmg-fs-open');
    document.addEventListener('keydown', onKey);
    setTimeout(function () {
      if (currentEditableEl) {
        try { currentEditableEl.focus(); } catch (e) {}
      } else if (closeBtn) {
        try { closeBtn.focus(); } catch (e) {}
      }
    }, 50);
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('pmg-fs-open');
    document.removeEventListener('keydown', onKey);
    bodyEl.innerHTML = '';
    var t = currentTarget;
    currentTarget = null;
    currentEditableEl = null;
    currentMode = null;
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (e) {}
    } else if (t && typeof t.focus === 'function') {
      try { t.focus(); } catch (e) {}
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function bind(btn, targetIdOrEl, opts) {
    if (!btn) return;
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      var target = typeof targetIdOrEl === 'string'
        ? document.getElementById(targetIdOrEl)
        : targetIdOrEl;
      if (target) open(target, opts);
    });
  }

  function autoBind(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-pmg-fullscreen-target]');
    nodes.forEach(function (btn) {
      if (btn.__pmgFsBound) return;
      btn.__pmgFsBound = true;
      var id = btn.getAttribute('data-pmg-fullscreen-target');
      var title = btn.getAttribute('data-pmg-fullscreen-title') || undefined;
      var editable = btn.getAttribute('data-pmg-fullscreen-editable');
      bind(btn, id, {
        title: title,
        editable: editable === 'false' ? false : undefined
      });
    });
  }

  // Inject a floating "Open Fullscreen" pill INTO .pmgv3-output-host so the
  // trigger lives on the prompt box itself (the original #resultBoxToggle
  // sibling stays hidden by chassis-v3 universal hide rule).
  function injectInlineTrigger() {
    var host = document.querySelector('.pmgv3-output-host');
    if (!host || host.querySelector('.pmg-fs-inline-trigger')) return;
    var rb = document.getElementById('resultBox');
    if (!rb) return;
    if (host.style.position !== 'absolute' && host.style.position !== 'fixed') {
      host.style.position = 'relative';
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-fs-inline-trigger';
    btn.setAttribute('aria-label', 'Read full prompt in distraction-free view');
    btn.title = 'Read full prompt (ESC to close)';
    btn.innerHTML = 'Read full prompt \u2197';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      open(rb, { title: 'Your Generated Prompt' });
    });
    host.appendChild(btn);
  }

  /* ai-fs-trigger-1 (2026-05-17): mirror injectInlineTrigger() for the
     Run-With-AI response box. The streamed GPT response lives in
     #aiResponseOutput inside #aiResponseSection (mounted into
     .pmgv3-air-host by chassis-v3). Anchor an "Expand response" pill on
     the section so users can pop long AI replies into the same
     distraction-free overlay used by the prompt box. */
  function injectAiResponseTrigger() {
    var section = document.getElementById('aiResponseSection');
    if (!section || section.querySelector('.pmg-fs-inline-trigger.pmg-fs-air-trigger')) return;
    var out = document.getElementById('aiResponseOutput');
    if (!out) return;
    var pos = section.style.position;
    if (pos !== 'absolute' && pos !== 'fixed' && pos !== 'relative') {
      section.style.position = 'relative';
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-fs-inline-trigger pmg-fs-air-trigger';
    btn.setAttribute('aria-label', 'Expand AI response in distraction-free view');
    btn.title = 'Expand response (ESC to close)';
    /* air-icon-1 (2026-05-17): user feedback "the expand response pill
       is huge and competes with the changes overlay". Shrunk to an
       icon-only fullscreen glyph so it never visually clashes with the
       green diff bar that also lives at the top of the response card. */
    btn.innerHTML = '\u26F6';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      open(out, { title: 'AI Response', editable: false });
    });
    section.appendChild(btn);
  }

  function injectAllTriggers() {
    injectInlineTrigger();
    injectAiResponseTrigger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { autoBind(); injectAllTriggers(); });
  } else {
    autoBind();
    injectAllTriggers();
  }

  // Re-scan when DOM changes (visual studio panels mount async).
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () { autoBind(); injectAllTriggers(); });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  window.pmgFullscreen = {
    open: open,
    close: close,
    bind: bind,
    autoBind: autoBind
  };
})();
