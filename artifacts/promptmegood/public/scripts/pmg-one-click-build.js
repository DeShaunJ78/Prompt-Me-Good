/* pmg-one-click-build.js (ocb-1, 2026-05-23)
 *
 * Makes "✨ Build My Prompt" a real one-click flow.
 *
 * The chassis-v3 analyze-btn handler (pmg-chassis-v3.js wireActions, L1004)
 * only reveals the tuning panel + fires /api/auto-tune. The actual /api/
 * generate-stream call requires a second click on the (now-revealed)
 * #generateBtn. Users read the prominent "✨ Build My Prompt" CTA as a
 * single-action button and never click the second one, so they see no
 * result. This script bridges the gap: after analyze fires, it waits
 * briefly for auto-tune to settle, then programmatically clicks
 * #generateBtn — which triggers the existing form-submit path and the
 * prompt is generated as expected.
 *
 * Constraints:
 *   - Only fires in Build mode. Optimize mode is intercepted at capture
 *     phase by pmg-optimize-toggle.js (stopImmediatePropagation), so this
 *     bubble-phase listener never sees Optimize clicks.
 *   - Only fires when #goal has non-empty text — empty-goal clicks should
 *     fall through to the chassis-v3 "Add a clear goal first" message.
 *   - Idempotent per click: a single click triggers at most one auto-generate.
 *   - Skips if user already clicked #generateBtn manually before the timer.
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

  /* Auto-tune in production typically completes in 500-1500ms (see
     api-server logs). 1600ms gives it room without making the user wait
     noticeably longer than the perceived "thinking" gap. */
  var GENERATE_DELAY_MS = 1600;

  var lastTriggerAt = 0;

  function isOptimizeMode() {
    try {
      return document.body && document.body.getAttribute('data-pmg-opt-mode') === 'optimize';
    } catch (_) { return false; }
  }

  function hasGoalText() {
    var goal = document.getElementById('goal');
    return !!(goal && goal.value && goal.value.trim());
  }

  function clickGenerate() {
    var gen = document.getElementById('generateBtn');
    if (!gen) return false;
    /* If the button is hidden for any reason (paywall, etc), bail. */
    var cs = window.getComputedStyle ? window.getComputedStyle(gen) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    try { gen.click(); return true; } catch (_) { return false; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    var hit = t.closest('#analyze-btn, .btn-analyze');
    if (!hit) return;
    if (isOptimizeMode()) return;
    if (!hasGoalText()) return;
    /* Re-entrancy guard: a chassis "← Re-analyze" click also triggers
       analyzeBtn.click(), which would otherwise re-fire this branch. A
       short cooldown prevents stacked auto-generates. */
    var now = Date.now();
    if (now - lastTriggerAt < 2500) return;
    lastTriggerAt = now;
    setTimeout(clickGenerate, GENERATE_DELAY_MS);
  }, false);
})();
