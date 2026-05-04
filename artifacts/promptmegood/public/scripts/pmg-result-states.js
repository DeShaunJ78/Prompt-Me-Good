/* =============================================================
 * pmg-result-states.js  (Task #29)
 *
 * Brings the prompt builder's result panel in line with the
 * Image Generator (pmg-image-fix.js) by giving #resultBox a
 * consistent set of empty / loading / error visuals:
 *
 *   1. Empty state  — styled placeholder card on first arrival.
 *   2. Loading state — skeleton lines (reuses the shared
 *                      `.pmg-skeleton-shimmer` class injected by
 *                      pmg-image-fix.js, so reduce-motion is
 *                      already honored).
 *   3. Error state  — inline banner with a clear "Try Again"
 *                     button that re-fires #generateBtn.
 *
 * Strictly additive: NO backend changes, NO renamed IDs,
 * existing streaming flow into #resultBox keeps working.
 * The overlay is injected as a sibling above #resultBox; when
 * the overlay is showing, #resultBox is visually hidden but
 * kept in the DOM so contenteditable / MutationObserver / copy
 * handlers continue to function.
 * ============================================================= */
(function () {
  if (window.__pmgResultStatesLoaded) return;
  window.__pmgResultStatesLoaded = true;

  var PLACEHOLDER = 'Your fixed prompt will appear here.';
  /* Only the in-flight generation status counts as "loading".
   * The empty-goal validation message ("Add a clear goal first…")
   * is intentionally NOT included — it's user feedback that
   * should be visible immediately, not hidden behind a skeleton. */
  var LOADING_TEXTS = [
    'Generating your prompt…'
  ];

  function inject(css) {
    var s = document.createElement('style');
    s.setAttribute('data-pmg-result-states', '1');
    s.textContent = css;
    document.head.appendChild(s);
  }

  inject([
    /* The overlay sits above #resultBox inside .result-wrap and
     * paints whichever state is active. */
    '.pmg-result-overlay{display:none;width:100%}',
    '.pmg-result-overlay[data-state="empty"],',
    '.pmg-result-overlay[data-state="loading"],',
    '.pmg-result-overlay[data-state="error"]{display:block}',

    /* When the overlay is taking over, hide the contenteditable
     * box so the user does not see two stacked surfaces. */
    '.result-wrap.pmg-overlay-active > #resultBox{display:none}',

    /* Empty state */
    '.pmg-result-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:200px;background:color-mix(in srgb, var(--color-primary) 4%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, var(--color-primary) 28%, var(--color-border));border-radius:var(--radius-lg);color:var(--color-text-muted)}',
    '.pmg-result-empty-icon{width:clamp(56px,12vw,84px);aspect-ratio:1;border-radius:var(--radius-lg);background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));display:flex;align-items:center;justify-content:center;font-size:clamp(26px,5vw,36px);color:var(--color-primary)}',
    '.pmg-result-empty-title{margin:0;font-size:var(--text-base);font-weight:700;color:var(--color-text)}',
    '.pmg-result-empty-text{margin:0;font-size:var(--text-sm);color:var(--color-text-muted);max-width:46ch;line-height:1.5}',

    /* Loading skeleton — line shapes that roughly match a
     * generated prompt (title-ish line + a few paragraph lines). */
    '.pmg-result-skeleton{display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-5);min-height:200px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-lg)}',
    '.pmg-result-skeleton-line{display:block;height:14px;border-radius:8px}',
    '.pmg-result-skeleton-line.is-title{height:20px;width:46%}',
    '.pmg-result-skeleton-line.is-long{width:100%}',
    '.pmg-result-skeleton-line.is-mid{width:88%}',
    '.pmg-result-skeleton-line.is-short{width:64%}',
    '.pmg-result-skeleton-status{margin:var(--space-2) 0 0;font-size:var(--text-sm);color:var(--color-text-muted);text-align:center}',

    /* Error banner */
    '.pmg-result-error{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:200px;background:color-mix(in srgb, var(--color-danger-strong) 8%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, var(--color-danger-strong) 38%, var(--color-border));border-radius:var(--radius-lg)}',
    '.pmg-result-error-icon{font-size:30px;line-height:1}',
    '.pmg-result-error-title{margin:0;font-size:var(--text-base);font-weight:700;color:var(--color-danger)}',
    '[data-theme="dark"] .pmg-result-error-title{color:var(--color-danger)}',
    '.pmg-result-error-text{margin:0;font-size:var(--text-sm);color:var(--color-text);max-width:48ch;line-height:1.5}',
    '.pmg-result-error-actions{display:flex;gap:var(--space-2);flex-wrap:wrap;justify-content:center;margin-top:var(--space-1)}',
    '.pmg-result-error-btn{min-height:44px;padding:10px 20px;border-radius:999px;background:var(--color-primary);color:#fff;font-weight:700;border:1.5px solid var(--color-primary);cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;font-size:var(--text-sm)}',
    '.pmg-result-error-btn:hover{filter:brightness(1.05)}',
    '.pmg-result-error-link{background:none;border:none;color:var(--color-text-muted);font-size:var(--text-sm);text-decoration:underline;cursor:pointer;padding:8px 12px;min-height:44px}'
  ].join(''));

  function isLoadingText(t) {
    var s = (t || '').replace(/\u00A0/g, ' ').trim();
    if (!s) return false;
    return LOADING_TEXTS.indexOf(s) !== -1;
  }

  function isPlaceholder(t) {
    var s = (t || '').replace(/\u00A0/g, ' ').trim();
    return s === '' || s === PLACEHOLDER;
  }

  function buildEmpty() {
    var wrap = document.createElement('div');
    wrap.className = 'pmg-result-empty';
    wrap.setAttribute('role', 'note');
    wrap.innerHTML = [
      '<div class="pmg-result-empty-icon" aria-hidden="true">✨</div>',
      '<p class="pmg-result-empty-title">Your Fixed Prompt Will Appear Here</p>',
      '<p class="pmg-result-empty-text">Fill in your goal and any details on the left, then tap the green button. We will build a clear, structured prompt you can copy, save, or run with AI right here.</p>'
    ].join('');
    return wrap;
  }

  function buildSkeleton() {
    var wrap = document.createElement('div');
    wrap.className = 'pmg-result-skeleton';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', 'Building your prompt');
    wrap.innerHTML = [
      '<span class="pmg-result-skeleton-line is-title pmg-skeleton-shimmer" aria-hidden="true"></span>',
      '<span class="pmg-result-skeleton-line is-long pmg-skeleton-shimmer" aria-hidden="true"></span>',
      '<span class="pmg-result-skeleton-line is-long pmg-skeleton-shimmer" aria-hidden="true"></span>',
      '<span class="pmg-result-skeleton-line is-mid pmg-skeleton-shimmer" aria-hidden="true"></span>',
      '<span class="pmg-result-skeleton-line is-short pmg-skeleton-shimmer" aria-hidden="true"></span>',
      '<p class="pmg-result-skeleton-status">Building Your Prompt…</p>'
    ].join('');
    return wrap;
  }

  function buildError(opts) {
    var hasFallback = !!(opts && opts.fallbackText);
    var wrap = document.createElement('div');
    wrap.className = 'pmg-result-error';
    wrap.setAttribute('role', 'alert');
    var actions =
      '<button type="button" class="pmg-result-error-btn" data-pmg-result-retry>' +
      '<span aria-hidden="true">↻</span> Try Again' +
      '</button>';
    if (hasFallback) {
      actions +=
        '<button type="button" class="pmg-result-error-link" data-pmg-result-use-fallback>' +
        'Use Backup Prompt' +
        '</button>';
    }
    wrap.innerHTML = [
      '<div class="pmg-result-error-icon" aria-hidden="true">⚠️</div>',
      '<p class="pmg-result-error-title">We Couldn\u2019t Reach The AI</p>',
      '<p class="pmg-result-error-text">Something went wrong while building your prompt. This usually clears up in a few seconds &mdash; tap Try Again to retry.</p>',
      '<div class="pmg-result-error-actions">' + actions + '</div>'
    ].join('');
    return wrap;
  }

  /** Trigger a fresh generation by re-firing the existing form. */
  function retry() {
    var form = document.getElementById('prompt-form');
    if (form && typeof form.requestSubmit === 'function') {
      try { form.requestSubmit(); return; } catch (_) {}
    }
    var btn = document.getElementById('generateBtn');
    if (btn) btn.click();
  }

  function isImageMode() {
    return document.body && document.body.classList.contains('image-mode');
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function init() {
    var resultBox = document.getElementById('resultBox');
    var resultWrap = resultBox && resultBox.parentElement;
    if (!resultBox || !resultWrap) return;

    /* Insert the overlay element right before #resultBox so it
     * lives in the same flex/grid flow. */
    var overlay = document.createElement('div');
    overlay.className = 'pmg-result-overlay';
    overlay.setAttribute('data-state', 'hidden');
    resultWrap.insertBefore(overlay, resultBox);

    var lastError = null;

    function showState(state, payload) {
      overlay.innerHTML = '';
      if (state === 'empty') {
        overlay.appendChild(buildEmpty());
      } else if (state === 'loading') {
        overlay.appendChild(buildSkeleton());
      } else if (state === 'error') {
        lastError = payload || null;
        overlay.appendChild(buildError(payload || {}));
      }
      overlay.setAttribute('data-state', state);
      if (state === 'hidden') {
        resultWrap.classList.remove('pmg-overlay-active');
      } else {
        resultWrap.classList.add('pmg-overlay-active');
      }
    }

    function refreshFromBox() {
      /* Do not touch image-mode — that flow has its own states
       * managed by pmg-image-fix.js. */
      if (isImageMode()) {
        showState('hidden');
        return;
      }
      var current = overlay.getAttribute('data-state');
      if (current === 'error') return; /* sticky until Try Again */
      var txt = resultBox.textContent || '';
      if (isPlaceholder(txt)) {
        showState('empty');
      } else if (isLoadingText(txt)) {
        showState('loading');
      } else {
        /* real content streamed/written in */
        showState('hidden');
      }
    }

    /* Initial render. */
    refreshFromBox();

    /* Watch for content changes coming from the existing
     * generation flow (setPromptText / streaming chunks /
     * finalize). */
    var mo = new MutationObserver(function () { refreshFromBox(); });
    mo.observe(resultBox, { childList: true, characterData: true, subtree: true });

    /* Catch the click on Generate so we can show the skeleton
     * the instant the user taps, even before any text has been
     * written into the box. Use capture so we beat the form
     * submit handler. */
    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        if (isImageMode()) return;
        /* Skip the skeleton if the form will fail validation
         * (currently: empty goal). Avoids a flash of skeleton
         * before the inline "Add a clear goal first…" nudge. */
        var goalInput = document.getElementById('goal');
        if (goalInput && !(goalInput.value || '').trim()) return;
        if (overlay.getAttribute('data-state') === 'error') {
          /* clear sticky error so a manual click also resets */
          overlay.setAttribute('data-state', 'hidden');
        }
        /* Defer one tick so the form submit can run any extra
         * validation and write its message first; then we
         * re-evaluate. */
        window.setTimeout(refreshFromBox, 0);
        showState('loading');
      }, true);
    }

    /* Hook into the explicit error event dispatched by the
     * generation flow's useLocalFallback. */
    document.addEventListener('pmg:builder-error', function (ev) {
      if (isImageMode()) return;
      var detail = (ev && ev.detail) || {};
      showState('error', { fallbackText: detail.fallbackText || '' });
    });

    /* Try Again / Use Backup wiring (event-delegated so
     * re-rendered banners keep working). */
    overlay.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var retryBtn = t.closest && t.closest('[data-pmg-result-retry]');
      if (retryBtn) {
        ev.preventDefault();
        showState('loading');
        retry();
        return;
      }
      var fbBtn = t.closest && t.closest('[data-pmg-result-use-fallback]');
      if (fbBtn) {
        ev.preventDefault();
        var text = lastError && lastError.fallbackText;
        if (text && typeof window.__pmgUseFallbackPrompt === 'function') {
          window.__pmgUseFallbackPrompt(text);
        } else if (text) {
          /* Last-resort: write straight into the box. */
          resultBox.textContent = text;
        }
        showState('hidden');
      }
    });

    /* Public API for index.html and tests. */
    window.__pmgResultStates = {
      showEmpty: function () { showState('empty'); },
      showLoading: function () { showState('loading'); },
      showError: function (opts) { showState('error', opts || {}); },
      hide: function () { showState('hidden'); },
      getState: function () { return overlay.getAttribute('data-state'); }
    };
  });
})();
