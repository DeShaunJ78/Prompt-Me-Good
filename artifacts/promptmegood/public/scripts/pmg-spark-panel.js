/* ============================================================================
   PromptMeGood — Prompt Whisperer Spark Panel (sp-1)
   Pure additive on-ramp that sits above the goal box in the Text panel.
   Cures "blank page syndrome" by asking one rotating curiosity question.
   On Submit: fills #goal with a framed answer + clicks #analyze-btn.
   On Skip/Close: hides itself and remembers the dismissal in localStorage.
   ============================================================================
   IMPORTANT — does NOT touch any existing chassis behaviour. The panel is
   built by pmg-chassis-v3.js inside #pmgv3-panel-text and is hidden until
   this script reveals it (so a previously-dismissed user never sees a flash).
   The spark panel uses #goal / #analyze-btn — the REAL ids in this codebase
   (the upstream brief assumed .pmgv3-goal-input / .pmgv3-analyze-btn which
   do not exist here).
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
    "What's a complex topic you want to understand in 5 minutes?"
  ];

  var DISMISS_KEY = 'pmg_spark_dismissed';

  function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // Mount poll: the chassis builds #pmgv3-spark-panel asynchronously
  // inside buildShell(). Wait up to ~30s (200ms × 150 ticks) before
  // giving up — same pattern other v3 helpers use.
  function whenReady(cb) {
    var ticks = 0;
    var t = setInterval(function () {
      var panel = document.getElementById('pmgv3-spark-panel');
      if (panel) { clearInterval(t); cb(panel); return; }
      if (++ticks > 150) { clearInterval(t); }
    }, 200);
  }

  function init(panel) {
    var qText  = document.getElementById('spark-question-text');
    var input  = document.getElementById('spark-answer-input');
    var btnGo  = document.getElementById('btn-spark-submit');
    var btnSkip = document.getElementById('btn-spark-skip');
    var btnX   = document.getElementById('btn-close-spark');
    if (!qText || !input || !btnGo || !btnSkip || !btnX) return;

    // Honor a prior dismissal — never show again until cleared.
    if (safeGet(DISMISS_KEY) === 'true') {
      panel.style.display = 'none';
      return;
    }

    // Pick a fresh random question each fresh open. Persists for THIS
    // pageload only so the user doesn't see it change if they re-focus.
    var question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    qText.textContent = question;

    // Reveal the panel (shell shipped it as display:none).
    panel.style.display = '';

    function dismiss() {
      panel.style.display = 'none';
      safeSet(DISMISS_KEY, 'true');
      var goal = document.getElementById('goal');
      if (goal) { try { goal.focus(); } catch (_) {} }
    }
    btnSkip.addEventListener('click', dismiss);
    btnX.addEventListener('click', dismiss);

    btnGo.addEventListener('click', function () {
      var answer = (input.value || '').trim();
      if (!answer) {
        input.classList.add('error-shake');
        setTimeout(function () { input.classList.remove('error-shake'); }, 500);
        try { input.focus(); } catch (_) {}
        return;
      }
      var origLabel = btnGo.textContent;
      btnGo.textContent = 'Building…';
      btnGo.disabled = true;

      try {
        var goal = document.getElementById('goal');
        if (goal) {
          // Frame the answer with the question for richer context.
          // Dispatch input so the chassis persistence + clear-button
          // visibility wiring see the new value.
          goal.value = 'I am answering this prompt: "' + question + '" My answer: ' + answer;
          try { goal.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
          try { goal.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        }

        // Hide the spark panel BUT do NOT mark it dismissed — if the user
        // bounces back to a fresh session they should see another spark.
        panel.style.display = 'none';

        // Click the existing Analyze button to trigger the auto-tune flow.
        var analyze = document.getElementById('analyze-btn');
        if (analyze) {
          analyze.click();
        } else if (window.console && console.warn) {
          console.warn('[spark] #analyze-btn not found — user must click manually.');
        }
      } catch (err) {
        if (window.console && console.error) console.error('[spark] submit failed:', err);
        btnGo.textContent = origLabel;
        btnGo.disabled = false;
      }
    });
  }

  // Test / debug hatch: window.PMGSpark.reset() clears the dismissal.
  window.PMGSpark = {
    reset: function () { try { localStorage.removeItem(DISMISS_KEY); } catch (_) {} },
    questions: QUESTIONS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { whenReady(init); });
  } else {
    whenReady(init);
  }
})();
