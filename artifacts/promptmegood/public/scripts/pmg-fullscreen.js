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

  /* corner-pill-restore-1 (2026-05-18): user feedback reversed —
       "Restore expand on Text panel. Make it identical to the AI
        response box for uniformity throughout the site."
     The May 17 corner-pill removal (corner-pill-retire-1) left only
     the in-flow text-link toggles, which the user found insufficiently
     discoverable. We restore the floating corner triggers on BOTH the
     prompt box (#resultBox) and the AI response box (#aiResponseOutput)
     using the SAME icon-only 28x28 .pmg-fs-air-trigger variant so they
     are visually identical. The Photography (#pmg-vs-image-refined) and
     Video (#pmg-vs-video-refined) panels already ship their own
     .pmg-fs-trigger "Expand Fullscreen" buttons in an actions row
     (see pmg-visual-studio.js:324, :518) — same overlay, same UX.
     Text-link toggles (#resultBoxToggle, #aiResponseToggle) are
     preserved as a complementary "Show Full / Collapse" expand-in-place
     affordance and do not conflict. */
  function ensureRelative(el) {
    if (!el) return;
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (cs && cs.position === 'static') {
      el.style.position = 'relative';
    }
  }

  /* orphan-sweep-1 (2026-05-18): chassis-v3 reparents #resultBox and
     #aiResponseOutput into chassis hosts AFTER this script's first
     pass. The original parents kept stale corner triggers, and the
     MutationObserver would inject fresh ones into the new parents —
     leaving DUPLICATE buttons. The orphan still "fires" (closure
     captures the live element) but sits in a stale container with
     stale chassis CSS (position:absolute instead of in-flow static),
     producing the "I click and nothing happens" report. Fix: scope
     dedup checks to the document, and on every pass remove any
     trigger whose parentNode is not the live target's current parent. */
  function injectTriggerFor(targetId, opts) {
    var target = document.getElementById(targetId);
    if (!target || !target.parentNode) return;
    var sel = '.pmg-fs-inline-trigger[data-pmg-fs-for="' + targetId + '"]';
    var existing = document.querySelectorAll(sel);
    var liveParent = target.parentNode;
    var keptInLive = false;
    for (var i = 0; i < existing.length; i++) {
      var node = existing[i];
      if (node.parentNode === liveParent && !keptInLive) {
        keptInLive = true; // first live-parent button wins
      } else {
        // orphan in stale parent OR duplicate in live parent — remove
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    }
    if (keptInLive) return;
    ensureRelative(liveParent);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-fs-inline-trigger pmg-fs-air-trigger';
    btn.setAttribute('data-pmg-fs-for', targetId);
    btn.setAttribute('aria-label', opts.aria);
    btn.setAttribute('title', 'Expand to fullscreen');
    btn.textContent = '\uD83D\uDD0D';
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      // re-resolve live target at click time so reparenting after
      // injection doesn't break the call.
      var live = document.getElementById(targetId) || target;
      open(live, { title: opts.title });
    });
    liveParent.appendChild(btn);
  }

  function injectInlineTrigger() {
    injectTriggerFor('resultBox', {
      aria: 'Expand prompt to fullscreen',
      title: 'Generated Prompt'
    });
  }

  function injectAiResponseTrigger() {
    injectTriggerFor('aiResponseOutput', {
      aria: 'Expand AI response to fullscreen',
      title: 'AI Response'
    });
  }

  function injectAllTriggers() {
    try { injectInlineTrigger(); } catch (_e) {}
    try { injectAiResponseTrigger(); } catch (_e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { autoBind(); injectAllTriggers(); });
  } else {
    autoBind();
    injectAllTriggers();
  }

  // Re-scan when DOM changes (visual studio panels mount async).
  // mo-debounce-1 (2026-05-18): the observer fires on every subtree
  // mutation — including our own button appends. The querySelector
  // guard prevents loops but each tick still runs DOM lookups for
  // every trigger. 50ms debounce keeps catch-up behavior without
  // hammering the DOM during streaming output writes.
  if ('MutationObserver' in window) {
    var _moTimer = null;
    var mo = new MutationObserver(function () {
      if (_moTimer) return;
      _moTimer = setTimeout(function () {
        _moTimer = null;
        autoBind();
        injectAllTriggers();
      }, 50);
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  window.pmgFullscreen = {
    open: open,
    close: close,
    bind: bind,
    autoBind: autoBind
  };
})();
