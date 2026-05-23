/* pmg-template-browser.js (tb-1, 2026-05-23)
 *
 * Spec 1 — Template Browser. Replaces the legacy pmg-templates.js +
 * <section id="templates"> with an AI-generated, category-driven browser.
 *
 * Kill switch:    localStorage.pmg_template_browser_disable === '1'
 * Trigger button: #pmg-template-browser-btn (injected into the
 *                 chassis-v3 topbar between #pmgv3-vault and #pmgv3-expert
 *                 using the existing .pmgv3-ico style — no new visual
 *                 vocabulary). Spec said btn-secondary; conflict-answer C
 *                 overrode to "mirror Vault/Expert style".
 * Endpoint:       POST /api/templates/generate { category, count }
 * Command palette: hijacks [data-cc="templates"] (set by pmg-ux.js) so the
 *                 existing entry opens the new browser instead of jumping
 *                 to the now-deleted #templates section.
 * Public API:     window.pmgTemplateBrowser.open() / .close()
 *
 * Standing rule: this script never modifies #goal except to set .value and
 * dispatch 'input', never touches pmg-ux.js, never calls another pmg*
 * function by name.
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_template_browser_disable') === '1') return;
  } catch (_) { /* localStorage may be unavailable; continue */ }

  var BTN_ID = 'pmg-template-browser-btn';
  var BACKDROP_ID = 'pmg-tb-backdrop';
  var MODAL_ID = 'pmg-tb-modal';

  /* 50 categories grouped per categories-patch_1779501595010.md.
     Group labels are visual-only (pointer-events: none in CSS). */
  var CATEGORY_GROUPS = [
    { label: 'Most Searched', items: [
      'Coding & Development', 'Writing & Copywriting', 'SEO & Content Strategy',
      'Social Media', 'YouTube & Video Scripts', 'Email Marketing',
      'Research & Summarization', 'Data Analysis', 'Productivity & Planning',
      'Habit Building'
    ]},
    { label: 'Business & Money', items: [
      'Marketing & Sales', 'Business & Strategy', 'Startup & Entrepreneurship',
      'E-commerce & Dropshipping', 'Finance & Investing', 'Cold Outreach',
      'Customer Service', 'Consulting', 'Product Management',
      'Press Releases & PR'
    ]},
    { label: 'Career', items: [
      'Resume & CV', 'Cover Letters', 'Job Interviews', 'HR & Recruiting',
      'LinkedIn & Personal Brand'
    ]},
    { label: 'Creative', items: [
      'Storytelling & Fiction', 'Poetry & Creative Writing',
      'Scripts & Screenwriting', 'Podcast', 'TikTok & Short Form',
      'Photography & Image', 'Filmmaking & Video', 'Design & Branding',
      'Music & Audio'
    ]},
    { label: 'Education & Research', items: [
      'Academic & Essays', 'Grant Writing', 'Learning & Study Plans',
      'Teaching & Lesson Plans'
    ]},
    { label: 'Professional Services', items: [
      'Legal & Contracts', 'Real Estate', 'Healthcare & Medical',
      'Nonprofit & Fundraising', 'Coaching & Mentoring'
    ]},
    { label: 'Life & Personal', items: [
      'Health & Wellness', 'Fitness & Nutrition',
      'Mental Health & Mindfulness', 'Cooking & Recipes', 'Travel Planning',
      'Parenting & Family', 'Gift Ideas & Shopping', 'Faith & Community',
      'Personal Development', 'Relationships & Dating'
    ]}
  ];

  var state = {
    isOpen: false,
    activeCategory: null,
    isLoading: false,
    escHandler: null
  };

  /* ---------- DOM helpers ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Nav-button injection ----------
     The chassis-v3 topbar is rendered by pmg-chassis-v3.js after this
     script loads. Poll for #pmgv3-vault + #pmgv3-expert, then insert a
     matching .pmgv3-ico button between them. ID stays the spec-required
     one so the command-palette hijack + any future selectors keep working. */
  function ensureNavButton() {
    if (document.getElementById(BTN_ID)) return document.getElementById(BTN_ID);
    var vault = document.getElementById('pmgv3-vault');
    var expert = document.getElementById('pmgv3-expert');
    if (!vault || !expert || !vault.parentNode) return null;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmgv3-ico';
    btn.id = BTN_ID;
    btn.title = 'Templates — browse AI-generated starter prompts';
    btn.setAttribute('aria-label', 'Browse Templates');
    btn.innerHTML =
      '<span class="pmgv3-ico-glyph" aria-hidden="true">📋</span>' +
      '<span class="pmgv3-ico-label">Templates</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
    vault.parentNode.insertBefore(btn, expert);
    return btn;
  }

  function tryMountNavButton() {
    var ticks = 0;
    var MAX = 40; /* 40 × 200ms = 8s — chassis-v3 always mounts well within this */
    var poll = setInterval(function () {
      if (ensureNavButton() || ++ticks >= MAX) clearInterval(poll);
    }, 200);
  }

  /* ---------- Modal injection (once) ---------- */
  function ensureModal() {
    if (document.getElementById(BACKDROP_ID)) return;
    var bd = document.createElement('div');
    bd.id = BACKDROP_ID;
    bd.className = 'pmg-tb-backdrop pmg-modal-overlay';
    bd.setAttribute('data-open', 'false');
    bd.setAttribute('data-pmg-overlay-root', '1');
    bd.innerHTML = [
      '<div id="' + MODAL_ID + '" class="pmg-tb-modal" role="dialog" aria-modal="true" aria-label="Browse prompt templates">',
        '<div class="pmg-tb-header">',
          '<h2 class="pmg-tb-title">Browse Templates</h2>',
          '<button id="pmg-tb-close" class="pmg-tb-close" type="button" aria-label="Close template browser">&times;</button>',
        '</div>',
        '<div class="pmg-tb-body">',
          '<div id="pmg-tb-categories" class="pmg-tb-categories" role="tablist" aria-label="Template categories"></div>',
          '<div id="pmg-tb-results" class="pmg-tb-results" aria-live="polite">',
            '<p class="pmg-tb-empty">Pick a category on the left to generate fresh templates.</p>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(bd);

    /* Render category sidebar once */
    var catRoot = bd.querySelector('#pmg-tb-categories');
    CATEGORY_GROUPS.forEach(function (group) {
      var label = document.createElement('div');
      label.className = 'pmg-tb-group-label';
      label.textContent = group.label;
      catRoot.appendChild(label);
      group.items.forEach(function (cat) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pmg-tb-cat-btn';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', 'false');
        b.textContent = cat;
        b.addEventListener('click', function () { selectCategory(cat, b); });
        catRoot.appendChild(b);
      });
    });

    /* Close paths */
    bd.querySelector('#pmg-tb-close').addEventListener('click', close);
    bd.addEventListener('click', function (e) {
      /* Backdrop click only — not modal-interior clicks */
      if (e.target === bd) close();
    });
  }

  /* ---------- Open / close ---------- */
  function open() {
    ensureModal();
    var bd = document.getElementById(BACKDROP_ID);
    if (!bd) return;
    bd.setAttribute('data-open', 'true');
    state.isOpen = true;
    state.escHandler = function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    document.addEventListener('keydown', state.escHandler);
  }

  function close() {
    var bd = document.getElementById(BACKDROP_ID);
    if (bd) bd.setAttribute('data-open', 'false');
    state.isOpen = false;
    if (state.escHandler) {
      document.removeEventListener('keydown', state.escHandler);
      state.escHandler = null;
    }
  }

  /* ---------- Category selection + fetch ---------- */
  function selectCategory(cat, btnEl) {
    state.activeCategory = cat;
    /* Toggle aria-selected across all sidebar buttons */
    var all = document.querySelectorAll('.pmg-tb-cat-btn');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-selected', all[i] === btnEl ? 'true' : 'false');
    }
    fetchTemplates(cat);
  }

  function setResultsHtml(html) {
    var root = document.getElementById('pmg-tb-results');
    if (root) root.innerHTML = html;
  }

  function fetchTemplates(cat) {
    state.isLoading = true;
    setResultsHtml('<p class="pmg-tb-loading">Generating templates…</p>');

    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    /* Best-effort Supabase auth header — pmg-vault-import.js + others
       follow the same opportunistic pattern. The endpoint accepts
       anonymous traffic (rateLimit + generateCostCheck cover abuse). */
    try {
      var w = window;
      var token = (w.pmgSupabaseAccessToken) ||
        (w.supabase && w.supabase.auth && typeof w.supabase.auth.session === 'function'
          ? (w.supabase.auth.session() || {}).access_token
          : null);
      if (token) headers['Authorization'] = 'Bearer ' + token;
    } catch (_) { /* ignore */ }

    fetch('/api/templates/generate', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ category: cat, count: 8 })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.isLoading = false;
        if (state.activeCategory !== cat) return; /* user clicked another category */
        var list = (data && Array.isArray(data.templates)) ? data.templates : [];
        if (!list.length) {
          setResultsHtml('<p class="pmg-tb-empty">No templates returned. Try another category.</p>');
          return;
        }
        renderCards(list);
      })
      .catch(function () {
        state.isLoading = false;
        if (state.activeCategory !== cat) return;
        setResultsHtml(
          '<div class="pmg-tb-error">' +
            'Couldn&rsquo;t load templates. Try again.' +
            '<br /><button type="button" class="pmg-tb-retry" data-tb-retry="1">Retry</button>' +
          '</div>'
        );
        var retry = document.querySelector('[data-tb-retry="1"]');
        if (retry) retry.addEventListener('click', function () { fetchTemplates(cat); });
      });
  }

  function renderCards(list) {
    var html = list.map(function (t) {
      var title = escapeHtml(t && t.title);
      var goal = escapeHtml(t && t.goal);
      var tags = (t && Array.isArray(t.tags)) ? t.tags : [];
      var tagsHtml = tags.slice(0, 6).map(function (tag) {
        return '<span class="pmg-tb-tag">' + escapeHtml(tag) + '</span>';
      }).join('');
      return [
        '<div class="pmg-tb-card">',
          '<div class="pmg-tb-card-title">', title, '</div>',
          '<div class="pmg-tb-card-goal">', goal, '</div>',
          '<div class="pmg-tb-card-tags">', tagsHtml, '</div>',
          '<button type="button" class="pmg-tb-use btn btn-primary" data-tb-use="1" data-goal="', goal, '">Use This Template &rarr;</button>',
        '</div>'
      ].join('');
    }).join('');
    setResultsHtml(html);
    var btns = document.querySelectorAll('[data-tb-use="1"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        var raw = e.currentTarget.getAttribute('data-goal') || '';
        /* data-goal was HTML-escaped going in; decode for textarea value */
        var doc = document.createElement('textarea');
        doc.innerHTML = raw;
        useTemplate(doc.value);
      });
    }
  }

  function useTemplate(goalText) {
    var goal = document.getElementById('goal');
    if (goal) {
      goal.value = goalText;
      goal.dispatchEvent(new Event('input', { bubbles: true }));
    }
    close();
    if (goal && typeof goal.scrollIntoView === 'function') {
      try { goal.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (_) { goal.scrollIntoView(); }
    }
  }

  /* ---------- Command Palette hijack ----------
     pmg-ux.js renders <button class="pmg-cc-link" data-cc="templates">.
     Delegated capture-phase handler intercepts the click and opens the new
     browser, then stops the legacy handler that would jump to the deleted
     #templates section. */
  function wireCommandPaletteHijack() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      var hit = (t.closest && t.closest('[data-cc="templates"]'));
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }, true);
  }

  /* ---------- Boot ---------- */
  function boot() {
    tryMountNavButton();
    ensureModal();
    wireCommandPaletteHijack();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* Public API */
  window.pmgTemplateBrowser = { open: open, close: close };
})();
