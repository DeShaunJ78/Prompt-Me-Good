/* ============================================================
   pmg-next-action.js — single-glow "next best action" controller
   ------------------------------------------------------------
   ONE button glows at a time, tied to user state. Designed to
   feel guided, not gimmicky.

   Stages (monotonic; only the latest unfulfilled stage glows):
     0  idle                — no glow
     1  fix-my-prompt       — user typed >= 10 trimmed chars in #goal
                              and the prompt hasn't been finalized yet
     2  run-with-ai         — builder finalized (pmg:builder-finalized)
                              and no AI response yet
     3  run-again           — AI response received (one-shot;
                              de-glows after Run Again click)

   Photo Suite (independent override; takes priority when ready):
     -  generate-image-here — .pmg-photo-send is visible+enabled+
                              not busy AND >= 1 pill is .is-active

   Suppressed entirely while the intro tour overlay is open.
   Respects prefers-reduced-motion (CSS handles the animation).
   ============================================================ */
(function () {
  'use strict';
  if (window.__pmgNextActionInstalled) return;
  window.__pmgNextActionInstalled = true;

  var CLASS = 'pmg-next-action';
  var current = null;

  /* monotonic-ish flags */
  var state = {
    builderFinalized: false,
    aiResponded: false,
    runAgainConsumed: false
  };

  function $(id) { return document.getElementById(id); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function isVisible(el) {
    if (!el || el.hidden) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var cs = window.getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    /* climb a few ancestors for hidden/display:none parents (cheap, capped) */
    var node = el.parentElement, hops = 0;
    while (node && hops < 6) {
      if (node.hidden) return false;
      var pcs = window.getComputedStyle(node);
      if (pcs && (pcs.display === 'none' || pcs.visibility === 'hidden')) return false;
      node = node.parentElement;
      hops += 1;
    }
    return true;
  }

  function isUsable(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
    if (el.getAttribute && el.getAttribute('aria-busy') === 'true') return false;
    return isVisible(el);
  }

  function tourActive() {
    /* Two overlays exist: the intro/onboarding tour (#ob-overlay) and
       the workstation tour (#pmg-ws-tour-overlay). Both use class
       `is-open` to mean active. Suppress glow when EITHER is open. */
    var ov1 = $('ob-overlay');
    if (ov1 && ov1.classList.contains('is-open')) return true;
    var ov2 = $('pmg-ws-tour-overlay');
    if (ov2 && ov2.classList.contains('is-open')) return true;
    return false;
  }

  function meaningfulGoal() {
    var g = $('goal');
    if (!g) return false;
    return ((g.value || '').trim().length) >= 10;
  }

  /* Photo Suite: ready when send is usable AND >= 1 pill active. */
  function photoReadyTarget() {
    var send = document.querySelector('.pmg-photo-send');
    if (!isUsable(send)) return null;
    var anyActive = !!document.querySelector('.pmg-photo-pill.is-active');
    if (!anyActive) return null;
    return send;
  }

  function pickRunWithAi() {
    /* Prefer the in-page run section button; fall back to the result-top one. */
    var a = $('runBtn');
    if (isUsable(a)) return a;
    var b = $('result-top-run');
    if (isUsable(b)) return b;
    return null;
  }

  function chooseTarget() {
    if (tourActive()) return null;

    /* Photo Suite override — only when its prerequisites are met. */
    var photo = photoReadyTarget();
    if (photo) return photo;

    /* Stage 3: AI responded → glow Run Again (one-shot). */
    if (state.aiResponded && !state.runAgainConsumed) {
      var again = $('runAgainBtn');
      if (isUsable(again)) return again;
    }

    /* Stage 2: builder finalized → glow Run With AI Here. */
    if (state.builderFinalized && !state.aiResponded) {
      var run = pickRunWithAi();
      if (run) return run;
    }

    /* Stage 1: meaningful goal text → glow Fix My Prompt. */
    if (!state.builderFinalized && meaningfulGoal()) {
      var gen = $('generateBtn');
      if (isUsable(gen)) return gen;
    }

    return null;
  }

  function setGlow(next) {
    if (next === current) return;
    if (current && current.classList) current.classList.remove(CLASS);
    current = next || null;
    if (current && current.classList) current.classList.add(CLASS);
  }

  /* Recompute is the single entry point — every event handler calls it. */
  var rafId = 0;
  function recompute() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      try { setGlow(chooseTarget()); } catch (_) { /* never throw from here */ }
    });
  }

  /* ---------------- State transitions ---------------- */

  function onGoalInput() { recompute(); }

  function onBuilderFinalized() {
    state.builderFinalized = true;
    state.aiResponded = false;
    state.runAgainConsumed = false;
    recompute();
  }

  function onAiResponded() {
    if (state.aiResponded) return;
    state.aiResponded = true;
    recompute();
  }

  function bindGlowingClickConsumer() {
    /* Capture-phase listener: when the currently-glowing element is
       clicked, drop the glow immediately so it doesn't lag during
       the next state transition. The state-transition events
       (pmg:builder-finalized, AI-response observer, etc.) will
       re-glow the appropriate next element. */
    document.addEventListener('click', function (ev) {
      if (!current) return;
      var t = ev.target;
      if (!(t && t.nodeType === 1)) return;
      if (current === t || current.contains(t)) {
        if (current === $('runAgainBtn')) state.runAgainConsumed = true;
        setGlow(null);
        /* Re-evaluate after state events fire — small delay covers
           click → handler → DOM-update sequence. */
        window.setTimeout(recompute, 50);
        window.setTimeout(recompute, 400);
      }
    }, true);
  }

  /* ---------------- Observers ---------------- */

  function observeAiResponse() {
    var section = $('aiResponseSection');
    var output = $('aiResponseOutput');
    if (!section || !output) return;

    /* When the section becomes visible AND output has content, mark
       responded. We sample a couple of times to catch the streaming
       end without coupling to internal stream internals. */
    function check() {
      if (state.aiResponded) return;
      if (section.hidden) return;
      var txt = (output.textContent || '').trim();
      if (txt.length >= 8) onAiResponded();
    }

    var moSection = new MutationObserver(check);
    moSection.observe(section, { attributes: true, attributeFilter: ['hidden'] });

    var moOutput = new MutationObserver(check);
    moOutput.observe(output, { childList: true, characterData: true, subtree: true });

    /* In case the response was already complete before we attached. */
    check();
  }

  function observePhotoSuite() {
    /* Recompute on send-button disabled toggle and on pill active changes.
       The send button can be re-rendered by pmg-ux.js (T34/T94/T27 reframe
       paths). To avoid retaining detached nodes, we track the currently
       observed element and disconnect the previous observer before
       attaching a new one. */
    var moAttr = new MutationObserver(recompute);
    var observedSend = null;
    function attachSend() {
      var send = document.querySelector('.pmg-photo-send');
      if (!send) return;
      if (send === observedSend) return;
      try { moAttr.disconnect(); } catch (_) {}
      if (observedSend && observedSend.dataset) {
        try { delete observedSend.dataset.pmgNaBound; } catch (_) {}
      }
      observedSend = send;
      send.dataset.pmgNaBound = '1';
      moAttr.observe(send, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'aria-busy', 'hidden'] });
    }
    attachSend();
    /* Photo suite is rendered dynamically by pmg-ux.js; re-scan on
       broader DOM changes to bind the send button when it appears. */
    var moDom = new MutationObserver(function () {
      attachSend();
      recompute();
    });
    var suiteContainer = document.body;
    moDom.observe(suiteContainer, { childList: true, subtree: true });

    /* Pill active class changes — observe the suite root for class mutations
       on descendants. Cheap because we only care about .pmg-photo-pill. */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!(t && t.closest)) return;
      if (t.closest('.pmg-photo-pill') || t.closest('.pmg-photo-suite')) {
        window.setTimeout(recompute, 30);
      }
    }, true);
  }

  function observeTour() {
    /* Watch BOTH tour overlays (intro and workstation). Each is created
       dynamically by pmg-ux.js, so we set up a body-level child watcher
       that attaches a per-overlay class observer the moment the overlay
       appears. Idempotent via dataset flag. */
    var IDS = ['ob-overlay', 'pmg-ws-tour-overlay'];
    function attach(id) {
      var ov = $(id);
      if (!ov || ov.dataset.pmgNaTour === '1') return;
      ov.dataset.pmgNaTour = '1';
      var mo = new MutationObserver(recompute);
      mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    function attachAll() { IDS.forEach(attach); }
    attachAll();
    /* Body-level watcher to catch late-mounted overlays. Cheap because
       we only call attach() which is idempotent. */
    var bodyMo = new MutationObserver(attachAll);
    bodyMo.observe(document.body, { childList: true, subtree: false });
  }

  function observeImageMode() {
    var mo = new MutationObserver(recompute);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function observeRunSection() {
    /* Run section is unhidden when the prompt is finalized. We treat
       it as a fallback signal in case pmg:builder-finalized doesn't
       fire (e.g. external code path). */
    var section = $('runSection');
    if (!section) return;
    var mo = new MutationObserver(function () {
      if (!section.hidden && !state.builderFinalized) {
        state.builderFinalized = true;
      }
      recompute();
    });
    mo.observe(section, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ---------------- Wire-up ---------------- */

  function init() {
    var g = $('goal');
    if (g) g.addEventListener('input', onGoalInput);

    document.addEventListener('pmg:builder-finalized', onBuilderFinalized);

    bindGlowingClickConsumer();
    observeAiResponse();
    observePhotoSuite();
    observeTour();
    observeImageMode();
    observeRunSection();

    window.addEventListener('resize', recompute, { passive: true });
    window.addEventListener('load', recompute);

    /* Initial pass + a couple of deferred passes to catch async DOM. */
    recompute();
    window.setTimeout(recompute, 250);
    window.setTimeout(recompute, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Debugging hook (no functional impact). */
  window.__pmgNextAction = {
    recompute: recompute,
    state: state,
    current: function () { return current; }
  };
})();
