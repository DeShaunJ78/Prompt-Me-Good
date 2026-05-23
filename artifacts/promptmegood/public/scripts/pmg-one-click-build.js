/* pmg-one-click-build.js (ocb-3, 2026-05-23)
 *
 * Makes "✨ Build My Prompt" a real one-click flow.
 *
 * Chassis-v3 wires #analyze-btn to: open tuning panel + fire /api/auto-tune.
 * The actual generate path lives behind #generateBtn — whose click handler
 * (pmg-chassis-v3.js L1087-L1126) reveals #prompt-output-box, unhides the
 * Run-with-AI button, then fires form.requestSubmit(). After analyze fires,
 * we wait briefly for auto-tune to settle, then synthesize a click on
 * #generateBtn so chassis-v3 does the full reveal+submit dance — no second
 * user click required.
 *
 * IMPORTANT: do NOT bail when #generateBtn is display:none. .click()
 * dispatches to bound handlers regardless of visibility, and the chassis-v3
 * handler's first job is to reveal the output box. Bailing on visibility
 * was the ocb-1 bug.
 *
 * Build-mode only. Optimize mode is intercepted in capture phase by
 * pmg-optimize-toggle.js (stopImmediatePropagation) so this bubble listener
 * never sees those clicks. Empty-goal clicks fall through to chassis-v3's
 * "Add a clear goal first" path.
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

  try { console.info('[pmg-one-click-build] ocb-3 loaded'); } catch (_) {}

  function isOptimizeMode() {
    try {
      return document.body && document.body.getAttribute('data-pmg-opt-mode') === 'optimize';
    } catch (_) { return false; }
  }

  function hasGoalText() {
    var goal = document.getElementById('goal');
    return !!(goal && goal.value && goal.value.trim());
  }

  /* Synthesize a click on #generateBtn. Chassis-v3's bound handler will:
     1) e.preventDefault() the native submit
     2) reveal #prompt-output-box (display:block !important)
     3) reveal #run-with-ai-btn
     4) form.requestSubmit() — which fires the app.html L9766 submit handler
        that builds the prompt + streams from /api/generate-stream
     5) mirror strength score
     We do NOT check display:none — .click() dispatches to bound handlers
     regardless of visibility, and the handler's own first step is to reveal. */
  function triggerGenerate() {
    var gen = document.getElementById('generateBtn');
    if (gen) {
      try {
        gen.click();
        try { console.info('[pmg-one-click-build] generateBtn.click() fired'); } catch (_) {}
        return true;
      } catch (err) {
        try { console.warn('[pmg-one-click-build] generateBtn.click() threw, falling back', err); } catch (_) {}
      }
    }
    /* Fallback path: chassis handler didn't bind or btn missing. Replicate
       the reveal+submit ourselves so the user still sees output. */
    var form = document.getElementById('prompt-form');
    if (!form) {
      try { console.warn('[pmg-one-click-build] no #generateBtn and no #prompt-form'); } catch (_) {}
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
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      try { console.info('[pmg-one-click-build] fallback form.requestSubmit() fired'); } catch (_) {}
      return true;
    } catch (err) {
      try { console.warn('[pmg-one-click-build] fallback submit failed', err); } catch (_) {}
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
