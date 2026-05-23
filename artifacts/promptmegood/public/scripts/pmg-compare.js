/* pmg-compare.js (cmp-1, 2026-05-23)
 *
 * Spec 2 — Multi-Model Compare. Sends the current #resultBox prompt to
 * /api/compare and displays ChatGPT/Claude/Gemini-style responses side
 * by side.
 *
 * Kill switch:    localStorage.pmg_compare_disable === '1'
 * Trigger:        #result-top-compare (already in app.html, last child
 *                 of #result-top-actions; starts disabled, mirrors
 *                 #result-top-copy enable state via body.pmg-has-result).
 * Endpoint:       POST /api/compare { prompt }
 * Public API:     window.pmgCompare.open() / .close()
 *
 * Never modifies #resultBox content, never touches the other
 * #result-top-* buttons, never calls another pmg* function by name.
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_compare_disable') === '1') return;
  } catch (_) { /* localStorage may be unavailable */ }

  var BTN_ID = 'result-top-compare';
  var BACKDROP_ID = 'pmg-cmp-backdrop';

  var state = {
    isOpen: false,
    inFlight: false,
    escHandler: null
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Mirror #result-top-copy enable/disable state ----------
     Existing convention: result-top-* buttons start disabled and become
     enabled when body has class pmg-has-result. We observe body class
     and copy the disabled attribute from #result-top-copy onto our
     button — that way whichever script flips Copy also implicitly
     flips Compare without us needing to know its name. */
  function syncEnableState() {
    var btn = document.getElementById(BTN_ID);
    var copy = document.getElementById('result-top-copy');
    if (!btn) return;
    var enabled = copy
      ? !copy.disabled && copy.getAttribute('aria-disabled') !== 'true'
      : document.body.classList.contains('pmg-has-result');
    if (enabled) {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('title', 'Compare model output styles side by side.');
    } else {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('title', 'Generate a prompt first to compare models.');
    }
  }

  function wireEnableObservers() {
    syncEnableState();
    try {
      var bodyObserver = new MutationObserver(syncEnableState);
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { /* old browser */ }
    var copy = document.getElementById('result-top-copy');
    if (copy) {
      try {
        var copyObserver = new MutationObserver(syncEnableState);
        copyObserver.observe(copy, { attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
      } catch (_) { /* old browser */ }
    }
  }

  /* ---------- Modal injection (once) ---------- */
  function ensureModal() {
    if (document.getElementById(BACKDROP_ID)) return;
    var bd = document.createElement('div');
    bd.id = BACKDROP_ID;
    bd.className = 'pmg-cmp-backdrop pmg-modal-overlay';
    bd.setAttribute('data-open', 'false');
    bd.setAttribute('data-pmg-overlay-root', '1');
    bd.innerHTML = [
      '<div id="pmg-cmp-modal" class="pmg-cmp-modal" role="dialog" aria-modal="true" aria-label="Compare model outputs">',
        '<div class="pmg-cmp-header">',
          '<h2 class="pmg-cmp-title">Compare Models</h2>',
          '<p class="pmg-cmp-sub">Same prompt. Three model styles. Side by side.</p>',
          '<button id="pmg-cmp-close" class="pmg-cmp-close" type="button" aria-label="Close compare">&times;</button>',
        '</div>',
        '<div class="pmg-cmp-cols" id="pmg-cmp-cols">',
          '<div class="pmg-cmp-col" id="pmg-cmp-chatgpt">',
            '<div class="pmg-cmp-col-label">ChatGPT Style</div>',
            '<div class="pmg-cmp-col-body" data-cmp-body="chatgpt">Loading&hellip;</div>',
          '</div>',
          '<div class="pmg-cmp-col" id="pmg-cmp-claude">',
            '<div class="pmg-cmp-col-label">Claude Style</div>',
            '<div class="pmg-cmp-col-body" data-cmp-body="claude">Loading&hellip;</div>',
          '</div>',
          '<div class="pmg-cmp-col" id="pmg-cmp-gemini">',
            '<div class="pmg-cmp-col-label">Gemini Style</div>',
            '<div class="pmg-cmp-col-body" data-cmp-body="gemini">Loading&hellip;</div>',
          '</div>',
        '</div>',
        '<div class="pmg-cmp-footer">',
          '<p class="pmg-cmp-note">Responses simulate each model&rsquo;s output style using GPT-4.1. Actual model outputs may vary.</p>',
          '<button type="button" class="btn btn-secondary pmg-cmp-close-btn" id="pmg-cmp-close-2">Close</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(bd);

    bd.querySelector('#pmg-cmp-close').addEventListener('click', close);
    bd.querySelector('#pmg-cmp-close-2').addEventListener('click', close);
    bd.addEventListener('click', function (e) {
      if (e.target === bd) close();
    });
  }

  function setColBody(model, text, isError) {
    var el = document.querySelector('[data-cmp-body="' + model + '"]');
    if (!el) return;
    el.textContent = text;
    if (isError) el.setAttribute('data-state', 'error');
    else el.removeAttribute('data-state');
  }

  function resetCols() {
    ['chatgpt', 'claude', 'gemini'].forEach(function (m) {
      var el = document.querySelector('[data-cmp-body="' + m + '"]');
      if (el) {
        el.textContent = 'Loading…';
        el.removeAttribute('data-state');
      }
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

  /* ---------- Click handler ---------- */
  function onCompareClick() {
    var rb = document.getElementById('resultBox');
    var prompt = rb ? String(rb.textContent || '').trim() : '';
    if (!prompt) return;
    if (state.inFlight) return;

    open();
    resetCols();
    state.inFlight = true;

    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    try {
      var w = window;
      var token = (w.pmgSupabaseAccessToken) ||
        (w.supabase && w.supabase.auth && typeof w.supabase.auth.session === 'function'
          ? (w.supabase.auth.session() || {}).access_token
          : null);
      if (token) headers['Authorization'] = 'Bearer ' + token;
    } catch (_) { /* ignore */ }

    fetch('/api/compare', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ prompt: prompt.slice(0, 4000) })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.inFlight = false;
        ['chatgpt', 'claude', 'gemini'].forEach(function (m) {
          var v = data ? data[m] : null;
          if (typeof v === 'string' && v.trim()) {
            setColBody(m, v.trim(), false);
          } else {
            setColBody(m, 'This model style failed to load. Try again.', true);
          }
        });
      })
      .catch(function () {
        state.inFlight = false;
        ['chatgpt', 'claude', 'gemini'].forEach(function (m) {
          setColBody(m, 'This model style failed to load. Try again.', true);
        });
      });
  }

  /* ---------- Boot ---------- */
  function boot() {
    var btn = document.getElementById(BTN_ID);
    if (!btn) return; /* spec: exit silently */
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      onCompareClick();
    });
    wireEnableObservers();
    ensureModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgCompare = { open: open, close: close };
})();
