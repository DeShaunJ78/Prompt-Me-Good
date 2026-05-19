/*!
 * pmg-framework-note.js (fwnote-1, 2026-05-19) — Phase 6 §8 Auto-Tune
 * inline note for the Framework selector.
 *
 * Behavior: when Auto-Tune (or any other client code) programmatically
 * selects a framework other than "auto", surface a one-shot dismissible
 * note below the Framework chip explaining why. Shown only the FIRST
 * time per session (sessionStorage.pmg_framework_note_shown), then
 * auto-dismisses after 8 seconds.
 *
 * Trigger surfaces (both supported):
 *   1. CustomEvent 'pmg:framework:auto-picked' with detail = { framework: 'rise'|'care'|'stepbystep' }
 *   2. A programmatic 'change' event on #framework where event.isTrusted === false
 *
 * Kill-switch: ?nofwnote URL flag OR localStorage.pmg_framework_note_disable='1'.
 */
(function () {
  'use strict';

  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nofwnote(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_framework_note_disable') === '1') return;
  } catch (_) {}

  var SESSION_KEY = 'pmg_framework_note_shown';
  var AUTO_DISMISS_MS = 8000;

  var COPY = {
    rise: 'We picked RISE for this — your goal looks like a multi-step task. Change it anytime.',
    care: 'We picked CARE for this — your goal looks like a writing task. Change it anytime.',
    stepbystep: 'We picked Step-by-Step for this — your goal involves a decision or logic problem. Change it anytime.'
  };

  var dismissTimer = null;

  function alreadyShown() {
    try { return window.sessionStorage && sessionStorage.getItem(SESSION_KEY) === '1'; }
    catch (_) { return false; }
  }

  function markShown() {
    try { window.sessionStorage && sessionStorage.setItem(SESSION_KEY, '1'); }
    catch (_) {}
  }

  function hide(noteEl) {
    if (!noteEl) return;
    noteEl.hidden = true;
    noteEl.textContent = '';
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  }

  function show(framework) {
    var key = String(framework || '').toLowerCase();
    if (!COPY[key]) return;
    if (alreadyShown()) return;
    var noteEl = document.getElementById('pmg-framework-autotune-note');
    if (!noteEl) return;

    noteEl.textContent = COPY[key];
    noteEl.hidden = false;
    markShown();

    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(function () { hide(noteEl); }, AUTO_DISMISS_MS);

    noteEl.addEventListener('click', function () { hide(noteEl); }, { once: true });
  }

  function onSelectChange(e) {
    if (!e || e.isTrusted) return;
    var t = e.target;
    if (!t || t.id !== 'framework') return;
    show(t.value);
  }

  function init() {
    document.addEventListener('change', onSelectChange, true);
    window.addEventListener('pmg:framework:auto-picked', function (e) {
      var detail = (e && e.detail) || {};
      show(detail.framework || detail.value);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
