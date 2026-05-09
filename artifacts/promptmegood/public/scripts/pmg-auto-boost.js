/* =============================================================
 * pmg-auto-boost.js  (ab-1)
 *
 * Genuine prompt strengthening across Text / Photo / Video suites.
 *
 * For each suite, mounts an "✨ Auto-Boost Prompt" button into the
 * existing actions row next to the refined output. Click flow:
 *
 *   1. POST /api/clarify  → 0–2 short questions
 *   2. If questions: render an inline card with text inputs +
 *      "Got it, now boost" + "Skip, boost anyway"
 *   3. POST /api/boost    → strengthened prompt (folds in answers)
 *   4. Replace the prompt text in place
 *   5. Animate strength bar to 100% / "Expert Level"
 *
 * Strict additive: no existing handlers / IDs touched. Mounts
 * idempotently and polls for late-loading panel slots.
 *
 * Disable hatches:
 *   ?noautoboost
 *   localStorage.pmg_autoboost_disable = '1'
 *   localStorage.pmg_disable           = '1'
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgAutoBoostLoaded) return;
  window.__pmgAutoBoostLoaded = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]noautoboost\b/.test(qs)) return;
    if (localStorage.getItem('pmg_autoboost_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  // Three suite definitions. `read` returns current prompt; `write`
  // replaces it; `mountTarget` returns the element after which the
  // button should be inserted; `cardHost` returns the element that
  // should host the inline question card (above the prompt).
  var SUITES = {
    text: {
      label: 'Auto-Boost Prompt',
      read: function () {
        var rb = document.getElementById('resultBox');
        if (!rb) return '';
        var t = (rb.textContent || '').trim();
        if (!t) return '';
        if (t.indexOf('Your fixed prompt will appear here') === 0) return '';
        return t;
      },
      write: function (text) {
        var rb = document.getElementById('resultBox');
        if (rb) rb.textContent = text;
      },
      mountTarget: function () {
        // ab-7 (Missing Features Brief): mount the Auto-Boost button
        // immediately BEFORE #generateBtn so it sits inside the v3
        // .pmgv3-generate-host alongside "Generate My Prompt". This
        // makes it discoverable post-Analyze / pre-Generate (the
        // generate-section reveals once the user clicks "Analyze My
        // Idea"), instead of being hidden inside the result panel
        // actions row until after a result exists.
        //
        // Returning null when #generateBtn isn't reparented yet makes
        // mountFor() retry on the next observer tick, so we end up
        // anchored correctly even though the chassis builds the
        // generate slot asynchronously.
        return document.getElementById('generateBtn');
      },
      buttonPosition: 'before',
      cardHost: function () { return document.getElementById('resultBox'); },
      cardPosition: 'before',
    },
    photo: {
      label: 'Auto-Boost Brief',
      read: function () {
        var ta = document.getElementById('pmg-vs-image-refined');
        return ta ? (ta.value || '').trim() : '';
      },
      write: function (text) {
        var ta = document.getElementById('pmg-vs-image-refined');
        if (ta) {
          ta.value = text;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      mountTarget: function () { return document.getElementById('pmg-vs-image-copy'); },
      cardHost: function () { return document.getElementById('pmg-vs-image-refined'); },
      cardPosition: 'before',
    },
    video: {
      label: 'Auto-Boost Brief',
      read: function () {
        var ta = document.getElementById('pmg-vs-video-refined');
        return ta ? (ta.value || '').trim() : '';
      },
      write: function (text) {
        var ta = document.getElementById('pmg-vs-video-refined');
        if (ta) {
          ta.value = text;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      mountTarget: function () { return document.getElementById('pmg-vs-video-copy'); },
      cardHost: function () { return document.getElementById('pmg-vs-video-refined'); },
      cardPosition: 'before',
    },
  };

  function toast(msg) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg); return; } catch (_) {}
    }
    var t = document.createElement('div');
    t.className = 'pmg-ab-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 2800);
  }

  function buttonId(scope) { return 'pmg-ab-btn-' + scope; }
  function cardId(scope)   { return 'pmg-ab-card-' + scope; }

  function makeButton(scope) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = buttonId(scope);
    btn.className = 'pmg-ab-btn';
    btn.setAttribute('data-pmg-ab-scope', scope);
    btn.innerHTML = '<span class="pmg-ab-spark" aria-hidden="true">✨</span><span class="pmg-ab-label">' + SUITES[scope].label + '</span>';
    btn.addEventListener('click', function () { runFlow(scope); });
    return btn;
  }

  function mountFor(scope) {
    if (document.getElementById(buttonId(scope))) return true;
    var target = SUITES[scope].mountTarget();
    if (!target || !target.parentNode) return false;
    var btn = makeButton(scope);
    // Default 'after' for backward compat with photo/video suites that
    // anchor on a copy button. Text suite uses 'before' to land just
    // above #generateBtn (ab-7).
    var pos = SUITES[scope].buttonPosition || 'after';
    if (pos === 'before') {
      target.parentNode.insertBefore(btn, target);
    } else {
      target.parentNode.insertBefore(btn, target.nextSibling);
    }
    return true;
  }

  // Poll-mount: visual studio panels mount asynchronously, so retry
  // for a while after load. Caps at ~30s of polling.
  var _pollTimer = null;
  var _mountObserver = null;
  function allMounted() {
    return Object.keys(SUITES).every(function (s) {
      return !!document.getElementById(buttonId(s));
    });
  }
  function stopMountWatchers() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    if (_mountObserver) { try { _mountObserver.disconnect(); } catch (_) {} _mountObserver = null; }
  }
  function startMountLoop() {
    var ticks = 0;
    _pollTimer = setInterval(function () {
      ticks++;
      Object.keys(SUITES).forEach(function (scope) {
        if (!document.getElementById(buttonId(scope))) mountFor(scope);
      });
      if (allMounted() || ticks > 150) {
        clearInterval(_pollTimer);
        _pollTimer = null;
        if (allMounted()) stopMountWatchers();
      }
    }, 200);
  }

  // -------- Strength bar payoff ----------------------------------
  // After a successful boost, push the strength UI to "Expert Level".
  // Updates v3 elements directly AND writes to legacy #strength-score-pct
  // so chassis-v3's mirrorStrength() (1500ms tick) keeps it at 100.
  function celebrateStrength() {
    var legacyPct = document.getElementById('strength-score-pct');
    if (legacyPct) legacyPct.textContent = '100';
    var fill = document.getElementById('strength-fill');
    var badge = document.getElementById('strength-score-badge');
    var status = document.getElementById('strength-status');
    if (fill) {
      fill.style.transition = 'width 600ms ease';
      fill.style.width = '100%';
      fill.style.background = 'linear-gradient(90deg, #00c896, #3ee0a0)';
    }
    if (badge) badge.textContent = '100';
    if (status) {
      status.textContent = '⚡ Expert Level — Ready to Run';
      status.style.color = '#3ee0a0';
    }
    // Pulse the strength card briefly
    var card = document.getElementById('pmgv3-strength-slot');
    if (card) {
      card.classList.add('pmg-ab-pulse');
      setTimeout(function () { card.classList.remove('pmg-ab-pulse'); }, 900);
    }
  }

  // -------- Inline question card ---------------------------------
  function removeCard(scope) {
    var existing = document.getElementById(cardId(scope));
    if (existing) try { existing.remove(); } catch (_) {}
  }

  function renderQuestionCard(scope, questions, onSubmit, onSkip) {
    removeCard(scope);
    var host = SUITES[scope].cardHost();
    if (!host || !host.parentNode) {
      // No host means we can't show a card — auto-skip
      onSkip();
      return;
    }
    var card = document.createElement('div');
    card.id = cardId(scope);
    card.className = 'pmg-ab-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Auto-Boost clarifying questions');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('tabindex', '-1');

    var title = document.createElement('div');
    title.className = 'pmg-ab-card-title';
    title.innerHTML = '<span aria-hidden="true">💡</span> A couple quick questions to make this great';
    card.appendChild(title);

    // Per-scope placeholder hints — concrete examples beat the old
    // generic "Your answer (optional)" which left users guessing about
    // expected length and format.
    var PLACEHOLDERS = {
      text:  "e.g., 'For a marketing email' or 'Casual, friendly tone'",
      photo: "e.g., 'Dark and moody' or 'Bright and sunny'",
      video: "e.g., '15 seconds, vertical' or 'Slow, dreamy pacing'",
    };
    var placeholder = PLACEHOLDERS[scope] || "e.g., a few words is plenty";

    var fieldEls = [];
    questions.forEach(function (q, i) {
      var wrap = document.createElement('label');
      wrap.className = 'pmg-ab-field';
      var qText = document.createElement('span');
      qText.className = 'pmg-ab-q';
      qText.textContent = q;
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'pmg-ab-input';
      inp.placeholder = placeholder;
      inp.dataset.pmgAbQuestion = q;
      inp.autocomplete = 'off';
      if (i === 0) setTimeout(function () { try { inp.focus(); } catch (_) {} }, 30);
      wrap.appendChild(qText);
      wrap.appendChild(inp);
      card.appendChild(wrap);
      fieldEls.push(inp);
    });

    // Helper micro-copy: tells the user that short answers are fine
    // and that skipping is a first-class option (not a failure path).
    var helper = document.createElement('div');
    helper.className = 'pmg-ab-card-helper';
    helper.textContent = 'Short answers are fine — even a single word helps. You can also skip this step.';
    card.appendChild(helper);

    var actions = document.createElement('div');
    actions.className = 'pmg-ab-card-actions';

    var goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'pmg-ab-card-go';
    goBtn.textContent = 'Got it, now boost';
    goBtn.addEventListener('click', function () {
      var answers = {};
      fieldEls.forEach(function (el) {
        var q = el.dataset.pmgAbQuestion;
        var v = (el.value || '').trim();
        if (q && v) answers[q] = v;
      });
      onSubmit(answers);
    });

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'pmg-ab-card-skip';
    skipBtn.textContent = 'Skip, boost anyway';
    skipBtn.addEventListener('click', function () { onSkip(); });

    actions.appendChild(skipBtn);
    actions.appendChild(goBtn);
    card.appendChild(actions);

    host.parentNode.insertBefore(card, host);

    // Move focus to the card itself first so screen readers announce
    // the title via the group's aria-label, then hand off to the first
    // input on the next tick.
    try { card.focus({ preventScroll: true }); } catch (_) {}

    // Smooth scroll into view if mostly off-screen
    try {
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}
  }

  // -------- Main flow --------------------------------------------
  var inFlight = {};

  async function runFlow(scope) {
    if (inFlight[scope]) return;
    var prompt = SUITES[scope].read();
    if (!prompt) {
      toast(scope === 'text'
        ? 'Generate a prompt first.'
        : 'Build your prompt first.');
      return;
    }
    inFlight[scope] = true;
    setBtnState(scope, 'thinking', 'Thinking…');

    try {
      var clarRes = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, scope: scope }),
      });
      var clar = await clarRes.json().catch(function () { return {}; });
      if (!clarRes.ok) {
        toast(clar.error || 'Could not analyze prompt.');
        resetBtn(scope);
        inFlight[scope] = false;
        return;
      }
      var questions = Array.isArray(clar.questions) ? clar.questions : [];

      if (questions.length === 0) {
        // Skip straight to boost
        await doBoost(scope, prompt, null);
        return;
      }

      // Show card and wait for the user
      setBtnState(scope, 'idle', SUITES[scope].label.replace('✨ ', '✨ '));
      renderQuestionCard(scope, questions, function (answers) {
        removeCard(scope);
        doBoost(scope, prompt, answers);
      }, function () {
        removeCard(scope);
        doBoost(scope, prompt, null);
      });
    } catch (e) {
      toast('Network error. Try again.');
      resetBtn(scope);
      inFlight[scope] = false;
    }
  }

  async function doBoost(scope, prompt, answers) {
    inFlight[scope] = true;
    setBtnState(scope, 'thinking', 'Adding expert structure…');
    try {
      var body = { prompt: prompt, scope: scope };
      if (answers && Object.keys(answers).length) body.answers = answers;
      var res = await fetch('/api/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.result) {
        toast(data.error || 'Boost failed. Try again.');
        return;
      }
      SUITES[scope].write(data.result);
      celebrateStrength();
      toast('Boosted to Expert Level ⚡');
    } catch (e) {
      toast('Network error. Try again.');
    } finally {
      resetBtn(scope);
      inFlight[scope] = false;
    }
  }

  function setBtnState(scope, state, text) {
    var btn = document.getElementById(buttonId(scope));
    if (!btn) return;
    btn.disabled = (state === 'thinking');
    btn.dataset.pmgAbState = state;
    var label = btn.querySelector('.pmg-ab-label');
    if (label) label.textContent = text;
  }
  function resetBtn(scope) {
    setBtnState(scope, 'idle', SUITES[scope].label);
  }

  // -------- Boot -------------------------------------------------
  function boot() {
    startMountLoop();
    // Re-attempt mount on dynamic DOM changes (e.g. panel switches).
    // Stops once every scope is mounted to avoid long-session leak.
    try {
      _mountObserver = new MutationObserver(function () {
        Object.keys(SUITES).forEach(function (scope) {
          if (!document.getElementById(buttonId(scope))) mountFor(scope);
        });
        if (allMounted()) stopMountWatchers();
      });
      _mountObserver.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
