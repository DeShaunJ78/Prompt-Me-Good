/* pmg-stepper.js — Audit B (2026-05-15)
 *
 * 3-step "Describe → Refine → Output" progress indicator + sticky
 * "Your idea: …" recap bar above #goal in the Text panel.
 *
 * Architecture notes (from the audit):
 *   - /app is a one-step flow. The Text-panel CTA (#generateBtn,
 *     "Fix My Prompt") generates the optimized prompt directly.
 *     Tuning lives in #settingsPanel BELOW the button and is
 *     optional (Auto-Optimize on by default). The spec's two-step
 *     "Tune My Prompt → Generate Now" doesn't fit, so the stepper
 *     uses the labels that actually match what the user is doing:
 *     Describe (typing the goal) → Refine (tweaking optional tuning)
 *     → Output (result rendered in #resultBox).
 *   - State machine:
 *       Step 1 active by default.
 *       Goal has text → Step 2 active.
 *       #resultBox populates → Step 3 active, recap bar shown,
 *       output pulse fires.
 *   - Recap bar is a button. Click → smooth scrolls #goal to center.
 *
 * Kill-switch: ?stepperKey=0  OR  localStorage.pmg_stepper_disable='1'.
 *
 * Mounted via 200ms-poll because chassis-v3 reparents #goal into
 * #pmgv3-panel-text after our DOMContentLoaded fires.
 */
