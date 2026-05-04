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
    /* Compact variant — for tighter contexts (Tag Insights aside,
     * global search dropdown popover). Same chrome, smaller padding
     * + icon, no enforced min-height so the card fits naturally. */
    '.pmg-history-empty-card.is-compact{min-height:0;padding:var(--space-4) var(--space-3);gap:10px}',
    '.pmg-history-empty-card.is-compact .pmg-history-empty-icon{width:clamp(40px,9vw,52px);font-size:clamp(20px,3.5vw,24px);border-radius:var(--radius-md)}',
    '.pmg-history-empty-card.is-compact .pmg-history-empty-title{font-size:var(--text-sm)}',
    '.pmg-history-empty-card.is-compact .pmg-history-empty-text{font-size:12px;overflow-wrap:anywhere}',

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
    '.pmg-history-error-btn:hover{filter:brightness(1.05)}',

    /* Inline write-blocked warning banner — same color family as
     * .pmg-history-error-card but slim, dismissible, and meant to
     * sit ABOVE the existing list (we never destroy the list). */
    '.pmg-history-write-warning{display:flex;align-items:flex-start;gap:var(--space-3);padding:12px 14px;margin:0 0 var(--space-3);background:color-mix(in srgb, #dc2626 8%, var(--color-surface-2));border:1.5px solid color-mix(in srgb, #dc2626 38%, var(--color-border));border-radius:var(--radius-lg);color:var(--color-text);font-size:var(--text-sm);line-height:1.45;animation:pmg-write-warn-in .22s ease-out both}',
    '@keyframes pmg-write-warn-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion: reduce){.pmg-history-write-warning{animation:none}}',
    '.pmg-history-write-warning-icon{flex:0 0 auto;font-size:18px;line-height:1.2;margin-top:1px}',
    '.pmg-history-write-warning-body{flex:1 1 auto;min-width:0}',
    '.pmg-history-write-warning-title{margin:0 0 2px;font-size:var(--text-sm);font-weight:700;color:#b91c1c}',
    '[data-theme="dark"] .pmg-history-write-warning-title{color:#fca5a5}',
    '.pmg-history-write-warning-text{margin:0;font-size:13px;color:var(--color-text);overflow-wrap:anywhere}',
    '.pmg-history-write-warning-dismiss{flex:0 0 auto;align-self:flex-start;background:transparent;border:0;color:var(--color-text-muted);font-size:18px;line-height:1;padding:4px 6px;cursor:pointer;border-radius:6px;min-width:32px;min-height:32px;display:inline-flex;align-items:center;justify-content:center}',
    '.pmg-history-write-warning-dismiss:hover{background:color-mix(in srgb, #dc2626 12%, transparent);color:#b91c1c}',
    '.pmg-history-write-warning-dismiss:focus-visible{outline:2px solid #dc2626;outline-offset:2px}',
    '[data-theme="dark"] .pmg-history-write-warning-dismiss:hover{color:#fca5a5;background:color-mix(in srgb, #fca5a5 12%, transparent)}',
    '[data-theme="dark"] .pmg-history-write-warning-dismiss:focus-visible{outline-color:#fca5a5}'
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
    if (opts.icon) icon = opts.icon;
    if (opts.extraClass) extra += ' ' + opts.extraClass;
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

  var WRITE_WARNING_ID = 'pmg-history-write-warning';

  function findHistoryAnchor() {
    return document.getElementById('history-list');
  }

  function ensureWriteWarningEl(message) {
    var existing = document.getElementById(WRITE_WARNING_ID);
    if (existing) {
      var textEl = existing.querySelector('.pmg-history-write-warning-text');
      if (textEl && message) textEl.textContent = message;
      existing.hidden = false;
      return existing;
    }
    var anchor = findHistoryAnchor();
    if (!anchor || !anchor.parentNode) return null;
    var banner = document.createElement('div');
    banner.id = WRITE_WARNING_ID;
    banner.className = 'pmg-history-write-warning';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML =
      '<span class="pmg-history-write-warning-icon" aria-hidden="true">⚠️</span>' +
      '<div class="pmg-history-write-warning-body">' +
        '<p class="pmg-history-write-warning-title">Saving to this browser is blocked</p>' +
        '<p class="pmg-history-write-warning-text">' + escapeHtml(message || '') + '</p>' +
      '</div>' +
      '<button type="button" class="pmg-history-write-warning-dismiss" aria-label="Dismiss this warning">×</button>';
    var btn = banner.querySelector('.pmg-history-write-warning-dismiss');
    if (btn) {
      btn.addEventListener('click', function () {
        hideWriteError();
      });
    }
    anchor.parentNode.insertBefore(banner, anchor);
    return banner;
  }

  function showWriteError(message) {
    var msg = message || "Your browser isn\u2019t letting us save prompts on this device. Copy anything important before you leave \u2014 it won\u2019t be in your vault on refresh.";
    return ensureWriteWarningEl(msg);
  }

  function hideWriteError() {
    var el = document.getElementById(WRITE_WARNING_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
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
    showWriteError: showWriteError,
    hideWriteError: hideWriteError,
    emptyMarkup: emptyMarkup,
    skeletonMarkup: skeletonMarkup,
    errorMarkup: errorMarkup
  };
})();
