/* PromptMeGood UX overlays — consolidated from pmg-bugfix + pmg-fixes-v2/v3/v4/v5/v6.
 *
 * Each former file kept as a self-contained IIFE block so the original
 * `__PMG_FIXES_V*` / `__pmg_v5_*` / `__pmgFixesV2Initialized` re-entry guards
 * still apply, but the page now only loads one consolidated UX script.
 *
 * Class aliases collapsed to a single canonical name:
 *   - Marketing-section reveal: only `.pmg-marketing-section.revealed` is used
 *     to gate desktop-below-fold content. The legacy `.pmg-revealed` (v5)
 *     and `.pmg-marketing` / `.pmg-shown` (v6) aliases were dropped.
 *   - "What next" post-gen block: v5 used to build `.pmg-wn-grid` and v6
 *     hid it via `.pmg-stacked`; the v5 grid build is gone, the v6 stack
 *     renders directly.
 *
 * pmg-image-fix.js and post-spec.js intentionally remain separate.
 */

/* ====================================================================
 * pmg-bugfix.js
 * ==================================================================== */
(function () {
  'use strict';

  /* ================================================================
   * BUG 1 — Force scroll-to-top on page load (no result-panel jump)
   * ================================================================ */
  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) {}

  /* Hashes that point to in-app form/builder regions. If a user clicks the
     hero CTA (href="#builder") and then returns to the homepage later via
     bookmark, refresh, browser history, or a shared link, the browser will
     auto-scroll past the hero and land them straight on the Fix My Prompt
     box — confusing on mobile in particular. Strip these hashes on a fresh
     page load (defense-in-depth — the head-inline script in index.html is
     the primary path; this is the fallback if it gets blocked).

     IMPORTANT: We snapshot the initial hash at script-start and only strip
     that exact value, exactly once. This guarantees we never strip a hash
     that was set later by an in-page click (e.g. user tapping the hero CTA
     before DOMContentLoaded fires on slow mobile). */
  var INAPP_HASHES = ['#builder', '#goal'];
  var initialHashAtLoad = '';
  try { initialHashAtLoad = window.location.hash || ''; } catch (e) {}
  var didStripInitialHash = false;

  function isFreshPageLoad() {
    try {
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
      if (nav && nav.type) return nav.type === 'navigate' || nav.type === 'reload' || nav.type === 'back_forward';
      if (performance.navigation) {
        var t = performance.navigation.type;
        return t === 0 || t === 1 || t === 2;
      }
    } catch (e) {}
    return true;
  }

  function maybeStripInitialHash() {
    if (didStripInitialHash) return false;
    try {
      var current = window.location.hash;
      /* Only strip if the hash is still exactly the initial-load hash AND
         the initial hash is one of the in-app builder hashes AND this is a
         fresh navigation (not a stripping triggered by a later user click). */
      if (
        current &&
        current === initialHashAtLoad &&
        INAPP_HASHES.indexOf(current) !== -1 &&
        isFreshPageLoad()
      ) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        didStripInitialHash = true;
        return true;
      }
    } catch (e) {}
    didStripInitialHash = true; /* never try again — avoids racing later clicks */
    return false;
  }

  function scrollTopIfNoHashOrStripped() {
    try {
      if (!window.location.hash) {
        window.scrollTo(0, 0);
      }
    } catch (e) {}
  }

  /* Run as early as possible so we beat the browser's anchor-scroll. */
  maybeStripInitialHash();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrollTopIfNoHashOrStripped, { once: true });
  } else {
    scrollTopIfNoHashOrStripped();
  }
  window.addEventListener('load', scrollTopIfNoHashOrStripped, { once: true });

  /* ================================================================
   * BUG 4 — Hide post-generation tools until a prompt exists
   * ================================================================ */
  var STORAGE_KEY = 'pmg_has_generated';
  var PLACEHOLDER = 'Your fixed prompt will appear here.';

  function injectVisibilityCss() {
    if (document.getElementById('pmg-bugfix-result-visibility')) return;
    var hideSelectors = [
      'body:not(.pmg-has-result) #quality-row',
      'body:not(.pmg-has-result) #copy-btn',
      'body:not(.pmg-has-result) #share-btn',
      'body:not(.pmg-has-result) #print-btn',
      'body:not(.pmg-has-result) #clear-prompt-btn',
      'body:not(.pmg-has-result) #improve-block',
      'body:not(.pmg-has-result) #fine-tune-row',
      'body:not(.pmg-has-result) .fine-tune',
      'body:not(.pmg-has-result) #undo-btn',
      'body:not(.pmg-has-result) .undo-row',
      'body:not(.pmg-has-result) #runSection',
      'body:not(.pmg-has-result) .what-next',
      'body:not(.pmg-has-result) #what-next',
      'body:not(.pmg-has-result) .open-in-block',
      'body:not(.pmg-has-result) .save-tip',
      'body:not(.pmg-has-result) #strength-score',
      'body:not(.pmg-has-result) #aiResponseSection',
      'body:not(.pmg-has-result) .pmg-post-gen'
    ].join(',\n');
    /* These elements use the HTML `hidden` attribute by default. When the
       result is revealed via CSS only (no finalize() call), `hidden` keeps
       them invisible — explicit reveal rules override that. */
    var revealSelectors = [
      'body.pmg-has-result #runSection',
      'body.pmg-has-result #aiResponseSection'
    ].join(',\n');
    var css =
      hideSelectors + ' { display: none !important; }\n' +
      revealSelectors + ' { display: block !important; }\n';
    var s = document.createElement('style');
    s.id = 'pmg-bugfix-result-visibility';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function hasRealPrompt(text) {
    if (!text) return false;
    var t = String(text).trim();
    if (!t) return false;
    /* Case-insensitive comparison: a downstream title-case sweep can rewrite
       "Your fixed prompt will appear here." to "Your Fixed Prompt Will Appear Here."
       and any case-sensitive match would silently miss it, marking the empty
       placeholder as a real generated prompt. */
    var lo = t.toLowerCase();
    var placeholders = [
      'your fixed prompt will appear here',
      'your generated prompt will appear here',
      'generating your prompt',
      'generating demo prompt',
      'please enter a goal',
      'add a clear goal first',
      'could not generate'
    ];
    for (var i = 0; i < placeholders.length; i++) {
      if (lo.indexOf(placeholders[i]) === 0) return false;
    }
    /* require at least 30 non-whitespace chars to count as a real prompt */
    return t.replace(/\s+/g, '').length >= 30;
  }

  function markHasResult() {
    if (document.body) {
      document.body.classList.add('pmg-has-result');
      /* keep in sync with the existing v3 visibility gate so .pmg-post-gen
         elements are also revealed on returning visits */
      document.body.classList.add('pmg-has-generated');
      document.body.classList.remove('pmg-pre-gen');
    }
    /* v3 expects the literal string 'true'; v4 accepts both 'true' and '1'.
       Write 'true' so every consumer sees a generated state. */
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}
  }

  function clearHasResult() {
    if (document.body) {
      document.body.classList.remove('pmg-has-result');
      document.body.classList.remove('pmg-has-generated');
      document.body.classList.add('pmg-pre-gen');
    }
    /* Note: per spec, the localStorage flag is sticky for returning users. */
  }

  function readHasGeneratedFlag() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'true' || v === '1';
    } catch (e) { return false; }
  }

  function checkResultBox() {
    var rb = document.getElementById('resultBox');
    if (!rb) return;
    if (hasRealPrompt(rb.textContent)) {
      markHasResult();
    }
  }

  function watchResultBox() {
    var rb = document.getElementById('resultBox');
    if (!rb || !('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
      if (document.body && document.body.classList.contains('pmg-has-result')) {
        return; /* once revealed, leave it revealed (sticky) */
      }
      if (hasRealPrompt(rb.textContent)) {
        markHasResult();
      }
    });
    mo.observe(rb, { childList: true, subtree: true, characterData: true });
  }

  function wireClearButton() {
    var btn = document.getElementById('clear-prompt-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      /* Re-hide the post-gen tools until the next generation. */
      setTimeout(clearHasResult, 0);
    });
  }

  /* ================================================================
   * STABILIZATION — remove duplicate "Use Demo Values" microcopy
   * (item 3 of the stabilization brief)
   * ================================================================ */
  function hideDuplicateDemoMicrocopy() {
    var btn = document.getElementById('fill-demo');
    var micro = document.getElementById('demo-microcopy');
    if (!btn || !micro) return;
    var btnText = (btn.textContent || '').trim().toLowerCase();
    var microText = (micro.textContent || '').trim().toLowerCase();
    if (btnText && microText && btnText === microText) {
      micro.setAttribute('hidden', '');
      micro.style.display = 'none';
    }
  }

  function applyOnLoad() {
    injectVisibilityCss();
    /* Returning users: surface tools immediately if they generated previously. */
    if (readHasGeneratedFlag()) {
      markHasResult();
    }
    checkResultBox();
    watchResultBox();
    wireClearButton();
    hideDuplicateDemoMicrocopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOnLoad, { once: true });
  } else {
    applyOnLoad();
  }
})();

/* ====================================================================
 * pmg-fixes-v2.js
 * ==================================================================== */
