/* pmg-optimize-toggle.js (opt-8, 2026-05-23)
 *
 * Adds a Build / Optimize segmented toggle above #goal. The toggle hijacks
 * the existing primary CTA (#analyze-btn — "✨ Build My Prompt") rather
 * than adding a second submit button:
 *
 *   - Build mode (default): #analyze-btn keeps its original label and the
 *     existing chassis-v3 analyze flow runs untouched.
 *   - Optimize mode: #analyze-btn label becomes "✨ Optimize My Prompt".
 *     Clicks are intercepted in the capture phase and routed to /api/boost
 *     instead of the analyze flow. data.result is written into #resultBox
 *     via textContent (the canonical write pattern, mirrors
 *     pmg-result-states.js:283 so MutationObservers in pmg-ux.js etc. fire).
 *
 * Kill-switch: localStorage.pmg_optimize_toggle_disable = '1'
 * Self-contained IIFE. Touches no other pmg* internals except the
 * #analyze-btn label + a capture-phase click intercept that ONLY fires
 * when Optimize mode is active. Only mounts in the text panel; CSS hides
 * the toggle when body[data-active-panel] !== "text".
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_optimize_toggle_disable') === '1') return;
  } catch (_) { /* localStorage blocked — proceed without kill-switch */ }

  var MODE_BUILD = 'build';
  var MODE_OPTIMIZE = 'optimize';
  var mode = MODE_BUILD;

  var originalPlaceholder = null;
  var originalAnalyzeLabel = null;
  var labelEl = null;
  var warningEl = null;
  var errorEl = null;
  var warningTimer = null;
  var errorTimer = null;
  var toggleWrap = null;
  var btnBuild = null;
  var btnOptimize = null;
  var goalEl = null;

  var OPTIMIZE_PLACEHOLDER = "Paste your existing prompt here — we'll improve it.";
  var OPTIMIZE_BTN_LABEL = '✨ Optimize My Prompt';
  var LABEL_TEXT = 'Your existing prompt';
  var BUILD_RESULT_TITLE = 'Your Built Prompt Will Appear Here';
  var OPTIMIZE_RESULT_TITLE = 'Your Optimized Prompt Will Appear Here';

  function setResultTitle(text) {
    /* Two render paths exist: chassis-v3's .pmgv3-rp-title (visible in v3)
       and the legacy #result-title h2 (app.html L5308). Update both so
       whichever is visible reflects the active mode. */
    var v3 = document.querySelector('.pmgv3-rp-title');
    if (v3) v3.textContent = text;
    var legacy = document.getElementById('result-title');
    if (legacy) legacy.textContent = text;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function clearTimer(t) { if (t) { try { clearTimeout(t); } catch (_) {} } }

  function removeNode(n) {
    if (n && n.parentNode) {
      try { n.parentNode.removeChild(n); } catch (_) {}
    }
  }

  function getAnalyzeBtn() {
    return document.getElementById('analyze-btn') || document.querySelector('.btn-analyze');
  }

  function captureOriginalAnalyzeLabel() {
    if (originalAnalyzeLabel !== null) return;
    var btn = getAnalyzeBtn();
    if (btn) originalAnalyzeLabel = btn.textContent || '';
  }

  function setAnalyzeLabel(text) {
    var btn = getAnalyzeBtn();
    if (btn && text != null) btn.textContent = text;
  }

  function setAnalyzeBusy(on) {
    var btn = getAnalyzeBtn();
    if (!btn) return;
    if (on) {
      btn.classList.add('pmg-opt-loading');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      btn.textContent = 'Optimizing…';
    } else {
      btn.classList.remove('pmg-opt-loading');
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      btn.textContent = mode === MODE_OPTIMIZE ? OPTIMIZE_BTN_LABEL : (originalAnalyzeLabel || '✨ Build My Prompt');
    }
  }

  function showWarning(text) {
    if (!goalEl || !goalEl.parentNode) return;
    if (!warningEl) {
      warningEl = document.createElement('p');
      warningEl.className = 'pmg-opt-warning';
      warningEl.setAttribute('role', 'status');
      warningEl.setAttribute('aria-live', 'polite');
    }
    warningEl.textContent = text;
    if (warningEl.parentNode !== goalEl.parentNode) {
      goalEl.parentNode.insertBefore(warningEl, goalEl.nextSibling);
    }
    clearTimer(warningTimer);
    warningTimer = setTimeout(function () { removeNode(warningEl); warningEl = null; }, 3000);
  }

  function showError(text) {
    var resultBox = document.getElementById('resultBox');
    if (!resultBox || !resultBox.parentNode) return;
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'pmg-opt-error';
      errorEl.setAttribute('role', 'alert');
    }
    errorEl.textContent = text;
    if (errorEl.parentNode !== resultBox.parentNode) {
      resultBox.parentNode.insertBefore(errorEl, resultBox.nextSibling);
    }
    clearTimer(errorTimer);
    errorTimer = setTimeout(function () { removeNode(errorEl); errorEl = null; }, 5000);
  }

  function ensureLabel() {
    if (!goalEl || !goalEl.parentNode) return;
    if (labelEl && labelEl.parentNode === goalEl.parentNode) return;
    labelEl = document.createElement('span');
    labelEl.className = 'pmg-opt-label';
    labelEl.textContent = LABEL_TEXT;
    goalEl.parentNode.insertBefore(labelEl, goalEl);
  }

  function removeLabel() {
    removeNode(labelEl);
    labelEl = null;
  }

  function applyMode(next) {
    mode = next;
    if (btnBuild) btnBuild.setAttribute('aria-selected', mode === MODE_BUILD ? 'true' : 'false');
    if (btnOptimize) btnOptimize.setAttribute('aria-selected', mode === MODE_OPTIMIZE ? 'true' : 'false');
    if (toggleWrap) toggleWrap.setAttribute('data-mode', mode);
    /* Also stamp body so other styles / scripts can react if needed. */
    try { document.body.setAttribute('data-pmg-opt-mode', mode); } catch (_) {}
    if (!goalEl) return;
    captureOriginalAnalyzeLabel();
    if (mode === MODE_OPTIMIZE) {
      goalEl.setAttribute('placeholder', OPTIMIZE_PLACEHOLDER);
      ensureLabel();
      setResultTitle(OPTIMIZE_RESULT_TITLE);
      setAnalyzeLabel(OPTIMIZE_BTN_LABEL);
    } else {
      if (originalPlaceholder !== null) goalEl.setAttribute('placeholder', originalPlaceholder);
      removeLabel();
      removeNode(warningEl); warningEl = null;
      removeNode(errorEl); errorEl = null;
      setResultTitle(BUILD_RESULT_TITLE);
      if (originalAnalyzeLabel !== null) setAnalyzeLabel(originalAnalyzeLabel);
    }
  }

  async function getAuthHeader() {
    try {
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getSession === 'function') {
        var res = await window.supabase.auth.getSession();
        var token = res && res.data && res.data.session && res.data.session.access_token;
        if (token) return { Authorization: 'Bearer ' + token };
      }
    } catch (_) { /* fall through to no auth */ }
    return {};
  }

  async function runOptimize() {
    if (mode !== MODE_OPTIMIZE) return;
    var prompt = (goalEl && goalEl.value || '').trim();
    if (!prompt) {
      showWarning('Paste a prompt to optimize.');
      return;
    }
    setAnalyzeBusy(true);
    try {
      var headers = Object.assign(
        { 'Content-Type': 'application/json', Accept: 'application/json' },
        await getAuthHeader()
      );
      var res = await fetch('/api/boost', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ prompt: prompt, source: 'optimize-toggle' }),
      });
      var data = await res.json().catch(function () { return {}; });
      var out = (data && (data.result || data.output)) || '';
      if (!res.ok || !out) {
        showError("Couldn't optimize. Try again.");
        return;
      }
      var resultBox = document.getElementById('resultBox');
      if (resultBox) {
        /* Mirror pmg-result-states.js:283 — textContent write triggers
           the MutationObservers in pmg-ux.js / pmg-growth-actions.js so
           dependent UI (copy buttons, what-next block, etc.) updates. */
        resultBox.textContent = out;
        try { resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
      }
    } catch (_) {
      showError("Couldn't optimize. Try again.");
    } finally {
      setAnalyzeBusy(false);
    }
  }

  /* Capture-phase intercept on #analyze-btn. ONLY hijacks the click when
     Optimize mode is active — in Build mode the listener is a pure no-op
     so the chassis-v3 analyze flow runs untouched. Document-level so we
     survive chassis-v3 reparenting / re-creating the button. */
  function installAnalyzeIntercept() {
    if (document.__pmgOptInterceptBound) return;
    document.__pmgOptInterceptBound = true;
    document.addEventListener('click', function (e) {
      if (mode !== MODE_OPTIMIZE) return;
      var t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      var hit = t.closest('#analyze-btn, .btn-analyze');
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      runOptimize();
    }, true);
  }

  function buildToggle(parent) {
    toggleWrap = document.createElement('div');
    toggleWrap.className = 'pmg-opt-toggle-wrap';
    toggleWrap.setAttribute('data-mode', MODE_BUILD);

    var pills = document.createElement('div');
    pills.className = 'pmg-opt-pills';
    pills.setAttribute('role', 'tablist');
    pills.setAttribute('aria-label', 'Prompt mode');

    btnBuild = document.createElement('button');
    btnBuild.type = 'button';
    btnBuild.className = 'pmg-opt-btn';
    btnBuild.textContent = 'Build';
    btnBuild.setAttribute('role', 'tab');
    btnBuild.setAttribute('aria-selected', 'true');
    btnBuild.addEventListener('click', function () { applyMode(MODE_BUILD); });

    btnOptimize = document.createElement('button');
    btnOptimize.type = 'button';
    btnOptimize.className = 'pmg-opt-btn';
    btnOptimize.textContent = 'Optimize';
    btnOptimize.setAttribute('role', 'tab');
    btnOptimize.setAttribute('aria-selected', 'false');
    btnOptimize.addEventListener('click', function () { applyMode(MODE_OPTIMIZE); });

    pills.appendChild(btnBuild);
    pills.appendChild(btnOptimize);
    toggleWrap.appendChild(pills);

    /* Anchor strategy: prefer the chassis-v3 idea-host (.pmgv3-idea-host)
       so the toggle sits ABOVE the entire .field.field-primary block
       (and thus above any chassis-generated eyebrow/helper). Falling back
       to goalEl.parentNode keeps the legacy non-v3 layout working too. */
    var ideaHost = document.querySelector('.pmgv3-idea-host');
    if (ideaHost) {
      var fieldPrimary = goalEl.closest('.field') || goalEl;
      ideaHost.insertBefore(toggleWrap, fieldPrimary);
    } else {
      parent.insertBefore(toggleWrap, goalEl);
    }
  }

  function mount() {
    goalEl = document.getElementById('goal');
    if (!goalEl || !goalEl.parentNode) return false;
    if (document.querySelector('.pmg-opt-toggle-wrap')) return true; /* already mounted */
    originalPlaceholder = goalEl.getAttribute('placeholder') || '';
    buildToggle(goalEl.parentNode);
    captureOriginalAnalyzeLabel();
    installAnalyzeIntercept();
    /* Default mode is Build — sync the result-panel heading from the
       hardcoded "Optimized" copy to the Build copy on first paint. */
    setResultTitle(BUILD_RESULT_TITLE);
    return true;
  }

  function tryMount() {
    if (mount()) return;
    /* Chassis-v3 reparents legacy DOM (#goal/#resultBox) into v3 slots.
       The legacy nodes already exist in the document on load, so mount
       usually succeeds first try; poll briefly as a safety net for any
       future deferred-render scenarios. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (mount() || tries > 30) clearInterval(iv);
    }, 200);
  }

  ready(tryMount);
})();
