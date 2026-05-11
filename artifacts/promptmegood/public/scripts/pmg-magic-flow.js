/* pmg-magic-flow.js (mf-1)
   ------------------------------------------------------------------
   One-Click Magic Flow: turns the existing two-step Build → Generate
   into a single click that auto-bridges through Auto-Tune to a final
   prompt without making the user read two CTAs.

   What it does on a click of #analyze-btn ("✨ Build My Prompt"):
     1. Snapshots the original label (capture phase, before the chassis
        bubble handler runs and sets style.display='none').
     2. Adds body.pmg-magic-active which:
          - keeps the Build button visible despite the inline
            display:none the chassis applies
          - suppresses the "✓ Ready" badge and "← Re-analyze" link the
            chassis injects after analyze (they reappear once the flow
            ends so power-user re-analyze still works)
     3. Shows a thin top-of-viewport progress bar (theme tokens, NOT
        hardcoded teal — uses var(--color-primary, #3ee0a0)).
     4. Swaps the button label "✨ Build My Prompt" → "✨ Tuning your
        idea…" while the chassis Auto-Tune fetch runs.
     5. After AUTO_TUNE_CAP_MS (3.5s), fires #generateBtn.click() and
        swaps the label to "✨ Generating your prompt…". The cap
        intentionally does NOT wait for /api/auto-tune to resolve — the
        chassis writes picks asynchronously and the form submit reads
        whatever the selects say at submit time. 3.5s is the empirical
        upper bound from production logs for that endpoint at p95.
     6. Watches body class for `pmg-has-result` (the canonical "result
        landed" signal app.html sets when /api/generate returns). On
        completion: removes body class, hides progress bar, restores
        original label.

   Safety:
     - 30s hard timeout ends the flow even if generation hangs.
     - Re-clicking analyze-btn while active no-ops (state.active guard).
     - Idea < 4 chars: no-op, lets normal validation flow run.
     - Capture-phase listener does NOT preventDefault — the chassis
       handler still does its full job (Auto-Tune, reveal tuning panel,
       scroll, etc). We're an additive overlay, not a replacement.

   Kill switches (standard):
     - URL: ?nomagic
     - Per-device: localStorage.pmg_magic_disable = '1'

   API: window.pmgMagicFlow.{ end, isActive }
*/
(function () {
  'use strict';
  if (window.__pmgMagicFlowLoaded) return;
  window.__pmgMagicFlowLoaded = true;

  try {
    var loc = (window.location && window.location.search) || '';
    if (/[?&]nomagic\b/.test(loc)) return;
    if (localStorage.getItem('pmg_magic_disable') === '1') return;
  } catch (e) {}

  var TUNING_LABEL = '✨ Tuning your idea…';
  var GENERATING_LABEL = '✨ Generating your prompt…';
  var AUTO_TUNE_CAP_MS = 3500;
  var GENERATE_TIMEOUT_MS = 30000;
  var STYLE_ID = 'pmg-magic-flow-style';
  var BAR_ID = 'pmg-magic-progress';

  var state = {
    active: false,
    originalText: null,
    tuneTimer: null,
    completionObserver: null,
    completionTimer: null,
    progressBar: null
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + BAR_ID + ' {',
      '  position: fixed; top: 0; left: 0; right: 0; height: 3px;',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 8%, transparent);',
      '  z-index: 99999; pointer-events: none;',
      '  opacity: 0; transition: opacity .2s ease;',
      '}',
      '#' + BAR_ID + '.is-active { opacity: 1; }',
      '#' + BAR_ID + '::after {',
      '  content: ""; display: block; height: 100%; width: 35%;',
      '  background: linear-gradient(90deg,',
      '    transparent 0%,',
      '    var(--color-primary, #3ee0a0) 50%,',
      '    transparent 100%);',
      '  box-shadow: 0 0 12px color-mix(in srgb, var(--color-primary, #3ee0a0) 65%, transparent);',
      '  animation: pmgMagicSlide 1.4s linear infinite;',
      '}',
      '@keyframes pmgMagicSlide {',
      '  0% { transform: translateX(-100%); }',
      '  100% { transform: translateX(385%); }',
      '}',
      /* Suppress the Ready badge and Re-analyze link while the magic
         flow is bridging — both are noise during a one-click run. They
         reappear after the flow ends, so power users can still
         re-analyze the next time around. */
      'body.pmg-magic-active #pmgv3-reanalyze,',
      'body.pmg-magic-active #pmgv3-ready-label { display: none !important; }',
      /* The chassis sets inline style.display="none" on #analyze-btn
         after analyze. Keep it visible during the magic bridge so we
         can swap its label to "Tuning…" / "Generating…". Inline
         display:none has lower specificity than this !important rule
         (the chassis does NOT use !important inline). */
      'body.pmg-magic-active #analyze-btn { display: block !important; }',
      /* Subtle visual cue: dim the button slightly while we own it. */
      'body.pmg-magic-active #analyze-btn {',
      '  cursor: progress;',
      '  opacity: 0.92;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ensureProgressBar() {
    if (state.progressBar && document.body.contains(state.progressBar)) {
      return state.progressBar;
    }
    var bar = document.createElement('div');
    bar.id = BAR_ID;
    /* data-pmg-overlay-root: the chassis universal-hide rule erases
       any body-level element without this marker. Without it, the
       progress bar would vanish on chassis init. */
    bar.setAttribute('data-pmg-overlay-root', '1');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Building your prompt');
    document.body.appendChild(bar);
    state.progressBar = bar;
    return bar;
  }

  function showProgress() {
    var bar = ensureProgressBar();
    requestAnimationFrame(function () { bar.classList.add('is-active'); });
  }

  function hideProgress() {
    if (state.progressBar) state.progressBar.classList.remove('is-active');
  }

  function setBtnLabel(btn, txt) {
    if (btn) btn.textContent = txt;
  }

  function getGoalText() {
    var g = document.getElementById('goal');
    return g && g.value ? String(g.value).trim() : '';
  }

  function fireGenerate() {
    var genBtn = document.getElementById('generateBtn');
    if (genBtn) {
      try { genBtn.click(); return true; } catch (e) {}
    }
    var form = document.getElementById('prompt-form');
    if (form && typeof form.requestSubmit === 'function') {
      try { form.requestSubmit(); return true; } catch (e) {}
    }
    return false;
  }

  function endFlow() {
    if (state.tuneTimer) { clearTimeout(state.tuneTimer); state.tuneTimer = null; }
    if (state.completionTimer) { clearTimeout(state.completionTimer); state.completionTimer = null; }
    if (state.completionObserver) {
      try { state.completionObserver.disconnect(); } catch (e) {}
      state.completionObserver = null;
    }
    document.body.classList.remove('pmg-magic-active');
    hideProgress();
    var btn = document.getElementById('analyze-btn');
    if (btn && state.originalText) setBtnLabel(btn, state.originalText);
    state.active = false;
  }

  function watchForCompletion() {
    /* If the result already landed (rare race), end immediately. */
    if (document.body.classList.contains('pmg-has-result')) {
      setTimeout(endFlow, 250);
      return;
    }
    var mo = new MutationObserver(function () {
      if (document.body.classList.contains('pmg-has-result')) {
        /* Brief delay so the user sees the "Generating…" label hand off
           gracefully rather than blinking. */
        setTimeout(endFlow, 250);
      }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    state.completionObserver = mo;
    /* Hard ceiling: even if /api/generate hangs or errors silently,
       the flow ends after 30s so the UI doesn't sit in "Generating…"
       forever. */
    state.completionTimer = setTimeout(endFlow, GENERATE_TIMEOUT_MS);
  }

  function onAnalyzeClick(e) {
    /* Capture phase — runs BEFORE the chassis bubble handler, so we
       snapshot the original label before chassis hides the button. */
    if (state.active) return;
    var btn = e.currentTarget;
    if (!btn) return;
    var idea = getGoalText();
    /* Idea too short: don't engage magic. The chassis Analyze handler
       will still run on bubble — Auto-Tune internally no-ops at <4
       chars but the user gets the tuning panel reveal as before. */
    if (idea.length < 4) return;

    state.active = true;
    state.originalText = btn.textContent;
    ensureStyles();
    document.body.classList.add('pmg-magic-active');
    showProgress();
    setBtnLabel(btn, TUNING_LABEL);

    state.tuneTimer = setTimeout(function () {
      var fired = fireGenerate();
      if (!fired) { endFlow(); return; }
      var b = document.getElementById('analyze-btn');
      setBtnLabel(b, GENERATING_LABEL);
      watchForCompletion();
    }, AUTO_TUNE_CAP_MS);
  }

  function wire() {
    ensureStyles();
    var btn = document.getElementById('analyze-btn');
    if (!btn || btn.__pmgMagicWired) return !!btn;
    btn.__pmgMagicWired = true;
    /* Capture phase (third arg true) so we run before the chassis
       bubble handler that hides the button via inline style. */
    btn.addEventListener('click', onAnalyzeClick, true);
    return true;
  }

  function boot() {
    if (wire()) return;
    /* Subscribe to the shared mount bus when present (mb-1) so we
       don't add yet another body-wide MutationObserver. Falls back to
       a 30s scoped observer if the bus isn't available. */
    if (window.pmgMountBus && typeof window.pmgMountBus.isActive === 'function' && window.pmgMountBus.isActive()) {
      window.pmgMountBus.subscribe(function () {
        if (wire()) {
          /* No explicit unsubscribe needed — wire() is idempotent via
             __pmgMagicWired guard, and the bus auto-disconnects after
             30s. Returning true keeps subscriptions tidy if the bus
             ever supports unsubscribe-on-true. */
          return true;
        }
        return false;
      });
      return;
    }
    var mo = new MutationObserver(function () {
      if (wire()) { try { mo.disconnect(); } catch (e) {} }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.pmgMagicFlow = {
    end: function () { endFlow(); },
    isActive: function () { return state.active; }
  };
})();
