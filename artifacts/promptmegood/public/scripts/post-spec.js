(function () {
  'use strict';

  var FLAG_KEY = 'pmg.firstGenerated';
  var BODY_PRE_GEN_CLASS = 'pmg-pre-gen';
  var BODY_STICKY_CLASS = 'has-mobile-sticky';
  var STICKY_DISMISS_KEY = 'pmg.mobileStickyDismissed';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function isFirstGenDone() {
    return !!safeGet(FLAG_KEY);
  }

  function applyPreGenClass() {
    if (!document.body) return;
    if (isFirstGenDone()) {
      document.body.classList.remove(BODY_PRE_GEN_CLASS);
    } else {
      document.body.classList.add(BODY_PRE_GEN_CLASS);
    }
  }

  function markFirstGen() {
    if (isFirstGenDone()) return false;
    safeSet(FLAG_KEY, String(Date.now()));
    if (document.body) document.body.classList.remove(BODY_PRE_GEN_CLASS);
    return true;
  }

  function onFirstGenSuccess() {
    var firstTime = markFirstGen();
    if (!firstTime) return;
    if (typeof window.showNudgeIfDue === 'function') {
      window.setTimeout(function () {
        try { window.showNudgeIfDue(); } catch (e) {}
      }, 1500);
    }
  }

  function watchOutputForGeneration() {
    var run = document.getElementById('runSection');
    var strength = document.getElementById('strength-score');
    if (run && !run.hidden) onFirstGenSuccess();
    if (strength && !strength.hidden) onFirstGenSuccess();

    if (!('MutationObserver' in window)) return;

    function makeObserver(el) {
      if (!el) return;
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].attributeName === 'hidden' && !el.hidden) {
            onFirstGenSuccess();
            break;
          }
        }
      });
      obs.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    }

    makeObserver(run);
    makeObserver(strength);
  }

  function initStickyBar() {
    var bar = document.getElementById('mobile-sticky-bar');
    if (!bar) return;

    var dismiss = document.getElementById('mobile-sticky-dismiss');
    var input = document.getElementById('mobile-sticky-input');
    var btn = document.getElementById('mobile-sticky-btn');

    var dismissedThisSession = false;
    try { dismissedThisSession = !!sessionStorage.getItem(STICKY_DISMISS_KEY); } catch (e) {}

    if (dismissedThisSession) {
      bar.hidden = true;
      document.body.classList.remove(BODY_STICKY_CLASS);
      return;
    }

    bar.hidden = false;
    document.body.classList.add(BODY_STICKY_CLASS);

    if (dismiss) {
      dismiss.addEventListener('click', function () {
        bar.hidden = true;
        document.body.classList.remove(BODY_STICKY_CLASS);
        try { sessionStorage.setItem(STICKY_DISMISS_KEY, '1'); } catch (e) {}
      });
    }

    function jumpToBuilder() {
      var goal = document.getElementById('goal');
      var builder = document.getElementById('builder');
      if (input && input.value && goal) {
        goal.value = input.value;
        try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      }
      if (builder && builder.scrollIntoView) {
        builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      window.setTimeout(function () {
        if (goal && typeof goal.focus === 'function') {
          try { goal.focus({ preventScroll: false }); } catch (e) { goal.focus(); }
        }
      }, 650);
    }

    if (btn) btn.addEventListener('click', jumpToBuilder);
    if (input) {
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          jumpToBuilder();
        }
      });
    }
  }

  function initExpertLink() {
    var link = document.getElementById('expert-mode-link');
    var checkbox = document.getElementById('expert-mode-toggle');
    if (!link || !checkbox) return;

    function updateLabel() {
      link.textContent = checkbox.checked
        ? 'Switch to Standard Mode \u2192'
        : 'Switch to Expert Mode \u2192';
    }

    updateLabel();

    link.addEventListener('click', function (ev) {
      ev.preventDefault();
      checkbox.checked = !checkbox.checked;
      try {
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
      updateLabel();
    });

    checkbox.addEventListener('change', updateLabel);
  }

  function initAutoOptimizeMirror() {
    var src = document.getElementById('auto-optimize-toggle');
    var mirror = document.getElementById('auto-optimize-toggle-mirror');
    if (!src || !mirror) return;

    var syncing = false;
    function syncFromSrc() {
      if (syncing) return;
      syncing = true;
      mirror.checked = src.checked;
      syncing = false;
    }
    function syncFromMirror() {
      if (syncing) return;
      syncing = true;
      if (src.checked !== mirror.checked) {
        src.checked = mirror.checked;
        try { src.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      }
      syncing = false;
    }
    syncFromSrc();
    src.addEventListener('change', syncFromSrc);
    mirror.addEventListener('change', syncFromMirror);
  }

  function init() {
    applyPreGenClass();
    watchOutputForGeneration();
    initStickyBar();
    initExpertLink();
    initAutoOptimizeMirror();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
