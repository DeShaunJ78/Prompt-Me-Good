/* pmg-first-run.js (fr-1)
 * First-visit nudge: guide brand-new visitors to their first generation.
 *
 * Behavior (first visit to /app ONLY — no prior local state):
 *   - Pre-fills #goal with a concrete example sentence so the visitor sees
 *     what "an idea" looks like. If ?q= is present the chassis prefill owns
 *     the textarea (prefill-q-1) — we never compete with it.
 *   - Select-on-first-focus: the example text is fully selected the first
 *     time the visitor focuses #goal, so typing replaces it instantly.
 *   - Highlights the primary Build/Generate CTA (#analyze-btn, falling back
 *     to #generateBtn) with a soft theme-token glow until the first Build
 *     click, then removes it permanently for this device.
 *   - Returning users see zero change: a persistent done-flag is written on
 *     the first eligible visit, and any prior-use signal (vault history,
 *     draft, session) also counts as "returning".
 *
 * First-visit detection (ALL must be absent):
 *   - localStorage['pmg.first_run.done.v1']   (our own flag)
 *   - localStorage['promptmegood:history:v1'] (vault use)
 *   - localStorage['pmgv3:draft']             (draft recovery mirror)
 *   - sessionStorage['pmgv3:session']         (live session)
 *   NOTE: refresh-clears-1 wipes draft+session on a true reload, so the own
 *   done-flag (never wiped) is the authoritative "seen it" record.
 *
 * Standard kill-switches (per docs/scripts.md convention):
 *   - URL: ?nofirstrun
 *   - Per-device: localStorage.pmg_first_run_disable = '1'
 *
 * Self-contained inline styles (no .css file). Theme tokens only — no
 * hardcoded teal. Does NOT touch pmg-chassis-v3.js or pmg-ux.js.
 *
 * Funnel analytics (fr-2): fires __pmgTrack events so first-visit →
 * first-generation conversion is measurable in Clarity:
 *   - first_run_nudge_shown   (once, when the CTA glow is applied;
 *                              payload { prefilled: '1' | '0' })
 *   - first_run_cta_clicked   (once, when the highlighted CTA is clicked)
 * No-ops silently when pmg-analytics.js is absent or opted-out (DNT/GPC
 * and the ?noanalytics / localStorage hatches live in pmg-analytics.js).
 * Kill-switched builds never reach this code, so no events fire then.
 */
