/* =============================================================
 * pmg-cap-intercept.js  (audit-3 §6)
 *
 * Global fetch interceptor: whenever any /api/* request returns
 * HTTP 429 with a structured cap-hit body, surface the existing
 * upgrade modal (window.showUpgradeModal from pmg-pro.js) so the
 * user sees a clear "upgrade for higher caps" CTA instead of the
 * generic "We Couldn't Reach The AI" error banner.
 *
 * Why a global wrapper instead of patching each caller:
 *   The app fires /api/run, /api/image, /api/video, /api/analyze
 *   from 9+ distinct fetch sites (app.html + pmg-visual-studio +
 *   pmg-storyboard + pmg-ux + pmg-image-extras). Patching each
 *   is high-risk and easy to regress. One global wrapper covers
 *   every current and future caller in ~50 lines.
 *
 * Why a wrapper not a Service Worker:
 *   SW would also intercept cross-origin requests + needs
 *   registration scope; for a dev-mode reload-clears product
 *   that's the wrong tool. Plain `window.fetch` monkey-patch is
 *   reversible and ships in one file.
 *
 * Safety:
 *   - Idempotent: only installs once (window.__pmgCapInterceptInstalled).
 *   - Pass-through on every status except 429 — the original
 *     Response is returned untouched. Callers see no change.
 *   - For 429, the wrapper clones the response, parses it, fires
 *     the modal, then returns the ORIGINAL Response so the caller's
 *     error-handling continues to run (their generic banner may
 *     also appear briefly behind the modal; modal is the primary
 *     feedback).
 *   - Kill-switch: ?capInterceptKey URL param OR
 *     localStorage.pmg_cap_intercept_disable='1'. Matches the
 *     convention documented in docs/scripts.md for every pmg-*.js
 *     mounter.
 *   - If window.showUpgradeModal is not yet defined (pmg-pro.js
 *     not loaded), the wrapper still runs but skips the modal —
 *     no errors.
 * ============================================================= */
(function () {
  if (window.__pmgCapInterceptInstalled) return;

  // Kill-switches (mirror convention from docs/scripts.md).
  try {
    var q = new URLSearchParams(window.location.search);
    if (q.has('capInterceptKey') || q.has('pmgCapInterceptDisable')) return;
  } catch (_) {}
  try {
    if (localStorage.getItem('pmg_cap_intercept_disable') === '1') return;
  } catch (_) {}

  window.__pmgCapInterceptInstalled = true;

  // Map server feature key → human-readable label used by
  // showUpgradeModal. Mirrors pmg-pro.js GATED labels so the
  // modal copy stays consistent across entry points.
  var FEATURE_LABELS = {
    run:       'Run With AI',
    img:       'Image Generation',
    vid:       'Video Generation',
    analyze:   'File And Image Analysis',
    storyboard:'Storyboard Studio',
    expert:    'Expert Command Center'
  };

  function labelFor(feature) {
    if (feature && FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
    return 'This Feature';
  }

  // Throttle: don't fire the modal more than once per 1.5s even
  // if the user rapid-fires retries. Avoids modal-on-modal flicker.
  var lastFireAt = 0;
  function fireModal(label) {
    var now = Date.now();
    if (now - lastFireAt < 1500) return;
    lastFireAt = now;
    try {
      if (typeof window.showUpgradeModal === 'function') {
        window.showUpgradeModal(label);
      }
    } catch (_) {}
  }

  var nativeFetch = window.fetch.bind(window);

  window.fetch = function pmgCapInterceptFetch(input, init) {
    var promise = nativeFetch(input, init);
    return promise.then(function (resp) {
      try {
        // Only inspect /api/* responses — leave everything else alone.
        if (!resp || resp.status !== 429) return resp;
        var url = '';
        try {
          if (typeof input === 'string') {
            url = input;
          } else if (input) {
            // Request has .url; URL has .href. Cover both — a future
            // caller doing fetch(new URL('/api/run', location.origin))
            // would otherwise silently bypass the interceptor.
            url = input.url || input.href || '';
          }
        } catch (_) {}
        // Match both absolute and relative /api/ paths.
        if (url.indexOf('/api/') === -1) return resp;

        // Clone before reading so the original body remains
        // available to the caller's own .json() / .text() call.
        var clone = resp.clone();
        clone.json().then(function (data) {
          if (!data || data.success === true || data.ok === true) return;
          fireModal(labelFor(data.feature));
        }).catch(function () {
          // Body wasn't JSON — still surface a generic modal so
          // the user gets a clear next step.
          fireModal(labelFor(null));
        });
      } catch (_) {}
      return resp;
    });
  };
})();