(function () {
  'use strict';

  var KS_PARAM = 'stepperKey';
  var KS_LOCAL = 'pmg_stepper_disable';
  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get(KS_PARAM) === '0') return;
    if (localStorage.getItem(KS_LOCAL) === '1') return;
  } catch (_) {}

  var STEPS = [
    { key: 'describe', label: 'Describe' },
    { key: 'refine',   label: 'Refine'   },
    { key: 'output',   label: 'Output'   }
  ];

  var state = 'describe';
  var resultSeen = false;
  /* Snapshot the placeholder text in #resultBox at mount time.
     Architect HIGH-1: chassis seeds #resultBox with
     "Your fixed prompt will appear here." (length > 30) which
     would falsely trigger the output step. We require both a
     length threshold AND content-differs-from-initial. */
  var initialResultText = '';

  function setStep(next) {
    var idx = -1;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === next) { idx = i; break; }
    if (idx < 0) return;
    state = next;
    var nodes = document.querySelectorAll('.pmg-stepper .pmg-stepper-step');
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].classList.toggle('is-active', j === idx);
      nodes[j].classList.toggle('is-done', j < idx);
      nodes[j].setAttribute('aria-current', j === idx ? 'step' : 'false');
    }
  }

  function buildStepperEl() {
    var ol = document.createElement('ol');
    ol.className = 'pmg-stepper';
    ol.setAttribute('aria-label', 'Prompt building progress');
    ol.setAttribute('data-testid', 'pmg-stepper');
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      var li = document.createElement('li');
      li.className = 'pmg-stepper-step' + (i === 0 ? ' is-active' : '');
      li.setAttribute('aria-current', i === 0 ? 'step' : 'false');
      li.setAttribute('data-step-key', s.key);
      li.setAttribute('data-testid', 'pmg-stepper-' + s.key);
      li.innerHTML =
        '<span class="pmg-stepper-num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="pmg-stepper-label">' + s.label + '</span>';
      ol.appendChild(li);
    }
    return ol;
  }

  function buildRecapEl() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-recap-bar';
    btn.setAttribute('data-testid', 'pmg-recap-bar');
    btn.setAttribute('aria-label', 'Jump back to your original goal');
    btn.hidden = true;
    btn.innerHTML =
      '<span class="pmg-recap-eyebrow" aria-hidden="true">Your idea</span>' +
      '<span class="pmg-recap-text" id="pmg-recap-text"></span>' +
      '<span class="pmg-recap-jump" aria-hidden="true">↑ Edit</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var goal = document.getElementById('goal');
      if (!goal) return;
      try {
        goal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {
        try { goal.scrollIntoView(); } catch (__) {}
      }
      setTimeout(function () {
        try { goal.focus({ preventScroll: true }); } catch (_) { try { goal.focus(); } catch (__) {} }
      }, 350);
    });
    return btn;
  }

  function updateRecap(text) {
    var textEl = document.getElementById('pmg-recap-text');
    if (!textEl) return;
    var trimmed = (text || '').trim();
    var preview = trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
    textEl.textContent = preview;
  }

  function showRecapIfReady() {
    var bar = document.querySelector('.pmg-recap-bar');
    var goal = document.getElementById('goal');
    if (!bar || !goal) return;
    var v = (goal.value || '').trim();
    if (!v) { bar.hidden = true; return; }
    updateRecap(v);
    bar.hidden = false;
  }

  function pulseOutput() {
    var rb = document.getElementById('resultBox');
    if (!rb) return;
    rb.classList.remove('pmg-output-pulse');
    /* force reflow so the keyframe re-fires on a second generate */
    void rb.offsetWidth;
    rb.classList.add('pmg-output-pulse');
    setTimeout(function () {
      try { rb.classList.remove('pmg-output-pulse'); } catch (_) {}
    }, 1100);
  }

  function activeIsTextPanel() {
    /* Stepper + recap belong to the Text flow only (per user scoping).
       Photography / Video panels have their own goal + result UI.
       Architect HIGH-2: chassis-v3 sets data-active-panel on
       .pmgv3-body, NOT on document.body. Observe the right node. */
    var host = document.querySelector('.pmgv3-body');
    if (!host) return true; /* before chassis mounts, assume text */
    var p = host.getAttribute('data-active-panel');
    return !p || p === 'text';
  }

  function refreshVisibility() {
    var wrap = document.querySelector('.pmg-progress-wrap');
    if (!wrap) return;
    wrap.hidden = !activeIsTextPanel();
  }

  function mount() {
    var goal = document.getElementById('goal');
    if (!goal) return false;
    var goalField = goal.closest('.field') || goal;
    var parent = goalField.parentElement;
    if (!parent) return false;
    if (parent.querySelector('.pmg-progress-wrap')) return true;

    var wrap = document.createElement('div');
    wrap.className = 'pmg-progress-wrap';
    wrap.setAttribute('data-testid', 'pmg-progress-wrap');
    wrap.appendChild(buildStepperEl());
    wrap.appendChild(buildRecapEl());
    parent.insertBefore(wrap, goalField);

    /* Wire goal input → step state + recap text */
    goal.addEventListener('input', function () {
      var v = (goal.value || '').trim();
      updateRecap(v);
      if (resultSeen) return; /* once output fired, don't drop back */
      if (v && state === 'describe') setStep('refine');
      else if (!v && !resultSeen) setStep('describe');
    });
    if ((goal.value || '').trim()) {
      setStep('refine');
      updateRecap(goal.value);
    }

    /* Watch #resultBox for content arrival → step 3 + pulse + recap.
       NOTE: chassis seeds #resultBox with placeholder copy (e.g.
       "Your fixed prompt will appear here.") that exceeds the 30-char
       threshold. Snapshot it at mount and require BOTH (length >= 30)
       AND (text !== initial snapshot) to count as real output. */
    var rb = document.getElementById('resultBox');
    if (rb) {
      initialResultText = (rb.textContent || '').trim();
      var hasRealResult = function () {
        var cur = (rb.textContent || '').trim();
        return cur.length >= 30 && cur !== initialResultText;
      };
      if ('MutationObserver' in window) {
        var mo = new MutationObserver(function () {
          if (hasRealResult() && !resultSeen) {
            resultSeen = true;
            setStep('output');
            showRecapIfReady();
            pulseOutput();
          } else if (!hasRealResult() && resultSeen) {
            /* result cleared (Edit / new session) — back to refine */
            resultSeen = false;
            var v2 = (goal.value || '').trim();
            setStep(v2 ? 'refine' : 'describe');
          }
        });
        mo.observe(rb, { childList: true, subtree: true, characterData: true });
      }
      if (hasRealResult()) {
        /* Restored from session — already had a result on mount. */
        resultSeen = true;
        setStep('output');
        showRecapIfReady();
      }
    }

    /* React to chassis panel switches (Text/Photo/Video).
       Observe .pmgv3-body (where chassis writes data-active-panel).
       It may not exist yet at mount time; if so, retry-observe via a
       short poll until found, then attribute-observe it. */
    if ('MutationObserver' in window) {
      var attachAttrObserver = function () {
        var host = document.querySelector('.pmgv3-body');
        if (!host) return false;
        var bmo = new MutationObserver(refreshVisibility);
        bmo.observe(host, { attributes: true, attributeFilter: ['data-active-panel'] });
        refreshVisibility();
        return true;
      };
      if (!attachAttrObserver()) {
        var ticks2 = 0;
        var iv2 = setInterval(function () {
          ticks2++;
          if (attachAttrObserver() || ticks2 > 40) clearInterval(iv2);
        }, 200);
      }
    }
    refreshVisibility();

    return true;
  }

  function tryMount() {
    if (mount()) return;
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (mount() || ticks > 40) clearInterval(iv); /* ~8s max */
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryMount);
  } else {
    tryMount();
  }
})();
