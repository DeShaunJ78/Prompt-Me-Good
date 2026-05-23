/* pmg-optimize-toggle.js
 *
 * Adds a Build / Optimize segmented toggle above #goal. Build mode is the
 * default and is fully passive — the existing generate flow runs untouched.
 * Optimize mode intercepts #generateBtn clicks (via stopImmediatePropagation),
 * POSTs the textarea value to /api/boost, and writes data.result into
 * #resultBox using textContent (the canonical write pattern used by
 * pmg-result-states.js so other MutationObserver-driven scripts react).
 *
 * Kill-switch: localStorage.pmg_optimize_toggle_disable = '1'
 * Self-contained IIFE. Touches no other pmg* internals. Only mounts in the
 * text panel; CSS hides controls when body[data-active-panel] !== "text".
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
  var originalBtnLabel = null;
  var labelEl = null;
  var warningEl = null;
  var errorEl = null;
  var warningTimer = null;
  var errorTimer = null;
  var toggleWrap = null;
  var btnBuild = null;
  var btnOptimize = null;
  var goalEl = null;
  var generateBtn = null;

  var OPTIMIZE_PLACEHOLDER = "Paste your existing prompt here — we'll improve it.";
  var LABEL_TEXT = 'Your existing prompt';

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
    if (!goalEl) return;
    if (mode === MODE_OPTIMIZE) {
      goalEl.setAttribute('placeholder', OPTIMIZE_PLACEHOLDER);
      ensureLabel();
      if (generateBtn) generateBtn.textContent = 'Optimize My Prompt';
    } else {
      if (originalPlaceholder !== null) goalEl.setAttribute('placeholder', originalPlaceholder);
      removeLabel();
      removeNode(warningEl); warningEl = null;
      removeNode(errorEl); errorEl = null;
      if (generateBtn && originalBtnLabel !== null) generateBtn.textContent = originalBtnLabel;
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

  function setLoading(on) {
    if (!generateBtn) return;
    if (on) {
      generateBtn.classList.add('pmg-opt-loading');
      generateBtn.disabled = true;
      generateBtn.textContent = 'Optimizing…';
    } else {
      generateBtn.classList.remove('pmg-opt-loading');
      generateBtn.disabled = false;
      generateBtn.textContent = 'Optimize My Prompt';
    }
  }

  async function runOptimize() {
    var prompt = (goalEl && goalEl.value || '').trim();
    if (!prompt) {
      showWarning('Paste a prompt to optimize.');
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }

  /* Capture-phase listener with stopImmediatePropagation. Runs only when
     mode === optimize, so the existing generate flow is fully untouched
     in build mode. Must be in capture phase to fire before any bubbling
     bubble-phase listeners attached by earlier scripts. */
  function onGenerateClickCapture(e) {
    if (mode !== MODE_OPTIMIZE) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    runOptimize();
  }

  function buildToggle(parent) {
    toggleWrap = document.createElement('div');
    toggleWrap.className = 'pmg-opt-toggle-wrap';
    toggleWrap.setAttribute('role', 'tablist');
    toggleWrap.setAttribute('aria-label', 'Prompt mode');

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

    toggleWrap.appendChild(btnBuild);
    toggleWrap.appendChild(btnOptimize);
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
    /* The visible CTA is #analyze-btn (rendered by pmg-chassis-v3.js L375
       — "✨ Build My Prompt"). #generateBtn is the hidden legacy form
       button ("Fix My Prompt", app.html L4971) — never the user-clicked
       target in v3. Per replit.md "Chassis v3 is the only chassis loaded",
       so we REQUIRE #analyze-btn — letting tryMount's 200ms × 30-tick
       poll wait for chassis-v3 to render it. Falling back to #generateBtn
       on early polls caused the label updates to stomp the wrong (hidden)
       button and never reach the visible CTA. */
    generateBtn = document.getElementById('analyze-btn');
    if (!goalEl || !generateBtn || !goalEl.parentNode) return false;
    if (document.querySelector('.pmg-opt-toggle-wrap')) return true; /* already mounted */
    originalPlaceholder = goalEl.getAttribute('placeholder') || '';
    originalBtnLabel = generateBtn.textContent;
    buildToggle(goalEl.parentNode);
    generateBtn.addEventListener('click', onGenerateClickCapture, true);
    return true;
  }

  function tryMount() {
    if (mount()) return;
    /* Chassis-v3 reparents legacy DOM (#goal/#generateBtn/#resultBox) into
       v3 slots. The legacy nodes already exist in the document on load, so
       mount usually succeeds first try; poll briefly as a safety net for
       any future deferred-render scenarios. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (mount() || tries > 30) clearInterval(iv);
    }, 200);
  }

  ready(tryMount);
})();
