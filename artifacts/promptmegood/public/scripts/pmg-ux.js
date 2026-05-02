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
 * T26 — Performance guard: throttle MutationObservers via rAF and
 *        auto-disconnect runaway observers.
 *
 * The 12 stacked UX phases (T14 through T25) install ~30 MutationObservers,
 * 17 of which watch document.body with subtree:true. On the large home
 * page this combination was overwhelming browsers — especially on mobile
 * — to the point of crashing the renderer.
 *
 * This guard is the very first code in pmg-ux.js. It patches the global
 * MutationObserver constructor so that for every observer created from
 * this point on:
 *   1. Callbacks fire at most once per animation frame; multiple browser
 *      mutation batches inside the same frame are coalesced into a
 *      single user-callback invocation. Correctness is preserved (every
 *      record is delivered, in order) while CPU thrash is eliminated.
 *   2. Observers that exceed a runaway threshold (>5000 records in a
 *      rolling 1-second window) auto-disconnect, so a feedback loop
 *      between two phases can never freeze the page.
 *
 * Notes:
 *   - The Microsoft Clarity bootstrap script in <head> may install its
 *     own observers before pmg-ux.js executes (since pmg-ux.js is now
 *     deferred). That is fine: the patch only affects observers created
 *     AFTER this IIFE runs (i.e., every observer inside pmg-ux.js).
 *   - No public API changes: every observer instance returned is a real
 *     native MutationObserver — `.observe`, `.disconnect`, and
 *     `.takeRecords` all work as before.
 *   - Idempotent via __pmgT26ObserverGuard guard so accidental double
 *     loads don't double-wrap.
 * ==================================================================== */
(function pmgT26ObserverGuard() {
  if (window.__pmgT26ObserverGuard) return;
  window.__pmgT26ObserverGuard = true;
  if (typeof MutationObserver === 'undefined') return;

  var Original = window.MutationObserver;
  var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
  var WINDOW_MS = 1000;
  var RUNAWAY_RECORDS = 5000;

  function ThrottledObserver(callback) {
    /* Mirror native behaviour: a non-function arg throws a TypeError
       from the underlying constructor. */
    if (typeof callback !== 'function') {
      return new Original(callback);
    }

    var queued = [];
    var scheduled = false;
    var disabled = false;
    var windowStart = 0;
    var windowCount = 0;
    var instance;

    function flush() {
      scheduled = false;
      if (disabled || !queued.length) { queued.length = 0; return; }
      var batch = queued;
      queued = [];

      var now = Date.now();
      if (now - windowStart > WINDOW_MS) {
        windowStart = now;
        windowCount = 0;
      }
      windowCount += batch.length;
      if (windowCount > RUNAWAY_RECORDS) {
        disabled = true;
        try { nativeDisconnect.call(instance); } catch (e) {}
        try {
          if (window.console && console.warn) {
            console.warn('[pmg-ux] runaway MutationObserver auto-disconnected (>' + RUNAWAY_RECORDS + ' records/s)');
          }
        } catch (e2) {}
        return;
      }

      try {
        /* Bind `this` to the observer instance so user callbacks that
           reference `this` behave the same as with a native observer. */
        callback.call(instance, batch, instance);
      } catch (e3) {
        try { if (window.console && console.error) console.error('[pmg-ux] observer callback threw', e3); } catch (e4) {}
      }
    }

    instance = new Original(function (records) {
      if (disabled) return;
      for (var i = 0; i < records.length; i++) queued.push(records[i]);
      if (!scheduled) {
        scheduled = true;
        raf(flush);
      }
    });

    /* Preserve native disconnect() and takeRecords() semantics by
       wrapping them. After disconnect(), no further records are
       delivered and queued records are dropped (matching native
       behaviour). takeRecords() returns the union of records still
       queued in our coalescer plus anything still buffered in the
       underlying native observer. */
    var nativeDisconnect = instance.disconnect;
    var nativeTakeRecords = instance.takeRecords;
    instance.disconnect = function () {
      disabled = true;
      queued.length = 0;
      return nativeDisconnect.call(instance);
    };
    instance.takeRecords = function () {
      var out = queued;
      queued = [];
      var native = [];
      try { native = nativeTakeRecords.call(instance) || []; } catch (e) {}
      if (native.length) {
        for (var i = 0; i < native.length; i++) out.push(native[i]);
      }
      return out;
    };

    return instance;
  }

  /* Make instance prototype chain look native so any duck-typing checks
     downstream still pass. We don't replace the native prototype object;
     we just point our constructor at it. */
  ThrottledObserver.prototype = Original.prototype;
  try { Object.setPrototypeOf(ThrottledObserver, Original); } catch (e) {}

  try { window.MutationObserver = ThrottledObserver; } catch (e) {}
})();

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
        /* Task #41: render the shared .pmg-history-empty-card so this
           dropdown matches the saved prompt vault and the prompt
           builder result panel. Falls back to the legacy plain-text
           bar if pmg-history-states.js has not loaded yet. */
        var rawQuery = (input.value || '').trim();
        var noMatchText = rawQuery
          ? 'No saves, templates, or tags match "' + rawQuery + '". Try a shorter or different keyword.'
          : 'No matches yet — try a different keyword.';
        var emptyHtml = (window.__pmgHistoryStates && window.__pmgHistoryStates.emptyMarkup)
          ? window.__pmgHistoryStates.emptyMarkup({
              variant: 'no-matches',
              title: 'No Matches Found',
              text: noMatchText,
              extraClass: 'is-compact'
            })
          : '<div class="pmg-search-empty">No matches in your saved prompts or history yet. Generate a prompt and it will show up here.</div>';
        resultsEl.innerHTML = emptyHtml;
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
      if (builder && builder.scrollIntoView) builder.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' });
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
    /* Removed: this used to inject a secondary "Not Sure Where To
       Start? Let Us Help →" link AFTER the Fix My Prompt button. It
       caused friction — by the time the user reached it they had
       already scrolled past the goal textarea, the upload field, and
       the primary action row, and the link essentially asked them to
       start over from the beginning. The slim Help Me Start callout
       at the TOP of the column (T32 v2 in pmgT32SymmetricCallouts)
       already covers this need in the right place. We also clean up
       any link this function may have inserted in a previous session. */
    var stale = document.getElementById('pmg-help-me-start-link');
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
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
      if (ib) ib.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' });
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
    var targets = [];
    if (card) targets.push(card);
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
    var hiddenIds = ['why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    function maybeRevealForHash(hash) {
      if (!hash) return;
      var id = hash.replace(/^#/, '');
      if (hiddenIds.indexOf(id) === -1) return;
      revealAllBelowFold();
      var el = document.getElementById(id);
      if (el) {
        requestAnimationFrame(function () {
          try { el.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) { el.scrollIntoView(); }
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
        try { window.scrollTo({ top: 0, behavior: window.PMG_A11Y.scrollBehavior() }); } catch (e) { window.scrollTo(0, 0); }
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
        var clickable = t.closest('button, a[href], a.btn, [role="button"], .mode-switch-btn, .accent-swatch, .pmg-wn-card, summary, .pill, .badge');
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
    var ids = ['why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('pmg-marketing-section');
    });
  }

  /* ===== FIX 5: Add "No Signup. Free." sub-label under Fix My Prompt =====
   * T44: disabled. The "No Signup. Free." text was an orphan visual under the
   * Fix My Prompt button per the redesigned two-column workspace. The hero
   * proof bar already conveys "No Signup Needed". Also defensively remove the
   * element if a previous session injected it. */
  function addGenerateSubLabel() {
    var existing = document.getElementById('pmg-generate-sublabel');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
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
    if (meta) meta.textContent = 'Created With DALL·E 3 · Free tier: 1 image per day. Founding Member: unlimited.';
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
   * FIX 4: move Help Me Start (#guided-mode-btn) below Fix My Prompt
   *
   * T44: replaced. The new two-column workspace (T28+) already injects a
   * primary "Help Me Start" callout at the TOP of the Create A Text Prompt
   * column (#pmg-text-help-row → #pmg-text-help-row-btn), and that button
   * proxies to #guided-mode-btn for us. Stacking another Help Me Start
   * BELOW Fix My Prompt is a duplicate. We now hide the original
   * #guided-cta-row entirely and remove any helper paragraph this function
   * may have injected in a previous session.
   * =================================================================== */
  function reorderHelpMeStart() {
    if (!once('reorderHelpMeStart')) return;
    /* Remove any helper paragraph this function injected previously. */
    var helperLine = document.getElementById('pmg-help-me-start-helper');
    if (helperLine && helperLine.parentNode) helperLine.parentNode.removeChild(helperLine);

    /* Hide the original Help Me Start CTA row that lives above the form. */
    var ctaRow = document.getElementById('guided-cta-row');
    if (ctaRow) ctaRow.style.display = 'none';

    /* The original #guided-mode-btn is still wired and is still clicked
     * programmatically by the new top-of-column primary button. Keep it
     * in the DOM but visually hidden so it can't show up next to
     * Fix My Prompt as a duplicate CTA. */
    var help = document.getElementById('guided-mode-btn');
    if (help) {
      help.style.display = 'none';
      help.setAttribute('aria-hidden', 'true');
      help.setAttribute('tabindex', '-1');
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
            try { fi.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
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
        try { rp.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
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
      '.mode-switch-btn', '.pmg-photo-pill',
      '.suggestion-chip', '.pmg-pill',
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
      if (ig) { try { ig.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {} }
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
            try { section.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
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
      /* T15.10b — prefer the post-gen actions panel when present. */
      for (var i0 = 0; i0 < seen.length; i0++) {
        if (seen[i0].closest('.pmg-run-panel')) { keeper = seen[i0]; break; }
      }
      if (!keeper) for (var i = 0; i < seen.length; i++) {
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
      /* Wrapper row forces the pill onto its own line in the parent
         flex-wrap row, then keeps the pill left-aligned (matching the
         left-aligned Help Me Start button below it). The pill itself is
         narrow — JS syncWidth() pins its width to #guided-mode-btn. */
      '#' + ROW_ID + ' {',
      '  display: flex;',
      '  align-items: center;',
      /* Right-aligned: pill sits directly above Help Me Start (the right
         button in the demo|help pair). syncWidth() pins pill width to
         match the Help Me Start button so they align edge-to-edge. */
      '  justify-content: flex-end;',
      '  width: 100%;',
      '  flex-basis: 100%;',
      '  margin: 8px 0 -2px;',
      '  padding: 0;',
      '}',
      '#' + ROW_ID + '.pmg-t16-hidden { display: none !important; }',
      '#' + PILL_ID + ' {',
      /* Pill is narrow and matches the small Help Me Start button width
         (set explicitly by JS syncWidth()). inline-flex so it shrink-wraps
         its content by default until JS pins the width. */
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
      '  box-shadow: 0 1px 3px color-mix(in srgb, var(--pmg-t16-amber) 18%, transparent);',
      '  user-select: none;',
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
    text.textContent = 'Recommended For Best Results';
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
    /* Wrap pill in a full-width row so it stacks ABOVE the Help Me Start
       button on its own line, while pill itself stays narrow + left-aligned. */
    var row = document.createElement('div');
    row.id = ROW_ID;
    row.appendChild(pill);
    help.parentNode.insertBefore(row, help);
    return true;
  }

  function tryInsert() {
    injectStyles();
    return insertPill();
  }

  /* Pin pill width to the Help Me Start button width so they always
     match exactly. Re-runs on resize, on font load, and when the button
     mutates (e.g. text change). Uses ResizeObserver where available;
     falls back to a brief polling window. */
  function syncWidth() {
    var pill = document.getElementById(PILL_ID);
    var help = document.getElementById('guided-mode-btn');
    if (!pill || !help) return;
    var w = help.getBoundingClientRect().width;
    if (w > 0) {
      var px = Math.round(w) + 'px';
      if (pill.style.width !== px) pill.style.width = px;
    }
  }

  function startWidthSync() {
    syncWidth();
    var help = document.getElementById('guided-mode-btn');
    if (help && typeof ResizeObserver !== 'undefined') {
      try {
        var ro = new ResizeObserver(function () { syncWidth(); });
        ro.observe(help);
      } catch (e) {}
    }
    window.addEventListener('resize', syncWidth);
    /* Bounded polling fallback: 5Hz for 6 seconds to absorb late layout shifts
       (font load, theme switch reflow, etc.). After that, ResizeObserver and
       resize listeners are the source of truth. */
    var ticks = 0;
    var iv = setInterval(function () {
      syncWidth();
      if (++ticks > 30) clearInterval(iv);
    }, 200);
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
    syncVisibility();
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
      syncVisibility();
      if (++ticks > 30) clearInterval(iv);
    }, 200);
  }

  function init() {
    var inserted = tryInsert();
    if (inserted) {
      startVisibilitySync();
      startWidthSync();
      return;
    }
    /* Observe DOM until T15 relocation has happened, then insert + sync. */
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (tryInsert()) {
        clearInterval(iv);
        startVisibilitySync();
        startWidthSync();
      } else if (attempts > 30) {
        clearInterval(iv);
      }
    }, 250);
    var mo = new MutationObserver(function () {
      if (tryInsert()) {
        try { mo.disconnect(); } catch (e) {}
        clearInterval(iv);
        startVisibilitySync();
        startWidthSync();
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
 * T16c — Bring Use Demo Values up parallel with Help Me Start
 *
 * After T15 relocates #guided-mode-btn next to #generateBtn, and T16
 * inserts the right-aligned Recommended pill, this IIFE moves
 * .demo-stack (containing #fill-demo "Use Demo Values") to be a direct
 * sibling immediately BEFORE #guided-mode-btn — so they render parallel
 * (demo on left, help on right) in the .actions-row flex-wrap parent.
 *
 * Hard-rule compliant: hide/move (no deletion), no rename of any IDs/
 * classes, no flex order:N, anchors preserved, all logic centralized.
 * Idempotent — only moves once.
 * ===================================================================== */
(function pmgT16cParallelDemoButton() {
  if (window.__pmgT16cInit) return;
  window.__pmgT16cInit = true;

  var PAIR_ID = 'pmg-helpstart-pair-row';
  var STYLE_ID = 'pmg-t16c-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* The pair row is its own 2-column flex container. It always renders
         demo-stack and Help Me Start side-by-side, even when the parent
         .actions-row collapses to a 1-column grid at <=760px viewport
         (see index.html line ~2962). */
      '#' + PAIR_ID + ' {',
      '  display: flex;',
      '  flex-wrap: nowrap;',
      '  align-items: stretch;',
      '  gap: 10px;',
      '  width: 100%;',
      '  flex-basis: 100%;',
      '  margin: 0;',
      '  padding: 0;',
      '}',
      '#' + PAIR_ID + ' > .demo-stack {',
      '  flex: 1 1 0;',
      '  min-width: 0;',
      '  margin: 0;',
      '}',
      '#' + PAIR_ID + ' > #guided-mode-btn {',
      '  flex: 1 1 0;',
      '  min-width: 0;',
      '  margin: 0;',
      '}',
      /* Override the global mobile rule (.actions-row .btn { width:100% })
         that would otherwise force each button to fill the row and
         break the parallel layout at <=640px. flex:1 already gives them
         equal halves. */
      '#' + PAIR_ID + ' > .demo-stack > .btn,',
      '#' + PAIR_ID + ' > #guided-mode-btn {',
      '  width: 100% !important;',
      '  box-sizing: border-box;',
      '}',
      '#' + PAIR_ID + '.pmg-t16c-hidden { display: none !important; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function arrangePair() {
    var demo = document.querySelector('.demo-stack');
    var help = document.getElementById('guided-mode-btn');
    if (!demo || !help || !help.parentNode) return false;
    /* Only run after T15 has placed help in the same parent as generate. */
    var generate = document.getElementById('generateBtn');
    if (!generate || generate.parentNode !== help.parentNode) return false;

    injectStyles();

    /* (a) Pin the "No Signup. Free." sublabel directly after Fix My Prompt
       so it stays visually under the green button regardless of what other
       IIFEs insert later. */
    var sublabel = document.getElementById('pmg-generate-sublabel');
    if (sublabel && generate.nextElementSibling !== sublabel) {
      generate.parentNode.insertBefore(sublabel, generate.nextSibling);
    }

    /* (b) Build / reuse the pair wrapper. The wrapper itself takes one
       slot in the parent (one flex item OR one grid cell), but inside
       it forces demo|help to render parallel via inline flex. */
    var wrap = document.getElementById(PAIR_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = PAIR_ID;
      help.parentNode.insertBefore(wrap, help);
    } else if (wrap.parentNode !== help.parentNode) {
      help.parentNode.insertBefore(wrap, help);
    }

    /* (c) Move demo and help INTO the wrapper, demo first then help. */
    if (demo.parentNode !== wrap || wrap.firstElementChild !== demo) {
      wrap.insertBefore(demo, wrap.firstChild);
    }
    if (help.parentNode !== wrap || demo.nextElementSibling !== help) {
      wrap.insertBefore(help, demo.nextSibling);
    }

    /* (d) Re-anchor the T16 pill row so it sits ABOVE the pair wrapper.
       T16 inserts the pill row before #guided-mode-btn, which now lives
       inside the wrapper — that would put the pill INSIDE the pair.
       Lift it back out, just before the wrapper. */
    var pillRow = document.getElementById('pmg-help-me-start-recommend-row');
    if (pillRow && (pillRow.parentNode !== wrap.parentNode ||
                    pillRow.nextElementSibling !== wrap)) {
      wrap.parentNode.insertBefore(pillRow, wrap);
    }

    return true;
  }

  function init() {
    /* Run once now, then keep polling + observing for late-loaded DOM
       (T15 may relocate help button asynchronously after page render).
       Idempotent: arrangePair() is a no-op once the structure is set. */
    arrangePair();
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      arrangePair();
      if (attempts > 40) clearInterval(iv);
    }, 250);
    var mo = new MutationObserver(function () { arrangePair(); });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 15000);
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

      ''
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

/* =====================================================================
 * T18 — Symmetry pass for the Fix My Prompt action area.
 * 
 * Cleans up the "wandering" left-aligned captions inside the builder so
 * everything below Fix My Prompt sits centered on the column axis:
 *   - "No Signup. Free."        (.pmg-generate-sublabel)
 *   - The pill row              (#pmg-help-me-start-recommend-row keeps
 *                                its right-alignment so the pill stays
 *                                directly above Help Me Start)
 *   - "Answer 4 quick..."       (.pmg-help-me-start-helper)
 *   - "⚙ Expert Mode" + caption (.pmg-expert-mode-row)
 *
 * Style injection only — no DOM moves, no ID/class renames, no flex
 * order tricks. Idempotent via STYLE_ID guard.
 * ===================================================================== */
(function pmgT18Symmetry() {
  if (window.__pmgT18Init) return;
  window.__pmgT18Init = true;

  var STYLE_ID = 'pmg-t18-symmetry-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* "No Signup. Free." — center under the Fix My Prompt button. */
      '.pmg-generate-sublabel {',
      '  text-align: center !important;',
      '  width: 100%;',
      '  margin-left: 0 !important;',
      '  margin-right: 0 !important;',
      '}',
      /* "Answer 4 quick questions and we\'ll fill the form for you." */
      '.pmg-help-me-start-helper {',
      '  text-align: center !important;',
      '  width: 100%;',
      '  padding-left: 0 !important;',
      '  padding-right: 0 !important;',
      '}',
      /* Expert Mode row — pill + caption centered on the column. */
      '.pmg-expert-mode-row {',
      '  justify-content: center !important;',
      '  text-align: center !important;',
      '  width: 100%;',
      '}',
      '.pmg-expert-mode-row .pmg-expert-hint {',
      '  text-align: center;',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyles);
  } else {
    injectStyles();
  }
})();

/* =====================================================================
 * T19 — Print/Save PDF restyle + Fine-Tune textarea overflow fix.
 *
 * 1. The "Print / Save PDF" button (#print-btn) was a generic pill with
 *    no icon, looking unpolished next to the other CTAs. Adds a printer
 *    glyph, brand-tinted border, and a subtle hover lift — without
 *    renaming the ID/class or rebinding any handlers.
 *
 * 2. The Fine-Tune textarea (#fine-tune-input) showed the placeholder
 *    clipped on the bottom line ("...or simplify the" cut off). Raises
 *    min-height so the full multi-line placeholder is visible and pads
 *    the right side so the scrollbar never overlaps the text.
 *
 * Style + tiny DOM tweak only (icon glyph prepended once). Idempotent.
 * ===================================================================== */
(function pmgT19PrintAndFineTune() {
  if (window.__pmgT19Init) return;
  window.__pmgT19Init = true;

  var STYLE_ID = 'pmg-t19-print-finetune-style';
  var ICON_FLAG = 'pmgT19IconAdded';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ---- Print / Save PDF button: HIDDEN as a duplicate.
         T22 (PHASE B post-result polish) added a tiny printer icon next to
         the "Your Fixed Prompt" title (#pmg-result-print-icon) which is
         the canonical print affordance — it delegates clicks to #print-btn.
         The text "Print / Save PDF" pill in the actions row was therefore
         a duplicate placement (T22 tried to hide its parent row but the
         selector did not match). Hiding the pill directly leaves a single,
         compact, well-placed print entry point near the printable content
         while preserving #print-btn in the DOM so the icon click handler
         (printBtn.click()) and any other programmatic callers still work.
         Earlier T19 promoted this pill with a brand fill / pill radius /
         hover lift; those overrides are no longer relevant since the pill
         is hidden, but we keep the icon + flex layout below as a safety
         net in case display:none is ever overridden downstream. */
      '#print-btn { display: none !important; }',
      '#print-btn[data-pmg-show="1"] {',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  gap: 8px;',
      '}',
      '#print-btn .pmg-print-icon {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 14px;',
      '  height: 14px;',
      '  flex: 0 0 14px;',
      '  opacity: 0.85;',
      '}',
      '#print-btn .pmg-print-icon svg { width: 100%; height: 100%; display: block; }',

      /* ---- Fine-Tune textarea: full placeholder visible, no clipping ---- */
      '.fine-tune-row textarea#fine-tune-input {',
      '  min-height: 200px !important;',
      '  padding: var(--space-3) calc(var(--space-3) + 10px) var(--space-3) var(--space-3) !important;',
      '  font-size: var(--text-sm) !important;',
      '  line-height: 1.5 !important;',
      '  overflow-y: auto;',
      '  scrollbar-gutter: stable;',
      '  resize: vertical;',
      '  box-sizing: border-box;',
      '}',
      '.fine-tune-row textarea#fine-tune-input::placeholder {',
      '  white-space: pre-wrap;',
      '  line-height: 1.5;',
      '  font-size: var(--text-sm);',
      '  opacity: 0.85;',
      '}',
      '@media (max-width: 760px) {',
      '  .fine-tune-row textarea#fine-tune-input { min-height: 240px !important; font-size: 14px !important; }',
      '}',
      '@media (max-width: 480px) {',
      '  .fine-tune-row textarea#fine-tune-input { min-height: 280px !important; font-size: 13px !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* Prepend a printer SVG glyph inside #print-btn (once). Keeps the
     existing text node intact so any handlers reading textContent still
     see "Print / Save PDF". */
  function addPrintIcon() {
    var btn = document.getElementById('print-btn');
    if (!btn) return;
    if (btn.dataset[ICON_FLAG] === '1') return;
    if (btn.querySelector('.pmg-print-icon')) {
      btn.dataset[ICON_FLAG] = '1';
      return;
    }
    var icon = document.createElement('span');
    icon.className = 'pmg-print-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
      '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
      '<rect x="6" y="14" width="12" height="8"></rect>' +
      '</svg>';
    btn.insertBefore(icon, btn.firstChild);
    btn.dataset[ICON_FLAG] = '1';
  }

  function init() {
    injectStyles();
    addPrintIcon();
    /* Watch for late mounts (button is inside post-gen results section). */
    try {
      var mo = new MutationObserver(function () { addPrintIcon(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T20 — Single Copy Prompt + reorder around Check Prompt Quality.
 *
 * User asked to remove the duplicate white "Copy Prompt" pill (which lives
 * inside #pmg-copy-wrap) and to move the "What Would You Like To Do?" box
 * (#pmg-what-next-block) directly beneath the Check Prompt Quality button
 * (.quality-row), with the Print/Save PDF + Clear Prompt action row
 * sitting right beneath the box (same relative position to the box).
 *
 * Hides the dup via CSS so the underlying #copy-btn still exists for any
 * delegated handler (the box's "Copy Prompt" row programmatically clicks
 * #copy-btn). DOM moves are idempotent and only happen when all anchors
 * are present.
 * ===================================================================== */
(function pmgT20WhatNextRelocate() {
  if (window.__pmgT20Init) return;
  window.__pmgT20Init = true;

  var STYLE_ID = 'pmg-t20-relocate-style';
  var DONE_FLAG = 'pmgT20Placed';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Hide the duplicate "Copy Prompt" pill wrapper but keep #copy-btn
         in the DOM (other code clicks it programmatically). */
      '#pmg-copy-wrap { display: none !important; }',
      /* Visual breathing room around the relocated box. */
      '#pmg-what-next-block.pmg-t20-placed { margin-top: var(--space-3); }',
      '.actions-row.pmg-t20-tail { margin-top: var(--space-3); justify-content: flex-start; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* Find the original Print/Save PDF + Clear Prompt actions row.
     This is the .actions-row that contains #print-btn (the one inside
     #tour-final-actions in index.html). */
  function findPrintClearRow() {
    var printBtn = document.getElementById('print-btn');
    if (!printBtn) return null;
    var row = printBtn.closest('.actions-row');
    /* Defensive: do not pick up #pmg-copy-wrap if somehow it qualifies. */
    if (row && row.id === 'pmg-copy-wrap') return null;
    return row;
  }

  function relocate() {
    var qualityRow = document.getElementById('quality-row');
    var whatNext = document.getElementById('pmg-what-next-block');
    var tailRow = findPrintClearRow();
    if (!qualityRow || !whatNext || !tailRow) return false;

    var parent = qualityRow.parentNode;
    if (!parent) return false;

    /* If both already in the right slots, nothing to do. */
    if (
      qualityRow.nextSibling === whatNext &&
      whatNext.nextSibling === tailRow &&
      whatNext.dataset[DONE_FLAG] === '1'
    ) {
      return true;
    }

    try {
      /* Move the box directly after Check Prompt Quality. */
      if (whatNext.parentNode !== parent) {
        parent.appendChild(whatNext);
      }
      parent.insertBefore(whatNext, qualityRow.nextSibling);

      /* Move Print/Save PDF + Clear Prompt directly after the box. */
      if (tailRow.parentNode !== parent) {
        /* Adopt into the same parent so insertBefore works cleanly. */
        parent.appendChild(tailRow);
      }
      parent.insertBefore(tailRow, whatNext.nextSibling);

      whatNext.classList.add('pmg-t20-placed');
      whatNext.dataset[DONE_FLAG] = '1';
      tailRow.classList.add('pmg-t20-tail');
      return true;
    } catch (e) {
      return false;
    }
  }

  function init() {
    injectStyles();
    if (relocate()) return;
    /* Re-attempt as the post-gen DOM mounts. */
    var attempts = 0;
    var iv = setInterval(function () {
      attempts += 1;
      if (relocate() || attempts > 60) {
        clearInterval(iv);
      }
    }, 250);
    try {
      var mo = new MutationObserver(function () { relocate(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T21 — PHASE A: real-estate cleanup.
 *
 * Removes the high-noise, low-value elements the user identified as the
 * source of "paralysis by analysis", frees up the right column by killing
 * the marketing sidebar, and prepares the layout for the upcoming
 * 3-pipeline stack (Prompt Builder → Photography Suite → Image Generator).
 *
 * All changes are CSS hides (no DOM deletions, no ID/class renames),
 * idempotent, and reversible by removing this <style> block.
 *
 * KILLED FROM VIEW (still in DOM so existing JS handlers stay intact):
 *   - .hero-card                       sidebar "Build Better Prompts..." box
 *   - .demo-stack                      "Use Demo Values" pill
 *   - #pmg-help-me-start-recommend-row "⭐ Recommended For Best Results" pill
 *   - .pmg-help-me-start-helper        "Answer 4 quick questions..." caption
 *   - .pmg-expert-mode-row             Expert Mode pill+caption inside builder
 *   - #upload-field                    standalone "Add A File Or Image" box
 *   - #what-next                       legacy "What Next?" sidebar aside
 *   - #pmg-what-next-block             redundant "What Would You Like To Do?" box
 *
 * Hero now spans the full content width since the right column is empty.
 * ===================================================================== */
(function pmgT21PhaseACleanup() {
  if (window.__pmgT21Init) return;
  window.__pmgT21Init = true;

  var STYLE_ID = 'pmg-t21-phase-a-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== Kill the marketing sidebar; let the hero breathe.
              Higher-specificity selector beats an earlier override at
              pmg-ux.js:2093 ("aside.hero-card { display:block }"). ===== */
      'aside.hero-card, .hero-card { display: none !important; }',
      '.hero-grid { grid-template-columns: 1fr !important; max-width: 880px; margin-left: auto; margin-right: auto; }',
      '.hero-grid > .hero-side { max-width: 100%; }',

      /* ===== Pre-builder noise — gone. ===== */
      '.demo-stack { display: none !important; }',
      '#pmg-help-me-start-recommend-row { display: none !important; }',
      '#pmg-helpstart-pair-row { display: block !important; }',
      '#pmg-helpstart-pair-row > #guided-mode-btn { width: 100% !important; max-width: 420px; margin: 0 auto; display: block; }',
      '.pmg-help-me-start-helper { display: none !important; }',
      '.pmg-expert-mode-row { display: none !important; }',

      /* ===== Standalone file upload — kept hidden ONLY in Photography
              Suite (image mode). Task #18 restored the upload box inline
              in Create A Text Prompt; image mode has its own paperclip
              describe-image control (T39), so the standalone box stays
              hidden there. ===== */
      'body.image-mode #upload-field { display: none !important; }',

      /* ===== Redundant post-result blocks — gone. ===== */
      '#what-next { display: none !important; }',
      '#pmg-what-next-block { display: none !important; }',

      /* ===== Top nav gets a small Expert Mode text link (replacement
              for the killed in-builder pill). ===== */
      '#pmg-nav-expert-link {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  font-size: var(--text-xs); font-weight: 600;',
      '  color: var(--color-text-muted);',
      '  background: transparent; border: 0; cursor: pointer;',
      '  padding: 6px 10px; border-radius: var(--radius-full);',
      '  transition: color 160ms ease, background 160ms ease;',
      '}',
      '#pmg-nav-expert-link:hover {',
      '  color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 8%, transparent);',
      '}',
      'body.is-expert-mode #pmg-nav-expert-link, body.pmg-expert-mode #pmg-nav-expert-link {',
      '  color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 12%, transparent);',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* Add a small "Expert Mode" text link to the top nav. Drives the same
     #expert-mode-toggle checkbox so existing handlers fire. */
  function addNavExpertLink() {
    if (document.getElementById('pmg-nav-expert-link')) return;
    var nav = document.querySelector('.top-actions, .nav-toggle')
      ? document.querySelector('.top-actions') || document.querySelector('.nav-toggle').parentNode
      : null;
    if (!nav) {
      var fallback = document.querySelector('header nav, header .container, header');
      nav = fallback || null;
    }
    if (!nav) return;
    var btn = document.createElement('button');
    btn.id = 'pmg-nav-expert-link';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle Expert Mode');
    btn.innerHTML = '<span aria-hidden="true">⚙</span><span>Expert Mode</span>';
    btn.addEventListener('click', function () {
      var nextOn = !document.body.classList.contains('is-expert-mode');
      document.body.classList.toggle('pmg-expert-mode', nextOn);
      document.body.classList.toggle('is-expert-mode', nextOn);
      var checkbox = document.getElementById('expert-mode-toggle');
      if (checkbox && checkbox.checked !== nextOn) {
        checkbox.checked = nextOn;
        try { checkbox.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      }
    });
    /* Place at the very start of top-actions so it sits before the search/theme buttons. */
    if (nav.firstChild) {
      nav.insertBefore(btn, nav.firstChild);
    } else {
      nav.appendChild(btn);
    }
  }

  function init() {
    injectStyles();
    addNavExpertLink();
    /* Late-mount safety. */
    try {
      var mo = new MutationObserver(function () { addNavExpertLink(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T22 — PHASE B: post-result polish.
 *
 * Re-orders the post-generation block so the user sees one obvious
 * primary action (Run With AI) and a clear, compact set of secondary
 * actions, while featuring the tone shifters the user explicitly asked
 * to keep prominent.
 *
 * NEW POST-RESULT ORDER (top to bottom):
 *   1. Your Fixed Prompt  (with a tiny 🖨 printer icon next to the title)
 *   2. Tone Shifter row   (Improve With AI / More Detailed / More Bold &
 *                           Direct / Beginner Friendly / Undo)
 *                           — restyled as a featured, colorful pill row
 *   3. ▶ Run With AI       — single big primary button (stripped of the
 *                           redundant "Run This Prompt With AI" heading +
 *                           divider + helper text)
 *   4. Secondary actions   — small pill buttons:
 *                              Copy Prompt · Refine It · Check Quality ·
 *                              Start Over
 *   5. Fine-Tune Your Prompt  (textarea, unchanged)
 *
 * KILLED FROM VIEW (already / now):
 *   - "Run This Prompt With AI" section heading + divider + helper +
 *     meta (only the button itself stays, repositioned).
 *   - The standalone .quality-row "Want To Know How Strong Your Prompt
 *     Is?" wrapper (Check Quality button still works via the new
 *     secondary row).
 *   - The original Print/Save PDF + Clear Prompt actions-row pills
 *     (Print → printer icon, Clear → Start Over secondary pill).
 *
 * No backend / DB / handler changes; secondary buttons just delegate
 * clicks to the existing canonical buttons (#copy-btn, #fine-tune-input,
 * #check-quality-btn, #clear-prompt-btn, #print-btn).
 * ===================================================================== */
(function pmgT22PhaseBPostResult() {
  if (window.__pmgT22Init) return;
  window.__pmgT22Init = true;

  var STYLE_ID = 'pmg-t22-phase-b-style';
  var SECONDARY_ROW_ID = 'pmg-secondary-actions-row';
  var TITLE_ICON_ID = 'pmg-result-print-icon';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== Featured tone shifter row ===== */
      '#improve-block #tour-step-improve > .actions-row {',
      '  display: flex; flex-wrap: wrap; gap: var(--space-2);',
      '  padding: var(--space-3); margin-top: var(--space-2);',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface-2));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));',
      '  border-radius: var(--radius-lg);',
      '}',
      '#improve-block #tour-step-improve > .actions-row .btn {',
      '  flex: 1 1 auto; min-width: 140px;',
      '  padding: 10px 16px; font-size: var(--text-sm); font-weight: 600;',
      '  border-radius: var(--radius-full);',
      '  background: var(--color-surface) !important;',
      '  color: var(--color-text) !important;',
      '  border: 1.5px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border)) !important;',
      '  transition: transform 120ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;',
      '}',
      '#improve-block #tour-step-improve > .actions-row .btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface)) !important;',
      '  border-color: var(--color-primary) !important;',
      '  color: var(--color-primary) !important;',
      '  transform: translateY(-1px);',
      '}',
      /* Featured AI button keeps its accent. */
      '#improve-block #improve-with-ai-btn {',
      '  background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, #6c63ff)) !important;',
      '  color: #fff !important;',
      '  border-color: transparent !important;',
      '}',
      '#improve-block #improve-with-ai-btn:hover {',
      '  color: #fff !important;',
      '  filter: brightness(1.05);',
      '}',
      '#improve-block .undo-row { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }',
      '#improve-block .undo-helper { font-size: var(--text-xs); color: var(--color-text-muted); }',

      /* ===== Strip the Run section chrome; promote the button ===== */
      '#runSection { background: transparent !important; padding: var(--space-3) 0 0 !important; margin-top: var(--space-3) !important; }',
      '#runSection .run-section-divider { display: none !important; }',
      '#runSection .run-section-title { display: none !important; }',
      '#runSection .run-section-helper { display: none !important; }',
      '#runSection .run-section-meta { text-align: center; margin-top: 8px !important; }',
      '#runSection #runBtn {',
      '  width: 100%;',
      '  min-height: 56px;',
      '  font-size: var(--text-base);',
      '  font-weight: 700;',
      '  border-radius: var(--radius-full);',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 8px;',
      '  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '}',
      '#runSection #runBtn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 35%, transparent); }',

      /* ===== Hide the redundant standalone Quality + Actions rows ===== */
      '#quality-row { display: none !important; }',
      '#tour-final-actions > .actions-row:not(#pmg-secondary-actions-row):not(.pmg-copy-wrap) { display: none !important; }',

      /* ===== Secondary action pills row ===== */
      '#' + SECONDARY_ROW_ID + ' {',
      '  display: flex; flex-wrap: wrap; gap: var(--space-2);',
      '  margin-top: var(--space-3); justify-content: center;',
      '}',
      '#' + SECONDARY_ROW_ID + ' .pmg-sec-btn {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 8px 16px;',
      '  font-size: var(--text-sm); font-weight: 600;',
      '  border-radius: var(--radius-full);',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-border));',
      '  cursor: pointer;',
      '  transition: transform 120ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;',
      '}',
      '#' + SECONDARY_ROW_ID + ' .pmg-sec-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));',
      '  border-color: var(--color-primary);',
      '  color: var(--color-primary);',
      '  transform: translateY(-1px);',
      '}',
      '#' + SECONDARY_ROW_ID + ' .pmg-sec-btn.is-danger:hover {',
      '  background: color-mix(in srgb, #d04848 10%, var(--color-surface));',
      '  border-color: #d04848;',
      '  color: #d04848;',
      '}',

      /* ===== Tiny printer icon next to "Your Fixed Prompt" title ===== */
      '#' + TITLE_ICON_ID + ' {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 28px; height: 28px;',
      '  margin-left: 8px; vertical-align: middle;',
      '  border-radius: var(--radius-full);',
      '  background: transparent;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));',
      '  color: var(--color-text-muted);',
      '  cursor: pointer;',
      '  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;',
      '}',
      '#' + TITLE_ICON_ID + ':hover {',
      '  color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 8%, transparent);',
      '  border-color: var(--color-primary);',
      '}',
      '#' + TITLE_ICON_ID + ' svg { width: 14px; height: 14px; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* Add the tiny printer icon next to "Your Fixed Prompt" title. */
  function addPrinterIcon() {
    if (document.getElementById(TITLE_ICON_ID)) return;
    var title = document.getElementById('result-title');
    var printBtn = document.getElementById('print-btn');
    if (!title || !printBtn) return;
    var icon = document.createElement('button');
    icon.id = TITLE_ICON_ID;
    icon.type = 'button';
    icon.setAttribute('aria-label', 'Print or save as PDF');
    icon.title = 'Print or save as PDF';
    icon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
      '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
      '<rect x="6" y="14" width="12" height="8"></rect>' +
      '</svg>';
    icon.addEventListener('click', function () { printBtn.click(); });
    title.appendChild(icon);
  }

  /* Build the secondary action pills row. */
  function buildSecondaryRow() {
    if (document.getElementById(SECONDARY_ROW_ID)) return;
    var runSection = document.getElementById('runSection');
    if (!runSection || !runSection.parentNode) return;

    var row = document.createElement('div');
    row.id = SECONDARY_ROW_ID;

    function addBtn(label, icon, danger, handler) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-sec-btn' + (danger ? ' is-danger' : '');
      b.innerHTML = '<span aria-hidden="true">' + icon + '</span><span>' + label + '</span>';
      b.addEventListener('click', handler);
      row.appendChild(b);
    }

    addBtn('Copy Prompt', '📋', false, function () {
      var b = document.getElementById('copy-btn');
      if (b) b.click();
    });
    addBtn('Refine It', '✏️', false, function () {
      var t = document.getElementById('fine-tune-input');
      if (t) {
        try { t.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
        try { t.focus({ preventScroll: true }); } catch (e) { try { t.focus(); } catch (e2) {} }
      }
    });
    addBtn('Check Quality', '✓', false, function () {
      var b = document.getElementById('check-quality-btn');
      if (b) b.click();
    });
    addBtn('Start Over', '↺', true, function () {
      var b = document.getElementById('clear-prompt-btn');
      if (b) b.click();
    });

    runSection.parentNode.insertBefore(row, runSection.nextSibling);
  }

  /* Re-order DOM so improve-block (tone shifters) and runSection sit
     directly after the result, ahead of the secondary row and fine-tune. */
  function reorderPostResult() {
    var resultWrap = document.querySelector('.result-wrap');
    var improveBlock = document.getElementById('improve-block');
    var runSection = document.getElementById('runSection');
    var secRow = document.getElementById(SECONDARY_ROW_ID);
    var fineTune = document.querySelector('.fine-tune#tour-step-finalize') || document.getElementById('tour-step-finalize');
    if (!improveBlock || !runSection || !improveBlock.parentNode) return;
    var parent = improveBlock.parentNode;
    try {
      /* Order: improveBlock → runSection → secRow → fineTune */
      if (runSection.parentNode !== parent) parent.appendChild(runSection);
      parent.insertBefore(runSection, improveBlock.nextSibling);
      if (secRow) {
        if (secRow.parentNode !== parent) parent.appendChild(secRow);
        parent.insertBefore(secRow, runSection.nextSibling);
      }
      if (fineTune) {
        if (fineTune.parentNode !== parent) parent.appendChild(fineTune);
        var anchor = secRow || runSection;
        parent.insertBefore(fineTune, anchor.nextSibling);
      }
    } catch (e) { /* ignore */ }
  }

  function init() {
    injectStyles();
    addPrinterIcon();
    buildSecondaryRow();
    reorderPostResult();
    /* Late-mount safety. */
    try {
      var mo = new MutationObserver(function () {
        addPrinterIcon();
        buildSecondaryRow();
        reorderPostResult();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T23 — PHASE C: Photography Suite + Image Generator stack.
 *
 * Builds two new full-width sections immediately after the existing
 * builder section so the page now reads as three stacked workspaces:
 *
 *   TOP    = Prompt Builder        (existing #builder section)
 *   MIDDLE = Photography Suite     (new — built here)
 *   BOTTOM = Image Generator       (existing #imageResultSection,
 *                                   relocated and always visible)
 *
 * Photography Suite is a guided, NO-TEXT-PROMPT pipeline: the user
 * taps pills inside collapsible groups (Style / Camera & Lens /
 * Lighting & Mood / Composition / Color Palette), then clicks
 * "Send to Image Generator". We synthesize the photo prompt
 * internally, drop it into the canonical #goal field that the
 * existing window.generateImage() pipeline already reads, switch
 * the app into image mode, and trigger generation. The user never
 * sees or has to edit a text prompt to get an image.
 *
 * Image Generator section is moved out of the result panel and placed
 * as its own bottom card with three action buttons: Download
 * (existing #imageDownloadBtn), Regenerate (existing #imageAgainBtn),
 * and a new "Use As Reference" pill that copies the last image URL
 * to the clipboard for use elsewhere.
 *
 * Hard rules respected: NO backend / API changes, NO renames of
 * existing IDs/classes/JS, all new logic centralized here, CSS
 * variables only, no flex/order reordering tricks (real DOM moves).
 * ===================================================================== */
(function pmgT23PhotoSuite() {
  if (window.__pmgT23Init) return;
  window.__pmgT23Init = true;

  var STYLE_ID = 'pmg-t23-photo-suite-style';
  var SUITE_ID = 'pmg-photo-suite';
  var SUMMARY_ID = 'pmg-photo-summary';
  var IMG_GEN_HOST_ID = 'pmg-image-generator-section';
  var TOAST_ID = 'pmg-photo-toast';
  /* Task #31: recently-used preset combos. */
  var RECENT_ROW_ID = 'pmg-photo-recent';
  var RECENT_KEY = 'pmg.photo.recentPresets';
  var RECENT_MAX = 5;
  /* Task #34: shared floating tooltip element id for preset previews. */
  var PRESET_TOOLTIP_ID = 'pmg-photo-preset-tooltip';
  /* Task #35: user-saved personal combos. Distinct from RECENT (auto /
     chronological) — these are explicitly named and pinned by the user.
     Stores raw pill values (not preset indices) so a saved combo can
     mix preset picks with manual picks and survives any future change
     to the preset roster. */
  var SAVED_ROW_ID = 'pmg-photo-saved';
  var SAVED_KEY = 'pmg.photo.savedCombos';
  var SAVED_MAX = 20;
  var SAVED_NAME_MAX = 40;
  /* Task #38: cap how many pill values appear in the auto-generated
     "Surprise: a, b, c, d…" label so a 10-pill surprise still renders
     as a clean Recent chip. Anything beyond gets a single ellipsis. */
  var SURPRISE_LABEL_VALUES = 4;

  /* ---------------- Catalog of pill options per group --------------- */
  var GROUPS = [
    {
      id: 'style', label: 'Style', icon: '🎨',
      pills: [
        'Cinematic', 'Portrait', 'Documentary', 'Editorial',
        'Street Photography', 'Fashion', 'Landscape', 'Surreal',
        'Vintage', 'Hyperrealistic', 'Black & White', 'Polaroid'
      ]
    },
    {
      id: 'camera', label: 'Camera & Lens', icon: '📷',
      pills: [
        '85mm Portrait', '35mm Wide', '50mm Standard', 'Macro',
        'Telephoto', 'Fisheye', 'DSLR', 'Mirrorless',
        'Film Grain', 'Drone Aerial', 'GoPro Action', 'iPhone Snap'
      ]
    },
    {
      id: 'lighting', label: 'Lighting & Mood', icon: '💡',
      pills: [
        'Golden Hour', 'Blue Hour', 'Studio Softbox', 'Backlit',
        'Natural Window Light', 'Dramatic Shadows', 'Neon Glow',
        'Candle Lit', 'Overcast Diffused', 'Moonlit',
        'Harsh Noon', 'Cinematic Low-Key'
      ]
    },
    {
      id: 'composition', label: 'Composition', icon: '🖼️',
      pills: [
        'Rule Of Thirds', 'Centered', 'Symmetrical',
        'Close-Up', 'Wide Shot', 'Bird\'s-Eye View',
        'Worm\'s-Eye View', 'Dutch Angle', 'Leading Lines',
        'Negative Space', 'Frame Within A Frame'
      ]
    },
    {
      id: 'palette', label: 'Color Palette', icon: '🎨',
      pills: [
        'Warm Tones', 'Cool Blues', 'Monochrome', 'Pastel Soft',
        'High Contrast', 'Muted Earth', 'Neon Saturated',
        'Sepia', 'Teal & Orange', 'Forest Greens', 'Sunset Reds'
      ]
    }
  ];

  /* ---------------- Task #25 / #30: Quick-Style presets per group ---------
   * Curated one-click presets for every Photography Suite group. Task #25
   * shipped Style, Lighting & Mood, and Composition; Task #30 extended the
   * same treatment to Camera & Lens (Quick Lenses) and Color Palette
   * (Quick Palettes) so users can fill every group with one click.
   * Each preset is a label + a fixed list of pill values that already exist
   * in that group's `pills` array above. Clicking a preset clears that
   * group's existing picks and applies the preset's values; other groups
   * are untouched. Surprise Me continues to work as before — it still
   * randomizes across all groups.
   * ----------------------------------------------------------------------- */
  var PRESETS = {
    style: {
      title: 'Quick Styles',
      items: [
        { label: 'Cinematic',    values: ['Cinematic'] },
        { label: 'Editorial',    values: ['Editorial', 'Fashion'] },
        { label: 'Vintage Film', values: ['Vintage', 'Polaroid'] },
        { label: 'Minimalist',   values: ['Black & White'] }
      ]
    },
    lighting: {
      title: 'Quick Lighting',
      items: [
        { label: 'Golden Hour',    values: ['Golden Hour', 'Natural Window Light'] },
        { label: 'Studio Softbox', values: ['Studio Softbox'] },
        { label: 'Moody Low Key',  values: ['Cinematic Low-Key', 'Dramatic Shadows'] },
        { label: 'Overcast',       values: ['Overcast Diffused'] }
      ]
    },
    composition: {
      title: 'Quick Compositions',
      items: [
        { label: 'Rule Of Thirds',     values: ['Rule Of Thirds'] },
        { label: 'Centered Symmetry',  values: ['Centered', 'Symmetrical'] },
        { label: 'Leading Lines',      values: ['Leading Lines', 'Negative Space'] },
        { label: 'Wide Establishing',  values: ['Wide Shot', 'Bird\'s-Eye View'] }
      ]
    },
    camera: {
      title: 'Quick Lenses',
      items: [
        { label: 'Portrait Lens',     values: ['85mm Portrait', 'DSLR'] },
        { label: 'Wide Landscape',    values: ['35mm Wide', 'Drone Aerial'] },
        { label: 'Macro Detail',      values: ['Macro', '50mm Standard'] },
        { label: 'Telephoto Action',  values: ['Telephoto', 'GoPro Action'] }
      ]
    },
    palette: {
      title: 'Quick Palettes',
      items: [
        { label: 'Warm Sunset',         values: ['Warm Tones', 'Sunset Reds'] },
        { label: 'Cool Blue',           values: ['Cool Blues', 'Teal & Orange'] },
        { label: 'Earthy Neutrals',     values: ['Muted Earth', 'Forest Greens'] },
        { label: 'High Contrast Bold',  values: ['High Contrast', 'Neon Saturated'] }
      ]
    }
  };

  /* ------------------------ Style injection ------------------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Section card shell shared by Photography Suite + Image Gen. */
      '.pmg-stack-section { padding: var(--space-6) 0; }',
      '.pmg-stack-section .container { max-width: 880px; }',
      '.pmg-stack-card {',
      '  background: var(--color-surface);',
      '  border: 1px solid var(--color-border);',
      '  border-radius: var(--radius-lg);',
      '  padding: var(--space-5);',
      '  box-shadow: 0 1px 2px rgba(0,0,0,0.04);',
      '}',
      '.pmg-stack-card-head {',
      '  display: flex; align-items: center; gap: var(--space-2);',
      '  margin-bottom: var(--space-2);',
      '}',
      '.pmg-stack-card-head h2 {',
      '  margin: 0; font-size: var(--text-xl); font-weight: 700;',
      '  color: var(--color-text);',
      '}',
      '.pmg-stack-card-head .pmg-eyebrow {',
      '  display: inline-block; padding: 2px 10px; font-size: var(--text-xs);',
      '  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2));',
      '  color: var(--color-primary);',
      '  border-radius: var(--radius-full); margin-right: var(--space-2);',
      '}',
      '.pmg-stack-helper { color: var(--color-text-muted); font-size: var(--text-sm); margin: 0 0 var(--space-4); }',

      /* Photography Suite groups */
      '#' + SUITE_ID + ' .pmg-photo-group {',
      '  border: 1px solid var(--color-border); border-radius: var(--radius-md);',
      '  margin-bottom: var(--space-3); background: var(--color-surface-2);',
      '  overflow: hidden;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-group-head {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  width: 100%; padding: 12px 16px; background: transparent; border: 0;',
      '  cursor: pointer; text-align: left; color: var(--color-text);',
      '  font-size: var(--text-base); font-weight: 600;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-group-head:hover { background: color-mix(in srgb, var(--color-primary) 6%, transparent); }',
      '#' + SUITE_ID + ' .pmg-photo-group-head .pmg-photo-group-count {',
      '  font-size: var(--text-xs); font-weight: 600; color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));',
      '  padding: 2px 8px; border-radius: var(--radius-full); margin-left: auto; margin-right: 8px;',
      '  min-width: 20px; text-align: center;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-group-count[data-count="0"] { display: none; }',
      '#' + SUITE_ID + ' .pmg-photo-group-chevron { transition: transform 200ms ease; color: var(--color-text-muted); }',
      '#' + SUITE_ID + ' .pmg-photo-group.is-collapsed .pmg-photo-group-chevron { transform: rotate(-90deg); }',
      '#' + SUITE_ID + ' .pmg-photo-group-body {',
      '  padding: 0 16px 14px; display: flex; flex-wrap: wrap; gap: 8px;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-group.is-collapsed .pmg-photo-group-body { display: none; }',
      '#' + SUITE_ID + ' .pmg-photo-pill {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 7px 14px; font-size: var(--text-sm); font-weight: 500;',
      '  background: var(--color-surface); color: var(--color-text);',
      '  border: 1.5px solid var(--color-border); border-radius: var(--radius-full);',
      '  cursor: pointer; user-select: none;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms ease;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pill:hover {',
      '  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));',
      '  transform: translateY(-1px);',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pill.is-active {',
      '  background: var(--color-primary); color: #fff; border-color: var(--color-primary);',
      '  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 30%, transparent);',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pill.is-active::before { content: "✓"; font-weight: 700; }',

      /* Live summary line */
      '#' + SUMMARY_ID + ' {',
      '  margin-top: var(--space-4); padding: var(--space-3) var(--space-4);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-2));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border));',
      '  border-radius: var(--radius-md);',
      '  font-size: var(--text-sm); color: var(--color-text); line-height: 1.5;',
      '}',
      '#' + SUMMARY_ID + ' .pmg-summary-label {',
      '  font-weight: 700; color: var(--color-primary); margin-right: 6px;',
      '}',
      '#' + SUMMARY_ID + '.is-empty { color: var(--color-text-muted); font-style: italic; }',

      /* Action row */
      '#' + SUITE_ID + ' .pmg-photo-actions {',
      '  display: flex; flex-wrap: wrap; gap: var(--space-2);',
      '  margin-top: var(--space-4); align-items: center;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-send {',
      '  flex: 1 1 auto; min-height: 52px; padding: 12px 24px;',
      '  font-size: var(--text-base); font-weight: 700;',
      '  border-radius: var(--radius-full);',
      '  background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, #6c63ff));',
      '  color: #fff; border: 0; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 8px;',
      '  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '  transition: transform 120ms ease, box-shadow 180ms ease, filter 180ms ease;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-send:hover { transform: translateY(-1px); filter: brightness(1.05); }',
      '#' + SUITE_ID + ' .pmg-photo-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }',
      '#' + SUITE_ID + ' .pmg-photo-surprise, #' + SUITE_ID + ' .pmg-photo-clear, #' + SUITE_ID + ' .pmg-photo-preset {',
      '  padding: 10px 18px; font-size: var(--text-sm); font-weight: 600;',
      '  background: var(--color-surface); color: var(--color-text);',
      '  border: 1.5px solid var(--color-border); border-radius: var(--radius-full); cursor: pointer;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-surprise:hover, #' + SUITE_ID + ' .pmg-photo-preset:hover { border-color: var(--color-primary); color: var(--color-primary); }',
      '#' + SUITE_ID + ' .pmg-photo-clear { background: transparent; border-style: dashed; color: var(--color-text-muted); }',
      '#' + SUITE_ID + ' .pmg-photo-clear:hover { color: #d04848; border-color: #d04848; }',

      /* Task #25: Quick-Style preset rows. Sits at the top of the
         affected group bodies (Style, Lighting & Mood, Composition).
         flex-basis: 100% forces it onto its own row inside the
         flex-wrap pill grid so the preset buttons never get crammed
         in alongside pills, and pills always start on a fresh row
         below — preventing horizontal overflow on mobile. */
      '#' + SUITE_ID + ' .pmg-photo-presets {',
      '  flex: 0 0 100%; max-width: 100%;',
      '  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;',
      '  padding-bottom: 10px; margin-bottom: 4px;',
      '  border-bottom: 1px dashed color-mix(in srgb, var(--color-primary) 22%, var(--color-border));',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-presets-label {',
      '  font-size: 13px; font-weight: 700;',
      '  color: var(--color-text-muted);',
      '  margin-right: 4px;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-preset:hover { transform: translateY(-1px); }',
      '#' + SUITE_ID + ' .pmg-photo-preset.is-active {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));',
      '  border-color: var(--color-primary); color: var(--color-primary);',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + SUITE_ID + ' .pmg-photo-preset:hover { transform: none; }',
      '}',

      /* Task #34: floating preview tooltip for Quick-Style presets.
         Shows the underlying pill values a preset will activate so
         users can see what they're about to apply (and avoid losing
         a careful selection by surprise). One shared element is
         positioned with absolute coordinates relative to the
         document — keeps DOM noise out of every preset row. */
      '#' + PRESET_TOOLTIP_ID + ' {',
      '  position: absolute; top: -9999px; left: -9999px; z-index: 9999;',
      '  max-width: 280px;',
      '  background: var(--color-text); color: var(--color-surface);',
      '  padding: 8px 12px; border-radius: var(--radius-md);',
      '  font-size: var(--text-xs); line-height: 1.4;',
      '  box-shadow: 0 4px 14px rgba(0,0,0,0.18);',
      '  display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center;',
      '  pointer-events: none; opacity: 0; transform: translateY(2px);',
      '  transition: opacity 140ms ease, transform 140ms ease;',
      '}',
      '#' + PRESET_TOOLTIP_ID + '.is-visible { opacity: 1; transform: translateY(0); }',
      '#' + PRESET_TOOLTIP_ID + ' .pmg-photo-preset-tooltip-label {',
      '  font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;',
      '  font-size: 10px; opacity: 0.75; margin-right: 2px;',
      '}',
      '#' + PRESET_TOOLTIP_ID + ' .pmg-photo-preset-tooltip-pill {',
      '  display: inline-block; padding: 3px 8px;',
      '  background: color-mix(in srgb, var(--color-surface) 22%, transparent);',
      '  border: 1px solid color-mix(in srgb, var(--color-surface) 28%, transparent);',
      '  border-radius: var(--radius-full);',
      '  font-weight: 600; font-size: 11px; white-space: nowrap;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + PRESET_TOOLTIP_ID + ' { transition: none; }',
      '}',

      /* Task #31: Recently-used preset combos row. Sits between the
         helper text and the first photo group so users can re-pick a
         favorite combo with a single tap. Hidden until at least one
         preset combo has been recorded. */
      '#' + RECENT_ROW_ID + ' {',
      '  margin-bottom: var(--space-3);',
      '  padding: 10px 14px;',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface-2));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 22%, var(--color-border));',
      '  border-radius: var(--radius-md);',
      '  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;',
      '}',
      '#' + RECENT_ROW_ID + '[hidden] { display: none; }',
      '.pmg-photo-recent-label {',
      '  font-size: 13px; font-weight: 700;',
      '  color: var(--color-text-muted);',
      '  margin-right: 4px;',
      '}',
      '.pmg-photo-recent-btn {',
      '  padding: 7px 12px; font-size: 13px; font-weight: 600;',
      '  background: var(--color-surface); color: var(--color-text);',
      '  border: 1.5px solid var(--color-border); border-radius: var(--radius-full);',
      '  cursor: pointer; max-width: 100%;',
      '  white-space: normal; text-align: left; line-height: 1.3;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms ease;',
      '}',
      '.pmg-photo-recent-btn:hover, .pmg-photo-recent-btn:focus-visible {',
      '  border-color: var(--color-primary); color: var(--color-primary);',
      '  transform: translateY(-1px); outline: none;',
      '}',
      '.pmg-photo-recent-clear {',
      '  margin-left: auto; background: transparent; border: 0;',
      '  padding: 4px 8px; font-size: 12px; color: var(--color-text-muted);',
      '  cursor: pointer; text-decoration: underline;',
      '}',
      '.pmg-photo-recent-clear:hover, .pmg-photo-recent-clear:focus-visible {',
      '  color: #d04848; outline: none;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .pmg-photo-recent-btn:hover { transform: none; }',
      '}',
      '@media (max-width: 640px) {',
      '  #' + RECENT_ROW_ID + ' { padding: 8px 10px; }',
      '  .pmg-photo-recent-clear { margin-left: 0; }',
      '}',

      /* Task #35: My Combos row — user-saved named combos. Sits ABOVE
         the Recent row so it gets visual priority (intentionally
         pinned by the user, not auto-tracked). Uses a slightly
         warmer accent and solid border so it reads as a personal
         collection, distinct from the dashed-accent Recent row. */
      '#' + SAVED_ROW_ID + ' {',
      '  margin-bottom: var(--space-3);',
      '  padding: 10px 14px;',
      '  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface-2));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));',
      '  border-radius: var(--radius-md);',
      '  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;',
      '}',
      '#' + SAVED_ROW_ID + '[hidden] { display: none; }',
      '.pmg-photo-saved-label {',
      '  font-size: 13px; font-weight: 700;',
      '  color: var(--color-text-muted);',
      '  margin-right: 4px;',
      '}',
      /* Each saved combo is a chip with a label segment (apply) and
         a small × delete segment, sharing one rounded-pill border. */
      '.pmg-photo-saved-chip {',
      '  display: inline-flex; align-items: stretch;',
      '  background: var(--color-surface);',
      '  border: 1.5px solid var(--color-border);',
      '  border-radius: var(--radius-full);',
      '  overflow: hidden; max-width: 100%;',
      '  transition: border-color 160ms ease;',
      '}',
      '.pmg-photo-saved-chip:hover, .pmg-photo-saved-chip:focus-within {',
      '  border-color: var(--color-primary);',
      '}',
      '.pmg-photo-saved-btn {',
      '  padding: 7px 6px 7px 12px; font-size: 13px; font-weight: 600;',
      '  background: transparent; color: var(--color-text);',
      '  border: 0; cursor: pointer; max-width: 100%;',
      '  white-space: normal; text-align: left; line-height: 1.3;',
      '  transition: color 160ms ease;',
      '}',
      '.pmg-photo-saved-btn:hover, .pmg-photo-saved-btn:focus-visible {',
      '  color: var(--color-primary); outline: none;',
      '}',
      '.pmg-photo-saved-delete {',
      '  padding: 0 10px; font-size: 14px; font-weight: 700;',
      '  background: transparent; color: var(--color-text-muted);',
      '  border: 0; border-left: 1px solid var(--color-border);',
      '  cursor: pointer; line-height: 1;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  transition: background 140ms ease, color 140ms ease;',
      '}',
      '.pmg-photo-saved-delete:hover, .pmg-photo-saved-delete:focus-visible {',
      '  background: color-mix(in srgb, #d04848 12%, transparent);',
      '  color: #d04848; outline: none;',
      '}',
      /* Save This Combo button — sits next to Surprise Me / Clear in
         the actions row. Disabled until at least one pill is active. */
      '#' + SUITE_ID + ' .pmg-photo-save-combo {',
      '  padding: 10px 18px; font-size: var(--text-sm); font-weight: 600;',
      '  background: var(--color-surface); color: var(--color-text);',
      '  border: 1.5px solid var(--color-border); border-radius: var(--radius-full);',
      '  cursor: pointer;',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-save-combo:not(:disabled):hover,',
      '#' + SUITE_ID + ' .pmg-photo-save-combo:not(:disabled):focus-visible {',
      '  border-color: var(--color-primary); color: var(--color-primary); outline: none;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-save-combo:disabled {',
      '  opacity: 0.5; cursor: not-allowed;',
      '}',
      /* Task #38: Pin This Surprise — emerald-tinted CTA that stands out
         briefly while the surprise is fresh. Hidden by default; revealed
         only after surpriseMe() and re-hidden the moment the user changes
         a pill, applies a preset, or clears. */
      '#' + SUITE_ID + ' .pmg-photo-pin-surprise {',
      '  padding: 10px 18px; font-size: var(--text-sm); font-weight: 700;',
      '  background: color-mix(in srgb, var(--color-success, #2ea44f) 12%, var(--color-surface));',
      '  color: var(--color-success, #2ea44f);',
      '  border: 1.5px solid color-mix(in srgb, var(--color-success, #2ea44f) 50%, transparent);',
      '  border-radius: var(--radius-full); cursor: pointer;',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;',
      '  animation: pmgPinSurpriseIn 220ms ease-out;',
      '}',
      '#' + SUITE_ID + ' .pmg-photo-pin-surprise:hover,',
      '#' + SUITE_ID + ' .pmg-photo-pin-surprise:focus-visible {',
      '  background: color-mix(in srgb, var(--color-success, #2ea44f) 22%, var(--color-surface));',
      '  border-color: var(--color-success, #2ea44f); outline: none;',
      '}',
      '@keyframes pmgPinSurpriseIn {',
      '  from { opacity: 0; transform: translateY(-2px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + SUITE_ID + ' .pmg-photo-pin-surprise { animation: none; }',
      '}',
      '@media (max-width: 640px) {',
      '  #' + SAVED_ROW_ID + ' { padding: 8px 10px; }',
      '  #' + SUITE_ID + ' .pmg-photo-save-combo { width: 100%; justify-content: center; }',
      '  #' + SUITE_ID + ' .pmg-photo-pin-surprise { width: 100%; justify-content: center; }',
      '}',

      /* Image Generator host: override the global image-mode hide rule. */
      '#' + IMG_GEN_HOST_ID + ' { display: block !important; }',
      '#' + IMG_GEN_HOST_ID + ' .image-result-section,',
      '#' + IMG_GEN_HOST_ID + ' #imageResultSection {',
      '  display: block !important; margin-top: 0 !important;',
      '}',
      '#' + IMG_GEN_HOST_ID + ' .image-result-section[hidden] { display: block !important; }',
      '#' + IMG_GEN_HOST_ID + ' .run-section-divider { display: none; }',
      '#' + IMG_GEN_HOST_ID + ' .run-section-title { display: none; }',
      '#' + IMG_GEN_HOST_ID + ' .image-result-actions { gap: var(--space-2); margin-top: var(--space-3); }',
      '#' + IMG_GEN_HOST_ID + ' .image-result-actions .btn { border-radius: var(--radius-full); }',

      /* Toast */
      '#' + TOAST_ID + ' {',
      '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);',
      '  background: var(--color-text); color: var(--color-surface);',
      '  padding: 10px 20px; border-radius: var(--radius-full); font-size: var(--text-sm);',
      '  font-weight: 600; opacity: 0; pointer-events: none;',
      '  transition: opacity 220ms ease, transform 220ms ease;',
      '  z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.2);',
      '}',
      '#' + TOAST_ID + '.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }',

      /* Mobile tweaks */
      '@media (max-width: 640px) {',
      '  .pmg-stack-section { padding: var(--space-4) 0; }',
      '  .pmg-stack-card { padding: var(--space-4); }',
      '  #' + SUITE_ID + ' .pmg-photo-actions { flex-direction: column; }',
      '  #' + SUITE_ID + ' .pmg-photo-send { width: 100%; }',
      '  #' + SUITE_ID + ' .pmg-photo-surprise, #' + SUITE_ID + ' .pmg-photo-clear { width: 100%; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ----------------------- Toast helper ----------------------------- */
  function showToast(msg) {
    var t = document.getElementById(TOAST_ID);
    if (!t) {
      t = document.createElement('div');
      t.id = TOAST_ID;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(function () {
      t.classList.remove('is-visible');
    }, 2400);
  }

  /* ----------------------- State + summary -------------------------- */
  function getSelections() {
    var picks = {};
    GROUPS.forEach(function (g) { picks[g.id] = []; });
    document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active').forEach(function (el) {
      var g = el.getAttribute('data-group');
      var v = el.getAttribute('data-value');
      if (g && v && picks[g]) picks[g].push(v);
    });
    return picks;
  }

  function buildPromptText(picks) {
    var parts = [];
    if (picks.style && picks.style.length) parts.push(picks.style.join(', ') + ' style');
    if (picks.camera && picks.camera.length) parts.push('shot on ' + picks.camera.join(' / '));
    if (picks.lighting && picks.lighting.length) parts.push(picks.lighting.join(', ') + ' lighting');
    if (picks.composition && picks.composition.length) parts.push(picks.composition.join(', ') + ' composition');
    if (picks.palette && picks.palette.length) parts.push(picks.palette.join(', ') + ' color palette');
    return parts.join(', ');
  }

  function refreshSummary() {
    var sum = document.getElementById(SUMMARY_ID);
    if (!sum) return;
    var picks = getSelections();
    var text = buildPromptText(picks);

    /* Update count badges per group. */
    GROUPS.forEach(function (g) {
      var c = document.querySelector('#' + SUITE_ID + ' .pmg-photo-group-count[data-group="' + g.id + '"]');
      if (c) {
        var n = (picks[g.id] || []).length;
        c.setAttribute('data-count', String(n));
        c.textContent = n > 0 ? String(n) : '';
      }
    });

    /* Task #25: highlight the active Quick-Style preset (if the group's
       current pick set exactly matches one preset's values). Idempotent:
       if no preset matches, all preset buttons are left un-highlighted. */
    Object.keys(PRESETS).forEach(function (groupId) {
      var groupPicks = (picks[groupId] || []).slice().sort();
      var items = PRESETS[groupId].items || [];
      items.forEach(function (it, idx) {
        var btn = document.querySelector(
          '#' + SUITE_ID + ' .pmg-photo-preset' +
          '[data-group="' + groupId + '"][data-preset-index="' + idx + '"]'
        );
        if (!btn) return;
        var presetVals = (it.values || []).slice().sort();
        var match = groupPicks.length === presetVals.length &&
          groupPicks.every(function (v, i) { return v === presetVals[i]; });
        btn.classList.toggle('is-active', match);
      });
    });

    /* Enable / disable Send button. */
    var sendBtn = document.querySelector('#' + SUITE_ID + ' .pmg-photo-send');
    var hasAny = Object.keys(picks).some(function (k) { return picks[k].length > 0; });
    if (sendBtn) sendBtn.disabled = !hasAny;
    /* Task #35: Save This Combo follows the same enabled state — no
       point saving an empty combo. */
    var saveBtn = document.querySelector('#' + SUITE_ID + ' .pmg-photo-save-combo');
    if (saveBtn) saveBtn.disabled = !hasAny;

    if (!text) {
      sum.classList.add('is-empty');
      sum.innerHTML = '<span class="pmg-summary-label">Your Vibe:</span>Pick a few options above to compose your shot.';
    } else {
      sum.classList.remove('is-empty');
      sum.innerHTML = '<span class="pmg-summary-label">Your Vibe:</span>' + escapeHtml(text);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----------------------- Build the suite -------------------------- */
  function buildSuite() {
    if (document.getElementById(SUITE_ID)) return;

    var section = document.createElement('section');
    section.className = 'app-section pmg-stack-section';
    section.id = 'photo-suite-section';
    section.setAttribute('aria-labelledby', SUITE_ID + '-title');

    var html = [
      '<div class="container">',
      '  <div class="pmg-stack-card" id="' + SUITE_ID + '">',
      '    <div class="pmg-stack-card-head">',
      '      <span class="pmg-eyebrow">Step 2</span>',
      '      <h2 id="' + SUITE_ID + '-title">📸 Photography Suite</h2>',
      '    </div>',
      '    <p class="pmg-stack-helper">Pick a vibe in each group. We\'ll build the perfect photo prompt and send it straight to the image generator — no copy and paste needed.</p>',
      /* Task #35: empty container for the user-saved (My Combos) row.
         renderSavedRow() will hydrate or hide it based on
         localStorage state. Sits ABOVE the Recent row so the
         intentionally-pinned personal collection has visual priority
         over the auto-tracked recent history. */
      '    <div id="' + SAVED_ROW_ID + '" hidden></div>',
      /* Task #31: empty container for the recently-used preset combos
         row. renderRecentRow() will hydrate or hide it based on
         localStorage state. */
      '    <div id="' + RECENT_ROW_ID + '" hidden></div>'
    ];

    GROUPS.forEach(function (g) {
      html.push('<div class="pmg-photo-group" data-group="' + g.id + '">');
      html.push('  <button type="button" class="pmg-photo-group-head" aria-expanded="true">');
      html.push('    <span><span aria-hidden="true">' + g.icon + '</span> ' + g.label + '</span>');
      html.push('    <span class="pmg-photo-group-count" data-group="' + g.id + '" data-count="0"></span>');
      html.push('    <span class="pmg-photo-group-chevron" aria-hidden="true">▾</span>');
      html.push('  </button>');
      html.push('  <div class="pmg-photo-group-body">');
      /* Task #25: render Quick-Style preset row at top of body for
         Style, Lighting & Mood, and Composition groups. */
      var preset = PRESETS[g.id];
      if (preset && preset.items && preset.items.length) {
        html.push('    <div class="pmg-photo-presets" role="group" aria-label="' + escapeHtml(preset.title) + '">');
        html.push('      <span class="pmg-photo-presets-label">' + escapeHtml(preset.title) + ':</span>');
        preset.items.forEach(function (it, idx) {
          html.push(
            '      <button type="button" class="pmg-photo-preset" ' +
              'data-group="' + g.id + '" data-preset-index="' + idx + '" ' +
              'aria-label="Apply ' + escapeHtml(it.label) + ' preset">' +
              escapeHtml(it.label) +
            '</button>'
          );
        });
        html.push('    </div>');
      }
      g.pills.forEach(function (p) {
        html.push('    <button type="button" class="pmg-photo-pill" data-group="' + g.id + '" data-value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</button>');
      });
      html.push('  </div>');
      html.push('</div>');
    });

    html.push('<div id="' + SUMMARY_ID + '" class="is-empty"></div>');
    html.push('<div class="pmg-photo-actions">');
    html.push('  <button type="button" class="pmg-photo-send" disabled><span aria-hidden="true">✨</span><span>Send To Image Generator</span></button>');
    html.push('  <button type="button" class="pmg-photo-surprise"><span aria-hidden="true">🎲</span> Surprise Me</button>');
    /* Task #38: Pin This Surprise — only revealed for the brief window
       between Surprise Me and the user diverging from those picks.
       Saves the random pill set into the Recent row as a raw combo. */
    html.push('  <button type="button" class="pmg-photo-pin-surprise" hidden aria-label="Pin this surprise to the Recent row"><span aria-hidden="true">📌</span> Pin This Surprise</button>');
    /* Task #35: Save This Combo — disabled until at least one pill
       is active (refreshSummary keeps it in sync). */
    html.push('  <button type="button" class="pmg-photo-save-combo" disabled aria-label="Save current selection as a named combo"><span aria-hidden="true">💾</span> Save This Combo</button>');
    html.push('  <button type="button" class="pmg-photo-clear">Clear Picks</button>');
    html.push('</div>');
    html.push('  </div>');
    html.push('</div>');

    section.innerHTML = html.join('\n');

    /* Insert directly after the existing builder app-section. The Photography
       Suite is only meaningful on pages that actually host the prompt builder
       (i.e. index.html). On marketing pages like pricing.html / guide.html
       there is no #builder, so we MUST NOT fall back to appending the suite
       to <body> — that previously injected a full Photography Suite at the
       bottom of pricing.html, which confused users and was reported as a bug. */
    var builder = document.getElementById('builder');
    if (!builder || !builder.parentNode) return;
    builder.parentNode.insertBefore(section, builder.nextSibling);

    wireSuite(section);
  }

  function wireSuite(root) {
    /* Group collapse toggles. */
    root.querySelectorAll('.pmg-photo-group-head').forEach(function (h) {
      h.addEventListener('click', function () {
        var grp = h.parentNode;
        var collapsed = grp.classList.toggle('is-collapsed');
        h.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    });
    /* Pill toggles. */
    root.querySelectorAll('.pmg-photo-pill').forEach(function (p) {
      p.addEventListener('click', function () {
        p.classList.toggle('is-active');
        /* Task #38: any manual pill change diverges from the last
           Surprise Me roll, so retire the Pin offer. */
        if (_surpriseFresh) setSurpriseFresh(false);
        refreshSummary();
      });
    });
    /* Task #25: Quick-Style preset clicks. Clears the group's existing
       picks, then activates only the pills listed in the preset. Other
       groups are untouched. Same downstream wiring as Surprise Me:
       toggles .is-active classes and calls refreshSummary(), which
       updates the count badges, summary line, and Send button state.

       Task #34: also wires hover/focus/long-press to show a preview
       tooltip listing the underlying pill values. On touch devices a
       brief long-press reveals the preview AND suppresses the tap so
       the preset isn't accidentally applied. */
    root.querySelectorAll('.pmg-photo-preset').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        /* If a touch long-press just opened the preview, swallow this
           synthetic click so we don't apply the preset the user was
           just trying to inspect. */
        if (presetTooltipState.suppressClick) {
          presetTooltipState.suppressClick = false;
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        hidePresetPreview();
        var groupId = b.getAttribute('data-group');
        var idx = parseInt(b.getAttribute('data-preset-index'), 10);
        applyPreset(groupId, idx);
      });
      wirePreviewHover(b);
    });

    /* Escape key dismisses the preview (parity with other popovers). */
    if (!root.__pmgPresetTooltipKeyBound) {
      root.__pmgPresetTooltipKeyBound = true;
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && presetTooltipState.currentBtn) {
          hidePresetPreview();
        }
      });
      /* Hide on scroll/resize so the floating element stays anchored. */
      window.addEventListener('scroll', function () {
        if (presetTooltipState.currentBtn) hidePresetPreview();
      }, { passive: true });
      window.addEventListener('resize', function () {
        if (presetTooltipState.currentBtn) hidePresetPreview();
      });
    }
    /* Send. */
    var sendBtn = root.querySelector('.pmg-photo-send');
    if (sendBtn) sendBtn.addEventListener('click', sendToImageGenerator);
    /* Surprise. */
    var surprise = root.querySelector('.pmg-photo-surprise');
    if (surprise) surprise.addEventListener('click', surpriseMe);
    /* Task #38: Pin This Surprise. */
    var pinBtn = root.querySelector('.pmg-photo-pin-surprise');
    if (pinBtn) pinBtn.addEventListener('click', pinCurrentSurprise);
    /* Clear. */
    var clear = root.querySelector('.pmg-photo-clear');
    if (clear) clear.addEventListener('click', clearAllPicks);
    /* Task #35: Save This Combo. */
    var saveBtn = root.querySelector('.pmg-photo-save-combo');
    if (saveBtn) saveBtn.addEventListener('click', saveCurrentAsCombo);

    /* Task #31: delegate clicks within the Recent row. The row is
       re-rendered (innerHTML replaced) every time a combo is recorded
       or cleared, so per-button listeners would be lost — delegation
       on the stable container avoids that. */
    var recentRow = root.querySelector('#' + RECENT_ROW_ID);
    if (recentRow) {
      recentRow.addEventListener('click', function (ev) {
        var clearBtn = ev.target.closest('.pmg-photo-recent-clear');
        if (clearBtn) { clearRecentCombos(); return; }
        var btn = ev.target.closest('.pmg-photo-recent-btn');
        if (!btn) return;
        /* Task #43: if a touch long-press just opened the preview,
           swallow this synthetic tap so the user can inspect the combo
           without accidentally applying it. Mirrors the preset path. */
        if (presetTooltipState.suppressClick) {
          presetTooltipState.suppressClick = false;
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        hidePresetPreview();
        var i = parseInt(btn.getAttribute('data-recent-index'), 10);
        var combos = loadRecentCombos();
        if (combos[i]) applyCombo(combos[i]);
      });
    }

    /* Task #35: delegate clicks within the My Combos row. Same
       reasoning as the Recent delegation above — the row is
       re-rendered on every save/delete. The row contains chips that
       have two interactive segments (apply + delete), so we look up
       the closest matching child. */
    var savedRow = root.querySelector('#' + SAVED_ROW_ID);
    if (savedRow) {
      savedRow.addEventListener('click', function (ev) {
        var del = ev.target.closest('.pmg-photo-saved-delete');
        if (del) {
          var di = parseInt(del.getAttribute('data-saved-index'), 10);
          if (!isNaN(di)) deleteSavedCombo(di);
          return;
        }
        var apply = ev.target.closest('.pmg-photo-saved-btn');
        if (!apply) return;
        var ai = parseInt(apply.getAttribute('data-saved-index'), 10);
        if (!isNaN(ai)) applySavedCombo(ai);
      });
    }

    refreshSummary();
    renderRecentRow();
    renderSavedRow();
  }

  function clearAllPicks() {
    document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active').forEach(function (p) {
      p.classList.remove('is-active');
    });
    /* Task #38: clearing diverges from the surprise. surpriseMe()
       calls clearAllPicks then re-sets the flag, so this is safe. */
    if (_surpriseFresh) setSurpriseFresh(false);
    refreshSummary();
  }

  /* ---------------- Task #34: preset preview tooltip ----------------
   * Each Quick-Style / Quick-Lens / Quick-Palette preset replaces its
   * group's current picks when clicked, which can wipe out a careful
   * selection. Showing the underlying pill values on hover/focus
   * (desktop) or after a brief long-press (touch) lets users see what
   * they're about to apply before committing.
   *
   * One shared tooltip element is positioned at document coordinates
   * relative to the hovered button so we don't have to add a hidden
   * element to every preset row.
   * ------------------------------------------------------------------ */
  var presetTooltipState = {
    hideTimer: null,
    longPressTimer: null,
    suppressClick: false,
    currentBtn: null
  };

  function getPresetTooltip() {
    var t = document.getElementById(PRESET_TOOLTIP_ID);
    if (!t) {
      t = document.createElement('div');
      t.id = PRESET_TOOLTIP_ID;
      t.setAttribute('role', 'tooltip');
      t.setAttribute('aria-hidden', 'true');
      document.body.appendChild(t);
    }
    return t;
  }

  function presetPreviewLabels(btn) {
    /* Task #43: same tooltip is reused by the Recent Combos row. A
       recent-combo button replaces selections across multiple groups
       at once, so the preview groups its pill values per group with a
       short label prefix (e.g. "Style: Cinematic"). One chip per pill
       keeps visual styling identical to the preset preview chips. */
    if (btn.classList && btn.classList.contains('pmg-photo-recent-btn')) {
      var ri = parseInt(btn.getAttribute('data-recent-index'), 10);
      if (isNaN(ri)) return [];
      var combos = loadRecentCombos();
      var combo = combos[ri];
      if (!combo) return [];
      return recentComboPreviewLabels(combo);
    }
    var groupId = btn.getAttribute('data-group');
    var idx = parseInt(btn.getAttribute('data-preset-index'), 10);
    var preset = PRESETS[groupId];
    if (!preset || !preset.items || !preset.items[idx]) return [];
    return (preset.items[idx].values || []).slice();
  }

  /* Task #43: build the per-pill labels for a recent-combo preview.
     Walks the combo, resolves each preset entry (kind='preset') or
     each raw pick group (kind='raw'), and emits one labeled string
     per pill in the order the GROUPS catalog defines (so Style
     always appears before Lighting, etc.). Group label comes from
     the GROUPS catalog so wording stays in sync with the section
     headers (e.g. "Lighting & Mood"). */
  function recentComboPreviewLabels(combo) {
    var byGroup = {}; /* group id -> [pill, pill, ...] (de-duped) */
    var seen = {};   /* group id -> { pill: true } */
    function add(groupId, pill) {
      if (!groupId || !pill) return;
      if (!byGroup[groupId]) { byGroup[groupId] = []; seen[groupId] = {}; }
      if (seen[groupId][pill]) return;
      seen[groupId][pill] = true;
      byGroup[groupId].push(pill);
    }
    if (combo && combo.kind === 'raw' && combo.picks) {
      Object.keys(combo.picks).forEach(function (gid) {
        (combo.picks[gid] || []).forEach(function (v) { add(gid, v); });
      });
    } else {
      var entries = (combo && combo.kind === 'preset' && Array.isArray(combo.entries))
        ? combo.entries
        : (Array.isArray(combo) ? combo : []);
      entries.forEach(function (e) {
        var p = PRESETS[e && e.group];
        var item = p && p.items && p.items[e && e.idx];
        if (!item) return;
        (item.values || []).forEach(function (v) { add(e.group, v); });
      });
    }
    var out = [];
    GROUPS.forEach(function (g) {
      if (!byGroup[g.id]) return;
      byGroup[g.id].forEach(function (v) {
        out.push(g.label + ': ' + v);
      });
    });
    return out;
  }

  /* Task #34 / #43: shared wiring for hover/focus/long-press preview
     behavior. Used by both Quick-Style preset buttons and Recent
     Combo buttons so they get identical tooltip behavior. The button
     must already have data attributes that presetPreviewLabels()
     understands. */
  function wirePreviewHover(b) {
    /* Desktop: hover + keyboard focus reveal the preview. */
    b.addEventListener('mouseenter', function () {
      clearTimeout(presetTooltipState.hideTimer);
      showPresetPreview(b);
    });
    b.addEventListener('mouseleave', function () {
      clearTimeout(presetTooltipState.hideTimer);
      presetTooltipState.hideTimer = setTimeout(hidePresetPreview, 80);
    });
    b.addEventListener('focus', function () {
      clearTimeout(presetTooltipState.hideTimer);
      showPresetPreview(b);
    });
    b.addEventListener('blur', hidePresetPreview);

    /* Touch: brief long-press (~700ms) shows the preview and arms
       suppressClick so the action is NOT applied. A normal tap still
       applies because the timer never fires. */
    b.addEventListener('touchstart', function () {
      presetTooltipState.suppressClick = false;
      clearTimeout(presetTooltipState.longPressTimer);
      presetTooltipState.longPressTimer = setTimeout(function () {
        presetTooltipState.suppressClick = true;
        showPresetPreview(b);
      }, 700);
    }, { passive: true });
    var endTouch = function () {
      clearTimeout(presetTooltipState.longPressTimer);
      if (presetTooltipState.suppressClick) {
        clearTimeout(presetTooltipState.hideTimer);
        presetTooltipState.hideTimer = setTimeout(hidePresetPreview, 1600);
      }
    };
    b.addEventListener('touchend', endTouch);
    b.addEventListener('touchcancel', endTouch);
    b.addEventListener('touchmove', function () {
      clearTimeout(presetTooltipState.longPressTimer);
    }, { passive: true });
  }

  function showPresetPreview(btn) {
    var labels = presetPreviewLabels(btn);
    if (!labels.length) return;
    var t = getPresetTooltip();
    t.innerHTML =
      '<span class="pmg-photo-preset-tooltip-label">Will Apply:</span>' +
      labels.map(function (v) {
        return '<span class="pmg-photo-preset-tooltip-pill">' + escapeHtml(v) + '</span>';
      }).join('');

    /* Make visible first so getBoundingClientRect reports real size. */
    t.classList.add('is-visible');
    t.setAttribute('aria-hidden', 'false');

    var rect = btn.getBoundingClientRect();
    var tRect = t.getBoundingClientRect();
    var docEl = document.documentElement;
    var viewportW = docEl.clientWidth;
    var viewportH = docEl.clientHeight;
    var top = rect.top + window.pageYOffset - tRect.height - 10;
    var left = rect.left + window.pageXOffset + (rect.width / 2) - (tRect.width / 2);

    /* Clamp horizontally to viewport with a small gutter. */
    var minLeft = window.pageXOffset + 8;
    var maxLeft = window.pageXOffset + viewportW - tRect.width - 8;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    /* If there's no room above the button, place below instead. */
    if (rect.top - tRect.height - 10 < 8) {
      top = rect.bottom + window.pageYOffset + 10;
    }
    /* Clamp vertically as a last resort to keep within document. */
    var maxTop = window.pageYOffset + viewportH - tRect.height - 8;
    if (top > maxTop) top = maxTop;

    t.style.top = top + 'px';
    t.style.left = left + 'px';
    presetTooltipState.currentBtn = btn;
  }

  function hidePresetPreview() {
    clearTimeout(presetTooltipState.hideTimer);
    var t = document.getElementById(PRESET_TOOLTIP_ID);
    if (!t) return;
    t.classList.remove('is-visible');
    t.setAttribute('aria-hidden', 'true');
    presetTooltipState.currentBtn = null;
  }

  /* Task #25: apply a Quick-Style preset to a single group. Clears that
     group's currently-active pills, then activates exactly the pills
     named in the preset. Other groups are left untouched. Calls
     refreshSummary() so the live summary, count badges, Send button,
     and active-preset highlight all stay in sync. Also schedules a
     debounced save of the resulting preset combo for Task #31's
     Recent row. */
  function applyPreset(groupId, idx) {
    var preset = PRESETS[groupId];
    if (!preset || !preset.items || !preset.items[idx]) return;
    var item = preset.items[idx];

    /* Clear only this group's active pills — other groups untouched. */
    document.querySelectorAll(
      '#' + SUITE_ID + ' .pmg-photo-pill[data-group="' + groupId + '"].is-active'
    ).forEach(function (p) {
      p.classList.remove('is-active');
    });

    /* Activate the preset's pill values within this group. */
    (item.values || []).forEach(function (val) {
      var sel = '#' + SUITE_ID + ' .pmg-photo-pill' +
        '[data-group="' + groupId + '"]' +
        '[data-value="' + cssEscape(val) + '"]';
      var el = document.querySelector(sel);
      if (el) el.classList.add('is-active');
    });

    /* Task #38: applying a preset diverges from the last Surprise Me
       roll. (applyCombo and applySavedCombo go through clearAllPicks
       which already handles this; applyPreset does not.) */
    if (_surpriseFresh) setSurpriseFresh(false);
    refreshSummary();
    scheduleRecordCombo();
  }

  /* ---------------- Task #31: Recently-used preset combos ---------------
   * After any preset is applied, derive the current "preset combo" — the
   * set of groups whose active pills exactly match one of that group's
   * presets — and persist the most recent ones in localStorage. The
   * Recent row above the photo groups lets users re-apply a favorite
   * combo with a single tap.
   * --------------------------------------------------------------------- */

  /* Compute the current preset combo from active pills. Returns an
     ordered array of { group, idx } entries (one per group that exactly
     matches a preset). Group order follows GROUPS so combo identity is
     stable regardless of click sequence. */
  function getActivePresetCombo() {
    var picks = getSelections();
    var combo = [];
    GROUPS.forEach(function (g) {
      var preset = PRESETS[g.id];
      if (!preset || !preset.items) return;
      var groupPicks = (picks[g.id] || []).slice().sort();
      if (!groupPicks.length) return;
      for (var i = 0; i < preset.items.length; i++) {
        var vals = (preset.items[i].values || []).slice().sort();
        if (vals.length === groupPicks.length &&
            vals.every(function (v, j) { return v === groupPicks[j]; })) {
          combo.push({ group: g.id, idx: i });
          break;
        }
      }
    });
    return combo;
  }

  /* Resolve a combo (either kind) down to its picks-by-group object.
     Preset combos look up the current preset values via PRESETS;
     raw combos already store the values directly. Used as the input
     to picksFingerprint() so a preset combo and a raw combo that
     produce the same selection are treated as duplicates. */
  function comboPicks(combo) {
    var picks = {};
    GROUPS.forEach(function (g) { picks[g.id] = []; });
    if (!combo) return picks;
    if (combo.kind === 'raw' && combo.picks) {
      Object.keys(combo.picks).forEach(function (gid) {
        if (picks[gid] && Array.isArray(combo.picks[gid])) {
          picks[gid] = combo.picks[gid].slice();
        }
      });
      return picks;
    }
    var entries = (combo.kind === 'preset' && Array.isArray(combo.entries))
      ? combo.entries
      : (Array.isArray(combo) ? combo : []);
    entries.forEach(function (e) {
      var p = PRESETS[e.group];
      var item = p && p.items && p.items[e.idx];
      if (item && Array.isArray(item.values)) {
        picks[e.group] = item.values.slice();
      }
    });
    return picks;
  }

  /* Stable string identity derived from the resolved picks, so two
     combos that select the exact same pills dedupe regardless of
     which kind they are. Sorted within each group; group order
     follows GROUPS so identity is stable across click sequences. */
  function picksFingerprint(picks) {
    return GROUPS.map(function (g) {
      return g.id + ':' + ((picks[g.id] || []).slice().sort().join('|'));
    }).join('//');
  }

  function comboKey(combo) {
    return picksFingerprint(comboPicks(combo));
  }

  /* Human-readable label for a combo. Preset combos build the label
     from the matching preset names ("Cinematic + Golden Hour"). Raw
     combos (Task #38: surprise pins) carry their own pre-baked label. */
  function comboLabel(combo) {
    if (combo && combo.kind === 'raw') {
      return typeof combo.label === 'string' ? combo.label : '';
    }
    var entries = (combo && combo.kind === 'preset' && Array.isArray(combo.entries))
      ? combo.entries
      : (Array.isArray(combo) ? combo : []);
    var parts = entries.map(function (e) {
      var p = PRESETS[e.group];
      var item = p && p.items && p.items[e.idx];
      return item ? item.label : '';
    }).filter(Boolean);
    return parts.join(' + ');
  }

  /* Validate one parsed combo entry from localStorage. Accepts three
     shapes for backwards compatibility:
       1. legacy bare array  [{group,idx},...]   → wrap as preset
       2. {kind:'preset', entries:[{group,idx},...]}
       3. {kind:'raw', label, picks:{group:[val,...],...}}
     Stale entries (preset since removed, pill no longer in catalog)
     get their bad parts dropped; if nothing remains, the whole entry
     is rejected so the Recent row stays clean. */
  function normalizeRecentEntry(combo) {
    if (Array.isArray(combo)) {
      var entries = [];
      for (var i = 0; i < combo.length; i++) {
        var e = combo[i];
        if (!e || typeof e.group !== 'string' || typeof e.idx !== 'number') return null;
        var p = PRESETS[e.group];
        if (!p || !p.items || !p.items[e.idx]) return null;
        entries.push({ group: e.group, idx: e.idx });
      }
      if (!entries.length) return null;
      return { kind: 'preset', entries: entries };
    }
    if (!combo || typeof combo !== 'object') return null;
    if (combo.kind === 'preset') {
      return normalizeRecentEntry(Array.isArray(combo.entries) ? combo.entries : []);
    }
    if (combo.kind === 'raw') {
      var label = typeof combo.label === 'string' ? combo.label.slice(0, 80) : '';
      if (!label) return null;
      var pickGroupIds = {};
      GROUPS.forEach(function (g) { pickGroupIds[g.id] = {}; g.pills.forEach(function (v) { pickGroupIds[g.id][v] = true; }); });
      var cleanPicks = {};
      var hasAny = false;
      var src = combo.picks && typeof combo.picks === 'object' ? combo.picks : {};
      Object.keys(src).forEach(function (gid) {
        if (!pickGroupIds[gid]) return; /* group whitelist — avoids selector injection */
        var arr = Array.isArray(src[gid]) ? src[gid] : [];
        var clean = [];
        arr.forEach(function (v) {
          if (typeof v === 'string' && pickGroupIds[gid][v]) clean.push(v);
        });
        if (clean.length) { cleanPicks[gid] = clean; hasAny = true; }
      });
      if (!hasAny) return null;
      return { kind: 'raw', label: label, picks: cleanPicks };
    }
    return null;
  }

  function loadRecentCombos() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      var out = [];
      parsed.forEach(function (combo) {
        var clean = normalizeRecentEntry(combo);
        if (clean) out.push(clean);
      });
      return out.slice(0, RECENT_MAX);
    } catch (e) { return []; }
  }

  function saveRecentCombos(combos) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(combos.slice(0, RECENT_MAX)));
    } catch (e) {}
  }

  /* Record the current combo at most once per debounce window. Build-up
     sequences (e.g. tap Cinematic → tap Golden Hour → tap Rule Of Thirds)
     collapse to a single saved combo containing the final state. A
     pagehide listener (registered once in init) flushes any pending
     timer so a user who applies a preset and immediately reloads or
     navigates away still has the latest combo persisted. */
  var _recordTimer = null;
  function scheduleRecordCombo() {
    if (_recordTimer) clearTimeout(_recordTimer);
    _recordTimer = setTimeout(function () {
      _recordTimer = null;
      recordCurrentCombo();
    }, 1500);
  }

  function flushPendingRecord() {
    if (!_recordTimer) return;
    clearTimeout(_recordTimer);
    _recordTimer = null;
    try { recordCurrentCombo(); } catch (e) {}
  }

  /* True when `big` contains every (group, idx) entry in `small` and has
     strictly more entries — i.e. `small` is a strict subset of `big`.
     Both inputs are bare {group,idx} arrays as returned by
     getActivePresetCombo (NOT tagged combo objects). */
  function isStrictSuperset(big, small) {
    if (!small.length || small.length >= big.length) return false;
    return small.every(function (e) {
      return big.some(function (b) {
        return b.group === e.group && b.idx === e.idx;
      });
    });
  }

  /* Helper: extract the bare {group,idx}[] entries from a tagged
     preset combo, or empty array for raw combos. Used by the
     superset check below — surprise pins skip the superset
     "build-up" optimization since they aren't preset-shaped. */
  function presetEntriesOf(combo) {
    if (combo && combo.kind === 'preset' && Array.isArray(combo.entries)) {
      return combo.entries;
    }
    return [];
  }

  function recordCurrentCombo() {
    var entries = getActivePresetCombo();
    if (!entries.length) return;
    var combo = { kind: 'preset', entries: entries };
    var key = comboKey(combo);
    var existing = loadRecentCombos();
    var startIdx = 0;
    /* If the user is "building up" a preset combo from the previously-
       saved one (same entries plus more), replace the previous entry
       instead of pushing a new one. Avoids cluttering Recent with
       intermediate states like {Cinematic} → {Cinematic+Golden Hour}.
       Only applies when both top entries are preset combos. */
    var topPrev = presetEntriesOf(existing[0]);
    if (topPrev.length && isStrictSuperset(entries, topPrev)) {
      startIdx = 1;
    }
    var filtered = existing.slice(startIdx).filter(function (c) {
      return comboKey(c) !== key;
    });
    filtered.unshift(combo);
    saveRecentCombos(filtered);
    renderRecentRow();
  }

  /* Apply a Recent combo: clear all picks first so the result matches
     the combo exactly (no leftover manual pills lingering from
     before), then either replay each preset (preset combo) or
     activate raw pill values (Task #38: surprise pin). For preset
     combos, applyPreset will reschedule a record, which is fine —
     it'll dedupe and bump this combo to the top. For raw combos
     we don't reschedule a record because the auto-tracker is
     preset-only. */
  function applyCombo(combo) {
    if (!combo) return;
    /* Backwards-compat: a stray bare array slipped through normalize? */
    if (Array.isArray(combo)) combo = { kind: 'preset', entries: combo };
    clearAllPicks();
    if (combo.kind === 'raw' && combo.picks) {
      var applied = 0;
      Object.keys(combo.picks).forEach(function (gid) {
        (combo.picks[gid] || []).forEach(function (val) {
          var sel = '#' + SUITE_ID + ' .pmg-photo-pill' +
            '[data-group="' + gid + '"]' +
            '[data-value="' + cssEscape(val) + '"]';
          try {
            var el = document.querySelector(sel);
            if (el) { el.classList.add('is-active'); applied++; }
          } catch (e) { /* skip silently — gid is whitelisted in load */ }
        });
      });
      refreshSummary();
      showToast(applied ? 'Surprise re-applied!' : 'Combo has no usable picks anymore.');
      return;
    }
    /* Preset combo. */
    var entries = presetEntriesOf(combo);
    entries.forEach(function (e) { applyPreset(e.group, e.idx); });
    showToast('Recent combo applied!');
  }

  function clearRecentCombos() {
    try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    renderRecentRow();
    showToast('Recent presets cleared.');
  }

  function renderRecentRow() {
    var row = document.getElementById(RECENT_ROW_ID);
    if (!row) return;
    var combos = loadRecentCombos();
    if (!combos.length) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    var html = ['<span class="pmg-photo-recent-label">Recent:</span>'];
    combos.forEach(function (combo, i) {
      var label = comboLabel(combo);
      if (!label) return;
      html.push(
        '<button type="button" class="pmg-photo-recent-btn" ' +
          'data-recent-index="' + i + '" ' +
          'aria-label="Re-apply ' + escapeHtml(label) + '">' +
          escapeHtml(label) +
        '</button>'
      );
    });
    html.push(
      '<button type="button" class="pmg-photo-recent-clear" ' +
        'aria-label="Clear recent presets">Clear</button>'
    );
    row.innerHTML = html.join('');
    row.hidden = false;
    /* Task #43: re-wire hover/focus/long-press preview on each newly
       rendered combo button. Apply (one-tap) is still handled by the
       delegated click listener on the row container. */
    row.querySelectorAll('.pmg-photo-recent-btn').forEach(wirePreviewHover);
  }

  /* Task #57: expose renderRecentRow so pmg-handoff.js can refresh
     the row after writing a Surprise roll directly to localStorage,
     instead of duplicating the template (which previously dropped
     non-raw entries). */
  try { window.__pmgPhotoRefreshRecent = renderRecentRow; } catch (_) {}
  /* Task #58: expose refreshSummary so pmg-suggestions.js can keep
     the live summary + count badges + Send button enabled-state in
     sync after toggling a pill's negative (.is-negative) status,
     which it does via stopImmediatePropagation in capture phase
     and therefore bypasses the bubble-phase pill listener that
     would normally call refreshSummary. */
  try { window.__pmgPhotoRefreshSummary = refreshSummary; } catch (_) {}

  /* ---------------- Task #35: User-saved (My Combos) -------------------
   * Power users often build their own favorite combinations that don't
   * match any curated preset. The Save This Combo button captures the
   * current selection (raw pill values across all groups), prompts for
   * a short name, and persists it in localStorage. Saved combos appear
   * in their own row above the Recent row and can be re-applied with
   * one click or removed with a small ×.
   *
   * Storage shape:
   *   { name: string, picks: { groupId: [pillValue, ...] } }
   *
   * Storing raw pill values (not preset indices) means a saved combo:
   *   - can mix preset picks with manual picks
   *   - survives any future change to the curated preset roster
   *   - is straightforward to validate against the GROUPS catalog
   * ------------------------------------------------------------------- */

  function loadSavedCombos() {
    try {
      var raw = localStorage.getItem(SAVED_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      /* Validate entries:
         - name: non-empty trimmed string (capped at SAVED_NAME_MAX)
         - picks: object whose KEYS must be a known GROUPS id (a malformed
           or hostile gid would otherwise be interpolated straight into a
           CSS selector inside applySavedCombo and could throw a
           SyntaxError, leaving the suite in a half-cleared state).
           Pills are kept verbose-tolerant: invalid pill values are
           silently dropped on apply via the querySelector-returns-null
           path, but invalid GROUP keys are dropped here. */
      var validGroupIds = {};
      GROUPS.forEach(function (g) { validGroupIds[g.id] = true; });
      var out = [];
      parsed.forEach(function (c) {
        if (!c || typeof c.name !== 'string') return;
        var name = c.name.trim();
        if (!name) return;
        var picks = (c.picks && typeof c.picks === 'object') ? c.picks : {};
        var clean = {};
        Object.keys(picks).forEach(function (gid) {
          if (!validGroupIds[gid]) return;
          if (!Array.isArray(picks[gid])) return;
          clean[gid] = picks[gid].filter(function (v) { return typeof v === 'string'; });
        });
        out.push({ name: name.slice(0, SAVED_NAME_MAX), picks: clean });
      });
      return out.slice(0, SAVED_MAX);
    } catch (e) { return []; }
  }

  function saveSavedCombos(combos) {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(combos.slice(0, SAVED_MAX)));
      return true;
    } catch (e) { return false; }
  }

  /* Read current selections, prompt for a name, and persist. Idempotent
     name resolution: if the user picks an existing name (case-insensitive)
     we ask whether to overwrite — a quiet 'no' aborts without changing
     anything. */
  function saveCurrentAsCombo() {
    var picks = getSelections();
    var hasAny = Object.keys(picks).some(function (k) { return picks[k].length > 0; });
    if (!hasAny) {
      showToast('Pick at least one option first.');
      return;
    }
    /* Suggest a default name from the active preset combo if any (e.g.
       "Cinematic + Golden Hour"); otherwise just leave it blank. */
    var suggested = '';
    try {
      var combo = getActivePresetCombo();
      if (combo && combo.length) suggested = comboLabel(combo);
    } catch (e) {}
    var raw = window.prompt('Name this combo:', suggested);
    if (raw === null) return; /* user cancelled */
    var name = String(raw).trim().slice(0, SAVED_NAME_MAX);
    if (!name) {
      showToast('Combo name can\u2019t be empty.');
      return;
    }
    var existing = loadSavedCombos();
    var lower = name.toLowerCase();
    var dupeIdx = -1;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].name.toLowerCase() === lower) { dupeIdx = i; break; }
    }
    if (dupeIdx !== -1) {
      var ok = window.confirm('"' + name + '" already exists. Overwrite it?');
      if (!ok) return;
      existing.splice(dupeIdx, 1);
    }
    existing.unshift({ name: name, picks: picks });
    var saved = saveSavedCombos(existing);
    if (!saved) {
      showToast('Couldn\u2019t save (storage blocked).');
      return;
    }
    renderSavedRow();
    showToast('Saved as \u201C' + name + '\u201D.');
  }

  function applySavedCombo(idx) {
    var combos = loadSavedCombos();
    var combo = combos[idx];
    if (!combo) return;
    /* Clear all picks first so the result matches the saved combo
       exactly — no leftover manual pills lingering from before. */
    clearAllPicks();
    var applied = 0;
    Object.keys(combo.picks || {}).forEach(function (gid) {
      /* gid is whitelisted in loadSavedCombos against GROUPS ids, so it
         is safe to interpolate into a selector. cssEscape on the pill
         value handles characters like quotes, ampersands, and apostrophes
         (e.g. "Bird's-Eye View"). The try/catch is a belt-and-suspenders
         guard so a single malformed entry can never abort the whole
         apply loop. */
      (combo.picks[gid] || []).forEach(function (val) {
        var sel = '#' + SUITE_ID + ' .pmg-photo-pill' +
          '[data-group="' + gid + '"]' +
          '[data-value="' + cssEscape(val) + '"]';
        try {
          var el = document.querySelector(sel);
          if (el) { el.classList.add('is-active'); applied++; }
        } catch (e) { /* skip silently */ }
      });
    });
    refreshSummary();
    if (applied === 0) {
      showToast('Combo has no usable picks anymore.');
    } else {
      showToast('Combo \u201C' + combo.name + '\u201D applied!');
    }
  }

  function deleteSavedCombo(idx) {
    var combos = loadSavedCombos();
    var combo = combos[idx];
    if (!combo) return;
    combos.splice(idx, 1);
    var ok = saveSavedCombos(combos);
    if (!ok) {
      /* Storage write failed (quota / private mode). Don't lie to the
         user — the chip is still in localStorage and will reappear on
         next render. */
      showToast('Couldn\u2019t remove (storage blocked).');
      return;
    }
    renderSavedRow();
    showToast('Removed \u201C' + combo.name + '\u201D.');
  }

  function renderSavedRow() {
    var row = document.getElementById(SAVED_ROW_ID);
    if (!row) return;
    var combos = loadSavedCombos();
    if (!combos.length) {
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    var html = ['<span class="pmg-photo-saved-label">My Combos:</span>'];
    combos.forEach(function (combo, i) {
      var name = combo.name || '';
      if (!name) return;
      html.push(
        '<span class="pmg-photo-saved-chip">' +
          '<button type="button" class="pmg-photo-saved-btn" ' +
            'data-saved-index="' + i + '" ' +
            'aria-label="Apply combo ' + escapeHtml(name) + '">' +
            escapeHtml(name) +
          '</button>' +
          '<button type="button" class="pmg-photo-saved-delete" ' +
            'data-saved-index="' + i + '" ' +
            'aria-label="Delete combo ' + escapeHtml(name) + '">\u00d7</button>' +
        '</span>'
      );
    });
    row.innerHTML = html.join('');
    row.hidden = false;
  }

  /* Task #38: tracks whether the current pill state was produced by the
     last Surprise Me click and hasn't been touched since. Used to decide
     whether to show the "Pin This Surprise" CTA — once the user diverges
     (clicks a pill, applies a preset, clears, applies a saved combo,
     etc.) the offer disappears. */
  var _surpriseFresh = false;

  function setSurpriseFresh(active) {
    _surpriseFresh = !!active;
    var btn = document.querySelector('#' + SUITE_ID + ' .pmg-photo-pin-surprise');
    if (btn) btn.hidden = !_surpriseFresh;
  }

  function surpriseMe() {
    /* clearAllPicks resets the surprise-fresh flag — that's fine, we
       set it back true at the end so the offer appears for THIS roll. */
    clearAllPicks();
    GROUPS.forEach(function (g) {
      /* Pick 1 or 2 random pills per group. */
      var n = Math.random() < 0.4 ? 2 : 1;
      var pool = g.pills.slice();
      for (var i = 0; i < n && pool.length > 0; i++) {
        var idx = Math.floor(Math.random() * pool.length);
        var val = pool.splice(idx, 1)[0];
        var sel = '#' + SUITE_ID + ' .pmg-photo-pill[data-group="' + g.id + '"][data-value="' + cssEscape(val) + '"]';
        var el = document.querySelector(sel);
        if (el) el.classList.add('is-active');
      }
    });
    refreshSummary();
    setSurpriseFresh(true);
    showToast('Surprise picks applied! Pin to keep this look.');
  }

  /* Task #38: build the auto-generated label for a pinned surprise.
     "Surprise: <pill1>, <pill2>, ..." — capped at SURPRISE_LABEL_VALUES
     pill values across groups in GROUPS order, with a single trailing
     "…" when there are more. Returns null if no pills are active. */
  function buildSurpriseLabel(picks) {
    var values = [];
    GROUPS.forEach(function (g) {
      (picks[g.id] || []).forEach(function (v) { values.push(v); });
    });
    if (!values.length) return null;
    var shown = values.slice(0, SURPRISE_LABEL_VALUES);
    var suffix = values.length > SURPRISE_LABEL_VALUES ? ', \u2026' : '';
    return 'Surprise: ' + shown.join(', ') + suffix;
  }

  /* Task #38: persist the current pill set (whatever it is) into the
     Recent row as a raw combo. Called from the Pin This Surprise
     button. Uses the same RECENT_KEY + RECENT_MAX cap as preset
     combos, dedupes against existing entries via picksFingerprint
     (so pinning a surprise that happens to match a Recent preset
     combo just bumps that entry to the top instead of duplicating). */
  function pinCurrentSurprise() {
    /* Defense-in-depth: only honor a click when the current pill state
       genuinely IS the most-recent Surprise Me roll. Belt-and-
       suspenders against the button being shown by something other
       than surpriseMe() — without this, a stale Pin click could
       persist a user-edited state under a misleading "Surprise:"
       label. The dismissal hooks (pill click, applyPreset, clear,
       etc.) already hide the button, so the normal flow stays clean. */
    if (!_surpriseFresh) return;
    var picks = getSelections();
    var label = buildSurpriseLabel(picks);
    if (!label) { showToast('Pick at least one option first.'); return; }
    /* Strip empty groups before persisting — keeps storage compact
       and lines up with how loadRecentCombos validates raw entries. */
    var cleanPicks = {};
    Object.keys(picks).forEach(function (gid) {
      if (picks[gid] && picks[gid].length) cleanPicks[gid] = picks[gid].slice();
    });
    var combo = { kind: 'raw', label: label, picks: cleanPicks };
    var key = comboKey(combo);
    var existing = loadRecentCombos();
    var filtered = existing.filter(function (c) { return comboKey(c) !== key; });
    filtered.unshift(combo);
    saveRecentCombos(filtered);
    renderRecentRow();
    setSurpriseFresh(false);
    showToast('Surprise pinned to Recent!');
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["'\\]/g, '\\$&');
  }

  function sendToImageGenerator() {
    var picks = getSelections();
    var photoText = buildPromptText(picks);
    if (!photoText) { showToast('Pick at least one option first.'); return; }

    /* Task #38: sending consumes the surprise — the user has moved on
       from "should I keep these picks?" to "render them now". Dismiss
       the Pin CTA so it doesn't keep nagging across the image flow. */
    if (_surpriseFresh) setSurpriseFresh(false);

    /* Build the final prompt. Use the user's existing builder goal as
       the subject (if present), otherwise a friendly default. */
    var goal = document.getElementById('goal');
    var subject = (goal && goal.value && goal.value.trim()) ? goal.value.trim() : 'A striking photograph';
    var finalPrompt = subject + ' — ' + photoText + '.';

    /* Populate the canonical image-mode goal field. */
    if (goal) {
      goal.value = finalPrompt;
      try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }

    /* Switch into image mode if the helper exists. */
    if (typeof window.setMode === 'function') {
      try { window.setMode('image'); } catch (e) {}
    }

    /* Reveal the relocated image generator section. */
    var host = document.getElementById(IMG_GEN_HOST_ID);
    if (host) host.style.display = 'block';
    var imgSec = document.getElementById('imageResultSection');
    if (imgSec) {
      imgSec.hidden = false;
      imgSec.removeAttribute('hidden');
    }

    /* Fire the existing pipeline. */
    if (typeof window.generateImage === 'function') {
      try { window.generateImage(); } catch (e) {}
    } else if (typeof window.runImageGeneration === 'function') {
      try { window.runImageGeneration(); } catch (e) {}
    } else {
      var btn = document.getElementById('image-generate-btn') || document.getElementById('imageBtn');
      if (btn) btn.click();
    }

    /* Scroll the user down to the image section. */
    setTimeout(function () {
      var target = document.getElementById(IMG_GEN_HOST_ID) || document.getElementById('imageResultSection');
      if (target) {
        try { target.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
      }
    }, 200);

    showToast('Sending to image generator…');
  }

  /* -------------------- Image Generator section --------------------- */
  function buildImageGeneratorSection() {
    if (document.getElementById(IMG_GEN_HOST_ID)) return;
    var imgSec = document.getElementById('imageResultSection');
    if (!imgSec) return;

    var section = document.createElement('section');
    section.className = 'app-section pmg-stack-section';
    section.id = IMG_GEN_HOST_ID;
    section.setAttribute('aria-labelledby', IMG_GEN_HOST_ID + '-title');

    var container = document.createElement('div');
    container.className = 'container';
    var card = document.createElement('div');
    card.className = 'pmg-stack-card';

    var head = document.createElement('div');
    head.className = 'pmg-stack-card-head';
    head.innerHTML =
      '<span class="pmg-eyebrow">Step 3</span>' +
      '<h2 id="' + IMG_GEN_HOST_ID + '-title">🖼️ Image Generator</h2>';
    card.appendChild(head);

    var helper = document.createElement('p');
    helper.className = 'pmg-stack-helper';
    helper.textContent = 'Your generated image will appear here. Download it, regenerate for a fresh take, or save the URL as a reference.';
    card.appendChild(helper);

    /* Move the existing imageResultSection into our card. */
    card.appendChild(imgSec);
    /* Force visible. */
    imgSec.removeAttribute('hidden');
    imgSec.style.display = 'block';
    container.appendChild(card);
    section.appendChild(container);

    /* Insert after the photo suite section. */
    var photoSection = document.getElementById('photo-suite-section');
    var anchor = photoSection || document.getElementById('builder');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
    } else {
      document.body.appendChild(section);
    }

    /* Add the Use As Reference button if not already present. */
    addUseAsReferenceButton();
  }

  function addUseAsReferenceButton() {
    var actions = document.querySelector('#imageResultSection .image-result-actions');
    if (!actions || actions.querySelector('.pmg-use-as-ref-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary pmg-use-as-ref-btn';
    btn.innerHTML = '<span aria-hidden="true">🔗</span> Use As Reference';
    btn.addEventListener('click', function () {
      var img = document.querySelector('#imageResultWrap img');
      if (!img || !img.src) {
        showToast('Generate an image first.');
        return;
      }
      var url = img.src;
      function done(ok) {
        showToast(ok ? 'Image URL copied to clipboard!' : 'Could not copy. Try again.');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = url; document.body.appendChild(ta); ta.select();
          var ok = document.execCommand('copy'); document.body.removeChild(ta);
          done(!!ok);
        } catch (e) { done(false); }
      }
    });
    actions.appendChild(btn);
  }

  /* ----------------------------- Init ------------------------------- */
  function init() {
    injectStyles();
    buildSuite();
    buildImageGeneratorSection();

    /* Task #31: persist any pending Recent-combo save before the page is
       hidden / unloaded, so a user who applies a preset and reloads
       within the 1.5s debounce window doesn't lose the entry. pagehide
       fires reliably across navigation, tab close, and bfcache; the
       visibilitychange fallback covers mobile background tab switches. */
    try {
      window.addEventListener('pagehide', flushPendingRecord);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushPendingRecord();
      });
    } catch (e) { /* ignore */ }

    /* Late-mount safety: a body-level observer keeps trying to (a) build
       the photo suite section, (b) relocate the image generator into our
       host card, and (c) keep the Use-As-Reference button mounted. The
       individual builders are themselves idempotent (existence checks at
       the top), so calling them repeatedly is cheap. The observer is
       short-lived to avoid lingering work after page settles. */
    try {
      var bodyObs = new MutationObserver(function () {
        if (!document.getElementById(SUITE_ID)) buildSuite();
        if (!document.getElementById(IMG_GEN_HOST_ID)) buildImageGeneratorSection();
        addUseAsReferenceButton();
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { bodyObs.disconnect(); } catch (e) {} }, 120000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T24 — Density + Help Me Start promotion.
 *
 * User feedback after Phase C: the page is a touch busy with all five
 * Photography Suite groups expanded by default, and the 4-question
 * guided flow ("Help Me Start") should be promoted as the secondary-
 * but-most-recommended path on the builder.
 *
 * This block:
 *   1. Collapses every Photography Suite group EXCEPT the first one
 *      (Style) on first paint. User can still expand any group by
 *      clicking its header — the existing toggle wiring is preserved.
 *   2. Restyles the existing #pmg-help-me-start-btn with a soft warm
 *      highlight, an inset "✨ Most Loved" pill badge, and a clearer
 *      label that frames it as the recommended path. Stays a secondary
 *      action (does not steal click-emphasis from the primary Fix My
 *      Prompt button); just visually approved-and-recommended.
 *
 * No new IDs/classes renamed; we add presentation-only classes and
 * decorate via CSS variables.
 * ===================================================================== */
(function pmgT24DensityPlusHelpMeStart() {
  if (window.__pmgT24Init) return;
  window.__pmgT24Init = true;

  var STYLE_ID = 'pmg-t24-density-style';
  var HMS_BADGE_CLASS = 'pmg-hms-most-loved';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== Help Me Start: Most Loved promotion =====
         The button keeps its existing #pmg-help-me-start-btn id, so all
         existing click wiring (delegating to #guided-mode-btn) keeps
         working. We only repaint and prepend a badge. */
      '#pmg-help-me-start-btn.pmg-help-me-start-btn {',
      '  position: relative;',
      '  background: linear-gradient(135deg,',
      '    color-mix(in srgb, var(--color-primary) 12%, var(--color-surface)),',
      '    color-mix(in srgb, var(--color-primary) 4%, var(--color-surface))) !important;',
      '  border: 1.5px solid color-mix(in srgb, var(--color-primary) 45%, var(--color-border)) !important;',
      '  color: var(--color-text) !important;',
      '  font-weight: 700 !important;',
      '  border-radius: var(--radius-lg) !important;',
      '  padding: 14px 18px !important;',
      '  min-height: 56px !important;',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  gap: 10px;',
      '  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-primary) 15%, transparent);',
      '  transition: transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease;',
      '}',
      '#pmg-help-me-start-btn.pmg-help-me-start-btn:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '  border-color: var(--color-primary) !important;',
      '}',
      /* The Most Loved corner badge. */
      '.' + HMS_BADGE_CLASS + ' {',
      '  position: absolute;',
      '  top: -10px; right: 14px;',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  background: linear-gradient(135deg, #f5b400, #e88a00);',
      '  color: #fff;',
      '  font-size: 10px; font-weight: 800; letter-spacing: 0.06em;',
      '  text-transform: uppercase;',
      '  padding: 4px 10px;',
      '  border-radius: var(--radius-full);',
      '  box-shadow: 0 2px 6px rgba(232, 138, 0, 0.35);',
      '  white-space: nowrap;',
      '  pointer-events: none;',
      '}',
      '.' + HMS_BADGE_CLASS + '::before { content: "✨"; font-size: 11px; }',
      /* Tiny helper line under the button. */
      '#pmg-hms-helper {',
      '  display: block;',
      '  text-align: center;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  margin: 4px 0 0;',
      '  font-style: italic;',
      '}',
      'body.image-mode #pmg-hms-helper { display: none; }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Collapse all Photography Suite groups except the first (Style). */
  function collapsePhotoGroups() {
    var groups = document.querySelectorAll('#pmg-photo-suite .pmg-photo-group');
    if (!groups.length) return false;
    groups.forEach(function (g, i) {
      if (i === 0) return; /* keep Style open */
      if (!g.classList.contains('is-collapsed')) {
        g.classList.add('is-collapsed');
        var head = g.querySelector('.pmg-photo-group-head');
        if (head) head.setAttribute('aria-expanded', 'false');
      }
    });
    return true;
  }

  /* Decorate the existing Help Me Start button with the badge + helper. */
  function decorateHelpMeStart() {
    var btn = document.getElementById('pmg-help-me-start-btn');
    if (!btn) return false;
    /* Update the visible label to better frame the recommendation,
       while keeping the original emoji style. */
    if (!btn.dataset.pmgT24Labeled) {
      btn.textContent = '💡 Help Me Start (Answer 4 Quick Questions)';
      btn.dataset.pmgT24Labeled = '1';
    }
    /* Add the corner badge once. */
    if (!btn.querySelector('.' + HMS_BADGE_CLASS)) {
      var badge = document.createElement('span');
      badge.className = HMS_BADGE_CLASS;
      badge.textContent = 'Most Loved';
      badge.setAttribute('aria-hidden', 'true');
      btn.appendChild(badge);
    }
    /* Add a tiny italic helper directly beneath the button. */
    if (!document.getElementById('pmg-hms-helper') && btn.parentNode) {
      var help = document.createElement('p');
      help.id = 'pmg-hms-helper';
      help.textContent = 'Recommended for the best results — guided in under a minute.';
      btn.parentNode.insertBefore(help, btn.nextSibling);
    }
    return true;
  }

  function tick() {
    collapsePhotoGroups();
    decorateHelpMeStart();
  }

  function init() {
    injectStyles();
    tick();
    /* Late-mount safety: photo suite + help me start button are both
       built by other IIFEs, possibly after us. Watch the body briefly. */
    try {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T25 — Marketing sections: collapsed-with-labels.
 *
 * User feedback: "Collapse with labels" — the below-the-fold marketing
 * sections (Popular Use Cases, Why Prompts Fail, How It Works, Early
 * Feedback, See The Difference) take up a lot of vertical space and
 * push the active app workspaces around. Solution: convert each
 * .pmg-marketing-section into a click-to-expand row that shows only
 * the section's title + a chevron. Default state is collapsed.
 *
 * Implementation:
 *   - Wrap each section's first heading in a clickable button that
 *     toggles a .pmg-mkt-collapsed class on the section.
 *   - CSS hides every direct child except the heading container when
 *     collapsed.
 *   - All anchors keep working: clicking a hash link (e.g. from the
 *     top nav or footer) auto-expands the matching section.
 *
 * No HTML edits, no class renames, no JS hooks broken.
 * ===================================================================== */
(function pmgT25CollapseMarketing() {
  if (window.__pmgT25Init) return;
  window.__pmgT25Init = true;

  var STYLE_ID = 'pmg-t25-marketing-collapse-style';
  var COLLAPSED = 'pmg-mkt-collapsed';
  var WIRED = 'data-pmg-t25-wired';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Compact the section padding when collapsed. */
      '.pmg-marketing-section.' + COLLAPSED + ' { padding-top: 0 !important; padding-bottom: 0 !important; }',
      '.pmg-marketing-section.' + COLLAPSED + ' > * { display: none !important; }',
      '.pmg-marketing-section.' + COLLAPSED + ' > .pmg-mkt-toggle-wrap { display: block !important; }',

      /* Toggle wrapper sits flush with neighbors and takes minimal room. */
      '.pmg-mkt-toggle-wrap {',
      '  max-width: 880px; margin: 0 auto; padding: 0 var(--space-4);',
      '}',
      '.pmg-mkt-toggle-btn {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  width: 100%; padding: 14px 18px; margin: 8px 0;',
      '  background: var(--color-surface);',
      '  border: 1px solid var(--color-border);',
      '  border-radius: var(--radius-md);',
      '  color: var(--color-text);',
      '  font-size: var(--text-base); font-weight: 600;',
      '  text-align: left; cursor: pointer;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;',
      '}',
      '.pmg-mkt-toggle-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));',
      '  color: var(--color-primary);',
      '}',
      '.pmg-mkt-toggle-icon {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 24px; height: 24px; margin-left: 12px;',
      '  color: var(--color-text-muted);',
      '  transition: transform 200ms ease, color 160ms ease;',
      '}',
      '.pmg-marketing-section:not(.' + COLLAPSED + ') .pmg-mkt-toggle-icon { transform: rotate(180deg); color: var(--color-primary); }',
      '.pmg-mkt-toggle-label-prefix {',
      '  display: inline-block; margin-right: 8px;',
      '  font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.06em;',
      '  text-transform: uppercase; color: var(--color-text-muted);',
      '}',
      '.pmg-marketing-section:not(.' + COLLAPSED + ') .pmg-mkt-toggle-btn {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));',
      '  color: var(--color-primary);',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Friendly label per section id. Keep short — appears as the row label. */
  var LABELS = {
    'why-prompts-fail': { prefix: 'Insight',   label: 'Why Most AI Prompts Fail' },
    'how-it-works':     { prefix: 'Guide',     label: 'How It Works' },
    'early-feedback':   { prefix: 'Reviews',   label: 'Real People. First Tries. Real Results.' },
    'see-the-difference': { prefix: 'Compare', label: 'See The Difference' }
  };

  function findSectionTitle(section) {
    var titledById = section.getAttribute('aria-labelledby');
    if (titledById) {
      var t = document.getElementById(titledById);
      if (t && t.textContent && t.textContent.trim()) return t.textContent.trim();
    }
    var h = section.querySelector('h1, h2');
    if (h && h.textContent && h.textContent.trim()) return h.textContent.trim();
    return null;
  }

  function buildToggle(section) {
    if (section.getAttribute(WIRED) === '1') return;
    var sid = section.id || '';
    var meta = LABELS[sid] || {};
    var label = meta.label || findSectionTitle(section) || 'More';
    var prefix = meta.prefix || 'Section';

    var wrap = document.createElement('div');
    wrap.className = 'pmg-mkt-toggle-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-mkt-toggle-btn';
    btn.setAttribute('aria-expanded', 'false');
    if (sid) btn.setAttribute('aria-controls', sid);
    btn.innerHTML =
      '<span><span class="pmg-mkt-toggle-label-prefix">' + escapeHtml(prefix) + '</span>' +
      '<span class="pmg-mkt-toggle-label">' + escapeHtml(label) + '</span></span>' +
      '<span class="pmg-mkt-toggle-icon" aria-hidden="true">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 12 15 18 9"></polyline></svg></span>';

    btn.addEventListener('click', function () {
      var nowCollapsed = section.classList.toggle(COLLAPSED);
      btn.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
      if (!nowCollapsed) {
        /* Smoothly bring the expanded content into view. */
        try { section.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
      }
    });

    wrap.appendChild(btn);
    /* Insert toggle as the first child so CSS can show only it when collapsed. */
    section.insertBefore(wrap, section.firstChild);
    section.classList.add(COLLAPSED);
    section.setAttribute(WIRED, '1');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function wireAll() {
    document.querySelectorAll('section.pmg-marketing-section').forEach(buildToggle);
  }

  /* Auto-expand the matching section when an in-page anchor is followed. */
  function expandFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var sec = document.getElementById(h);
    if (sec && sec.classList.contains('pmg-marketing-section') && sec.classList.contains(COLLAPSED)) {
      sec.classList.remove(COLLAPSED);
      var btn = sec.querySelector('.pmg-mkt-toggle-btn');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  }

  function interceptAnchorClicks() {
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var id = href.replace(/^#/, '');
      if (!id) return;
      var sec = document.getElementById(id);
      if (sec && sec.classList.contains('pmg-marketing-section') && sec.classList.contains(COLLAPSED)) {
        sec.classList.remove(COLLAPSED);
        var btn = sec.querySelector('.pmg-mkt-toggle-btn');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
    }, true);
  }

  function init() {
    injectStyles();
    wireAll();
    expandFromHash();
    interceptAnchorClicks();
    window.addEventListener('hashchange', expandFromHash);
    /* Late-mount safety. */
    try {
      var mo = new MutationObserver(wireAll);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * T27 — Unified Photo Flow
 * ---------------------------------------------------------------------
 * The user complained that "Photography Suite" and "Create An Image"
 * were two separate functions when conceptually they are the same
 * workflow with two different final outcomes:
 *   1) Build a detailed photo prompt and EXPORT it (copy to use in
 *      Midjourney / Stable Diffusion / ChatGPT / etc.)
 *   2) Build a detailed photo prompt and GENERATE the image in-house
 *      with DALL·E 3.
 *
 * What this phase does (no IDs, classes, or JS variables are renamed):
 *   - Hides the now-redundant "Write Something / Create An Image"
 *     mode-switch tabs at the top of the builder. The Photography
 *     Suite below becomes the canonical photo entry point.
 *   - Hides the standalone "🎨 Generate Image" button (#image-generate-btn)
 *     that lived in the top builder's actions row — the suite owns this
 *     action now.
 *   - Hides the legacy image-mode-only photo widgets that earlier
 *     phases injected into the top builder (pmg-photo-assistant,
 *     #pmg-photo-accordion, #pmg-build-image-btn). They duplicate the
 *     suite. They stay in the DOM and keep their IDs/classes — only
 *     visually hidden via CSS so anchors and JS don't break.
 *   - Forces the page out of image-mode at startup so returning
 *     visitors land in the canonical text-prompt builder.
 *   - Adds a brand-new "📋 Copy Prompt" outcome button to the
 *     Photography Suite alongside the existing send button. The
 *     existing send button keeps its class (.pmg-photo-send) but its
 *     visible label is reframed to "🎨 Generate Image Here".
 *   - Adds an outcome label above the action row so the choice is
 *     obvious: "What Do You Want To Do?" with subcopy.
 *   - Mirrors the disabled/enabled state of the send button onto the
 *     copy button (both require at least one pick).
 * ===================================================================== */
(function pmgT27UnifyPhotoFlow() {
  if (window.__pmgT27Init) return;
  window.__pmgT27Init = true;

  var STYLE_ID = 'pmg-t27-unify-style';
  var SUITE_ID = 'pmg-photo-suite';
  var COPY_CLASS = 'pmg-photo-copy';
  var OUTCOME_LABEL_CLASS = 'pmg-photo-outcome-label';
  var TOAST_ID = 'pmg-photo-toast';

  var GROUPS_KEYS = ['style', 'camera', 'lighting', 'composition', 'palette'];

  /* ---------------- Style injection ---------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Hide the redundant top-of-builder mode toggle and its hint. */
      '#modeSwitch, .mode-switch { display: none !important; }',
      '.image-mode-hint { display: none !important; }',

      /* Hide the standalone "Generate Image" button in the top builder
         actions row — the Photography Suite now owns this action. */
      '#image-generate-btn { display: none !important; }',

      /* Hide the legacy duplicated photo widgets that earlier phases
         injected into the top builder when image-mode is active. */
      'body.image-mode .pmg-photo-assistant,',
      'body.image-mode #pmg-photo-accordion,',
      'body.image-mode #pmg-build-image-btn,',
      'body.image-mode #pmg-build-image-btn.pmg-ready { display: none !important; }',

      /* New "Copy Prompt" outcome button — paired with the existing
         "Generate Image Here" send button. */
      '#' + SUITE_ID + ' .' + COPY_CLASS + ' {',
      '  flex: 1 1 auto; min-height: 52px; padding: 12px 24px;',
      '  font-size: var(--text-base); font-weight: 700;',
      '  border-radius: var(--radius-full);',
      '  background: var(--color-surface); color: var(--color-primary);',
      '  border: 2px solid var(--color-primary); cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 8px;',
      '  transition: background 160ms ease, color 160ms ease, transform 120ms ease, filter 180ms ease;',
      '}',
      '#' + SUITE_ID + ' .' + COPY_CLASS + ':hover {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  transform: translateY(-1px);',
      '}',
      '#' + SUITE_ID + ' .' + COPY_CLASS + ':disabled {',
      '  opacity: 0.5; cursor: not-allowed; transform: none;',
      '}',
      '#' + SUITE_ID + ' .' + COPY_CLASS + '.is-copied {',
      '  background: var(--color-primary); color: var(--color-text-inverse, #ffffff);',
      '}',

      /* Outcome label above the actions row. */
      '#' + SUITE_ID + ' .' + OUTCOME_LABEL_CLASS + ' {',
      '  display: block; margin: var(--space-4) 0 var(--space-2);',
      '  font-size: var(--text-sm); font-weight: 700; color: var(--color-text);',
      '}',
      '#' + SUITE_ID + ' .' + OUTCOME_LABEL_CLASS + ' .' + OUTCOME_LABEL_CLASS + '-sub {',
      '  display: block; margin-top: 2px;',
      '  font-size: var(--text-xs); font-weight: 500; color: var(--color-text-muted);',
      '}',

      /* Mobile: stack copy button full-width like the existing buttons. */
      '@media (max-width: 640px) {',
      '  #' + SUITE_ID + ' .' + COPY_CLASS + ' { width: 100%; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------------- Helpers ---------------- */
  function collectPicks() {
    var picks = {};
    GROUPS_KEYS.forEach(function (k) { picks[k] = []; });
    var nodes = document.querySelectorAll('#' + SUITE_ID + ' .pmg-photo-pill.is-active');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var g = el.getAttribute('data-group');
      var v = el.getAttribute('data-value');
      if (g && v && picks[g]) picks[g].push(v);
    }
    return picks;
  }

  function buildPromptText(picks) {
    var parts = [];
    if (picks.style && picks.style.length) parts.push(picks.style.join(', ') + ' style');
    if (picks.camera && picks.camera.length) parts.push('shot on ' + picks.camera.join(' / '));
    if (picks.lighting && picks.lighting.length) parts.push(picks.lighting.join(', ') + ' lighting');
    if (picks.composition && picks.composition.length) parts.push(picks.composition.join(', ') + ' composition');
    if (picks.palette && picks.palette.length) parts.push(picks.palette.join(', ') + ' color palette');
    return parts.join(', ');
  }

  function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
    } catch (e) { /* fall through */ }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { resolve(); } else { reject(new Error('execCommand failed')); }
      } catch (e2) { reject(e2); }
    });
  }

  function showToast(msg) {
    var t = document.getElementById(TOAST_ID);
    if (!t) {
      t = document.createElement('div');
      t.id = TOAST_ID;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(function () {
      t.classList.remove('is-visible');
    }, 2400);
  }

  /* ---------------- Force write mode at startup ---------------- */
  function forceWriteMode() {
    try {
      document.body.classList.remove('image-mode');
      var writeBtn = document.getElementById('writeModeBtn');
      var imgBtn = document.getElementById('imageModeBtn');
      if (writeBtn) writeBtn.classList.add('active');
      if (imgBtn) imgBtn.classList.remove('active');
      if (typeof window.setMode === 'function') {
        try { window.setMode('write'); } catch (e) { /* no-op */ }
      }
    } catch (e) { /* no-op */ }
  }

  /* ---------------- Capture user-typed subject ----------------
   * T23's sendToImageGenerator overwrites #goal.value with the
   * already-composed prompt. Programmatic .value assignment does NOT
   * fire the 'input' event, so this listener only captures genuine
   * user keystrokes. We use this snapshot as the subject when copying
   * a prompt — that way "Generate Here" then "Copy Prompt" doesn't
   * recursively compound the prompt suffix. */
  function captureSubjectSource() {
    var goal = document.getElementById('goal');
    if (!goal || goal.getAttribute('data-pmg-subject-bound') === '1') return;
    /* Seed with the current value (whatever the user typed before T27 init). */
    if (goal.value) {
      try { goal.dataset.pmgSubject = goal.value.trim(); } catch (e) { /* no-op */ }
    }
    goal.addEventListener('input', function () {
      try { goal.dataset.pmgSubject = (goal.value || '').trim(); } catch (e) { /* no-op */ }
    });
    goal.setAttribute('data-pmg-subject-bound', '1');
  }

  function readSubject() {
    var goal = document.getElementById('goal');
    if (!goal) return '';
    var snapped = '';
    try { snapped = (goal.dataset && goal.dataset.pmgSubject) ? goal.dataset.pmgSubject : ''; } catch (e) {}
    snapped = (snapped || '').trim();
    if (snapped) return snapped;
    return (goal.value || '').trim();
  }

  /* ---------------- Reframe the suite once it exists ---------------- */
  function reframeSuite() {
    var suite = document.getElementById(SUITE_ID);
    if (!suite) return false;
    if (suite.getAttribute('data-pmg-t27') === '1') return true;

    var helper = suite.querySelector('.pmg-stack-helper');
    if (helper) {
      helper.textContent =
        'Pick A Vibe In Each Group. When You\'re Ready, Either Copy The Prompt To Use In Another AI Tool — Or Generate The Image Right Here With DALL·E 3.';
    }

    var actions = suite.querySelector('.pmg-photo-actions');
    var sendBtn = suite.querySelector('.pmg-photo-send');
    if (!actions || !sendBtn) return false;

    /* Reframe send button label so its outcome is unmistakable. The
       class name (.pmg-photo-send) is unchanged so its T23 click
       handler keeps firing. */
    sendBtn.innerHTML =
      '<span aria-hidden="true">\uD83C\uDFA8</span><span>Generate Image Here</span>';
    sendBtn.setAttribute('aria-label', 'Generate The Image Right Here Using DALL·E 3');
    sendBtn.setAttribute('title', 'Generate The Image Right Now Using DALL·E 3');

    /* New "Copy Prompt" outcome button. */
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = COPY_CLASS;
    copyBtn.innerHTML =
      '<span aria-hidden="true">\uD83D\uDCCB</span><span>Copy Prompt</span>';
    copyBtn.setAttribute('aria-label', 'Copy The Photo Prompt To Your Clipboard');
    copyBtn.setAttribute('title',
      'Copy The Built Prompt To Use In Midjourney, Stable Diffusion, ChatGPT, Or Any Other AI Tool');
    copyBtn.disabled = sendBtn.disabled;

    actions.insertBefore(copyBtn, sendBtn);

    /* Outcome label above the action row. */
    var label = document.createElement('span');
    label.className = OUTCOME_LABEL_CLASS;
    label.innerHTML =
      'What Do You Want To Do?' +
      '<span class="' + OUTCOME_LABEL_CLASS + '-sub">' +
      'Copy The Prompt For Another AI Tool — Or Generate The Image Here.' +
      '</span>';
    actions.parentNode.insertBefore(label, actions);

    /* Wire copy button. Subject comes from readSubject() (the
       user-typed snapshot) so clicking Generate first then Copy
       doesn't recursively compound the prompt. */
    copyBtn.addEventListener('click', function () {
      var picks = collectPicks();
      var photoText = buildPromptText(picks);
      if (!photoText) {
        showToast('Pick At Least One Option First.');
        return;
      }
      var subject = readSubject() || 'A Striking Photograph';
      var finalPrompt = subject + ' — ' + photoText + '.';

      copyToClipboard(finalPrompt).then(function () {
        showToast('\u2713 Prompt Copied — Paste Into Any AI Tool.');
        copyBtn.classList.add('is-copied');
        var origHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span aria-hidden="true">\u2713</span><span>Copied!</span>';
        setTimeout(function () {
          copyBtn.classList.remove('is-copied');
          copyBtn.innerHTML = origHTML;
        }, 1800);
      }).catch(function () {
        showToast('Could Not Copy — Try Again.');
      });
    });

    /* Mirror disabled state from send → copy. T23's refreshSummary
       toggles the disabled attribute when picks change. T26 throttles
       the observer's callbacks. We disconnect on pagehide so the
       observer doesn't linger past navigation. */
    try {
      var mirrorObs = new MutationObserver(function () {
        copyBtn.disabled = sendBtn.disabled;
      });
      mirrorObs.observe(sendBtn, { attributes: true, attributeFilter: ['disabled'] });
      var teardown = function () {
        try { mirrorObs.disconnect(); } catch (e) { /* no-op */ }
      };
      window.addEventListener('pagehide', teardown, { once: true });
      window.addEventListener('beforeunload', teardown, { once: true });
    } catch (e) { /* ignore */ }

    suite.setAttribute('data-pmg-t27', '1');
    return true;
  }

  /* ---------------- Init ---------------- */
  function initT27() {
    injectStyles();
    forceWriteMode();
    captureSubjectSource();
    if (reframeSuite()) return;

    /* Suite not built yet — wait for T23 to inject it. */
    try {
      var mo = new MutationObserver(function () {
        if (reframeSuite()) {
          try { mo.disconnect(); } catch (e) { /* no-op */ }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initT27);
  } else {
    initT27();
  }
})();


/* =====================================================================
 * T28 — Two-Column Build Area (Text Prompt | Image Prompt)
 * ---------------------------------------------------------------------
 * The user's vision: keep the existing fast-to-reach build area but
 * split it into two equal columns operating linearly downward —
 *
 *   LEFT  COLUMN: "Create A Text Prompt"
 *     Help Me Start → Goal → Fix My Prompt → Result → Run With AI
 *     Outcomes: run in-house with AI OR copy/export the prompt.
 *
 *   RIGHT COLUMN: "Create An Image Prompt"
 *     Help Me Start → Before/After Examples (trust) → Photography
 *     Suite (pickers) → Copy Prompt / Generate Image Here → Image Result
 *     Outcomes: generate the image in-house with DALL·E OR copy the
 *     built prompt for use in any other AI tool.
 *
 * Plus: hero CTAs reframed so the two top buttons explicitly route to
 * "Create A Text Prompt" and "Create An Image Prompt".
 *
 * Implementation rules honored:
 *   - .app-shell already has display:grid 1fr 1fr (collapsed to 1fr on
 *     mobile via existing media query). We only need to insert a new
 *     SIBLING into .app-shell to fill the empty right column — no
 *     CSS reorder, no flex order tricks.
 *   - All existing IDs/classes are preserved. We MOVE elements via JS
 *     (event listeners survive moves), never rename.
 *   - T23 keeps a body MutationObserver that re-creates the photo
 *     suite + image generator section ONLY if they're missing. As long
 *     as we don't remove them from the DOM, T23 won't fight us.
 *   - All new logic lives here in pmg-ux.js. Idempotent via
 *     window.__pmgT28Init.
 * ===================================================================== */
(function pmgT28TwoColumnBuild() {
  if (window.__pmgT28Init) return;
  window.__pmgT28Init = true;

  var STYLE_ID = 'pmg-t28-twocol-style';
  var COL_TEXT_ID = 'pmg-col-text';
  var COL_IMAGE_ID = 'pmg-col-image';
  var TEXT_ANCHOR_ID = 'builder-text';
  var IMAGE_ANCHOR_ID = 'builder-image';
  var TEXT_HELP_ID = 'pmg-text-help-row';
  var IMAGE_HELP_ID = 'pmg-image-help-row';
  var IMAGE_BEFORE_AFTER_ID = 'pmg-image-before-after';
  var HERO_IMAGE_CTA_ID = 'hero-image-cta';
  var TEXT_HEADER_ID = 'pmg-col-text-header';

  /* ---------------- Styles ---------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* The .app-shell grid is already 1fr 1fr on desktop. We
         re-parent the existing #builder-panel + #result-panel into a
         single #pmg-col-text wrapper so the LEFT column holds the
         entire text-prompt workflow (input on top, output below), and
         the RIGHT column (#pmg-col-image) holds the image-prompt
         workflow. Both top-aligned. */
      '.app-shell { align-items: start; }',

      /* LEFT column wrapper: vertical stack of the existing panels. */
      '#' + COL_TEXT_ID + ' {',
      '  display: flex; flex-direction: column; gap: var(--space-4);',
      '  min-width: 0;',
      '}',
      /* The two existing panels keep their own .panel chrome; we just
         make sure they stretch to the column width. */
      '#' + COL_TEXT_ID + ' > #builder-panel,',
      '#' + COL_TEXT_ID + ' > #result-panel { width: 100%; margin: 0; }',

      /* LEFT column header — pairs visually with #pmg-col-image header
         so the user reads "Create A Text Prompt" on the left and
         "Create An Image Prompt" on the right at the same Y. */
      '#' + TEXT_HEADER_ID + ' {',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);',
      '  border-radius: var(--radius-xl);',
      '  box-shadow: var(--shadow-md);',
      '  padding: var(--space-5);',
      '}',
      '#' + TEXT_HEADER_ID + ' .pmg-col-text-eyebrow {',
      '  display: inline-block;',
      '  font-size: var(--text-xs); font-weight: 700;',
      '  letter-spacing: 0.04em; text-transform: uppercase;',
      '  color: var(--color-primary); margin-bottom: 6px;',
      '}',
      '#' + TEXT_HEADER_ID + ' .pmg-col-text-title {',
      '  font-size: var(--text-xl, 22px); font-weight: 800;',
      '  margin: 0 0 6px; line-height: 1.25; color: var(--color-text);',
      '}',
      '#' + TEXT_HEADER_ID + ' .pmg-col-text-sub {',
      '  margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);',
      '}',

      /* Right column container — visually mirrors .panel so the two
         columns feel paired. */
      '#' + COL_IMAGE_ID + ' {',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);',
      '  border-radius: var(--radius-xl);',
      '  box-shadow: var(--shadow-md);',
      '  overflow: hidden;',
      '  padding: var(--space-5);',
      '  display: block;',
      '}',
      '#' + COL_IMAGE_ID + ' > * + * { margin-top: var(--space-4); }',

      /* Strip the wrapping app-section/container chrome from the moved
         photo suite + image generator so they sit cleanly inside our
         right-column card without their own outer padding. */
      '#' + COL_IMAGE_ID + ' .app-section {',
      '  padding: 0; margin: 0;',
      '}',
      '#' + COL_IMAGE_ID + ' .app-section > .container {',
      '  padding: 0; max-width: 100%;',
      '}',
      '#' + COL_IMAGE_ID + ' .pmg-stack-card {',
      '  border: 1px solid var(--color-border, color-mix(in srgb, var(--color-text) 10%, transparent));',
      '  border-radius: var(--radius-lg, 12px);',
      '  background: var(--color-surface);',
      '  padding: var(--space-4);',
      '}',

      /* Right-column header (mirrors the left column "workspace-header" feel). */
      '#' + COL_IMAGE_ID + ' .pmg-col-image-header {',
      '  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);',
      '  padding-bottom: var(--space-4);',
      '  margin-bottom: var(--space-4);',
      '}',
      '#' + COL_IMAGE_ID + ' .pmg-col-image-eyebrow {',
      '  display: inline-block;',
      '  font-size: var(--text-xs);',
      '  font-weight: 700;',
      '  letter-spacing: 0.04em;',
      '  text-transform: uppercase;',
      '  color: var(--color-primary);',
      '  margin-bottom: 6px;',
      '}',
      '#' + COL_IMAGE_ID + ' .pmg-col-image-title {',
      '  font-size: var(--text-xl, 22px);',
      '  font-weight: 800;',
      '  margin: 0 0 6px; line-height: 1.25;',
      '  color: var(--color-text);',
      '}',
      '#' + COL_IMAGE_ID + ' .pmg-col-image-sub {',
      '  margin: 0; color: var(--color-text-muted);',
      '  font-size: var(--text-sm);',
      '}',

      /* Help-Me-Start row in image column — mirrors #guided-cta-row. */
      '#' + IMAGE_HELP_ID + ' {',
      '  display: flex; align-items: center; gap: var(--space-3);',
      '  padding: var(--space-3) var(--space-4);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '  border-radius: var(--radius-lg, 12px);',
      '}',
      '#' + IMAGE_HELP_ID + ' .pmg-image-help-text {',
      '  flex: 1 1 auto;',
      '}',
      '#' + IMAGE_HELP_ID + ' .pmg-image-help-text strong {',
      '  display: block; font-size: var(--text-base); font-weight: 800; color: var(--color-text);',
      '}',
      '#' + IMAGE_HELP_ID + ' .pmg-image-help-text span {',
      '  display: block; font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 2px;',
      '}',
      '#' + IMAGE_HELP_ID + ' .pmg-image-help-btn {',
      '  flex: 0 0 auto;',
      '  padding: 10px 18px; min-height: 44px;',
      '  border-radius: var(--radius-full);',
      '  background: var(--color-primary); color: var(--color-text-inverse, #fff);',
      '  border: 1.5px solid var(--color-primary);',
      '  font-weight: 700; cursor: pointer;',
      '}',
      '#' + IMAGE_HELP_ID + ' .pmg-image-help-btn:hover { filter: brightness(0.96); }',

      /* Before/After cards (mirror .std-row pattern). */
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-head {',
      '  font-size: var(--text-sm); font-weight: 800; color: var(--color-text);',
      '  margin: 0 0 var(--space-2);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-sub {',
      '  font-size: var(--text-xs); color: var(--color-text-muted); margin: 0 0 var(--space-3);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-row {',
      '  display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-cell {',
      '  position: relative;',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);',
      '  border-radius: var(--radius-lg, 12px);',
      '  padding: var(--space-3);',
      '  background: var(--color-surface);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-cell.is-after {',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);',
      '  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-label {',
      '  display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.06em;',
      '  text-transform: uppercase; padding: 2px 8px; border-radius: 999px;',
      '  background: color-mix(in srgb, var(--color-text) 10%, transparent);',
      '  color: var(--color-text); margin-bottom: 8px;',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-cell.is-after .pmg-ba-label {',
      '  background: var(--color-primary); color: var(--color-text-inverse, #fff);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-thumb {',
      '  width: 100%; aspect-ratio: 1 / 1; border-radius: var(--radius-md, 8px);',
      '  display: flex; align-items: center; justify-content: center;',
      '  background: linear-gradient(135deg, color-mix(in srgb, var(--color-text) 6%, transparent), color-mix(in srgb, var(--color-text) 12%, transparent));',
      '  color: color-mix(in srgb, var(--color-text) 35%, transparent);',
      '  font-size: 36px; margin-bottom: 8px; overflow: hidden;',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-cell.is-after .pmg-ba-thumb {',
      '  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)), color-mix(in srgb, var(--color-primary) 28%, var(--color-surface)));',
      '  color: var(--color-primary);',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-prompt {',
      '  font-size: var(--text-xs); color: var(--color-text);',
      '  margin: 0; line-height: 1.45;',
      '}',
      '#' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-cell.is-after .pmg-ba-prompt {',
      '  color: var(--color-text);',
      '}',

      /* Hero image CTA — mirrors the existing primary CTA but secondary-tinted. */
      '#' + HERO_IMAGE_CTA_ID + ' .cta-title { font-weight: 800; }',

      /* Mobile: each column gets full width via existing .app-shell media
         rule. Keep paddings sane and stack the help row neatly. */
      '@media (max-width: 900px) {',
      '  #' + COL_IMAGE_ID + ' { padding: var(--space-4); }',
      '  #' + IMAGE_HELP_ID + ' { flex-direction: column; align-items: stretch; text-align: left; }',
      '  #' + IMAGE_HELP_ID + ' .pmg-image-help-btn { width: 100%; }',
      '  #' + IMAGE_BEFORE_AFTER_ID + ' .pmg-ba-row { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------------- Wrap existing #builder-panel + #result-panel ----------------
   *
   * The current .app-shell has TWO direct children: #builder-panel
   * (the input form) and #result-panel ("Your Fixed Prompt" output).
   * Both are part of the TEXT-prompt workflow. The user wants the
   * entire text workflow stacked vertically in the LEFT column so the
   * right column can hold the image-prompt workflow.
   *
   * We create #pmg-col-text in #builder-panel's slot, then move both
   * panels inside it (preserving their order and all event listeners).
   * No IDs are renamed and no event listeners are touched.
   */
  function wrapTextColumn() {
    if (document.getElementById(COL_TEXT_ID)) return document.getElementById(COL_TEXT_ID);
    var appShell = document.querySelector('#builder .app-shell');
    var builderPanel = document.getElementById('builder-panel');
    var resultPanel = document.getElementById('result-panel');
    if (!appShell || !builderPanel || !resultPanel) return null;
    /* Defensive: only wrap if both panels are still direct children of
       app-shell (i.e. nobody else has moved them). */
    if (builderPanel.parentNode !== appShell || resultPanel.parentNode !== appShell) return null;

    var wrap = document.createElement('div');
    wrap.id = COL_TEXT_ID;

    /* Anchor target so the hero CTA can deep-link to the text column. */
    var anchor = document.createElement('span');
    anchor.id = TEXT_ANCHOR_ID;
    anchor.style.cssText = 'display:block;height:0;scroll-margin-top:96px;';
    wrap.appendChild(anchor);

    /* Header card — pairs with #pmg-col-image's header. */
    var header = document.createElement('header');
    header.id = TEXT_HEADER_ID;
    header.innerHTML =
      '<span class="pmg-col-text-eyebrow">Workspace</span>' +
      '<h2 class="pmg-col-text-title">Create A Text Prompt</h2>' +
      '<p class="pmg-col-text-sub">Describe What You Want — We\'ll Build A Sharp Prompt You Can Run With AI Right Here Or Copy Anywhere.</p>';
    wrap.appendChild(header);

    /* Insert wrapper where #builder-panel was, then move both panels in. */
    appShell.insertBefore(wrap, builderPanel);
    wrap.appendChild(builderPanel);
    wrap.appendChild(resultPanel);
    return wrap;
  }

  /* ---------------- Build right column scaffolding ---------------- */
  function buildImageColumn() {
    if (document.getElementById(COL_IMAGE_ID)) return document.getElementById(COL_IMAGE_ID);
    var appShell = document.querySelector('#builder .app-shell');
    var textCol = document.getElementById(COL_TEXT_ID);
    /* Need the text column wrapper to be in place first, so the image
       column lands as the SECOND grid child. */
    if (!appShell || !textCol) return null;

    var col = document.createElement('aside');
    col.id = COL_IMAGE_ID;
    col.setAttribute('aria-labelledby', COL_IMAGE_ID + '-title');

    /* Anchor target so the hero CTA can deep-link to this column. */
    var anchor = document.createElement('span');
    anchor.id = IMAGE_ANCHOR_ID;
    anchor.style.cssText = 'display:block;height:0;scroll-margin-top:96px;';
    col.appendChild(anchor);

    /* Header. */
    var header = document.createElement('header');
    header.className = 'pmg-col-image-header';
    header.innerHTML =
      '<span class="pmg-col-image-eyebrow">Workspace</span>' +
      '<h2 id="' + COL_IMAGE_ID + '-title" class="pmg-col-image-title">Create An Image Prompt</h2>' +
      '<p class="pmg-col-image-sub">Build A Detailed Photo Prompt — Then Generate The Image Here With DALL·E Or Copy It For Any Other AI Tool. Photography Suite Included As A Bonus Refinement.</p>';
    col.appendChild(header);

    /* Help Me Start row (mirrors text column's #guided-cta-row). */
    var helpRow = document.createElement('div');
    helpRow.id = IMAGE_HELP_ID;
    helpRow.innerHTML =
      '<div class="pmg-image-help-text">' +
        '<strong>Help Me Start</strong>' +
        '<span>Not Sure What To Pick? We\'ll Walk You Through The Photography Suite Step By Step.</span>' +
      '</div>' +
      '<button type="button" class="pmg-image-help-btn" id="' + IMAGE_HELP_ID + '-btn">Help Me Start</button>';
    col.appendChild(helpRow);

    /* Wire help button: scroll to the suite, then auto-roll Surprise
       Me so the user gets a working starting set of picks they can
       tweak. (Idempotent — Surprise Me is the existing T23 button.) */
    helpRow.querySelector('#' + IMAGE_HELP_ID + '-btn').addEventListener('click', function () {
      var suite = document.getElementById('pmg-photo-suite');
      if (suite) {
        try { suite.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
      }
      setTimeout(function () {
        var surprise = document.querySelector('.pmg-photo-surprise');
        if (surprise) surprise.click();
        var goal = document.getElementById('goal');
        if (goal && !goal.value.trim()) {
          goal.focus();
          showImageHint('Type Your Subject Above (e.g. "A Red Panda Playing Chess"), Then Hit Copy Prompt Or Generate Image Here.');
        }
      }, 380);
    });

    /* Before/After examples block. */
    var ba = document.createElement('div');
    ba.id = IMAGE_BEFORE_AFTER_ID;
    ba.innerHTML =
      '<p class="pmg-ba-head">See What A Detailed Photo Prompt Can Do</p>' +
      '<p class="pmg-ba-sub">Same Idea. One Vague Ask. One PromptMeGood Photo Prompt. Big Difference.</p>' +
      '<div class="pmg-ba-row">' +
        '<div class="pmg-ba-cell is-before">' +
          '<span class="pmg-ba-label">Before</span>' +
          '<div class="pmg-ba-thumb" aria-hidden="true">📷</div>' +
          '<p class="pmg-ba-prompt">"A Cat."</p>' +
        '</div>' +
        '<div class="pmg-ba-cell is-after">' +
          '<span class="pmg-ba-label">After</span>' +
          '<div class="pmg-ba-thumb" aria-hidden="true">✨</div>' +
          '<p class="pmg-ba-prompt">"A Sleek Black Cat Lounging On A Sunlit Window Sill — Cinematic Style, Shot On 50mm, Soft Golden Hour Lighting, Centered Composition, Warm Amber Color Palette."</p>' +
        '</div>' +
      '</div>';
    col.appendChild(ba);

    /* Insert as the right-side sibling of #builder-panel. The .app-shell
       grid (already 1fr 1fr) places it in column 2 automatically. */
    appShell.appendChild(col);
    return col;
  }

  function showImageHint(msg) {
    /* Reuse the existing pmg-photo-toast (T23 styled, T27 used). */
    var t = document.getElementById('pmg-photo-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pmg-photo-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 3200);
  }

  /* ---------------- Move suite + generator into the column ---------------- */
  function relocateImageStack(col) {
    if (!col) return false;
    /* Both targets are built by T23; their existence is guaranteed
       once T23's init runs. We move ONLY if they exist AND aren't
       already inside the column. */
    var moved = false;
    var photoSection = document.getElementById('photo-suite-section');
    if (photoSection && photoSection.parentNode !== col) {
      col.appendChild(photoSection);
      moved = true;
    }
    var imgGen = document.getElementById('pmg-image-generator-section');
    if (imgGen && imgGen.parentNode !== col) {
      col.appendChild(imgGen);
      moved = true;
    }
    return moved;
  }

  /* ---------------- Hero CTAs ---------------- */
  function reframeHeroCTAs() {
    var heroActions = document.querySelector('.hero .hero-actions');
    if (!heroActions) return;
    if (heroActions.getAttribute('data-pmg-t28') === '1') return;

    var textCTA = document.getElementById('hero-build-cta');
    if (textCTA) {
      var t = textCTA.querySelector('.cta-title');
      var s = textCTA.querySelector('.cta-sub');
      if (t) t.textContent = 'Create A Text Prompt';
      if (s) s.textContent = 'Free · No Signup · Works In Seconds';
    }

    /* Avoid inserting the image CTA twice. */
    if (!document.getElementById(HERO_IMAGE_CTA_ID)) {
      var imgCTA = document.createElement('a');
      imgCTA.id = HERO_IMAGE_CTA_ID;
      imgCTA.className = 'btn btn-primary btn-stacked';
      imgCTA.href = '#' + IMAGE_ANCHOR_ID;
      imgCTA.style.cssText =
        'background: var(--color-surface); color: var(--color-primary); border: 2px solid var(--color-primary);';
      imgCTA.innerHTML =
        '<span class="cta-title">Create An Image Prompt</span>' +
        '<span class="cta-sub">Generate Here With DALL·E Or Export</span>';

      /* Insert immediately after the text CTA so it sits side-by-side. */
      if (textCTA && textCTA.nextSibling) {
        heroActions.insertBefore(imgCTA, textCTA.nextSibling);
      } else if (textCTA) {
        heroActions.appendChild(imgCTA);
      } else {
        heroActions.insertBefore(imgCTA, heroActions.firstChild);
      }
    }

    heroActions.setAttribute('data-pmg-t28', '1');
  }

  /* ---------------- Init ---------------- */
  var attempts = 0;
  function tryWire() {
    attempts++;
    injectStyles();
    reframeHeroCTAs();
    /* 1) Wrap the existing #builder-panel + #result-panel into the
          left "Create A Text Prompt" column. */
    wrapTextColumn();
    /* 2) Build the right "Create An Image Prompt" column. */
    var col = buildImageColumn();
    /* 3) Move the existing photo suite + image generator into it as
          they become available (T23 mounts them async). */
    relocateImageStack(col);
    /* Done when both T23 targets are inside the right column. */
    var photoSection = document.getElementById('photo-suite-section');
    var imgGen = document.getElementById('pmg-image-generator-section');
    if (col && photoSection && imgGen &&
        photoSection.parentNode === col && imgGen.parentNode === col) {
      return true;
    }
    return false;
  }

  function init() {
    if (tryWire()) return;
    /* T23 may not have built #photo-suite-section yet — retry on body
       mutations until both targets are present. T26 throttles us to
       one delivery per frame. Hard cap at 120s to match T23's own
       late-mount guard window (T23 has setTimeout(..., 120000) at
       line ~5625) so a late suite mount can't miss relocation. */
    try {
      var mo = new MutationObserver(function () {
        if (tryWire()) {
          try { mo.disconnect(); } catch (e) { /* no-op */ }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      var teardown = function () { try { mo.disconnect(); } catch (e) {} };
      setTimeout(teardown, 120000);
      /* Belt-and-suspenders: a final reconciliation pass shortly
         before the observer is torn down, in case mutation delivery
         was sparse or coalesced away the relevant batch. */
      setTimeout(function () { tryWire(); }, 90000);
      window.addEventListener('pagehide', teardown, { once: true });
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * T29 — Polish Pass: Center Hero, Brand Accents, Photo Cards Wiring
 * ---------------------------------------------------------------------
 * User feedback after T28 shipped:
 *   - "Buttons look huge" — the hero stacked CTAs feel oversized and
 *     the longer sub-titles (e.g. "Generate Here With DALL·E Or
 *     Export") were crowding the rounded pill edges.
 *   - "Everything looks plain and all white" — the build columns and
 *     the marketing surfaces below them weren't carrying the teal /
 *     dark-teal brand identity the rest of the site uses.
 *   - "Hero needs to be centered for a more uniform look" — the hero
 *     left column was left-aligned, making the page feel lopsided.
 *
 * What this IIFE does (in order):
 *   1. Center the hero left column: text-align center, flex column
 *      align-items center, hero-actions justified center, subtext
 *      box gets margin auto so it sits in the middle.
 *   2. Tighten the stacked CTAs: reduce min-height, increase
 *      horizontal padding so long sub-titles never crowd the pill
 *      edge, allow sub-title to wrap on a single tight line, shorten
 *      the image-CTA sub copy to "DALL·E Or Any AI Tool" (cleaner).
 *   3. Add brand-teal accents:
 *        - thin teal top border on each build column (#pmg-col-text +
 *          #pmg-col-image),
 *        - subtle teal radial-gradient backdrop on the .app-shell so
 *          the columns "float" on a tinted surface rather than pure
 *          white,
 *        - dark-teal column titles (var(--color-primary)),
 *        - hero subtext box gets a slightly stronger teal wash.
 *
 * Hard rules honored: no backend/API/DB changes; no renamed IDs or
 * classes; CSS variables + color-mix only; idempotent via
 * window.__pmgT29Init; all logic lives in pmg-ux.js.
 * ===================================================================== */
(function pmgT29PolishPass() {
  if (window.__pmgT29Init) return;
  window.__pmgT29Init = true;

  var STYLE_ID = 'pmg-t29-polish-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* --- 2) Center the hero left column for a uniform look ---
         The left column is the first child of .hero-grid and holds
         the heading + subtext + CTAs + proof bar + testimonial. We
         keep the right-side hero-card untouched so nothing else
         shifts. */
      '.hero .hero-grid > div:first-child {',
      '  display: flex; flex-direction: column; align-items: center;',
      '  text-align: center;',
      '}',
      '.hero .hero-heading,',
      '.hero .hero-subtext,',
      '.hero .hero-testimonial-quote,',
      '.hero .hero-testimonial-author { text-align: center !important; }',
      '.hero .hero-subtext-box {',
      '  margin-left: auto !important; margin-right: auto !important;',
      /* Replace the strict left border with a dual-side teal accent
         so the box reads as centered rather than left-anchored. */
      '  border-left: none;',
      '  border-top: 4px solid var(--color-primary);',
      '}',
      '.hero .hero-actions {',
      '  justify-content: center !important;',
      '  flex-wrap: wrap;',
      '}',
      '.hero .hero-proof-bar {',
      '  justify-content: center !important;',
      '  flex-wrap: wrap;',
      '}',
      '.hero .hero-testimonial { margin-left: auto !important; margin-right: auto !important; }',

      /* --- 3) Tighter, breathable stacked CTAs ---
         The stacked CTAs were 64px tall with only 20px horizontal
         padding, which crowded the rounded edges when sub-titles
         got long. We trim the height a touch and add real horizontal
         breathing room. */
      '.hero .hero-actions .btn-stacked {',
      '  min-height: 56px;',
      '  padding: 10px 28px;',
      '  border-radius: 16px;',
      '  max-width: 320px;',
      '}',
      '.hero .hero-actions .btn-stacked .cta-title {',
      '  font-size: var(--text-sm);',
      '  line-height: 1.2;',
      '  white-space: nowrap;',
      '}',
      '.hero .hero-actions .btn-stacked .cta-sub {',
      '  font-size: 11.5px;',
      '  line-height: 1.25;',
      '  margin-top: 2px;',
      '  white-space: nowrap;',
      '  letter-spacing: 0.005em;',
      '}',
      '@media (max-width: 600px) {',
      '  .hero .hero-actions .btn-stacked { max-width: 100%; padding: 12px 22px; }',
      '  .hero .hero-actions .btn-stacked .cta-title { white-space: normal; }',
      '  .hero .hero-actions .btn-stacked .cta-sub { white-space: normal; }',
      '}',

      /* --- 4) Brand-teal accents on the build area ---
         Soft tinted backdrop so the two columns visibly sit on a
         branded surface instead of plain white. */
      '#builder .app-shell {',
      '  background:',
      '    radial-gradient(80% 60% at 0% 0%, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 70%),',
      '    radial-gradient(70% 50% at 100% 0%, color-mix(in srgb, var(--color-primary-hover) 6%, transparent), transparent 70%),',
      '    transparent;',
      '  padding: var(--space-4);',
      '  border-radius: var(--radius-xl);',
      '}',

      /* Thin teal top accent on each column, plus a darker title color
         so the eye locks onto the brand colour pair (light teal for
         eyebrow + dark teal for title). */
      '#pmg-col-text > #pmg-col-text-header,',
      '#pmg-col-image {',
      '  border-top: 4px solid var(--color-primary) !important;',
      '}',
      '#pmg-col-text-header .pmg-col-text-title,',
      '#pmg-col-image .pmg-col-image-title {',
      '  color: var(--color-primary-hover) !important;',
      '}',

      /* The inner panels (#builder-panel + #result-panel) keep their
         own white background, but get a faint teal-tinted border so
         they harmonise with the column accent. */
      '#pmg-col-text > #builder-panel,',
      '#pmg-col-text > #result-panel {',
      '  border-color: color-mix(in srgb, var(--color-primary) 18%, var(--color-border, transparent)) !important;',
      '}',

      ''
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* --- Shorten the image CTA sub copy added by T28 ---
     T28 set this to "Generate Here With DALL·E Or Export" which
     was crowding the pill. We tighten it to a punchier line. */
  function tightenImageCtaCopy() {
    var imgCTA = document.getElementById('hero-image-cta');
    if (!imgCTA) return;
    var sub = imgCTA.querySelector('.cta-sub');
    if (sub && sub.textContent !== 'DALL·E Or Any AI Tool') {
      sub.textContent = 'DALL·E Or Any AI Tool';
    }
    /* Also tighten the text CTA's sub if T28's copy lingers. */
    var textCTA = document.getElementById('hero-build-cta');
    if (textCTA) {
      var tsub = textCTA.querySelector('.cta-sub');
      if (tsub && tsub.textContent !== 'Free · Works In Seconds') {
        tsub.textContent = 'Free · Works In Seconds';
      }
    }
  }

  function init() {
    injectStyles();
    tightenImageCtaCopy();
    /* T28 builds the hero image CTA + the column headers async, so
       run the lightweight passes again on a short cadence until they
       exist (no MutationObserver needed — these are one-shot text
       and aria tweaks). */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tightenImageCtaCopy();
      if (tries >= 30) clearInterval(iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * T30 — Help Me Start At Top + Image Prompt 5-Step Wizard + Less White
 * ---------------------------------------------------------------------
 * User feedback after T29 shipped:
 *   - "The columns are still uber white" — the panels themselves still
 *     read as plain white even though the backdrop got a teal tint.
 *   - "The two hero CTAs lead to nowhere — users don't know what to do
 *     when they land on the column." There's no obvious next action at
 *     the top of the column.
 *   - "There are no text fields visible on either column" — the goal
 *     textarea on the LEFT column is buried below the header copy and
 *     the (1 Of 1 Free Today) chip + the helper text. The RIGHT column
 *     has no visible text input at all (it shares #goal with the left
 *     column but has no obvious entry point).
 *   - "Bring back the Help Me Start 4–5 question flow at the top" —
 *     the existing #guided-mode-btn (already a 4-question modal) should
 *     be promoted to the top of the LEFT column so users see it first.
 *   - "Build the SAME 4–5 question flow for the image side" — currently
 *     the image column's Help Me Start just scrolls to the Photography
 *     Suite. Users want a true guided wizard for image prompts too.
 *   - "Give users who already know what they want a fast lane" — a
 *     'Skip the questions, just start typing →' link that focuses the
 *     goal textarea immediately.
 *
 * What this IIFE does:
 *   1. Tints #builder-panel + #result-panel + #pmg-col-image with a
 *      soft teal-to-white gradient so the columns no longer feel
 *      sterile white.
 *   2. Inserts a top-of-column dual-action callout under the LEFT
 *      column header (#pmg-col-text-header):
 *        - PRIMARY: "Help Me Start" → triggers existing #guided-mode-btn
 *          (the existing 4-question modal that's been there all along —
 *          we are NOT rebuilding it, just surfacing it).
 *        - SECONDARY (link): "I Know What I Want — Just Start Typing →"
 *          which scrolls to and focuses the #goal textarea.
 *   3. Augments the RIGHT column's existing #pmg-image-help-row (built
 *      by T28) with the same dual-action shape:
 *        - PRIMARY: "Help Me Start" → opens our NEW T30 image-prompt
 *          5-step wizard (modal).
 *        - SECONDARY: same "Just Start Typing →" link that focuses the
 *          goal textarea (image prompts and text prompts share #goal —
 *          this is the existing PromptMeGood architecture).
 *   4. Builds the IMAGE-PROMPT WIZARD: a single modal with 5 sequential
 *      steps (Subject → Style → Mood/Lighting → Setting → Details).
 *      Each step is one question with chip-options + a custom-text
 *      escape hatch. On finish it composes a detailed photo prompt
 *      string, drops it into #goal, closes the modal, and scrolls the
 *      user to #builder-image so the existing Photography Suite +
 *      generate flow takes over.
 *   5. Wires the hero CTAs (#hero-build-cta, #hero-image-cta) so that
 *      after their existing scroll fires, the matching help callout
 *      gets a brief teal pulse to draw the eye — answering "where am
 *      I supposed to look first?"
 *
 * Hard rules honored:
 *   - No backend / API / DB / payment / secret changes.
 *   - No renamed IDs, classes, or JS variables. We MOUNT alongside the
 *     existing #guided-mode-btn (we don't replace it) and clone the
 *     existing image-help button to swap its handler safely.
 *   - All new logic lives in pmg-ux.js (this file).
 *   - Idempotent via window.__pmgT30Init.
 *   - CSS uses CSS variables and color-mix only.
 * ===================================================================== */
(function pmgT30HelpAndImageWizard() {
  if (window.__pmgT30Init) return;
  window.__pmgT30Init = true;

  var STYLE_ID = 'pmg-t30-help-style';
  var TEXT_HELP_ID = 'pmg-text-help-row';
  var MODAL_ID = 'pmg-t30-image-modal';

  /* Small HTML escape so user-typed strings inside attribute / text
     positions don't break the markup or open injection holes. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== Panel tinting — kill the uber-white look =====
         The two left-column panels (#builder-panel + #result-panel)
         and the right column wrapper (#pmg-col-image) get a soft
         teal-to-white gradient inside their existing white surface.
         This is purely visual; nothing inside reflows. */
      '#pmg-col-text > #builder-panel,',
      '#pmg-col-text > #result-panel,',
      '#pmg-col-image {',
      '  background-image: linear-gradient(180deg,',
      '    color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)),',
      '    var(--color-surface) 55%) !important;',
      '}',

      /* ===== Top-of-LEFT-column dual-action help callout ===== */
      '#' + TEXT_HELP_ID + ' {',
      '  display: flex; flex-wrap: wrap; align-items: center;',
      '  gap: var(--space-3);',
      '  padding: var(--space-3) var(--space-4);',
      '  margin: 0 0 var(--space-3);',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);',
      '  border-radius: var(--radius-lg, 12px);',
      '  transition: box-shadow 0.3s ease;',
      '}',
      '#' + TEXT_HELP_ID + ' .pmg-help-text { flex: 1 1 240px; min-width: 0; }',
      '#' + TEXT_HELP_ID + ' .pmg-help-text strong {',
      '  display: block; font-size: var(--text-base);',
      '  font-weight: 800; color: var(--color-text);',
      '}',
      '#' + TEXT_HELP_ID + ' .pmg-help-text > span {',
      '  display: block; font-size: var(--text-sm);',
      '  color: var(--color-text-muted); margin-top: 2px;',
      '}',
      '#' + TEXT_HELP_ID + ' .pmg-help-actions {',
      '  display: flex; flex-direction: column; gap: 6px; align-items: flex-end;',
      '}',
      '#' + TEXT_HELP_ID + ' .pmg-help-primary {',
      '  padding: 10px 18px; min-height: 44px; border-radius: var(--radius-full);',
      '  background: var(--color-primary); color: #fff;',
      '  border: 1.5px solid var(--color-primary);',
      '  font-weight: 700; cursor: pointer; white-space: nowrap;',
      '}',
      '#' + TEXT_HELP_ID + ' .pmg-help-primary:hover { filter: brightness(0.96); }',
      '.pmg-help-secondary {',
      '  background: none; border: none; padding: 0;',
      '  color: var(--color-primary);',
      '  font-size: 12.5px; font-weight: 600; cursor: pointer;',
      '  text-decoration: underline; text-underline-offset: 3px;',
      '  text-align: left;',
      '}',
      '.pmg-help-secondary:hover { color: var(--color-primary-hover); }',
      '@media (max-width: 600px) {',
      '  #' + TEXT_HELP_ID + ' .pmg-help-actions { width: 100%; align-items: stretch; }',
      '  #' + TEXT_HELP_ID + ' .pmg-help-primary { width: 100%; }',
      '}',

      /* ===== Augment RIGHT column existing help row =====
         T28 built #pmg-image-help-row with a single text+button shape.
         We add a secondary skip link below the description text. */
      '#pmg-image-help-row .pmg-image-help-text {',
      '  display: flex; flex-direction: column;',
      '}',
      '#pmg-image-help-row .pmg-help-secondary {',
      '  margin-top: 6px;',
      '}',

      /* ===== T30 Image-Prompt Wizard Modal ===== */
      '#' + MODAL_ID + ' {',
      '  position: fixed; inset: 0; display: none;',
      '  align-items: center; justify-content: center;',
      '  background: rgba(0,0,0,0.55); z-index: 9999; padding: 16px;',
      '}',
      '#' + MODAL_ID + '.is-open { display: flex; }',
      '#' + MODAL_ID + ' .pmg-im-card {',
      '  background: var(--color-surface, #fff); border-radius: var(--radius-xl, 16px);',
      '  max-width: 560px; width: 100%; max-height: 92vh;',
      '  display: flex; flex-direction: column; overflow: hidden;',
      '  box-shadow: 0 30px 60px rgba(0,0,0,0.3);',
      '  border-top: 6px solid var(--color-primary);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-head {',
      '  display: flex; align-items: flex-start; justify-content: space-between;',
      '  padding: var(--space-4) var(--space-5);',
      '  border-bottom: 1px solid var(--color-border, #eee);',
      '  gap: var(--space-3);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-title {',
      '  margin: 0 0 4px; font-size: var(--text-lg);',
      '  font-weight: 800; color: var(--color-primary-hover);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-step {',
      '  font-size: var(--text-xs); color: var(--color-text-muted);',
      '  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-close {',
      '  background: none; border: none; font-size: 26px;',
      '  line-height: 1; cursor: pointer; color: var(--color-text-muted);',
      '  padding: 0 4px;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-progress {',
      '  height: 4px; background: var(--color-border, #eee); width: 100%;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-progress-bar {',
      '  height: 100%; background: var(--color-primary);',
      '  width: 20%; transition: width 0.25s;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-body {',
      '  padding: var(--space-5); overflow-y: auto; flex: 1 1 auto;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-question {',
      '  margin: 0 0 6px; font-size: var(--text-base);',
      '  font-weight: 700; color: var(--color-text);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-hint {',
      '  margin: 0 0 var(--space-4); font-size: var(--text-sm);',
      '  color: var(--color-text-muted);',
      '}',
      '#' + MODAL_ID + ' textarea, #' + MODAL_ID + ' input[type="text"] {',
      '  width: 100%; padding: 12px 14px; border-radius: 12px;',
      '  border: 1.5px solid var(--color-border, #ddd);',
      '  font: inherit; resize: vertical; box-sizing: border-box;',
      '  background: var(--color-surface);',
      '}',
      '#' + MODAL_ID + ' textarea { min-height: 72px; }',
      '#' + MODAL_ID + ' textarea:focus, #' + MODAL_ID + ' input:focus {',
      '  outline: none; border-color: var(--color-primary);',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-chip-row {',
      '  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: var(--space-3);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-chip {',
      '  padding: 8px 14px; border-radius: 999px;',
      '  border: 1.5px solid var(--color-border, #ddd);',
      '  background: var(--color-surface, #fff);',
      '  font-size: var(--text-sm); font-weight: 600; color: var(--color-text);',
      '  cursor: pointer; transition: all 0.15s;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-chip:hover {',
      '  border-color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '}',
      '#' + MODAL_ID + ' .pmg-im-chip.is-selected {',
      '  border-color: var(--color-primary);',
      '  background: var(--color-primary); color: #fff;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-foot {',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  padding: var(--space-4) var(--space-5);',
      '  border-top: 1px solid var(--color-border, #eee);',
      '  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));',
      '  gap: var(--space-3);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-back, #' + MODAL_ID + ' .pmg-im-next {',
      '  padding: 10px 22px; min-height: 44px; border-radius: var(--radius-full);',
      '  font-weight: 700; cursor: pointer; font-size: var(--text-sm);',
      '  border: 1.5px solid;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-back {',
      '  background: var(--color-surface); border-color: var(--color-border, #ddd);',
      '  color: var(--color-text);',
      '}',
      '#' + MODAL_ID + ' .pmg-im-back:disabled { opacity: 0.4; cursor: not-allowed; }',
      '#' + MODAL_ID + ' .pmg-im-next {',
      '  background: var(--color-primary); border-color: var(--color-primary); color: #fff;',
      '}',
      '#' + MODAL_ID + ' .pmg-im-next:hover { filter: brightness(0.96); }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ===== Image-prompt question definitions =====
     5 steps. Subject + Details are free-text. Style / Lighting /
     Setting are chip pickers with a "type your own" custom escape
     so users aren't locked into the presets. */
  var QUESTIONS = [
    {
      key: 'subject',
      title: 'Step 1 Of 5',
      question: 'What Do You Want To Create?',
      hint: 'Describe the main subject in plain words. The more specific, the better.',
      type: 'textarea',
      placeholder: 'e.g. A confident woman in her 30s, smiling, business attire'
    },
    {
      key: 'style',
      title: 'Step 2 Of 5',
      question: 'What Visual Style?',
      hint: 'Pick a style — or type your own.',
      type: 'chips',
      options: ['Realistic Photo', 'Cinematic', 'Illustration', '3D Render', 'Oil Painting', 'Watercolor', 'Anime', 'Minimalist'],
      allowCustom: true,
      placeholder: 'Or describe your own style...'
    },
    {
      key: 'lighting',
      title: 'Step 3 Of 5',
      question: 'Mood & Lighting?',
      hint: 'How should it feel? Pick one or describe your own.',
      type: 'chips',
      options: ['Bright & Clean', 'Golden Hour', 'Cinematic Moody', 'Soft & Warm', 'High Contrast', 'Studio Lighting', 'Dreamy & Soft', 'Neon Night'],
      allowCustom: true,
      placeholder: 'Or describe the mood...'
    },
    {
      key: 'setting',
      title: 'Step 4 Of 5',
      question: 'Where Does It Happen?',
      hint: 'The setting or background. Pick one or describe.',
      type: 'chips',
      options: ['Plain Studio Backdrop', 'Outdoors / Nature', 'Urban Street', 'Modern Office', 'Cozy Indoors', 'Abstract / Solid Color', 'Beach / Coast', 'No Background'],
      allowCustom: true,
      placeholder: 'Or describe the setting...'
    },
    {
      key: 'details',
      title: 'Step 5 Of 5',
      question: 'Anything Else Important?',
      hint: 'Composition, angle, colors, props, vibe. Or leave blank.',
      type: 'textarea',
      placeholder: 'e.g. close-up portrait, shallow depth of field, warm color palette',
      optional: true
    }
  ];

  var state = { step: 0, answers: {} };

  function buildModal() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', MODAL_ID + '-title');
    modal.innerHTML =
      '<div class="pmg-im-card">' +
        '<header class="pmg-im-head">' +
          '<div>' +
            '<h2 class="pmg-im-title" id="' + MODAL_ID + '-title">Help Me Build An Image Prompt</h2>' +
            '<span class="pmg-im-step" id="' + MODAL_ID + '-step-label">Step 1 Of 5</span>' +
          '</div>' +
          '<button type="button" class="pmg-im-close" id="' + MODAL_ID + '-close" aria-label="Close">×</button>' +
        '</header>' +
        '<div class="pmg-im-progress"><div class="pmg-im-progress-bar" id="' + MODAL_ID + '-progress"></div></div>' +
        '<div class="pmg-im-body" id="' + MODAL_ID + '-body"></div>' +
        '<footer class="pmg-im-foot">' +
          '<button type="button" class="pmg-im-back" id="' + MODAL_ID + '-back">← Back</button>' +
          '<button type="button" class="pmg-im-next" id="' + MODAL_ID + '-next">Next →</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#' + MODAL_ID + '-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
    modal.querySelector('#' + MODAL_ID + '-back').addEventListener('click', function () {
      saveCurrentAnswer();
      if (state.step > 0) { state.step--; renderStep(); }
    });
    modal.querySelector('#' + MODAL_ID + '-next').addEventListener('click', function () {
      saveCurrentAnswer();
      if (state.step < QUESTIONS.length - 1) { state.step++; renderStep(); }
      else { finishWizard(); }
    });
    return modal;
  }

  function openModal() {
    state.step = 0;
    state.answers = {};
    var modal = buildModal();
    modal.classList.add('is-open');
    renderStep();
  }
  /* Expose for T32+ callers that rebuild the help-row buttons. */
  window.__pmgT30OpenImageWizard = openModal;

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.remove('is-open');
  }

  function renderStep() {
    var q = QUESTIONS[state.step];
    var body = document.getElementById(MODAL_ID + '-body');
    var stepLabel = document.getElementById(MODAL_ID + '-step-label');
    var progress = document.getElementById(MODAL_ID + '-progress');
    var backBtn = document.getElementById(MODAL_ID + '-back');
    var nextBtn = document.getElementById(MODAL_ID + '-next');
    if (!body) return;

    stepLabel.textContent = q.title;
    progress.style.width = ((state.step + 1) / QUESTIONS.length * 100) + '%';
    backBtn.disabled = state.step === 0;
    nextBtn.textContent = (state.step === QUESTIONS.length - 1) ? 'Build My Image Prompt →' : 'Next →';

    var html = '<p class="pmg-im-question">' + esc(q.question) +
      (q.optional ? ' <span style="font-weight:500;color:var(--color-text-muted);font-size:13px;">(Optional)</span>' : '') +
      '</p>';
    html += '<p class="pmg-im-hint">' + esc(q.hint) + '</p>';

    var prev = state.answers[q.key] || {};

    if (q.type === 'chips') {
      html += '<div class="pmg-im-chip-row" id="' + MODAL_ID + '-chips">';
      q.options.forEach(function (opt) {
        var sel = (prev.choice === opt) ? ' is-selected' : '';
        html += '<button type="button" class="pmg-im-chip' + sel + '" data-choice="' + esc(opt) + '">' + esc(opt) + '</button>';
      });
      html += '</div>';
      if (q.allowCustom) {
        html += '<input type="text" id="' + MODAL_ID + '-custom" placeholder="' + esc(q.placeholder) + '" value="' + esc(prev.custom || '') + '" />';
      }
    } else if (q.type === 'textarea') {
      html += '<textarea id="' + MODAL_ID + '-text" placeholder="' + esc(q.placeholder) + '" rows="3">' + esc(prev.text || '') + '</textarea>';
    }

    body.innerHTML = html;

    if (q.type === 'chips') {
      body.querySelectorAll('.pmg-im-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          body.querySelectorAll('.pmg-im-chip').forEach(function (c) { c.classList.remove('is-selected'); });
          chip.classList.add('is-selected');
          var custom = document.getElementById(MODAL_ID + '-custom');
          if (custom) custom.value = '';
        });
      });
    }

    var firstInput = body.querySelector('textarea, input');
    if (firstInput) { try { firstInput.focus(); } catch (e) {} }
  }

  function saveCurrentAnswer() {
    var q = QUESTIONS[state.step];
    var body = document.getElementById(MODAL_ID + '-body');
    if (!body) return;
    var ans = {};
    if (q.type === 'chips') {
      var selected = body.querySelector('.pmg-im-chip.is-selected');
      if (selected) ans.choice = selected.getAttribute('data-choice');
      var custom = body.querySelector('#' + MODAL_ID + '-custom');
      if (custom && custom.value.trim()) ans.custom = custom.value.trim();
    } else if (q.type === 'textarea') {
      var ta = body.querySelector('#' + MODAL_ID + '-text');
      if (ta) ans.text = ta.value.trim();
    }
    state.answers[q.key] = ans;
  }

  function pickValue(ans) {
    if (!ans) return '';
    if (ans.custom) return ans.custom;
    if (ans.choice) return ans.choice;
    return '';
  }

  function composePrompt() {
    var a = state.answers;
    var parts = [];
    var subject = (a.subject && a.subject.text) || '';
    if (subject) parts.push(subject);
    var style = pickValue(a.style);
    if (style) parts.push(style.toLowerCase() + ' style');
    var lighting = pickValue(a.lighting);
    if (lighting) parts.push(lighting.toLowerCase() + ' lighting');
    var setting = pickValue(a.setting);
    if (setting) {
      var lower = setting.toLowerCase();
      if (lower === 'no background') parts.push('no background, transparent');
      else parts.push('set against ' + lower);
    }
    var details = (a.details && a.details.text) || '';
    if (details) parts.push(details);
    return parts.join(', ');
  }

  function finishWizard() {
    var prompt = composePrompt();
    var goal = document.getElementById('goal');
    if (goal && prompt) {
      goal.value = prompt;
      goal.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeModal();
    setTimeout(function () {
      var img = document.getElementById('builder-image') || document.getElementById('pmg-col-image');
      if (img) {
        try { img.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
      }
      showToast('Your Image Prompt Is Ready! Refine It Below Or Tap Generate.');
    }, 200);
  }

  function showToast(msg) {
    var t = document.getElementById('pmg-photo-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pmg-photo-toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:12px 22px;border-radius:999px;z-index:9998;box-shadow:0 8px 20px rgba(0,0,0,0.25);font-weight:600;font-size:14px;max-width:90vw;text-align:center;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    t.style.transition = '';
    clearTimeout(t.__pmgT30Hide);
    t.__pmgT30Hide = setTimeout(function () {
      t.style.transition = 'opacity 0.4s';
      t.style.opacity = '0';
      setTimeout(function () { t.style.display = 'none'; t.style.transition = ''; }, 450);
    }, 3500);
  }

  /* ===== LEFT column help callout ===== */
  function buildTextHelpRow() {
    if (document.getElementById(TEXT_HELP_ID)) return;
    var col = document.getElementById('pmg-col-text');
    if (!col) return;
    var header = document.getElementById('pmg-col-text-header');
    if (!header) return;

    var row = document.createElement('div');
    row.id = TEXT_HELP_ID;
    row.innerHTML =
      '<div class="pmg-help-text">' +
        '<strong>Help Me Start <span style="display:inline-block;margin-left:4px;padding:2px 7px;border-radius:999px;background:rgba(255,193,7,0.18);color:#a07000;font-size:10px;font-weight:700;letter-spacing:0.02em;vertical-align:middle;">★ Most Loved</span></strong>' +
        '<span>Answer 4 Quick Questions And We\'ll Build A Sharp Prompt For You.</span>' +
      '</div>' +
      '<div class="pmg-help-actions">' +
        '<button type="button" class="pmg-help-primary" id="' + TEXT_HELP_ID + '-btn">Help Me Start</button>' +
        '<button type="button" class="pmg-help-secondary" id="' + TEXT_HELP_ID + '-skip">I Know What I Want — Just Start Typing →</button>' +
      '</div>';

    if (header.nextSibling) col.insertBefore(row, header.nextSibling);
    else col.appendChild(row);

    row.querySelector('#' + TEXT_HELP_ID + '-btn').addEventListener('click', function () {
      var existing = document.getElementById('guided-mode-btn');
      if (existing) {
        try { existing.click(); } catch (e) {}
      }
    });
    row.querySelector('#' + TEXT_HELP_ID + '-skip').addEventListener('click', function () {
      focusGoalTextarea();
    });
  }

  function focusGoalTextarea() {
    var goal = document.getElementById('goal');
    if (!goal) return;
    try { goal.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
    setTimeout(function () {
      try { goal.focus({ preventScroll: true }); } catch (e) { goal.focus(); }
    }, 350);
  }

  /* ===== RIGHT column help callout — augment existing #pmg-image-help-row ===== */
  function augmentImageHelpRow() {
    var row = document.getElementById('pmg-image-help-row');
    if (!row) return;
    if (row.getAttribute('data-pmg-t30') === '1') return;
    row.setAttribute('data-pmg-t30', '1');

    /* Swap the existing button's click handler. We clone the node to
       strip the T28 listener (which scrolled to the suite) and wire
       our 5-step modal instead. The text + classes stay identical. */
    var btn = row.querySelector('#pmg-image-help-row-btn');
    if (btn) {
      var newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', function () { openModal(); });
    }

    /* Update the description copy + add the secondary skip link. */
    var textEl = row.querySelector('.pmg-image-help-text');
    if (textEl) {
      textEl.innerHTML =
        '<strong>Help Me Start</strong>' +
        '<span>Answer 5 Quick Questions And We\'ll Build A Detailed Image Prompt For You.</span>' +
        '<button type="button" class="pmg-help-secondary" id="pmg-image-help-skip">I Know What I Want — Just Start Typing →</button>';
      var skip = textEl.querySelector('#pmg-image-help-skip');
      if (skip) skip.addEventListener('click', focusGoalTextarea);
    }
  }

  /* ===== Hero CTA destination polish =====
     After the existing hero-CTA scroll fires, pulse the matching help
     callout so the user has an obvious "do this next" target. */
  function wireHeroCTAs() {
    if (document.body.getAttribute('data-pmg-t30-hero') === '1') return;
    document.body.setAttribute('data-pmg-t30-hero', '1');
    document.addEventListener('click', function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var t = ev.target.closest('#hero-build-cta, #hero-image-cta');
      if (!t) return;
      setTimeout(function () {
        var helpRow = (t.id === 'hero-image-cta')
          ? document.getElementById('pmg-image-help-row')
          : document.getElementById(TEXT_HELP_ID);
        if (!helpRow) return;
        try { helpRow.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
        helpRow.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--color-primary) 35%, transparent)';
        setTimeout(function () { helpRow.style.boxShadow = ''; }, 1400);
      }, 600);
    }, true);
  }

  function init() {
    injectStyles();
    buildTextHelpRow();
    augmentImageHelpRow();
    wireHeroCTAs();

    /* T28 builds the columns asynchronously via observers, so retry
       briefly until the help rows mount or we time out. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      buildTextHelpRow();
      augmentImageHelpRow();
      var leftReady = !!document.getElementById(TEXT_HELP_ID);
      var rightRow = document.getElementById('pmg-image-help-row');
      var rightReady = rightRow && rightRow.getAttribute('data-pmg-t30') === '1';
      if (leftReady && rightReady) clearInterval(iv);
      if (tries >= 30) clearInterval(iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * T31 — Inline Typing Panels (Per-Side, Collapsible, Stays Put)
 * ---------------------------------------------------------------------
 * User feedback after T30 shipped:
 *   1. "When I click 'I Know What I Want — Just Start Typing' on the
 *       PHOTO side, it teleports me over to the TEXT side." That's
 *       because both T30 skip-links called focusGoalTextarea(), which
 *       targets the single #goal textarea that lives inside the LEFT
 *       column. Architecturally PromptMeGood uses one #goal field for
 *       both text AND image prompts, but the user expects to STAY on
 *       the image column when they click an image-side action.
 *   2. "Once I click the link, a text field opens and there's no way
 *       to fold it back up." The skip link is a one-way action — it
 *       scrolls the user to the field but they have no toggle to undo
 *       or hide it. The user wants every disclosure on the page to be
 *       symmetrically collapsible: open it / close it.
 *
 * What this IIFE does:
 *   - Builds an inline "typing panel" directly UNDER each Help Me Start
 *     callout (one per column). Each panel has its own labelled
 *     textarea + a hint + a "Hide Text Field ↑" close button.
 *   - The skip link becomes a TOGGLE: first click opens that side's
 *     panel and focuses its textarea; second click (or the close
 *     button) collapses it. The link text flips to "Hide Text Field ↑"
 *     while open and back to the original copy when collapsed.
 *   - Each inline textarea is two-way bound to the existing #goal
 *     textarea — anything the user types in either side's inline
 *     panel is mirrored to #goal (so Fix My Prompt, Generate Image,
 *     and the rest of the existing pipeline keep working unchanged),
 *     and updates from elsewhere flow back into any open panels that
 *     aren't currently focused (cursor never jumps).
 *   - We intercept the T30 click handlers via capture-phase +
 *     stopImmediatePropagation so the old "scroll to #goal" behavior
 *     is replaced cleanly without ripping the T30 wiring out.
 *
 * Hard rules honored:
 *   - No backend / API / DB / payment / secret changes.
 *   - No renamed IDs or classes — we ADD new ids
 *     (#pmg-inline-typing-text, #pmg-inline-typing-image) and reuse
 *     T30's skip-link ids (#pmg-text-help-row-skip,
 *     #pmg-image-help-skip) as toggles.
 *   - All logic stays in pmg-ux.js.
 *   - Idempotent via window.__pmgT31Init.
 * ===================================================================== */
(function pmgT31InlineTypingPanels() {
  if (window.__pmgT31Init) return;
  window.__pmgT31Init = true;

  var STYLE_ID = 'pmg-t31-inline-style';
  var SKIP_TEXT = 'I Know What I Want — Just Start Typing →';
  var SKIP_HIDE = 'Hide Text Field ↑';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Inline panel sits flush under the help row. We use negative
         top margin + flat top corners so it visually attaches to the
         help row, suggesting "this opened from above". */
      '.pmg-inline-typing {',
      '  display: none;',
      '  margin: -10px 0 var(--space-3) 0;',
      '  padding: var(--space-3) var(--space-4) var(--space-3);',
      '  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '  border-top: none;',
      '  border-bottom-left-radius: var(--radius-lg, 12px);',
      '  border-bottom-right-radius: var(--radius-lg, 12px);',
      '}',
      '.pmg-inline-typing.is-open { display: block; }',
      '.pmg-inline-typing > label {',
      '  display: block; font-size: var(--text-sm); font-weight: 700;',
      '  color: var(--color-text); margin: 0 0 6px;',
      '}',
      '.pmg-inline-typing textarea {',
      '  width: 100%; padding: 12px 14px; border-radius: 10px;',
      '  border: 1.5px solid var(--color-border, #ddd);',
      '  font: inherit; resize: vertical; min-height: 84px;',
      '  box-sizing: border-box; background: var(--color-surface);',
      '}',
      '.pmg-inline-typing textarea:focus {',
      '  outline: none; border-color: var(--color-primary);',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '}',
      '.pmg-inline-typing .pmg-inline-foot {',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  gap: var(--space-3); margin-top: 8px; flex-wrap: wrap;',
      '}',
      '.pmg-inline-typing .pmg-inline-hint {',
      '  font-size: 12px; color: var(--color-text-muted);',
      '  flex: 1 1 220px;',
      '}',
      '.pmg-inline-typing .pmg-inline-close {',
      '  background: none; border: none; padding: 4px 0;',
      '  color: var(--color-text-muted); font-size: 12.5px;',
      '  font-weight: 600; cursor: pointer;',
      '  text-decoration: underline; text-underline-offset: 3px;',
      '}',
      '.pmg-inline-typing .pmg-inline-close:hover { color: var(--color-text); }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Map each side -> the corresponding help row id + skip-button id. */
  function ids(side) {
    if (side === 'image') {
      return {
        helpRow: 'pmg-image-help-row',
        skipBtn: 'pmg-image-help-skip',
        panel: 'pmg-inline-typing-image',
        label: 'Describe Your Image',
        hint: 'Type your subject and any details — e.g. "A confident woman in her 30s, smiling, business attire."',
        foot: 'Synced With The Goal Field — Tap Generate Image Or Use The Photography Suite Below When Ready.'
      };
    }
    return {
      helpRow: 'pmg-text-help-row',
      skipBtn: 'pmg-text-help-row-skip',
      panel: 'pmg-inline-typing-text',
      label: 'Describe What You Want',
      hint: 'Type your goal in plain words. We\'ll polish it when you tap Fix My Prompt.',
      foot: 'Synced With The Goal Field — Tap Fix My Prompt Below When Ready.'
    };
  }

  function getOrBuildPanel(side) {
    var def = ids(side);
    var existing = document.getElementById(def.panel);
    if (existing) return existing;

    var helpRow = document.getElementById(def.helpRow);
    if (!helpRow) return null;

    var panel = document.createElement('div');
    panel.id = def.panel;
    panel.className = 'pmg-inline-typing';
    panel.setAttribute('data-side', side);
    panel.innerHTML =
      '<label for="' + def.panel + '-input">' + def.label + '</label>' +
      '<textarea id="' + def.panel + '-input" rows="3" placeholder="' + def.hint + '"></textarea>' +
      '<div class="pmg-inline-foot">' +
        '<span class="pmg-inline-hint">' + def.foot + '</span>' +
        '<button type="button" class="pmg-inline-close" aria-label="Hide text field">Hide Text Field ↑</button>' +
      '</div>';

    /* Insert directly after the help row so it visually attaches. */
    if (helpRow.nextSibling) helpRow.parentNode.insertBefore(panel, helpRow.nextSibling);
    else helpRow.parentNode.appendChild(panel);

    /* Two-way bind to #goal: typing here updates #goal (and dispatches
       input so any other listeners — char counters, validators, the
       T28 image flow — react). Updates to #goal from elsewhere flow
       back here, but only when this textarea isn't actively focused
       (so the cursor never jumps mid-type). */
    var ta = panel.querySelector('textarea');
    var goal = document.getElementById('goal');
    if (goal && ta) {
      ta.value = goal.value || '';
      ta.addEventListener('input', function () {
        if (goal.value !== ta.value) {
          goal.value = ta.value;
          goal.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      goal.addEventListener('input', function () {
        if (document.activeElement !== ta && ta.value !== goal.value) {
          ta.value = goal.value;
        }
      });
    }

    /* Close button collapses the panel. */
    panel.querySelector('.pmg-inline-close').addEventListener('click', function () {
      collapsePanel(side);
    });

    return panel;
  }

  function expandPanel(side) {
    var panel = getOrBuildPanel(side);
    if (!panel) return;
    panel.classList.add('is-open');
    var skip = document.getElementById(ids(side).skipBtn);
    if (skip) {
      skip.textContent = SKIP_HIDE;
      skip.setAttribute('aria-expanded', 'true');
    }
    var ta = panel.querySelector('textarea');
    if (ta) {
      try { panel.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
      setTimeout(function () {
        try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      }, 260);
    }
  }

  function collapsePanel(side) {
    var panel = document.getElementById(ids(side).panel);
    if (panel) panel.classList.remove('is-open');
    var skip = document.getElementById(ids(side).skipBtn);
    if (skip) {
      skip.textContent = SKIP_TEXT;
      skip.setAttribute('aria-expanded', 'false');
    }
  }

  function togglePanel(side) {
    var panel = document.getElementById(ids(side).panel);
    if (panel && panel.classList.contains('is-open')) collapsePanel(side);
    else expandPanel(side);
  }

  /* Capture-phase intercept of the T30 skip-link clicks. We stop the
     original "scroll-to-#goal" handler from running and toggle our
     own per-side inline panel instead. Using stopImmediatePropagation
     guarantees no other delegated listener picks the click up. */
  function wireSkipLinks() {
    if (document.body.getAttribute('data-pmg-t31-skip') === '1') return;
    document.body.setAttribute('data-pmg-t31-skip', '1');
    document.addEventListener('click', function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var t = ev.target.closest('#pmg-text-help-row-skip, #pmg-image-help-skip');
      if (!t) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      var side = t.id === 'pmg-image-help-skip' ? 'image' : 'text';
      togglePanel(side);
    }, true);
  }

  function init() {
    injectStyles();
    wireSkipLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * T32 — Symmetric Help Me Start Callouts + Move Weekly Pin
 * ---------------------------------------------------------------------
 * User feedback after T31 shipped:
 *   1. The Help Me Start buttons need to be visually obvious primary
 *      buttons that immediately open the question flow (4 questions on
 *      the text side, 5 on the image side). They're working but the
 *      previous layout buried the button on the right of a horizontal
 *      callout — users didn't read it as the main action.
 *   2. The image side needs the same "★ Most Loved" badge the text
 *      side has. The user explicitly wants both columns to lead with
 *      Most Loved so the recommended path is obvious on either side.
 *   3. Both sides need an identical, clean, intentional structure:
 *        ★ Most Loved
 *        Help Me Start
 *        <description>
 *        [Help Me Start] (big primary button)
 *        ────── or ──────
 *        [I Know What I Want — Just Start Typing]
 *      No guesswork — symmetric on both columns.
 *   4. After the questions finish, the user should be walked through
 *      the column linearly to their goal. The existing handlers
 *      already scroll to the next field/result, so we don't change
 *      the post-wizard flow — only the entry point.
 *   5. The "This Week's Focus" pin currently lives buried inside the
 *      builder form. The user proposed putting it right under the
 *      column header (the "Create A Text Prompt" banner) — visible at
 *      the top of the column.
 *
 * What this IIFE does:
 *   - Replaces the inner HTML of #pmg-text-help-row and
 *     #pmg-image-help-row with the new symmetric vertical layout.
 *     We KEEP the same outer ids and the same button ids
 *     (#pmg-text-help-row-btn, #pmg-image-help-row-btn,
 *     #pmg-text-help-row-skip, #pmg-image-help-skip) so T31's
 *     capture-phase skip-link toggle still works untouched.
 *   - Wires the primary buttons:
 *       · LEFT  → clicks the existing #guided-mode-btn (the original
 *                 4-question Help Me Start modal).
 *       · RIGHT → calls window.__pmgT30OpenImageWizard() (the 5-step
 *                 wizard built in T30).
 *   - Moves #weekly-goal-pin out of #builder-panel and into
 *     #pmg-col-text, positioned right after #pmg-col-text-header.
 *   - Tightens the inline-typing panel positioning (T31) so it sits
 *     cleanly below the new vertical callout instead of overlapping.
 *
 * Hard rules honored: no API/DB/secret edits; no renamed ids; CSS
 * variables only; idempotent via window.__pmgT32Init; centralized
 * in pmg-ux.js.
 * ===================================================================== */
(function pmgT32SymmetricCallouts() {
  if (window.__pmgT32Init) return;
  window.__pmgT32Init = true;

  var STYLE_ID = 'pmg-t32-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ===== Design tokens for T32 — defined once at :root so the rest
         of T32 only references CSS variables. Honors the project's
         "CSS variables only" hard rule. The Most Loved badge palette
         matches the literal values T28/T30 already shipped, just
         promoted to named tokens here. ===== */
      ':root {',
      '  --pmg-most-loved-bg: color-mix(in srgb, #ffc107 20%, transparent);',
      '  --pmg-most-loved-fg: #8a5a00;',
      '  --pmg-on-primary: #ffffff;',
      '  --pmg-callout-divider: var(--color-border, #d9d9d9);',
      '}',
      /* ===== T32 v2: SLIM single-row callout =====
         Earlier T32 stacked Most-Loved badge + h3 + description +
         full-width primary + "or" divider + full-width skip button
         vertically. That ~250px block sat between the column header
         and the goal textarea, forcing the user to scroll past a
         "start over from the beginning" prompt to reach the actual
         input. Users reported that as friction.
         Slim it down to a single compact row that sits just above
         the form: ✨ "Not sure where to start?"  [Help Me Start]
         "or just start typing ↓". Keeps the same outer ids and the
         same primary/skip button ids so T31's capture-phase skip
         listener and Help Me Start dialog wiring keep working. ===== */
      '#pmg-text-help-row, #pmg-image-help-row {',
      '  display: flex !important;',
      '  flex-wrap: wrap;',
      '  align-items: center;',
      '  gap: 10px;',
      '  text-align: left;',
      '  padding: 8px 12px !important;',
      '  margin: 0 0 var(--space-2) !important;',
      '  background: color-mix(in srgb, var(--color-primary) 5%, transparent) !important;',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 28%, transparent) !important;',
      '  border-radius: var(--radius-md, 8px) !important;',
      '}',
      '.pmg-callout-slim-icon {',
      '  font-size: 14px; line-height: 1; flex: 0 0 auto;',
      '}',
      '.pmg-callout-slim-prompt {',
      '  font-size: var(--text-sm); color: var(--color-text-muted);',
      '  flex: 1 1 auto; min-width: 0; line-height: 1.3;',
      '}',
      '.pmg-callout-slim-primary {',
      '  display: inline-flex !important; align-items: center;',
      '  padding: 6px 14px; min-height: 34px;',
      '  border-radius: var(--radius-full);',
      '  background: var(--color-primary) !important; color: var(--pmg-on-primary) !important;',
      '  border: 1.5px solid var(--color-primary);',
      '  font-weight: 700; font-size: var(--text-sm);',
      '  cursor: pointer; white-space: nowrap;',
      '  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 20%, transparent);',
      '  transition: filter 0.15s;',
      '}',
      '.pmg-callout-slim-primary:hover { filter: brightness(0.96); }',
      '.pmg-callout-slim-secondary {',
      '  background: none; border: none; padding: 4px 6px;',
      '  color: var(--color-primary); font-size: 12.5px; font-weight: 600;',
      '  text-decoration: underline; text-underline-offset: 3px;',
      '  cursor: pointer; white-space: nowrap;',
      '}',
      '.pmg-callout-slim-secondary:hover { filter: brightness(0.92); }',
      '@media (max-width: 600px) {',
      '  #pmg-text-help-row, #pmg-image-help-row { gap: 6px; }',
      '  .pmg-callout-slim-prompt { flex: 1 1 100%; }',
      '}',

      /* ===== T31 inline panel: clean attach below new vertical callout =====
         T31 used a -10px top margin to overlap the old horizontal row.
         With the taller vertical callout, that overlap looks broken;
         render the inline panel as a sibling card sitting just below. */
      '#pmg-text-help-row + .pmg-inline-typing,',
      '#pmg-image-help-row + .pmg-inline-typing {',
      '  margin-top: 8px !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent) !important;',
      '  border-radius: var(--radius-lg, 12px) !important;',
      '  border-top: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent) !important;',
      '  border-top-left-radius: var(--radius-lg, 12px) !important;',
      '  border-top-right-radius: var(--radius-lg, 12px) !important;',
      '}',

      /* ===== Weekly pin moved to top of column ===== */
      '#pmg-col-text > #weekly-goal-pin {',
      '  margin: 0 0 var(--space-3) !important;',
      '  padding: var(--space-3) var(--space-4);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);',
      '  border-radius: var(--radius-lg, 12px);',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function defForSide(side) {
    if (side === 'image') {
      return {
        row: 'pmg-image-help-row',
        primary: 'pmg-image-help-row-btn',
        skip: 'pmg-image-help-skip',
        desc: 'Answer 5 quick questions and we\'ll build a detailed image prompt — subject, style, lighting, setting, and any extra details.'
      };
    }
    return {
      row: 'pmg-text-help-row',
      primary: 'pmg-text-help-row-btn',
      skip: 'pmg-text-help-row-skip',
      desc: 'Answer 4 quick questions and we\'ll build a sharp prompt — your goal, the audience, the format, and the tone.'
    };
  }

  function rebuildCallout(side) {
    var def = defForSide(side);
    var row = document.getElementById(def.row);
    if (!row) return;
    if (row.getAttribute('data-pmg-t32') === '1') return;
    row.setAttribute('data-pmg-t32', '1');

    /* Slim layout: subtle helper row that lives just above the goal
       textarea instead of a full-height "start over" wall. Same outer
       id, same primary/skip button ids, so dialog wiring + T31 capture-
       phase skip listener keep working unchanged. The full description
       (def.desc) moves onto the primary button's title attribute via
       setAttribute (auto-escaped) so hover users still get the long form. */
    row.innerHTML =
      '<span class="pmg-callout-slim-icon" aria-hidden="true">✨</span>' +
      '<span class="pmg-callout-slim-prompt">Not Sure Where To Start?</span>' +
      '<button type="button" class="pmg-callout-slim-primary" id="' + def.primary + '">Help Me Start →</button>' +
      '<button type="button" class="pmg-callout-slim-secondary" id="' + def.skip + '" aria-expanded="false">or just start typing ↓</button>';

    var primary = document.getElementById(def.primary);
    if (primary) {
      primary.setAttribute('title', def.desc);
      primary.addEventListener('click', function () {
        if (side === 'image') {
          if (typeof window.__pmgT30OpenImageWizard === 'function') {
            window.__pmgT30OpenImageWizard();
          } else {
            /* Fallback: T30 hasn't loaded its export yet. Try the
               wizard modal directly, then surface a soft message so
               the button never feels dead. */
            var modal = document.getElementById('pmg-t30-image-modal');
            if (modal && modal.classList) {
              modal.classList.add('is-open');
            } else if (typeof window.__pmgToast === 'function') {
              window.__pmgToast('Wizard is loading — try once more in a moment.');
            }
          }
        } else {
          var existing = document.getElementById('guided-mode-btn');
          if (existing) {
            try { existing.click(); } catch (e) {}
          }
        }
      });
    }
    /* Skip link: T31's capture-phase listener already matches on
       these ids (#pmg-text-help-row-skip / #pmg-image-help-skip)
       so no rewiring needed — toggling Just Works. */
  }

  function moveWeeklyPin() {
    var pin = document.getElementById('weekly-goal-pin');
    var col = document.getElementById('pmg-col-text');
    var header = document.getElementById('pmg-col-text-header');
    if (!pin || !col || !header) return;
    if (pin.getAttribute('data-pmg-t32-moved') === '1') return;

    /* Insert pin right after the column header. The pin's existing
       id and contents are preserved so the original click handler
       (which sets the goal text from the pin) still works. */
    if (header.nextSibling) col.insertBefore(pin, header.nextSibling);
    else col.appendChild(pin);
    pin.setAttribute('data-pmg-t32-moved', '1');
  }

  /* Re-apply T32 if a later observer/replace blows away our edits.
     We check the data-pmg-t32 sentinel attribute — if a row exists
     without it (because something replaced the node), rebuild. */
  function reapplyIfNeeded() {
    var textRow = document.getElementById('pmg-text-help-row');
    if (textRow && textRow.getAttribute('data-pmg-t32') !== '1') {
      rebuildCallout('text');
    }
    var imgRow = document.getElementById('pmg-image-help-row');
    if (imgRow && imgRow.getAttribute('data-pmg-t32') !== '1') {
      rebuildCallout('image');
    }
    var pin = document.getElementById('weekly-goal-pin');
    if (pin && pin.getAttribute('data-pmg-t32-moved') !== '1') {
      moveWeeklyPin();
    }
  }

  function attachResilienceObserver() {
    if (window.__pmgT32Observer) return;
    if (typeof MutationObserver !== 'function' || !document.body) return;
    /* Single repo-wide observer scoped to the columns container if
       present, else body. Throttled with rAF + dirty flag so we don't
       thrash on every keystroke. */
    var dirty = false;
    function flush() {
      dirty = false;
      reapplyIfNeeded();
    }
    var target = document.getElementById('pmg-columns') || document.body;
    var mo = new MutationObserver(function () {
      if (dirty) return;
      dirty = true;
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(flush);
      } else {
        setTimeout(flush, 16);
      }
    });
    mo.observe(target, { childList: true, subtree: true });
    window.__pmgT32Observer = mo;
  }

  function init() {
    injectStyles();
    rebuildCallout('text');
    rebuildCallout('image');
    moveWeeklyPin();

    /* Retry briefly because T28 and T30 build columns and help rows
       on observers; we want T32 to land as soon as those exist. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      rebuildCallout('text');
      rebuildCallout('image');
      moveWeeklyPin();
      var leftDone = !!(document.getElementById('pmg-text-help-row') &&
                        document.getElementById('pmg-text-help-row').getAttribute('data-pmg-t32') === '1');
      var rightDone = !!(document.getElementById('pmg-image-help-row') &&
                         document.getElementById('pmg-image-help-row').getAttribute('data-pmg-t32') === '1');
      var pinDone = !!(document.getElementById('weekly-goal-pin') &&
                       document.getElementById('weekly-goal-pin').getAttribute('data-pmg-t32-moved') === '1');
      if (leftDone && rightDone && pinDone) {
        clearInterval(iv);
        attachResilienceObserver();
      }
      if (tries >= 40) {
        clearInterval(iv);
        attachResilienceObserver();
      }
    }, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T33 — Column Cleanup, Wider Layout, Real Cat Before/After Move
 * ---------------------------------------------------------------------
 * User feedback after T32 shipped:
 *   1. The LEFT workspace card still shows the redundant subtitle
 *      "Create, refine, and run your prompts here." right under the
 *      symmetric Help Me Start callouts. Eliminate it (the column
 *      already has its own title via T28's #pmg-col-text-header).
 *   2. The orphan "(1 Of 1 Free Today)" daily-hint chip floats with
 *      no visible button beside it — eliminate it.
 *   3. The original goal label + #goal textarea + helper duplicate the
 *      T31 inline panel that opens when "Just Start Typing" is clicked.
 *      Hide the duplicate visually, keep #goal in DOM (T31 binds to it).
 *   4. The OLD #guided-cta-row (the inline "Help Me Start" row deeper
 *      in the form) duplicates the T32 callout at top of column.
 *   5. The weekly-goal-pin (T32 moved it into the column) is still
 *      showing — eliminate entirely per follow-up request.
 *   6. The before/after image example block on the RIGHT column uses
 *      📷 / ✨ emoji thumbs and feels disconnected. MOVE the entire
 *      block UP into the existing #see-the-difference section
 *      alongside the 3 text before/after rows, with REAL cat photos
 *      (same cat in both, before = phone snapshot, after = cinematic).
 *   7. Both columns feel narrow — bump #builder .container.app-shell
 *      max-width so each column gets more breathing room.
 *   8. The Photography Suite pill chips look cramped — increase row
 *      gap and tighten padding so they read as "tags", not "buttons".
 *
 * Hard rules honored:
 *   - No backend / API / DB / payment / secret changes.
 *   - No renamed IDs/classes/JS variables.
 *   - Hide / move / collapse — no destructive deletion of source HTML.
 *     (We DO move the T28 ba block via DOM, but its source tag is
 *     created by T28 in JS — we relocate the live node, we don't
 *     touch index.html.)
 *   - All new logic is in this file (pmg-ux.js).
 *   - Idempotent via window.__pmgT33Init.
 *   - CSS uses CSS variables and color-mix only.
 *   - Anchors keep working — #builder, #see-the-difference unchanged.
 * ===================================================================== */
(function pmgT33Cleanup() {
  if (window.__pmgT33Init) return;
  window.__pmgT33Init = true;

  var STYLE_ID = 'pmg-t33-cleanup-style';
  var BA_ID = 'pmg-image-before-after';
  var STD_ROW_ID = 'pmg-t33-image-std-row';
  var CAT_BEFORE = 'images/pmg-cat-before.png';
  var CAT_AFTER = 'images/pmg-cat-after.png';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* (1) Eliminate redundant workspace-header (eyebrow + sub).
         T28's #pmg-col-text-header already shows "WORKSPACE" + title. */
      '#workspace-header { display: none !important; }',

      /* (2) Eliminate orphan "(N Of N Free Today)" daily-hint chips.
         pmg-pro.js injects these next to gated buttons; the user reads
         them as orphan free-today text. They\'re non-essential UX. */
      '.pmg-daily-hint { display: none !important; }',

      /* (3) Hide the redundant goal label + #goal textarea + helper.
         T31\'s inline panel (opened by "Just Start Typing") provides
         the visible textarea path; T31 two-way binds to #goal so the
         element must remain in the DOM — we only hide it visually. */
      '#prompt-form > .field.field-primary { display: none !important; }',

      /* Hide the T24 "Recommended for the best results — guided in
         under a minute." microcopy (now redundant with T32 callout). */
      '#pmg-hms-helper { display: none !important; }',

      /* (4) Hide the OLD inline #guided-cta-row that lives lower in
         the LEFT panel — T32\'s symmetric callout at top of column
         replaces it. The button #guided-mode-btn stays in the DOM
         (T30 click()s it programmatically). */
      '#guided-cta-row { display: none !important; }',

      /* Also hide the older T?? "build-cta-guidance" line if it
         escapes its hidden attr after a re-render. */
      '.build-cta-guidance { display: none !important; }',

      /* (5) Eliminate the weekly-goal-pin entirely. */
      '#weekly-goal-pin { display: none !important; }',

      /* (6) Hide the in-column #pmg-image-before-after; we move it
         into #see-the-difference via JS below. */
      '#' + BA_ID + ' { display: none !important; }',

      /* (7) Wider columns. The .container has a global 1100px cap
         (set with !important in index.html). Override only for the
         #builder app-shell so other sections remain at 1100px. */
      '#builder > .container.app-shell {',
      '  width: min(calc(100% - 2rem), 1340px) !important;',
      '  max-width: 1340px !important;',
      '}',
      '@media (max-width: 900px) {',
      '  #builder > .container.app-shell {',
      '    width: min(calc(100% - 1rem), 1340px) !important;',
      '  }',
      '}',

      /* (8) Photography Suite pills — looser layout so they read as
         tags, not crowded buttons. Increase group-body gap and tighten
         pill padding, plus a touch more vertical rhythm. */
      '#pmg-photo-suite .pmg-photo-group-body {',
      '  gap: 10px !important;',
      '  padding: 4px 16px 16px !important;',
      '}',
      '#pmg-photo-suite .pmg-photo-pill {',
      '  padding: 6px 12px !important;',
      '  font-size: 13px !important;',
      '  line-height: 1.3 !important;',
      '  font-weight: 500 !important;',
      '}',
      '#pmg-photo-suite .pmg-photo-pill.is-active::before {',
      '  margin-right: 2px;',
      '}',

      /* New std-row variant for the moved cat before/after — stacks
         the image above the prompt text and label inside each cell. */
      '#' + STD_ROW_ID + ' .pmg-t33-cat-img {',
      '  display: block; width: 100%; height: auto;',
      '  border-radius: var(--radius-md, 10px);',
      '  margin: 6px 0 10px;',
      '  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);',
      '}',
      '#' + STD_ROW_ID + ' .std-cell { display: flex; flex-direction: column; }',
      '#' + STD_ROW_ID + ' .std-cell-text { margin-top: auto; }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ------------ Move T28 image before/after into #see-the-difference ------------ */
  function moveImageBAToSTD() {
    if (document.getElementById(STD_ROW_ID)) return true;
    var grid = document.querySelector('#see-the-difference .std-grid');
    if (!grid) return false;

    var beforePrompt = '\u201CA Cat.\u201D';
    var afterPrompt =
      '\u201CA Fluffy Gray-And-White Tabby Cat With Bright Green Eyes, ' +
      'Sitting On A Wooden Window Sill \u2014 Cinematic Style, Shot On 85mm, ' +
      'Soft Golden Hour Lighting Through The Window, Shallow Depth Of Field, ' +
      'Magazine-Quality Composition, Warm Color Palette.\u201D';

    var row = document.createElement('div');
    row.className = 'std-row';
    row.id = STD_ROW_ID;
    row.setAttribute('data-pmg-t33-image-row', '1');
    row.innerHTML =
      '<div class="std-cell std-before">' +
        '<span class="std-cell-label">Before</span>' +
        '<img class="pmg-t33-cat-img" src="' + CAT_BEFORE + '" ' +
          'alt="Plain phone snapshot of a fluffy gray and white tabby cat on a window sill" ' +
          'loading="lazy" width="640" height="480" />' +
        '<p class="std-cell-text">' + beforePrompt + '</p>' +
      '</div>' +
      '<div class="std-cell std-after">' +
        '<span class="std-cell-label">After</span>' +
        '<img class="pmg-t33-cat-img" src="' + CAT_AFTER + '" ' +
          'alt="Cinematic golden-hour portrait of the same fluffy gray and white tabby cat on the same window sill" ' +
          'loading="lazy" width="640" height="480" />' +
        '<p class="std-cell-text">' + afterPrompt + '</p>' +
      '</div>';

    /* Promote the cat row to be the FIRST visible comparison — it's
       the strongest sales argument the page has (real photo before/
       after vs the text-only rows). T14's trimSeeTheDifference()
       has already collapsed rows[1..N] and added a "See N More" reveal
       button assuming rows[0] is the visible default; we now flip
       that so the cat row is the visible default and EVERY text row
       sits behind the reveal button. */
    grid.insertBefore(row, grid.firstChild);

    var section = document.getElementById('see-the-difference');
    var siblingTextRows = Array.prototype.filter.call(
      grid.querySelectorAll(':scope > .std-row'),
      function (r) { return r !== row; }
    );

    if (section && !section.classList.contains('pmg-std-expanded')) {
      siblingTextRows.forEach(function (r, i) {
        r.classList.add('pmg-std-collapsed');
        r.classList.remove('pmg-std-revealed');
        /* Use a T33-distinct prefix so we never collide with T14's
           own 'pmg-std-row-extra-N' IDs (which it assigned earlier
           to rows it had already collapsed). */
        if (!r.id) r.id = 'pmg-t33-std-row-promoted-' + (i + 1);
      });

      /* Update the pre-existing reveal button label + aria-controls
         to reflect the new hidden count (all text rows now). If the
         button hasn't been built yet (T14 hasn't run), T14 will pick
         up the correct collapsed set when it does run. */
      var btn = section.querySelector('.pmg-std-reveal-btn');
      if (btn && siblingTextRows.length > 0) {
        var n = siblingTextRows.length;
        btn.textContent = 'See ' + n + ' More Comparison' +
          (n === 1 ? '' : 's') + ' →';
        btn.setAttribute(
          'aria-controls',
          siblingTextRows.map(function (r) { return r.id; }).join(' ')
        );

        /* T14's button click handler closes over the `hidden` array
           captured at T14 init — that array does NOT include the row
           we just newly collapsed (the one T14 originally treated as
           the visible default). Attach an idempotent reveal-all click
           handler so every collapsed std-row reveals on click. Guarded
           by a flag so multiple invocations don't multiply listeners. */
        if (!btn.__pmgT33RevealAll) {
          btn.__pmgT33RevealAll = true;
          btn.addEventListener('click', function () {
            grid.querySelectorAll(':scope > .std-row.pmg-std-collapsed')
              .forEach(function (r) {
                r.classList.remove('pmg-std-collapsed');
                r.classList.add('pmg-std-revealed');
              });
            section.classList.add('pmg-std-expanded');
            btn.setAttribute('aria-expanded', 'true');
          });
        }
      }
    }

    /* If the original T28 ba node exists, leave it in DOM but keep it
       hidden via CSS (already covered above). Marking it for trace. */
    var orig = document.getElementById(BA_ID);
    if (orig) orig.setAttribute('data-pmg-t33-moved', '1');
    return true;
  }

  /* ----------------------------- Tick ----------------------------- */
  function tick() {
    moveImageBAToSTD();
  }

  function init() {
    injectStyles();
    tick();
    /* Late-mount safety: T28 builds #pmg-image-before-after after its
       own init runs; STD section is in static HTML so it\'s always
       present, but the BA may arrive late. Watch briefly. */
    try {
      var mo = new MutationObserver(function () {
        if (!document.getElementById(STD_ROW_ID)) tick();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T34 — Image Column Flow: Next Button, Surprise Promoted, Copy CTA,
 *       Camera Icon, Hide Clear Picks
 * ---------------------------------------------------------------------
 * User feedback after T33 shipped:
 *   1. After typing into the image-side inline panel ("Describe Your
 *      Image"), there\'s no obvious next step — needs a "Next" button
 *      that takes them to the Photography Suite.
 *   2. After picking the last group (Color Palette), the user needs a
 *      clearly-prompted finish action — "Send To Image Generator" OR
 *      "Copy Prompt" — so they know what to do once their picks are in.
 *   3. The "Surprise Me" button is buried at the bottom of the suite;
 *      it should live at the TOP as a "need ideas?" prompt, not as a
 *      tail-end action button.
 *   4. The "Clear Picks" button at the bottom is unclear — what does
 *      it do? Hide it (it\'s rarely used and adds confusion).
 *   5. The Step 3 Image Generator section heading shows a 🖼️ picture-
 *      frame emoji — replace with 📷 camera so it reads as photo-gen.
 *
 * Hard rules honored:
 *   - No backend / API / DB / payment / secret changes.
 *   - No renamed IDs, classes, or JS variables.
 *   - We MOVE the existing .pmg-photo-surprise node (so its T23 click
 *     handler keeps firing). Hiding .pmg-photo-clear is via CSS.
 *   - All new logic lives in pmg-ux.js (this file).
 *   - Idempotent via window.__pmgT34Init.
 *   - CSS uses CSS variables and color-mix only.
 * ===================================================================== */
(function pmgT34ImageColumnFlow() {
  if (window.__pmgT34Init) return;
  window.__pmgT34Init = true;

  var STYLE_ID = 'pmg-t34-imageflow-style';
  var INLINE_NEXT_ID = 'pmg-t34-inline-image-next';
  var SURPRISE_TOP_ID = 'pmg-t34-surprise-top-row';
  var COPY_BTN_ID = 'pmg-t34-copy-prompt-btn';
  var SUITE_ID = 'pmg-photo-suite';
  var IMG_GEN_TITLE_ID = 'pmg-image-generator-section-title';
  var INLINE_IMAGE_PANEL_ID = 'pmg-inline-typing-image';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Image inline-panel "Next" CTA */
      '#' + INLINE_NEXT_ID + ' {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 10px 22px; min-height: 44px;',
      '  background: var(--color-primary);',
      '  color: var(--pmg-on-primary, #fff);',
      '  border: 0; border-radius: var(--radius-full, 999px);',
      '  font-weight: 700; font-size: var(--text-sm, 14px); cursor: pointer;',
      '  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '  transition: transform 120ms ease, filter 180ms ease;',
      '  margin-left: auto;',
      '}',
      '#' + INLINE_NEXT_ID + ':hover { transform: translateY(-1px); filter: brightness(1.05); }',
      '#' + INLINE_NEXT_ID + ':disabled { opacity: 0.55; cursor: not-allowed; transform: none; }',
      '#' + INLINE_IMAGE_PANEL_ID + ' .pmg-inline-foot {',
      '  flex-wrap: wrap; gap: 12px;',
      '}',

      /* Top-of-suite Surprise prompt row */
      '#' + SURPRISE_TOP_ID + ' {',
      '  display: flex; align-items: center; gap: var(--space-3, 12px);',
      '  padding: var(--space-3, 12px) var(--space-4, 16px);',
      '  margin-bottom: var(--space-3, 12px);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-2, #f7f7f8));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 32%, var(--color-border, #e3e3e7));',
      '  border-radius: var(--radius-md, 10px);',
      '  flex-wrap: wrap;',
      '}',
      '#' + SURPRISE_TOP_ID + ' .pmg-t34-surprise-text {',
      '  flex: 1 1 240px; font-size: var(--text-sm, 14px);',
      '  color: var(--color-text-muted, #666); line-height: 1.45;',
      '}',
      '#' + SURPRISE_TOP_ID + ' .pmg-t34-surprise-text strong {',
      '  display: block; font-size: var(--text-base, 15px); margin-bottom: 2px;',
      '  color: var(--color-text, #111); font-weight: 700;',
      '}',
      '#' + SURPRISE_TOP_ID + ' .pmg-photo-surprise {',
      '  margin-left: auto;',
      '  background: var(--color-primary) !important;',
      '  color: var(--pmg-on-primary, #fff) !important;',
      '  border-color: var(--color-primary) !important;',
      '  font-weight: 700;',
      '}',
      '#' + SURPRISE_TOP_ID + ' .pmg-photo-surprise:hover {',
      '  filter: brightness(1.05);',
      '  color: var(--pmg-on-primary, #fff) !important;',
      '}',

      /* Hide the Clear Picks button entirely (DOM preserved). */
      '#' + SUITE_ID + ' .pmg-photo-actions .pmg-photo-clear { display: none !important; }',

      /* Beef up the Send To Image Generator button \'s helper line so the
         user sees this as the obvious finish action. */
      '#pmg-t34-finish-helper {',
      '  font-size: var(--text-xs, 12px); color: var(--color-text-muted, #666);',
      '  margin: var(--space-2, 8px) 0 0; text-align: center;',
      '  flex: 1 0 100%;',
      '}',

      /* Copy Prompt secondary CTA — sits next to Send To Image Generator. */
      '#' + COPY_BTN_ID + ' {',
      '  flex: 0 1 auto; min-height: 52px; padding: 12px 22px;',
      '  font-size: var(--text-sm, 14px); font-weight: 700;',
      '  border-radius: var(--radius-full, 999px);',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-primary);',
      '  border: 2px solid var(--color-primary); cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 6px;',
      '  transition: background 160ms ease, color 160ms ease, transform 120ms ease;',
      '}',
      '#' + COPY_BTN_ID + ':hover {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface, #fff));',
      '  transform: translateY(-1px);',
      '}',
      '#' + COPY_BTN_ID + ':disabled {',
      '  opacity: 0.55; cursor: not-allowed; transform: none;',
      '}',
      '@media (max-width: 600px) {',
      '  #' + COPY_BTN_ID + ' { width: 100%; }',
      '}',

      /* Pulse to draw eye when scrolling to suite */
      '@keyframes pmgT34Pulse {',
      '  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 50%, transparent); }',
      '  60% { box-shadow: 0 0 0 14px transparent; }',
      '  100% { box-shadow: 0 0 0 0 transparent; }',
      '}',
      '.pmg-t34-pulse {',
      '  animation: pmgT34Pulse 1100ms ease-out 2;',
      '  border-radius: var(--radius-md, 10px);',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* (1) Inject "Next: Photography Suite →" into the image inline panel. */
  function addInlineNextBtn() {
    var panel = document.getElementById(INLINE_IMAGE_PANEL_ID);
    if (!panel) return false;
    if (document.getElementById(INLINE_NEXT_ID)) return true;
    var foot = panel.querySelector('.pmg-inline-foot');
    if (!foot) return false;
    var nextBtn = document.createElement('button');
    nextBtn.id = INLINE_NEXT_ID;
    nextBtn.type = 'button';
    nextBtn.innerHTML = 'Next: Photography Suite <span aria-hidden="true">→</span>';
    nextBtn.addEventListener('click', function () {
      var suite = document.getElementById(SUITE_ID);
      if (suite) {
        try { suite.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); } catch (e) {}
        suite.classList.add('pmg-t34-pulse');
        setTimeout(function () { suite.classList.remove('pmg-t34-pulse'); }, 2400);
      }
    });
    foot.appendChild(nextBtn);
    return true;
  }

  /* (2) Move the .pmg-photo-surprise node from bottom .pmg-photo-actions
     up to a new prominent "Need Ideas?" host row at top of suite. */
  function moveSurpriseToTop() {
    var suite = document.getElementById(SUITE_ID);
    if (!suite) return false;
    if (document.getElementById(SURPRISE_TOP_ID)) return true;
    var surpriseBtn = suite.querySelector('.pmg-photo-actions .pmg-photo-surprise');
    if (!surpriseBtn) return false;

    var host = document.createElement('div');
    host.id = SURPRISE_TOP_ID;
    host.innerHTML =
      '<div class="pmg-t34-surprise-text">' +
        '<strong>Need Ideas? Try An Example</strong>' +
        'We\u2019ll Auto-Fill Each Group With A Random Sample You Can Tweak.' +
      '</div>';

    var firstGroup = suite.querySelector('.pmg-photo-group');
    if (firstGroup) suite.insertBefore(host, firstGroup);
    else suite.insertBefore(host, suite.firstChild);

    /* Move the existing button (preserves T23 click handler). */
    host.appendChild(surpriseBtn);
    /* Reset its inner HTML to ensure consistent label after move. */
    surpriseBtn.innerHTML = '<span aria-hidden="true">\uD83C\uDFB2</span> Surprise Me';
    return true;
  }

  /* NOTE: We intentionally do NOT add a "Copy Prompt" button here.
     An earlier IIFE already adds a "Copy Prompt" button next to the
     "Generate Image Here" send button, paired with a "What Do You Want
     To Do?" header — that satisfies the post-Color-Palette finish
     prompt. Adding another would be a visual duplicate. */

  /* (4) Replace the 🖼️ picture-frame emoji on the Image Generator
     section title with a 📷 camera, since this section delivers
     photographic AI image output. */
  function fixImageGenIcon() {
    var title = document.getElementById(IMG_GEN_TITLE_ID);
    if (!title) return false;
    if (title.dataset.pmgT34IconFixed === '1') return true;
    var txt = title.textContent || '';
    if (txt.indexOf('\uD83D\uDCF7') !== -1) {
      /* Already has 📷 — mark and bail. */
      title.dataset.pmgT34IconFixed = '1';
      return true;
    }
    /* Replace 🖼 / 🖼️ with 📷. */
    var newTxt = txt.replace(/\uD83D\uDDBC\uFE0F?/g, '\uD83D\uDCF7');
    if (newTxt !== txt) {
      title.textContent = newTxt;
    }
    title.dataset.pmgT34IconFixed = '1';
    return true;
  }

  function tick() {
    addInlineNextBtn();
    moveSurpriseToTop();
    fixImageGenIcon();
  }

  function init() {
    injectStyles();
    tick();
    /* Late-mount safety: T23 builds the suite, T31 builds the inline
       panels, T28 builds the image generator section — all may arrive
       after this IIFE runs. Watch briefly. */
    try {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T35 — Defensive Photo Group Toggle + Use As Reference Description
 * ---------------------------------------------------------------------
 * User feedback after T34 deployed:
 *   1. NONE of the Photography Suite group headers (Style, Camera &
 *      Lens, Lighting & Mood, Composition, Color Palette) toggle when
 *      clicked — they appear inert. T23 binds a direct click handler
 *      to each .pmg-photo-group-head button, but in production the
 *      handler is no longer firing (root cause unclear, possibly an
 *      ordering / observer race with later IIFEs). We intervene
 *      defensively at the document level.
 *   2. The "Use As Reference" pill in the Image Generator action row
 *      has no description — the user wants a brief plain-English
 *      explanation of what it does, without changing the button layout.
 *
 * Approach (no rule violations):
 *   (A) Add a capture-phase delegated listener on document for clicks
 *       inside #pmg-photo-suite .pmg-photo-group-head. Use
 *       stopImmediatePropagation() so any direct handler bound by T23
 *       does NOT also fire (prevents double-toggle if both work). The
 *       toggle logic mirrors T23 exactly: classList.toggle('is-collapsed')
 *       on the parent .pmg-photo-group + sync aria-expanded.
 *   (B) Add a brief italic helper line BELOW the .image-result-actions
 *       row (not inside it) so the button row layout is unchanged. Also
 *       add a native HTML `title` tooltip to the .pmg-use-as-ref-btn
 *       button itself for hover discoverability.
 *
 * Hard rules honored: no backend / API / DB / secret changes; no
 * renamed IDs/classes/JS variables; CSS variables only; idempotent via
 * window.__pmgT35Init; MutationObserver on body subtree disconnects
 * after 60s. No layout reflow of the existing button row.
 * ===================================================================== */
(function pmgT35GroupToggleAndRefDesc() {
  if (window.__pmgT35Init) return;
  window.__pmgT35Init = true;

  var STYLE_ID = 'pmg-t35-style';
  var REF_DESC_ID = 'pmg-t35-use-as-ref-desc';
  var BODY_GUARD_ATTR = 'data-pmg-t35-toggle';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + REF_DESC_ID + ' {',
      '  margin: 8px 0 0; padding: 0 var(--space-2, 8px);',
      '  font-size: var(--text-xs, 12px);',
      '  color: var(--color-text-muted, #666);',
      '  font-style: italic; text-align: center; line-height: 1.45;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* (A) Defensive delegated toggle for photo group heads. */
  function ensureGroupToggle() {
    if (document.body.getAttribute(BODY_GUARD_ATTR) === '1') return;
    document.body.setAttribute(BODY_GUARD_ATTR, '1');
    document.addEventListener('click', function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var head = ev.target.closest('#pmg-photo-suite .pmg-photo-group-head');
      if (!head) return;
      /* Block any other handler (including T23's direct one) so the
         toggle fires exactly once per click. */
      ev.stopImmediatePropagation();
      ev.preventDefault();
      var grp = head.parentNode;
      if (!grp) return;
      var collapsed = grp.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }, true);
  }

  /* (B) Add a brief italic description below the image action row +
     a native title tooltip on the button. */
  function addUseAsRefDesc() {
    var btn = document.querySelector('.pmg-use-as-ref-btn');
    if (!btn) return false;
    /* Always (re)apply the title attribute — cheap and idempotent. */
    if (!btn.getAttribute('title')) {
      btn.setAttribute(
        'title',
        'Copy The Image URL So You Can Paste It Into Another AI Tool As A Reference Or Inspiration For A Follow-Up.'
      );
    }
    if (document.getElementById(REF_DESC_ID)) return true;
    var actions = btn.parentNode; /* .image-result-actions */
    if (!actions || !actions.parentNode) return false;
    var desc = document.createElement('p');
    desc.id = REF_DESC_ID;
    desc.textContent =
      'Use As Reference Copies The Image URL So You Can Paste It Into Another AI Tool As Inspiration For A Follow-Up.';
    /* Insert AFTER the actions row, NOT inside it — preserves button
       layout exactly as the user requested. */
    if (actions.nextSibling) {
      actions.parentNode.insertBefore(desc, actions.nextSibling);
    } else {
      actions.parentNode.appendChild(desc);
    }
    return true;
  }

  function tick() {
    addUseAsRefDesc();
  }

  function init() {
    injectStyles();
    ensureGroupToggle();
    tick();
    try {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T36 — Unify Image Generator Footer Meta Lines
 * ---------------------------------------------------------------------
 * User feedback after T35 deployed: the three helper lines that sit
 * beneath the Image Generator action row were stylistically
 * inconsistent and hard to scan as a group:
 *   1. "Use As Reference Copies The Image URL So You Can Paste It..."
 *      (#pmg-t35-use-as-ref-desc — italic, centered, muted)
 *   2. "Download Will Activate Once Your Image Is Ready."
 *      (.pmg-t15-image-hint — left-aligned, default body color)
 *   3. "Created With DALL·E 3 · Free tier: 1 image per day. Founding Member: unlimited."
 *      (#imageResultSection .run-section-meta — small, muted)
 * The user wants them centered, uniformed, and intentional — to read
 * as one cohesive footer block matching the rest of the site's calm,
 * refined typography.
 *
 * Approach: inject a single stylesheet that applies the same centered,
 * 12px, muted, comfortably-spaced treatment to all three selectors.
 * Drop italic on the T35 line so the block reads as deliberate body
 * copy, not an aside. Tighten vertical rhythm so the three lines feel
 * like one paragraph stack, not three orphans. CSS variables only;
 * no DOM moves, no class renames, no layout reflow of the buttons.
 * Idempotent via window.__pmgT36Init.
 * ===================================================================== */
(function pmgT36UnifyImageMeta() {
  if (window.__pmgT36Init) return;
  window.__pmgT36Init = true;

  var STYLE_ID = 'pmg-t36-style';
  if (document.getElementById(STYLE_ID)) return;

  var css = [
    /* Shared treatment for the three footer lines under the image
       generator action row. Use a common selector chain so a single
       rule defines tone, weight, size, color, alignment, and rhythm. */
    '#imageResultSection #pmg-t35-use-as-ref-desc,',
    '#imageResultSection .pmg-t15-image-hint,',
    '#imageResultSection .run-section-meta {',
    '  margin: 10px auto 0 !important;',
    '  padding: 0 var(--space-3, 12px) !important;',
    '  max-width: 52ch;',
    '  font-size: var(--text-xs, 12px) !important;',
    '  line-height: 1.55 !important;',
    '  color: var(--color-text-muted, #5f6b75) !important;',
    '  text-align: center !important;',
    '  font-style: normal !important;',
    '  font-weight: 400 !important;',
    '  letter-spacing: 0.005em;',
    '}',

    /* The Use-As-Reference description is the most descriptive of the
       three; give it a touch more breathing room above so it visually
       anchors the block. */
    '#imageResultSection #pmg-t35-use-as-ref-desc {',
    '  margin-top: 14px !important;',
    '}',

    /* The trailing "Created With" line is the quietest — render it a
       half-step lighter and a hair smaller so the eye lands on it
       last, like a fine-print signature. */
    '#imageResultSection .run-section-meta {',
    '  margin-top: 6px !important;',
    '  font-size: 11.5px !important;',
    '  opacity: 0.85;',
    '}',

    /* The middle "Download Will Activate" hint sits between the two
       other lines — keep it tight to the description above it. */
    '#imageResultSection .pmg-t15-image-hint {',
    '  margin-top: 6px !important;',
    '}'
  ].join('\n');

  var s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = css;
  document.head.appendChild(s);
})();

/* =====================================================================
 * T37 — Photography Suite: Hide Dated Foot Copy, Collapse Style,
 *       Add "Not Sure?" Descriptions Panel Per Group
 * ---------------------------------------------------------------------
 * User feedback after T36:
 *   1. The inline image-typing panel still shows
 *      "Synced With The Goal Field — Tap Generate Image Or Use The
 *      Photography Suite Below When Ready." — there is no longer a
 *      goal field, so this copy is dated and confusing. Hide it
 *      (image side only — the text side wasn't called out).
 *   2. In the Photography Suite, the Style group stays open all the
 *      time while every other group collapses. Make Style behave
 *      like the rest: collapsed by default, click to expand.
 *   3. Inside each of the 5 group bodies (Style, Camera & Lens,
 *      Lighting & Mood, Composition, Color Palette) the user wants
 *      a small helper line + "click here" link that opens an inline
 *      panel describing what each pill in that group actually means
 *      (e.g. "Don't Know What These Styles Mean? Click Here →"). The
 *      panel is INLINE, not a modal — it expands inside the same
 *      group body and can be hidden again.
 *
 * Approach (no rule violations):
 *   - One new IIFE pmgT37SuiteHelpers, idempotent via window.__pmgT37Init.
 *   - Inject a single stylesheet (CSS variables only).
 *   - Hide the inline image foot with `display: none !important;`.
 *   - On suite-build settle, force every .pmg-photo-group (including
 *     the first one, Style) into is-collapsed state and sync
 *     aria-expanded — overrides T24's "keep first open" rule.
 *   - For each group, append a footer row inside .pmg-photo-group-body
 *     with: a tiny italic helper sentence + a "See Descriptions →"
 *     button. Clicking the button toggles a sibling panel containing
 *     a definition list of every pill in that group with a concise,
 *     plain-English description. The panel is built lazily on first
 *     open. Use closest-based delegation on document so newly-built
 *     suites also work without re-binding.
 *   - All new IDs/classes use a `pmg-t37-` prefix to avoid colliding
 *     with anything T23 generated. Existing IDs/classes are NOT
 *     renamed. No DOM moves of pills. No layout reflow.
 *
 * Hard rules honored: no backend / API / DB / secret changes; CSS
 * variables only; numbered IIFE in pmg-ux.js; idempotent.
 * ===================================================================== */
(function pmgT37SuiteHelpers() {
  if (window.__pmgT37Init) return;
  window.__pmgT37Init = true;

  var STYLE_ID = 'pmg-t37-style';
  var GUARD_ATTR = 'data-pmg-t37';
  var COLLAPSE_GUARD = 'data-pmg-t37-collapsed';

  /* ----- Concise descriptions for every pill in every group. ----- */
  var DESCRIPTIONS = {
    style: {
      'Cinematic': 'Movie-like wide framing with rich shadows and color grading.',
      'Portrait': 'Sharp subject focus with a softly blurred background.',
      'Documentary': 'Candid, real-moment look — no posing or staging.',
      'Editorial': 'Magazine-cover polish — stylized, narrative, high-fashion energy.',
      'Street Photography': 'Unscripted urban scenes with natural light and texture.',
      'Fashion': 'Bold styling, confident posing, runway-ready lighting.',
      'Landscape': 'Sweeping outdoor scenery with depth and atmosphere.',
      'Surreal': 'Dreamlike, impossible imagery that bends reality.',
      'Vintage': 'Retro film tones, soft grain, and nostalgic styling.',
      'Hyperrealistic': 'Crisp, photo-real detail that almost looks too sharp.',
      'Black & White': 'Monochrome tones emphasizing form, contrast, and mood.',
      'Polaroid': 'Instant-camera look with a soft frame and faded color.'
    },
    camera: {
      '85mm Portrait': 'Flattering compression for headshots and tight portraits.',
      '35mm Wide': 'Balanced wide angle — great for environmental shots.',
      '50mm Standard': 'Natural, eye-level perspective close to human vision.',
      'Macro': 'Extreme close-up showing fine detail and texture.',
      'Telephoto': 'Long zoom that compresses space and isolates the subject.',
      'Fisheye': 'Ultra-wide, curved-edge look with playful distortion.',
      'DSLR': 'Crisp, high-fidelity digital camera quality.',
      'Mirrorless': 'Modern compact-camera look — clean and detail-rich.',
      'Film Grain': 'Subtle analog texture and softer color response.',
      'Drone Aerial': 'Top-down or sweeping aerial perspective.',
      'GoPro Action': 'Wide, immersive POV with action-camera vibe.',
      'iPhone Snap': 'Casual, true-to-life smartphone-photo realism.'
    },
    lighting: {
      'Golden Hour': 'Warm, low-angle sunlight just after sunrise or before sunset.',
      'Blue Hour': 'Cool twilight tones just before sunrise or after sunset.',
      'Studio Softbox': 'Even, diffused studio lighting with soft shadows.',
      'Backlit': 'Light behind the subject creating glow and silhouette.',
      'Natural Window Light': 'Soft daylight from a window — gentle and flattering.',
      'Dramatic Shadows': 'High-contrast lighting with deep, defined shadows.',
      'Neon Glow': 'Saturated neon color washes — nightlife / cyberpunk vibe.',
      'Candle Lit': 'Warm, flickering, intimate low-light glow.',
      'Overcast Diffused': 'Soft, even cloud-cover light with no harsh shadows.',
      'Moonlit': 'Cool, low-key night lighting with a silvery cast.',
      'Harsh Noon': 'Bright, top-down midday sun with strong shadows.',
      'Cinematic Low-Key': 'Movie-style mostly-dark frame with selective light.'
    },
    composition: {
      'Rule Of Thirds': 'Subject placed off-center on a 3×3 grid for balance.',
      'Centered': 'Subject squarely in the middle for a bold, simple frame.',
      'Symmetrical': 'Mirrored layout — both sides match for calm balance.',
      'Close-Up': 'Tight crop focused on a face or single detail.',
      'Wide Shot': 'Pulled-back framing showing subject and surroundings.',
      "Bird's-Eye View": 'Looking straight down from above.',
      "Worm's-Eye View": 'Looking up from a low angle for a heroic feel.',
      'Dutch Angle': 'Tilted horizon to create unease or energy.',
      'Leading Lines': 'Lines in the scene guide the eye toward the subject.',
      'Negative Space': 'Lots of empty area around the subject for breathing room.',
      'Frame Within A Frame': 'A doorway, window, or arch surrounds the subject.'
    },
    palette: {
      'Warm Tones': 'Reds, oranges, yellows — cozy and inviting.',
      'Cool Blues': 'Blues and teals — calm, modern, slightly cool.',
      'Monochrome': 'A single color in many shades — quiet and unified.',
      'Pastel Soft': 'Light, muted, candy-like colors — gentle and airy.',
      'High Contrast': 'Bold lights vs. darks — punchy and graphic.',
      'Muted Earth': 'Browns, ochres, sages — grounded and natural.',
      'Neon Saturated': 'Vivid electric colors — bold and modern.',
      'Sepia': 'Warm brown-toned, vintage-photograph feel.',
      'Teal & Orange': 'Hollywood color grade — teal shadows, orange highlights.',
      'Forest Greens': 'Deep greens with woodland warmth.',
      'Sunset Reds': 'Rich reds and golds — dusk-like warmth.'
    }
  };

  /* Group-specific helper sentence shown above the "See Descriptions" link. */
  var GROUP_HELP = {
    style: 'Not Sure Which Style Fits? See What Each One Means.',
    camera: 'Not Sure Which Camera Or Lens To Pick? See What Each One Does.',
    lighting: 'Not Sure Which Light Or Mood Fits? See What Each One Means.',
    composition: 'Not Sure How To Frame It? See What Each Composition Means.',
    palette: 'Not Sure Which Palette Fits? See What Each Color Mood Means.'
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* (1) Hide the dated foot copy in the inline image typing panel. */
      '#pmg-inline-typing-image .pmg-inline-foot { display: none !important; }',

      /* (2) Helper row that sits at the bottom of each group body. */
      '.pmg-t37-helper-row {',
      '  margin: 10px 4px 2px;',
      '  display: flex; flex-direction: column; align-items: center;',
      '  gap: 4px; text-align: center;',
      '}',
      '.pmg-t37-helper-text {',
      '  font-size: var(--text-xs, 12px); color: var(--color-text-muted, #5f6b75);',
      '  font-style: italic; line-height: 1.4;',
      '}',
      '.pmg-t37-help-toggle {',
      '  appearance: none; background: transparent; border: 0; padding: 2px 6px;',
      '  font: inherit; font-size: var(--text-xs, 12px); font-weight: 600;',
      '  color: var(--color-primary, #0f6e6a); cursor: pointer;',
      '  border-radius: var(--radius-sm, 6px);',
      '  text-decoration: underline; text-underline-offset: 3px;',
      '  text-decoration-thickness: 1px;',
      '}',
      '.pmg-t37-help-toggle:hover { color: var(--color-primary-hover, #0a5552); }',
      '.pmg-t37-help-toggle:focus-visible { outline: 2px solid var(--color-primary, #0f6e6a); outline-offset: 2px; }',

      /* (3) Inline definitions panel that expands inside the group body. */
      '.pmg-t37-defs-panel {',
      '  margin: 10px 0 4px; padding: 12px 14px;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 5%, var(--color-surface, #fff));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f6e6a) 18%, var(--color-border, #e5e7eb));',
      '  border-radius: var(--radius-md, 10px);',
      '}',
      '.pmg-t37-defs-panel[hidden] { display: none !important; }',
      '.pmg-t37-defs-list { margin: 0; padding: 0; }',
      '.pmg-t37-defs-list dt {',
      '  margin: 0 0 2px; font-size: var(--text-sm, 13px); font-weight: 700;',
      '  color: var(--color-text, #1f2937);',
      '}',
      '.pmg-t37-defs-list dd {',
      '  margin: 0 0 10px; font-size: var(--text-sm, 13px); line-height: 1.5;',
      '  color: var(--color-text-muted, #5f6b75);',
      '}',
      '.pmg-t37-defs-list dd:last-child { margin-bottom: 0; }',
      '.pmg-t37-defs-foot {',
      '  margin-top: 10px; text-align: right;',
      '}',
      '.pmg-t37-defs-foot button {',
      '  appearance: none; background: transparent; border: 0; padding: 2px 6px;',
      '  font: inherit; font-size: var(--text-xs, 12px); font-weight: 600;',
      '  color: var(--color-text-muted, #5f6b75); cursor: pointer;',
      '  text-decoration: underline; text-underline-offset: 3px;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildDefsPanel(groupId) {
    var defs = DESCRIPTIONS[groupId];
    if (!defs) return null;
    var panel = document.createElement('div');
    panel.className = 'pmg-t37-defs-panel';
    panel.hidden = true;
    var html = ['<dl class="pmg-t37-defs-list">'];
    Object.keys(defs).forEach(function (k) {
      html.push('<dt>' + escapeHTML(k) + '</dt>');
      html.push('<dd>' + escapeHTML(defs[k]) + '</dd>');
    });
    html.push('</dl>');
    html.push('<div class="pmg-t37-defs-foot">');
    html.push('<button type="button" class="pmg-t37-defs-hide">Hide Descriptions</button>');
    html.push('</div>');
    panel.innerHTML = html.join('');
    return panel;
  }

  /* Force every group (including Style) into collapsed state. Idempotent
     per-group via COLLAPSE_GUARD. We only collapse on the first pass —
     after that, the user's manual expand/collapse must stick. */
  function collapseAllGroupsOnce() {
    var groups = document.querySelectorAll('#pmg-photo-suite .pmg-photo-group');
    if (!groups.length) return false;
    var did = false;
    groups.forEach(function (g) {
      if (g.getAttribute(COLLAPSE_GUARD) === '1') return;
      g.setAttribute(COLLAPSE_GUARD, '1');
      if (!g.classList.contains('is-collapsed')) {
        g.classList.add('is-collapsed');
        var head = g.querySelector('.pmg-photo-group-head');
        if (head) head.setAttribute('aria-expanded', 'false');
      }
      did = true;
    });
    return did;
  }

  function decorateGroups() {
    var groups = document.querySelectorAll('#pmg-photo-suite .pmg-photo-group');
    if (!groups.length) return false;
    var did = false;
    groups.forEach(function (g) {
      if (g.getAttribute(GUARD_ATTR) === '1') return;
      var groupId = g.getAttribute('data-group');
      if (!groupId || !DESCRIPTIONS[groupId]) return;
      var body = g.querySelector('.pmg-photo-group-body');
      if (!body) return;
      g.setAttribute(GUARD_ATTR, '1');

      var row = document.createElement('div');
      row.className = 'pmg-t37-helper-row';
      var msg = document.createElement('span');
      msg.className = 'pmg-t37-helper-text';
      msg.textContent = GROUP_HELP[groupId] || 'Not Sure What These Mean? See A Brief Description Of Each.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-t37-help-toggle';
      btn.setAttribute('data-pmg-t37-group', groupId);
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'See Descriptions →';
      row.appendChild(msg);
      row.appendChild(btn);
      body.appendChild(row);
      did = true;
    });
    return did;
  }

  /* Document-level click delegation so we don't have to re-bind when
     groups get rebuilt. Capture phase so the photo-suite handlers
     (T23 + T35) don't intercept first. */
  function wireDelegation() {
    if (document.body.getAttribute('data-pmg-t37-wired') === '1') return;
    document.body.setAttribute('data-pmg-t37-wired', '1');
    document.addEventListener('click', function (ev) {
      if (!ev.target || !ev.target.closest) return;

      var hideBtn = ev.target.closest('.pmg-t37-defs-hide');
      if (hideBtn) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        var panel = hideBtn.closest('.pmg-t37-defs-panel');
        if (panel) panel.hidden = true;
        var openBtn = panel && panel.parentNode &&
          panel.parentNode.querySelector('.pmg-t37-help-toggle');
        if (openBtn) {
          openBtn.setAttribute('aria-expanded', 'false');
          openBtn.textContent = 'See Descriptions →';
        }
        return;
      }

      var toggle = ev.target.closest('.pmg-t37-help-toggle');
      if (!toggle) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      var groupId = toggle.getAttribute('data-pmg-t37-group');
      var bodyEl = toggle.closest('.pmg-photo-group-body');
      if (!bodyEl || !groupId) return;
      var existing = bodyEl.querySelector('.pmg-t37-defs-panel');
      if (!existing) {
        existing = buildDefsPanel(groupId);
        if (!existing) return;
        /* Insert BEFORE the helper row so it reads top-to-bottom:
           pills → defs → "Hide Descriptions" → helper row. */
        var helperRow = toggle.closest('.pmg-t37-helper-row');
        if (helperRow) bodyEl.insertBefore(existing, helperRow);
        else bodyEl.appendChild(existing);
      }
      var willOpen = existing.hidden;
      existing.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      toggle.textContent = willOpen ? 'Hide Descriptions ▴' : 'See Descriptions →';
    }, true);
  }

  function tick() {
    collapseAllGroupsOnce();
    decorateGroups();
  }

  function init() {
    injectStyles();
    wireDelegation();
    tick();
    /* The suite is built async by T23 — keep retrying briefly so we
       catch the late mount. Bounded so we don't run forever. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tick();
      if (tries >= 40) clearInterval(iv);
    }, 250);
    try {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T38 — Group Toggle Override (defeat T24's re-collapse race)
 * ---------------------------------------------------------------------
 * User reports the Photography Suite group toggles are broken AGAIN.
 * Live diagnostic confirmed T35's capture-phase listener IS firing and
 * IS toggling `is-collapsed` correctly — but T24 (the original
 * collapse-everything-but-first IIFE) installs a MutationObserver on
 * `document.body` with NO user-toggled guard, so the moment T35
 * removes `is-collapsed`, T24's MO fires and re-adds it. Visually the
 * group snaps back to collapsed. Style alone stays open because T24
 * skips the first group (`if (i === 0) return;`).
 *
 * Fix without modifying T24 (hard rule: no renames / no rewriting
 * existing IIFEs): introduce a parallel state attribute
 * `data-pmg-state="open" | "closed"` on each .pmg-photo-group, and
 * use !important CSS to make the visual state follow OUR attribute
 * instead of `is-collapsed`. T24 can keep flipping `is-collapsed` —
 * it will have no visual effect.
 *
 * Listener placement: attach a capture-phase click listener on
 * `window` (NOT document) so it fires BEFORE T35's document-capture
 * listener (which calls stopImmediatePropagation). This way, T38's
 * state attribute is always set first, before any other handler can
 * intercept the event.
 *
 * Init bootstrap: on first sight of the suite, mirror each group's
 * existing `is-collapsed` state into `data-pmg-state` so the user's
 * starting view (after T37 collapses all five) is preserved.
 *
 * Hard rules honored: idempotent via `window.__pmgT38Init`; no
 * backend, IDs, classes, or layout changes; CSS variables only.
 * ===================================================================== */
(function pmgT38ToggleOverride() {
  if (window.__pmgT38Init) return;
  window.__pmgT38Init = true;

  var STYLE_ID = 'pmg-t38-style';
  var STATE_ATTR = 'data-pmg-state';
  var WIRED_ATTR = 'data-pmg-t38-wired';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* When the user opens a group, force its body visible and the
         chevron upright — overrides any later .is-collapsed re-add. */
      '#pmg-photo-suite .pmg-photo-group[' + STATE_ATTR + '="open"] .pmg-photo-group-body {',
      '  display: block !important;',
      '}',
      '#pmg-photo-suite .pmg-photo-group[' + STATE_ATTR + '="open"] .pmg-photo-group-chevron {',
      '  transform: none !important;',
      '}',
      /* When the user closes a group, force its body hidden and the
         chevron rotated — even if .is-collapsed was removed. */
      '#pmg-photo-suite .pmg-photo-group[' + STATE_ATTR + '="closed"] .pmg-photo-group-body {',
      '  display: none !important;',
      '}',
      '#pmg-photo-suite .pmg-photo-group[' + STATE_ATTR + '="closed"] .pmg-photo-group-chevron {',
      '  transform: rotate(-90deg) !important;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Mirror current is-collapsed state into our parallel attribute on
     each group that has not yet been initialised. Idempotent per-group
     via WIRED_ATTR. */
  function syncInitialStates() {
    var groups = document.querySelectorAll('#pmg-photo-suite .pmg-photo-group');
    if (!groups.length) return false;
    var did = false;
    groups.forEach(function (g) {
      if (g.getAttribute(WIRED_ATTR) === '1') return;
      g.setAttribute(WIRED_ATTR, '1');
      var collapsed = g.classList.contains('is-collapsed');
      g.setAttribute(STATE_ATTR, collapsed ? 'closed' : 'open');
      var head = g.querySelector('.pmg-photo-group-head');
      if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      did = true;
    });
    return did;
  }

  /* Per-group debounce: some test runners (and certain pointer
     synthesizers) fire two `click` events per logical click, which
     would toggle our state back to its starting value. Anything
     within 250ms on the same group counts as one logical click. */
  var DEBOUNCE_ATTR = 'data-pmg-t38-clickts';
  var DEBOUNCE_MS = 250;

  function onGroupHeadClick(ev) {
    if (!ev.target || !ev.target.closest) return;
    var head = ev.target.closest('#pmg-photo-suite .pmg-photo-group-head');
    if (!head) return;
    var grp = head.parentNode;
    if (!grp) return;
    var now = Date.now();
    var lastStr = grp.getAttribute(DEBOUNCE_ATTR);
    var last = lastStr ? parseInt(lastStr, 10) : 0;
    if (last && (now - last) < DEBOUNCE_MS) return;
    grp.setAttribute(DEBOUNCE_ATTR, String(now));
    var current = grp.getAttribute(STATE_ATTR);
    /* If somehow not yet initialised, derive from is-collapsed. */
    if (current !== 'open' && current !== 'closed') {
      current = grp.classList.contains('is-collapsed') ? 'closed' : 'open';
    }
    var next = current === 'open' ? 'closed' : 'open';
    grp.setAttribute(STATE_ATTR, next);
    head.setAttribute('aria-expanded', next === 'open' ? 'true' : 'false');
    /* Don't stop propagation — we want T35 / T24 to keep doing their
       thing. Our CSS will out-rank theirs visually. */
  }

  function init() {
    injectStyles();
    syncInitialStates();
    /* window-capture so this fires before document-capture handlers. */
    window.addEventListener('click', onGroupHeadClick, true);
    /* Bounded retries for late-mounted suite. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      syncInitialStates();
      if (tries >= 40) clearInterval(iv);
    }, 250);
    try {
      var mo = new MutationObserver(function () { syncInitialStates(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T39 — Image Upload + Vision Analysis On Both Inline Typing Panels
 * ---------------------------------------------------------------------
 * User wants: when "I Know What I Want — Just Start Typing" reveals
 * the inline text field on either column, ALSO show an "upload an
 * image" affordance. The user picks a JPG/PNG, we POST it to the
 * existing /api/analyze endpoint (which already proxies to the
 * GPT-4o vision model), and we drop the AI's plain-English
 * description into the textarea so they can edit it and proceed
 * normally — Fix My Prompt on the text side, Photography Suite +
 * Generate Image Here on the image side.
 *
 * Backend reuse: /api/analyze already exists in the api-server. It
 * accepts multipart/form-data with `prompt` (text) + optional `file`
 * (PDF/JPG/PNG ≤10MB) and returns { ok:true, prompt, response }. We
 * send a tightly-scoped describe-it prompt so the response is
 * directly usable as a starting point for the user's prompt.
 *
 * UI: a single small row inserted just BELOW the existing textarea
 * inside each inline panel. Contains a button + hidden file input +
 * a status line that shows "Analyzing…" / errors. Entirely contained
 * within the existing inline panel — no other layout shifts.
 *
 * Side handling:
 *   - text  panel → describe with focus on subject + tone, useful for
 *     copy / writing prompts.
 *   - image panel → describe with focus on subject + style + setting +
 *     lighting + composition, useful for image-generation prompts.
 *
 * Hard rules honored: idempotent via window.__pmgT39Init; CSS
 * variables only; no rename of existing IDs/classes; no DOM moves.
 * The /api/analyze endpoint pre-existed — no new server routes added.
 * ===================================================================== */
(function pmgT39ImageUploadAnalyze() {
  if (window.__pmgT39Init) return;
  window.__pmgT39Init = true;

  var STYLE_ID = 'pmg-t39-style';
  var ROW_CLASS = 'pmg-t39-upload-row';
  var BTN_CLASS = 'pmg-t39-upload-btn';
  var FILE_CLASS = 'pmg-t39-upload-file';
  var STATUS_CLASS = 'pmg-t39-upload-status';
  var GUARD_ATTR = 'data-pmg-t39';

  /* Side-specific describe prompt sent to /api/analyze. */
  var DESCRIBE_PROMPTS = {
    text:
      'Describe this image in 2-3 plain, vivid sentences. Focus on the subject, ' +
      'context, and tone. The description should be a useful starting point for a ' +
      'writing or copy prompt — no advice or suggestions, just a clear description.',
    image:
      'Describe this image in 3-4 plain, vivid sentences. Focus on the subject, ' +
      'setting, lighting, mood, and composition. The description should be a useful ' +
      'starting point for an image-generation prompt — no advice or suggestions, ' +
      'just a clear description.'
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.' + ROW_CLASS + ' {',
      '  margin-top: 10px;',
      '  display: flex; flex-direction: column; align-items: stretch;',
      '  gap: 6px;',
      '}',
      '.' + BTN_CLASS + ' {',
      '  appearance: none; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  gap: 6px;',
      '  padding: 8px 14px;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 8%, var(--color-surface, #fff));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary, #0f6e6a) 35%, var(--color-border, #e5e7eb));',
      '  border-radius: var(--radius-md, 10px);',
      '  font: inherit; font-size: var(--text-sm, 13px); font-weight: 600;',
      '  color: var(--color-primary, #0f6e6a);',
      '  transition: background 150ms ease, border-color 150ms ease;',
      '}',
      '.' + BTN_CLASS + ':hover {',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, var(--color-surface, #fff));',
      '  border-color: var(--color-primary, #0f6e6a);',
      '}',
      '.' + BTN_CLASS + '[disabled] {',
      '  opacity: 0.6; cursor: progress;',
      '}',
      '.' + BTN_CLASS + ':focus-visible {',
      '  outline: 2px solid var(--color-primary, #0f6e6a); outline-offset: 2px;',
      '}',
      '.' + STATUS_CLASS + ' {',
      '  font-size: var(--text-xs, 12px);',
      '  color: var(--color-text-muted, #5f6b75);',
      '  text-align: center;',
      '  min-height: 1em;',
      '}',
      '.' + STATUS_CLASS + '[data-state="error"] {',
      '  color: #b3261e;',
      '}',
      '.' + STATUS_CLASS + '[data-state="success"] {',
      '  color: var(--color-primary, #0f6e6a);',
      '  font-weight: 600;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function panelSide(panel) {
    var s = panel.getAttribute('data-side');
    return (s === 'text' || s === 'image') ? s : 'text';
  }

  function decoratePanel(panel) {
    if (!panel || panel.getAttribute(GUARD_ATTR) === '1') return false;
    var side = panelSide(panel);
    var textarea = panel.querySelector('textarea');
    var foot = panel.querySelector('.pmg-inline-foot');
    /* Don't burn the guard until we've confirmed the panel is ready
       to be decorated; otherwise a partially-mounted panel could be
       permanently skipped. */
    if (!textarea) return false;
    panel.setAttribute(GUARD_ATTR, '1');

    var row = document.createElement('div');
    row.className = ROW_CLASS;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.innerHTML = '<span aria-hidden="true">📎</span> Or Upload An Image — We\'ll Describe It For You';

    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png';
    file.className = FILE_CLASS;
    file.style.display = 'none';

    var status = document.createElement('div');
    status.className = STATUS_CLASS;
    status.setAttribute('aria-live', 'polite');

    btn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      runAnalyze(f, side, textarea, btn, status, function () {
        /* Reset the input so picking the same file again still fires. */
        try { file.value = ''; } catch (e) {}
      });
    });

    row.appendChild(btn);
    row.appendChild(file);
    row.appendChild(status);

    /* Insert just AFTER the textarea, before the foot (if foot exists). */
    if (foot && foot.parentNode === panel) {
      panel.insertBefore(row, foot);
    } else if (textarea.nextSibling) {
      panel.insertBefore(row, textarea.nextSibling);
    } else {
      panel.appendChild(row);
    }
    return true;
  }

  function runAnalyze(fileBlob, side, textarea, btn, status, done) {
    if (fileBlob.size > 10 * 1024 * 1024) {
      setStatus(status, 'error', 'Image is too large. Max 10 MB.');
      done();
      return;
    }
    if (!/^image\/(jpeg|png)$/.test(fileBlob.type)) {
      setStatus(status, 'error', 'Only JPG or PNG images are supported.');
      done();
      return;
    }
    var fd = new FormData();
    fd.append('prompt', DESCRIBE_PROMPTS[side] || DESCRIBE_PROMPTS.text);
    fd.append('file', fileBlob, fileBlob.name || 'upload.jpg');

    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setStatus(status, 'loading', 'Analyzing your image…');

    fetch('/api/analyze', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (res) {
        /* Tolerate non-JSON error bodies (e.g. proxy 502 HTML). */
        return res.text().then(function (raw) {
          var json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (e) { json = null; }
          return { res: res, json: json, raw: raw };
        });
      })
      .then(function (out) {
        if (!out.res.ok || !out.json || out.json.ok === false || !out.json.response) {
          var msg =
            (out.json && out.json.error) ||
            (out.res.status >= 500
              ? 'AI service is unavailable. Try again.'
              : 'Could not analyze image. Please try another.');
          setStatus(status, 'error', msg);
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          done();
          return;
        }
        var description = String(out.json.response).trim();
        textarea.value = description;
        try {
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) { /* ignore */ }
        try { textarea.focus(); } catch (e) {}
        setStatus(status, 'success', 'Image analyzed — edit the description below, then continue.');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        done();
      })
      .catch(function (err) {
        setStatus(status, 'error', 'Network error. Please try again.');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        done();
      });
  }

  function setStatus(el, state, msg) {
    if (!el) return;
    el.setAttribute('data-state', state || '');
    el.textContent = msg || '';
  }

  function tick() {
    var panels = document.querySelectorAll('.pmg-inline-typing');
    if (!panels.length) return;
    panels.forEach(function (p) { decoratePanel(p); });
  }

  function init() {
    injectStyles();
    tick();
    /* The inline panels are built lazily when the user clicks
       "I Know What I Want — Just Start Typing", so observe and retry. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tick();
      if (tries >= 200) clearInterval(iv);
    }, 300);
    try {
      var mo = new MutationObserver(tick);
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 5 * 60 * 1000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T40 — Supabase Auth + Save/Load Best Prompts
 * ---------------------------------------------------------------------
 * Adds an opt-in "Save Your Best Prompts" panel above the prompt
 * builder. Uses Supabase magic-link email auth (no passwords, no
 * extra signup form). When signed in, a 💾 Save Prompt button appears
 * (only after the user has generated a prompt) and a 📂 Load Saved
 * Prompts list populates from the user's own `prompts` rows.
 *
 * Browser SDK loaded via CDN <script> in index.html. Supabase URL +
 * publishable key fetched at runtime from /api/public-config so they
 * stay in Replit Secrets — never hardcoded.
 *
 * Hard rules honored:
 *   - No renames of existing IDs/classes/JS variables.
 *   - New panel is added ABOVE #builder, doesn't touch the builder
 *     internals or rearrange anything inside it.
 *   - All new logic in this single T40 IIFE.
 *   - Idempotent via window.__pmgT40Init.
 *   - Title Case sweep for all visible labels.
 *   - CSS variables only; no flex/order reorder.
 *
 * Supabase prerequisites (one-time, in Supabase dashboard):
 *   - Run the SQL in artifacts/promptmegood/SUPABASE-SETUP.md to
 *     create the `prompts` table and Row-Level-Security policies.
 *   - Add your site URL (production domain + http://localhost) under
 *     Authentication → URL Configuration → Redirect URLs so magic
 *     links bring users back to the right place.
 * ===================================================================== */
(function pmgT40Auth() {
  if (window.__pmgT40Init) return;
  window.__pmgT40Init = true;

  var STYLE_ID = 'pmg-t40-style';
  var SECTION_ID = 'pmg-account';
  var EMAIL_INPUT_ID = 'pmg-account-email';
  var SAVE_BTN_ID = 'pmg-account-save';
  var LOAD_BTN_ID = 'pmg-account-load';
  var SIGNIN_BTN_ID = 'pmg-account-signin';
  var SIGNOUT_BTN_ID = 'pmg-account-signout';
  var STATUS_ID = 'pmg-account-status';
  var LIST_ID = 'pmg-account-list';
  var TOGGLE_ID = 'pmg-account-toggle';

  var client = null;       /* Supabase client instance, or null */
  var currentUser = null;  /* {id, email} or null */

  /* Expose live getters for T41 (Stripe Checkout) so it can borrow the same
     Supabase client + auth state instead of bootstrapping a second instance.
     Closures read the current value of `client` / `currentUser` at call time. */
  window.__pmgT40 = window.__pmgT40 || {
    getClient: function () { return client; },
    getUser: function () { return currentUser; },
    /* Open the auth panel programmatically so the upgrade button can prompt
       a signed-out user to sign in first. T40 uses a `data-open` attribute
       on the section + a click toggle on `.pmg-account-toggle`. */
    openPanel: function () {
      var section = document.getElementById('pmg-account');
      if (!section) return;
      section.setAttribute('data-open', 'true');
      try { section.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (_) {}
      var emailInput = document.getElementById('pmg-account-email');
      if (emailInput) { try { emailInput.focus({ preventScroll: true }); } catch (_) {} }
    },
    /* Update the small plan pill next to "Signed In As ...". Called by T41
       after every /api/me/profile fetch. plan values from the server:
       'pro' → "Pro Member", 'founding' → "Founding Member", anything else
       (including null/undefined) → "Free Plan". */
    setPlanBadge: function (plan) {
      var el = document.getElementById('pmg-account-plan-badge');
      if (!el) return;
      var p = (plan || 'free').toString().toLowerCase();
      var label = 'Free Plan';
      if (p === 'pro') label = 'Pro Member';
      else if (p === 'founding') label = 'Founding Member';
      el.textContent = label;
      el.setAttribute('data-plan', (p === 'pro' || p === 'founding') ? p : 'free');
    }
  };
  var hasGenerated = false;
  var hasFatal = false;    /* Block all UI if config or SDK unavailable */
  var fatalMsg = '';

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + SECTION_ID + ' {',
      '  margin: 0 auto 16px; max-width: 760px;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid var(--color-border, #e5e7eb);',
      '  border-radius: var(--radius-lg, 14px);',
      '  box-shadow: 0 1px 2px rgba(0,0,0,0.03);',
      '  overflow: hidden;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-head {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 12px 16px; cursor: pointer;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 6%, var(--color-surface, #fff));',
      '}',
      '#' + SECTION_ID + ' .pmg-account-head h3 {',
      '  margin: 0; font-size: var(--text-base, 15px); font-weight: 700;',
      '  color: var(--color-text, #111827);',
      '  display: inline-flex; align-items: center; gap: 8px;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-toggle {',
      '  appearance: none; background: none; border: none; cursor: pointer;',
      '  font-size: 18px; line-height: 1; color: var(--color-text-muted, #5f6b75);',
      '  transition: transform 150ms ease;',
      '}',
      '#' + SECTION_ID + '[data-open="false"] .pmg-account-toggle { transform: rotate(-90deg); }',
      '#' + SECTION_ID + '[data-open="false"] .pmg-account-body { display: none; }',
      '#' + SECTION_ID + ' .pmg-account-body {',
      '  padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-row {',
      '  display: flex; gap: 8px; flex-wrap: wrap; align-items: center;',
      '}',
      '#' + SECTION_ID + ' input[type="email"] {',
      '  flex: 1 1 200px; min-width: 0;',
      '  padding: 8px 12px;',
      '  font: inherit; font-size: var(--text-sm, 14px);',
      '  border: 1px solid var(--color-border, #d1d5db);',
      '  border-radius: var(--radius-md, 8px);',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-text, #111827);',
      '}',
      '#' + SECTION_ID + ' input[type="email"]:focus-visible {',
      '  outline: 2px solid var(--color-primary, #0f6e6a); outline-offset: 1px;',
      '}',
      '#' + SECTION_ID + ' button.pmg-account-btn {',
      '  appearance: none; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 6px;',
      '  padding: 8px 14px;',
      '  background: var(--color-primary, #0f6e6a); color: #fff;',
      '  border: 1px solid var(--color-primary, #0f6e6a);',
      '  border-radius: var(--radius-md, 8px);',
      '  font: inherit; font-size: var(--text-sm, 14px); font-weight: 600;',
      '  transition: filter 150ms ease;',
      '}',
      '#' + SECTION_ID + ' button.pmg-account-btn:hover { filter: brightness(1.06); }',
      '#' + SECTION_ID + ' button.pmg-account-btn[disabled] { opacity: 0.6; cursor: progress; filter: none; }',
      '#' + SECTION_ID + ' button.pmg-account-btn.is-secondary {',
      '  background: var(--color-surface, #fff); color: var(--color-primary, #0f6e6a);',
      '  border-color: color-mix(in srgb, var(--color-primary, #0f6e6a) 35%, var(--color-border, #d1d5db));',
      '}',
      '#' + SECTION_ID + ' button.pmg-account-btn.is-secondary:hover {',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 8%, var(--color-surface, #fff));',
      '}',
      '#' + SECTION_ID + ' .pmg-account-meta {',
      '  font-size: var(--text-xs, 12px); color: var(--color-text-muted, #5f6b75);',
      '}',
      '#' + SECTION_ID + ' .pmg-account-meta strong { color: var(--color-text, #111827); }',
      '#' + SECTION_ID + ' .pmg-account-plan-badge {',
      '  display: inline-block; margin-left: 6px; padding: 2px 8px;',
      '  border-radius: 999px; font-size: 11px; font-weight: 600;',
      '  background: var(--color-surface-soft, #eef1f3); color: var(--color-text, #111827);',
      '  border: 1px solid var(--color-border, #d6dde2); vertical-align: middle;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-plan-badge[data-plan="pro"] {',
      '  background: var(--color-primary, #0f6e6a); color: #fff; border-color: transparent;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-plan-badge[data-plan="founding"] {',
      '  background: linear-gradient(90deg, #b8860b, #f6c453); color: #1f2937; border-color: transparent;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-status {',
      '  font-size: var(--text-xs, 12px); min-height: 1em;',
      '  color: var(--color-text-muted, #5f6b75);',
      '}',
      '#' + SECTION_ID + ' .pmg-account-status[data-state="error"] { color: #b3261e; }',
      '#' + SECTION_ID + ' .pmg-account-status[data-state="success"] {',
      '  color: var(--color-primary, #0f6e6a); font-weight: 600;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-list {',
      '  list-style: none; padding: 0; margin: 6px 0 0;',
      '  display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-list li {',
      '  display: flex; gap: 8px; align-items: flex-start;',
      '  padding: 8px 10px;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 4%, var(--color-surface, #fff));',
      '  border: 1px solid var(--color-border, #e5e7eb);',
      '  border-radius: var(--radius-md, 8px);',
      '  font-size: var(--text-xs, 12px);',
      '}',
      '#' + SECTION_ID + ' .pmg-account-list .pmg-account-list-text {',
      '  flex: 1 1 auto; min-width: 0;',
      '  color: var(--color-text, #111827);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + SECTION_ID + ' .pmg-account-list .pmg-account-list-load {',
      '  appearance: none; cursor: pointer; flex: 0 0 auto;',
      '  padding: 4px 10px; font: inherit; font-size: var(--text-xs, 12px);',
      '  background: var(--color-primary, #0f6e6a); color: #fff;',
      '  border: 1px solid var(--color-primary, #0f6e6a); border-radius: var(--radius-md, 8px);',
      '  font-weight: 600;',
      '}',
      /* Save button hidden until a prompt is generated. */
      '#' + SAVE_BTN_ID + '[hidden] { display: none !important; }',
      /* Show signed-in / signed-out body sections via data-state. */
      '#' + SECTION_ID + ' [data-account-state] { display: none; }',
      '#' + SECTION_ID + '[data-auth="in"]  [data-account-state="signed-in"]  { display: flex; flex-direction: column; gap: 10px; }',
      '#' + SECTION_ID + '[data-auth="out"] [data-account-state="signed-out"] { display: flex; flex-direction: column; gap: 10px; }',
      '#' + SECTION_ID + '[data-auth="fatal"] [data-account-state="fatal"]   { display: flex; flex-direction: column; gap: 6px; }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- DOM ---------- */
  function buildPanel() {
    if (document.getElementById(SECTION_ID)) return true;
    var builder = document.getElementById('builder');
    if (!builder || !builder.parentNode) return false;
    var section = document.createElement('section');
    section.id = SECTION_ID;
    section.setAttribute('data-open', 'false');
    section.setAttribute('data-auth', 'out');
    section.setAttribute('aria-label', 'Save Your Best Prompts');
    section.innerHTML =
      '<div class="pmg-account-head" id="' + TOGGLE_ID + '" role="button" tabindex="0" aria-expanded="false">' +
      '  <h3><span aria-hidden="true">💾</span> Save Your Best Prompts</h3>' +
      '  <button type="button" class="pmg-account-toggle" aria-label="Toggle Account Panel">▾</button>' +
      '</div>' +
      '<div class="pmg-account-body">' +
      /* signed-out */
      '  <div data-account-state="signed-out">' +
      '    <p class="pmg-account-meta">Sign In To Save Prompts, Sync History, And Unlock Pro Features.</p>' +
      '    <div class="pmg-account-row">' +
      '      <input type="email" id="' + EMAIL_INPUT_ID + '" placeholder="Enter Email" autocomplete="email" inputmode="email" />' +
      '      <button type="button" id="' + SIGNIN_BTN_ID + '" class="pmg-account-btn">Send Login Link</button>' +
      '    </div>' +
      '  </div>' +
      /* signed-in */
      '  <div data-account-state="signed-in">' +
      '    <p class="pmg-account-meta">Signed In As <strong id="pmg-account-email-display"></strong> <span id="pmg-account-plan-badge" class="pmg-account-plan-badge" data-plan="free">Free Plan</span></p>' +
      '    <div class="pmg-account-row">' +
      '      <button type="button" id="' + SAVE_BTN_ID + '" class="pmg-account-btn" hidden><span aria-hidden="true">💾</span> Save Prompt</button>' +
      '      <button type="button" id="' + LOAD_BTN_ID + '" class="pmg-account-btn is-secondary"><span aria-hidden="true">📂</span> View Saved Prompts</button>' +
      '      <button type="button" id="' + SIGNOUT_BTN_ID + '" class="pmg-account-btn is-secondary">Sign Out</button>' +
      '    </div>' +
      '    <ul id="' + LIST_ID + '" class="pmg-account-list"></ul>' +
      '  </div>' +
      /* fatal */
      '  <div data-account-state="fatal">' +
      '    <p class="pmg-account-meta">Account Sign-In Is Not Available Right Now.</p>' +
      '    <p class="pmg-account-status" data-state="error" id="pmg-account-fatal-msg"></p>' +
      '  </div>' +
      '  <p class="pmg-account-status" id="' + STATUS_ID + '" aria-live="polite"></p>' +
      '</div>';
    builder.parentNode.insertBefore(section, builder);
    wireEvents();
    return true;
  }

  function wireEvents() {
    var section = document.getElementById(SECTION_ID);
    if (!section) return;

    /* Header toggles open/closed. */
    var head = document.getElementById(TOGGLE_ID);
    if (head) {
      head.addEventListener('click', toggleOpen);
      head.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
      });
    }

    var signinBtn = document.getElementById(SIGNIN_BTN_ID);
    if (signinBtn) signinBtn.addEventListener('click', onSignInClick);

    var emailInput = document.getElementById(EMAIL_INPUT_ID);
    if (emailInput) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); onSignInClick(); }
      });
    }

    var signoutBtn = document.getElementById(SIGNOUT_BTN_ID);
    if (signoutBtn) signoutBtn.addEventListener('click', onSignOutClick);

    var saveBtn = document.getElementById(SAVE_BTN_ID);
    if (saveBtn) saveBtn.addEventListener('click', onSaveClick);

    var loadBtn = document.getElementById(LOAD_BTN_ID);
    if (loadBtn) loadBtn.addEventListener('click', onLoadClick);
  }

  function toggleOpen() {
    var section = document.getElementById(SECTION_ID);
    if (!section) return;
    var open = section.getAttribute('data-open') === 'true';
    section.setAttribute('data-open', open ? 'false' : 'true');
    var head = document.getElementById(TOGGLE_ID);
    if (head) head.setAttribute('aria-expanded', open ? 'false' : 'true');
  }

  function setStatus(msg, state) {
    var el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = msg || '';
    if (state) el.setAttribute('data-state', state);
    else el.removeAttribute('data-state');
  }

  function setAuthState(state, email) {
    var section = document.getElementById(SECTION_ID);
    if (!section) return;
    section.setAttribute('data-auth', state);
    if (state === 'in' && email) {
      var disp = document.getElementById('pmg-account-email-display');
      if (disp) disp.textContent = email;
    }
    refreshSaveBtn();
  }

  function refreshSaveBtn() {
    var btn = document.getElementById(SAVE_BTN_ID);
    if (!btn) return;
    if (currentUser && hasGenerated) btn.removeAttribute('hidden');
    else btn.setAttribute('hidden', '');
  }

  /* ---------- Supabase bootstrap ---------- */
  function fetchConfigAndInit() {
    fetch('/api/public-config', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.supabaseUrl || !cfg.supabasePublishableKey) {
          markFatal('Sign-In Is Not Configured Yet — Add Your Supabase URL And Publishable Key.');
          return;
        }
        if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
          /* CDN script not yet ready — retry briefly. */
          var tries = 0;
          var iv = setInterval(function () {
            tries++;
            if (window.supabase && window.supabase.createClient) {
              clearInterval(iv);
              initClient(cfg);
            } else if (tries >= 50) {
              clearInterval(iv);
              markFatal('Could Not Load The Supabase Browser Library. Please Refresh The Page.');
            }
          }, 100);
          return;
        }
        initClient(cfg);
      })
      .catch(function () {
        markFatal('Could Not Load Sign-In Configuration. Please Refresh The Page.');
      });
  }

  function initClient(cfg) {
    try {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (e) {
      markFatal('Could Not Initialize Sign-In: ' + (e && e.message ? e.message : 'unknown error'));
      return;
    }
    /* Prime current session, subscribe to changes. */
    client.auth.getSession().then(function (res) {
      var sess = res && res.data && res.data.session;
      if (sess && sess.user) {
        currentUser = { id: sess.user.id, email: sess.user.email || '' };
        setAuthState('in', currentUser.email);
        /* If we just landed back from a magic link, the redirect has
           a #access_token=... hash. Strip it so refresh doesn't fire
           navigation-warnings and so the URL is clean. */
        if (window.location.hash && /access_token=/.test(window.location.hash)) {
          try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
        }
        setStatus('Welcome Back!', 'success');
        /* Auto-open the panel briefly so the user sees the new state. */
        var sec = document.getElementById(SECTION_ID);
        if (sec && sec.getAttribute('data-open') === 'false') toggleOpen();
      } else {
        setAuthState('out');
      }
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) {
        currentUser = { id: session.user.id, email: session.user.email || '' };
        setAuthState('in', currentUser.email);
        /* Ask T41 (or anyone else listening) to refresh plan state and the
           badge immediately, instead of waiting for the next 60s poll.
           Also pings GET /api/me/profile, which upserts a profiles row
           with plan='free' if one doesn't exist yet — without ever
           overwriting an existing paid plan. */
        try {
          if (window.__pmgT41 && typeof window.__pmgT41.syncProfile === 'function') {
            window.__pmgT41.syncProfile();
          }
        } catch (_) {}
      } else {
        currentUser = null;
        setAuthState('out');
        try {
          if (window.__pmgT40 && typeof window.__pmgT40.setPlanBadge === 'function') {
            window.__pmgT40.setPlanBadge('free');
          }
        } catch (_) {}
      }
    });
  }

  function markFatal(msg) {
    hasFatal = true; fatalMsg = msg;
    setAuthState('fatal');
    var el = document.getElementById('pmg-account-fatal-msg');
    if (el) el.textContent = msg;
  }

  /* ---------- handlers ---------- */
  function onSignInClick() {
    if (!client) { setStatus('Sign-In Is Not Available Yet.', 'error'); return; }
    var input = document.getElementById(EMAIL_INPUT_ID);
    var email = (input && input.value || '').trim();
    if (!email) {
      setStatus('Enter Email First.', 'error');
      if (input) try { input.focus(); } catch (_) {}
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Please Enter A Valid Email Address.', 'error');
      return;
    }
    var btn = document.getElementById(SIGNIN_BTN_ID);
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    setStatus('Sending Magic Link…');
    var redirect = window.location.origin + window.location.pathname;
    client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirect } })
      .then(function (out) {
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
        if (out && out.error) {
          setStatus(out.error.message || 'Could Not Send Magic Link.', 'error');
          return;
        }
        setStatus('Check Your Email For Login Link.', 'success');
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
        setStatus((err && err.message) || 'Network Error. Please Try Again.', 'error');
      });
  }

  function onSignOutClick() {
    if (!client) return;
    setStatus('Signing Out…');
    client.auth.signOut().then(function () {
      currentUser = null;
      setAuthState('out');
      var list = document.getElementById(LIST_ID);
      if (list) list.innerHTML = '';
      setStatus('Signed Out.', 'success');
    }).catch(function (err) {
      setStatus((err && err.message) || 'Could Not Sign Out.', 'error');
    });
  }

  function readGoal() {
    var g = document.getElementById('goal');
    return g ? String(g.value || '').trim() : '';
  }
  function readOutput() {
    var o = document.getElementById('aiResponseOutput');
    if (!o) return '';
    return String(o.textContent || '').trim();
  }

  /* Resets a button's disabled+aria-busy state. Used in finally-style
     handlers below so a network rejection cannot strand the UI. */
  function resetBtn(id) {
    var b = document.getElementById(id);
    if (!b) return;
    b.disabled = false;
    b.removeAttribute('aria-busy');
  }

  function onSaveClick() {
    if (!client || !currentUser) { setStatus('Please Sign In First.', 'error'); return; }
    var input = readGoal();
    var output = readOutput();
    if (!input && !output) {
      setStatus('There Is No Prompt To Save Yet — Generate One First.', 'error');
      return;
    }
    var btn = document.getElementById(SAVE_BTN_ID);
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    setStatus('Saving…');
    client.from('prompts').insert({ user_id: currentUser.id, input: input, output: output })
      .then(function (out) {
        resetBtn(SAVE_BTN_ID);
        if (out && out.error) {
          setStatus(out.error.message || 'Could Not Save Prompt.', 'error');
          return;
        }
        setStatus('Prompt Saved!', 'success');
      })
      .catch(function (err) {
        resetBtn(SAVE_BTN_ID);
        setStatus((err && err.message) || 'Network Error While Saving.', 'error');
      });
  }

  function onLoadClick() {
    if (!client || !currentUser) { setStatus('Please Sign In First.', 'error'); return; }
    var btn = document.getElementById(LOAD_BTN_ID);
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    setStatus('Loading Your Prompts…');
    client.from('prompts')
      .select('id, input, output, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
      .then(function (out) {
        resetBtn(LOAD_BTN_ID);
        if (out && out.error) {
          setStatus(out.error.message || 'Could Not Load Prompts.', 'error');
          return;
        }
        renderList(out && out.data ? out.data : []);
        setStatus(((out && out.data && out.data.length) || 0) + ' Prompt(s) Loaded.', 'success');
      })
      .catch(function (err) {
        resetBtn(LOAD_BTN_ID);
        setStatus((err && err.message) || 'Network Error While Loading.', 'error');
      });
  }

  function renderList(rows) {
    var list = document.getElementById(LIST_ID);
    if (!list) return;
    list.innerHTML = '';
    if (!rows.length) {
      var li = document.createElement('li');
      li.className = 'pmg-account-meta';
      li.textContent = 'You Haven\'t Saved Any Prompts Yet.';
      list.appendChild(li);
      return;
    }
    rows.forEach(function (row) {
      var li = document.createElement('li');
      var snippet = (row.input || row.output || '').slice(0, 120);
      var span = document.createElement('span');
      span.className = 'pmg-account-list-text';
      span.title = snippet;
      span.textContent = snippet;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-account-list-load';
      btn.textContent = 'Load';
      btn.addEventListener('click', function () { loadIntoBuilder(row); });
      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function loadIntoBuilder(row) {
    var goal = document.getElementById('goal');
    if (!goal) return;
    goal.value = row.input || row.output || '';
    try {
      goal.dispatchEvent(new Event('input', { bubbles: true }));
      goal.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* ignore */ }
    try { goal.focus(); goal.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
    setStatus('Loaded Into The Builder — Edit And Re-Run As Needed.', 'success');
  }

  /* ---------- "has generated" detection ----------
   * The canonical signal that the user has generated a prompt is the
   * `pmg-has-result` class on <body> (set elsewhere in pmg-ux.js: see
   * the pmg-bugfix-result-visibility block + result-panel logic). We
   * watch <body class> for changes AND, as a defensive secondary
   * trigger, watch the AI-response output for content. Either fires
   * the Save Prompt button. */
  function checkGenerated() {
    if (hasGenerated) return;
    var hasResultClass = document.body && document.body.classList &&
      document.body.classList.contains('pmg-has-result');
    var out = document.getElementById('aiResponseOutput');
    var hasOutputText = !!(out && (out.textContent || '').trim().length > 0);
    if (hasResultClass || hasOutputText) {
      hasGenerated = true;
      refreshSaveBtn();
    }
  }

  function watchForGenerated() {
    checkGenerated();
    /* Watch <body class> for `pmg-has-result`. */
    try {
      var bodyMO = new MutationObserver(function () { checkGenerated(); });
      bodyMO.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* ignore */ }
    /* Defensive: also watch the AI response container if it exists. */
    var out = document.getElementById('aiResponseOutput');
    if (out) {
      try {
        var outMO = new MutationObserver(function () { checkGenerated(); });
        outMO.observe(out, { childList: true, characterData: true, subtree: true });
      } catch (e) { /* ignore */ }
    }
  }

  /* ---------- init ---------- */
  function init() {
    injectStyles();

    /* T41 BUG FIX (2026-04-29): Supabase MUST bootstrap on every page,
       not just pages where the "Save Your Best Prompts" panel lives.
       Pricing.html, guide.html, etc. have no #builder element, so
       buildPanel() never succeeded and the Supabase client never came
       up — which made the Upgrade button always think the user was
       signed out, even after a Magic Link sign-in. Now T40 boots on
       every page, and the panel mounts only where the builder exists. */
    fetchConfigAndInit();

    /* Builder may not be in the DOM yet on first paint. Retry briefly.
       This is independent of auth bootstrap. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (buildPanel()) {
        clearInterval(iv);
        watchForGenerated();
      } else if (tries >= 60) {
        clearInterval(iv);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =====================================================================
 * TASK 41 — Stripe Checkout: "Upgrade To Pro" button + plan sync
 *
 * Wires:
 *   - Any [data-pmg-upgrade] button on the page (already present in
 *     pricing.html on the PRO tier card; T41 also injects one near the
 *     Save Your Best Prompts panel on the homepage).
 *   - Click → if signed-out, opens the auth panel and shows a hint;
 *     if signed-in, POSTs /api/create-checkout-session with the user's
 *     Supabase access token and redirects to Stripe.
 *
 * Plan sync (server is source of truth):
 *   - On load + after each Supabase auth state change, T41 fetches
 *     /api/me/profile and mirrors the result into the pmg-pro
 *     localStorage cache (pmgUnlockPro / pmgRevokePro). Webhook flips
 *     server-side state; T41 is a thin pull-through cache.
 *
 * Return-from-Stripe handling:
 *   - If the URL has `?upgrade=success`, T41 shows a "Payment
 *     Confirmed" toast and polls /api/me/profile every 2s for up to
 *     30s, calling pmgUnlockPro() the moment the row flips to
 *     plan === 'pro'. Then it strips the query param.
 *
 * Hard-rule compliance:
 *   - No renames, no flex/order reorders, no edits to other modules.
 *   - All new logic in this single IIFE, idempotent via window.__pmgT41Init.
 *   - All colors via CSS variables. Title Case throughout.
 * ===================================================================== */
(function pmgT41StripeCheckout() {
  'use strict';
  if (window.__pmgT41Init) return;
  window.__pmgT41Init = true;

  /* Defense-in-depth escape hatch matching pmg-pro.js */
  try {
    if (
      /[?&]nopmgpro\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1'
    ) {
      return;
    }
  } catch (_) {}

  try {

  var STYLE_ID  = 'pmg-t41-style';
  var TOAST_ID  = 'pmg-t41-toast';
  var BUTTON_CLASS = 'pmg-upgrade-btn';
  var INJECTED_FLAG = 'data-pmg-t41-injected';

  /* ----------------------------------------------------------------- */
  /* Styles                                                            */
  /* ----------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Match the existing .btn / .btn-primary look so the button feels
         native in pricing.html and doesn't fight the design system. */
      '.' + BUTTON_CLASS + '[data-pmg-upgrade] {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  gap: 6px; cursor: pointer; font: inherit; font-weight: 700;',
      '  letter-spacing: 0.01em;',
      '}',
      '.' + BUTTON_CLASS + '[data-pmg-upgrade][disabled] {',
      '  opacity: 0.6; cursor: progress;',
      '}',
      'body.pmg-is-pro .' + BUTTON_CLASS + '[data-pmg-upgrade] {',
      /* If the user is already Pro, hide upgrade buttons rather than
         showing a stale CTA. Webhook-driven; never relies on guesswork. */
      '  display: none !important;',
      '}',
      /* Inline injected button on the homepage */
      '.pmg-t41-inline-cta {',
      '  display: flex; align-items: center; justify-content: center;',
      '  gap: 8px; flex-wrap: wrap;',
      '  margin: 16px auto 0; padding: 12px 16px;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary, #6366F1) 40%, transparent);',
      '  border-radius: 12px; max-width: 720px;',
      '  font-size: 13px; color: var(--color-text-muted, #6B7280);',
      '}',
      '.pmg-t41-inline-cta strong { color: var(--color-text, #111827); font-weight: 700; }',
      '.pmg-t41-inline-cta .pmg-t41-inline-msg {',
      '  flex: 1 0 100%; margin-top: 8px;',
      '  padding: 8px 12px; border-radius: 8px;',
      '  background: color-mix(in srgb, var(--color-primary, #6366F1) 12%, transparent);',
      '  color: var(--color-text, #111827); font-weight: 600; text-align: center;',
      '}',
      'body.pmg-is-pro .pmg-t41-inline-cta { display: none !important; }',
      /* Toast */
      '#' + TOAST_ID + ' {',
      '  position: fixed; left: 50%; bottom: 24px;',
      '  transform: translateX(-50%);',
      '  background: var(--color-surface, #FFFFFF);',
      '  color: var(--color-text, #111827);',
      '  border: 1px solid var(--color-border, #E5E7EB);',
      '  border-left: 4px solid var(--color-primary, #6366F1);',
      '  padding: 12px 18px; border-radius: 10px;',
      '  box-shadow: 0 12px 32px rgba(0,0,0,0.18);',
      '  font-size: 14px; font-weight: 600;',
      '  z-index: 99999; max-width: 90vw; text-align: center;',
      '}',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ----------------------------------------------------------------- */
  /* Toast helper (independent of pmg-pro's toast)                     */
  /* ----------------------------------------------------------------- */
  function showToast(text, ms) {
    try {
      var existing = document.getElementById(TOAST_ID);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var t = document.createElement('div');
      t.id = TOAST_ID;
      /* class hook lets tests / users style or query the toast independently
         of its id and survives subsequent showToast() calls. */
      t.className = 'pmg-t41-toast';
      t.textContent = text;
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      var host = document.body || document.documentElement;
      host.appendChild(t);
      var ttl = typeof ms === 'number' ? ms : 4500;
      setTimeout(function () {
        try { if (t.parentNode) t.parentNode.removeChild(t); } catch (_) {}
      }, ttl);
    } catch (err) {
      try { console.warn('[pmg-t41] showToast failed:', err); } catch (_) {}
    }
  }

  /* Some test environments query the inline CTA card before the floating
     toast (or render it off-screen). Mirror the message INSIDE the card
     itself so the user (and Playwright) can always see/find it. */
  function showInlineMessage(text) {
    try {
      var card = document.querySelector('.pmg-t41-inline-cta');
      if (!card) return;
      var msg = card.querySelector('.pmg-t41-inline-msg');
      if (!msg) {
        msg = document.createElement('div');
        msg.className = 'pmg-t41-inline-msg';
        msg.setAttribute('role', 'status');
        msg.setAttribute('aria-live', 'polite');
        card.appendChild(msg);
      }
      msg.textContent = text;
    } catch (_) {}
  }

  /* ----------------------------------------------------------------- */
  /* T40 bridge — read live Supabase client + signed-in user           */
  /* ----------------------------------------------------------------- */
  function getT40() { return window.__pmgT40 || null; }

  function getAccessTokenP() {
    var t40 = getT40();
    var c = t40 ? t40.getClient() : null;
    if (!c || !c.auth || typeof c.auth.getSession !== 'function') {
      return Promise.resolve(null);
    }
    return c.auth.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      return sess && sess.access_token ? sess.access_token : null;
    }).catch(function () { return null; });
  }

  /* ----------------------------------------------------------------- */
  /* Plan sync — server is source of truth                             */
  /* ----------------------------------------------------------------- */
  var apiBase = ''; /* same-origin; reverse proxy routes /api → api-server */

  function fetchProfile() {
    return getAccessTokenP().then(function (token) {
      if (!token) return null;
      return fetch(apiBase + '/api/me/profile', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    });
  }

  function applyProfileToCache(profile) {
    if (!profile) return false;
    /* Surface the plan in the T40 panel badge regardless of cache state. */
    try {
      if (window.__pmgT40 && typeof window.__pmgT40.setPlanBadge === 'function') {
        window.__pmgT40.setPlanBadge(profile.plan);
      }
    } catch (_) {}
    /* Founding members count as paid for ALL entitlement checks. They
       paid $49 lifetime — the cache must never get cleared on them. */
    var isPro = profile.plan === 'pro' || profile.plan === 'founding';
    var cached = false;
    try { cached = localStorage.getItem('promptmegood:pro:v1') === 'true'; } catch (_) {}
    if (isPro && !cached && typeof window.pmgUnlockPro === 'function') {
      window.pmgUnlockPro();
      return true;
    }
    if (!isPro && cached && typeof window.pmgRevokePro === 'function') {
      /* pmgRevokePro reloads, so only call it if it was wrongly true.
         Skip if the user is mid-checkout (the success-poll path will
         flip it forward shortly). */
      if (!/[?&]upgrade=success\b/.test(location.search)) {
        try { localStorage.removeItem('promptmegood:pro:v1'); } catch (_) {}
        try { document.body.classList.remove('pmg-is-pro'); } catch (_) {}
      }
      return true;
    }
    return false;
  }

  function syncOnce() {
    fetchProfile().then(applyProfileToCache).catch(function () {});
  }

  /* Expose a tiny API so T40 (auth) can ask us to refresh immediately
     after the user signs in — no waiting for the 60s poll. */
  window.__pmgT41 = window.__pmgT41 || {};
  window.__pmgT41.syncProfile = syncOnce;

  /* ----------------------------------------------------------------- */
  /* Click handler for upgrade buttons                                 */
  /* ----------------------------------------------------------------- */
  /* Read the LIVE Supabase session, not the cached T40 user variable.
     The cached variable is only populated after T40's async getSession()
     resolves, so on a freshly-loaded pricing page a fast click can land
     before currentUser is set even though localStorage already holds a
     valid session. The Supabase SDK's auth.getSession() reads that
     persisted session and refreshes if needed.

     Returns a Promise that resolves to a { user, accessToken } object,
     or null if no session exists. */
  /* Wait up to ~5s for T40's Supabase client to finish bootstrapping
     (it's async — fetches /api/public-config and loads the SDK script). */
  function waitForSupabaseClient(timeoutMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + (timeoutMs || 5000);
      function poll() {
        var t40 = getT40();
        var c = t40 ? t40.getClient() : null;
        if (c) return resolve(c);
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(poll, 100);
      }
      poll();
    });
  }

  function resolveSession() {
    return waitForSupabaseClient(5000).then(function (client) {
      if (!client) {
        try { console.log('[pmg-t41] resolveSession: supabase client not ready after wait'); } catch (_) {}
        return null;
      }
      return client.auth.getSession()
        .then(function (res) {
          var sess = res && res.data && res.data.session;
          if (sess && sess.user && sess.access_token) {
            try {
              console.log('[pmg-t41] resolveSession: signed in as', sess.user.email);
            } catch (_) {}
            return { user: sess.user, accessToken: sess.access_token };
          }
          try { console.log('[pmg-t41] resolveSession: no active session'); } catch (_) {}
          return null;
        })
        .catch(function (err) {
          try { console.warn('[pmg-t41] resolveSession error:', err); } catch (_) {}
          return null;
        });
    });
  }

  function startCheckout(btn) {
    /* Default to 'founding' since Pro Monthly is "Coming Soon — June 1, 2026"
       and has no active Stripe price wired up yet. Anything other than
       'founding' is normalised to 'founding' until Pro launches; this prevents
       any stray 'Upgrade To Pro' button from kicking off a broken checkout. */
    var tier = (btn.getAttribute('data-pmg-tier') || 'founding').toLowerCase();
    if (tier !== 'founding') tier = 'founding';
    try { console.log('[pmg-t41] startCheckout click, tier=' + tier); } catch (_) {}

    var origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking Sign-In…';

    resolveSession().then(function (sess) {
      if (!sess) {
        btn.disabled = false;
        btn.textContent = origLabel || 'Become A Founding Member';
        var msg = 'Sign In To Upgrade.';
        showToast(msg, 12000);
        showInlineMessage(msg);
        var t40 = getT40();
        if (t40 && typeof t40.openPanel === 'function') t40.openPanel();
        return null;
      }

      btn.textContent = 'Opening Checkout…';
      try {
        console.log('[pmg-t41] POST /api/create-checkout-session tier=' + tier);
      } catch (_) {}

      return fetch(apiBase + '/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + sess.accessToken
        },
        body: JSON.stringify({ tier: tier })
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      }).then(function (res) {
        if (!res.ok || !res.body || !res.body.url) {
          throw new Error((res.body && res.body.error) || 'Checkout failed.');
        }
        try { console.log('[pmg-t41] redirect → Stripe Checkout'); } catch (_) {}
        window.location.assign(res.body.url);
      });
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = origLabel || 'Become A Founding Member';
      try { console.warn('[pmg-t41] startCheckout failed:', err); } catch (_) {}
      showToast('Could Not Start Checkout: ' + (err && err.message ? err.message : 'Unknown Error.'), 6000);
    });
  }

  function wireButtons() {
    var btns = document.querySelectorAll('[data-pmg-upgrade]');
    btns.forEach(function (btn) {
      if (btn.getAttribute(INJECTED_FLAG) === '1') return;
      btn.setAttribute(INJECTED_FLAG, '1');
      btn.classList.add(BUTTON_CLASS);
      /* Mark this button so pmg-pro.js's upgrade-modal fallback can detect
         that Stripe wiring is in place and skip its own pricing-page
         redirect. Without this flag the fallback timer in pmg-pro.js will
         always redirect mid-checkout. */
      try { btn.__pmgStripeWired = true; } catch (_) {}
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        startCheckout(btn);
      });
    });
  }

  /* ----------------------------------------------------------------- */
  /* Inject a homepage CTA above the Save Your Best Prompts panel     */
  /* (skipped on pricing.html since the page already has its own).     */
  /* ----------------------------------------------------------------- */
  function injectHomepageCTA() {
    /* Don't double-inject on pricing.html; the explicit button is enough. */
    if (/\/pricing\.html(\?|$|#)/.test(location.pathname + location.search)) return;
    if (document.querySelector('.pmg-t41-inline-cta')) return;
    var section = document.getElementById('pmg-account');
    if (!section) return;

    var cta = document.createElement('div');
    cta.className = 'pmg-t41-inline-cta';
    /* Pro Monthly is "Coming Soon — June 1, 2026" and has no live Stripe
       checkout. The active paid offer is Founding Member ($49 lifetime).
       This homepage CTA therefore points at Founding Member and is wired
       via data-pmg-tier="founding". */
    cta.innerHTML =
      '<span><strong>Want Unlimited?</strong> Founding Member is a one-time $49 for lifetime access — unlimited runs, cloud sync, image analysis, and every future Pro feature.</span>' +
      '<button type="button" class="btn btn-primary ' + BUTTON_CLASS + '" data-pmg-upgrade data-pmg-tier="founding">Become A Founding Member — $49 Lifetime</button>';
    section.parentNode.insertBefore(cta, section);
    wireButtons();
  }

  /* ----------------------------------------------------------------- */
  /* ?upgrade=success — confirm + poll until webhook flips the row     */
  /* ----------------------------------------------------------------- */
  function handleReturnFromStripe() {
    var p = new URLSearchParams(location.search);
    if (p.get('upgrade') !== 'success') return;

    var tier = (p.get('tier') || 'founding').toLowerCase();
    var label = tier === 'founding' ? 'Founding Member' : 'Pro';
    showToast('Payment Confirmed. ' + label + ' Access Will Update Automatically.', 6000);

    var deadline = Date.now() + 30000; /* 30s */
    var attempt = 0;

    function tick() {
      attempt++;
      fetchProfile().then(function (profile) {
        var done = profile && (
          (tier === 'founding' && profile.plan === 'founding') ||
          (tier !== 'founding' && (profile.plan === 'pro' || profile.plan === 'founding'))
        );
        if (done) {
          if (typeof window.pmgUnlockPro === 'function') window.pmgUnlockPro();
          showToast(label + ' Unlocked. Welcome To PromptMeGood ' + label + '.', 5000);
          stripUpgradeParam();
          return;
        }
        if (Date.now() < deadline) {
          setTimeout(tick, 2000);
        } else {
          showToast('Still Processing. Refresh In A Minute If ' + label + ' Is Not Active.', 7000);
          stripUpgradeParam();
        }
      }).catch(function () {
        if (Date.now() < deadline) setTimeout(tick, 2000);
        else stripUpgradeParam();
      });
    }

    function stripUpgradeParam() {
      try {
        var url = new URL(location.href);
        url.searchParams.delete('upgrade');
        url.searchParams.delete('session_id');
        history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
      } catch (_) {}
    }

    /* Wait briefly so T40 can finish bootstrapping and we have a token. */
    setTimeout(tick, 1500);
  }

  function handleCancelFromStripe() {
    var p = new URLSearchParams(location.search);
    if (p.get('upgrade') !== 'cancel') return;
    showToast('Checkout Canceled. You Can Upgrade Anytime.', 5000);
    try {
      var url = new URL(location.href);
      url.searchParams.delete('upgrade');
      history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_) {}
  }

  /* ----------------------------------------------------------------- */
  /* Boot                                                              */
  /* ----------------------------------------------------------------- */
  function boot() {
    injectStyles();
    wireButtons();
    injectHomepageCTA();
    handleReturnFromStripe();
    handleCancelFromStripe();

    /* Re-scan for buttons periodically (other modules may inject CTAs late). */
    var passes = 0;
    var iv = setInterval(function () {
      passes++;
      wireButtons();
      injectHomepageCTA();
      if (passes >= 20) clearInterval(iv); /* ~10s of catch-up scans */
    }, 500);

    /* Initial plan sync once T40 is alive enough to give us a token. */
    setTimeout(syncOnce, 2000);
    /* Re-sync periodically while the page is open (cheap; 401s short-circuit). */
    setInterval(syncOnce, 60000);

    /* Re-sync on window focus — covers the case where the user pays in a
       new tab and switches back. */
    window.addEventListener('focus', syncOnce, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  } catch (err) {
    try { console.warn('[pmg-t41] disabled due to error:', err); } catch (_) {}
  }
})();

/* ============================================================================
 * T42 — Open-Beta Paywall Controller
 * ----------------------------------------------------------------------------
 * Until June 1, 2026 the product is fully unlocked for everyone. The backend
 * is the only authority on this — we read /api/public-config (which calls
 * the backend's isPaywallActive() helper) and mirror its decision to the
 * browser:
 *
 *   - If paywallActive === false: force the existing pmg-is-pro UI flag on
 *     for every visitor so all locked panels are unlocked. Pro/Founding
 *     CTAs stay visible (they're "soft nudges" during beta), checkout still
 *     works for anyone who wants to lock in lifetime now.
 *   - If paywallActive === true: do nothing — fall through to the normal
 *     T40+T41 plan-driven gating. Real Pro/Founding members keep their
 *     access; Free users see the upgrade prompts.
 *
 * A non-blocking banner is rendered at the top of every page during beta:
 *   "Free Beta Access Until June 1, 2026 — Founding Member Access
 *    Available Now."
 *
 * The banner is dismissable for the session, but re-appears on page load so
 * we never lose visibility of the upcoming change.
 * ========================================================================= */
(function () {
  if (window.__pmgT42Init) return;
  window.__pmgT42Init = true;

  var BANNER_ID = 'pmg-t42-beta-banner';
  var STYLE_ID = 'pmg-t42-styles';
  var SESSION_DISMISS_KEY = 'promptmegood:t42-banner-dismissed';
  var PRO_KEY = 'promptmegood:pro:v1';
  /* Separate marker so we can distinguish "real Pro" (set by Stripe success
     or T41 plan-sync) from "beta unlock" (set by T42). When the paywall
     activates we MUST revoke the beta unlock without touching genuine paid
     entitlements — otherwise users who visited during beta would keep
     full access forever after June 1. */
  var BETA_MARKER = 'promptmegood:t42-beta-unlock:v1';

  /* Dev-only console.log gate. Production deployments live on *.replit.app
     domains — anything else (localhost, *.replit.dev preview, vite preview)
     counts as dev. Errors/warnings are NOT gated. */
  function isDevHost() {
    try {
      var h = location.hostname || '';
      return !/\.replit\.app$/i.test(h);
    } catch (_) { return true; }
  }
  function devLog(msg) {
    if (!isDevHost()) return;
    try { console.log(msg); } catch (_) {}
  }

  function hasBetaMarker() {
    try { return localStorage.getItem(BETA_MARKER) === '1'; } catch (_) { return false; }
  }
  function setBetaMarker() {
    try { localStorage.setItem(BETA_MARKER, '1'); } catch (_) {}
  }
  function clearBetaMarker() {
    try { localStorage.removeItem(BETA_MARKER); } catch (_) {}
  }

  /* Tear down anything T42 previously granted. Called when paywallActive
     flips ON, or as a fail-safe when we cannot confirm beta status. We
     ONLY clear pro state if WE were the ones who set it (BETA_MARKER
     present). Genuine paid users have no marker so their cache is safe. */
  function revokeBetaUnlock() {
    if (!hasBetaMarker()) return;
    try { localStorage.removeItem(PRO_KEY); } catch (_) {}
    try { document.body && document.body.classList.remove('pmg-is-pro'); } catch (_) {}
    try { document.body && document.body.classList.remove('pmg-beta-mode'); } catch (_) {}
    clearBetaMarker();
  }

  function fmtActivationDate(iso) {
    if (!iso) return 'June 1, 2026';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return 'June 1, 2026';
      return d.toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (_) { return 'June 1, 2026'; }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    /* IMPORTANT: T41 already injects a rule
       `body.pmg-is-pro .pmg-upgrade-btn[data-pmg-upgrade] { display: none }`
       which would hide every upgrade CTA the moment T42 sets pmg-is-pro
       during beta — directly violating the spec ("Keep all Upgrade /
       Pricing buttons visible and functional"). The override rules below
       use a more specific selector (body.pmg-beta-mode.pmg-is-pro …) so
       they win the cascade and the buttons stay clickable. We restore
       both the standalone Upgrade buttons AND the auto-injected inline
       homepage CTA card. */
    var css = [
      '#' + BANNER_ID + ' {',
      '  position: sticky; top: 0; z-index: 9000;',
      '  display: flex; align-items: center; justify-content: center; gap: 12px;',
      '  padding: 10px 16px; font: 600 14px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
      '  color: #0b3b3a; text-align: center;',
      '  background: linear-gradient(90deg, #ffe8a3 0%, #ffd166 50%, #ffb84d 100%);',
      '  border-bottom: 1px solid rgba(0,0,0,0.10);',
      '  box-shadow: 0 2px 6px rgba(0,0,0,0.06);',
      '}',
      '#' + BANNER_ID + ' .pmg-t42-msg { max-width: 900px; }',
      '#' + BANNER_ID + ' a { color: #0b3b3a; text-decoration: underline; font-weight: 700; }',
      '#' + BANNER_ID + ' button.pmg-t42-close {',
      '  appearance: none; border: 0; background: transparent; cursor: pointer;',
      '  font-size: 18px; line-height: 1; padding: 4px 8px; color: #0b3b3a;',
      '  border-radius: 4px;',
      '}',
      '#' + BANNER_ID + ' button.pmg-t42-close:hover { background: rgba(0,0,0,0.08); }',
      '@media (max-width: 600px) { #' + BANNER_ID + ' { font-size: 13px; padding: 8px 12px; } }',
      '@media print { #' + BANNER_ID + ' { display: none !important; } }',
      /* Override T41 hide rules during beta — but ONLY for the Founding-tier
         button, since Founding ($49 lifetime) is genuinely on sale right now.
         Pro recurring subscriptions are NOT for sale until June 1, 2026, so
         every Pro upgrade CTA (the pricing-page "Upgrade To Pro" button and
         the auto-injected homepage `.pmg-t41-inline-cta` card) must stay
         hidden during beta. T41's pmg-is-pro hide rule already takes care of
         that; we simply do not restore them here. */
      'body.pmg-beta-mode.pmg-is-pro .pmg-upgrade-btn[data-pmg-upgrade][data-pmg-tier="founding"] {',
      '  display: inline-flex !important;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function renderBanner(activatesAtIso) {
    if (document.getElementById(BANNER_ID)) return;
    if (!document.body) return;
    /* Honor session dismissal so the user can hide it once and not be
       nagged on every page click — but we re-show on each fresh page load
       (sessionStorage clears with the tab). */
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') return;
    } catch (_) {}

    injectStyles();

    var dateLabel = fmtActivationDate(activatesAtIso);
    var bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');

    var msg = document.createElement('span');
    msg.className = 'pmg-t42-msg';
    /* On pricing.html keep it as plain text — there's no need to link to the
       page you're already on. Everywhere else, link "Founding Member Access"
       to the pricing page so the call-to-action is one click away. */
    var onPricing = /\/pricing\.html(?:[?#]|$)/i.test(location.pathname + location.search);
    if (onPricing) {
      msg.textContent = 'Free Beta Access Until ' + dateLabel + ' — Founding Member Access Available Now.';
    } else {
      msg.innerHTML = 'Free Beta Access Until ' + dateLabel +
        ' — <a href="./pricing.html">Founding Member Access Available Now</a>.';
    }
    bar.appendChild(msg);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmg-t42-close';
    close.setAttribute('aria-label', 'Dismiss this notice for the rest of this session');
    close.textContent = '×';
    close.addEventListener('click', function () {
      try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch (_) {}
      bar.remove();
    });
    bar.appendChild(close);

    /* Insert at the very top of <body> so it sits above any sticky headers. */
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function applyBetaUnlock() {
    /* Mirror the existing Pro UI flag so all locked panels (pmg-locked,
       pmg-t41 inline CTA hidden state, etc.) become unlocked for everyone
       during open beta. We RECORD that T42 was the one to set it via
       BETA_MARKER so revokeBetaUnlock() can cleanly tear it down once
       paywallActive flips on (without touching genuine paid users).

       We ALSO add `pmg-beta-mode` so the override CSS in injectStyles()
       can re-show the upgrade buttons (T41's CSS hides them whenever
       pmg-is-pro is on; the spec wants them visible during beta as soft
       nudges). */
    try {
      document.body.classList.add('pmg-beta-mode');
      if (typeof window.pmgUnlockPro === 'function') {
        /* silent: true — beta is already announced by the persistent
           top banner. No need to fire the green Pro Unlocked toast on
           every page load. */
        window.pmgUnlockPro({ silent: true });
      } else {
        document.body.classList.add('pmg-is-pro');
        try { localStorage.setItem(PRO_KEY, 'true'); } catch (_) {}
      }
      setBetaMarker();
    } catch (_) {}
  }

  function applyConfig(cfg) {
    var paywallActive = !!(cfg && cfg.paywallActive === true);
    if (paywallActive) {
      devLog('[pmg-t42] Paywall: ON (Enforced) — normal plan gating active.');
    } else {
      devLog('[pmg-t42] Paywall: OFF (Beta Mode) — features unlocked until ' +
        (cfg && cfg.paywallActivatesAt ? cfg.paywallActivatesAt : 'further notice'));
    }

    if (paywallActive) {
      /* Paid-mode is in force. If we previously granted beta unlock, tear
         it down so the user falls back to whatever T40/T41's auth-driven
         plan sync says they should have. Genuine paid users (no marker)
         are untouched. T40+T41 then run normally. */
      var hadBeta = hasBetaMarker();
      if (hadBeta && document.body) {
        revokeBetaUnlock();
      } else if (hadBeta) {
        document.addEventListener('DOMContentLoaded', revokeBetaUnlock);
      }
      return;
    }

    /* Open beta — unlock UI + show banner. Wait for body if needed. */
    if (document.body) {
      applyBetaUnlock();
      renderBanner(cfg && cfg.paywallActivatesAt);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        applyBetaUnlock();
        renderBanner(cfg && cfg.paywallActivatesAt);
      });
    }
  }

  /* Fail-safe: if the config fetch fails, we don't know whether beta is
     still on. To avoid stale unlock surviving the activation date, REVOKE
     any beta marker we previously set. Genuine paid cache is untouched. */
  function failSafeRevoke() {
    if (!hasBetaMarker()) return;
    if (document.body) {
      revokeBetaUnlock();
    } else {
      document.addEventListener('DOMContentLoaded', revokeBetaUnlock);
    }
  }

  /* Independent fetch of /api/public-config. The backend caches this for
     30s and T40 also requests it, so this is at most one extra request per
     page. We do not depend on T40 because T42 must work even if Supabase
     is misconfigured. */
  fetch('/api/public-config', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) {
        try { console.warn('[pmg-t42] could not load /api/public-config — revoking any stale beta unlock'); } catch (_) {}
        failSafeRevoke();
        return;
      }
      applyConfig(cfg);
    })
    .catch(function (err) {
      try { console.warn('[pmg-t42] fetch failed, revoking any stale beta unlock:', err); } catch (_) {}
      failSafeRevoke();
    });
})();

/* ====================================================================
 * T44 — Promote "This Week's Focus" pin
 *
 * Problem:
 *   #weekly-goal-pin currently lives inside .form-wrap with the
 *   `pmg-post-gen` class, which is hidden by:
 *     - body.pmg-pre-gen .pmg-post-gen { display: none !important; }
 *     - #weekly-goal-pin { display: none !important; }  (index.html)
 *   Net effect: the pin is invisible until the user has already
 *   generated a prompt, so first-time visitors never see it. Users
 *   reported it as "the button does nothing".
 *
 * Fix:
 *   Move #weekly-goal-pin OUT of .form-wrap and into #builder, placed
 *   ABOVE the .app-shell (i.e. above the two-column workspace).
 *   That puts it directly between the Save Your Best Prompts panel
 *   (which is inserted right before #builder by the account skill)
 *   and the two side-by-side "Create A Text Prompt" / "Create An
 *   Image Prompt" columns. We strip pmg-post-gen, add a new marker
 *   class so we can override the existing hide rules with higher
 *   specificity, and let the existing index.html handler keep working
 *   (we only move the DOM node — the click listener stays attached).
 * ==================================================================== */
(function pmgT44PromoteWeeklyPin() {
  var STYLE_ID = 'pmg-t44-weekly-pin-styles';
  var PROMOTED_CLASS = 'pmg-weekly-pin-promoted';
  var WRAPPER_ID = 'pmg-weekly-pin-wrap';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Wrapper centers the pin between the two columns and matches
         the inner container width used by the rest of #builder. */
      '#' + WRAPPER_ID + ' {',
      '  max-width: 720px;',
      '  margin: 0 auto var(--space-5);',
      '  padding: 0 var(--space-4);',
      '}',
      /* Override the global hide rules. Specificity: (1, 1, 0) for
         the bare pin selector and (1, 2, 0) when scoped under the
         wrapper — both beat #weekly-goal-pin (1, 0, 0). */
      '#weekly-goal-pin.' + PROMOTED_CLASS + ' { display: block !important; }',
      'body.pmg-pre-gen #weekly-goal-pin.' + PROMOTED_CLASS + ' { display: block !important; }',
      'body:not(.pmg-has-result) #weekly-goal-pin.' + PROMOTED_CLASS + ' { display: block !important; }',
      /* Keep image-mode behavior: pin is text-prompt focused. */
      'body.image-mode #weekly-goal-pin.' + PROMOTED_CLASS + ' { display: none !important; }',
      /* Visual lift so it reads as its own card, not part of the form. */
      '#weekly-goal-pin.' + PROMOTED_CLASS + ' {',
      '  margin: 0;',
      '  padding: var(--space-4) var(--space-5);',
      '  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 45%, transparent);',
      '  border-radius: var(--radius-lg);',
      '  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 10%, transparent);',
      '}',
      '#weekly-goal-pin.' + PROMOTED_CLASS + ' .weekly-goal-pin-cta {',
      '  background: var(--color-surface);',
      '}',
      '@media (max-width: 760px) {',
      '  #' + WRAPPER_ID + ' { padding: 0 var(--space-3); margin-bottom: var(--space-4); }',
      '}',
      /* Hide the legacy orphan elements that used to render under
         "Fix My Prompt": the "No Signup. Free." sub-label, the
         duplicate outlined "Help Me Start" (#guided-mode-btn) that
         old T15 reorderHelpMeStart() moved next to #generateBtn, the
         T16 "Recommended For Best Results" pill row that paired with
         it, and the T17 pair wrapper.
         Selectors use [id] to add a touch of specificity so we beat
         any legacy `display: inline-flex !important` left in earlier
         IIFE styles (e.g. T15.2 #guided-mode-btn :important rules). */
      '#pmg-generate-sublabel[id],',
      '#pmg-help-me-start-helper[id],',
      '#guided-mode-btn[id],',
      '#guided-cta-row[id],',
      '#pmg-help-me-start-recommend-row[id],',
      '#pmg-helpstart-pair-row[id] { display: none !important; }',
      /* T45: user removed the yellow "★ MOST LOVED" Help Me Start
         pill (#pmg-help-me-start-btn) above "Fix My Prompt" — it
         duplicates the much larger Help Me Start callout at the top
         of the same column. */
      '#pmg-help-me-start-btn[id] { display: none !important; }',
      /* T45: stop the global topbar nav buttons ("Start Here",
         "How It Works", "Examples", "Pricing", "Replay Tour",
         "Expert Mode") from wrapping their text onto two lines on
         narrow desktop widths (~900–1180px). Keeping them on a
         single line is purely a polish call: stacked text inside
         pill buttons looked tacky.
         IMPORTANT: the "Expert Mode" and "Replay Tour" buttons in
         the topbar are JS-injected with ids #pmg-nav-expert-link
         (built as `<button><span>⚙</span><span>Expert Mode</span></button>`)
         and #pmg-replay-tour-menu-link respectively — NOT
         #expert-mode-btn / #replay-tour-btn (those are the
         in-builder / footer dups). For Expert Mode we also have to
         apply nowrap to the inner spans so the text "Expert Mode"
         in the second span stays on one line.
         The media-query starts at 861px so it does NOT also tighten
         padding/font inside the open mobile burger menu (which
         appears at <=860px per .nav-toggle's collapse breakpoint). */
      '.topbar .ghost-link,',
      '.topbar .theme-toggle,',
      '.topbar #pmg-nav-expert-link,',
      '.topbar #pmg-nav-expert-link span,',
      '.topbar #pmg-replay-tour-menu-link { white-space: nowrap !important; }',
      '@media (min-width: 861px) and (max-width: 1180px) {',
      '  .topbar .ghost-link,',
      '  .topbar .theme-toggle,',
      '  .topbar #pmg-nav-expert-link,',
      '  .topbar #pmg-replay-tour-menu-link {',
      '    padding: 0 12px !important;',
      '    font-size: 13px !important;',
      '  }',
      '  .topbar-inner { gap: 8px !important; }',
      '}',
      /* T45: kill the dark-teal "ghost" artifact in the upper-left
         the user reported. Root cause: the sticky .topbar has
         `background: color-mix(--color-bg 84%, transparent)` plus
         `backdrop-filter: blur(14px)` — i.e. a frosted-glass bar.
         When the page scrolls, dark-teal elements (the rounded top
         of the .builder-intro-speech bubble, the teal "Create A
         Text Prompt" pill button) pass BEHIND that 16% translucent
         glass and their blurred silhouette bleeds through as a
         small dark-teal arc/curve near the top of the viewport.
         Once those elements scroll fully past the topbar zone the
         silhouette disappears — exactly matching the "shows at top,
         vanishes as I scroll down" report. We make the topbar fully
         opaque (drop the backdrop blur too — it has nothing to blur
         once we're opaque) so nothing behind it can show through.
         Use a stronger selector so we beat the inline <style>
         rules in index.html that defined the original translucency. */
      'header.topbar[class] {',
      '  background: var(--color-bg) !important;',
      '  backdrop-filter: none !important;',
      '  -webkit-backdrop-filter: none !important;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* Mark the legacy orphan elements as hidden for AT (the CSS above
   * handles the visual hide). Idempotent — safe to call repeatedly
   * as other IIFEs late-mount these elements. */
  function hideDuplicateHelpCTAs() {
    var ids = [
      'pmg-generate-sublabel',
      'pmg-help-me-start-helper'
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('tabindex', '-1');
    });
  }

  function promote() {
    /* Always run dup cleanup — these elements are injected at varying
       times by other IIFEs and we want them hidden as soon as they
       appear, even on retries when the pin itself is already promoted. */
    hideDuplicateHelpCTAs();

    var pin = document.getElementById('weekly-goal-pin');
    var builder = document.getElementById('builder');
    if (!pin || !builder) return false;

    /* Already promoted? */
    if (pin.classList.contains(PROMOTED_CLASS) && pin.parentNode && pin.parentNode.id === WRAPPER_ID) {
      return true;
    }

    /* Strip the visibility-gating class so the existing CSS hide
       rules no longer apply to this element. */
    pin.classList.remove('pmg-post-gen');
    pin.classList.add(PROMOTED_CLASS);

    /* Build (or reuse) a wrapper inside #builder, placed before
       .app-shell so the pin sits ABOVE the two columns. */
    var wrap = document.getElementById(WRAPPER_ID);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = WRAPPER_ID;
      var appShell = builder.querySelector('.app-shell');
      if (appShell) {
        builder.insertBefore(wrap, appShell);
      } else {
        builder.insertBefore(wrap, builder.firstChild);
      }
    }

    /* Move the existing pin node into the wrapper. The element
       reference is preserved, so the click listener attached in
       index.html (weeklyGoalCta.addEventListener('click', applyWeeklyGoal))
       remains live. */
    if (pin.parentNode !== wrap) {
      wrap.appendChild(pin);
    }
    return true;
  }

  /* The original applyWeeklyGoal() handler in index.html (line 7163)
     sets #goal.value and scrollIntoViews it, but on the home page the
     #goal textarea is HIDDEN by default behind the T31 "Help Me Start"
     callout — the user has to click "I Know What I Want — Just Start
     Typing" (id #pmg-text-help-row-skip) before the .field.field-primary
     wrapper becomes visible. Without that reveal, the pin click fills
     the value into an invisible textarea and scrollIntoView has nothing
     to scroll to. We listen in CAPTURE phase so the skip button runs
     BEFORE applyWeeklyGoal — by the time applyWeeklyGoal scrolls, the
     textarea is visible and gets the focus + scroll correctly. */
  function wireRevealOnPinClick() {
    if (window.__pmgT44PinRevealHooked) return;
    window.__pmgT44PinRevealHooked = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var cta = t.closest('#weekly-goal-cta');
      if (!cta) return;
      /* The skip button is a TOGGLE — clicking it when the inline
         typing panel is already open would COLLAPSE the panel. So
         only click it when the panel is closed. If the panel is
         already open, applyWeeklyGoal() runs alone and the existing
         visible textarea receives the value + scroll + focus. */
      var panel = document.getElementById('pmg-inline-typing-text');
      var alreadyOpen = !!(panel && panel.classList.contains('is-open'));
      if (alreadyOpen) return;
      var skip = document.getElementById('pmg-text-help-row-skip');
      if (skip && skip.offsetParent !== null) {
        try { skip.click(); } catch (_) {}
      }
    }, true);
  }

  function init() {
    injectStyles();
    promote();
    wireRevealOnPinClick();

    /* Retry for the full window even if promote() succeeded early —
       the duplicate Help Me Start cleanup needs to keep firing because
       the T24 yellow pill (#pmg-help-me-start-btn) and its helper
       (#pmg-hms-helper) are mounted by a separate IIFE that races with
       this one. Cap at 30 attempts (~12s) so we never spin forever. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      promote();
      if (tries >= 30) clearInterval(iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T46 — Builder flow rewrite (April 2026)
 * ---------------------------------------------------------------------
 * The builder used to put the green "Fix My Prompt" button directly
 * under the "Describe What You Want" textarea, with "More Control"
 * collapsed below it. Users complained the flow felt backwards: they
 * tapped "Fix My Prompt" before they ever saw what populated the
 * "Your Fixed Prompt" output box on the right side of the layout.
 *
 * This IIFE rewires the builder into a strictly linear flow:
 *
 *   [ Describe What You Want textarea ]
 *   [ Export To Fix My Prompt ] (NEW — copies idea into output box)
 *   [ Your Fixed Prompt output box ]
 *   [ Restore Original ] (NEW — only visible once an original exists)
 *   [ Fix My Prompt ] (MOVED here from under the textarea)
 *   [ More Control collapsible ] (MOVED with Fix My Prompt)
 *   [ Refine / Copy / Export / Run With AI ] (untouched)
 *
 * Implementation notes:
 *  - We MOVE existing nodes (#generateBtn, #settingsPanel) rather
 *    than cloning so all live event listeners (form submit, tour
 *    bindings, settings change handlers, expert-mode hooks) stay
 *    intact. The relocated #generateBtn keeps `type=submit` and
 *    we add `form="prompt-form"` so HTML5 form-association still
 *    fires the same submit handler the inline scripts in
 *    index.html attach at runtime.
 *  - "Export To Fix My Prompt" is intentionally NOT a generate-prompt
 *    action. It just copies the textarea text into #resultBox so the
 *    user can SEE their starting idea in the fixed-prompt slot before
 *    refining. Generation still happens via the moved Fix My Prompt
 *    button (and goes through the existing AI/local pipeline).
 *  - "Restore Original" snapshots the FIRST non-placeholder content
 *    that lands in #resultBox during a generation cycle. Subsequent
 *    refines/edits don't overwrite it. The snapshot resets on Clear
 *    Prompt and on every new Fix My Prompt submit so the next cycle
 *    captures fresh.
 *
 * Rolling back: delete this entire IIFE. No HTML edits were made.
 * ===================================================================== */
(function pmgT46BuilderRewrite() {
  'use strict';
  var STYLE_ID = 'pmg-t46-builder-rewrite-styles';
  var EXPORT_ROW_ID = 'pmg-export-to-fix-row';
  var EXPORT_BTN_ID = 'pmg-export-to-fix-btn';
  var RESULT_BLOCK_ID = 'pmg-result-actions-block';
  var RESULT_ROW_ID = 'pmg-result-actions-row';
  var RESTORE_BTN_ID = 'pmg-restore-original-btn';
  var PLACEHOLDER = 'Your fixed prompt will appear here.';

  /* In-closure state. originalFixedPrompt holds the FIRST snapshot of
     the result box for the current generation cycle, or null if there
     is no captured snapshot to restore to. */
  var originalFixedPrompt = null;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + EXPORT_ROW_ID + ' {',
      '  margin-top: 12px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '}',
      '#' + EXPORT_BTN_ID + ' {',
      '  width: 100%;',
      '  min-height: 52px;',
      '  font-weight: 700;',
      '  font-size: 15px;',
      '}',
      '#' + EXPORT_ROW_ID + ' .pmg-export-to-fix-helper {',
      '  margin: 0;',
      '  font-size: 12px;',
      '  color: var(--color-text-muted);',
      '  text-align: center;',
      '  line-height: 1.4;',
      '}',
      'body.image-mode #' + EXPORT_ROW_ID + ',',
      'body.pmg-image-reordered #' + EXPORT_ROW_ID + ' {',
      '  display: none !important;',
      '}',
      '#' + RESULT_BLOCK_ID + ' {',
      '  margin-top: 14px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '}',
      '#' + RESULT_ROW_ID + ' {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  align-items: stretch;',
      '  gap: 10px;',
      '}',
      '#' + RESULT_ROW_ID + ' #generateBtn {',
      '  flex: 1 1 220px;',
      '  min-height: 52px;',
      '  font-weight: 700;',
      '  font-size: 15px;',
      '}',
      '#' + RESTORE_BTN_ID + ' {',
      '  display: none;',
      '  flex: 0 0 auto;',
      '  min-height: 52px;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '}',
      '#' + RESTORE_BTN_ID + '.is-available {',
      '  display: inline-flex;',
      '}',
      '@media (max-width: 640px) {',
      '  #' + RESULT_ROW_ID + ' {',
      '    flex-direction: column;',
      '  }',
      '  #' + RESULT_ROW_ID + ' #generateBtn,',
      '  #' + RESULT_ROW_ID + ' #' + RESTORE_BTN_ID + '.is-available {',
      '    width: 100%;',
      '    flex: 1 1 auto;',
      '  }',
      '}',
      '#' + RESULT_BLOCK_ID + ' #settingsPanel {',
      '  margin-top: 0 !important;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function captureOriginalIfNeeded() {
    if (originalFixedPrompt !== null) return;
    var box = document.getElementById('resultBox');
    if (!box) return;
    var text = (box.textContent || '').trim();
    if (!text || text === PLACEHOLDER) return;
    if (text === 'Generating your prompt…') return;
    if (text.indexOf('Add a clear goal first') === 0) return;
    originalFixedPrompt = box.textContent;
    var btn = document.getElementById(RESTORE_BTN_ID);
    if (btn) btn.classList.add('is-available');
  }

  function resetOriginal() {
    originalFixedPrompt = null;
    var btn = document.getElementById(RESTORE_BTN_ID);
    if (btn) btn.classList.remove('is-available');
  }

  function restoreOriginal() {
    if (originalFixedPrompt === null) return;
    var box = document.getElementById('resultBox');
    if (!box) return;
    box.textContent = originalFixedPrompt;
    if (typeof window.__pmgClearUndo === 'function') window.__pmgClearUndo();
    var indicator = document.getElementById('result-edit-indicator');
    if (indicator) indicator.hidden = true;
    if (typeof window.showToast === 'function') {
      window.showToast('Restored your original prompt.');
    }
  }

  function exportToFix() {
    var goalEl = document.getElementById('goal');
    var box = document.getElementById('resultBox');
    if (!goalEl || !box) return;
    var goal = (goalEl.value || '').trim();
    if (!goal) {
      if (typeof window.showToast === 'function') {
        window.showToast('Type your idea above first, then export it to the fixed-prompt area.');
      }
      try { goalEl.focus({ preventScroll: true }); } catch (e) { goalEl.focus(); }
      return;
    }
    if (goal.length > 500) {
      if (typeof window.showToast === 'function') {
        window.showToast('Your idea is too long. Please keep it under 500 characters.');
      }
      try { goalEl.focus({ preventScroll: true }); } catch (e) { goalEl.focus(); }
      return;
    }
    resetOriginal();
    box.textContent = goal;
    if (typeof window.__pmgClearUndo === 'function') window.__pmgClearUndo();
    var indicator = document.getElementById('result-edit-indicator');
    if (indicator) indicator.hidden = true;
    var panel = document.getElementById('result-panel');
    if (panel) panel.classList.add('has-result');
    originalFixedPrompt = goal;
    var restoreBtn = document.getElementById(RESTORE_BTN_ID);
    if (restoreBtn) restoreBtn.classList.add('is-available');
    if (panel) {
      try { panel.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'start' }); }
      catch (e) { panel.scrollIntoView(); }
    }
    if (typeof window.showToast === 'function') {
      window.showToast('Exported to Your Fixed Prompt — review or refine it below.');
    }
  }

  function buildExportButton() {
    /* T39 (Refocus): the new column order is Goal → Prompt Tuning → Fix My Prompt.
       #generateBtn stays in the form at order:3, so the intermediate "Export To Fix
       My Prompt" button is no longer needed. We skip building it to avoid having two
       primary-looking buttons in quick succession. The exportToFix() helper is kept
       in scope so nothing else breaks if it's referenced externally. */
    return true;
  }

  function relocateActions() {
    /* REFOCUS TASK #39: the legacy T46 relocation moved both #generateBtn
       and #settingsPanel out of the form column and into #result-panel
       .result-wrap. That broke the new linear flow
       (Goal -> Upload -> Prompt Tuning -> Fix My Prompt) and pulled the
       always-visible Prompt Tuning section away from its intended home.
       Now generateBtn and settingsPanel stay where they are in the form
       column. We still inject the Restore Original button next to the
       result so that affordance survives. */
    if (document.getElementById(RESTORE_BTN_ID)) return true;
    var resultWrap = document.querySelector('#result-panel .result-wrap');
    var improveBlock = document.getElementById('improve-block');
    if (!resultWrap || !improveBlock || improveBlock.parentNode !== resultWrap) return false;

    var btnRow = document.createElement('div');
    btnRow.id = RESULT_ROW_ID;

    var restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.id = RESTORE_BTN_ID;
    restoreBtn.className = 'btn btn-secondary';
    restoreBtn.title = 'Bring back the first version of your fixed prompt';
    restoreBtn.innerHTML = '<span aria-hidden="true">↺</span> Restore Original';
    restoreBtn.addEventListener('click', restoreOriginal);
    btnRow.appendChild(restoreBtn);

    resultWrap.insertBefore(btnRow, improveBlock);
    return true;
  }

  function wireSubmitReset() {
    var form = document.getElementById('prompt-form');
    if (!form || form.__t46SubmitHooked) return;
    form.__t46SubmitHooked = true;
    form.addEventListener('submit', function () {
      resetOriginal();
    }, true);
  }

  function wireClearReset() {
    var btn = document.getElementById('clear-prompt-btn');
    if (!btn || btn.__t46ClearHooked) return;
    btn.__t46ClearHooked = true;
    btn.addEventListener('click', function () {
      resetOriginal();
    });
  }

  function wireResultObserver() {
    var box = document.getElementById('resultBox');
    if (!box || box.__t46Observed) return;
    box.__t46Observed = true;
    var obs = new MutationObserver(function () {
      captureOriginalIfNeeded();
    });
    obs.observe(box, { childList: true, characterData: true, subtree: true });
  }

  function build() {
    var ok1 = buildExportButton();
    var ok2 = relocateActions();
    wireSubmitReset();
    wireClearReset();
    wireResultObserver();
    return ok1 && ok2;
  }

  function init() {
    injectStyles();
    if (build()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (build() || tries >= 30) clearInterval(iv);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T47 — Always reveal marketing sections (use cases, see-the-difference,
 * how-it-works, why-prompts-fail, early-feedback)
 *
 * Background:
 *   The five marketing sections between the hero and #builder are
 *   tagged `.desktop-below-fold .pmg-marketing-section`. Older CSS
 *   hides them on desktop until the v4 reveal logic adds `.revealed`
 *   when the user scrolls past the bottom of #builder.
 *
 *   After T44 promoted the weekly-goal-pin INTO #builder and T46
 *   relocated the Fix My Prompt + More Control panels into the right
 *   column, #builder is significantly taller. The scroll-based reveal
 *   trigger (builder.bottom < viewportHeight * 0.5) rarely fires now
 *   because users hit the footer before scrolling that far. Net effect
 *   for the user: the use-case cards and the See The Difference
 *   examples appeared "removed" — they were still in the DOM but never
 *   un-hidden.
 *
 * Fix:
 *   Force-reveal them on every page load. They were always meant to
 *   be visible content; the lazy reveal was a polish optimization
 *   that no longer pays off after the layout changes.
 * ===================================================================== */
(function pmgT47AlwaysRevealMarketingSections() {
  var STYLE_ID = 'pmg-t47-always-reveal-styles';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Beat the older `.desktop-below-fold { display: none !important; }`
         and `@media (min-width: 920px) { .pmg-marketing-section { display:
         none !important; } }` rules with the same !important + extra
         specificity via attribute selector. */
      '.desktop-below-fold[class] { display: block !important; }',
      '@media (min-width: 920px) {',
      '  .pmg-marketing-section[class] { display: block !important; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function reveal() {
    var ids = ['why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('revealed');
      el.classList.add('pmg-marketing-section');
    });
    /* T47.2 — force-expand the See The Difference before/after examples
       on initial load. Other sections stay collapsed-with-label so the
       page does not become absurdly long. */
    var expandIds = ['see-the-difference'];
    expandIds.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      sec.classList.remove('pmg-mkt-collapsed');
      var btn = sec.querySelector('.pmg-mkt-toggle-btn');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
  /* Re-run a few times because aliasMarketingSections() (FIX 4 in the
     v5 init block earlier in this file) tags the elements on its own
     schedule. Idempotent — safe to run repeatedly. */
  setTimeout(reveal, 500);
  setTimeout(reveal, 1500);
  setTimeout(reveal, 4000);
})();

/* =====================================================================
 * T48 — Topbar repair: hide overlapping search bar + give the dark-mode
 * toggle real width so the moon/sun icon is actually visible.
 *
 * User feedback (April 2026):
 *   1. The "PromptMeGood" logo text is overlapping with the global
 *      search box. The search column (label + input + helper text) is
 *      a 3-row flex stack that visually crowds the brand on desktop
 *      and at 1280px the rendered layout looks crunched and broken.
 *   2. The dark-mode toggle in .top-actions renders as a tiny empty
 *      box because:
 *        - .theme-toggle-label is `display:none` on desktop
 *        - the SVG (moon icon) is 20x20 with no padding around it,
 *          so the button reads as an unclickable sliver
 *      The user asked to "stretch it out so we can see the moon or
 *      the sun inside of it."
 *
 * Fix:
 *   - Hide the in-topbar global-search column on desktop. The search
 *     functionality is still accessible inside the burger nav on
 *     mobile (it is still the third flex child there). We only hide
 *     it on >=861px screens where the topbar is the wide horizontal
 *     row.
 *   - Force the dark-mode button to a comfortable square (48x48 by
 *     default, with a 22px icon centered). The label stays hidden so
 *     the existing icon-only design is preserved, but the button is
 *     now clearly clickable and the moon/sun is plainly visible.
 *     We also flip the icon between a moon and a sun based on the
 *     current `data-theme` attribute on <html> so the user can tell
 *     which mode they would switch to.
 *
 * No HTML or other JS edits — purely additive CSS + a small theme
 * observer.
 * ===================================================================== */
(function pmgT48TopbarRepair() {
  var STYLE_ID = 'pmg-t48-topbar-repair-styles';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* 1) Hide the global search column on desktop — it crowds the
            brand and the icon-only theme toggle and the visual
            collision is what reads as "everything is crunched". */
      '@media (min-width: 861px) {',
      '  .topbar .global-search { display: none !important; }',
      '}',
      /* 2) Give the brand breathing room so the logo + name read
            cleanly. flex-shrink:0 stops it from being squeezed by
            the 7-item top-actions row. */
      '.topbar .brand[class] {',
      '  flex: 0 0 auto !important;',
      '  white-space: nowrap !important;',
      '}',
      /* 3) Make the dark-mode button a real square the user can see
            and tap. Override the older padding rules with a fixed
            44x44 footprint and a properly sized icon. */
      '.topbar .theme-toggle[class] {',
      '  width: 44px !important;',
      '  min-width: 44px !important;',
      '  height: 44px !important;',
      '  padding: 0 !important;',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  border-radius: 50% !important;',
      '}',
      '.topbar .theme-toggle[class] svg {',
      '  width: 22px !important;',
      '  height: 22px !important;',
      '  display: block !important;',
      '  color: var(--color-primary) !important;',
      '  stroke: var(--color-primary) !important;',
      '  fill: none !important;',
      '}',
      /* Hide the inline text label inside the button. We still expose
         the textual label via aria-label on the button element so
         screen readers continue to announce it. */
      '.topbar .theme-toggle[class] .theme-toggle-label,',
      '.topbar .theme-toggle[class] .pmg-theme-toggle-label {',
      '  display: none !important;',
      '}',
      /* Visible focus ring + hover state so the button reads as
         interactive. */
      '.topbar .theme-toggle[class]:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border)) !important;',
      '}',
      '.topbar .theme-toggle[class]:focus-visible {',
      '  outline: 2px solid var(--color-primary) !important;',
      '  outline-offset: 2px !important;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
  var SUN_MARKUP = [
    '<circle cx="12" cy="12" r="4.5"></circle>',
    '<line x1="12" y1="2" x2="12" y2="4"></line>',
    '<line x1="12" y1="20" x2="12" y2="22"></line>',
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>',
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>',
    '<line x1="2" y1="12" x2="4" y2="12"></line>',
    '<line x1="20" y1="12" x2="22" y2="12"></line>',
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>',
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
  ].join('');

  /* Swap the SVG content based on the current theme so the icon
     visibly tells the user what they would switch INTO. Page loaded
     in dark mode shows a sun (click to go light). Page loaded in
     light mode shows the existing moon (click to go dark). */
  function syncIcon() {
    var btn = document.querySelector('.topbar .theme-toggle');
    if (!btn) return;
    var svg = btn.querySelector('svg');
    if (!svg) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === 'dark') {
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('stroke-linecap', 'round');
      svg.innerHTML = SUN_MARKUP;
      btn.setAttribute('aria-label', 'Switch to light mode');
      btn.setAttribute('title', 'Switch to light mode');
    } else {
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.innerHTML = '<path d="' + MOON_PATH + '"></path>';
      btn.setAttribute('aria-label', 'Switch to dark mode');
      btn.setAttribute('title', 'Switch to dark mode');
    }
  }

  function init() {
    syncIcon();
    /* Observe data-theme on <html> so the icon flips the moment the
       user toggles dark mode (the original toggle handler in
       index.html sets data-theme on <html> + persists to storage). */
    try {
      var mo = new MutationObserver(syncIcon);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) { /* ignore */ }
    /* Re-sync a few times because the topbar buttons can be
       JS-injected late by other IIFEs that may rebuild the toggle. */
    setTimeout(syncIcon, 500);
    setTimeout(syncIcon, 1500);
    setTimeout(syncIcon, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T49 — Linear flow audit + fix for the Create A Text Prompt column
 *
 * Audit (current order, top to bottom):
 *   1. Auto Optimize toggle
 *   2. Your Goal textarea  ← user types here
 *   3. Upload A File
 *   4. Post-UC guidance message
 *   5. Action row: [Fix My Prompt] [🎨 Generate Image] [Use Demo Values] [🎲 Dice]
 *   6. Tip block
 *   7. <details id="settingsPanel"> "More Control"  ← settings hidden BELOW
 *        the Generate button. User has to scroll past Generate, expand,
 *        configure, then scroll back up. Linear flow is broken.
 *      Inside More Control:
 *        - Category, Tone, Output format, Personality, Max Length, Language
 *        - "Extra details" textarea (#details)
 *        - "What Should AI Avoid?" textarea
 *        - Power Ups
 *
 * The Help Me Start guided modal silently writes audience+outcome answers
 * into #details (the Extra Details textarea inside the collapsed
 * settingsPanel). The user can't find their text — it's hidden inside a
 * collapsed accordion below the Generate button.
 *
 * Fix:
 *   1. REORDER the form so More Control sits BEFORE the action row. The
 *      flow becomes: Goal → Upload → More Control (optional) → Generate.
 *      That is the linear, top-to-bottom path the user asked for.
 *   2. REMOVE the "🎨 Generate Image" button from the text-prompt action
 *      row. There is a dedicated Create An Image Prompt column for image
 *      work — the cross-column button just clutters the text flow.
 *   3. AUTO-OPEN the More Control panel (and flash a one-line notice)
 *      whenever something writes into #details or "rules or limits". That
 *      surfaces the routed text instead of leaving it stranded inside a
 *      collapsed accordion.
 *
 * Pure DOM reordering + a small mutation observer on #details. No HTML
 * edits, no other JS edits.
 * ===================================================================== */
(function pmgT49TextPromptLinearFlow() {
  var STYLE_ID = 'pmg-t49-text-flow-styles';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Hide the orphan image-generate button inside the text column. */
      '#prompt-form #image-generate-btn,',
      '#prompt-form .actions-row #image-generate-btn {',
      '  display: none !important;',
      '}',
      /* Visual cue: when More Control was force-opened by a routed
         write, briefly highlight the summary so the user notices. */
      '#settingsPanel.pmg-t49-flash > summary {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 60%, var(--color-border)) !important;',
      '  transition: background .25s ease, border-color .25s ease;',
      '}',
      /* Inline notice banner that appears at the top of the opened
         settingsPanel telling the user where their answers went. */
      '#pmg-t49-routed-notice {',
      '  margin: 0 0 12px 0;',
      '  padding: 10px 14px;',
      '  border-radius: 12px;',
      '  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));',
      '  color: var(--color-text);',
      '  font-size: 14px;',
      '  line-height: 1.4;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '}',
      '#pmg-t49-routed-notice .pmg-t49-routed-icon {',
      '  flex: 0 0 auto;',
      '  font-size: 18px;',
      '}',
      '#pmg-t49-routed-notice .pmg-t49-routed-text {',
      '  flex: 1 1 auto;',
      '}',
      '#pmg-t49-routed-notice .pmg-t49-routed-close {',
      '  flex: 0 0 auto;',
      '  background: transparent;',
      '  border: 0;',
      '  cursor: pointer;',
      '  font-size: 18px;',
      '  color: var(--color-text);',
      '  opacity: .6;',
      '}',
      '#pmg-t49-routed-notice .pmg-t49-routed-close:hover { opacity: 1; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ----- 1. Reorder the form children so the linear flow is preserved
            and More Control sits OUTSIDE the linear path.
            Per follow-up user feedback the collapsed "More Control" bar
            sitting between Upload and Generate read as an "empty box"
            in the middle of the linear flow. The fix: keep More Control
            available, but move it to the END of the form so the linear
            top-to-bottom path is Goal → Upload → Generate, with the
            optional advanced controls reachable below. -------------- */
  function reorderForm() {
    var form = document.getElementById('prompt-form');
    if (!form) return false;
    var settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return false;

    /* If we have already moved settingsPanel to be the last child of
       the form, bail. */
    if (settingsPanel.dataset.pmgT49MovedLast === '1' &&
        form.lastElementChild === settingsPanel) return true;

    /* Append settingsPanel as the last form child so it sits AFTER
       the action row + tip block, out of the linear input flow. */
    form.appendChild(settingsPanel);
    settingsPanel.dataset.pmgT49MovedLast = '1';
    /* Make sure it starts collapsed — no surprise expanded panel. */
    if (settingsPanel.open) settingsPanel.open = false;
    return true;
  }

  /* ----- 2. Auto-open More Control when something writes to #details
            or #rules-or-limits, and show a one-line notice explaining
            where the text went. ------------------------------------- */
  function showRoutedNotice(targetLabel) {
    var settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;
    /* Open the panel + flash the summary. */
    if (!settingsPanel.open) settingsPanel.open = true;
    settingsPanel.classList.add('pmg-t49-flash');
    setTimeout(function () { settingsPanel.classList.remove('pmg-t49-flash'); }, 1800);

    /* Insert a one-time notice banner at the top of the settings grid. */
    var existing = document.getElementById('pmg-t49-routed-notice');
    if (existing) existing.remove();
    var grid = settingsPanel.querySelector('.settings-grid') || settingsPanel;
    var notice = document.createElement('div');
    notice.id = 'pmg-t49-routed-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML =
      '<span class="pmg-t49-routed-icon" aria-hidden="true">📍</span>' +
      '<span class="pmg-t49-routed-text">Your answers were added to <strong>' +
        targetLabel +
      '</strong> below. Edit them here or just tap <strong>Fix My Prompt</strong>.</span>' +
      '<button type="button" class="pmg-t49-routed-close" aria-label="Dismiss notice">×</button>';
    grid.insertBefore(notice, grid.firstChild);
    notice.querySelector('.pmg-t49-routed-close').addEventListener('click', function () {
      notice.remove();
    });
    /* Auto-dismiss after 12s. */
    setTimeout(function () {
      if (notice && notice.parentNode) notice.remove();
    }, 12000);

    /* Scroll the panel into view so the user actually sees the notice. */
    try { settingsPanel.scrollIntoView({ behavior: window.PMG_A11Y.scrollBehavior(), block: 'center' }); } catch (e) {}
  }

  function watchHiddenWrites() {
    var details = document.getElementById('details');
    var rules = document.getElementById('rules or limits');
    if (!details && !rules) return;

    /* We can't reliably hook .value setters across browsers without
       breaking other code, so we poll. Cheap (every 600ms) and stops
       once we've seen the field populated and shown the notice. */
    var lastDetails = details ? details.value : '';
    var lastRules = rules ? rules.value : '';
    var noticeShown = false;
    var iv = setInterval(function () {
      if (noticeShown) { clearInterval(iv); return; }
      var dNow = details ? details.value : '';
      var rNow = rules ? rules.value : '';
      var detailsChanged = details && dNow && dNow !== lastDetails &&
        document.activeElement !== details;
      var rulesChanged = rules && rNow && rNow !== lastRules &&
        document.activeElement !== rules;
      if (detailsChanged || rulesChanged) {
        var label = detailsChanged ? 'Extra Details' : 'What Should AI Avoid';
        showRoutedNotice(label);
        noticeShown = true;
        clearInterval(iv);
      }
      lastDetails = dNow;
      lastRules = rNow;
    }, 600);
    /* Give up after 5 minutes so we don't poll forever. */
    setTimeout(function () { clearInterval(iv); }, 5 * 60 * 1000);
  }

  function init() {
    var ok = reorderForm();
    if (!ok) {
      /* Form not in DOM yet — retry until the builder section mounts. */
      var tries = 0;
      var retry = setInterval(function () {
        tries += 1;
        if (reorderForm() || tries > 40) clearInterval(retry);
      }, 250);
    }
    watchHiddenWrites();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =====================================================================
 * T50 — Two follow-up fixes from user audit:
 *
 *   (A) Marketing-section toggle coloring is INCONSISTENT.
 *       The `.pmg-marketing-section:not(.pmg-mkt-collapsed) .pmg-mkt-toggle-btn`
 *       rule (defined in T25) paints expanded toggle bars with a green/teal
 *       primary tint, while the collapsed ones stay white. Result: of the
 *       four marketing accordion bars (Examples, Guide, Reviews, Compare),
 *       the ones T47 force-opens (Examples + Compare) read green and the
 *       collapsed ones (Guide + Reviews) read white. Visually it looks
 *       broken.
 *       Fix: override the expanded-state background/border/color back to
 *       the same neutral surface used for the collapsed state, so all
 *       four toggle bars match regardless of their expand state. The
 *       chevron rotation still indicates open vs. closed.
 *
 *   (B) Restore the global search as a compact magnifying-glass icon
 *       instead of removing it. T48 hid the entire .global-search column
 *       on desktop because the wide 3-row stack was crowding the brand.
 *       The user wants the search BACK as a clickable icon that expands
 *       on focus. Implementation:
 *         - Remove the T48 `display:none` for .global-search on desktop.
 *         - Compress the column to a 44x44 circular icon-only button by
 *           hiding the label/helper/results in the collapsed state and
 *           shrinking the input to a transparent overlay.
 *         - On :focus-within (or when the user clicks the icon) expand
 *           to a 280px-wide search field that slides out to the LEFT
 *           (so it never crashes into the brand on the right).
 *         - The magnifying-glass icon is injected via a ::before pseudo
 *           on the collapsed input, so no HTML changes are required.
 * ===================================================================== */
(function pmgT50TopbarAndAccordionFixes() {
  var STYLE_ID = 'pmg-t50-fixes-styles';
  if (document.getElementById(STYLE_ID)) return;
  var s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = [
    /* -----------------------------------------------------------------
     * (A) Uniform background for marketing accordion toggle bars
     *     regardless of expand state. Higher specificity than T25 by
     *     using attribute selectors on the class.
     * ----------------------------------------------------------------- */
    '.pmg-marketing-section[class]:not(.pmg-mkt-collapsed) .pmg-mkt-toggle-btn[class] {',
    '  background: var(--color-surface) !important;',
    '  border-color: var(--color-border) !important;',
    '  color: var(--color-text) !important;',
    '}',
    /* Hover/focus may still gently tint, mirroring the collapsed-state
       hover so the four bars feel like one consistent control. */
    '.pmg-marketing-section[class]:not(.pmg-mkt-collapsed) .pmg-mkt-toggle-btn[class]:hover,',
    '.pmg-marketing-section[class]:not(.pmg-mkt-collapsed) .pmg-mkt-toggle-btn[class]:focus-visible {',
    '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)) !important;',
    '  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border)) !important;',
    '  color: var(--color-primary) !important;',
    '}',
    /* The chevron icon stays primary-colored when expanded so the user
       still has a clear visual cue for state. */
    '.pmg-marketing-section[class]:not(.pmg-mkt-collapsed) .pmg-mkt-toggle-icon[class] {',
    '  color: var(--color-primary) !important;',
    '}',

    /* -----------------------------------------------------------------
     * (B) Magnifying-glass collapsed search bar on desktop
     *     Reverses the T48 display:none on .global-search for >=861px.
     * ----------------------------------------------------------------- */
    '@media (min-width: 861px) {',
    '  .topbar .global-search[class] {',
    '    display: block !important;',
    '    position: relative !important;',
    '    flex: 0 0 44px !important;',
    '    max-width: none !important;',
    '    width: 44px !important;',
    '    height: 44px !important;',
    '    margin: 0 var(--space-2) 0 0 !important;',
    '    overflow: visible !important;',
    '  }',
    /*   Hide the label, helper, and results dropdown in the collapsed
         state. They reappear on focus-within (rule below). */
    '  .topbar .global-search[class] .global-search-label,',
    '  .topbar .global-search[class] .global-search-helper {',
    '    display: none !important;',
    '  }',
    '  .topbar .global-search[class] .global-results {',
    '    position: absolute !important;',
    '    top: 100% !important;',
    '    right: 0 !important;',
    '    left: auto !important;',
    '    width: 320px !important;',
    '    max-width: 90vw !important;',
    '    z-index: 30 !important;',
    '  }',
    /*   Style the input so collapsed it looks like a circular icon
         button. The icon is rendered via ::before on the wrapper. */
    '  .topbar .global-search[class] input {',
    '    width: 44px !important;',
    '    height: 44px !important;',
    '    min-height: 44px !important;',
    '    padding: 0 0 0 44px !important;',
    '    border-radius: 50% !important;',
    '    background: var(--color-surface) !important;',
    '    border: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent) !important;',
    '    color: transparent !important;',
    '    cursor: pointer !important;',
    '    transition: width 220ms ease, border-radius 220ms ease, padding 220ms ease, background 220ms ease, color 220ms ease !important;',
    '  }',
    '  .topbar .global-search[class] input::placeholder {',
    '    color: transparent !important;',
    '  }',
    /*   Magnifying glass icon overlay (purely decorative — clicking
         the input still focuses it). */
    '  .topbar .global-search[class]::before {',
    '    content: "" !important;',
    '    position: absolute !important;',
    '    top: 50% !important;',
    '    left: 50% !important;',
    '    width: 22px !important;',
    '    height: 22px !important;',
    '    margin: -11px 0 0 -11px !important;',
    '    background-image: url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23128383\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'11\' cy=\'11\' r=\'7\'/><line x1=\'21\' y1=\'21\' x2=\'16.65\' y2=\'16.65\'/></svg>") !important;',
    '    background-repeat: no-repeat !important;',
    '    background-position: center !important;',
    '    background-size: 22px 22px !important;',
    '    pointer-events: none !important;',
    '    transition: opacity 180ms ease !important;',
    '    z-index: 1 !important;',
    '  }',
    /*   Expanded state: when the input is focused (or hovered while
         interacting), grow to a real search field positioned to the
         LEFT so it never overlaps the brand. */
    '  .topbar .global-search[class]:focus-within {',
    '    width: 44px !important;',  /* keep the layout slot small */
    '  }',
    '  .topbar .global-search[class]:focus-within input {',
    '    position: absolute !important;',
    '    top: 0 !important;',
    '    right: 0 !important;',
    '    width: 320px !important;',
    '    max-width: 60vw !important;',
    '    padding: 10px 14px 10px 40px !important;',
    '    border-radius: var(--radius-md) !important;',
    '    background: var(--color-surface) !important;',
    '    color: var(--color-text) !important;',
    '    cursor: text !important;',
    '    box-shadow: 0 4px 18px color-mix(in srgb, var(--color-text) 15%, transparent) !important;',
    '    z-index: 25 !important;',
    '  }',
    '  .topbar .global-search[class]:focus-within input::placeholder {',
    '    color: var(--color-text-muted) !important;',
    '  }',
    /*   Move the icon inside the expanded input to the left edge. */
    '  .topbar .global-search[class]:focus-within::before {',
    '    left: auto !important;',
    '    right: 290px !important;',
    '    margin-left: 0 !important;',
    '    z-index: 26 !important;',
    '  }',
    '}'
  ].join('\n');
  document.head.appendChild(s);
})();

/* =====================================================================
 * T51 — De-orphan the "More Control" panel  [REMOVED in Refocus task]
 *
 * Originally injected a "⚙ More Control" toggle chip and CSS that hid
 * #settingsPanel whenever it was not [open]. The "Refocus on the Prompt
 * Builder" task promotes #settingsPanel to a always-visible Prompt
 * Tuning <section class="pmg-stack-card">, so neither the chip nor the
 * hide-when-closed CSS are wanted. The IIFE below is now an immediate
 * return so nothing renders.
 * ===================================================================== */
/* T51 IIFE deleted in REFOCUS TASK #39. The 'More Control' chip and its
   hide-when-closed CSS are no longer needed because #settingsPanel is now
   an always-visible <section class='pmg-stack-card'>. */

(function pmgCloseAffordances() {
  if (window.__pmgCloseAffordances) return;
  window.__pmgCloseAffordances = true;

  function injectStyles() {
    if (document.getElementById('pmg-close-affordance-styles')) return;
    var css =
      '.pmg-x-btn{position:absolute;top:10px;right:12px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:0;border-radius:8px;color:var(--color-text-muted,#666);font-size:24px;line-height:1;cursor:pointer;padding:0;z-index:5}' +
      '.pmg-x-btn:hover,.pmg-x-btn:focus-visible{color:var(--color-text,#111);background:rgba(0,0,0,.06);outline:none}' +
      '[data-theme="dark"] .pmg-x-btn:hover,[data-theme="dark"] .pmg-x-btn:focus-visible{background:rgba(255,255,255,.10)}' +
      '.ob-tooltip .pmg-x-btn{top:6px;right:8px;width:28px;height:28px;font-size:20px}' +
      '.toast{padding-right:36px}' +
      '.toast .pmg-toast-x{position:absolute;top:6px;right:8px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:0;color:inherit;opacity:.75;font-size:18px;line-height:1;cursor:pointer;border-radius:6px;padding:0}' +
      '.toast .pmg-toast-x:hover,.toast .pmg-toast-x:focus-visible{opacity:1;background:rgba(0,0,0,.08);outline:none}' +
      '[data-theme="dark"] .toast .pmg-toast-x:hover,[data-theme="dark"] .toast .pmg-toast-x:focus-visible{background:rgba(255,255,255,.15)}' +
      '.pmg-collapse-row{display:flex;justify-content:flex-end;margin:14px 0 4px}' +
      '.pmg-collapse-btn{appearance:none;background:transparent;border:1px solid var(--color-border,rgba(0,0,0,.12));color:var(--color-text-muted,#555);font-size:12px;font-weight:600;letter-spacing:.02em;padding:6px 12px;border-radius:999px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}' +
      '.pmg-collapse-btn:hover,.pmg-collapse-btn:focus-visible{color:var(--color-text,#111);border-color:var(--color-text-muted,#777);outline:none}' +
      '.pmg-collapse-btn::before{content:"▴";font-size:10px;line-height:1}' +
      '.pmg-mobile-nav-x{display:none;position:absolute;top:8px;right:10px;width:36px;height:36px;align-items:center;justify-content:center;background:transparent;border:0;border-radius:8px;color:var(--color-text-muted,#555);font-size:26px;line-height:1;cursor:pointer;padding:0}' +
      '.pmg-mobile-nav-x:hover,.pmg-mobile-nav-x:focus-visible{color:var(--color-text,#111);background:rgba(0,0,0,.06);outline:none}' +
      '@media (max-width:900px){.top-actions.is-open{position:relative;padding-top:48px}.top-actions.is-open .pmg-mobile-nav-x{display:inline-flex}}';
    var s = document.createElement('style');
    s.id = 'pmg-close-affordance-styles';
    s.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(s);
  }

  function makeXButton(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pmg-x-btn';
    b.setAttribute('aria-label', label);
    b.innerHTML = '&times;';
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }

  function isOpen(el, kind) {
    if (kind === 'native-dialog') return el.hasAttribute('open');
    return el.classList.contains('is-open');
  }

  function defaultCloseFor(el, kind) {
    if (kind === 'native-dialog') {
      return function () {
        if (typeof el.close === 'function') el.close();
        else el.removeAttribute('open');
      };
    }
    return function () {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    };
  }

  /* Register a closeable container. opts:
     - kind: 'native-dialog' | 'div-overlay'
     - innerSel: selector of inner panel that hosts the × button
     - close: optional explicit close function (e.g. existing closeCompare)
     - addX: whether to inject an × button (default true)
     - addBackdrop: whether to wire backdrop click (default false)
     - addEsc: whether to wire document-level ESC (default false; native
       dialogs handle ESC themselves via showModal)
     - label: aria-label for the × button */
  function register(el, opts) {
    if (!el || el.dataset.pmgCloseable === '1') return;
    el.dataset.pmgCloseable = '1';
    el.setAttribute('data-pmg-modal', opts.kind);
    var close = opts.close || defaultCloseFor(el, opts.kind);

    if (opts.addX !== false) {
      var inner = opts.innerSel ? el.querySelector(opts.innerSel) : el.firstElementChild;
      if (inner) {
        /* Anchor the absolutely-positioned × on the inner panel only;
           never alter the outer overlay/dialog's positioning. */
        var cs = window.getComputedStyle(inner);
        if (cs.position === 'static') inner.style.position = 'relative';
        inner.appendChild(makeXButton(opts.label || 'Close', close));
      }
    }
    if (opts.addBackdrop) {
      el.addEventListener('click', function (e) {
        if (e.target === el) close();
      });
    }
    if (opts.addEsc) {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen(el, opts.kind)) close();
      });
    }
  }

  function wireToast() {
    var t = document.getElementById('toast');
    if (!t || t.dataset.pmgCloseable === '1') return;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'pmg-toast-x';
    x.setAttribute('aria-label', 'Dismiss notification');
    x.innerHTML = '&times;';
    x.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      t.classList.remove('show');
    });
    t.appendChild(x);
    t.dataset.pmgCloseable = '1';
    /* showToast() rewrites #toast text in place — re-attach if removed. */
    new MutationObserver(function () {
      if (!t.contains(x)) t.appendChild(x);
    }).observe(t, { childList: true });
  }

  function wireGlobalSearchEsc() {
    var input = document.getElementById('global-search-input');
    var results = document.getElementById('global-search-results');
    if (!input || !results || results.dataset.pmgCloseable === '1') return;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !results.classList.contains('is-open')) return;
      results.classList.remove('is-open');
      if (document.activeElement === input) input.blur();
    });
    results.dataset.pmgCloseable = '1';
  }

  function wireMobileNavClose() {
    var panel = document.getElementById('top-actions');
    var toggle = document.getElementById('nav-toggle');
    if (!panel || !toggle || panel.dataset.pmgCloseable === '1') return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-mobile-nav-x';
    btn.setAttribute('aria-label', 'Close menu');
    btn.innerHTML = '&times;';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      toggle.focus({ preventScroll: true });
    });
    panel.insertBefore(btn, panel.firstChild);
    panel.dataset.pmgCloseable = '1';
  }

  function addCollapseToDetails(id, summarySelector) {
    var el = document.getElementById(id);
    if (!el || el.dataset.pmgCollapseable === '1') return;
    var body = null;
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].tagName.toLowerCase() === 'summary') continue;
      body = el.children[i];
      break;
    }
    if (!body) return;
    var row = document.createElement('div');
    row.className = 'pmg-collapse-row';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmg-collapse-btn';
    btn.textContent = 'Collapse';
    btn.setAttribute('aria-controls', id);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      el.open = false;
      var summary = el.querySelector(summarySelector || 'summary');
      if (!summary) return;
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      summary.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      summary.focus({ preventScroll: true });
    });
    row.appendChild(btn);
    body.appendChild(row);
    el.dataset.pmgCollapseable = '1';
  }

  /* Adopt a container that already has a working close handler — clicking
     the × dispatches a click on the existing close button so the existing
     state-cleanup logic (e.g. clearing compareCtx) is preserved. */
  function adoptByExistingButton(elId, innerSel, existingBtnId, label) {
    var el = document.getElementById(elId);
    var btn = document.getElementById(existingBtnId);
    if (!el || !btn) return;
    register(el, {
      kind: 'div-overlay',
      innerSel: innerSel,
      label: label,
      close: function () { btn.click(); }
    });
  }

  function init() {
    injectStyles();

    /* Native <dialog>s — ESC is native via showModal. */
    register(document.getElementById('expert-warning-dialog'), {
      kind: 'native-dialog',
      innerSel: '.expert-warning-dialog-inner',
      label: 'Close',
      addBackdrop: true
    });
    register(document.getElementById('guided-mode-dialog'), {
      kind: 'native-dialog',
      innerSel: '.guided-form',
      label: 'Close',
      addBackdrop: true
    });

    /* Div overlays — delegate to their existing close handlers. */
    adoptByExistingButton('compare-overlay', '.compare-modal', 'compare-close', 'Close compare view');
    adoptByExistingButton('bk-overlay', '.bk-modal', 'bk-close', 'Close backup view');

    /* Onboarding tour — visible × inside the tooltip, plus ESC. */
    var tour = document.getElementById('ob-overlay');
    if (tour) {
      register(tour, {
        kind: 'div-overlay',
        innerSel: '.ob-tooltip',
        label: 'Close tour',
        addEsc: true,
        close: function () {
          var skip = document.getElementById('ob-skip');
          if (skip) skip.click();
          else defaultCloseFor(tour, 'div-overlay')();
        }
      });
    }

    wireToast();
    wireGlobalSearchEsc();
    wireMobileNavClose();

    /* REFOCUS TASK #39: #settingsPanel is now an always-visible <section>,
       no longer a <details>, so addCollapseToDetails (which expects a
       <summary> child and toggles `el.open`) does not apply here. */
    addCollapseToDetails('advanced-options', '.advanced-options-summary');
    addCollapseToDetails('quick-start-card', '.quick-start-summary');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 600);
})();

/* =====================================================================
 * T24 — AUDIT PASS (post 8.8/10 polish):
 *   1. Inject confirmation line in the result panel ("Your prompt is
 *      ready. Copy it, run it, or refine it.") gated on the existing
 *      `body.pmg-has-result` class so it appears the moment a real
 *      prompt lands and disappears on Clear.
 *   2. Sharpen the post-result action hierarchy: demote the duplicate
 *      `#copy-btn` (which was `btn-primary` in the result actions row
 *      AND already mirrored in T22's secondary row) to a ghost-style
 *      visual, and elevate the in-app `#runBtn` (Run With AI) so it is
 *      the single dominant CTA. Closes the loop between writing a
 *      prompt and testing it without leaving the app.
 *   3. Reduce middle-page cognitive load: cluster the three workspace
 *      utility sections (#dashboard / #templates / #history) under a
 *      single eyebrow ("Your Workspace") with tighter inter-section
 *      spacing so they read as one grouped area instead of three loud
 *      competing widgets.
 *
 * Hard rules: strictly additive — no IDs, classes, or handlers
 * touched. All visibility/state hooks reuse `body.pmg-has-result`
 * (already set by the BUG-4 IIFE above when a real prompt lands).
 * ===================================================================== */
(function pmgT24AuditPass() {
  if (window.__pmgT93AuditPassInit) return;
  window.__pmgT93AuditPassInit = true;

  var STYLE_ID = 'pmg-t24-audit-pass-style';
  var CONFIRM_ID = 'pmg-result-confirm';
  var EYEBROW_ID = 'pmg-workspace-eyebrow';
  var WRAPPER_CLS = 'pmg-workspace-cluster';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* === #2 confirmation line === */
      '#' + CONFIRM_ID + ' {',
      '  display: none;',
      '  margin: var(--space-2) 0 var(--space-3);',
      '  padding: 10px 14px;',
      '  font-size: var(--text-sm);',
      '  font-weight: 600;',
      '  color: var(--color-text);',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);',
      '  border-left: 3px solid var(--color-primary);',
      '  border-radius: var(--radius-md, 8px);',
      '}',
      '#' + CONFIRM_ID + ' .pmg-confirm-icon { margin-right: 6px; }',
      'body.pmg-has-result #' + CONFIRM_ID + ' { display: block; }',
      'body:not(.pmg-has-result) #' + CONFIRM_ID + ' { display: none !important; }',

      /* === #3 action hierarchy ===
         Demote the duplicate Copy Prompt in the result actions row.
         T22 already exposes Copy Prompt as a secondary pill below;
         the row above had it as btn-primary, competing with Run With
         AI. Strip the fill so Run With AI is the single loud CTA. */
      '.pmg-result-actions-row #copy-btn {',
      '  background: transparent !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent) !important;',
      '  box-shadow: none !important;',
      '  font-weight: 600 !important;',
      '}',
      '.pmg-result-actions-row #copy-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;',
      '  border-color: var(--color-primary) !important;',
      '}',

      /* Elevate Run With AI as the single primary action.
         Selector specificity boosted (body + 3 classes) to win over
         `#runBtn.btn.pmg-demoted` (the demote rule from line 465). */
      'body #runBtn.btn.run-btn {',
      '  font-size: var(--text-base, 1rem) !important;',
      '  font-weight: 700 !important;',
      '  min-height: 52px !important;',
      '  padding: 14px 28px !important;',
      '  background: var(--color-primary) !important;',
      '  color: #ffffff !important;',
      '  border: 1.5px solid var(--color-primary) !important;',
      '  box-shadow: 0 8px 22px color-mix(in srgb, var(--color-primary) 32%, transparent) !important;',
      '}',
      'body #runBtn.btn.run-btn:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 10px 28px color-mix(in srgb, var(--color-primary) 40%, transparent) !important;',
      '}',

      /* === #4 middle-page workspace cluster === */
      '#' + EYEBROW_ID + ' {',
      '  max-width: var(--container-max, 1200px);',
      '  margin: var(--space-6) auto var(--space-2);',
      '  padding: 0 var(--space-4);',
      '  font-size: var(--text-xs, 0.75rem);',
      '  font-weight: 700;',
      '  letter-spacing: 0.12em;',
      '  text-transform: uppercase;',
      '  color: var(--color-text-muted);',
      '}',
      '#' + EYEBROW_ID + ' .pmg-eyebrow-rule {',
      '  display: inline-block;',
      '  width: 28px;',
      '  height: 2px;',
      '  vertical-align: middle;',
      '  margin-right: 10px;',
      '  background: var(--color-primary);',
      '  border-radius: 2px;',
      '}',
      '#' + EYEBROW_ID + ' .pmg-eyebrow-sub {',
      '  display: block;',
      '  margin-top: 4px;',
      '  font-size: var(--text-xs, 0.75rem);',
      '  font-weight: 500;',
      '  letter-spacing: 0;',
      '  text-transform: none;',
      '  color: var(--color-text-faint, var(--color-text-muted));',
      '}',
      /* Tighten spacing between the three clustered sections. */
      'body #dashboard.app-section { padding-top: var(--space-3) !important; padding-bottom: var(--space-3) !important; }',
      'body #templates.app-section { padding-top: var(--space-3) !important; padding-bottom: var(--space-3) !important; }',
      'body #history.app-section { padding-top: var(--space-3) !important; padding-bottom: var(--space-4) !important; }',
      /* Subtle group affordance: a thin guide on the inner panels. */
      'body #dashboard.app-section > .container > .panel,',
      'body #templates.app-section > .container > .panel,',
      'body #history.app-section > .container > .panel {',
      '  border-color: color-mix(in srgb, var(--color-primary) 14%, var(--color-border)) !important;',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function injectConfirmLine() {
    if (document.getElementById(CONFIRM_ID)) return;
    var resultBox = document.getElementById('resultBox');
    if (!resultBox || !resultBox.parentNode) return;
    var p = document.createElement('p');
    p.id = CONFIRM_ID;
    p.setAttribute('role', 'status');
    p.setAttribute('aria-live', 'polite');
    p.innerHTML = '<span class="pmg-confirm-icon" aria-hidden="true">✓</span>Your prompt is ready. Copy it, run it, or refine it.';
    /* Insert directly after #resultBox so it sits between the prompt
       text and the actions row, where users naturally land their gaze. */
    resultBox.parentNode.insertBefore(p, resultBox.nextSibling);
  }

  function injectWorkspaceEyebrow() {
    if (document.getElementById(EYEBROW_ID)) return;
    var dashboard = document.getElementById('dashboard');
    if (!dashboard || !dashboard.parentNode) return;
    var eyebrow = document.createElement('div');
    eyebrow.id = EYEBROW_ID;
    eyebrow.className = WRAPPER_CLS;
    eyebrow.innerHTML =
      '<span class="pmg-eyebrow-rule" aria-hidden="true"></span>Your Workspace' +
      '<span class="pmg-eyebrow-sub">Your saved data, templates, and history — all in one place.</span>';
    dashboard.parentNode.insertBefore(eyebrow, dashboard);
  }

  function init() {
    injectStyles();
    injectConfirmLine();
    injectWorkspaceEyebrow();
    /* Late-mount safety: some scripts (T22, pmg-result-states) may
       remount the result panel; re-inject if the elements vanish. */
    try {
      var mo = new MutationObserver(function () {
        injectConfirmLine();
        injectWorkspaceEyebrow();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 600);
})();

/* =====================================================================
 * T94 — Surprise Me Cluster: Make It Read As OPTIONAL Helper
 * ---------------------------------------------------------------------
 * User feedback: the "Need Ideas? Try An Example" banner at the top of
 * the Photography Suite (T34) currently uses a tinted card with a
 * dashed teal border and a filled-teal Surprise Me button. Visually
 * that competes with the actual primary action (the pill groups +
 * Send To Image Generator), so users read it as a REQUIRED step
 * instead of an optional helper.
 *
 * Strictly additive — no IDs, classes, or handlers touched. Demotes
 * the cluster via:
 *   1) Banner background: tinted+dashed → very subtle muted card
 *      with hairline border (no teal accent).
 *   2) Surprise Me button: filled teal → ghost outline (lower
 *      visual weight than nearby pills).
 *   3) Headline copy: prepend "OPTIONAL" eyebrow chip so the role
 *      of this row is unmistakable at a glance.
 *   4) Dial chrome: keep functional but visually quieter.
 *
 * Selector specificity is bumped (body prefix) and !important is
 * applied where T34 / pmg-handoff also use !important, so this T94
 * style block wins by source order tie-break.
 * ===================================================================== */
(function pmgT94SurpriseOptional() {
  if (window.__pmgT94SurpriseOptionalInit) return;
  window.__pmgT94SurpriseOptionalInit = true;

  var STYLE_ID = 'pmg-t94-surprise-optional-style';
  var BANNER_ID = 'pmg-t34-surprise-top-row';
  var EYEBROW_MARK = 'data-pmg-t94-eyebrow';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* === Banner: demote the tinted+dashed card to a calm helper === */
      'body #' + BANNER_ID + ' {',
      '  background: var(--color-surface-2, #f7f7f8) !important;',
      '  border: 1px solid var(--color-border, #e3e3e7) !important;',
      '  border-radius: var(--radius-md, 10px) !important;',
      '}',
      /* Quieten the headline so it stops shouting "do this first". */
      'body #' + BANNER_ID + ' .pmg-t34-surprise-text strong {',
      '  font-size: var(--text-sm, 14px) !important;',
      '  font-weight: 700 !important;',
      '  color: var(--color-text, #1d2a32) !important;',
      '}',
      'body #' + BANNER_ID + ' .pmg-t34-surprise-text {',
      '  color: var(--color-text-muted, #5f6b75) !important;',
      '  font-size: var(--text-xs, 12px) !important;',
      '  line-height: 1.5 !important;',
      '}',
      /* "OPTIONAL" eyebrow inserted by JS — render small + muted. */
      'body #' + BANNER_ID + ' .pmg-t94-optional-eyebrow {',
      '  display: inline-block;',
      '  font-size: 10px;',
      '  font-weight: 800;',
      '  letter-spacing: 0.14em;',
      '  text-transform: uppercase;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  margin-right: 6px;',
      '  padding: 2px 6px;',
      '  border: 1px solid var(--color-border, #e3e3e7);',
      '  border-radius: 999px;',
      '  background: var(--color-surface, #fff);',
      '  vertical-align: 2px;',
      '}',

      /* === Surprise Me button: filled teal → ghost outline ===
         T34 uses `#pmg-t34-surprise-top-row .pmg-photo-surprise`
         with !important. Same selector + body prefix bumps
         specificity from (0,1,1,0) to (0,1,1,1) so we win cleanly. */
      'body #' + BANNER_ID + ' .pmg-photo-surprise {',
      '  background: var(--color-surface, #fff) !important;',
      '  color: var(--color-text, #1d2a32) !important;',
      '  border: 1px solid var(--color-border, #e3e3e7) !important;',
      '  font-weight: 600 !important;',
      '  box-shadow: none !important;',
      '}',
      'body #' + BANNER_ID + ' .pmg-photo-surprise:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface, #fff)) !important;',
      '  color: var(--color-primary) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border, #e3e3e7)) !important;',
      '  filter: none !important;',
      '}',

      /* === Dial: quieten the wrap chrome, keep pressed-state legible === */
      'body #' + BANNER_ID + ' .pmg-handoff-dial-label {',
      '  color: var(--color-text-muted, #5f6b75) !important;',
      '  font-weight: 600 !important;',
      '}',
      'body #' + BANNER_ID + ' .pmg-handoff-dial-segments {',
      '  background: var(--color-surface, #fff) !important;',
      '  border-color: var(--color-border, #e3e3e7) !important;',
      '}',
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Prepend a small "OPTIONAL" eyebrow chip to the existing
     <strong> headline. Idempotent — guards via dataset attribute
     so MutationObserver re-runs are safe. */
  function injectEyebrow() {
    var banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    var strong = banner.querySelector('.pmg-t34-surprise-text strong');
    if (!strong) return;
    if (strong.hasAttribute(EYEBROW_MARK)) return;
    var eyebrow = document.createElement('span');
    eyebrow.className = 'pmg-t94-optional-eyebrow';
    eyebrow.textContent = 'Optional';
    /* a11y: chip is a visual cue; for screen readers we expose the
       same intent via an sr-only text node ("Optional. ") so the
       headline announces as "Optional. Need Ideas? Try An Example"
       instead of running together as "OptionalNeed Ideas...". */
    eyebrow.setAttribute('aria-hidden', 'true');
    var srPrefix = document.createElement('span');
    srPrefix.className = 'pmg-sr-only';
    srPrefix.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    srPrefix.textContent = 'Optional. ';
    strong.insertBefore(eyebrow, strong.firstChild);
    strong.insertBefore(srPrefix, strong.firstChild);
    strong.setAttribute(EYEBROW_MARK, '1');
  }

  function init() {
    try {
      injectStyles();
      injectEyebrow();
    } catch (e) { /* ignore */ }
    /* Late-mount safety: T34 may build the banner after this IIFE runs. */
    try {
      var mo = new MutationObserver(function () { injectEyebrow(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 600);
})();

/* =====================================================================
 * T95 — Dice Idea Generator: Make It Read As OPTIONAL Helper
 * ---------------------------------------------------------------------
 * User feedback (follow-up to T94): the "Need Inspiration? 🎲 Dice
 * Idea Generator" widget at the top of Prompt Tuning (text-prompt
 * builder) "appears to be a necessary step instead of just an idea
 * generator" and "disrupts flow." This is the text-mode counterpart
 * to T34's image-mode Surprise banner that T94 already demoted.
 *
 * The wrap is built dynamically by moveRandomPromptIntoSettings()
 * with inline-style background = teal-tinted card and the dice button
 * uses .btn-secondary which gives it a filled treatment that competes
 * with the actual primary controls below.
 *
 * Strictly additive — no IDs, classes, or handlers touched. Same
 * pattern as T94:
 *   1) Wrap background: teal-tinted → muted surface-2 with hairline
 *      border (overrides inline `background:` via !important).
 *   2) "Need Inspiration?" label gets an "OPTIONAL" eyebrow chip
 *      prepended (with sr-only "Optional. " for screen readers).
 *   3) Dice button: filled secondary → ghost outline so it stops
 *      reading as a required action.
 *
 * Selector specificity bumped via `body` prefix; !important is used
 * to beat moveRandomPromptIntoSettings's inline style declarations.
 * ===================================================================== */
(function pmgT95DiceOptional() {
  if (window.__pmgT95DiceOptionalInit) return;
  window.__pmgT95DiceOptionalInit = true;

  var STYLE_ID = 'pmg-t95-dice-optional-style';
  var WRAP_CLASS = 'pmg-random-prompt-wrap';
  var BTN_ID = 'random-prompt';
  var EYEBROW_MARK = 'data-pmg-t95-eyebrow';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* === Wrap: demote tinted card to a calm helper === */
      'body .' + WRAP_CLASS + ' {',
      '  background: var(--color-surface-2, #f7f7f8) !important;',
      '  border: 1px solid var(--color-border, #e3e3e7) !important;',
      '  border-radius: var(--radius-md, 10px) !important;',
      '  padding: 10px 12px !important;',
      '}',
      /* === Label: quieter, leave room for eyebrow chip === */
      'body .' + WRAP_CLASS + ' > p {',
      '  color: var(--color-text-muted, #5f6b75) !important;',
      '  font-size: var(--text-xs, 12px) !important;',
      '  font-weight: 700 !important;',
      '  margin: 0 0 8px !important;',
      '}',
      /* === "OPTIONAL" eyebrow chip === */
      'body .' + WRAP_CLASS + ' .pmg-t95-optional-eyebrow {',
      '  display: inline-block;',
      '  font-size: 10px;',
      '  font-weight: 800;',
      '  letter-spacing: 0.14em;',
      '  text-transform: uppercase;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  margin-right: 6px;',
      '  padding: 2px 6px;',
      '  border: 1px solid var(--color-border, #e3e3e7);',
      '  border-radius: 999px;',
      '  background: var(--color-surface, #fff);',
      '  vertical-align: 1px;',
      '}',
      /* === Dice button: filled secondary → ghost outline === */
      'body #' + BTN_ID + ' {',
      '  background: var(--color-surface, #fff) !important;',
      '  color: var(--color-text, #1d2a32) !important;',
      '  border: 1px solid var(--color-border, #e3e3e7) !important;',
      '  font-weight: 600 !important;',
      '  box-shadow: none !important;',
      '}',
      'body #' + BTN_ID + ':hover {',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface, #fff)) !important;',
      '  color: var(--color-primary) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border, #e3e3e7)) !important;',
      '  filter: none !important;',
      '}',
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* Prepend a small "OPTIONAL" eyebrow chip + sr-only "Optional. "
     prefix to the existing "Need Inspiration?" label. Idempotent —
     guards via dataset attribute so MutationObserver re-runs are safe. */
  function injectEyebrow() {
    var wrap = document.querySelector('.' + WRAP_CLASS);
    if (!wrap) return;
    var label = wrap.querySelector('p');
    if (!label) return;
    if (label.hasAttribute(EYEBROW_MARK)) return;
    var eyebrow = document.createElement('span');
    eyebrow.className = 'pmg-t95-optional-eyebrow';
    eyebrow.textContent = 'Optional';
    eyebrow.setAttribute('aria-hidden', 'true');
    var srPrefix = document.createElement('span');
    srPrefix.className = 'pmg-sr-only';
    srPrefix.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    srPrefix.textContent = 'Optional. ';
    label.insertBefore(eyebrow, label.firstChild);
    label.insertBefore(srPrefix, label.firstChild);
    label.setAttribute(EYEBROW_MARK, '1');
  }

  function init() {
    try {
      injectStyles();
      injectEyebrow();
    } catch (e) { /* ignore */ }
    /* Late-mount safety: moveRandomPromptIntoSettings may run after
       this IIFE; observe so we still demote when the wrap appears. */
    try {
      var mo = new MutationObserver(function () { injectEyebrow(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 60000);
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 600);
})();
