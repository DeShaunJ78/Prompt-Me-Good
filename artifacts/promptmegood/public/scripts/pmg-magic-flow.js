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
  /* takeover-1 (2026-05-15): full-screen takeover during the entire
     magic flow (Phase 1 tuning + Phase 2 generation). Replaces the
     missed-opportunity inline button-state UX with a dedicated
     "Writing a great prompt for: <goal>" experience. Stays visible
     until body.pmg-has-result lands or the user hits Cancel/Esc. */
  var TAKEOVER_ID = 'pmg-magic-takeover';
  var TAKEOVER_HEADING = 'Writing a great prompt for:';
  var STATUS_LINES = [
    'Analyzing your goal…',
    'Picking the right tone & format…',
    'Selecting structure & depth…',
    'Engineering your prompt…',
    'Polishing the wording…',
    'Almost ready…'
  ];
  var STATUS_ROTATE_MS = 1400;
  var GOAL_ECHO_MAX = 140;

  var state = {
    active: false,
    originalText: null,
    tuneTimer: null,
    completionObserver: null,
    completionTimer: null,
    progressBar: null,
    takeoverEl: null,
    statusTimer: null,
    statusIdx: 0,
    lastFocused: null,
    escHandler: null
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
      '}',
      /* takeover-1: full-screen takeover. Z-index sits above the
         existing overlay stack (tune overlay = ~9999, fullscreen
         reader = 99999) so it owns the screen while active. */
      '#' + TAKEOVER_ID + ' {',
      '  position: fixed; inset: 0; z-index: 100000;',
      '  background: radial-gradient(ellipse at center,',
      '    color-mix(in srgb, var(--color-primary, #3ee0a0) 8%, var(--color-bg, #07171c)) 0%,',
      '    var(--color-bg, #07171c) 70%);',
      '  display: flex; flex-direction: column;',
      '  align-items: center; justify-content: center;',
      '  padding: 32px 24px;',
      '  opacity: 0;',
      '  transition: opacity 200ms ease-out;',
      '  overflow-y: auto;',
      '}',
      '#' + TAKEOVER_ID + '.is-visible { opacity: 1; }',
      '#' + TAKEOVER_ID + '[hidden] { display: none; }',
      '.pmg-mt-icon {',
      '  font-size: 56px; line-height: 1; margin-bottom: 18px;',
      '  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--color-primary, #3ee0a0) 60%, transparent));',
      '  animation: pmgMtIconPulse 2.4s ease-in-out infinite;',
      '}',
      '@keyframes pmgMtIconPulse {',
      '  0%, 100% { transform: scale(1); opacity: 0.95; }',
      '  50% { transform: scale(1.08); opacity: 1; }',
      '}',
      '.pmg-mt-heading {',
      '  font-size: 1.05rem; font-weight: 600; letter-spacing: 0.02em;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 75%, transparent);',
      '  text-transform: none; margin: 0 0 14px; text-align: center;',
      '}',
      '.pmg-mt-goal {',
      '  font-size: clamp(1.25rem, 3.6vw, 1.85rem);',
      '  font-weight: 700; line-height: 1.35;',
      '  color: var(--color-primary, #3ee0a0);',
      '  text-align: center; max-width: min(680px, 92vw);',
      '  margin: 0 0 36px; word-break: break-word;',
      '  text-shadow: 0 0 24px color-mix(in srgb, var(--color-primary, #3ee0a0) 35%, transparent);',
      '}',
      '.pmg-mt-status {',
      '  font-size: 0.95rem; font-weight: 500;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 88%, transparent);',
      '  min-height: 1.4em; text-align: center;',
      '  margin: 0 0 14px;',
      '  animation: pmgMtStatusGlow 1.6s ease-in-out infinite;',
      '}',
      '@keyframes pmgMtStatusGlow {',
      '  0%, 100% { opacity: 0.55; }',
      '  50% { opacity: 1; }',
      '}',
      '.pmg-mt-dots { display: inline-flex; gap: 6px; margin-top: 6px; }',
      '.pmg-mt-dots span {',
      '  width: 7px; height: 7px; border-radius: 50%;',
      '  background: var(--color-primary, #3ee0a0);',
      '  animation: pmgMtDot 1.2s ease-in-out infinite;',
      '}',
      '.pmg-mt-dots span:nth-child(2) { animation-delay: 0.18s; }',
      '.pmg-mt-dots span:nth-child(3) { animation-delay: 0.36s; }',
      '@keyframes pmgMtDot {',
      '  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }',
      '  40% { transform: scale(1); opacity: 1; }',
      '}',
      '.pmg-mt-cancel {',
      '  position: absolute; bottom: 28px; left: 50%;',
      '  transform: translateX(-50%);',
      '  appearance: none; background: transparent;',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #e6fffb) 22%, transparent);',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 70%, transparent);',
      '  padding: 9px 22px; border-radius: 999px; cursor: pointer;',
      '  font-size: 0.85rem; font-weight: 500; letter-spacing: 0.02em;',
      '  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;',
      '}',
      '.pmg-mt-cancel:hover {',
      '  background: color-mix(in srgb, var(--color-text, #e6fffb) 8%, transparent);',
      '  color: var(--color-text, #e6fffb);',
      '  border-color: color-mix(in srgb, var(--color-text, #e6fffb) 40%, transparent);',
      '}',
      '.pmg-mt-cancel:focus-visible {',
      '  outline: 2px solid var(--color-primary, #3ee0a0);',
      '  outline-offset: 3px;',
      '}',
      'body.pmg-magic-takeover-open { overflow: hidden; }',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + TAKEOVER_ID + ' { transition: none; }',
      '  .pmg-mt-icon, .pmg-mt-status, .pmg-mt-dots span { animation: none; }',
      '}',
      '@media (max-width: 480px) {',
      '  .pmg-mt-icon { font-size: 44px; margin-bottom: 14px; }',
      '  .pmg-mt-heading { font-size: 0.95rem; margin-bottom: 10px; }',
      '  .pmg-mt-goal { margin-bottom: 28px; }',
      '  .pmg-mt-cancel { bottom: 20px; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function truncate(txt, max) {
    if (!txt) return '';
    if (txt.length <= max) return txt;
    return txt.slice(0, max - 1).trimEnd() + '…';
  }

  function showTakeover(goalText) {
    if (state.takeoverEl && document.body.contains(state.takeoverEl)) return;
    var el = document.createElement('div');
    el.id = TAKEOVER_ID;
    /* data-pmg-overlay-root: chassis universal-hide rule erases body-
       level elements without this marker. */
    el.setAttribute('data-pmg-overlay-root', '1');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', TAKEOVER_ID + '-heading');
    el.setAttribute('aria-describedby', TAKEOVER_ID + '-status');

    var icon = document.createElement('div');
    icon.className = 'pmg-mt-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✨';

    var heading = document.createElement('p');
    heading.className = 'pmg-mt-heading';
    heading.id = TAKEOVER_ID + '-heading';
    heading.textContent = TAKEOVER_HEADING;

    var goal = document.createElement('p');
    goal.className = 'pmg-mt-goal';
    goal.textContent = '"' + truncate(goalText, GOAL_ECHO_MAX) + '"';

    var status = document.createElement('p');
    status.className = 'pmg-mt-status';
    status.id = TAKEOVER_ID + '-status';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = STATUS_LINES[0];

    var dots = document.createElement('div');
    dots.className = 'pmg-mt-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<span></span><span></span><span></span>';

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'pmg-mt-cancel';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('aria-label', 'Cancel and return to the form');
    cancel.addEventListener('click', function () { endFlow(); });

    el.appendChild(icon);
    el.appendChild(heading);
    el.appendChild(goal);
    el.appendChild(status);
    el.appendChild(dots);
    el.appendChild(cancel);
    document.body.appendChild(el);
    document.body.classList.add('pmg-magic-takeover-open');
    state.takeoverEl = el;

    /* Fade-in next frame so transition fires. */
    requestAnimationFrame(function () { el.classList.add('is-visible'); });

    /* Rotate status lines. */
    state.statusIdx = 0;
    state.statusTimer = setInterval(function () {
      state.statusIdx = (state.statusIdx + 1) % STATUS_LINES.length;
      var s = document.getElementById(TAKEOVER_ID + '-status');
      if (s) s.textContent = STATUS_LINES[state.statusIdx];
    }, STATUS_ROTATE_MS);

    /* Esc key → cancel. Tab/Shift+Tab → focus trap (cancel is the
       only focusable element in the dialog, so any Tab attempt
       wraps back to it). */
    state.escHandler = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); endFlow(); return; }
      if (e.key === 'Tab') {
        var dlg = state.takeoverEl;
        if (!dlg) return;
        /* If focus has escaped the dialog, or there's nowhere else
           to go, force focus back to the cancel button. */
        if (!dlg.contains(document.activeElement) || document.activeElement === cancel) {
          e.preventDefault();
          try { cancel.focus(); } catch (err) {}
        }
      }
    };
    document.addEventListener('keydown', state.escHandler, true);
    /* pagehide / beforeunload defensive cleanup so the takeover
       doesn't linger across navigation (e.g. user clicks a logo
       link mid-flow). */
    if (!state.pagehideHandler) {
      state.pagehideHandler = function () { endFlow(); };
      window.addEventListener('pagehide', state.pagehideHandler);
    }

    /* Focus management: remember last focused, focus cancel button so
       keyboard users have a clear escape route. */
    try {
      state.lastFocused = document.activeElement;
      setTimeout(function () { try { cancel.focus(); } catch (e) {} }, 60);
    } catch (e) {}
  }

  function hideTakeover() {
    if (state.statusTimer) { clearInterval(state.statusTimer); state.statusTimer = null; }
    if (state.escHandler) {
      document.removeEventListener('keydown', state.escHandler, true);
      state.escHandler = null;
    }
    if (state.pagehideHandler) {
      try { window.removeEventListener('pagehide', state.pagehideHandler); } catch (e) {}
      state.pagehideHandler = null;
    }
    document.body.classList.remove('pmg-magic-takeover-open');
    var el = state.takeoverEl;
    state.takeoverEl = null;
    if (!el) return;
    /* Fade out, then remove from DOM. */
    el.classList.remove('is-visible');
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 220);
    /* Restore focus. */
    try {
      if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
        state.lastFocused.focus();
      }
    } catch (e) {}
    state.lastFocused = null;
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
    hideTakeover();
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
    /* takeover-1: full-screen takeover stays through both phases
       (tuning + generation) and tears down on body.pmg-has-result
       via watchForCompletion()'s endFlow(), or on Esc/Cancel. */
    showTakeover(idea);

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
