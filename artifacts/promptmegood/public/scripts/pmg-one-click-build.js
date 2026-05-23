/* pmg-one-click-build.js (ocb-2, 2026-05-23)
 *
 * Makes "✨ Build My Prompt" a real one-click flow.
 *
 * Chassis-v3 wires #analyze-btn to: open tuning panel + fire /api/auto-tune.
 * The actual /api/generate-stream call lives behind #generateBtn → form.requestSubmit().
 * This script bridges the two: after analyze fires, wait briefly for auto-tune to
 * settle, then directly invoke form.requestSubmit() — bypassing #generateBtn
 * entirely so we are immune to chassis-v3 re-parenting / handler-rebinding races.
 *
 * Build-mode only. Optimize mode is intercepted in capture phase by
 * pmg-optimize-toggle.js (stopImmediatePropagation) so this bubble listener never
 * sees those clicks. Empty-goal clicks also fall through to chassis-v3's "Add a
 * clear goal first" path.
 *
 * Kill switches:
 *   ?nooneclick   |   localStorage.pmg_one_click_build_disable = '1'
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  try {
    var qs = (location && location.search) || '';
    if (/[?&]nooneclick(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_one_click_build_disable') === '1') return;
  } catch (_) {}

  /* Auto-tune in production typically completes in ~1s (see api-server logs).
     1700ms gives it room to apply tuning before we submit. */
  var GENERATE_DELAY_MS = 1700;

  var lastTriggerAt = 0;

  try { console.info('[pmg-one-click-build] ocb-2 loaded'); } catch (_) {}

  function isOptimizeMode() {
    try {
      return document.body && document.body.getAttribute('data-pmg-opt-mode') === 'optimize';
    } catch (_) { return false; }
  }

  function hasGoalText() {
    var goal = document.getElementById('goal');
    return !!(goal && goal.value && goal.value.trim());
  }

  /* Mirrors what chassis-v3's #generateBtn click handler does (pmg-chassis-v3.js
     L1087-L1126): reveal #prompt-output-box, unhide #run-with-ai-btn, then call
     form.requestSubmit(). We do this directly because some environments have
     left #generateBtn in a state where .click() doesn't reach the chassis
     handler (re-parented, cloned, or intercepted). */
  function triggerGenerate() {
    var form = document.getElementById('prompt-form');
    if (!form) {
      try { console.warn('[pmg-one-click-build] no #prompt-form found'); } catch (_) {}
      return false;
    }
    try {
      var box = document.getElementById('prompt-output-box');
      if (box) {
        box.classList.remove('is-collapsed');
        box.removeAttribute('hidden');
        box.style.setProperty('display', 'block', 'important');
      }
      var rwa = document.getElementById('run-with-ai-btn');
      if (rwa) {
        rwa.style.setProperty('display', 'block', 'important');
        rwa.removeAttribute('hidden');
      }
    } catch (_) {}
    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      try { console.info('[pmg-one-click-build] form.requestSubmit() fired'); } catch (_) {}
      return true;
    } catch (err) {
      try { console.warn('[pmg-one-click-build] submit failed', err); } catch (_) {}
      return false;
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    var hit = t.closest('#analyze-btn, .btn-analyze');
    if (!hit) return;
    if (isOptimizeMode()) return;
    if (!hasGoalText()) return;
    var now = Date.now();
    if (now - lastTriggerAt < 2500) return;
    lastTriggerAt = now;
    try { console.info('[pmg-one-click-build] analyze click detected, generate in ' + GENERATE_DELAY_MS + 'ms'); } catch (_) {}
    setTimeout(triggerGenerate, GENERATE_DELAY_MS);
  }, false);
})();
