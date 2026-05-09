/* ============================================================================
   PromptMeGood — Prompt Whisperer (sp-3 — typewriter slim search bar)
   V3 design: slim single-line input bar with a typewriter cycling
   animation for the placeholder text. The typewriter sits BEHIND a
   transparent input and is paused as soon as the user focuses or types
   into the field. Long sample questions no longer get truncated on
   narrow screens.
   ============================================================================
   Behaviour:
   - Click Spark (or press Enter) → fills #goal with a framed answer +
     clicks #analyze-btn to trigger the existing Auto-Tune flow.
   - Empty Spark → red flash on the input border + focus, no submit.
   - The "current question" used to frame the AI prompt is the question
     the typewriter was showing when the user started typing — that's
     what they were responding to. Captured on first focus / first
     keystroke and held until reset.
   - window.PMGSpark.reset() clears the input and rotates to a new
     random starting question (used by Start Over and tests).
   The brief used .pmgv3-goal-input / .pmgv3-analyze-btn — the REAL
   selectors in this codebase are #goal and #analyze-btn.
   ============================================================================ */
(function () {
  'use strict';

  // Mobile-optimized: kept ≤45 chars so questions don't get truncated
  // inside the Whisperer input on narrow viewports.
  var QUESTIONS = [
    "What problem keeps coming back?",
    "What do you need AI to do today?",
    "What's your dream outcome?",
    "What would make today easier?",
    "What do you want to create?",
    "Who are you trying to reach?",
    "What's the one thing you need done?",
    "What would you build if you knew it'd work?",
    "What's your biggest challenge right now?",
    "What content do you want to create?"
  ];

  // Typewriter loop state — module-scoped so reset() can rewind it.
  // `runId` is a generation counter: every start bumps it, and pending
  // ticks compare against it. This prevents stacked timers from racey
  // callers (e.g., reset() while a delayed tick is already queued).
  var _state = {
    questionIndex: Math.floor(Math.random() * QUESTIONS.length),
    charIndex: 0,
    isDeleting: false,
    timer: null,
    paused: false,
    runId: 0,
    framedQuestion: '' // the question the typewriter showed when user took over
  };

  // The chassis builds #pmgv3-whisperer-bar asynchronously inside
  // buildShell(). Poll up to ~30s before giving up.
  function whenReady(cb) {
    var ticks = 0;
    var t = setInterval(function () {
      var bar = document.getElementById('pmgv3-whisperer-bar');
      if (bar) { clearInterval(t); cb(bar); return; }
      if (++ticks > 150) { clearInterval(t); }
    }, 200);
  }

  function flashError(input) {
    var prev = input.style.borderBottomColor;
    input.style.borderBottomColor = '#ff4444';
    setTimeout(function () { input.style.borderBottomColor = prev || ''; }, 800);
  }

  function stopTypewriter() {
    if (_state.timer) { clearTimeout(_state.timer); _state.timer = null; }
    _state.paused = true;
  }

  function startTypewriter(input, typewriterEl) {
    if (!input || !typewriterEl) return;
    // Idempotent start: always cancel any pending tick before scheduling
    // a new one, then bump runId so stale callbacks (already in the
    // event-loop queue with a captured myRun) bail out on entry.
    if (_state.timer) { clearTimeout(_state.timer); _state.timer = null; }
    _state.runId++;
    var myRun = _state.runId;
    _state.paused = false;
    function tick() {
      // Stale callback from a prior loop — bail.
      if (myRun !== _state.runId) return;
      // Bail if user has typed or focused the input.
      if (input.value !== '' || document.activeElement === input || _state.paused) {
        _state.timer = null;
        return;
      }
      var q = QUESTIONS[_state.questionIndex] || '';
      var delay;
      if (_state.isDeleting) {
        typewriterEl.textContent = q.substring(0, _state.charIndex - 1);
        _state.charIndex--;
        delay = 30;
      } else {
        typewriterEl.textContent = q.substring(0, _state.charIndex + 1);
        _state.charIndex++;
        delay = 50;
      }
      // The "current question" the user is responding to is whatever
      // is fully typed on screen at the moment of focus/typing.
      _state.framedQuestion = q;

      if (!_state.isDeleting && _state.charIndex >= q.length) {
        delay = 2500; // hold the full line so they can read it
        _state.isDeleting = true;
      } else if (_state.isDeleting && _state.charIndex <= 0) {
        _state.isDeleting = false;
        _state.questionIndex = (_state.questionIndex + 1) % QUESTIONS.length;
        delay = 500;
      }
      _state.timer = setTimeout(tick, delay);
    }
    // Small initial pause so the bar settles before typing starts.
    _state.timer = setTimeout(tick, 1000);
  }

  function init(bar) {
    var input        = document.getElementById('whisperer-input');
    var typewriterEl = document.getElementById('whisperer-typewriter');
    var btn          = document.getElementById('btn-whisperer-spark');
    if (!input || !btn || bar.dataset.pmgWhispWired === '1') return;
    bar.dataset.pmgWhispWired = '1';

    // Drive the typewriter loop.
    startTypewriter(input, typewriterEl);

    function spark() {
      var answer = (input.value || '').trim();
      if (!answer) {
        flashError(input);
        try { input.focus(); } catch (_) {}
        return;
      }
      // Frame the goal with the question the user was responding to.
      var question = _state.framedQuestion || QUESTIONS[_state.questionIndex] || '';
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = 'I am answering this prompt: "' + question + '" My answer: ' + answer;
        try { goal.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
        try { goal.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }
      // Clear the whisperer so the bar feels "consumed" and ready for next time.
      input.value = '';
      bar.classList.remove('is-active');
      // Resume typewriter for the next session.
      _state.framedQuestion = '';
      startTypewriter(input, typewriterEl);
      var analyze = document.getElementById('analyze-btn');
      if (analyze) {
        analyze.click();
      } else if (window.console && console.warn) {
        console.warn('[whisperer] #analyze-btn not found.');
      }
    }

    btn.addEventListener('click', spark);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); spark(); }
    });

    // Pause typewriter on focus / first keystroke. Resume on blur if empty.
    input.addEventListener('focus', function () {
      // Lock in the question they were looking at.
      if (typewriterEl && typewriterEl.textContent) {
        _state.framedQuestion = QUESTIONS[_state.questionIndex] || typewriterEl.textContent;
      }
      bar.classList.add('is-active');
      stopTypewriter();
    });
    input.addEventListener('input', function () {
      if (input.value === '') {
        bar.classList.remove('is-active');
      } else {
        bar.classList.add('is-active');
      }
    });
    input.addEventListener('blur', function () {
      if ((input.value || '') === '') {
        bar.classList.remove('is-active');
        // Rewind a step so the cycle resumes cleanly from the current spot.
        startTypewriter(input, typewriterEl);
      }
    });

    // Public reset for Start Over / tests.
    window.PMGSpark.reset = function () {
      try { input.value = ''; } catch (_) {}
      bar.classList.remove('is-active');
      stopTypewriter();
      _state.questionIndex = Math.floor(Math.random() * QUESTIONS.length);
      _state.charIndex = 0;
      _state.isDeleting = false;
      _state.framedQuestion = '';
      if (typewriterEl) typewriterEl.textContent = '';
      startTypewriter(input, typewriterEl);
    };
  }

  // Test / debug hatch (also used by Start Over). Safe before init runs.
  window.PMGSpark = {
    reset: function () { /* no-op until init wires real reset */ },
    questions: QUESTIONS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { whenReady(init); });
  } else {
    whenReady(init);
  }
})();
