/* ============================================================================
   PromptMeGood — Prompt Whisperer (sp-2 — slim glowing search bar)
   Replaces the sp-1 bulky panel. Single-line input + inline Spark button
   sits above the main #goal builder. Rotating placeholder questions
   (random per pageload) hint at what to type without taking real space.
   ============================================================================
   Behaviour:
   - Click Spark (or press Enter) → fills #goal with a framed answer +
     clicks #analyze-btn to trigger the existing Auto-Tune flow.
   - Empty Spark → red flash on the input border + focus, no submit.
   - No dismissal UI: the bar is small enough to live above forever.
   - window.PMGSpark.reset() clears the input and rotates to a new
     random placeholder (used by Start Over and tests).
   The brief used .pmgv3-goal-input / .pmgv3-analyze-btn — the REAL
   selectors in this codebase are #goal and #analyze-btn.
   ============================================================================ */
(function () {
  'use strict';

  var QUESTIONS = [
    "What's a problem you've been putting off solving?",
    "If you had a world-class expert on call right now, what would you ask them?",
    "What's something you wish you could explain better to someone?",
    "What's a business idea you've never had time to explore?",
    "What would you create if you knew it couldn't fail?",
    "What do you need written that you've been dreading?",
    "What's a complex topic you want to understand in 5 minutes?",
    "What's a skill you want to learn but don't know where to start?",
    "What's a message you've been struggling to write?",
    "What would you build if you had a team of experts helping you?"
  ];

  var currentQuestion = '';

  function pickRandomQuestion(exclude) {
    var pool = QUESTIONS.filter(function (q) { return q !== exclude; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

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

  function setRandomPlaceholder(input) {
    currentQuestion = pickRandomQuestion(currentQuestion);
    input.placeholder = currentQuestion;
  }

  function flashError(input) {
    var prev = input.style.borderBottomColor;
    input.style.borderBottomColor = '#ff4444';
    setTimeout(function () { input.style.borderBottomColor = prev || ''; }, 800);
  }

  function init(bar) {
    var input = document.getElementById('whisperer-input');
    var btn   = document.getElementById('btn-whisperer-spark');
    if (!input || !btn || bar.dataset.pmgWhispWired === '1') return;
    bar.dataset.pmgWhispWired = '1';

    setRandomPlaceholder(input);

    function spark() {
      var answer = (input.value || '').trim();
      if (!answer) {
        flashError(input);
        try { input.focus(); } catch (_) {}
        return;
      }
      // The placeholder holds the question; the framed prompt uses
      // currentQuestion so the AI gets the full context.
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = 'I am answering this prompt: "' + currentQuestion + '" My answer: ' + answer;
        try { goal.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
        try { goal.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      }
      // Clear the whisperer so the bar feels "consumed" and ready for next time.
      input.value = '';
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

    // Public reset for Start Over / tests: clear value + rotate placeholder.
    window.PMGSpark.reset = function () {
      try { input.value = ''; } catch (_) {}
      setRandomPlaceholder(input);
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