(function () {
  'use strict';

  var STYLE_ID = 'pmg-fixes-v2-styles';
  var SCROLL_HINT_ID = 'pmg-usecases-scroll-hint';
  var STICKY_TAB_ID = 'pmg-mobile-sticky-tab';
  var STICKY_COLLAPSED_FLAG = 'pmg.mobileStickyCollapsed';
  var MODAL_SHOWN_KEY = 'pmg_modal_shown';
  var WELCOME_SEEN_KEY = 'pmg_welcome_seen';
  var HAS_GENERATED_KEY = 'pmg_has_generated';
  var TEMPLATES_KEY = 'promptmegood:templates:v1';
  var HISTORY_KEY = 'promptmegood:history:v1';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function safeJson(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Fix 1 — desktop container spacing */
      '@media (min-width: 1024px) {',
      '  .container { width: min(calc(100% - 3rem), var(--content-default)); }',
      '  #builder.app-section, #result-panel.panel { padding-left: max(24px, var(--space-3)); padding-right: max(24px, var(--space-3)); box-sizing: border-box; }',
      '  .hero-actions #hero-build-cta { padding: 16px 28px; box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary) 30%, transparent); }',
      '  .hero-actions #hero-build-cta .cta-title { font-size: 17px; letter-spacing: 0.01em; }',
      '  .hero-actions #hero-build-cta .cta-sub { font-size: 13px; }',
      '  .hero-actions #hero-usecases-cta { padding: 12px 22px; background: transparent; border: 1.5px solid color-mix(in srgb, var(--color-text) 22%, transparent); }',
      '}',

      /* Fix 2 — mobile use-cases reorder + scroll hint */
      '@media (max-width: 600px) {',
      '  .popular-uses-head-row { flex-direction: column; align-items: stretch; gap: 10px; text-align: center; }',
      '  .popular-uses-head-row h2 { order: 1; }',
      '  .popular-uses-head-row .usecases-dice-btn { order: 2; align-self: center; }',
      '  .popular-uses-head > p { display: none; }',
      '  .use-cases-helper-tip { display: none !important; }',
      '  #' + SCROLL_HINT_ID + ' { display: block; text-align: center; font-size: 12px; font-weight: 600; color: color-mix(in srgb, var(--color-text) 65%, transparent); margin: 6px 0 10px; letter-spacing: 0.02em; }',
      '}',
      '@media (min-width: 601px) {',
      '  #' + SCROLL_HINT_ID + ' { display: none; }',
      '}',

      /* Fix 3 — mobile sticky bar collapsed tab */
      '#' + STICKY_TAB_ID + ' { position: fixed; right: 14px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 91; display: none; align-items: center; gap: 6px; padding: 10px 16px; min-height: 44px; border-radius: 999px; border: none; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 14px; letter-spacing: 0.01em; cursor: pointer; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22); }',
      '#' + STICKY_TAB_ID + ':hover, #' + STICKY_TAB_ID + ':focus-visible { filter: brightness(1.05); outline: none; }',
      '#' + STICKY_TAB_ID + '.is-visible { display: inline-flex; }',
      '@media (min-width: 769px) { #' + STICKY_TAB_ID + ' { display: none !important; } }',

      /* S2 — Workspace header polish */
      '.workspace-header { padding: 14px 18px 12px; border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent); margin-bottom: 12px; }',
      '.workspace-header-eyebrow { display: block; font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--color-primary); margin-bottom: 4px; }',
      '.workspace-header-sub { margin: 0; font-size: 14px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }',
      '@media (min-width: 768px) {',
      '  .workspace-header-eyebrow { font-size: 14px; }',
      '  .workspace-header-sub { font-size: 15px; }',
      '}',

      /* S3 — Demote non-Generate primary buttons to secondary */
      '#runBtn.btn.pmg-demoted, #copy-btn.btn.pmg-demoted, #fine-tune-btn.btn.pmg-demoted, #guided-mode-btn.btn.pmg-demoted, #upload-analyze-btn.btn.pmg-demoted, #image-generate-btn.btn.pmg-demoted, #imageBtn.btn.pmg-demoted {',
      '  background: transparent !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1.5px solid color-mix(in srgb, var(--color-primary) 38%, transparent) !important;',
      '  box-shadow: none !important;',
      '  font-weight: 600 !important;',
      '}',
      '#runBtn.btn.pmg-demoted:hover, #copy-btn.btn.pmg-demoted:hover, #fine-tune-btn.btn.pmg-demoted:hover, #guided-mode-btn.btn.pmg-demoted:hover, #upload-analyze-btn.btn.pmg-demoted:hover, #image-generate-btn.btn.pmg-demoted:hover, #imageBtn.btn.pmg-demoted:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 10%, transparent) !important;',
      '}',

      /* S1 — Expanded search dropdown */
      '#global-search-results .pmg-search-group { padding: 8px 14px 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: color-mix(in srgb, var(--color-text) 60%, transparent); background: color-mix(in srgb, var(--color-text) 4%, transparent); }',
      '#global-search-results .pmg-search-empty { padding: 16px; font-size: 14px; color: color-mix(in srgb, var(--color-text) 65%, transparent); text-align: center; }',
      '#global-search-results .pmg-search-result { width: 100%; text-align: left; background: transparent; border: none; padding: 10px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid color-mix(in srgb, var(--color-text) 6%, transparent); }',
      '#global-search-results .pmg-search-result:hover, #global-search-results .pmg-search-result:focus-visible { background: color-mix(in srgb, var(--color-primary) 8%, transparent); outline: none; }',
      '#global-search-results .pmg-search-result .global-result-kind { font-size: 11px; color: var(--color-primary); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }',
      '#global-search-results .pmg-search-result .global-result-title { font-size: 14px; font-weight: 600; color: var(--color-text); }',
      '#global-search-results .pmg-search-result .global-result-snippet { font-size: 12px; color: color-mix(in srgb, var(--color-text) 65%, transparent); white-space: normal; line-height: 1.4; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- S1: Expanded search ---------- */
  function snippetAround(text, q) {
    if (!text) return '';
    var s = String(text);
    var idx = s.toLowerCase().indexOf(q);
    if (idx < 0) return s.length > 90 ? s.slice(0, 90) + '\u2026' : s;
    var start = Math.max(0, idx - 24);
    var end = Math.min(s.length, idx + q.length + 60);
    return (start > 0 ? '\u2026' : '') + s.slice(start, end) + (end < s.length ? '\u2026' : '');
  }

  function buildExpandedResults(q) {
    if (!q) return [];
    var saved = safeJson(TEMPLATES_KEY);
    var history = safeJson(HISTORY_KEY);
    var out = [];

    function consider(item, kind) {
      var d = item && item.data ? item.data : {};
      var title = item.title || item.nickname || d.goal || '';
      var goal = d.goal || '';
      var details = d.details || '';
      var prompt = item.prompt || '';
      var hay = (title + '\n' + goal + '\n' + details + '\n' + prompt).toLowerCase();
      if (hay.indexOf(q) === -1) return;
      var snip = '';
      if (prompt && prompt.toLowerCase().indexOf(q) !== -1) snip = snippetAround(prompt, q);
      else if (goal && goal.toLowerCase().indexOf(q) !== -1) snip = snippetAround(goal, q);
      else if (details && details.toLowerCase().indexOf(q) !== -1) snip = snippetAround(details, q);
      else snip = snippetAround(title, q);
      out.push({
        kind: kind,
        title: title || (kind === 'From History' ? 'Untitled History Item' : 'Untitled Saved Prompt'),
        snippet: snip,
        savedAt: item.savedAt || item.updatedAt || item.createdAt || 0,
        id: item.id || '',
        goal: goal,
        prompt: prompt
      });
    }

    saved.forEach(function (it) { consider(it, 'Saved Prompts'); });
    history.forEach(function (it) { consider(it, 'From History'); });
    out.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    return out;
  }

  function setupExpandedSearch() {
    var input = document.getElementById('global-search-input');
    var resultsEl = document.getElementById('global-search-results');
    if (!input || !resultsEl) return;

    function render() {
      var q = (input.value || '').trim().toLowerCase();
      if (!q) {
        resultsEl.classList.remove('is-open');
        return;
      }
      var matches = buildExpandedResults(q);
      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="pmg-search-empty">No matches in your saved prompts or history yet. Generate a prompt and it will show up here.</div>';
        resultsEl.classList.add('is-open');
        return;
      }
      var groups = { 'From History': [], 'Saved Prompts': [] };
      matches.forEach(function (m) { if (groups[m.kind]) groups[m.kind].push(m); });
      var html = '';
      ['From History', 'Saved Prompts'].forEach(function (g) {
        if (!groups[g].length) return;
        html += '<div class="pmg-search-group">' + escapeHtml(g) + '</div>';
        groups[g].forEach(function (r) {
          html += '<button class="pmg-search-result" type="button" role="option" data-pmg-kind="' + escapeHtml(r.kind) + '" data-pmg-id="' + escapeHtml(r.id) + '" data-pmg-goal="' + escapeHtml(r.goal || r.title || '') + '">' +
            '<span class="global-result-kind">' + escapeHtml(r.kind) + '</span>' +
            '<span class="global-result-title">' + escapeHtml(r.title) + '</span>' +
            (r.snippet ? '<span class="global-result-snippet">' + escapeHtml(r.snippet) + '</span>' : '') +
            '</button>';
        });
      });
      resultsEl.innerHTML = html;
      resultsEl.classList.add('is-open');
    }

    function deferredRender() { window.setTimeout(render, 0); }

    input.addEventListener('input', deferredRender);
    input.addEventListener('focus', function () { if ((input.value || '').trim()) deferredRender(); });

    resultsEl.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.pmg-search-result') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var kind = btn.getAttribute('data-pmg-kind');
      var goalText = btn.getAttribute('data-pmg-goal') || '';
      if (!goalText) {
        var titleEl = btn.querySelector('.global-result-title');
        goalText = titleEl ? titleEl.textContent : '';
      }
      var goalField = document.getElementById('goal');
      if (goalField && goalText) {
        goalField.value = goalText;
        try {
          var ev = new Event('input', { bubbles: true });
          goalField.dispatchEvent(ev);
        } catch (e2) {}
      }
      resultsEl.classList.remove('is-open');
      input.value = '';
      var builder = document.getElementById('builder');
      if (builder && builder.scrollIntoView) builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var openBtnId = (kind === 'From History') ? 'history-open-btn' : 'templates-open-btn';
      var openBtn = document.getElementById(openBtnId);
      if (openBtn) try { openBtn.click(); } catch (e3) {}
    });

    document.addEventListener('click', function (e) {
      if (!resultsEl.classList.contains('is-open')) return;
      if (e.target === input) return;
      if (resultsEl.contains(e.target)) return;
      resultsEl.classList.remove('is-open');
    });
  }

  /* ---------- S3: Demote non-Generate primary buttons ---------- */
  function demoteButtons() {
    var ids = ['runBtn', 'copy-btn', 'fine-tune-btn', 'guided-mode-btn', 'upload-analyze-btn', 'image-generate-btn', 'imageBtn'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('pmg-demoted');
    });
  }

  /* ---------- S6: Upload "No file selected" / filename wiring guard ---------- */
  function setupUploadGuard() {
    var input = document.getElementById('analyze-file');
    var hint = document.getElementById('upload-hint');
    var nameEl = document.getElementById('upload-preview-name');
    if (!input) return;

    function refresh() {
      var f = input.files && input.files[0];
      if (f) {
        if (hint) hint.textContent = f.name;
        if (nameEl && !nameEl.textContent) nameEl.textContent = f.name;
      } else {
        if (hint && !hint.textContent) hint.textContent = 'No file selected';
      }
    }

    input.addEventListener('change', function () { window.setTimeout(refresh, 30); });
    refresh();
  }

  /* ---------- existing helpers ---------- */
  function injectUsecasesScrollHint() {
    if (document.getElementById(SCROLL_HINT_ID)) return;
    var section = document.getElementById('use-cases');
    if (!section) return;
    var head = section.querySelector('.popular-uses-head');
    var grid = section.querySelector('.popular-uses-grid');
    if (!head || !grid) return;
    var hint = document.createElement('p');
    hint.id = SCROLL_HINT_ID;
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Scroll Left Or Right To See More \u2192';
    head.parentNode.insertBefore(hint, grid);
  }

  function setupStickyCollapse() {
    return;
    var bar = document.getElementById('mobile-sticky-bar');
    var dismiss = document.getElementById('mobile-sticky-dismiss');
    if (!bar || !dismiss) return;

    var tab = document.createElement('button');
    tab.id = STICKY_TAB_ID;
    tab.type = 'button';
    tab.setAttribute('aria-label', 'Show quick prompt bar');
    tab.textContent = 'Generate \u26A1';
    document.body.appendChild(tab);

    function showTab() {
      bar.hidden = true;
      document.body.classList.remove('has-mobile-sticky');
      tab.classList.add('is-visible');
      try { sessionStorage.setItem(STICKY_COLLAPSED_FLAG, '1'); } catch (e) {}
    }
    function hideTab() {
      tab.classList.remove('is-visible');
      bar.hidden = false;
      document.body.classList.add('has-mobile-sticky');
      try { sessionStorage.removeItem(STICKY_COLLAPSED_FLAG); } catch (e) {}
      var input = document.getElementById('mobile-sticky-input');
      if (input && typeof input.focus === 'function') {
        try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
      }
    }

    var freshDismiss = dismiss.cloneNode(true);
    dismiss.parentNode.replaceChild(freshDismiss, dismiss);
    freshDismiss.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      showTab();
    });

    tab.addEventListener('click', function () { hideTab(); });

    var wasCollapsed = false;
    try { wasCollapsed = !!sessionStorage.getItem(STICKY_COLLAPSED_FLAG); } catch (e) {}
    if (wasCollapsed) {
      bar.hidden = true;
      document.body.classList.remove('has-mobile-sticky');
      tab.classList.add('is-visible');
    }
  }

  function setupModalOnceFlag() {
    if (safeGet(WELCOME_SEEN_KEY) === 'true' && !safeGet(MODAL_SHOWN_KEY)) {
      safeSet(MODAL_SHOWN_KEY, 'true');
    }
    if (safeGet(MODAL_SHOWN_KEY) === 'true' && safeGet(WELCOME_SEEN_KEY) !== 'true') {
      safeSet(WELCOME_SEEN_KEY, 'true');
      var banner = document.getElementById('tour-banner');
      if (banner) {
        banner.hidden = true;
        banner.style.display = 'none';
      }
    }
    var ids = ['tour-skip', 'tour-show', 'tour-jump'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () { safeSet(MODAL_SHOWN_KEY, 'true'); });
    });
    if ('MutationObserver' in window) {
      var bannerEl = document.getElementById('tour-banner');
      if (bannerEl) {
        var obs = new MutationObserver(function () {
          if (!bannerEl.hidden) {
            window.setTimeout(function () { safeSet(MODAL_SHOWN_KEY, 'true'); }, 100);
          }
        });
        obs.observe(bannerEl, { attributes: true, attributeFilter: ['hidden'] });
      }
    }
  }

  function setupNudgeSuppression() {
    function hasGenerated() { return safeGet(HAS_GENERATED_KEY) === 'true'; }
    var banner = document.getElementById('nudge-banner');
    if (!banner) return;
    if (!hasGenerated()) {
      banner.hidden = true;
      document.body.classList.remove('has-nudge-banner');
    }
    if ('MutationObserver' in window) {
      var obs = new MutationObserver(function () {
        if (!banner.hidden && !hasGenerated()) {
          banner.hidden = true;
          document.body.classList.remove('has-nudge-banner');
        }
      });
      obs.observe(banner, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  var INIT_FLAG = '__pmgFixesV2Initialized';
  function init() {
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;
    injectStyles();
    injectUsecasesScrollHint();
    setupModalOnceFlag();
    setupNudgeSuppression();
    setupExpandedSearch();
    setupUploadGuard();
    window.setTimeout(setupStickyCollapse, 50);
    window.setTimeout(demoteButtons, 80);
    window.setTimeout(demoteButtons, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ====================================================================
 * pmg-fixes-v3.js
 * ==================================================================== */
(function () {
  'use strict';
  if (window.__PMG_FIXES_V3__) return;
  window.__PMG_FIXES_V3__ = true;

  var HAS_GENERATED_KEY = 'pmg_has_generated';
  var MODAL_SHOWN_KEY = 'pmg_modal_shown';
  var WELCOME_SEEN_KEY = 'pmg_welcome_seen';

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v3-style')) return;
    var css = [
      'body.pmg-pre-gen .pmg-post-gen { display: none !important; }',
      '#weekly-goal-new-badge, .weekly-new-badge { display: none !important; }',
      '#replay-tour-btn-builder { display: none !important; }',
      '#guided-cta-row { display: none !important; }',
      '.build-cta-guidance { display: none !important; }',
      '.demo-helper { display: none !important; }',
      '.pmg-help-link { display: inline-block; margin: 8px 0 4px; padding: 6px 4px; background: transparent; border: 0; color: var(--color-primary); font: inherit; font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }',
      '.pmg-help-link:hover, .pmg-help-link:focus-visible { background: color-mix(in srgb, var(--color-primary) 8%, transparent); border-radius: 4px; outline: none; }',
      '.what-next { border-left: 3px solid var(--color-primary) !important; background: color-mix(in srgb, var(--color-primary) 9%, transparent) !important; }',
      '.what-next-list li strong { font-weight: 800 !important; }',
      '#print-btn { background: transparent !important; border: 0 !important; padding: 6px 4px !important; color: var(--color-text-muted) !important; text-decoration: underline !important; text-underline-offset: 3px !important; box-shadow: none !important; min-height: auto !important; font-weight: 500 !important; }',
      '#print-btn:hover, #print-btn:focus-visible { color: var(--color-primary) !important; }',
      '#runBtn { font-size: var(--text-base, 16px) !important; font-weight: 700 !important; padding: 16px 28px !important; }',
      '.pmg-replay-tour-menu { display: inline-flex; align-items: center; min-height: 44px; padding: 6px 10px; }',
      '@media (max-width: 768px) {',
      '  .global-search { display: none !important; }',
      '  .btn, button, [role="button"] { min-height: 44px; }',
      '  #builder-title, .builder-transition, #guided-cta-row, .build-cta-guidance, .demo-helper { display: none !important; }',
      '  #weekly-goal-pin { display: none !important; }',
      '  #mobile-sticky-dismiss { display: none !important; }',
      '  #pmg-mobile-sticky-tab { display: none !important; }',
      '}',
      'body:not(.pmg-has-generated) #weekly-goal-pin { display: none !important; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v3-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readHasGenerated() {
    try { return localStorage.getItem(HAS_GENERATED_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function applyGenerationGate() {
    var hasGen = readHasGenerated();
    document.body.classList.toggle('pmg-pre-gen', !hasGen);
    document.body.classList.toggle('pmg-has-generated', hasGen);
  }

  function watchGenerationFlag() {
    try {
      var origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        var ret = origSet.apply(this, arguments);
        if (key === HAS_GENERATED_KEY) {
          try { applyGenerationGate(); } catch (e) {}
        }
        return ret;
      };
    } catch (e) {}
    window.addEventListener('storage', function (ev) {
      if (ev && ev.key === HAS_GENERATED_KEY) applyGenerationGate();
    });
    var resultBox = document.getElementById('resultBox');
    if (resultBox && 'MutationObserver' in window) {
      var obs = new MutationObserver(function () {
        var txt = (resultBox.textContent || '').trim();
        if (!txt) return;
        var hasMeaningfulContent = txt.length > 40 && !/will appear here|generating/i.test(txt);
        if (hasMeaningfulContent && !readHasGenerated()) {
          try { localStorage.setItem(HAS_GENERATED_KEY, 'true'); } catch (e) {}
          applyGenerationGate();
        }
      });
      obs.observe(resultBox, { childList: true, characterData: true, subtree: true });
    }
  }

  function setupTourModalGate() {
    var banner = document.getElementById('tour-banner');
    if (!banner) return;
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    var alreadyShown = safeGet(MODAL_SHOWN_KEY) === 'true' || safeGet(WELCOME_SEEN_KEY) === 'true';
    if (alreadyShown) {
      banner.hidden = true;
      banner.style.display = 'none';
      return;
    }
    if (!banner.hidden) {
      banner.hidden = true;
      banner.style.display = 'none';
      window.setTimeout(function () {
        if (safeGet(MODAL_SHOWN_KEY) === 'true' || safeGet(WELCOME_SEEN_KEY) === 'true') return;
        banner.hidden = false;
        banner.style.removeProperty('display');
        safeSet(MODAL_SHOWN_KEY, 'true');
      }, 3000);
    }
    var dismissIds = ['tour-skip', 'tour-show', 'tour-jump'];
    dismissIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () {
        safeSet(MODAL_SHOWN_KEY, 'true');
        safeSet(WELCOME_SEEN_KEY, 'true');
      });
    });
  }

  function addReplayTourToMenu() {
    var topActions = document.querySelector('.top-actions');
    if (!topActions) return;
    if (document.getElementById('pmg-replay-tour-menu-link')) return;
    var btn = document.createElement('button');
    btn.id = 'pmg-replay-tour-menu-link';
    btn.type = 'button';
    btn.className = 'ghost-link pmg-replay-tour-menu';
    btn.textContent = 'Replay Tour';
    btn.addEventListener('click', function () {
      var footerBtn = document.getElementById('replay-tour-btn');
      var builderBtn = document.getElementById('replay-tour-btn-builder');
      var target = footerBtn || builderBtn;
      if (target) target.click();
    });
    topActions.appendChild(btn);
  }

  function insertHelpMeStartLink() {
    var generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;
    if (document.getElementById('pmg-help-me-start-link')) return;
    var link = document.createElement('button');
    link.type = 'button';
    link.id = 'pmg-help-me-start-link';
    link.className = 'pmg-help-link';
    link.textContent = 'Not Sure Where To Start? Let Us Help →';
    link.addEventListener('click', function () {
      var guided = document.getElementById('guided-mode-btn');
      if (guided) guided.click();
    });
    var actionsRow = generateBtn.parentNode;
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.parentNode.insertBefore(link, actionsRow.nextSibling);
    }
  }

  function moveRandomPromptIntoSettings() {
    var btn = document.getElementById('random-prompt');
    if (!btn) return;
    var settings = document.getElementById('settingsPanel');
    if (!settings) return;
    if (btn.dataset.pmgMoved === '1') return;
    var grid = settings.querySelector('.settings-grid') || settings;
    var wrap = document.createElement('div');
    wrap.className = 'pmg-random-prompt-wrap';
    wrap.style.cssText = 'grid-column: 1 / -1; margin: 0 0 12px; padding: 10px 12px; background: color-mix(in srgb, var(--color-primary) 6%, transparent); border-radius: var(--radius-md, 8px);';
    var label = document.createElement('p');
    label.style.cssText = 'margin: 0 0 8px; font-size: 12px; color: var(--color-text-muted); font-weight: 600;';
    label.textContent = 'Need Inspiration?';
    btn.classList.remove('pmg-post-gen');
    btn.removeAttribute('hidden');
    btn.style.removeProperty('display');
    wrap.appendChild(label);
    wrap.appendChild(btn);
    if (grid.firstChild) grid.insertBefore(wrap, grid.firstChild); else grid.appendChild(wrap);
    btn.dataset.pmgMoved = '1';
  }

  function reorderOutputActions() {
    var runSection = document.getElementById('runSection');
    var whatNext = document.getElementById('what-next');
    var copyBtn = document.getElementById('copy-btn');
    var improveBlock = document.getElementById('improve-block');
    var qualityRow = document.getElementById('quality-row');
    if (!runSection || !whatNext || !copyBtn || !improveBlock) return;
    if (document.getElementById('pmg-copy-wrap')) return;

    var resultBox = document.getElementById('resultBox');
    var anchor = resultBox && resultBox.parentNode ? resultBox.nextSibling : improveBlock;
    var parent = improveBlock.parentNode;
    if (!parent) return;

    try {
      parent.insertBefore(runSection, improveBlock);
      parent.insertBefore(whatNext, improveBlock);
    } catch (e) {}

    var copyWrap = document.createElement('div');
    copyWrap.id = 'pmg-copy-wrap';
    copyWrap.className = 'actions-row pmg-copy-wrap';
    copyWrap.style.cssText = 'margin: 12px 0;';
    if (copyBtn.parentNode) copyBtn.parentNode.removeChild(copyBtn);
    copyWrap.appendChild(copyBtn);
    parent.insertBefore(copyWrap, improveBlock);
  }

  function setupWeeklyFallback() {
    var body = document.getElementById('weekly-goal-body');
    if (!body) return;
    setTimeout(function () {
      var txt = (body.textContent || '').trim();
      if (!txt || /loading|spinner|…/i.test(txt) || txt.length < 8) {
        body.textContent = 'Try This: Write A Prompt To Help You Earn Extra Income This Week.';
      }
    }, 3000);
  }

  function neutralizeStickyTab() {
    var tab = document.getElementById('pmg-mobile-sticky-tab');
    if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
    var dismiss = document.getElementById('mobile-sticky-dismiss');
    if (dismiss) {
      dismiss.setAttribute('hidden', 'hidden');
      dismiss.style.display = 'none';
    }
    try {
      sessionStorage.removeItem('pmg.mobileStickyCollapsed');
    } catch (e) {}
    var bar = document.getElementById('mobile-sticky-bar');
    if (bar) bar.classList.remove('is-collapsed');
  }

  function init() {
    injectStyles();
    applyGenerationGate();
    watchGenerationFlag();
    setupTourModalGate();
    addReplayTourToMenu();
    insertHelpMeStartLink();
    moveRandomPromptIntoSettings();
    reorderOutputActions();
    setupWeeklyFallback();
    neutralizeStickyTab();
    setTimeout(neutralizeStickyTab, 200);
    setTimeout(neutralizeStickyTab, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* ====================================================================
 * pmg-fixes-v4.js
 * ==================================================================== */
(function () {
  'use strict';
  if (window.__PMG_FIXES_V4__) return;
  window.__PMG_FIXES_V4__ = true;

  var HAS_GENERATED_KEY = 'pmg_has_generated';

  function readHasGenerated() {
    try {
      var v = localStorage.getItem(HAS_GENERATED_KEY);
      if (v === 'true' || v === '1') return true;
    } catch (e) {}
    return !!(document.body && document.body.classList && document.body.classList.contains('pmg-has-generated'));
  }

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v4-style')) return;
    var css = [
      '#builder, #weekly-goal-pin, #aiResponseSection, #imageResultSection, #runSection, #improve-block, #pmg-what-next-block, #resultBox { scroll-margin-top: 24px; }',

      '.pmg-strength-pill { display: none; align-items: center; gap: 8px; margin: 6px 0 10px; padding: 6px 12px; border-radius: 999px; background: var(--color-surface-2, color-mix(in srgb, var(--color-primary) 4%, transparent)); border: 1px solid var(--color-border); font-size: 13px; font-weight: 600; width: fit-content; transition: background 0.2s ease, border-color 0.2s ease; }',
      '.pmg-strength-pill.is-visible { display: inline-flex; }',
      '.pmg-strength-dot { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; transition: background 0.2s ease, box-shadow 0.2s ease; }',
      '.pmg-strength-pill[data-level="too-short"] .pmg-strength-dot { background: #9ca3af; }',
      '.pmg-strength-pill[data-level="getting"] .pmg-strength-dot { background: #f59e0b; }',
      '.pmg-strength-pill[data-level="good"] .pmg-strength-dot { background: #3b82f6; }',
      '.pmg-strength-pill[data-level="strong"] .pmg-strength-dot { background: #10b981; box-shadow: 0 0 0 4px color-mix(in srgb, #10b981 20%, transparent); }',
      '.pmg-strength-pill[data-level="strong"] { animation: pmgStrengthPulse 0.6s ease-out 1; }',
      '@keyframes pmgStrengthPulse { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }',

      '.pmg-what-next-block { display: none; margin: 16px 0; padding: 16px; background: color-mix(in srgb, var(--color-primary) 6%, transparent); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md, 8px); }',
      'body.pmg-has-generated .pmg-what-next-block { display: block; }',
      '.pmg-what-next-title { margin: 0 0 12px; font-size: var(--text-base, 16px); font-weight: 700; color: var(--color-text); }',
      '.pmg-what-next-rows { display: flex; flex-direction: column; gap: 8px; }',
      '.pmg-what-next-row { display: flex; align-items: center; gap: 12px; min-height: 52px; width: 100%; padding: 12px 14px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-text); text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.05s; font: inherit; }',
      '.pmg-what-next-row:hover, .pmg-what-next-row:focus-visible { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); outline: none; }',
      '.pmg-what-next-row:active { transform: scale(0.99); }',
      '.pmg-what-next-icon { font-size: 22px; flex: 0 0 auto; width: 32px; text-align: center; }',
      '.pmg-what-next-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }',
      '.pmg-what-next-label { font-weight: 700; font-size: 15px; }',
      '.pmg-what-next-desc { font-size: 13px; color: var(--color-text-muted); line-height: 1.4; }',
      '@media (min-width: 769px) {',
      '  .pmg-what-next-rows { flex-direction: row; }',
      '  .pmg-what-next-row { flex-direction: column; align-items: center; text-align: center; min-height: 80px; padding: 14px 12px; }',
      '  .pmg-what-next-icon { font-size: 24px; width: auto; }',
      '  .pmg-what-next-text { align-items: center; text-align: center; }',
      '}',

      '.pmg-photo-assistant { display: none; margin: 0 0 16px; padding: 16px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: var(--radius-lg, 12px); }',
      'body.image-mode .pmg-photo-assistant { display: block; }',
      'body.image-mode .pmg-photo-assistant.is-collapsed { display: none; }',
      '.pmg-photo-edit-link { display: none; margin: 0 0 12px; padding: 8px 12px; background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-primary); cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; text-align: left; }',
      'body.image-mode .pmg-photo-edit-link.is-visible { display: inline-block; }',
      '.pmg-photo-head { margin: 0 0 12px; }',
      '.pmg-photo-title { margin: 0 0 4px; font-size: var(--text-base, 16px); font-weight: 700; color: var(--color-text); }',
      '.pmg-photo-sub { margin: 0; font-size: 13px; color: var(--color-text-muted); }',
      '.pmg-photo-q { padding: 12px 0; border-top: 1px solid var(--color-border); }',
      '.pmg-photo-q:first-of-type { border-top: 0; padding-top: 4px; }',
      '.pmg-photo-q-label { display: block; margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--color-text); }',
      '.pmg-photo-q-input { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); background: var(--color-surface, #fff); color: var(--color-text); font: inherit; font-size: 14px; box-sizing: border-box; }',
      '.pmg-photo-q-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent); }',
      '.pmg-photo-pills { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.pmg-photo-pill { padding: 8px 14px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; color: var(--color-text); min-height: 36px; transition: background 0.15s, border-color 0.15s, color 0.15s; }',
      '.pmg-photo-pill:hover { border-color: var(--color-primary); }',
      '.pmg-photo-pill[aria-pressed="true"] { background: var(--color-primary); border-color: var(--color-primary); color: #fff; font-weight: 600; }',
      '.pmg-photo-build-btn { width: 100%; margin-top: 14px; padding: 14px 20px; min-height: 48px; }',

      '.pmg-help-me-start-btn { display: none; width: 100%; margin: 8px 0 4px; min-height: 44px; }',
      'body:not(.image-mode) .pmg-help-me-start-btn { display: inline-flex; }',
      'body.image-mode .pmg-help-me-start-btn { display: none !important; }',
      '#pmg-help-me-start-link { display: none !important; }',

      '.pmg-nav-search-toggle { display: none; align-items: center; justify-content: center; width: 40px; min-width: 40px; height: 40px; padding: 0; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-text); cursor: pointer; font-size: 18px; }',
      '.pmg-nav-search-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }',
      '@media (max-width: 768px) {',
      '  .global-search { display: none !important; }',
      '  .global-search.pmg-expanded { display: flex !important; position: absolute; top: 100%; right: 0; left: 0; z-index: 60; padding: 12px 16px; background: var(--color-surface, #fff); border-bottom: 1px solid var(--color-border); margin: 0; max-width: none; }',
      '  .global-search.pmg-expanded .global-search-label, .global-search.pmg-expanded .global-search-helper { display: none; }',
      '}',

      '#guided-overlay, .guided-overlay, .modal-content, [data-guided], #guided-mode-modal { touch-action: pan-y !important; -webkit-overflow-scrolling: touch !important; }',
      '#guided-overlay .modal-content, .guided-overlay .modal-content { max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }',

      'body.pmg-image-reordered #generateBtn { display: none !important; }',

      '.hero-proof-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-2, 8px) var(--space-3, 12px); margin-top: var(--space-4, 16px); padding: var(--space-3, 12px) var(--space-4, 16px); background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border-radius: 999px; border: 1px solid color-mix(in srgb, var(--color-primary) 15%, var(--color-border)); }',
      '.hero-proof-item { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-xs, 12px); font-weight: 600; color: var(--color-text-muted); white-space: nowrap; }',
      '.hero-proof-sep { color: var(--color-border); font-size: var(--text-sm, 14px); }',
      '@media (max-width: 540px) {',
      '  .hero-proof-sep { display: none; }',
      '  .hero-proof-bar { gap: var(--space-2, 8px); border-radius: var(--radius-lg, 12px); padding: 10px 12px; }',
      '  .hero-proof-item { font-size: 11px; }',
      '}',

      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(1rem, 2vw, 1.5rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-actions { margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-proof-bar { margin-top: var(--space-3, 12px) !important; padding-top: 8px !important; padding-bottom: 8px !important; }',
      '  .hero-testimonial { margin-top: var(--space-3, 12px) !important; }',
      '  .desktop-below-fold { display: none !important; }',
      '  .desktop-below-fold.revealed { display: block !important; }',
      '}',

      '@media (min-width: 1024px) {',
      '  .pmg-result-sticky { position: sticky; top: 24px; align-self: start; }',
      '}',

      '@media (max-width: 768px) {',
      '  .pmg-strength-pill { width: 100%; max-width: none; justify-content: flex-start; }',
      '  .pmg-photo-pills { gap: 6px; }',
      '  .pmg-photo-pill { padding: 10px 14px; min-height: 44px; font-size: 14px; }',
      '  .pmg-nav-search-toggle { display: inline-flex; }',
      '}',
      '@media (min-width: 769px) {',
      '  .pmg-nav-search-toggle { display: none !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v4-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setupGoalLabelMode() {
    var goalLabel = document.querySelector('label[for="goal"]');
    if (!goalLabel) return;
    function update() {
      var isImg = document.body.classList.contains('image-mode');
      goalLabel.textContent = isImg ? 'Your Image' : 'Your Goal';
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupStrengthIndicator() {
    var goal = document.getElementById('goal');
    if (!goal) return;
    if (document.getElementById('pmg-strength-pill')) return;
    var pill = document.createElement('div');
    pill.id = 'pmg-strength-pill';
    pill.className = 'pmg-strength-pill';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    pill.dataset.level = 'too-short';
    var dot = document.createElement('span');
    dot.className = 'pmg-strength-dot';
    var label = document.createElement('span');
    label.className = 'pmg-strength-label';
    label.textContent = 'Too Short';
    pill.appendChild(dot);
    pill.appendChild(label);

    var helper = goal.parentNode ? goal.parentNode.querySelector('.helper') : null;
    if (helper && helper.parentNode) {
      helper.parentNode.insertBefore(pill, helper);
    } else if (goal.parentNode) {
      goal.parentNode.insertBefore(pill, goal.nextSibling);
    }

    var POWER = /\b(who|what|how|why|help me|i want|i need|my|for|because|so that|make sure|avoid|include|step by step|list|explain|create|write|build|find|give me|show me)\b/i;
    function update() {
      var v = (goal.value || '').trim();
      if (!v) {
        pill.classList.remove('is-visible');
        return;
      }
      pill.classList.add('is-visible');
      var len = v.length;
      var lvl = 'too-short';
      var txt = 'Too Short';
      if (POWER.test(v) && len >= 21) {
        lvl = 'strong'; txt = 'Strong ✓';
      } else if (len > 120) {
        lvl = 'strong'; txt = 'Strong ✓';
      } else if (len >= 61) {
        lvl = 'good'; txt = 'Good';
      } else if (len >= 21) {
        lvl = 'getting'; txt = 'Getting There';
      }
      var prev = pill.dataset.level;
      pill.dataset.level = lvl;
      label.textContent = txt;
      if (lvl === 'strong' && prev !== 'strong') {
        pill.style.animation = 'none';
        void pill.offsetWidth;
        pill.style.animation = '';
      }
    }
    goal.addEventListener('input', update);
    goal.addEventListener('change', update);
    update();

    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        setTimeout(function () { pill.classList.remove('is-visible'); }, 100);
      });
    }
  }

  var PHOTO_QUESTIONS = [
    { key: 'subject', type: 'text', label: 'What Is The Main Subject?', placeholder: 'A person, animal, object, landscape, scene...' },
    { key: 'shot', type: 'pills', label: 'Shot Type — How Close Are We?', options: [
      'Extreme Close-Up (Face, Texture, Detail)',
      'Close-Up (Head And Shoulders)',
      'Medium Shot (Waist Up)',
      'Full Body Shot',
      'Wide Shot (Subject + Environment)',
      "Aerial / Bird's Eye View",
      "Worm's Eye View (Looking Up)",
      'Over The Shoulder'
    ]},
    { key: 'lens', type: 'pills', label: 'Camera Lens Feel?', options: [
      'Wide Angle (Expansive, Dramatic)',
      'Standard (Natural, True To Life)',
      'Telephoto (Compressed, Intimate)',
      'Macro (Ultra Close Detail)',
      'Fisheye (Distorted, Creative)',
      'Tilt-Shift (Miniature Effect)'
    ]},
    { key: 'lighting', type: 'pills', label: 'Lighting Setup?', options: [
      'Golden Hour (Warm, Soft Sunset)',
      'Blue Hour (Cool, Moody Dusk)',
      'Harsh Midday Sun (High Contrast)',
      'Overcast (Soft, Even, No Shadows)',
      'Studio Lighting (Clean, Controlled)',
      'Neon & Artificial (Urban Night)',
      'Candlelight / Fire (Warm, Intimate)',
      'Backlit (Silhouette, Halo Effect)'
    ]},
    { key: 'mood', type: 'pills', label: 'Mood And Color Palette?', options: [
      'Cinematic & Dramatic',
      'Bright & Airy',
      'Dark & Moody',
      'Warm & Nostalgic',
      'Cool & Minimal',
      'Vibrant & Saturated',
      'Black & White',
      'Vintage Film Grain'
    ]},
    { key: 'camera', type: 'text', label: 'Camera And Film Style? (Optional)', placeholder: 'Shot on iPhone 16 Pro, Canon 5D, Kodak Portra 400, 35mm film, 8K RAW...' }
  ];

  function setupPhotoAssistant() {
    if (document.getElementById('pmg-photo-assistant')) return;
    var goal = document.getElementById('goal');
    var goalField = goal ? goal.closest('.field') : null;
    if (!goalField || !goalField.parentNode) return;

    var assistant = document.createElement('div');
    assistant.id = 'pmg-photo-assistant';
    assistant.className = 'pmg-photo-assistant';

    var head = document.createElement('div');
    head.className = 'pmg-photo-head';
    var title = document.createElement('p');
    title.className = 'pmg-photo-title';
    title.textContent = 'Photographer Vision Assistant';
    var sub = document.createElement('p');
    sub.className = 'pmg-photo-sub';
    sub.textContent = "Answer 6 quick questions and we'll build your perfect image prompt — like a professional photographer would.";
    head.appendChild(title);
    head.appendChild(sub);
    assistant.appendChild(head);

    var answers = {};

    PHOTO_QUESTIONS.forEach(function (q) {
      var wrap = document.createElement('div');
      wrap.className = 'pmg-photo-q';
      var lbl = document.createElement('label');
      lbl.className = 'pmg-photo-q-label';
      lbl.textContent = q.label;
      wrap.appendChild(lbl);
      if (q.type === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pmg-photo-q-input';
        input.placeholder = q.placeholder || '';
        input.dataset.photoKey = q.key;
        input.addEventListener('input', function () { answers[q.key] = input.value.trim(); });
        wrap.appendChild(input);
      } else if (q.type === 'pills') {
        var pillsWrap = document.createElement('div');
        pillsWrap.className = 'pmg-photo-pills';
        q.options.forEach(function (opt) {
          var pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'pmg-photo-pill';
          pill.setAttribute('aria-pressed', 'false');
          pill.textContent = opt;
          pill.addEventListener('click', function () {
            var pressed = pill.getAttribute('aria-pressed') === 'true';
            Array.prototype.forEach.call(pillsWrap.querySelectorAll('.pmg-photo-pill'), function (p) {
              p.setAttribute('aria-pressed', 'false');
            });
            if (!pressed) {
              pill.setAttribute('aria-pressed', 'true');
              answers[q.key] = opt;
            } else {
              answers[q.key] = '';
            }
          });
          pillsWrap.appendChild(pill);
        });
        wrap.appendChild(pillsWrap);
      }
      assistant.appendChild(wrap);
    });

    var buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.className = 'btn btn-primary pmg-photo-build-btn';
    buildBtn.id = 'pmg-photo-build-btn';
    buildBtn.textContent = 'Build My Image Prompt →';
    assistant.appendChild(buildBtn);

    var editLink = document.createElement('button');
    editLink.type = 'button';
    editLink.id = 'pmg-photo-edit-link';
    editLink.className = 'pmg-photo-edit-link';
    editLink.textContent = '✏️ Edit Image Details';

    goalField.parentNode.insertBefore(editLink, goalField);
    goalField.parentNode.insertBefore(assistant, goalField);

    function stripParen(s) { return (s || '').replace(/\s*\([^)]*\)\s*/g, '').trim(); }
    buildBtn.addEventListener('click', function () {
      var subject = answers.subject || '';
      var shot = stripParen(answers.shot || '');
      var lens = stripParen(answers.lens || '');
      var lighting = stripParen(answers.lighting || '');
      var mood = stripParen(answers.mood || '');
      var camera = answers.camera || '';
      var parts = [];
      if (shot && subject) parts.push(shot.toLowerCase() + ' of ' + subject);
      else if (subject) parts.push(subject);
      if (lens) parts.push(lens.toLowerCase() + ' lens');
      if (lighting) parts.push(lighting.toLowerCase() + ' lighting');
      if (mood) parts.push(mood.toLowerCase());
      if (camera) parts.push(camera);
      var combined = parts.join(', ').replace(/\s+,/g, ',').trim();
      if (goal && combined) {
        goal.value = combined;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      assistant.classList.add('is-collapsed');
      editLink.classList.add('is-visible');
      if (goal) goal.focus();
    });
    editLink.addEventListener('click', function () {
      assistant.classList.remove('is-collapsed');
      editLink.classList.remove('is-visible');
    });
  }

  function setupHelpMeStartButton() {
    var generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;
    if (document.getElementById('pmg-help-me-start-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-help-me-start-btn';
    btn.className = 'btn btn-secondary pmg-help-me-start-btn';
    btn.textContent = '💡 Help Me Start';
    btn.addEventListener('click', function () {
      var orig = document.getElementById('guided-mode-btn');
      if (orig) orig.click();
    });
    var actionsRow = generateBtn.parentNode;
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.parentNode.insertBefore(btn, actionsRow.nextSibling);
    }
  }

  function setupWhatNextBlock() {
    if (document.getElementById('pmg-what-next-block')) return;
    var resultBox = document.getElementById('resultBox');
    if (!resultBox || !resultBox.parentNode) return;
    var block = document.createElement('div');
    block.id = 'pmg-what-next-block';
    block.className = 'pmg-what-next-block pmg-post-gen';
    var title = document.createElement('h3');
    title.className = 'pmg-what-next-title';
    title.textContent = 'What Would You Like To Do?';
    var rows = document.createElement('div');
    rows.className = 'pmg-what-next-rows';

    function makeRow(icon, lbl, desc, handler) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'pmg-what-next-row';
      var ic = document.createElement('span');
      ic.className = 'pmg-what-next-icon';
      ic.setAttribute('aria-hidden', 'true');
      ic.textContent = icon;
      var txt = document.createElement('span');
      txt.className = 'pmg-what-next-text';
      var l = document.createElement('span');
      l.className = 'pmg-what-next-label';
      l.textContent = lbl;
      var d = document.createElement('span');
      d.className = 'pmg-what-next-desc';
      d.textContent = desc;
      txt.appendChild(l); txt.appendChild(d);
      row.appendChild(ic); row.appendChild(txt);
      row.addEventListener('click', handler);
      return row;
    }

    rows.appendChild(makeRow('▶', 'Run With AI', 'See your AI response right here — no copy-paste needed', function () {
      var rb = document.getElementById('runBtn');
      if (rb) rb.click();
    }));
    rows.appendChild(makeRow('📋', 'Copy Prompt', 'Take it to ChatGPT, Claude, or any AI tool you use', function () {
      var cb = document.getElementById('copy-btn');
      if (cb) cb.click();
    }));
    rows.appendChild(makeRow('✏️', 'Refine It', 'Make it stronger before you run it', function () {
      var ib = document.getElementById('improve-block');
      if (ib) ib.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    block.appendChild(title);
    block.appendChild(rows);
    resultBox.parentNode.insertBefore(block, resultBox.nextSibling);
  }

  function reorderResultPanel() {
    var resultBox = document.getElementById('resultBox');
    var whatNext = document.getElementById('pmg-what-next-block');
    var runSection = document.getElementById('runSection');
    var improve = document.getElementById('improve-block');
    var qualityRow = document.getElementById('quality-row');
    var actionsRows = document.querySelectorAll('#tour-final-actions > .actions-row');
    var copyWrap = document.getElementById('pmg-copy-wrap');
    if (!resultBox || !improve || !improve.parentNode) return;
    var parent = improve.parentNode;
    try {
      if (whatNext && resultBox.nextSibling !== whatNext) parent.insertBefore(whatNext, resultBox.nextSibling);
      if (runSection && whatNext) parent.insertBefore(runSection, whatNext.nextSibling);
      if (improve && runSection) parent.insertBefore(improve, runSection.nextSibling);
      if (qualityRow && improve) parent.insertBefore(qualityRow, improve.nextSibling);
      if (copyWrap && qualityRow) parent.insertBefore(copyWrap, qualityRow.nextSibling);
    } catch (e) {}
  }

  function reorderImageMode() {
    var goal = document.getElementById('goal');
    var imageBtn = document.getElementById('image-generate-btn');
    var uploadField = document.getElementById('upload-field');
    if (!goal || !imageBtn) return;
    var goalField = goal.closest('.field');
    if (!goalField || !goalField.parentNode) return;
    var parent = goalField.parentNode;
    try {
      if (imageBtn.parentNode !== parent) {
        parent.insertBefore(imageBtn, goalField.nextSibling);
      } else if (imageBtn.previousSibling !== goalField) {
        parent.insertBefore(imageBtn, goalField.nextSibling);
      }
      imageBtn.style.cssText = 'margin-top: 12px; width: 100%; min-height: 48px;';
    } catch (e) {}
  }

  function moveUploadBelowHelpMeStart() {
    var uploadField = document.getElementById('upload-field');
    var helpBtn = document.getElementById('pmg-help-me-start-btn');
    if (!uploadField || !helpBtn) return;
    if (uploadField.dataset.pmgMoved === '1') return;
    var anchor = helpBtn.parentNode === uploadField.parentNode ? helpBtn : uploadField.parentNode.querySelector('#tour-step-generate');
    if (!anchor || anchor.parentNode !== uploadField.parentNode) return;
    try {
      anchor.parentNode.insertBefore(uploadField, anchor.nextSibling);
      uploadField.dataset.pmgMoved = '1';
    } catch (e) {}
  }

  function setupNavSearchToggle() {
    var initialSearch = document.querySelector('.global-search');
    if (!initialSearch) return;
    if (document.getElementById('pmg-nav-search-toggle')) return;
    var topActions = document.querySelector('.top-actions');
    var navToggle = document.querySelector('.nav-toggle');
    var btn = document.createElement('button');
    btn.id = 'pmg-nav-search-toggle';
    btn.type = 'button';
    btn.className = 'pmg-nav-search-toggle';
    btn.setAttribute('aria-label', 'Search');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '🔍';
    /* Re-query .global-search on every interaction in case other IIFEs reparent it. */
    function getSearch() { return document.querySelector('.global-search'); }
    function setExpanded(open) {
      var s = getSearch();
      if (!s) return;
      if (open) s.classList.add('pmg-expanded'); else s.classList.remove('pmg-expanded');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = open ? '✕' : '🔍';
      btn.setAttribute('aria-label', open ? 'Close Search' : 'Search');
      if (open) {
        var input = s.querySelector('input');
        if (input) setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
      }
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var s = getSearch();
      if (!s) return;
      setExpanded(!s.classList.contains('pmg-expanded'));
    });
    if (navToggle && navToggle.parentNode) {
      navToggle.parentNode.insertBefore(btn, navToggle);
    } else if (topActions && topActions.parentNode) {
      topActions.parentNode.insertBefore(btn, topActions);
    } else if (initialSearch.parentNode) {
      initialSearch.parentNode.insertBefore(btn, initialSearch);
    }
    /* Tap outside the expanded search (and outside the toggle) closes it. */
    document.addEventListener('click', function (ev) {
      var s = getSearch();
      if (!s || !s.classList.contains('pmg-expanded')) return;
      if (ev.target === btn || btn.contains(ev.target)) return;
      if (s.contains(ev.target)) return;
      setExpanded(false);
    });
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.getAttribute && t.getAttribute('contenteditable') === 'true'));
      var s = getSearch();
      if (!s) return;
      if (ev.key === '/' && !inField) {
        ev.preventDefault();
        if (!s.classList.contains('pmg-expanded')) setExpanded(true);
        else { var input = s.querySelector('input'); if (input) input.focus(); }
      } else if (ev.key === 'Escape' && s.classList.contains('pmg-expanded')) {
        setExpanded(false);
      }
    });
  }

  function setupQuickStartGate() {
    var card = document.getElementById('quick-start-card');
    var examplesBlock = document.querySelector('.examples-block');
    var targets = [];
    if (card) targets.push(card);
    if (examplesBlock) targets.push(examplesBlock);
    if (!targets.length) return;
    function update() {
      var gen = readHasGenerated();
      targets.forEach(function (el) {
        if (!gen) el.style.display = 'none';
        else el.style.removeProperty('display');
      });
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupResultStickyDesktop() {
    var resultPanel = document.getElementById('result-panel');
    if (resultPanel) {
      resultPanel.classList.add('pmg-result-sticky');
    }
  }

  function setupImageGenerateMode() {
    function update() {
      var isImg = document.body.classList.contains('image-mode');
      document.body.classList.toggle('pmg-image-reordered', isImg);
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupAboveFoldReveal() {
    if (window.matchMedia && !window.matchMedia('(min-width: 920px)').matches) {
      revealAllBelowFold();
      return;
    }
    var sections = document.querySelectorAll('.desktop-below-fold');
    if (!sections.length) return;
    var builder = document.getElementById('builder');
    var revealed = false;
    var hasBeenIntersecting = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      Array.prototype.forEach.call(sections, function (s) { s.classList.add('revealed'); });
    }
    if (!builder || !('IntersectionObserver' in window)) {
      reveal();
      return;
    }
    var vh = function () { return window.innerHeight || document.documentElement.clientHeight || 800; };
    function checkInitialPosition() {
      var b = builder.getBoundingClientRect();
      if (b.bottom < 0 || b.top > vh() * 2) {
        reveal();
        return true;
      }
      if (b.top < vh() && b.bottom > 0) {
        hasBeenIntersecting = true;
      }
      return false;
    }
    if (checkInitialPosition()) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var rect = entry.boundingClientRect;
        if (entry.isIntersecting) {
          hasBeenIntersecting = true;
        } else if (hasBeenIntersecting && rect.bottom < vh() * 0.5) {
          reveal();
          io.disconnect();
        }
      });
    }, { threshold: [0, 0.25, 0.5, 1] });
    io.observe(builder);
    var lastY = window.scrollY;
    var lastScrollTime = Date.now();
    var scrollHandler = function () {
      var y = window.scrollY;
      var now = Date.now();
      if (!hasBeenIntersecting) {
        var b = builder.getBoundingClientRect();
        if (b.top < vh() && b.bottom > 0) hasBeenIntersecting = true;
      }
      if (now - lastScrollTime > 50 && hasBeenIntersecting && y > lastY + 30) {
        var br = builder.getBoundingClientRect();
        if (br.bottom < vh() * 0.5) {
          reveal();
          window.removeEventListener('scroll', scrollHandler, { passive: true });
          try { io.disconnect(); } catch (e) {}
        }
      }
      lastY = y;
      lastScrollTime = now;
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('pageshow', function (e) {
      if (revealed) return;
      if (e && e.persisted) {
        setTimeout(function () { checkInitialPosition(); }, 50);
      }
    });
    var firstFocusableInBuilder = builder.querySelector('input, textarea, select, button, [href], [tabindex]');
    function onFocusBridge(ev) {
      if (revealed) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('#builder') || (firstFocusableInBuilder && t === firstFocusableInBuilder)) {
        reveal();
      }
    }
    document.addEventListener('focusin', onFocusBridge);
  }

  function revealAllBelowFold() {
    var sections = document.querySelectorAll('.desktop-below-fold');
    Array.prototype.forEach.call(sections, function (s) { s.classList.add('revealed'); });
  }

  function setupAnchorRevealOverride() {
    var hiddenIds = ['use-cases', 'why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    function maybeRevealForHash(hash) {
      if (!hash) return;
      var id = hash.replace(/^#/, '');
      if (hiddenIds.indexOf(id) === -1) return;
      revealAllBelowFold();
      var el = document.getElementById(id);
      if (el) {
        requestAnimationFrame(function () {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
        });
      }
    }
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.length < 2) return;
      var id = href.slice(1);
      if (hiddenIds.indexOf(id) === -1) return;
      revealAllBelowFold();
    }, true);
    window.addEventListener('hashchange', function () { maybeRevealForHash(location.hash); });
    if (location.hash) {
      setTimeout(function () { maybeRevealForHash(location.hash); }, 50);
    }
  }

  function setupReplayTourScrollGuard() {
    var btns = [
      document.getElementById('replay-tour-btn'),
      document.getElementById('replay-tour-btn-builder')
    ].filter(Boolean);
    btns.forEach(function (btn) {
      if (btn.dataset.pmgScrollGuard === '1') return;
      btn.dataset.pmgScrollGuard = '1';
      btn.addEventListener('click', function () {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      }, { capture: true });
    });
  }

  function init() {
    injectStyles();
    setupGoalLabelMode();
    setupStrengthIndicator();
    setupPhotoAssistant();
    setupHelpMeStartButton();
    moveUploadBelowHelpMeStart();
    setupWhatNextBlock();
    reorderResultPanel();
    setTimeout(reorderResultPanel, 200);
    reorderImageMode();
    setupNavSearchToggle();
    setupQuickStartGate();
    setupResultStickyDesktop();
    setupImageGenerateMode();
    setupReplayTourScrollGuard();
    setupAboveFoldReveal();
    setupAnchorRevealOverride();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* ====================================================================
 * pmg-fixes-v5.js
 * ==================================================================== */
(function () {
  'use strict';

  function once(name) {
    if (window['__pmg_v5_' + name]) return false;
    window['__pmg_v5_' + name] = true;
    return true;
  }

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v5-style')) return;
    var css = [
      '/* ===== FIX 4: Hero compression + .hero-card hide on desktop ===== */',
      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(0.75rem, 1.5vw, 1.25rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-2) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-2) !important; }',
      '  .hero-actions { margin-bottom: var(--space-2) !important; }',
      '  .hero-grid { grid-template-columns: 1fr 1fr !important; align-items: start !important; }',
      '  .hero-testimonial { margin-top: var(--space-3) !important; }',
      '}',

      '/* ===== FIX 4: Brief-named class aliases for marketing sections ===== */',
      '@media (min-width: 920px) {',
      '  .pmg-marketing-section { display: none !important; }',
      '  .pmg-marketing-section.revealed { display: block !important; }',
      '}',

      '/* ===== FIX 2: Button hierarchy — eliminate white buttons ===== */',
      '/* SECONDARY: light tint of accent */',
      '.btn.btn-secondary,',
      '#copy-btn.btn-secondary,',
      '#share-btn,',
      '#print-btn,',
      '#fine-tune-btn.btn-secondary,',
      '.refine-buttons .btn-secondary,',
      'button.btn-secondary,',
      'a.btn.btn-secondary {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '.btn.btn-secondary:hover, button.btn-secondary:hover, a.btn.btn-secondary:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-2)) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)) !important;',
      '}',
      '/* TERTIARY: clear / print / collapse / undo / clear-all-history */',
      '#clear-prompt-btn, .btn.btn-clear, .btn-clear,',
      '#print-btn,',
      '#clear-all-history-btn,',
      '#collapse-all-btn,',
      '#undo-last-change-btn,',
      '.history-collapse-all-btn,',
      'button[data-tertiary] {',
      '  background: var(--color-surface-2) !important;',
      '  color: var(--color-text-muted) !important;',
      '  border: 1px solid var(--color-border) !important;',
      '}',
      '/* DESTRUCTIVE */',
      '.btn-destructive, button[data-destructive], #clear-all-history-confirm, .btn-danger {',
      '  background: color-mix(in srgb, #dc2626 10%, var(--color-surface-2)) !important;',
      '  color: #dc2626 !important;',
      '  border: 1px solid color-mix(in srgb, #dc2626 25%, var(--color-border)) !important;',
      '}',
      '/* Upload "Choose File" label-as-button — secondary look */',
      '.upload-btn, label.btn[for="analyze-file"] {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '/* ChatGPT / Claude / Perplexity buttons — secondary look (not primary) */',
      '.open-in-btn {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '.open-in-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface-2)) !important;',
      '}',

      '/* ===== FIX 3: Hide decorative result pills ===== */',
      '#result-panel .pill-row { display: none !important; }',

      '/* ===== FIX 3: Help Me Start — collapse the descriptive card to a slim helper ===== */',
      '.guided-cta-row {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '  gap: 4px !important;',
      '  align-items: stretch !important;',
      '  background: transparent !important;',
      '  border: 0 !important;',
      '  padding: 0 !important;',
      '  margin-top: var(--space-2) !important;',
      '}',
      '.guided-cta-row .guided-cta-text {',
      '  order: 2 !important;',
      '  display: block !important;',
      '  text-align: center !important;',
      '  font-size: var(--text-xs) !important;',
      '  color: var(--color-text-muted) !important;',
      '}',
      '.guided-cta-row .guided-cta-text strong { display: none !important; }',
      '.guided-cta-row .guided-cta-text > span:not(.guided-cta-recommended-badge) {',
      '  display: block !important;',
      '  font-size: var(--text-xs) !important;',
      '  font-weight: 400 !important;',
      '  color: var(--color-text-muted) !important;',
      '}',
      '.guided-cta-row #guided-mode-btn {',
      '  order: 1 !important;',
      '  width: 100% !important;',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',

      '/* ===== FIX 3: Keyboard shortcuts panel only when Expert Mode active ===== */',
      'body:not(.is-expert-mode) #keyboard-hints { display: none !important; }',
      'body.is-expert-mode #keyboard-hints { display: block !important; }',

      '/* ===== FIX 5: "No Signup. Free." sub-label under Fix My Prompt ===== */',
      '.pmg-generate-sublabel {',
      '  display: block;',
      '  margin: 4px 0 0;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  text-align: center;',
      '}',

      '/* ===== FIX 5: Image result caption ===== */',
      '.pmg-image-caption {',
      '  display: block;',
      '  margin-top: 6px;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  text-align: center;',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v5-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== FIX 1: Mobile keyboard safety ===== */
  function setupKeyboardSafety() {
    if (!once('kbsafety')) return;

    var TEXT_INPUT_SELECTOR = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="password"], input[type="tel"], input[type="url"], textarea, [contenteditable="true"], [contenteditable=""]';

    function applyInputmodeNone() {
      var sel = [
        'button',
        '[role="button"]',
        'a.btn',
        'a[href]',
        '.popular-use-card',
        '.example-chip',
        '.mode-switch-btn',
        '.accent-swatch',
        'summary',
        '.tab',
        '.toggle',
        '.pmg-wn-card'
      ].join(',');
      var nodes = document.querySelectorAll(sel);
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.matches && el.matches(TEXT_INPUT_SELECTOR)) return;
        if (!el.hasAttribute('inputmode')) {
          try { el.setAttribute('inputmode', 'none'); } catch (e) {}
        }
      });
    }

    function hardenStickyBarInput() {
      var input = document.getElementById('mobile-sticky-input');
      if (!input) return;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
    }

    function blurOnNonInputClick() {
      document.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var clickable = t.closest('button, a[href], a.btn, [role="button"], .popular-use-card, .mode-switch-btn, .accent-swatch, .pmg-wn-card, summary, .pill, .badge');
        if (!clickable) return;
        if (clickable.matches && clickable.matches(TEXT_INPUT_SELECTOR)) return;
        var forAttr = clickable.getAttribute && clickable.getAttribute('for');
        if (forAttr) {
          var target = document.getElementById(forAttr);
          if (target && target.matches && target.matches(TEXT_INPUT_SELECTOR)) return;
        }
        var inside = clickable.querySelector && clickable.querySelector(TEXT_INPUT_SELECTOR);
        if (inside) return;
        setTimeout(function () {
          var ae = document.activeElement;
          if (!ae) return;
          if (ae === document.body) return;
          if (ae === clickable) { try { ae.blur(); } catch (e2) {} return; }
          if (ae.matches && ae.matches(TEXT_INPUT_SELECTOR)) {
            try { ae.blur(); } catch (e3) {}
            return;
          }
          try { ae.blur(); } catch (e) {}
        }, 0);
      }, true);
    }

    function hardenWizardButtons() {
      var ids = ['guided-next', 'guided-back', 'guided-finish', 'guided-skip',
                 'guided-q-next', 'guided-q-back'];
      ids.forEach(function (id) {
        var b = document.getElementById(id);
        if (b && !b.hasAttribute('inputmode')) b.setAttribute('inputmode', 'none');
      });
      var wizard = document.getElementById('guided-overlay') || document.getElementById('guided-mode-modal');
      if (wizard) {
        wizard.style.touchAction = 'pan-y';
      }
    }

    applyInputmodeNone();
    hardenStickyBarInput();
    hardenWizardButtons();
    blurOnNonInputClick();

    setTimeout(function () { applyInputmodeNone(); hardenStickyBarInput(); hardenWizardButtons(); }, 1500);
    setTimeout(function () { applyInputmodeNone(); hardenStickyBarInput(); hardenWizardButtons(); }, 5000);
  }

  /* ===== FIX 4: Marketing section class aliases ===== */
  function aliasMarketingSections() {
    if (!once('marketingAlias')) return;
    /* Tag the five marketing sections so the desktop-only hide rule above
     * (`.pmg-marketing-section`) applies. The `.revealed` class added by
     * the v4 above-the-fold reveal logic is now the single canonical
     * "show me" trigger — no separate `.pmg-revealed` / `.pmg-shown`
     * mirrors are needed. */
    var ids = ['use-cases', 'why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('pmg-marketing-section');
    });
  }

  /* ===== FIX 5: Add "No Signup. Free." sub-label under Fix My Prompt ===== */
  function addGenerateSubLabel() {
    if (!once('generateSublabel')) return;
    var btn = document.getElementById('generateBtn');
    if (!btn) return;
    if (document.getElementById('pmg-generate-sublabel')) return;
    var p = document.createElement('p');
    p.id = 'pmg-generate-sublabel';
    p.className = 'pmg-generate-sublabel';
    p.textContent = 'No Signup. Free.';
    if (btn.parentNode) {
      btn.parentNode.insertBefore(p, btn.nextSibling);
    }
  }

  /* ===== FIX 5 / FIX 3: Help Me Start — replace verbose blurb with concise helper text ===== */
  function rewriteHelpMeStartHelper() {
    if (!once('helpMeStartHelper')) return;
    var row = document.getElementById('guided-cta-row');
    if (!row) return;
    var textEl = row.querySelector('.guided-cta-text');
    if (textEl) {
      var spans = textEl.querySelectorAll('span:not(.guided-cta-recommended-badge)');
      if (spans.length) {
        spans[spans.length - 1].textContent = "Answer 4 Quick Questions And We'll Fill The Form For You.";
      }
    }
  }

  /* ===== FIX 5: What Would You Like To Do? — title + hide legacy list =====
   * The interactive 3-column `.pmg-wn-grid` that this block used to build
   * was always immediately hidden by the v6 stacked-rows replacement. With
   * the consolidation, we skip building the grid entirely; we just rename
   * the title and hide the original `.what-next-list`. The v6 stack below
   * provides the visible UI. */
  function setWhatNextTitle() {
    var wn = document.getElementById('what-next');
    if (!wn) return;
    var titleEl = wn.querySelector('.what-next-title') || wn.querySelector('h3');
    if (titleEl && titleEl.textContent !== 'What Would You Like To Do?') {
      titleEl.textContent = 'What Would You Like To Do?';
    }
    var oldList = wn.querySelector('.what-next-list');
    if (oldList) oldList.style.display = 'none';
  }

  /* ===== FIX 5: Image result caption + button label tweak ===== */
  function imageResultPolish() {
    if (!once('imageResultPolish')) return;
    var section = document.getElementById('imageResultSection');
    if (!section) return;
    var meta = section.querySelector('.run-section-meta');
    if (meta) meta.textContent = 'Created With DALL·E 3 · Free During Early Access';
    var dl = document.getElementById('imageDownloadBtn');
    if (dl) dl.innerHTML = '⬇ Download Image';
    var again = document.getElementById('imageAgainBtn');
    if (again) again.textContent = 'Generate Another';
  }

  /* ===== FIX 8: Title case sweep for dynamic / toast / button-label text ===== */
  function titleCaseSweep() {
    if (!once('titleCaseSweep')) return;
    var pairs = [
      ['Random prompt', 'Random Prompt'],
      ['Fix my prompt', 'Fix My Prompt'],
      ['Help me start', 'Help Me Start'],
      ['Run with AI', 'Run With AI'],
      ['Copy prompt', 'Copy Prompt'],
      ['Clear prompt', 'Clear Prompt'],
      ['Update prompt', 'Update Prompt'],
      ['Improve with AI', 'Improve With AI'],
      ['More detailed', 'More Detailed'],
      ['More bold & direct', 'More Bold & Direct'],
      ['Beginner friendly', 'Beginner Friendly'],
      ['Undo last change', 'Undo Last Change'],
      ['Check prompt quality', 'Check Prompt Quality'],
      ['Copy shareable link', 'Copy Shareable Link'],
      ['Print / save PDF', 'Print / Save PDF'],
      ['Run again', 'Run Again'],
      ['Copy response', 'Copy Response'],
      ['Use demo values', 'Use Demo Values'],
      ['Show archived', 'Show Archived'],
      ['Compare two', 'Compare Two'],
      ['Collapse all', 'Collapse All'],
      ['Clear all history', 'Clear All History'],
      ['Export everything', 'Export Everything'],
      ['Import backup', 'Import Backup'],
      ['Backup / restore', 'Backup / Restore'],
      ['Hide tip', 'Hide Tip'],
      ['Use this →', 'Use This →'],
      ['Need ideas?', 'Need Ideas?'],
      ['What next?', 'What Next?'],
      ['Your goal', 'Your Goal'],
      ['Your image', 'Your Image'],
      ['Fine-tune your prompt', 'Fine-Tune Your Prompt']
    ];

    function fixIn(root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var v = node.nodeValue;
        if (!v || v.length < 3) continue;
        var parent = node.parentNode;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
        var changed = v;
        for (var i = 0; i < pairs.length; i++) {
          if (changed.indexOf(pairs[i][0]) !== -1) {
            changed = changed.split(pairs[i][0]).join(pairs[i][1]);
          }
        }
        if (changed !== v) node.nodeValue = changed;
      }
    }

    fixIn(document.body);
    setTimeout(function () { fixIn(document.body); }, 1500);
    setTimeout(function () { fixIn(document.body); }, 5000);
  }

  /* ===== Init ===== */
  function init() {
    injectStyles();
    setupKeyboardSafety();
    aliasMarketingSections();
    addGenerateSubLabel();
    rewriteHelpMeStartHelper();
    setWhatNextTitle();
    imageResultPolish();
    titleCaseSweep();

    setTimeout(setWhatNextTitle, 100);
    setTimeout(setWhatNextTitle, 600);
    setTimeout(setWhatNextTitle, 1500);
    setTimeout(setWhatNextTitle, 3000);
  }

  function bootstrap() {
    init();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () {
        setWhatNextTitle();
        setTimeout(setWhatNextTitle, 500);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();

/* ====================================================================
 * pmg-fixes-v6.js
 * ==================================================================== */
/* PromptMeGood — North Star QC pass (v6)
 * All fixes additive on top of v2/v3/v4/v5.
 * No renames of existing IDs/classes/vars.
 * No CSS order / flex reorder on sections.
 * CSS variables only.
 */
(function () {
  'use strict';

  var FLAGS = {};
  function once(name) {
    if (FLAGS[name]) return false;
    FLAGS[name] = true;
    return true;
  }

  /* ===================================================================
   * STYLES (Fixes 1, 2, 3, 4, 7, 8, 9, 11, 12)
   * =================================================================== */
  function injectStyles() {
    if (!once('styles')) return;
    var css = [
      /* ===== FIX 11: keyframes ===== */
      '@keyframes pmgFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes pmgPulse { 0%, 100% { box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); } 50% { box-shadow: 0 4px 28px color-mix(in srgb, var(--color-primary) 50%, transparent); } }',
      '@keyframes pmgShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
      '@keyframes pmgSnap { 0% { transform: scaleY(1); } 50% { transform: scaleY(0.96); } 100% { transform: scaleY(1); } }',

      /* ===== FIX 1: hero polish (additive — main hero work already shipped in v5) ===== */
      '.hero-text-link { display: block; text-align: center; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); text-decoration: underline; text-underline-offset: 3px; transition: color 180ms ease; }',
      '.hero-text-link:hover { color: var(--color-primary); }',
      /* Per user override: keep hero-card visible at all sizes (was hidden by brief). */
      'aside.hero-card { display: block !important; }',
      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(0.75rem, 1.5vw, 1.25rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-2) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-2) !important; }',
      '  .hero-actions { margin-bottom: var(--space-2) !important; }',
      '}',

      /* ===== FIX 3: mode-switch pills ===== */
      '.mode-switch-btn { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-2)) !important; color: var(--color-text-muted) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)) !important; border-radius: var(--radius-full) !important; font-weight: 600 !important; min-height: 48px !important; padding: 10px 20px !important; cursor: pointer !important; transition: all 180ms ease !important; }',
      '.mode-switch-btn:hover:not(.active) { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-2)) !important; border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)) !important; color: var(--color-primary) !important; }',
      '.mode-switch-btn.active { background: var(--color-primary) !important; color: #ffffff !important; border-color: var(--color-primary) !important; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 35%, transparent) !important; font-weight: 700 !important; }',

      /* ===== FIX 4: hide things that don't help the journey ===== */
      '.tip-block, .generate-helper-tip, [data-action="dismiss-tips"] { display: none !important; }',
      '.guided-cta-recommended-badge, .weekly-new-badge, #weekly-goal-new-badge { display: none !important; }',
      '#replay-tour-btn-builder { display: none !important; }',
      'body:not(.pmg-expert-mode):not(.is-expert-mode) #keyboard-hints { display: none !important; }',

      /* ===== FIX 4: Expert Mode visible row ===== */
      '.pmg-expert-mode-row { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }',
      '.pmg-expert-toggle { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-2)); border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)); border-radius: var(--radius-full); padding: 6px 14px; cursor: pointer; transition: all 180ms ease; }',
      '.pmg-expert-toggle:hover { color: var(--color-primary); border-color: var(--color-primary); }',
      '.pmg-expert-hint { font-size: var(--text-xs); color: var(--color-text-faint); }',

      /* ===== FIX 4: helper text below Help Me Start (not in a box) ===== */
      '.pmg-help-me-start-helper { display: block; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); padding: 0 var(--space-1); }',

      /* ===== FIX 6: post-gen stacked action rows ===== */
      '.pmg-action-stack { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4); }',
      '.pmg-action-row { display: flex; flex-direction: column; gap: var(--space-1); padding: 0; }',
      '.pmg-action-btn { width: 100%; min-height: 56px; border-radius: var(--radius-md); font-size: var(--text-base); font-weight: 700; cursor: pointer; padding: var(--space-3) var(--space-4); display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 120ms ease, box-shadow 200ms ease; }',
      '.pmg-action-btn:active { transform: translateY(1px); }',
      '.pmg-action-btn.pmg-primary { background: var(--color-primary); color: #ffffff; border: 1.5px solid var(--color-primary); box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); }',
      '.pmg-action-btn.pmg-secondary { background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-2)); color: var(--color-primary); border: 1.5px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)); }',
      '.pmg-action-desc { font-size: var(--text-sm); color: var(--color-text-muted); padding: 0 var(--space-1); line-height: 1.4; }',
      '.pmg-action-row { opacity: 0; animation: pmgFadeUp 300ms ease forwards; }',
      '.pmg-action-row.pmg-row-1 { animation-delay: 0ms; }',
      '.pmg-action-row.pmg-row-2 { animation-delay: 100ms; }',
      '.pmg-action-row.pmg-row-3 { animation-delay: 200ms; }',
      '@media (max-width: 768px) {',
      '  .pmg-action-btn { min-height: 52px; }',
      '}',

      /* ===== FIX 6: result panel prominence after generation ===== */
      '#result-panel.pmg-result-revealed { box-shadow: 0 8px 32px color-mix(in srgb, var(--color-primary) 20%, transparent); transition: box-shadow 400ms ease; animation: pmgFadeUp 400ms ease forwards; scroll-margin-top: 24px; }',
      '#result-panel { scroll-margin-top: 24px; }',

      /* ===== FIX 11 + FIX 4 + FIX 6: generating button pulse + label ===== */
      '#generateBtn.pmg-generating, #image-generate-btn.pmg-generating { animation: pmgPulse 1.5s ease infinite; }',

      /* ===== FIX 7: button hierarchy override ===== */
      /* PRIMARY */
      '#generateBtn, #image-generate-btn, #runBtn, #guided-finish, #guided-mode-btn, #pmg-build-image-btn { background: var(--color-primary) !important; color: #ffffff !important; border: 1.5px solid var(--color-primary) !important; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent) !important; min-height: 52px; }',
      /* SECONDARY (cover commonly-found buttons + open-in tool buttons) */
      '#copy-btn, #fine-tune-btn, .refine-buttons .btn, .refine-buttons button, .open-in-btn, .copy-shareable-btn, #export-btn, #import-btn, #compare-btn, #download-image-btn, #generate-another-btn, .copy-response-btn, .run-again-btn { background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-2)) !important; color: var(--color-primary) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important; font-weight: 600 !important; }',
      /* TERTIARY */
      '#clear-prompt-btn, #print-btn, .collapse-all-btn, #undo-last-change-btn, .skip-btn, #guided-skip, #guided-back, #guided-q-back { background: var(--color-surface-2) !important; color: var(--color-text-muted) !important; border: 1px solid var(--color-border) !important; }',
      /* DESTRUCTIVE */
      '.btn-destructive, [data-destructive="true"], #clear-history-btn { background: color-mix(in srgb, #dc2626 10%, var(--color-surface-2)) !important; color: #dc2626 !important; border: 1px solid color-mix(in srgb, #dc2626 25%, var(--color-border)) !important; }',
      /* No raw white anywhere */
      '.btn[style*="background:#fff"], .btn[style*="background: #fff"], button[style*="background:#fff"], button[style*="background: #fff"] { background: var(--color-surface-2) !important; }',

      /* ===== FIX 8: text field interactivity ===== */
      '#goal, #fine-tune-input, #details, #mobile-sticky-input, .pmg-photo-text-input, textarea.pmg-text { background: var(--color-surface) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border)) !important; border-radius: var(--radius-md) !important; padding: var(--space-4) !important; font-size: var(--text-base) !important; color: var(--color-text) !important; cursor: text !important; transition: border-color 180ms ease, box-shadow 180ms ease !important; }',
      '#goal, #fine-tune-input, #details, textarea.pmg-text { min-height: 100px !important; }',
      '#goal:focus, #fine-tune-input:focus, #details:focus, #mobile-sticky-input:focus, .pmg-photo-text-input:focus, textarea.pmg-text:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent) !important; outline: none !important; }',
      '#goal::placeholder, #fine-tune-input::placeholder, #details::placeholder, #mobile-sticky-input::placeholder, .pmg-photo-text-input::placeholder { color: var(--color-text-faint) !important; font-style: italic !important; }',

      /* ===== FIX 9: site-wide pill styling (target known pill classes; no CSS reset of selected state colors that already have specific overrides) ===== */
      '.pmg-photo-pill, .suggestion-chip, .use-case-chip, .pmg-pill { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)) !important; color: var(--color-text) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)) !important; border-radius: var(--radius-full) !important; font-weight: 500 !important; padding: 8px 16px !important; cursor: pointer !important; transition: all 150ms ease !important; }',
      '.pmg-photo-pill:hover:not(.selected), .suggestion-chip:hover:not(.selected), .use-case-chip:hover:not(.selected), .pmg-pill:hover:not(.selected) { background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface)) !important; border-color: var(--color-primary) !important; color: var(--color-primary) !important; }',
      '.pmg-photo-pill.selected, .suggestion-chip.selected, .use-case-chip.selected, .pmg-pill.selected { background: var(--color-primary) !important; color: #ffffff !important; border-color: var(--color-primary) !important; font-weight: 700 !important; transform: scale(1.02); }',

      /* ===== FIX 6: hide the original .what-next-list (the v6 stack replaces it) ===== */
      '#what-next .what-next-list { display: none !important; }',

      /* ===== FIX 12: mobile reinforcement (preserve .global-search.pmg-expanded so the nav search toggle can re-open it) ===== */
      '@media (max-width: 768px) {',
      '  .site-search, #global-search-input, .global-search:not(.pmg-expanded), .search-label, .search-helper { display: none !important; }',
      '  .global-search.pmg-expanded { display: flex !important; }',
      '  .global-search.pmg-expanded #global-search-input { display: block !important; }',
      '  .btn, button, [role="button"] { min-height: 44px; }',
      '}',

      /* ===== FIX 5: photographer accordion ===== */
      '#pmg-photo-accordion { display: none; margin-top: var(--space-3); margin-bottom: var(--space-4); flex-direction: column; gap: var(--space-3); }',
      'body.image-mode #pmg-photo-accordion { display: flex; }',
      'body.image-mode #weekly-goal-pin { display: none !important; }',
      '.pmg-photo-card { background: var(--color-surface-2); border: 1.5px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border)); border-radius: var(--radius-lg); padding: var(--space-4); transition: border-color 200ms ease, box-shadow 200ms ease, max-height 280ms ease, padding 200ms ease, opacity 200ms ease; overflow: hidden; }',
      '.pmg-photo-card.pmg-photo-active { border-color: var(--color-primary); box-shadow: 0 4px 18px color-mix(in srgb, var(--color-primary) 14%, transparent); }',
      '.pmg-photo-card.pmg-photo-collapsed { padding: var(--space-3) var(--space-4); animation: pmgSnap 200ms ease; }',
      '.pmg-photo-card.pmg-photo-collapsed .pmg-photo-body { display: none; }',
      '.pmg-photo-card.pmg-photo-pending { opacity: 0.5; pointer-events: none; }',
      '.pmg-photo-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); cursor: pointer; user-select: none; }',
      '.pmg-photo-title { font-size: var(--text-base); font-weight: 700; color: var(--color-text); margin: 0; flex: 1; }',
      '.pmg-photo-card.pmg-photo-collapsed .pmg-photo-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); }',
      '.pmg-photo-edit-link { font-size: var(--text-xs); font-weight: 600; color: var(--color-primary); text-decoration: none; white-space: nowrap; }',
      '.pmg-photo-card:not(.pmg-photo-collapsed) .pmg-photo-edit-link { display: none; }',
      '.pmg-photo-body { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }',
      '.pmg-photo-pills { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.pmg-photo-text-input { width: 100%; }',
      '.pmg-photo-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; margin-top: var(--space-2); }',
      '.pmg-photo-next-btn { background: var(--color-primary) !important; color: #ffffff !important; border: 1.5px solid var(--color-primary) !important; border-radius: var(--radius-full); padding: 8px 18px; font-size: var(--text-sm); font-weight: 700; cursor: pointer; min-height: 40px; }',
      '.pmg-photo-skip-link { font-size: var(--text-sm); color: var(--color-text-muted); text-decoration: underline; cursor: pointer; background: transparent; border: 0; }',
      '#pmg-build-image-btn { display: none; width: 100%; min-height: 56px; border-radius: var(--radius-full); border: 1.5px solid var(--color-primary); background: var(--color-primary); color: #ffffff; font-weight: 800; font-size: var(--text-base); cursor: pointer; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); margin-top: var(--space-2); }',
      'body.image-mode #pmg-build-image-btn.pmg-ready { display: inline-flex; align-items: center; justify-content: center; }',
      '#pmg-photo-build-msg { display: none; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-2) var(--space-3); background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary); }',
      '#pmg-photo-build-msg.pmg-shown { display: block; animation: pmgFadeUp 300ms ease forwards; }',

      /* ===== FIX 5/11: image result loading shimmer + reveal ===== */
      '#imageResultWrap.pmg-shimmer { background: linear-gradient(90deg, var(--color-surface-2) 25%, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-2)) 50%, var(--color-surface-2) 75%); background-size: 200% 100%; animation: pmgShimmer 1.5s linear infinite; }',
      '#imageResultSection.pmg-revealed { animation: pmgFadeUp 400ms ease forwards; scroll-margin-top: 24px; }',
      '#imageResultSection { scroll-margin-top: 24px; }'
    ].join('\n');

    var s = document.createElement('style');
    s.id = 'pmg-fixes-v6-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ===================================================================
   * FIX 1: hero secondary CTA — add hero-text-link class (text-only)
   * =================================================================== */
  function polishHeroSecondaryCta() {
    if (!once('heroSecondaryCta')) return;
    var a = document.getElementById('hero-usecases-cta');
    if (!a) return;
    a.classList.add('hero-text-link');
    /* Ensure visible label is concise */
    var titleEl = a.querySelector('.cta-title');
    if (titleEl) {
      titleEl.textContent = 'Or See Real Examples →';
    } else if (!a.querySelector('.cta-sub')) {
      var current = (a.textContent || '').trim();
      if (!/Real Examples/i.test(current)) {
        a.textContent = 'Or See Real Examples →';
      }
    }
  }

  /* ===================================================================
   * FIX 4: move Help Me Start (#guided-mode-btn) below Fix My Prompt
   * Also drop the boxed helper and add a plain helper line below it.
   * =================================================================== */
  function reorderHelpMeStart() {
    if (!once('reorderHelpMeStart')) return;
    var help = document.getElementById('guided-mode-btn');
    var generate = document.getElementById('generateBtn');
    if (!help || !generate) return;

    var ctaRow = help.closest('#guided-cta-row, .guided-cta-row');

    /* Strip wrapping CTA row decorations so the button is clean */
    if (ctaRow) {
      var strong = ctaRow.querySelector('.guided-cta-text strong, .guided-cta-text h3, .guided-cta-text');
      if (strong) strong.style.display = 'none';
      var badge = ctaRow.querySelector('.guided-cta-recommended-badge, .recommended-badge');
      if (badge) badge.style.display = 'none';
    }

    /* Move help button to live as a sibling immediately after #generateBtn */
    if (generate.parentNode && help !== generate.nextElementSibling) {
      generate.parentNode.insertBefore(help, generate.nextSibling);
    }

    /* Inline helper below the button (not in a box) */
    if (!document.getElementById('pmg-help-me-start-helper')) {
      var p = document.createElement('p');
      p.id = 'pmg-help-me-start-helper';
      p.className = 'pmg-help-me-start-helper';
      p.textContent = 'Answer 4 quick questions and we\'ll fill everything in for you.';
      if (help.parentNode) help.parentNode.insertBefore(p, help.nextSibling);
    }

    /* Clean any empty CTA row leftover */
    if (ctaRow && !ctaRow.querySelector('button, a.btn')) {
      ctaRow.style.display = 'none';
    }
  }

  /* ===================================================================
   * FIX 4: visible Expert Mode button row
   * =================================================================== */
  function addExpertModeRow() {
    if (!once('expertModeRow')) return;
    if (document.getElementById('pmg-expert-toggle-btn')) return;

    /* Find any existing fine-print expert toggle (existing #expert-toggle, .expert-mode-toggle, etc.) */
    var existing = document.querySelector('#expert-toggle, .expert-mode-toggle, [data-toggle="expert-mode"]');

    /* Anchor must be visible — never inside a collapsed <details>.
     * Prefer the parent of #generateBtn so the row sits in the main flow. */
    var anchor = null;
    var generate = document.getElementById('generateBtn');
    if (generate && generate.parentNode) anchor = generate.parentNode;
    /* If that parent is itself inside a <details>, walk up until we are out */
    while (anchor && anchor.closest && anchor.closest('details')) {
      var details = anchor.closest('details');
      anchor = (details && details.parentNode) ? details.parentNode : null;
    }
    if (!anchor) return;

    var row = document.createElement('div');
    row.className = 'pmg-expert-mode-row';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-expert-toggle-btn';
    btn.className = 'pmg-expert-toggle';
    btn.textContent = '⚙ Expert Mode';
    btn.setAttribute('inputmode', 'none');

    var hint = document.createElement('span');
    hint.className = 'pmg-expert-hint';
    hint.textContent = 'Full Control Over Every Setting';

    btn.addEventListener('click', function () {
      var nextOn = !document.body.classList.contains('is-expert-mode');
      /* Mirror onto BOTH classes so v6 and existing code (v5/index.html) agree */
      document.body.classList.toggle('pmg-expert-mode', nextOn);
      document.body.classList.toggle('is-expert-mode', nextOn);
      /* Drive the underlying checkbox so existing handlers also fire */
      var checkbox = document.getElementById('expert-mode-toggle');
      if (checkbox) {
        if (checkbox.checked !== nextOn) {
          checkbox.checked = nextOn;
          try { checkbox.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      } else if (existing && typeof existing.click === 'function') {
        try { existing.click(); } catch (e) {}
      }
    });

    /* If existing toggle changes via other code paths, mirror onto v6 class */
    var checkbox = document.getElementById('expert-mode-toggle');
    if (checkbox) {
      checkbox.addEventListener('change', function () {
        document.body.classList.toggle('pmg-expert-mode', !!checkbox.checked);
      });
    }
    /* Also observe is-expert-mode → mirror onto pmg-expert-mode */
    if ('MutationObserver' in window) {
      var bmo = new MutationObserver(function () {
        var on = document.body.classList.contains('is-expert-mode');
        document.body.classList.toggle('pmg-expert-mode', on);
      });
      bmo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    row.appendChild(btn);
    row.appendChild(hint);

    /* Append at end of anchor */
    anchor.appendChild(row);
  }

  /* ===================================================================
   * FIX 4 + 11: pulse + label change on Fix My Prompt while generating
   * =================================================================== */
  function decorateGenerateButton() {
    if (!once('decorateGenerate')) return;
    var btn = document.getElementById('generateBtn');
    if (!btn) return;

    var labelEl = btn.querySelector('.btn-label, .cta-title') || btn;
    var originalText = (labelEl === btn ? btn.textContent : labelEl.textContent) || 'Fix My Prompt';

    var imgBtn = document.getElementById('image-generate-btn');

    function startPulse(target, loadingText) {
      if (!target) return;
      /* Re-entry guard: if we're already pulsing, do not overwrite the saved original */
      if (target.classList.contains('pmg-generating')) return;
      target.classList.add('pmg-generating');
      if (!target.hasAttribute('data-pmg-orig-text')) {
        target.setAttribute('data-pmg-orig-text', target.textContent || '');
      }
      target.textContent = loadingText;
    }
    function stopPulse(target, fallbackText) {
      if (!target) return;
      target.classList.remove('pmg-generating');
      var orig = target.getAttribute('data-pmg-orig-text');
      if (orig) target.textContent = orig;
      else if (fallbackText) target.textContent = fallbackText;
      target.removeAttribute('data-pmg-orig-text');
    }

    btn.addEventListener('click', function () {
      startPulse(btn, 'Building Your Prompt...');
      /* Stop pulse when result panel reveals OR after 30s safety */
      var killed = false;
      function cleanup() {
        if (killed) return;
        killed = true;
        stopPulse(btn, originalText);
      }
      setTimeout(cleanup, 30000);
      var resultPanel = document.getElementById('result-panel');
      if (resultPanel && 'MutationObserver' in window) {
        var rmo = new MutationObserver(function () {
          var visible = resultPanel.offsetParent !== null && (resultPanel.textContent || '').trim().length > 30;
          if (visible) {
            cleanup();
            rmo.disconnect();
          }
        });
        rmo.observe(resultPanel, { childList: true, subtree: true, attributes: true });
        setTimeout(function () { rmo.disconnect(); }, 30000);
      }
    });

    if (imgBtn) {
      imgBtn.addEventListener('click', function () {
        startPulse(imgBtn, 'Creating Your Image With DALL·E 3...');
        setTimeout(function () { stopPulse(imgBtn); }, 30000);
        var imgRes = document.getElementById('imageResultSection');
        if (imgRes && 'MutationObserver' in window) {
          var imo = new MutationObserver(function () {
            if (!imgRes.hidden && imgRes.querySelector('img')) {
              stopPulse(imgBtn);
              imo.disconnect();
            }
          });
          imo.observe(imgRes, { childList: true, subtree: true, attributes: true });
          setTimeout(function () { imo.disconnect(); }, 30000);
        }
      });
    }
  }

  /* ===================================================================
   * FIX 6: post-generation result flow — stacked Run/Copy/Refine rows
   * (the formerly-built v5 `.pmg-wn-grid` no longer exists; this stack is
   * the only post-gen action UI inside #what-next).
   * =================================================================== */
  function rebuildPostGenStack() {
    if (!once('postGenStack')) return;
    var wn = document.getElementById('what-next');
    if (!wn) return;

    /* Title kept (the consolidated v5 `setWhatNextTitle` already sets it) */

    if (wn.querySelector('.pmg-action-stack')) return;

    var stack = document.createElement('div');
    stack.className = 'pmg-action-stack';

    var rows = [
      {
        rowClass: 'pmg-row-1',
        btnClass: 'pmg-primary',
        label: '▶ Run With AI',
        desc: 'See your AI answer right here — no copy-paste needed',
        click: function () {
          var rb = document.getElementById('runBtn');
          if (rb) { rb.click(); return; }
          if (typeof window.runWithAI === 'function') window.runWithAI();
        }
      },
      {
        rowClass: 'pmg-row-2',
        btnClass: 'pmg-secondary',
        label: 'Copy Prompt',
        desc: 'Take it to ChatGPT, Claude, or any AI tool you already use',
        click: function () {
          var cb = document.getElementById('copy-btn');
          if (cb) cb.click();
        }
      },
      {
        rowClass: 'pmg-row-3',
        btnClass: 'pmg-secondary',
        label: 'Refine It',
        desc: 'Make it stronger before you run it',
        click: function () {
          var fi = document.getElementById('fine-tune-input');
          if (fi) {
            try { fi.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            setTimeout(function () { try { fi.focus(); } catch (e2) {} }, 400);
          }
        }
      }
    ];

    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'pmg-action-row ' + r.rowClass;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-action-btn ' + r.btnClass;
      btn.textContent = r.label;
      btn.setAttribute('inputmode', 'none');
      btn.addEventListener('click', r.click);

      var desc = document.createElement('p');
      desc.className = 'pmg-action-desc';
      desc.textContent = r.desc;

      row.appendChild(btn);
      row.appendChild(desc);
      stack.appendChild(row);
    });

    wn.appendChild(stack);
  }

  /* ===================================================================
   * FIX 6: result panel reveal animation + scroll-into-view
   * =================================================================== */
  function watchResultPanel() {
    if (!once('watchResult')) return;
    var rp = document.getElementById('result-panel');
    if (!rp || !('MutationObserver' in window)) return;

    /* Gate the reveal on a real generated prompt rather than any >30-char
     * mutation. Without this, mutations from labels, status pills, or
     * banner injections inside #result-panel would prematurely fire the
     * reveal animation and the smooth scroll. We mirror pmg-bugfix.js's
     * hasRealPrompt logic (case-insensitive). */
    var PLACEHOLDER_PREFIXES = [
      'your fixed prompt will appear here',
      'your generated prompt will appear here',
      'generating your prompt',
      'generating demo prompt',
      'please enter a goal',
      'add a clear goal first',
      'could not generate'
    ];

    function isRealPrompt() {
      var rb = document.getElementById('resultBox') || rp;
      var t = (rb.textContent || '').trim();
      if (!t) return false;
      var lo = t.toLowerCase();
      for (var i = 0; i < PLACEHOLDER_PREFIXES.length; i++) {
        if (lo.indexOf(PLACEHOLDER_PREFIXES[i]) === 0) return false;
      }
      return t.replace(/\s+/g, '').length >= 30;
    }

    var revealed = false;
    var mo = new MutationObserver(function () {
      if (revealed) return;
      var visible = rp.offsetParent !== null;
      if (visible && isRealPrompt()) {
        revealed = true;
        rp.classList.add('pmg-result-revealed');
        try { rp.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
        /* one-shot — never re-grab focus on later mutations (stream updates etc) */
        mo.disconnect();
      }
    });
    mo.observe(rp, { childList: true, subtree: true, attributes: true });
  }

  /* ===================================================================
   * FIX 10: extend mobile keyboard hardening (v5 covers most; add inputmode)
   * =================================================================== */
  function hardenMobileKeyboard() {
    if (!once('mobileKeyboardV6')) return;
    var TEXT_INPUTS = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="number"],input[type="password"],input[type="tel"],input[type="url"],textarea,[contenteditable="true"],[contenteditable=""]';

    var sels = [
      'button', 'a.btn', '[role="button"]',
      '.btn-secondary', '.btn-ghost', '.accent-swatch',
      '.popular-use-card', '.mode-switch-btn', '.pmg-photo-pill',
      '.suggestion-chip', '.use-case-chip', '.pmg-pill',
      '.history-btn', '.template-btn', 'summary',
      '.refine-buttons button', '.refine-buttons .btn',
      '.open-in-btn', '.pmg-action-btn'
    ];

    function applyInputmode(root) {
      var nodes;
      try { nodes = (root || document).querySelectorAll(sels.join(',')); }
      catch (e) { return; }
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.matches && n.matches(TEXT_INPUTS)) return;
        if (n.tagName === 'BUTTON' && n.type === 'submit' && n.closest('form') && n.closest('form').querySelector(TEXT_INPUTS)) return;
        if (!n.hasAttribute('inputmode')) n.setAttribute('inputmode', 'none');
      });
    }
    applyInputmode(document);
    setTimeout(function () { applyInputmode(document); }, 1500);
    setTimeout(function () { applyInputmode(document); }, 5000);

    /* Sticky bar attrs reinforcement */
    var sticky = document.getElementById('mobile-sticky-input');
    if (sticky) {
      sticky.removeAttribute('autofocus');
      sticky.setAttribute('autocomplete', 'off');
      sticky.setAttribute('autocorrect', 'off');
      sticky.setAttribute('autocapitalize', 'off');
      sticky.setAttribute('spellcheck', 'false');
    }

    /* Wizard touch-action */
    var wiz = document.querySelector('.pmg-wizard, #pmg-wizard, .guided-wizard, [data-wizard]');
    if (wiz) wiz.style.touchAction = 'pan-y';

    /* Blur on non-input click */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var clickable = t.closest('button, a[href], [role="button"], .pmg-action-btn, .pmg-photo-pill, .pmg-pill, .mode-switch-btn');
      if (!clickable) return;
      if (clickable.matches && clickable.matches(TEXT_INPUTS)) return;
      var inside = clickable.querySelector && clickable.querySelector(TEXT_INPUTS);
      if (inside) return;
      setTimeout(function () {
        var ae = document.activeElement;
        if (ae && ae !== document.body && typeof ae.blur === 'function') {
          try { ae.blur(); } catch (e) {}
        }
      }, 10);
    }, true);
  }

  /* ===================================================================
   * FIX 13: title case sweep extension (additive to v5)
   * =================================================================== */
  function titleCaseSweepV6() {
    if (!once('titleCaseV6')) return;
    var pairs = [
      ['Improve with AI', 'Improve With AI'],
      ['Check prompt quality', 'Check Prompt Quality'],
      ['Use demo values', 'Use Demo Values'],
      ['Show archived', 'Show Archived'],
      ['Compare two', 'Compare Two'],
      ['Collapse all', 'Collapse All'],
      ['Clear all history', 'Clear All History'],
      ['Export everything', 'Export Everything'],
      ['Import backup', 'Import Backup'],
      ['Backup / restore', 'Backup / Restore'],
      ['Notes only', 'Notes Only'],
      ['Use this →', 'Use This →'],
      ['Use your prompt in:', 'Use Your Prompt In:'],
      ['Use your prompt in', 'Use Your Prompt In'],
      ['Tag insights', 'Tag Insights'],
      ['Daily streak', 'Daily Streak'],
      ['Saved prompts', 'Saved Prompts'],
      ['Total reuses', 'Total Reuses'],
      ['Top tag', 'Top Tag'],
      ['This week at a glance', 'This Week At A Glance'],
      ['Why most AI prompts fail', 'Why Most AI Prompts Fail'],
      ['What people are saying', 'What People Are Saying'],
      ['See the difference', 'See The Difference'],
      ['Build my image', 'Build My Image'],
      ['Generate another', 'Generate Another'],
      ['Skip this step →', 'Skip This Step →'],
      ['Tap to edit', 'Tap To Edit'],
      ['Add a reference image (optional)', 'Add A Reference Image (Optional)'],
      ['THIS WEEK\'S FOCUS', 'This Week\'s Focus'],
      ['THIS WEEK AT A GLANCE', 'This Week At A Glance'],
      ['MOST-USED TEMPLATE', 'Most-Used Template'],
      ['MOST-USED PROMPT', 'Most-Used Prompt'],
      ['DAILY STREAK', 'Daily Streak'],
      ['SAVED PROMPTS', 'Saved Prompts'],
      ['TOTAL REUSES', 'Total Reuses'],
      ['TOP TAG', 'Top Tag'],
      ['WHY IT MATTERS', 'Why It Matters'],
      ['EARLY FEEDBACK', 'Early Feedback'],
      ['REFINE YOUR PROMPT INSTANTLY', 'Refine Your Prompt'],
      ['Update prompt', 'Update Prompt'],
      ['Print / save PDF', 'Print / Save PDF'],
      ['Copy shareable link', 'Copy Shareable Link']
    ];

    function fixIn(root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var v = node.nodeValue;
        if (!v || v.length < 3) continue;
        var parent = node.parentNode;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
        var changed = v;
        for (var i = 0; i < pairs.length; i++) {
          if (changed.indexOf(pairs[i][0]) !== -1) {
            changed = changed.split(pairs[i][0]).join(pairs[i][1]);
          }
        }
        if (changed !== v) node.nodeValue = changed;
      }
    }

    fixIn(document.body);
    setTimeout(function () { fixIn(document.body); }, 1500);
    setTimeout(function () { fixIn(document.body); }, 5000);
  }

  /* ===================================================================
   * FIX 5: photographer accordion
   * =================================================================== */
  var PHOTO_QUESTIONS = [
    {
      id: 'subject', kind: 'text',
      title: 'What Is Your Main Subject?',
      placeholder: 'A person, animal, object, landscape, scene...'
    },
    {
      id: 'shot', kind: 'pills',
      title: 'Shot Type — How Close Are We?',
      options: ['Extreme Close-Up (Face, Texture, Detail)', 'Close-Up (Head And Shoulders)', 'Medium Shot (Waist Up)', 'Full Body Shot', 'Wide Shot (Subject + Environment)', "Aerial / Bird's Eye View", "Worm's Eye View (Looking Up)", 'Over The Shoulder']
    },
    {
      id: 'lens', kind: 'pills',
      title: 'Camera Lens Feel?',
      options: ['Wide Angle (Expansive, Dramatic)', 'Standard (Natural, True To Life)', 'Telephoto (Compressed, Intimate)', 'Macro (Ultra Close Detail)', 'Fisheye (Distorted, Creative)', 'Tilt-Shift (Miniature Effect)']
    },
    {
      id: 'lighting', kind: 'pills',
      title: 'Lighting Setup?',
      options: ['Golden Hour (Warm, Soft Sunset)', 'Blue Hour (Cool, Moody Dusk)', 'Harsh Midday Sun (High Contrast)', 'Overcast (Soft, Even, No Shadows)', 'Studio Lighting (Clean, Controlled)', 'Neon & Artificial (Urban Night)', 'Candlelight / Fire (Warm, Intimate)', 'Backlit (Silhouette, Halo Effect)']
    },
    {
      id: 'mood', kind: 'pills',
      title: 'Mood And Color Palette?',
      options: ['Cinematic & Dramatic', 'Bright & Airy', 'Dark & Moody', 'Warm & Nostalgic', 'Cool & Minimal', 'Vibrant & Saturated', 'Black & White', 'Vintage Film Grain']
    },
    {
      id: 'camera', kind: 'text', optional: true,
      title: 'Camera And Film Style? (Optional)',
      placeholder: 'Shot on iPhone 16 Pro, Canon 5D, Kodak Portra 400, 35mm film, 8K RAW...'
    }
  ];

  /* Pretty label keys for collapsed headers */
  var LABEL_KEYS = { subject: 'Subject', shot: 'Shot', lens: 'Lens', lighting: 'Lighting', mood: 'Mood', camera: 'Camera' };

  function buildPhotoAccordion() {
    if (!once('photoAccordion')) return;
    if (document.getElementById('pmg-photo-accordion')) return;

    /* Anchor: insert just BEFORE the form so it appears under the mode pills + image hint */
    var hint = document.querySelector('.image-mode-hint');
    var form = document.getElementById('prompt-form');
    if (!form) return;

    var acc = document.createElement('div');
    acc.id = 'pmg-photo-accordion';
    acc.setAttribute('aria-label', 'Guided Image Builder');

    var answers = {};

    function selectionLabel(qId) {
      var v = answers[qId];
      if (!v) return '';
      var s = String(v);
      if (s.length > 56) s = s.slice(0, 53) + '...';
      return s;
    }

    function renderHeaderTitle(card, q, collapsed) {
      var titleEl = card.querySelector('.pmg-photo-title');
      if (!titleEl) return;
      if (collapsed && answers[q.id]) {
        titleEl.textContent = LABEL_KEYS[q.id] + ': ' + selectionLabel(q.id);
      } else {
        titleEl.textContent = q.title;
      }
    }

    function setActiveCard(idx) {
      var cards = acc.querySelectorAll('.pmg-photo-card');
      Array.prototype.forEach.call(cards, function (c, i) {
        c.classList.remove('pmg-photo-active', 'pmg-photo-pending');
        if (i < idx) {
          if (!c.classList.contains('pmg-photo-collapsed')) c.classList.add('pmg-photo-collapsed');
        } else if (i === idx) {
          c.classList.remove('pmg-photo-collapsed');
          c.classList.add('pmg-photo-active');
        } else {
          c.classList.add('pmg-photo-pending');
        }
        renderHeaderTitle(c, PHOTO_QUESTIONS[i], c.classList.contains('pmg-photo-collapsed'));
      });
      maybeShowBuildBtn();
    }

    function commitAndAdvance(idx) {
      var card = acc.querySelectorAll('.pmg-photo-card')[idx];
      if (!card) return;
      card.classList.add('pmg-photo-collapsed');
      card.classList.remove('pmg-photo-active');
      renderHeaderTitle(card, PHOTO_QUESTIONS[idx], true);
      var nextIdx = idx + 1;
      if (nextIdx < PHOTO_QUESTIONS.length) {
        setTimeout(function () { setActiveCard(nextIdx); }, 220);
      } else {
        maybeShowBuildBtn();
      }
    }

    function maybeShowBuildBtn() {
      var btn = document.getElementById('pmg-build-image-btn');
      if (!btn) return;
      /* Subject is required; the rest can be empty (skipped) */
      if (answers.subject && String(answers.subject).trim().length > 0) {
        btn.classList.add('pmg-ready');
      } else {
        btn.classList.remove('pmg-ready');
      }
    }

    PHOTO_QUESTIONS.forEach(function (q, idx) {
      var card = document.createElement('div');
      card.className = 'pmg-photo-card';
      card.setAttribute('data-pmg-q', q.id);
      if (idx > 0) card.classList.add('pmg-photo-pending');
      else card.classList.add('pmg-photo-active');

      var header = document.createElement('div');
      header.className = 'pmg-photo-header';
      var title = document.createElement('h4');
      title.className = 'pmg-photo-title';
      title.textContent = q.title;
      var edit = document.createElement('a');
      edit.href = '#';
      edit.className = 'pmg-photo-edit-link';
      edit.textContent = 'Tap To Edit';
      edit.addEventListener('click', function (ev) { ev.preventDefault(); setActiveCard(idx); });
      header.appendChild(title);
      header.appendChild(edit);
      header.addEventListener('click', function (ev) {
        if (ev.target.tagName === 'A') return;
        if (card.classList.contains('pmg-photo-collapsed')) setActiveCard(idx);
      });
      card.appendChild(header);

      var body = document.createElement('div');
      body.className = 'pmg-photo-body';

      if (q.kind === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pmg-photo-text-input';
        input.placeholder = q.placeholder || '';
        input.setAttribute('aria-label', q.title);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); confirmText(); }
        });
        body.appendChild(input);

        var actions = document.createElement('div');
        actions.className = 'pmg-photo-actions';
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'pmg-photo-next-btn';
        nextBtn.textContent = idx === PHOTO_QUESTIONS.length - 1 ? 'Done' : 'Next →';
        nextBtn.setAttribute('inputmode', 'none');
        nextBtn.addEventListener('click', confirmText);
        actions.appendChild(nextBtn);

        if (q.optional) {
          var skip = document.createElement('button');
          skip.type = 'button';
          skip.className = 'pmg-photo-skip-link';
          skip.textContent = 'Skip This Step →';
          skip.setAttribute('inputmode', 'none');
          skip.addEventListener('click', function () {
            answers[q.id] = '';
            commitAndAdvance(idx);
          });
          actions.appendChild(skip);
        }
        body.appendChild(actions);

        function confirmText() {
          var v = (input.value || '').trim();
          if (!v && !q.optional) { input.focus(); return; }
          answers[q.id] = v;
          commitAndAdvance(idx);
        }
      } else if (q.kind === 'pills') {
        var pills = document.createElement('div');
        pills.className = 'pmg-photo-pills';
        q.options.forEach(function (opt) {
          var p = document.createElement('button');
          p.type = 'button';
          p.className = 'pmg-photo-pill';
          p.textContent = opt;
          p.setAttribute('inputmode', 'none');
          p.addEventListener('click', function () {
            Array.prototype.forEach.call(pills.querySelectorAll('.pmg-photo-pill'), function (sib) { sib.classList.remove('selected'); });
            p.classList.add('selected');
            answers[q.id] = opt;
            setTimeout(function () { commitAndAdvance(idx); }, 800);
          });
          pills.appendChild(p);
        });
        body.appendChild(pills);
      }
      card.appendChild(body);
      acc.appendChild(card);
    });

    /* Build button */
    var buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.id = 'pmg-build-image-btn';
    buildBtn.textContent = 'Build My Image';
    buildBtn.setAttribute('inputmode', 'none');
    buildBtn.addEventListener('click', function () {
      var subject = (answers.subject || '').trim();
      if (!subject) return;
      var parts = [];
      var lead = answers.shot ? (String(answers.shot).split(' (')[0] + ' of ') : '';
      parts.push(lead + subject);
      if (answers.lens) parts.push(String(answers.lens).split(' (')[0] + ' lens');
      if (answers.lighting) parts.push(String(answers.lighting).split(' (')[0]);
      if (answers.mood) parts.push(String(answers.mood));
      if (answers.camera && String(answers.camera).trim()) parts.push(String(answers.camera).trim());
      var phrase = parts.join(', ');

      var goal = document.getElementById('goal');
      if (goal) {
        /* Animate text flowing into textarea */
        goal.value = '';
        try { goal.focus(); } catch (e) {}
        var i = 0;
        var step = Math.max(1, Math.floor(phrase.length / 60));
        var timer = setInterval(function () {
          i = Math.min(phrase.length, i + step);
          goal.value = phrase.slice(0, i);
          try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
          if (i >= phrase.length) {
            clearInterval(timer);
            try { goal.blur(); } catch (e) {}
          }
        }, 18);
      }

      /* Confirmation message */
      var msg = document.getElementById('pmg-photo-build-msg');
      if (!msg) {
        msg = document.createElement('p');
        msg.id = 'pmg-photo-build-msg';
        msg.textContent = 'Your Image Description Is Ready — Click Generate Image To Create It.';
        buildBtn.parentNode.insertBefore(msg, buildBtn.nextSibling);
      }
      msg.classList.add('pmg-shown');

      /* Smooth-collapse the entire accordion (visually) */
      Array.prototype.forEach.call(acc.querySelectorAll('.pmg-photo-card'), function (c, i) {
        c.classList.add('pmg-photo-collapsed');
        renderHeaderTitle(c, PHOTO_QUESTIONS[i], true);
      });

      /* Scroll to image generate button */
      var ig = document.getElementById('image-generate-btn');
      if (ig) { try { ig.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
    });

    /* Insertion point: replace image-mode-hint behavior so accordion follows it */
    var anchor = hint && hint.parentNode ? hint : form;
    if (hint && hint.parentNode) {
      hint.parentNode.insertBefore(acc, hint.nextSibling);
      acc.parentNode.insertBefore(buildBtn, acc.nextSibling);
    } else {
      form.parentNode.insertBefore(acc, form);
      form.parentNode.insertBefore(buildBtn, form);
    }
  }

  /* ===================================================================
   * FIX 5/11: image result shimmer + reveal animation
   * =================================================================== */
  function watchImageResult() {
    if (!once('watchImageResult')) return;
    var section = document.getElementById('imageResultSection');
    var wrap = document.getElementById('imageResultWrap');
    var btn = document.getElementById('image-generate-btn');
    if (!section || !wrap || !btn) return;

    btn.addEventListener('click', function () {
      wrap.classList.add('pmg-shimmer');
      /* Always start a fresh terminal observer per click so we don't leak
       * and so a retry after a previous error gets a fresh shimmer cycle. */
      startObserver();
      /* Hard safety: clear shimmer after 60s no matter what */
      setTimeout(function () { wrap.classList.remove('pmg-shimmer'); }, 60000);
    });

    if (!('MutationObserver' in window)) return;

    var current = null;
    function startObserver() {
      if (current) { current.disconnect(); current = null; }
      var revealed = false;
      var mo = new MutationObserver(function () {
        var hasImg = !!wrap.querySelector('img');
        var hasErr = !!wrap.querySelector('.image-error, [data-image-error], .error-message');
        var bodyTxt = (wrap.textContent || '').toLowerCase();
        var looksError = hasErr || /error|failed|too many|try again|denied/i.test(bodyTxt);
        if (hasImg || looksError) {
          wrap.classList.remove('pmg-shimmer');
          if (hasImg && !revealed && !section.hidden) {
            revealed = true;
            section.classList.add('pmg-revealed');
            try { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
          }
          mo.disconnect();
          if (current === mo) current = null;
        }
      });
      mo.observe(section, { childList: true, subtree: true, attributes: true });
      current = mo;
    }
  }

  /* ===================================================================
   * Init
   * =================================================================== */
  function init() {
    injectStyles();
    polishHeroSecondaryCta();
    reorderHelpMeStart();
    addExpertModeRow();
    decorateGenerateButton();
    rebuildPostGenStack();
    watchResultPanel();
    hardenMobileKeyboard();
    titleCaseSweepV6();
    buildPhotoAccordion();
    watchImageResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
 * T14 — Scroll-fatigue trim (mobile + desktop)
 *
 *   1. Hide the "Why It Matters / Why Most AI Prompts Fail" section.
 *      Its content recaps the hero subhead. The #why-prompts-fail anchor
 *      still resolves to the (now zero-height) section position, which is
 *      immediately above #how-it-works — the right semantic destination.
 *
 *   2. Progressive-reveal "See The Difference": show 1 Before/After example
 *      by default, collapse the other 2 behind a "See N More Comparisons →"
 *      button. Preserves all content; cuts ~60% of section height on first
 *      view. Section anchor and IO reveal animation remain intact.
 *
 *   Hard rules: no DOM deletion, no rename of existing IDs/classes,
 *   no flex/order CSS reorder, anchors keep working, Title Case labels.
 * ========================================================================== */
(function pmgT14ScrollTrim() {
  'use strict';
  if (window.__pmg_t14_scrolltrim) return;
  window.__pmg_t14_scrolltrim = true;

  var STYLE_ID = 'pmg-t14-scrolltrim-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '@keyframes pmgT14FadeUp {',
      '  from { opacity: 0; transform: translateY(8px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',
      '#why-prompts-fail.why-prompts-fail-section { display: none !important; }',
      '#see-the-difference .std-row.pmg-std-collapsed { display: none !important; }',
      '#see-the-difference .pmg-std-reveal-wrap {',
      '  display: flex;',
      '  justify-content: center;',
      '  margin-top: var(--space-4, 16px);',
      '}',
      '#see-the-difference .pmg-std-reveal-btn {',
      '  background: transparent;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f7a78) 32%, transparent);',
      '  color: var(--color-primary, #0f7a78);',
      '  padding: 10px 22px;',
      '  border-radius: 999px;',
      '  font: inherit;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;',
      '}',
      '#see-the-difference .pmg-std-reveal-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary, #0f7a78) 6%, transparent);',
      '  border-color: color-mix(in srgb, var(--color-primary, #0f7a78) 55%, transparent);',
      '  transform: translateY(-1px);',
      '}',
      '#see-the-difference .pmg-std-reveal-btn:focus-visible {',
      '  outline: 2px solid var(--color-primary, #0f7a78);',
      '  outline-offset: 2px;',
      '}',
      '#see-the-difference.pmg-std-expanded .pmg-std-reveal-wrap { display: none; }',
      '#see-the-difference .std-row.pmg-std-revealed {',
      '  animation: pmgT14FadeUp 360ms ease both;',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function trimSeeTheDifference() {
    var section = document.getElementById('see-the-difference');
    if (!section) return false;
    if (section.dataset.pmgT14Trimmed === '1') return true;
    var grid = section.querySelector('.std-grid');
    if (!grid) return false;
    var rows = grid.querySelectorAll(':scope > .std-row');
    if (!rows || rows.length <= 1) {
      section.dataset.pmgT14Trimmed = '1';
      return true;
    }
    var hidden = [];
    for (var i = 1; i < rows.length; i++) {
      rows[i].classList.add('pmg-std-collapsed');
      if (!rows[i].id) rows[i].id = 'pmg-std-row-extra-' + i;
      hidden.push(rows[i]);
    }
    if (grid.parentNode.querySelector('.pmg-std-reveal-wrap')) {
      section.dataset.pmgT14Trimmed = '1';
      return true;
    }
    var wrap = document.createElement('div');
    wrap.className = 'pmg-std-reveal-wrap';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-std-reveal-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', hidden.map(function (r) { return r.id; }).join(' '));
    btn.textContent = 'See ' + hidden.length + ' More Comparison' +
      (hidden.length === 1 ? '' : 's') + ' →';
    btn.addEventListener('click', function () {
      hidden.forEach(function (row) {
        row.classList.remove('pmg-std-collapsed');
        row.classList.add('pmg-std-revealed');
      });
      section.classList.add('pmg-std-expanded');
      btn.setAttribute('aria-expanded', 'true');
    });
    wrap.appendChild(btn);
    grid.parentNode.insertBefore(wrap, grid.nextSibling);
    section.dataset.pmgT14Trimmed = '1';
    return true;
  }

  function init() {
    injectStyles();
    if (trimSeeTheDifference()) return;
    var mo = new MutationObserver(function () {
      if (trimSeeTheDifference()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T15 — Friction reduction pass
 * Scope: consolidate competing CTAs (Help Me Start ×3, Expert Mode ×3,
 * Run With AI ×2), restyle mode switch as a true segmented control,
 * strengthen weak labels, move Need Ideas under carousel, collapse photo
 * accordion by category, surface image result + download placeholder,
 * hide unexplained sticky dock, hide WORKSPACE eyebrow, fix Real Examples
 * sub-line redundancy.
 * Hard rules: NEW logic only, no DOM rewrites, no ID/class renames,
 * hide/move/collapse over delete, anchors preserved, Title Case, all CSS
 * via vars. Re-entry guarded.
 * ===================================================================== */
(function pmgT15FrictionPass() {
  'use strict';
  if (window.__pmg_t15_friction) return;
  window.__pmg_t15_friction = true;

  var STYLE_ID = 'pmg-t15-friction-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '/* ===== T15.1 Mode switch — true segmented control look ===== */',
      '.mode-switch { background: var(--color-surface-2, color-mix(in srgb, var(--color-text) 5%, var(--color-surface))); border: 1px solid var(--color-border); border-radius: 999px; padding: 4px; gap: 0; box-shadow: none !important; }',
      '.mode-switch-btn { box-shadow: none !important; font-weight: 600; transition: background 180ms ease, color 180ms ease; }',
      '.mode-switch-btn:not(.active) { background: transparent !important; color: var(--color-text-muted) !important; border: 0 !important; }',
      '.mode-switch-btn:not(.active):hover { color: var(--color-text) !important; background: color-mix(in srgb, var(--color-text) 4%, transparent) !important; }',
      '.mode-switch-btn.active { background: var(--color-primary) !important; color: var(--color-text-inverse, #ffffff) !important; box-shadow: var(--shadow-sm) !important; }',
      '',
      '/* ===== T15.2 Help Me Start consolidation: hide dups ONLY when canonical keeper exists (body.pmg-t15-help-ok) ===== */',
      '.pmg-t15-hide-dup { display: none !important; }',
      'body.pmg-t15-help-ok #pmg-help-me-start-btn { display: none !important; }',
      'body.pmg-t15-help-ok #build-cta-guidance { display: none !important; }',
      '/* Center surviving Help Me Start button text */',
      'body.pmg-t15-applied #guided-mode-btn { text-align: center !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 8px; }',
      '',
      '/* ===== T15.3 Expert Mode consolidation: hide dups ONLY when canonical keeper exists (body.pmg-t15-expert-ok) ===== */',
      'body.pmg-t15-expert-ok #expert-mode-link { display: none !important; }',
      'body.pmg-t15-expert-ok .expert-mode-link-row { display: none !important; }',
      'body.pmg-t15-expert-ok #expert-mode-toggle-wrap { display: none !important; }',
      'body.pmg-t15-expert-ok #builder-expert-hint { display: none !important; }',
      '',
      '/* ===== T15.4 Strengthen "Your Goal" label — handled in JS via textContent ===== */',
      '',
      '/* ===== T15.5 WORKSPACE eyebrow hide ===== */',
      'body.pmg-t15-applied .workspace-header-eyebrow { display: none !important; }',
      'body.pmg-t15-applied .workspace-header { padding-bottom: var(--space-2) !important; }',
      '',
      '/* ===== T15.6 Need Ideas under carousel — handled in JS via DOM move ===== */',
      '.pmg-need-ideas-wrap { display: flex; justify-content: center; margin-top: var(--space-4, 16px); }',
      '.pmg-need-ideas-wrap .usecases-dice-btn { margin: 0; }',
      '',
      '/* ===== T15.7 Photo accordion — collapsible category sections ===== */',
      '.pmg-photo-q-header { all: unset; display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; padding: 4px 0 8px; font-size: 13px; font-weight: 700; color: var(--color-text); box-sizing: border-box; user-select: none; }',
      '.pmg-photo-q-header:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }',
      '.pmg-photo-q-header-text { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
      '.pmg-photo-q-chevron { display: inline-block; transition: transform 200ms ease; color: var(--color-text-muted); font-size: 14px; line-height: 1; }',
      '.pmg-photo-q.pmg-cat-collapsed .pmg-photo-q-chevron { transform: rotate(-90deg); }',
      '.pmg-photo-q-body { padding-top: 4px; }',
      '.pmg-photo-q.pmg-cat-collapsed .pmg-photo-q-body { display: none !important; }',
      '.pmg-photo-q-summary { font-size: 12px; font-weight: 500; color: var(--color-text-muted); font-style: italic; }',
      '.pmg-photo-q.pmg-cat-collapsed .pmg-photo-q-summary { color: var(--color-primary); font-style: normal; }',
      '',
      '/* ===== T15.8 Image result container + download discoverability ===== */',
      'body.image-mode #imageResultSection { display: block !important; }',
      'body.image-mode #imageResultSection[hidden] { display: block !important; }',
      'body.image-mode #imageResultSection .image-placeholder { display: block; padding: var(--space-8, 32px); text-align: center; color: var(--color-text-faint, var(--color-text-muted)); font-size: var(--text-sm); }',
      'body.image-mode #imageDownloadBtn.pmg-t15-hint { display: inline-flex !important; opacity: 0.45; pointer-events: none; cursor: not-allowed; }',
      'body.image-mode #imageResultSection .pmg-t15-image-hint { display: block; margin-top: 8px; font-size: var(--text-xs); color: var(--color-text-muted); text-align: center; font-style: italic; }',
      '',
      '/* ===== T15.9 Sticky bottom dock — hide (unexplained, duplicates builder) ===== */',
      '#mobile-sticky-bar, .mobile-sticky-bar { display: none !important; }',
      'body { padding-bottom: 0 !important; }',
      '',
      '/* ===== T15.10 Demote duplicate Run With AI: hide #runSection (v6 .pmg-action-stack covers it) ===== */',
      'body.pmg-t15-applied #runSection { display: none !important; }',
      '',
      '/* ===== T15.11 "Or See Real Examples" sub-line — handled in JS ===== */'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function strengthenGoalLabel() {
    try {
      var label = document.querySelector('label[for="goal"]');
      if (!label) return;
      if (document.body && document.body.classList.contains('image-mode')) return;
      var t = (label.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === 'What Do You Want AI To Help You With?') return;
      if (/^Your Goal$/i.test(t)) {
        label.textContent = 'What Do You Want AI To Help You With?';
      }
    } catch (e) { /* swallow */ }
  }

  function isInModalOrHidden(el) {
    if (!el) return true;
    if (el.hasAttribute('hidden')) return true;
    if (el.closest('[role="dialog"], .modal, [aria-modal="true"], [hidden]')) return true;
    var s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return true;
    return false;
  }

  function isHelpMeStartLabel(t) {
    if (!t) return false;
    var stripped = t.replace(/[^A-Za-z]/g, '');
    return /^HelpMeStart$/i.test(stripped);
  }

  function consolidateHelpMeStart() {
    try {
      /* Only act if the canonical keeper #guided-mode-btn exists AND is visible.
       * Otherwise leave dups visible so users still have an entry point.
       * Visibility check guards against pre-existing v3 CSS hide of #guided-cta-row. */
      var canonical = document.getElementById('guided-mode-btn');
      if (!canonical) return;
      if (canonical.offsetParent === null && getComputedStyle(canonical).position !== 'fixed') return;
      document.body.classList.add('pmg-t15-help-ok');
      var ctaRow = document.getElementById('guided-cta-row');
      if (ctaRow) {
        var hasButton = !!ctaRow.querySelector('button:not(.pmg-t15-hide-dup), a.btn:not(.pmg-t15-hide-dup)');
        if (!hasButton) ctaRow.classList.add('pmg-t15-hide-dup');
      }
      var seen = [];
      var btns = document.querySelectorAll('button, a.btn');
      Array.prototype.forEach.call(btns, function (b) {
        if (b.classList.contains('pmg-t15-hide-dup')) return;
        var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (!isHelpMeStartLabel(t)) return;
        if (b.closest('[role="dialog"], .modal, [aria-modal="true"]')) return;
        if (b.id === 'guided-mode-title') return;
        seen.push(b);
      });
      if (seen.length <= 1) return;
      var keeper = null;
      for (var i = 0; i < seen.length; i++) {
        if (seen[i].id === 'guided-mode-btn') { keeper = seen[i]; break; }
      }
      if (!keeper) keeper = seen[0];
      seen.forEach(function (b) {
        if (b !== keeper) b.classList.add('pmg-t15-hide-dup');
      });
      var helper = document.getElementById('pmg-help-me-start-helper');
      if (helper) {
        if (keeper && keeper.id === 'guided-mode-btn') {
          helper.classList.remove('pmg-t15-hide-dup');
        } else {
          helper.classList.add('pmg-t15-hide-dup');
        }
      }
    } catch (e) { /* swallow */ }
  }

  function consolidateExpertMode() {
    try {
      /* Only act if the canonical keeper #pmg-expert-toggle-btn exists AND is visible.
       * Otherwise, leave fallback entries untouched so users still have an Expert Mode entry point. */
      var keeper = document.getElementById('pmg-expert-toggle-btn');
      if (!keeper) return;
      if (keeper.offsetParent === null && getComputedStyle(keeper).position !== 'fixed') return;
      document.body.classList.add('pmg-t15-expert-ok');
      var seen = [];
      var nodes = document.querySelectorAll('button, a, label.expert-mode-toggle, .expert-mode-link, [data-toggle="expert-mode"]');
      Array.prototype.forEach.call(nodes, function (b) {
        if (b === keeper || keeper.contains(b) || b.contains(keeper)) return;
        if (b.classList.contains('pmg-t15-hide-dup')) return;
        var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/Expert Mode/i.test(t)) return;
        if (b.id === 'expert-warning-confirm' || b.id === 'expert-warning-title') return;
        if (b.closest('[role="dialog"], .modal, [aria-modal="true"]')) return;
        if (b.closest('#expert-warning-modal')) return;
        if (b.closest('.expert-mode-badge')) return;
        seen.push(b);
      });
      seen.forEach(function (b) {
        b.classList.add('pmg-t15-hide-dup');
        var row = b.closest('.expert-mode-link-row');
        if (row && !row.contains(keeper)) row.classList.add('pmg-t15-hide-dup');
      });
      var hint = document.getElementById('builder-expert-hint');
      if (hint) hint.classList.add('pmg-t15-hide-dup');
    } catch (e) { /* swallow */ }
  }

  function demoteRunWithAi() {
    try {
      var seen = [];
      var btns = document.querySelectorAll('button, a.btn');
      Array.prototype.forEach.call(btns, function (b) {
        if (b.classList.contains('pmg-t15-hide-dup')) return;
        var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/Run With AI/i.test(t)) return;
        if (/Run Again/i.test(t)) return;
        if (b.closest('[role="dialog"], .modal, [aria-modal="true"]')) return;
        var s = window.getComputedStyle(b);
        if (s.display === 'none') return;
        seen.push(b);
      });
      if (seen.length <= 1) return;
      var keeper = null;
      for (var i = 0; i < seen.length; i++) {
        if (seen[i].closest('.pmg-action-stack, .pmg-what-next-block')) { keeper = seen[i]; break; }
      }
      if (!keeper) keeper = seen[0];
      seen.forEach(function (b) {
        if (b === keeper) return;
        var section = b.closest('#runSection');
        if (section) section.classList.add('pmg-t15-hide-dup');
        else b.classList.add('pmg-t15-hide-dup');
      });
    } catch (e) { /* swallow */ }
  }

  function fixRealExamplesCta() {
    var cta = document.getElementById('hero-usecases-cta');
    if (!cta) return;
    var spans = cta.querySelectorAll('span');
    Array.prototype.forEach.call(spans, function (s) {
      var t = (s.textContent || '').trim();
      if (/^Real Examples,?\s*Real Results$/i.test(t)) {
        s.textContent = 'See How It Works';
      }
    });
  }

  function moveNeedIdeasUnderCarousel() {
    var btn = document.getElementById('usecases-dice-btn');
    var section = document.getElementById('use-cases');
    if (!btn || !section) return;
    if (btn.dataset.pmgT15Moved === '1') return;
    var grid = section.querySelector('.popular-uses-grid');
    if (!grid || !grid.parentNode) return;
    var wrap = document.createElement('div');
    wrap.className = 'pmg-need-ideas-wrap';
    grid.parentNode.insertBefore(wrap, grid.nextSibling);
    wrap.appendChild(btn);
    btn.dataset.pmgT15Moved = '1';
    var headRow = section.querySelector('.popular-uses-head-row');
    if (headRow && headRow.parentNode) {
      var heading = headRow.querySelector('h2');
      if (heading) {
        headRow.parentNode.insertBefore(heading, headRow);
        if (!headRow.querySelector('button, a')) headRow.classList.add('pmg-t15-hide-dup');
      }
    }
  }

  function surfaceImageResultPanel() {
    var section = document.getElementById('imageResultSection');
    var dl = document.getElementById('imageDownloadBtn');
    if (!section) return;
    if (section.hasAttribute('hidden')) section.removeAttribute('hidden');
    if (dl && (dl.style.display === 'none' || !dl.getAttribute('href') || dl.getAttribute('href').length < 4)) {
      dl.classList.add('pmg-t15-hint');
      dl.setAttribute('aria-disabled', 'true');
      dl.title = 'Download will become available after your image is generated.';
      if (!section.querySelector('.pmg-t15-image-hint')) {
        var hint = document.createElement('p');
        hint.className = 'pmg-t15-image-hint';
        hint.textContent = 'Download Will Activate Once Your Image Is Ready.';
        var actions = section.querySelector('.image-result-actions');
        if (actions && actions.parentNode) {
          actions.parentNode.insertBefore(hint, actions.nextSibling);
        }
      }
    }
  }

  function unhintImageDownloadBtn() {
    var dl = document.getElementById('imageDownloadBtn');
    if (!dl) return;
    if (!dl.classList.contains('pmg-t15-hint')) return;
    var href = dl.getAttribute('href');
    if (!href) return;
    var trimmed = href.replace(/^\s+|\s+$/g, '');
    if (trimmed.length < 4 || trimmed === '#') return;
    /* Accept any usable URL: http(s):, blob:, data:, root-relative, or relative path. */
    var isUsable = /^(https?:|blob:|data:|\/|\.{0,2}\/|[^#?\s])/i.test(trimmed) && trimmed.charAt(0) !== '#';
    if (!isUsable) return;
    dl.classList.remove('pmg-t15-hint');
    dl.removeAttribute('aria-disabled');
    dl.style.display = 'inline-flex';
    var hint = document.querySelector('.pmg-t15-image-hint');
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
  }

  function collapsePhotoCategories() {
    var accordion = document.getElementById('pmg-photo-assistant');
    if (!accordion) return false;
    var qs = accordion.querySelectorAll('.pmg-photo-q');
    if (!qs.length) return false;
    if (accordion.dataset.pmgT15Collapsed === '1') return true;
    Array.prototype.forEach.call(qs, function (q, i) {
      var label = q.querySelector('.pmg-photo-q-label');
      if (!label) return;
      var labelText = (label.textContent || '').trim();
      var body = document.createElement('div');
      body.className = 'pmg-photo-q-body';
      var node = label.nextSibling;
      while (node) {
        var nxt = node.nextSibling;
        body.appendChild(node);
        node = nxt;
      }
      q.appendChild(body);
      var header = document.createElement('button');
      header.type = 'button';
      header.className = 'pmg-photo-q-header';
      header.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
      var headerText = document.createElement('span');
      headerText.className = 'pmg-photo-q-header-text';
      var labelSpan = document.createElement('span');
      labelSpan.textContent = labelText;
      var summary = document.createElement('span');
      summary.className = 'pmg-photo-q-summary';
      headerText.appendChild(labelSpan);
      headerText.appendChild(summary);
      var chevron = document.createElement('span');
      chevron.className = 'pmg-photo-q-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '\u02C5';
      header.appendChild(headerText);
      header.appendChild(chevron);
      q.replaceChild(header, label);
      if (i !== 0) q.classList.add('pmg-cat-collapsed');
      header.addEventListener('click', function () {
        var collapsed = q.classList.toggle('pmg-cat-collapsed');
        header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
      var updateSummary = function () {
        var pressed = body.querySelector('.pmg-photo-pill[aria-pressed="true"]');
        var input = body.querySelector('.pmg-photo-q-input');
        if (pressed) {
          var pt = (pressed.textContent || '').trim();
          summary.textContent = '\u2014 ' + (pt.length > 32 ? pt.slice(0, 30) + '\u2026' : pt);
        } else if (input && input.value && input.value.trim()) {
          var v = input.value.trim();
          summary.textContent = '\u2014 ' + (v.length > 32 ? v.slice(0, 30) + '\u2026' : v);
        } else {
          summary.textContent = '';
        }
      };
      body.addEventListener('click', function (ev) {
        if (ev.target && ev.target.classList && ev.target.classList.contains('pmg-photo-pill')) {
          setTimeout(updateSummary, 0);
        }
      });
      var inputEl = body.querySelector('.pmg-photo-q-input');
      if (inputEl) inputEl.addEventListener('input', updateSummary);
    });
    accordion.dataset.pmgT15Collapsed = '1';
    return true;
  }

  function watchImageDownload() {
    var dl = document.getElementById('imageDownloadBtn');
    if (!dl) return;
    var mo = new MutationObserver(unhintImageDownloadBtn);
    mo.observe(dl, { attributes: true, attributeFilter: ['href', 'style'] });
  }

  function runConsolidationPass() {
    strengthenGoalLabel();
    consolidateHelpMeStart();
    consolidateExpertMode();
    demoteRunWithAi();
  }

  function watchGoalLabel() {
    var label = document.querySelector('label[for="goal"]');
    if (!label) return;
    var mo = new MutationObserver(function () { strengthenGoalLabel(); });
    mo.observe(label, { childList: true, characterData: true, subtree: true });
    var write = document.getElementById('writeModeBtn');
    if (write) write.addEventListener('click', function () { setTimeout(strengthenGoalLabel, 50); });
  }

  function init() {
    injectStyles();
    document.body.classList.add('pmg-t15-applied');
    strengthenGoalLabel();
    watchGoalLabel();
    fixRealExamplesCta();
    moveNeedIdeasUnderCarousel();
    surfaceImageResultPanel();
    watchImageDownload();
    runConsolidationPass();
    /* Re-run consolidation a few times to catch late JS-injected dups (v6 setupHelpMeStartButton, addExpertModeRow, rebuildPostGenStack, etc.) */
    [200, 600, 1500, 3000].forEach(function (delay) {
      setTimeout(runConsolidationPass, delay);
    });
    if (!collapsePhotoCategories()) {
      var mo = new MutationObserver(function () {
        if (collapsePhotoCategories()) mo.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 10000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ================================================================
 * T16 — "Recommended For Best Results" pill above Help Me Start
 * ----------------------------------------------------------------
 * Adds a small accent-aware "⭐ Recommended For Best Results" pill
 * directly above the Help Me Start button so users who don't know
 * what to type are nudged toward the guided 4-question flow.
 *
 * Restraint by design:
 *  - Pill, not a banner — does NOT compete with Fix My Prompt for
 *    primary CTA visual weight.
 *  - Soft amber/gold styling that reads as "editor's pick" without
 *    fighting any of the 5 accent themes (green, blue, purple, gold,
 *    slate).
 *  - Hidden when Help Me Start itself is hidden (image mode, expert
 *    mode) via existing body classes.
 *  - Idempotent: never inserts more than once per page lifetime.
 * ================================================================ */
(function pmgT16RecommendedPill() {
  if (window.__pmgT16Init) return;
  window.__pmgT16Init = true;

  var PILL_ID = 'pmg-help-me-start-recommend';
  var ROW_ID = 'pmg-help-me-start-recommend-row';
  var STYLE_ID = 'pmg-t16-recommend-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* T16-scoped CSS variables — single source of truth for the pill palette.
         Amber/gold is intentionally accent-agnostic so the "Editor's Pick"
         affordance reads consistently across all 5 accent themes. */
      ':root {',
      '  --pmg-t16-amber: #f59e0b;',
      '  --pmg-t16-amber-bg-from: #fef3c7;',
      '  --pmg-t16-amber-bg-to: #fde68a;',
      '  --pmg-t16-amber-text: #78350f;',
      '  --pmg-t16-amber-text-dark: #fcd34d;',
      '}',
      /* Wrapper row forces the pill onto its own line above the Help Me Start
         button (instead of rendering side-by-side in the parent flex row).
         flex-basis:100% + width:100% breaks to a new line in flex-wrap parents
         and acts as a normal block in non-flex parents. */
      '#' + ROW_ID + ' {',
      '  display: flex;',
      '  align-items: center; justify-content: center;',
      '  width: 100%;',
      '  flex-basis: 100%;',
      '  margin: 4px 0 0;',
      '  padding: 0;',
      '}',
      '#' + ROW_ID + '.pmg-t16-hidden { display: none !important; }',
      '#' + PILL_ID + ' {',
      /* Match the small Help Me Start button width — NOT the wide
         green button. JS sets explicit width via syncWidth() to exactly
         the button's measured width. */
      '  display: inline-flex; align-items: center; justify-content: center; gap: 6px;',
      '  margin: 0; padding: 5px 12px;',
      '  background: linear-gradient(135deg, var(--pmg-t16-amber-bg-from) 0%, var(--pmg-t16-amber-bg-to) 100%);',
      '  border: 1px solid var(--pmg-t16-amber);',
      '  border-radius: 999px;',
      '  color: var(--pmg-t16-amber-text);',
      '  font-size: 12px; font-weight: 700;',
      '  letter-spacing: 0.02em;',
      '  line-height: 1.2;',
      '  box-sizing: border-box;',
      '  width: auto;',
      '  flex-basis: auto;',
      '  flex-grow: 0; flex-shrink: 0;',
      '  align-self: flex-start;',
      '  box-shadow: 0 1px 3px color-mix(in srgb, var(--pmg-t16-amber) 18%, transparent);',
      '  user-select: none;',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + PILL_ID + ' .pmg-t16-star {',
      '  font-size: 13px; line-height: 1; transform: translateY(-0.5px);',
      '}',
      '[data-theme="dark"] #' + PILL_ID + ' {',
      '  background: linear-gradient(135deg, color-mix(in srgb, var(--pmg-t16-amber) 18%, transparent) 0%, color-mix(in srgb, var(--pmg-t16-amber) 28%, transparent) 100%);',
      '  border-color: color-mix(in srgb, var(--pmg-t16-amber) 60%, transparent);',
      '  color: var(--pmg-t16-amber-text-dark);',
      '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);',
      '}',
      '/* Defensive CSS guard — JS visibility sync below is the source of truth */',
      'body.image-mode #' + PILL_ID + ',',
      'body.is-expert-mode #' + PILL_ID + ',',
      'body.pmg-expert-mode #' + PILL_ID + ',',
      '#' + PILL_ID + '.pmg-t16-hidden { display: none !important; }',
      '@media (max-width: 600px) {',
      '  #' + PILL_ID + ' { font-size: 11px; padding: 4px 10px; margin-top: 12px; }',
      '  #' + PILL_ID + ' .pmg-t16-star { font-size: 12px; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildPill() {
    var pill = document.createElement('div');
    pill.id = PILL_ID;
    pill.setAttribute('role', 'note');
    pill.setAttribute('aria-label', 'Recommended for best results');
    var star = document.createElement('span');
    star.className = 'pmg-t16-star';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '⭐';
    var text = document.createElement('span');
    /* Short label so it fits inside the small Help Me Start button width
       without being truncated by ellipsis. */
    text.textContent = 'Recommended';
    pill.appendChild(star);
    pill.appendChild(text);
    return pill;
  }

  function insertPill() {
    if (document.getElementById(PILL_ID)) return true;
    var help = document.getElementById('guided-mode-btn');
    if (!help || !help.parentNode) return false;
    /* Only insert once Help Me Start has been relocated next to Fix My Prompt
       by T15's reorderHelpMeStart(); otherwise the pill could appear in the
       old orphaned .guided-cta-row wrapper. Heuristic: the relocated button
       is a direct sibling of #generateBtn or sits outside #guided-cta-row. */
    var oldRow = help.closest('#guided-cta-row');
    var generate = document.getElementById('generateBtn');
    var relocated = !oldRow || (generate && generate.nextElementSibling === help);
    if (!relocated) return false;
    var pill = buildPill();
    /* Wrap pill in a full-width row so it stacks BELOW the Help Me Start
       button as a caption — text under its respective button. */
    var row = document.createElement('div');
    row.id = ROW_ID;
    row.appendChild(pill);
    if (help.nextSibling) {
      help.parentNode.insertBefore(row, help.nextSibling);
    } else {
      help.parentNode.appendChild(row);
    }
    return true;
  }

  function tryInsert() {
    injectStyles();
    return insertPill();
  }

  /* Sync pill WIDTH to exactly match the Help Me Start button width.
     The pill should look like a label *for* that small button, not a
     full-width banner. Re-runs on resize and on visibility sync. */
  function syncWidth() {
    var pill = document.getElementById(PILL_ID);
    var help = document.getElementById('guided-mode-btn');
    if (!pill || !help) return;
    var w = help.getBoundingClientRect().width;
    if (w > 0) pill.style.width = Math.round(w) + 'px';
  }

  /* Sync pill visibility to mirror the Help Me Start button.
     If Help Me Start is hidden (image mode, expert mode, parent collapsed,
     etc.), hide the pill too. Bulletproof against any future changes to
     how the help button visibility is toggled. */
  function syncVisibility() {
    var pill = document.getElementById(PILL_ID);
    var help = document.getElementById('guided-mode-btn');
    if (!pill || !help) return;
    var hidden = false;
    /* offsetParent is null when element or any ancestor has display:none */
    if (help.offsetParent === null && getComputedStyle(help).position !== 'fixed') {
      hidden = true;
    } else if (getComputedStyle(help).visibility === 'hidden') {
      hidden = true;
    } else if (document.body.classList.contains('image-mode') ||
               document.body.classList.contains('is-expert-mode') ||
               document.body.classList.contains('pmg-expert-mode')) {
      /* In image or expert modes, the guided 4-question flow doesn't apply */
      hidden = true;
    } else {
      /* Direct check on mode toggle button's active state — most reliable */
      var imgBtn = document.getElementById('imageModeBtn');
      if (imgBtn && imgBtn.classList.contains('active')) {
        hidden = true;
      }
    }
    pill.classList.toggle('pmg-t16-hidden', hidden);
    /* Hide the wrapper row too so it doesn't reserve a blank line. */
    var row = document.getElementById(ROW_ID);
    if (row) row.classList.toggle('pmg-t16-hidden', hidden);
  }

  function startVisibilitySync() {
    syncWidth();
    syncVisibility();
    /* Re-measure pill width whenever the window resizes (mobile layout
       breakpoints can change the help button width). */
    window.addEventListener('resize', function () {
      setTimeout(syncWidth, 0);
    });
    /* Re-sync on body class/style changes (mode switch toggles body.image-mode
       and toggles 'active' class on mode buttons). No subtree observer — too
       broad. Targeted body observer + click delegation covers all known
       triggers without background churn. */
    var moBody = new MutationObserver(syncVisibility);
    try {
      moBody.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    } catch (e) {}
    /* Direct binding to mode toggle buttons for guaranteed coverage */
    ['imageModeBtn', 'writeModeBtn', 'textModeBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', function () {
          setTimeout(syncVisibility, 30);
          setTimeout(syncVisibility, 200);
        });
      }
    });
    /* Catch-all capture-phase click delegation for late-bound mode toggles */
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('.mode-switch-btn, [data-mode], [onclick*="setMode"]');
      if (!t) return;
      setTimeout(syncVisibility, 30);
      setTimeout(syncVisibility, 200);
    }, true);
    /* Bounded fallback poll: 5Hz for the first 6 seconds after init. After
       that, the body observer + click delegation are the source of truth. */
    var ticks = 0;
    var iv = setInterval(function () {
      syncWidth();
      syncVisibility();
      if (++ticks > 30) clearInterval(iv);
    }, 200);
  }

  function init() {
    var inserted = tryInsert();
    if (inserted) {
      startVisibilitySync();
      return;
    }
    /* Observe DOM until T15 relocation has happened, then insert + sync. */
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (tryInsert()) {
        clearInterval(iv);
        startVisibilitySync();
      } else if (attempts > 30) {
        clearInterval(iv);
      }
    }, 250);
    var mo = new MutationObserver(function () {
      if (tryInsert()) {
        try { mo.disconnect(); } catch (e) {}
        clearInterval(iv);
        startVisibilitySync();
      }
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T17 — Mobile UX fixes for the Help Me Start dialog + softer hero CTA
 *
 * Problems addressed (from real-user mobile feedback):
 *   1. The guided dialog showed ALL 4 questions stacked at once because
 *      author CSS `.guided-step { display: flex }` overrode the `[hidden]`
 *      attribute set by the wizard's renderStep(). That pushed the Next
 *      button below the fold and made the dialog feel huge.
 *   2. Users tapped each visible field, then expected Next to read
 *      "Done" — but the wizard JS still tracked step 1, so they had to
 *      press Next 4 times anyway. Side-effect of #1.
 *   3. The hero secondary CTA "Or See Real Examples" had a hard 2px solid
 *      accent border. In gold/amber accent themes it read as a gold
 *      button that clashed with the primary CTA. User asked for a subtle
 *      pulsing glow instead.
 *
 * Approach (hard rules: no rename of IDs/classes/JS, CSS vars, no flex
 * order:N, hide/move/collapse over delete, anchors preserved):
 *   - T17.1: Defensive CSS to honor [hidden] on .guided-step.
 *   - T17.2: Inject step-progress dots at the top of the dialog so users
 *     see "this is multi-step" before they start typing. Synced via
 *     MutationObserver on the [hidden] attribute of each step div.
 *   - T17.3: Replace the solid border on #hero-usecases-cta with a soft
 *     1px tinted border + pulsing accent-color glow. Honors
 *     prefers-reduced-motion.
 * ===================================================================== */
(function pmgT17GuidedAndGlow() {
  'use strict';
  if (window.__pmgT17Init) return;
  window.__pmgT17Init = true;

  var STYLE_ID = 'pmg-t17-guided-glow-style';
  var DOTS_CLASS = 'pmg-t17-progress-dots';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ':root {',
      '  --pmg-t17-glow-soft: color-mix(in srgb, var(--color-primary) 10%, transparent);',
      '  --pmg-t17-glow-mid:  color-mix(in srgb, var(--color-primary) 16%, transparent);',
      '  --pmg-t17-glow-ring: color-mix(in srgb, var(--color-primary) 14%, transparent);',
      '  --pmg-t17-border-soft: color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '  --pmg-t17-border-hover: color-mix(in srgb, var(--color-primary) 36%, transparent);',
      '  --pmg-t17-dot-idle: color-mix(in srgb, var(--color-text) 14%, transparent);',
      '  --pmg-t17-dot-done: color-mix(in srgb, var(--color-primary) 55%, transparent);',
      '}',

      /* T17.1 — Honor [hidden] on guided-step so the wizard\'s renderStep
         "show one step at a time" actually takes visual effect. */
      '.guided-step[hidden] { display: none !important; }',

      /* T17.2 — Step progress dots at top of dialog */
      '.' + DOTS_CLASS + ' { display: flex; justify-content: center; align-items: center; gap: 8px; margin: 4px 0 2px; }',
      '.' + DOTS_CLASS + ' .pmg-t17-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pmg-t17-dot-idle); transition: background 220ms ease, transform 220ms ease; }',
      '.' + DOTS_CLASS + ' .pmg-t17-dot.is-done { background: var(--pmg-t17-dot-done); }',
      '.' + DOTS_CLASS + ' .pmg-t17-dot.is-current { background: var(--color-primary); transform: scale(1.35); }',

      /* T17.3 — Subtle pulsing glow on the hero secondary CTA */
      '#hero-usecases-cta {',
      '  border: 1px solid var(--pmg-t17-border-soft) !important;',
      '  box-shadow: 0 0 0 0 var(--pmg-t17-glow-soft), 0 6px 18px var(--pmg-t17-glow-soft) !important;',
      '  animation: pmgT17Glow 3.2s ease-in-out infinite;',
      '}',
      '#hero-usecases-cta:hover, #hero-usecases-cta:focus-visible {',
      '  animation: none;',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)) !important;',
      '  border-color: var(--pmg-t17-border-hover) !important;',
      '  box-shadow: 0 0 0 5px var(--pmg-t17-glow-ring), 0 8px 22px var(--pmg-t17-glow-mid) !important;',
      '}',
      '@keyframes pmgT17Glow {',
      '  0%, 100% { box-shadow: 0 0 0 0 var(--pmg-t17-glow-soft), 0 4px 14px var(--pmg-t17-glow-soft); }',
      '  50%      { box-shadow: 0 0 0 6px var(--pmg-t17-glow-ring), 0 8px 22px var(--pmg-t17-glow-mid); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #hero-usecases-cta { animation: none !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureProgressDots() {
    var dialog = document.getElementById('guided-mode-dialog');
    if (!dialog) return null;
    var form = dialog.querySelector('#guided-mode-form');
    if (!form) return null;
    var existing = form.querySelector('.' + DOTS_CLASS);
    if (existing) return existing;
    var steps = form.querySelectorAll('[data-guided-step]');
    var total = steps.length || 4;
    var dots = document.createElement('div');
    dots.className = DOTS_CLASS;
    dots.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < total; i++) {
      var d = document.createElement('span');
      d.className = 'pmg-t17-dot';
      dots.appendChild(d);
    }
    var head = form.querySelector('.guided-head');
    if (head && head.parentNode === form) {
      form.insertBefore(dots, head.nextSibling);
    } else {
      form.insertBefore(dots, form.firstChild);
    }
    return dots;
  }

  function syncProgressDots() {
    var dialog = document.getElementById('guided-mode-dialog');
    if (!dialog) return;
    var dots = ensureProgressDots();
    if (!dots) return;
    var steps = dialog.querySelectorAll('[data-guided-step]');
    var visibleIdx = -1;
    for (var i = 0; i < steps.length; i++) {
      if (!steps[i].hidden) {
        visibleIdx = parseInt(steps[i].getAttribute('data-guided-step'), 10);
        if (isNaN(visibleIdx)) visibleIdx = i;
        break;
      }
    }
    if (visibleIdx < 0) visibleIdx = 0;
    var dotEls = dots.children;
    for (var j = 0; j < dotEls.length; j++) {
      dotEls[j].classList.remove('is-current', 'is-done');
      if (j < visibleIdx) dotEls[j].classList.add('is-done');
      else if (j === visibleIdx) dotEls[j].classList.add('is-current');
    }
  }

  function watchDialog() {
    var dialog = document.getElementById('guided-mode-dialog');
    if (!dialog) return;
    /* Per-element idempotency: if we already wired this dialog (possible
       if init runs again via the late-mount observer), bail out. */
    if (dialog.__pmgT17Watched) return;
    dialog.__pmgT17Watched = true;

    var openBtn = document.getElementById('guided-mode-btn');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        setTimeout(syncProgressDots, 30);
        setTimeout(syncProgressDots, 200);
      });
    }

    dialog.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('#guided-next, #guided-back');
      if (!t) return;
      setTimeout(syncProgressDots, 30);
      setTimeout(syncProgressDots, 200);
    });

    /* Authoritative signal: each step div\'s [hidden] attribute is
       toggled by renderStep() in index.html. Observing those is the
       most reliable trigger for advancing the dots. */
    var steps = dialog.querySelectorAll('[data-guided-step]');
    if (steps.length) {
      var mo = new MutationObserver(syncProgressDots);
      steps.forEach(function (s) {
        try { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); } catch (e) {}
      });
    }

    syncProgressDots();
  }

  function initT17() {
    injectStyles();
    ensureProgressDots();
    watchDialog();

    if (!document.getElementById('guided-mode-dialog')) {
      var mo = new MutationObserver(function () {
        if (document.getElementById('guided-mode-dialog')) {
          ensureProgressDots();
          watchDialog();
          try { mo.disconnect(); } catch (e) {}
        }
      });
      try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 12000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initT17);
  } else {
    initT17();
  }
})();
