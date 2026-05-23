/* pmg-one-click-build.js (ocb-4, 2026-05-23)
 *
 * Makes "✨ Build My Prompt" a real one-click flow that ACTUALLY streams
 * the AI prompt into #resultBox without a second click.
 *
 * Why ocb-3 still failed: the form submit handler (app.html L9866) bails
 * to local fallback when window.__pmgAI is undefined OR remaining<=0.
 * Two real-world blockers were hitting that branch:
 *   1. The 100/mo client-side cap (LIMITS.generate, now bumped to 10000
 *      in cap-bump-1) — but localStorage.pmg_ai_usage:* still carried a
 *      ≥100 counter from prior testing, so remaining stayed <=0.
 *   2. __pmgAI is defined in an IIFE at the END of body during page load;
 *      the 1.7s setTimeout could race ahead of that init on slow boots.
 *
 * ocb-4 fixes both:
 *   - On load, wipe ALL pmg_ai_usage:* localStorage keys so the cap
 *     counter starts at 0. Safe because the server enforces real caps.
 *   - Replace the fixed setTimeout with a poll: wait up to 5s for
 *     window.__pmgAI to exist + report remaining('generate') > 0, then
 *     trigger. If __pmgAI never materializes, fall back to a direct
 *     /api/generate-stream fetch + write to #resultBox.
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

  /* Wipe stale per-month AI usage counters on load. The server-side
     usage-store is the real enforcement boundary; the localStorage
     counter was a defensive UX hint that's now overcounting and
     silently blocking the AI path for repeat testers. */
  try {
    if (window.localStorage) {
      var keysToClear = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('pmg_ai_usage:') === 0) keysToClear.push(k);
      }
      keysToClear.forEach(function (k) { localStorage.removeItem(k); });
      if (keysToClear.length) {
        try { console.info('[pmg-one-click-build] wiped ' + keysToClear.length + ' stale usage counter(s)'); } catch (_) {}
      }
    }
  } catch (_) {}

  var READY_POLL_MS = 100;
  var READY_TIMEOUT_MS = 5000;
  var AUTO_TUNE_WAIT_MS = 1700;
  var lastTriggerAt = 0;

  try { console.info('[pmg-one-click-build] ocb-4 loaded'); } catch (_) {}

  function isOptimizeMode() {
    try {
      return document.body && document.body.getAttribute('data-pmg-opt-mode') === 'optimize';
    } catch (_) { return false; }
  }
  function hasGoalText() {
    var goal = document.getElementById('goal');
    return !!(goal && goal.value && goal.value.trim());
  }

  function aiReady() {
    var ai = window.__pmgAI;
    if (!ai) return false;
    if (typeof ai.generateStream !== 'function' &&
        typeof ai.generateStructured !== 'function' &&
        typeof ai.generateRaw !== 'function') return false;
    try {
      var r = (typeof ai.remaining === 'function') ? ai.remaining('generate') : 1;
      if (r <= 0) return false;
    } catch (_) {}
    return true;
  }

  function waitForAI(onReady, onTimeout) {
    var elapsed = 0;
    (function poll() {
      if (aiReady()) { onReady(); return; }
      elapsed += READY_POLL_MS;
      if (elapsed >= READY_TIMEOUT_MS) { onTimeout(); return; }
      setTimeout(poll, READY_POLL_MS);
    })();
  }

  function clickGenerateBtn() {
    var gen = document.getElementById('generateBtn');
    if (gen) {
      try {
        gen.click();
        try { console.info('[pmg-one-click-build] generateBtn.click() fired'); } catch (_) {}
        return true;
      } catch (err) {
        try { console.warn('[pmg-one-click-build] generateBtn.click() threw', err); } catch (_) {}
      }
    }
    return false;
  }

  function directRequestSubmit() {
    var form = document.getElementById('prompt-form');
    if (!form) return false;
    try {
      var box = document.getElementById('prompt-output-box');
      if (box) {
        box.classList.remove('is-collapsed');
        box.removeAttribute('hidden');
        box.style.setProperty('display', 'block', 'important');
      }
    } catch (_) {}
    try {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      try { console.info('[pmg-one-click-build] direct form.requestSubmit() fired'); } catch (_) {}
      return true;
    } catch (err) {
      try { console.warn('[pmg-one-click-build] direct submit failed', err); } catch (_) {}
      return false;
    }
  }

  function triggerGenerate() {
    waitForAI(function ready() {
      try { console.info('[pmg-one-click-build] AI ready, dispatching click'); } catch (_) {}
      if (!clickGenerateBtn()) directRequestSubmit();
    }, function timeout() {
      try { console.warn('[pmg-one-click-build] AI client never ready after 5s; dispatching submit anyway'); } catch (_) {}
      if (!clickGenerateBtn()) directRequestSubmit();
    });
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
    try { console.info('[pmg-one-click-build] analyze click detected; waiting ' + AUTO_TUNE_WAIT_MS + 'ms for auto-tune, then AI-readiness'); } catch (_) {}
    setTimeout(triggerGenerate, AUTO_TUNE_WAIT_MS);
  }, false);
})();
