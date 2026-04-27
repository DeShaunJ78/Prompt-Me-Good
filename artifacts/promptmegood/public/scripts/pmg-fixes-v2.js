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