(function () {
  'use strict';

  /* ---------- Kill switches ---------- */
  try {
    var u = new URL(location.href);
    if (u.searchParams.has('nofirstrun')) return;
  } catch (_) {}
  try {
    if (localStorage.getItem('pmg_first_run_disable') === '1') return;
  } catch (_) {}

  var DONE_KEY = 'pmg.first_run.done.v1';
  var STYLE_ID = 'pmg-first-run-style';
  var GLOW_CLASS = 'pmg-fr-glow';
  var EXAMPLE =
    'Write a friendly follow-up email to a client who went quiet after I sent my proposal last week';

  /* Capture ?q= at eval time — chassis prefill-q-1 strips it from the URL
     shortly after boot, so a late read would miss it. */
  var hasQ = false;
  try {
    var qv = (new URLSearchParams(location.search || '').get('q') || '').trim();
    hasQ = qv.length > 0;
  } catch (_) {}

  /* ---------- First-visit detection ---------- */
  function isFirstVisit() {
    try {
      if (localStorage.getItem(DONE_KEY) === '1') return false;
      if (localStorage.getItem('promptmegood:history:v1')) return false;
      if (localStorage.getItem('pmgv3:draft')) return false;
    } catch (_) { return false; }
    try {
      if (sessionStorage.getItem('pmgv3:session')) return false;
    } catch (_) {}
    return true;
  }

  function markDone() {
    try { localStorage.setItem(DONE_KEY, '1'); } catch (_) {}
  }

  /* ---------- Funnel analytics (fr-2) ---------- */
  /* pmg-analytics.js loads AFTER this script in app.html's defer order, and
     boot() can run at eval time (defer ⇒ readyState 'interactive'), so
     __pmgTrack may not exist yet when the nudge shows. Buffer and retry
     briefly; pmg-analytics.js itself owns the DNT/GPC opt-out (its track()
     no-ops when disabled), so buffering never bypasses the opt-out. */
  var _fireBuf = [];
  var _fireIv = null;
  function drainFireBuf() {
    if (typeof window.__pmgTrack !== 'function') return false;
    while (_fireBuf.length) {
      var e = _fireBuf.shift();
      try { window.__pmgTrack(e.name, e.payload); } catch (_) {}
    }
    return true;
  }
  function fire(name, payload) {
    _fireBuf.push({ name: name, payload: payload || null });
    if (drainFireBuf()) return;
    if (_fireIv) return;
    var tries = 0;
    _fireIv = setInterval(function () {
      tries++;
      if (drainFireBuf() || tries > 50) { /* 50 × 200ms = 10s cap */
        clearInterval(_fireIv);
        _fireIv = null;
        _fireBuf.length = 0;
      }
    }, 200);
  }

  var _shownFired = false;
  function fireShownOnce() {
    if (_shownFired) return;
    _shownFired = true;
    fire('first_run_nudge_shown', { prefilled: hasQ ? '0' : '1' });
  }

  var _clickFired = false;
  function fireCtaClickOnce() {
    if (_clickFired) return;
    _clickFired = true;
    fire('first_run_cta_clicked');
  }

  /* ---------- Styles ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.' + GLOW_CLASS + ' {',
      '  animation: pmg-fr-pulse 2.2s ease-in-out infinite;',
      '}',
      '@keyframes pmg-fr-pulse {',
      '  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary, #3ee0a0) 55%, transparent); }',
      '  50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-primary, #3ee0a0) 0%, transparent); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .' + GLOW_CLASS + ' {',
      '    animation: none;',
      '    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #3ee0a0) 45%, transparent);',
      '  }',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- CTA highlight ---------- */
  var _highlighted = [];
  function clearGlow() {
    for (var i = 0; i < _highlighted.length; i++) {
      try { _highlighted[i].classList.remove(GLOW_CLASS); } catch (_) {}
    }
    _highlighted = [];
  }

  function endFirstRun() {
    clearGlow();
    markDone();
  }

  function highlightCta() {
    var ids = ['analyze-btn', 'generateBtn'];
    var found = false;
    for (var i = 0; i < ids.length; i++) {
      var btn = document.getElementById(ids[i]);
      if (!btn) continue;
      found = true;
      if (btn.__pmgFrWired) continue;
      btn.__pmgFrWired = true;
      btn.classList.add(GLOW_CLASS);
      _highlighted.push(btn);
      /* Capture phase so we end the nudge even if another handler
         stops propagation (magic-flow uses capture too — order-safe,
         both run). */
      btn.addEventListener('click', function () {
        fireCtaClickOnce();
        endFirstRun();
      }, true);
    }
    if (found) fireShownOnce();
    return found;
  }

  /* ---------- Goal prefill ---------- */
  function prefillGoal() {
    if (hasQ) return true; /* chassis owns the textarea — done */
    var goal = document.getElementById('goal');
    if (!goal) return false;
    if ((goal.value || '').trim() !== '') return true; /* something restored — leave it */
    goal.value = EXAMPLE;
    try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { goal.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    /* Select-all on first focus so typing replaces the example instantly.
       One-shot: after the first focus the example behaves like normal text. */
    goal.addEventListener('focus', function onFocus() {
      goal.removeEventListener('focus', onFocus);
      try {
        if (goal.value === EXAMPLE) goal.select();
      } catch (_) {}
    });
    return true;
  }

  /* ---------- Boot ---------- */
  var _goalDone = false;
  var _ctaDone = false;

  function tick() {
    if (!_goalDone) _goalDone = prefillGoal();
    if (!_ctaDone) _ctaDone = highlightCta();
    return _goalDone && _ctaDone;
  }

  function boot() {
    if (!isFirstVisit()) return;
    injectStyles();
    if (tick()) return;
    /* Chassis reparents #goal/#generateBtn async — use the shared mount bus
       when active, fall back to a bounded poll otherwise. */
    if (window.pmgMountBus && typeof window.pmgMountBus.isActive === 'function' && window.pmgMountBus.isActive()) {
      window.pmgMountBus.subscribe(tick);
      /* Bus auto-disconnects at 30s; add a late safety poll for slow boots. */
    }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (tick() || tries > 100) clearInterval(iv); /* 100 × 200ms = 20s cap */
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* Public API for command-palette / debug. */
  window.pmgFirstRun = {
    isFirstVisit: isFirstVisit,
    end: endFirstRun,
    reset: function () {
      try { localStorage.removeItem(DONE_KEY); } catch (_) {}
    }
  };
})();
