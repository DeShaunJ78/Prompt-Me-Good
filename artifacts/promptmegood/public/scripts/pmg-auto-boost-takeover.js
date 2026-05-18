/*
 * pmg-auto-boost-takeover.js  (abt-1, 2026-05-17)
 *
 * Full-screen takeover for the ✨ Auto-Boost flow, mirroring the
 * pmg-magic-flow.js Generate takeover so the two feel like the same
 * family. Owns the screen from the moment /api/boost is requested
 * until the strengthened prompt has been written back into the goal
 * field, then shows a brief reassurance state ("Prompt strengthened
 * — now Expert Level") before fading out.
 *
 * Public API (exposed on window.pmgAutoBoostTakeover):
 *   .show(originalPrompt)  → mount overlay, rotate status lines
 *   .succeed(newPrompt)    → flash success + auto-dismiss
 *   .fail()                → silently dismiss (toast handles the error)
 *   .hide()                → force-dismiss
 *
 * Disable: ?noboosttakeover  OR  localStorage.pmg_boost_takeover_disable='1'
 */
(function () {
  if (window.__pmgAutoBoostTakeoverLoaded) return;
  window.__pmgAutoBoostTakeoverLoaded = true;
  try {
    var qs = location.search || '';
    if (/[?&]noboosttakeover\b/.test(qs)) return;
    if (localStorage.getItem('pmg_boost_takeover_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-abt-style';
  var OVERLAY_ID = 'pmg-abt-overlay';
  var GOAL_ECHO_MAX = 140;
  var STATUS_ROTATE_MS = 1300;
  var SUCCESS_DISMISS_MS = 1900;

  var STATUS_LINES = [
    'Reading your prompt…',
    'Finding opportunities to strengthen it…',
    'Adding expert structure & framing…',
    'Sharpening clarity, tone & specificity…',
    'Polishing every word…',
    'Almost ready…'
  ];

  var state = {
    el: null,
    statusTimer: null,
    statusIdx: 0,
    escHandler: null,
    pagehideHandler: null,
    lastFocused: null,
    originalLen: 0
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + OVERLAY_ID + ' {',
      '  position: fixed; inset: 0; z-index: 100000;',
      '  background: radial-gradient(ellipse at center,',
      '    color-mix(in srgb, var(--color-primary, #3ee0a0) 10%, var(--color-bg, #07171c)) 0%,',
      '    var(--color-bg, #07171c) 70%);',
      '  display: flex; flex-direction: column;',
      '  align-items: center; justify-content: center;',
      '  padding: 32px 24px;',
      '  opacity: 0;',
      '  transition: opacity 200ms ease-out;',
      '  overflow-y: auto;',
      '}',
      '#' + OVERLAY_ID + '.is-visible { opacity: 1; }',
      '#' + OVERLAY_ID + '[hidden] { display: none; }',
      'body.pmg-abt-open { overflow: hidden; }',

      '.pmg-abt-icon {',
      '  font-size: 54px; line-height: 1; margin-bottom: 18px;',
      '  filter: drop-shadow(0 0 18px color-mix(in srgb, var(--color-primary, #3ee0a0) 55%, transparent));',
      '  animation: pmgAbtPulse 1.4s ease-in-out infinite;',
      '}',
      '@keyframes pmgAbtPulse {',
      '  0%, 100% { transform: scale(1); opacity: 0.92; }',
      '  50% { transform: scale(1.08); opacity: 1; }',
      '}',

      '.pmg-abt-spinner {',
      '  width: 44px; height: 44px; border-radius: 50%;',
      '  border: 3px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 18%, transparent);',
      '  border-top-color: var(--color-primary, #3ee0a0);',
      '  margin-bottom: 22px;',
      '  animation: pmgAbtSpin 0.9s linear infinite;',
      '  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--color-primary, #3ee0a0) 45%, transparent));',
      '}',
      '@keyframes pmgAbtSpin { to { transform: rotate(360deg); } }',

      '.pmg-abt-heading {',
      '  font-size: 1.05rem; font-weight: 600; letter-spacing: 0.02em;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 75%, transparent);',
      '  margin: 0 0 14px; text-align: center; max-width: 560px;',
      '}',

      '.pmg-abt-card {',
      '  max-width: 580px; width: 100%; margin: 0 0 24px;',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 6%, var(--color-surface, #0d2429));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 22%, transparent);',
      '  border-radius: 14px; padding: 16px 20px;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.35),',
      '              0 0 0 1px color-mix(in srgb, var(--color-primary, #3ee0a0) 8%, transparent);',
      '}',
      '.pmg-abt-card-label {',
      '  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;',
      '  text-transform: uppercase;',
      '  color: color-mix(in srgb, var(--color-primary, #3ee0a0) 85%, transparent);',
      '  margin: 0 0 6px;',
      '}',
      '.pmg-abt-goal {',
      '  font-size: 0.95rem; font-style: italic; line-height: 1.5;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 90%, transparent);',
      '  margin: 0;',
      '}',

      '.pmg-abt-status {',
      '  font-size: 0.95rem; font-weight: 500;',
      '  color: var(--color-text, #e6fffb);',
      '  margin: 0 0 10px; min-height: 1.4em; text-align: center;',
      '  transition: opacity 200ms ease;',
      '}',
      '.pmg-abt-dots {',
      '  display: inline-flex; gap: 6px; margin-bottom: 18px;',
      '}',
      '.pmg-abt-dots span {',
      '  width: 6px; height: 6px; border-radius: 50%;',
      '  background: var(--color-primary, #3ee0a0);',
      '  opacity: 0.4;',
      '  animation: pmgAbtBlink 1.2s ease-in-out infinite;',
      '}',
      '.pmg-abt-dots span:nth-child(2) { animation-delay: 0.15s; }',
      '.pmg-abt-dots span:nth-child(3) { animation-delay: 0.3s; }',
      '@keyframes pmgAbtBlink {',
      '  0%, 100% { opacity: 0.3; }',
      '  50% { opacity: 1; }',
      '}',

      '.pmg-abt-reassure {',
      '  font-size: 0.82rem; font-weight: 400;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 55%, transparent);',
      '  margin: 8px 0 0; text-align: center; max-width: 480px;',
      '  line-height: 1.5;',
      '}',

      /* Success state — swapped in by .succeed() */
      '#' + OVERLAY_ID + '.is-success .pmg-abt-spinner { display: none; }',
      '#' + OVERLAY_ID + '.is-success .pmg-abt-dots { visibility: hidden; }',
      '#' + OVERLAY_ID + '.is-success .pmg-abt-icon { animation: none; transform: scale(1.05); }',
      '.pmg-abt-success-tick {',
      '  display: none;',
      '  width: 56px; height: 56px; border-radius: 50%;',
      '  background: var(--color-primary, #3ee0a0);',
      '  color: var(--color-bg, #07171c);',
      '  align-items: center; justify-content: center;',
      '  font-size: 30px; font-weight: 700; line-height: 1;',
      '  margin-bottom: 18px;',
      '  box-shadow: 0 0 24px color-mix(in srgb, var(--color-primary, #3ee0a0) 65%, transparent);',
      '  animation: pmgAbtTickPop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both;',
      '}',
      '#' + OVERLAY_ID + '.is-success .pmg-abt-success-tick { display: inline-flex; }',
      '#' + OVERLAY_ID + '.is-success .pmg-abt-icon { display: none; }',
      '@keyframes pmgAbtTickPop {',
      '  0% { transform: scale(0); opacity: 0; }',
      '  100% { transform: scale(1); opacity: 1; }',
      '}',

      '.pmg-abt-changes {',
      '  list-style: none; padding: 0; margin: 14px auto 0;',
      '  max-width: 460px;',
      '  display: flex; flex-direction: column; gap: 6px;',
      '}',
      '.pmg-abt-changes li {',
      '  font-size: 0.85rem; line-height: 1.5;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 78%, transparent);',
      '  padding-left: 22px; position: relative;',
      '  text-align: left;',
      '}',
      '.pmg-abt-changes li::before {',
      '  content: "✓"; position: absolute; left: 0; top: 0;',
      '  color: var(--color-primary, #3ee0a0); font-weight: 700;',
      '}',

      '.pmg-abt-cancel {',
      '  position: absolute; bottom: 32px; left: 50%;',
      '  transform: translateX(-50%);',
      '  appearance: none; background: transparent;',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #e6fffb) 22%, transparent);',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 70%, transparent);',
      '  padding: 9px 22px; border-radius: 999px; cursor: pointer;',
      '  font-size: 0.85rem; font-weight: 500;',
      '  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;',
      '}',
      '.pmg-abt-cancel:hover {',
      '  background: color-mix(in srgb, var(--color-text, #e6fffb) 8%, transparent);',
      '  color: var(--color-text, #e6fffb);',
      '  border-color: color-mix(in srgb, var(--color-text, #e6fffb) 40%, transparent);',
      '}',
      '#' + OVERLAY_ID + '.is-success .pmg-abt-cancel { display: none; }',

      '@media (prefers-reduced-motion: reduce) {',
      '  #' + OVERLAY_ID + ' { transition: none; }',
      '  .pmg-abt-spinner, .pmg-abt-icon, .pmg-abt-dots span, .pmg-abt-success-tick { animation: none; }',
      '}',
      '@media (max-width: 480px) {',
      '  .pmg-abt-icon { font-size: 44px; margin-bottom: 14px; }',
      '  .pmg-abt-heading { font-size: 0.95rem; }',
      '  .pmg-abt-card { padding: 14px 16px; margin-bottom: 18px; }',
      '  .pmg-abt-goal { font-size: 0.9rem; }',
      '  .pmg-abt-cancel { bottom: 20px; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function truncate(t, max) {
    if (!t) return '';
    if (t.length <= max) return t;
    return t.slice(0, max - 1).trimEnd() + '…';
  }

  function show(originalPrompt) {
    ensureStyles();
    if (state.el && document.body.contains(state.el)) return;

    state.originalLen = (originalPrompt || '').trim().split(/\s+/).filter(Boolean).length;

    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('data-pmg-overlay-root', '1');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', OVERLAY_ID + '-heading');
    el.setAttribute('aria-describedby', OVERLAY_ID + '-status');

    var icon = document.createElement('div');
    icon.className = 'pmg-abt-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✨';

    var tick = document.createElement('div');
    tick.className = 'pmg-abt-success-tick';
    tick.setAttribute('aria-hidden', 'true');
    tick.textContent = '✓';

    var spinner = document.createElement('div');
    spinner.className = 'pmg-abt-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    var heading = document.createElement('p');
    heading.className = 'pmg-abt-heading';
    heading.id = OVERLAY_ID + '-heading';
    heading.textContent = 'Boosting your prompt…';

    var card = document.createElement('div');
    card.className = 'pmg-abt-card';
    var cardLabel = document.createElement('p');
    cardLabel.className = 'pmg-abt-card-label';
    cardLabel.textContent = 'Original prompt';
    var goal = document.createElement('p');
    goal.className = 'pmg-abt-goal';
    goal.textContent = '"' + truncate((originalPrompt || '').trim(), GOAL_ECHO_MAX) + '"';
    card.appendChild(cardLabel);
    card.appendChild(goal);

    var status = document.createElement('p');
    status.className = 'pmg-abt-status';
    status.id = OVERLAY_ID + '-status';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = STATUS_LINES[0];

    var dots = document.createElement('div');
    dots.className = 'pmg-abt-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<span></span><span></span><span></span>';

    var reassure = document.createElement('p');
    reassure.className = 'pmg-abt-reassure';
    reassure.id = OVERLAY_ID + '-reassure';
    reassure.textContent = 'Adding the structure, specificity, and context that pro-grade prompts use — your original intent stays intact.';

    var changes = document.createElement('ul');
    changes.className = 'pmg-abt-changes';
    changes.id = OVERLAY_ID + '-changes';
    changes.hidden = true;

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'pmg-abt-cancel';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('aria-label', 'Cancel boost and return');
    cancel.addEventListener('click', function () { hide(); });

    el.appendChild(spinner);
    el.appendChild(icon);
    el.appendChild(tick);
    el.appendChild(heading);
    el.appendChild(card);
    el.appendChild(status);
    el.appendChild(dots);
    el.appendChild(reassure);
    el.appendChild(changes);
    el.appendChild(cancel);

    /* Append to documentElement so chassis universal-hide rule
       (body > *:not(#pmg-chassis-v3-root):not(script)) doesn't kill it. */
    document.documentElement.appendChild(el);
    document.body.classList.add('pmg-abt-open');
    state.el = el;

    requestAnimationFrame(function () { el.classList.add('is-visible'); });

    state.statusIdx = 0;
    state.statusTimer = setInterval(function () {
      state.statusIdx = (state.statusIdx + 1) % STATUS_LINES.length;
      var s = document.getElementById(OVERLAY_ID + '-status');
      if (s) s.textContent = STATUS_LINES[state.statusIdx];
    }, STATUS_ROTATE_MS);

    state.escHandler = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); hide(); }
    };
    document.addEventListener('keydown', state.escHandler, true);

    if (!state.pagehideHandler) {
      state.pagehideHandler = function () { hide(); };
      window.addEventListener('pagehide', state.pagehideHandler);
    }

    try {
      state.lastFocused = document.activeElement;
      setTimeout(function () { try { cancel.focus(); } catch (e) {} }, 60);
    } catch (e) {}
  }

  function succeed(newPrompt) {
    if (!state.el) return;
    /* Stop the rotating status. */
    if (state.statusTimer) { clearInterval(state.statusTimer); state.statusTimer = null; }

    var newLen = (newPrompt || '').trim().split(/\s+/).filter(Boolean).length;
    var delta = newLen - state.originalLen;
    var pct = state.originalLen > 0 ? Math.round((delta / state.originalLen) * 100) : 0;

    var heading = state.el.querySelector('.pmg-abt-heading');
    if (heading) heading.textContent = 'Your prompt just levelled up';

    var status = document.getElementById(OVERLAY_ID + '-status');
    if (status) status.textContent = '✓ Boost complete';

    var reassure = document.getElementById(OVERLAY_ID + '-reassure');
    if (reassure) {
      reassure.textContent = 'Your original intent is preserved — we added the scaffolding that makes AI tools produce sharper, more useful answers.';
    }

    var changes = document.getElementById(OVERLAY_ID + '-changes');
    if (changes) {
      var items = [];
      items.push('Expert structure & role framing added');
      items.push('Clarity, tone, and specificity strengthened');
      if (delta > 0) {
        var deltaText = '+' + delta + ' words of context';
        if (pct > 0 && state.originalLen >= 4) deltaText += ' (≈ ' + pct + '% richer)';
        items.push(deltaText);
      }
      items.push('Original meaning preserved');
      changes.innerHTML = items.map(function (t) {
        var li = document.createElement('li');
        li.textContent = t;
        return li.outerHTML;
      }).join('');
      changes.hidden = false;
    }

    state.el.classList.add('is-success');

    setTimeout(function () { hide(); }, SUCCESS_DISMISS_MS);
  }

  function fail() {
    hide();
  }

  function hide() {
    if (state.statusTimer) { clearInterval(state.statusTimer); state.statusTimer = null; }
    if (state.escHandler) {
      document.removeEventListener('keydown', state.escHandler, true);
      state.escHandler = null;
    }
    if (state.pagehideHandler) {
      try { window.removeEventListener('pagehide', state.pagehideHandler); } catch (e) {}
      state.pagehideHandler = null;
    }
    document.body.classList.remove('pmg-abt-open');
    var el = state.el;
    state.el = null;
    if (!el) return;
    el.classList.remove('is-visible');
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 220);
    try {
      if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
        state.lastFocused.focus();
      }
    } catch (e) {}
    state.lastFocused = null;
  }

  window.pmgAutoBoostTakeover = {
    show: show,
    succeed: succeed,
    fail: fail,
    hide: hide
  };
})();
