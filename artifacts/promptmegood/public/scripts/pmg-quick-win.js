/* ====================================================================
 * pmg-quick-win.js — "Earn the Workstation" onboarding
 * ====================================================================
 * First-time visitors get a focused single-input screen. They type
 * their idea, we run TWO sequential AI calls to /api/generate to
 * produce a Starter Blueprint (refined idea + strong prompt + 3
 * tailored next steps + suggested mode), then they click "Open
 * Workstation" to expand into the full app with their blueprint
 * carried into the goal field.
 *
 * Returning visitors (any of pmg.quickWinSeen, pmg.workstationTourSeen,
 * pmg_visited set, OR sessionStorage.pmg.quickWinShown set) skip
 * Quick Win Mode entirely. (`pmg_visited` is the durable key the rest
 * of the app already writes; see index.html PMG_VISITED_KEY.)
 *
 * Storage failure (incognito strict mode) gracefully degrades to a
 * window-level session flag so we don't loop within the same tab.
 * ==================================================================== */
(function pmgQuickWin() {
  'use strict';
  if (window.__PMG_QUICK_WIN__) return;
  window.__PMG_QUICK_WIN__ = true;

  /* ---------------- storage helpers (never throw) ---------------- */
  function ls(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }
  function ss(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function ssSet(key, val) {
    try { sessionStorage.setItem(key, val); } catch (_) {}
  }

  function hasReturningSignal() {
    /* Mirror of the inline-head detection: automation + URL escape
       hatch + persistent storage signals + session flag. Anything
       truthy means we should NOT show Quick Win. */
    try { if (navigator.webdriver === true) return true; } catch (_) {}
    try { if ((location.search || '').indexOf('pmg_skip_qw=1') !== -1) return true; } catch (_) {}
    return !!(ls('pmg.quickWinSeen') ||
              ls('pmg.workstationTourSeen') ||
              ls('pmg_visited') ||
              ss('pmg.quickWinShown') ||
              window.__PMG_QUICK_WIN_SHOWN__);
  }

  /* ---------------- mode detection (keyword rules) ---------------
     Master Link / Master Plan vocabulary is intentionally deferred
     (user pick 5C). Multi-step / sequence ideas just route to the
     standard Prompt Engine for now. */
  var MODE_RULES = [
    { mode: 'Photography Suite', keys: /\b(photo|photograph|image|picture|render|visual|product[- ]?shot|hero[- ]?image|thumbnail|cover[- ]?art|illustrat|portrait|landscape|dalle|midjourney)\b/i },
  ];
  function detectMode(text) {
    for (var i = 0; i < MODE_RULES.length; i++) {
      if (MODE_RULES[i].keys.test(text || '')) return MODE_RULES[i].mode;
    }
    return 'Prompt Engine';
  }

  /* ---------------- two-call blueprint generation --------------- */
  function callGenerate(goal) {
    return fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: goal })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return null; }).then(function (j) {
          var msg = (j && (j.error || j.message)) || ('Server returned ' + r.status);
          throw new Error(msg);
        });
      }
      return r.json();
    }).then(function (j) {
      if (!j || !j.success) throw new Error((j && j.error) || 'AI returned no result.');
      return (j.output || j.prompt || j.result || '').trim();
    });
  }

  /* Step 1: refine the user's raw idea + produce a strong prompt.
     We use a structured ask so the model returns refined-idea + prompt
     in one shot (still one HTTP call). */
  function generateRefinedAndPrompt(rawIdea) {
    var ask =
      'I have this rough idea: "' + rawIdea + '"\n\n' +
      'Reply with EXACTLY this format and nothing else:\n\n' +
      'REFINED IDEA: <one clear sentence restating my goal so it is sharp and specific>\n\n' +
      'PROMPT:\n<a polished, ready-to-use prompt I can paste into ChatGPT or another AI right now to get the best result for this goal. Be specific, structured, and complete.>';
    return callGenerate(ask).then(function (text) {
      var refined = '';
      var prompt = '';
      var rMatch = text.match(/REFINED IDEA:\s*([\s\S]*?)(?:\n\s*PROMPT:|$)/i);
      var pMatch = text.match(/PROMPT:\s*([\s\S]*)$/i);
      if (rMatch) refined = rMatch[1].trim();
      if (pMatch) prompt = pMatch[1].trim();
      /* Fallback: if the model ignored the format, treat the whole text
         as the prompt and synthesize a basic refined-idea line. */
      if (!prompt) {
        prompt = text;
        refined = rawIdea.trim().replace(/\s+/g, ' ').slice(0, 200);
      }
      if (!refined) refined = rawIdea.trim().replace(/\s+/g, ' ').slice(0, 200);
      return { refined: refined, prompt: prompt };
    });
  }

  /* Step 2: tailor 3 concrete next steps to the actual generated prompt. */
  function generateNextSteps(rawIdea, prompt) {
    var ask =
      'A user wanted: "' + rawIdea + '"\n\n' +
      'I just gave them this prompt:\n"""\n' + prompt.slice(0, 1200) + '\n"""\n\n' +
      'Give me EXACTLY 3 short, concrete next-step actions (each under 12 words) the user can do RIGHT NOW to make this prompt or its result better. ' +
      'Reply with EXACTLY this format and nothing else:\n' +
      '1. <step one>\n' +
      '2. <step two>\n' +
      '3. <step three>';
    return callGenerate(ask).then(function (text) {
      var steps = [];
      var lines = text.split(/\n+/);
      for (var i = 0; i < lines.length && steps.length < 3; i++) {
        var m = lines[i].match(/^\s*(?:[1-3][\.\)]|[\-\*])\s*(.+?)\s*$/);
        if (m && m[1]) steps.push(m[1]);
      }
      while (steps.length < 3) {
        steps.push(['Try a more specific subject or context.',
                    'Add a constraint or success criterion.',
                    'Run it, then ask the AI to revise.'][steps.length]);
      }
      return steps.slice(0, 3);
    });
  }

  /* ---------------- DOM helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  /* ---------------- main controller ---------------- */
  function init() {
    var overlay = $('pmg-quick-win-overlay');
    if (!overlay) return;

    /* Returning user: skip entirely, never show. */
    if (hasReturningSignal()) {
      try { document.documentElement.classList.remove('pmg-qw-pending'); } catch (_) {}
      overlay.parentNode && overlay.parentNode.removeChild(overlay);
      return;
    }

    /* Mark this session so reload doesn't re-show within same tab. */
    ssSet('pmg.quickWinShown', '1');
    window.__PMG_QUICK_WIN_SHOWN__ = true;

    var goalEl = $('pmg-qw-goal');
    var generateBtn = $('pmg-qw-generate');
    var progress = $('pmg-qw-progress');
    var progressStep = $('pmg-qw-progress-step');
    var errorBlock = $('pmg-qw-error');
    var errorText = $('pmg-qw-error-text');
    var retryBtn = $('pmg-qw-retry');
    var skipBtn = $('pmg-qw-skip');
    var blueprint = $('pmg-qw-blueprint');
    var bpRefined = $('pmg-qw-bp-refined');
    var bpPrompt = $('pmg-qw-bp-prompt');
    var bpSteps = $('pmg-qw-bp-steps');
    var bpMode = $('pmg-qw-bp-mode');
    var bpCopy = $('pmg-qw-bp-copy');
    var openWsBtn = $('pmg-qw-open-workstation');
    var restartBtn = $('pmg-qw-restart');

    var lastIdea = '';
    var lastBlueprint = null;

    /* Example chips */
    var chips = overlay.querySelectorAll('[data-pmg-qw-example]');
    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          if (goalEl) {
            goalEl.value = chip.getAttribute('data-pmg-qw-example') || '';
            goalEl.focus();
            try { goalEl.setSelectionRange(goalEl.value.length, goalEl.value.length); } catch (_) {}
          }
        });
      })(chips[i]);
    }

    /* Main generate flow — two sequential calls. */
    function startGenerate() {
      var raw = (goalEl && goalEl.value || '').trim();
      if (raw.length < 4) {
        if (goalEl) goalEl.focus();
        return;
      }
      lastIdea = raw;
      hide(errorBlock);
      hide(blueprint);
      generateBtn.disabled = true;
      show(progress);
      if (progressStep) progressStep.textContent = 'Refining your idea';

      generateRefinedAndPrompt(raw).then(function (r1) {
        if (progressStep) progressStep.textContent = 'Drafting your next steps';
        return generateNextSteps(raw, r1.prompt).then(function (steps) {
          return { refined: r1.refined, prompt: r1.prompt, steps: steps };
        });
      }).then(function (bp) {
        bp.mode = detectMode(raw + ' ' + bp.refined + ' ' + bp.prompt);
        lastBlueprint = bp;
        renderBlueprint(bp);
      }).catch(function (err) {
        showError(err && err.message ? err.message : 'Something went wrong.');
      }).finally(function () {
        generateBtn.disabled = false;
        hide(progress);
      });
    }

    function renderBlueprint(bp) {
      if (bpRefined) bpRefined.textContent = bp.refined;
      if (bpPrompt) bpPrompt.textContent = bp.prompt;
      if (bpMode) bpMode.textContent = bp.mode;
      if (bpSteps) {
        bpSteps.innerHTML = '';
        for (var i = 0; i < bp.steps.length; i++) {
          var li = document.createElement('li');
          li.textContent = bp.steps[i];
          bpSteps.appendChild(li);
        }
      }
      show(blueprint);
      if (openWsBtn) {
        try { openWsBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
      }
    }

    function showError(msg) {
      if (errorText) errorText.textContent = msg || 'Something went wrong drafting your blueprint.';
      show(errorBlock);
    }

    if (generateBtn) generateBtn.addEventListener('click', startGenerate);
    if (goalEl) {
      goalEl.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.keyCode === 13) && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          startGenerate();
        }
      });
    }
    if (retryBtn) retryBtn.addEventListener('click', function () {
      hide(errorBlock);
      startGenerate();
    });
    if (skipBtn) skipBtn.addEventListener('click', function () {
      revealWorkstation(null);
    });
    if (restartBtn) restartBtn.addEventListener('click', function () {
      hide(blueprint);
      hide(errorBlock);
      lastBlueprint = null;
      if (goalEl) { goalEl.value = ''; goalEl.focus(); }
    });
    if (openWsBtn) openWsBtn.addEventListener('click', function () {
      revealWorkstation(lastBlueprint);
    });
    if (bpCopy) bpCopy.addEventListener('click', function () {
      var txt = (bpPrompt && bpPrompt.textContent) || '';
      try {
        navigator.clipboard.writeText(txt).then(function () {
          bpCopy.textContent = 'Copied';
          setTimeout(function () { bpCopy.textContent = 'Copy'; }, 1500);
        });
      } catch (_) {}
    });

    /* Focus the textarea once the overlay is interactable. */
    setTimeout(function () { if (goalEl) try { goalEl.focus(); } catch (_) {} }, 50);
  }

  /* ---------------- reveal: expansion animation + carry blueprint ---------------- */
  function revealWorkstation(bp) {
    /* Mark seen so we never show again. Also mark the post-run-intro
       modal seen — the user already had their unlock moment via Quick
       Win, so the duplicate intro should not pop later. The modal
       gate in index.html reads exactly this key. */
    lsSet('pmg.quickWinSeen', String(Date.now()));
    lsSet('promptmegood:postRunTourIntroSeen:v1', '1');

    var html = document.documentElement;
    var overlay = $('pmg-quick-win-overlay');

    /* Carry blueprint into the workstation BEFORE the reveal so the
       workstation appears with the user's idea already loaded. */
    if (bp && bp.refined) {
      try {
        var goal = document.getElementById('goal');
        if (goal) {
          /* Use the refined idea as the goal; it's the most actionable
             carry-over. The strong prompt is shown via copy in the
             intro modal we suppressed — user already has it. */
          goal.value = bp.refined;
          /* Fire input event so any existing autosave / counters update. */
          goal.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (_) {}
    }

    /* Animate: cross-fade overlay out + body content in. CSS handles it. */
    html.classList.remove('pmg-qw-pending');
    html.classList.add('pmg-qw-revealing');

    if (overlay) {
      overlay.classList.add('pmg-qw-leaving');
      setTimeout(function () {
        try { overlay.parentNode && overlay.parentNode.removeChild(overlay); } catch (_) {}
        html.classList.remove('pmg-qw-revealing');
        /* Smoothly scroll the user to the goal area where their blueprint
           was carried, so they see continuity. */
        try {
          var target = document.getElementById('goal') || document.getElementById('builder');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
        /* Optionally focus the goal field so they can keep typing. */
        try {
          var goal = document.getElementById('goal');
          if (goal && bp && bp.refined) {
            goal.focus();
            goal.setSelectionRange(goal.value.length, goal.value.length);
          }
        } catch (_) {}
      }, 750);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
