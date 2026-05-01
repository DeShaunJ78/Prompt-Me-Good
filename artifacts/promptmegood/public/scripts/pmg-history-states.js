/* =============================================================
 * pmg-history-states.js  (Task #33)
 *
 * Brings the saved prompt history list (#history-list) in line
 * with the prompt builder result panel (T29) and the Image
 * Generator (T24) by giving it a consistent set of:
 *
 *   1. Empty state  — styled card when there are no saved
 *                     prompts yet, or when filters/search
 *                     return zero matches.
 *   2. Loading state — brief skeleton list while history is
 *                      being read from localStorage on slow
 *                      devices. Reuses the shared
 *                      `.pmg-skeleton-shimmer` class injected
 *                      by pmg-image-fix.js so reduce-motion is
 *                      already honored.
 *   3. Error state  — inline styled banner with a "Reset
 *                     History" button when the saved JSON
 *                     fails to parse. No raw error text is
 *                     ever shown.
 *
 * Strictly additive: NO data shape changes, NO renamed IDs.
 * The inline renderHistory() in index.html calls these helpers
 * via window.__pmgHistoryStates; if the script has not loaded
 * yet (e.g. very first paint) the helpers no-op and the inline
 * code falls back to its previous plain-text output until the
 * next render.
 * ============================================================= */
(function () {
  if (window.__pmgHistoryStatesLoaded) return;
  window.__pmgHistoryStatesLoaded = true;

  function inject(css) {
    var s = document.createElement('style');
    s.setAttribute('data-pmg-history-states', '1');
    s.textContent = css;
    document.head.appendChild(s);
  }

  inject([
    /* Empty state — mirrors .pmg-result-empty visuals. */
    '.pmg-history-empty-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:180px;background:color-mix(in srgb, var(--color-primary) 4%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, var(--color-primary) 28%, var(--color-border));border-radius:var(--radius-lg);color:var(--color-text-muted)}',
    '.pmg-history-empty-icon{width:clamp(56px,12vw,84px);aspect-ratio:1;border-radius:var(--radius-lg);background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));display:flex;align-items:center;justify-content:center;font-size:clamp(26px,5vw,36px);color:var(--color-primary)}',
    '.pmg-history-empty-title{margin:0;font-size:var(--text-base);font-weight:700;color:var(--color-text)}',
    '.pmg-history-empty-text{margin:0;font-size:var(--text-sm);color:var(--color-text-muted);max-width:46ch;line-height:1.5}',

    /* "No matches" variant — softer, search-flavored. */
    '.pmg-history-empty-card.is-no-matches{background:var(--color-surface-2);border-style:dashed;border-color:var(--color-border)}',

    /* Loading skeleton — 3 stacked card placeholders that
     * roughly match a real history item (title row + preview
     * line + meta line). */
    '.pmg-history-skeleton{display:grid;gap:var(--space-3)}',
    '.pmg-history-skeleton-card{display:flex;flex-direction:column;gap:10px;padding:var(--space-4) var(--space-5);background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-lg)}',
    '.pmg-history-skeleton-row{display:flex;gap:10px;align-items:center}',
    '.pmg-history-skeleton-row > .pmg-history-skeleton-line{flex:0 0 auto}',
    '.pmg-history-skeleton-line{display:block;height:14px;border-radius:8px}',
    '.pmg-history-skeleton-line.is-title{height:18px;width:40%}',
    '.pmg-history-skeleton-line.is-meta{height:12px;width:22%;margin-left:auto}',
    '.pmg-history-skeleton-line.is-long{width:100%}',
    '.pmg-history-skeleton-line.is-mid{width:78%}',
    '.pmg-history-skeleton-status{margin:var(--space-2) 0 0;font-size:var(--text-sm);color:var(--color-text-muted);text-align:center}',

    /* Error banner — mirrors .pmg-result-error visuals. */
    '.pmg-history-error-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:180px;background:color-mix(in srgb, #dc2626 8%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, #dc2626 38%, var(--color-border));border-radius:var(--radius-lg)}',
    '.pmg-history-error-icon{font-size:30px;line-height:1}',
    '.pmg-history-error-title{margin:0;font-size:var(--text-base);font-weight:700;color:#b91c1c}',
    '[data-theme="dark"] .pmg-history-error-title{color:#fca5a5}',
    '.pmg-history-error-text{margin:0;font-size:var(--text-sm);color:var(--color-text);max-width:48ch;line-height:1.5}',
    '.pmg-history-error-actions{display:flex;gap:var(--space-2);flex-wrap:wrap;justify-content:center;margin-top:var(--space-1)}',
    '.pmg-history-error-btn{min-height:44px;padding:10px 20px;border-radius:999px;background:#dc2626;color:#fff;font-weight:700;border:1.5px solid #dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;font-size:var(--text-sm)}',
    '.pmg-history-error-btn:hover{filter:brightness(1.05)}'
  ].join(''));

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function emptyMarkup(opts) {
    opts = opts || {};
    var variant = opts.variant || 'no-items';
    var icon, title, text, extra = '';
    if (variant === 'no-matches') {
      icon = '🔍';
      title = opts.title || 'No matching prompts';
      text = opts.text || 'Try a different search, clear the tag filter, or hit Newest to reset the sort.';
      extra = ' is-no-matches';
    } else {
      icon = '✨';
      title = opts.title || 'No saved prompts yet';
      text = opts.text || 'Generate a prompt above and tap Save to start your vault. Your last 25 saves stay on this device.';
    }
    return (
      '<div class="pmg-history-empty-card' + extra + '" role="note">' +
        '<div class="pmg-history-empty-icon" aria-hidden="true">' + icon + '</div>' +
        '<p class="pmg-history-empty-title">' + escapeHtml(title) + '</p>' +
        '<p class="pmg-history-empty-text">' + escapeHtml(text) + '</p>' +
      '</div>'
    );
  }

  function skeletonMarkup() {
    var card =
      '<div class="pmg-history-skeleton-card" aria-hidden="true">' +
        '<div class="pmg-history-skeleton-row">' +
          '<span class="pmg-history-skeleton-line is-title pmg-skeleton-shimmer"></span>' +
          '<span class="pmg-history-skeleton-line is-meta pmg-skeleton-shimmer"></span>' +
        '</div>' +
        '<span class="pmg-history-skeleton-line is-long pmg-skeleton-shimmer"></span>' +
        '<span class="pmg-history-skeleton-line is-mid pmg-skeleton-shimmer"></span>' +
      '</div>';
    return (
      '<div class="pmg-history-skeleton" role="status" aria-live="polite" aria-label="Loading saved prompts">' +
        card + card + card +
        '<p class="pmg-history-skeleton-status">Loading saved prompts…</p>' +
      '</div>'
    );
  }

  function errorMarkup() {
    return (
      '<div class="pmg-history-error-card" role="alert">' +
        '<div class="pmg-history-error-icon" aria-hidden="true">⚠️</div>' +
        '<p class="pmg-history-error-title">We Couldn\u2019t Load Your History</p>' +
        '<p class="pmg-history-error-text">Your saved prompts file looks corrupted and can\u2019t be read. Reset to start fresh — this only clears what couldn\u2019t be loaded.</p>' +
        '<div class="pmg-history-error-actions">' +
          '<button type="button" class="pmg-history-error-btn" data-pmg-history-reset>' +
            '<span aria-hidden="true">↻</span> Reset History' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  window.__pmgHistoryStates = {
    renderEmpty: function (el, opts) {
      if (!el) return;
      el.innerHTML = emptyMarkup(opts || {});
    },
    renderSkeleton: function (el) {
      if (!el) return;
      el.innerHTML = skeletonMarkup();
    },
    renderError: function (el) {
      if (!el) return;
      el.innerHTML = errorMarkup();
    },
    emptyMarkup: emptyMarkup,
    skeletonMarkup: skeletonMarkup,
    errorMarkup: errorMarkup
  };
})();
