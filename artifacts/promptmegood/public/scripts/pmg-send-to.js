/* =============================================================
 * pmg-send-to.js  (Task #60)
 *
 * One-click "Send to" handoffs to ChatGPT, Claude, Gemini,
 * Perplexity. Two additive surfaces, no edits to existing IDs,
 * classes, JS variables, or handlers:
 *
 *   1. SEND TO SPLIT BUTTON — sits directly after #copy-btn in
 *      the post-generate actions row. Main half opens the user's
 *      last-used destination in a new tab with the prompt
 *      prefilled (or copied to clipboard + opened where the
 *      destination doesn't accept a URL prefill). Caret half
 *      opens a menu with all four destinations. Last choice
 *      persists in localStorage.
 *
 *   2. EXISTING "USE YOUR PROMPT IN:" ROW — the static cards at
 *      #copy-btn's section already include ChatGPT, Claude,
 *      Perplexity. We add a Gemini card (so all four are
 *      represented), and intercept clicks on every card so the
 *      destination URL gets the prompt prefilled (or the prompt
 *      gets copied + the destination is opened where prefill
 *      isn't supported).
 *
 * Prefill behavior per destination:
 *   - ChatGPT    https://chat.openai.com/?q=<prompt>     prefill
 *   - Claude     https://claude.ai/new?q=<prompt>        prefill
 *   - Perplexity https://www.perplexity.ai/search?q=...  prefill
 *   - Gemini     https://gemini.google.com/app           copy+open
 *
 * Strict additive: no backend / API / DB / payment / secret
 * changes; no rewrites of existing handlers; the original
 * Copy Prompt button still works exactly the same.
 *
 * Disable hatches:
 *   ?nosendto                       query param
 *   localStorage.pmg_sendto_disable = '1'
 *   localStorage.pmg_disable        = '1'   (global PMG disable)
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgSendToLoaded) return;
  window.__pmgSendToLoaded = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nosendto\b/.test(qs)) return;
    if (localStorage.getItem('pmg_sendto_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var SCRIPT_VERSION = 'task60-1';
  var STYLE_ID       = 'pmg-send-to-style';
  var WRAP_ID        = 'pmg-send-to-wrap';
  var MENU_ID        = 'pmg-send-to-menu';
  var MAIN_BTN_ID    = 'pmg-send-to-main';
  var CARET_BTN_ID   = 'pmg-send-to-caret';
  var LAST_KEY       = 'pmg.sendto.last.v1';
  var DEFAULT_DEST   = 'chatgpt';

  /* Destination catalog. `prefill` returns the URL to open with
     the prompt embedded (encoded). `null` = no prefill, copy +
     open the bare URL. */
  var DESTS = {
    chatgpt: {
      label: 'ChatGPT',
      url: 'https://chat.openai.com/',
      prefill: function (text) {
        return 'https://chat.openai.com/?q=' + encodeURIComponent(text);
      }
    },
    claude: {
      label: 'Claude',
      url: 'https://claude.ai/new',
      prefill: function (text) {
        return 'https://claude.ai/new?q=' + encodeURIComponent(text);
      }
    },
    gemini: {
      label: 'Gemini',
      url: 'https://gemini.google.com/app',
      prefill: null
    },
    perplexity: {
      label: 'Perplexity',
      url: 'https://www.perplexity.ai/',
      prefill: function (text) {
        return 'https://www.perplexity.ai/search?q=' + encodeURIComponent(text);
      }
    }
  };
  var DEST_ORDER = ['chatgpt', 'claude', 'gemini', 'perplexity'];

  /* ------------------------------------------------------------
   * Storage helpers
   * ------------------------------------------------------------ */
  function getLastDest() {
    try {
      var v = localStorage.getItem(LAST_KEY);
      if (v && DESTS[v]) return v;
    } catch (_) {}
    return DEFAULT_DEST;
  }
  function setLastDest(key) {
    if (!DESTS[key]) return;
    try { localStorage.setItem(LAST_KEY, key); } catch (_) {}
  }

  /* ------------------------------------------------------------
   * Toast — prefer the existing window.showToast (defined in
   * index.html ~line 4553); fall back to a tiny inline toast so
   * we never silently swallow user feedback.
   * ------------------------------------------------------------ */
  function toast(msg) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg); return; } catch (_) {}
    }
    var t = document.createElement('div');
    t.className = 'pmg-send-to-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3000);
  }

  /* ------------------------------------------------------------
   * Get the currently-generated prompt text. The result panel
   * is #result-box (set up in index.html); the existing
   * Copy Prompt button reads `resultBox.textContent`. We mirror
   * that exact source of truth so what's sent matches what's
   * copied.
   * ------------------------------------------------------------ */
  function getPromptText() {
    var box = document.getElementById('resultBox') ||
              document.querySelector('.result-box, [data-prompt-output]');
    if (!box) return '';
    var text = (box.textContent || '').trim();
    if (!text) return '';
    /* Don't send the placeholder copy. */
    if (text.indexOf('Your fixed prompt will appear here') === 0) return '';
    return text;
  }

  /* ------------------------------------------------------------
   * Clipboard with graceful fallback. Returns a Promise<boolean>.
   * ------------------------------------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (_) { return false; }
  }

  /* ------------------------------------------------------------
   * Send the current prompt to a destination. If the dest
   * supports URL prefill, open that URL directly. Otherwise
   * copy to clipboard, open the bare destination, and toast
   * "ready to paste".
   *
   * Always opens via window.open with noopener so the new tab
   * cannot reach back into PromptMeGood.
   * ------------------------------------------------------------ */
  function sendTo(destKey) {
    var dest = DESTS[destKey];
    if (!dest) return;
    var text = getPromptText();
    if (!text) {
      toast('Generate a prompt first.');
      return;
    }
    setLastDest(destKey);
    refreshMainLabel();

    if (typeof dest.prefill === 'function') {
      try {
        window.open(dest.prefill(text), '_blank', 'noopener');
        toast('Opened ' + dest.label + ' with your prompt prefilled.');
      } catch (_) {
        toast('Could not open ' + dest.label + '.');
      }
      return;
    }

    /* No prefill: copy + open + toast. */
    copyText(text).then(function (ok) {
      try { window.open(dest.url, '_blank', 'noopener'); } catch (_) {}
      if (ok) {
        toast('Copied — paste it into ' + dest.label + ' (Ctrl/Cmd+V).');
      } else {
        toast('Opened ' + dest.label + ' — copy your prompt manually.');
      }
    });
  }

  /* ------------------------------------------------------------
   * Styles
   * ------------------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + WRAP_ID + ' {',
      '  position: relative; display: inline-flex; align-items: stretch;',
      '  border-radius: var(--radius-full, 999px); overflow: visible;',
      '  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06));',
      '}',
      '#' + WRAP_ID + ' button {',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  font-weight: 700; font-size: var(--text-sm, 14px);',
      '  cursor: pointer; min-height: 48px;',
      '  transition: background 180ms ease, transform 180ms ease;',
      '}',
      '#' + WRAP_ID + ' button:hover { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); }',
      '#' + MAIN_BTN_ID + ' {',
      '  border-top-left-radius: var(--radius-full, 999px);',
      '  border-bottom-left-radius: var(--radius-full, 999px);',
      '  padding: 0 var(--space-4, 16px) 0 var(--space-5, 20px);',
      '  border-right: none;',
      '}',
      '#' + CARET_BTN_ID + ' {',
      '  border-top-right-radius: var(--radius-full, 999px);',
      '  border-bottom-right-radius: var(--radius-full, 999px);',
      '  padding: 0 14px; border-left: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);',
      '}',
      '#' + WRAP_ID + ' .pmg-send-to-icon { font-size: 14px; opacity: 0.85; margin-right: 6px; }',
      '#' + WRAP_ID + ' .pmg-send-to-caret { font-size: 11px; line-height: 1; }',

      '#' + MENU_ID + ' {',
      '  position: absolute; top: calc(100% + 6px); right: 0;',
      '  min-width: 200px; padding: 6px;',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  border-radius: var(--radius-md, 12px);',
      '  box-shadow: var(--shadow-md, 0 10px 30px rgba(0,0,0,.12));',
      '  z-index: 50; display: none;',
      '}',
      '#' + MENU_ID + '.is-open { display: block; }',
      '#' + MENU_ID + ' button {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  width: 100%; gap: 12px;',
      '  background: transparent; color: var(--color-text);',
      '  border: none; border-radius: 8px;',
      '  padding: 10px 12px; min-height: 40px;',
      '  font-size: var(--text-sm, 14px); font-weight: 600;',
      '  text-align: left; cursor: pointer;',
      '}',
      '#' + MENU_ID + ' button:hover, #' + MENU_ID + ' button:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));',
      '  outline: none;',
      '}',
      '#' + MENU_ID + ' .pmg-send-to-meta {',
      '  font-size: 11px; font-weight: 500; color: var(--color-text-muted);',
      '}',
      '#' + MENU_ID + ' .pmg-send-to-last-tag {',
      '  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;',
      '  text-transform: uppercase; color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 12%, transparent);',
      '  padding: 2px 6px; border-radius: 999px;',
      '}',

      '.pmg-send-to-toast {',
      '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
      '  background: var(--color-primary); color: #fff;',
      '  padding: 10px 18px; border-radius: 999px;',
      '  font-weight: 700; font-size: 13px;',
      '  z-index: 300; box-shadow: 0 8px 24px rgba(0,0,0,.25);',
      '}',

      /* Make the existing open-in row a 4-column grid friendly to
         the new Gemini card. */
      '.open-in-btn[data-tool="gemini"]    { background: #f3e8ff; color: #6b21a8; border-color: #9333ea; }',
      '.open-in-btn[data-tool="gemini"]:hover { background: #e9d5ff; }',
      '[data-theme="dark"] .open-in-btn[data-tool="chatgpt"] { background: #064e3b; color: #d1fae5; border-color: #10a37f; }',
      '[data-theme="dark"] .open-in-btn[data-tool="claude"] { background: #5b3a0e; color: #fde68a; border-color: #d97706; }',
      '[data-theme="dark"] .open-in-btn[data-tool="perplexity"] { background: #1e2a55; color: #c7d2fe; border-color: #2563eb; }',
      '[data-theme="dark"] .open-in-btn[data-tool="gemini"] { background: #3b1d5c; color: #e9d5ff; border-color: #9333ea; }',

      '@media (prefers-reduced-motion: reduce) {',
      '  #' + WRAP_ID + ' button { transition: none; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------
   * Mount the split button next to #copy-btn.
   * ------------------------------------------------------------ */
  function mountSplitButton() {
    if (document.getElementById(WRAP_ID)) return true;
    var copyBtn = document.getElementById('copy-btn');
    if (!copyBtn || !copyBtn.parentNode) return false;

    var wrap = document.createElement('span');
    wrap.id = WRAP_ID;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Send prompt to an AI tool');

    var main = document.createElement('button');
    main.type = 'button';
    main.id = MAIN_BTN_ID;
    main.setAttribute('aria-label', 'Send prompt to last-used AI tool');
    main.innerHTML =
      '<span class="pmg-send-to-icon" aria-hidden="true">→</span>' +
      '<span class="pmg-send-to-label">Send To ChatGPT</span>';

    var caret = document.createElement('button');
    caret.type = 'button';
    caret.id = CARET_BTN_ID;
    caret.setAttribute('aria-haspopup', 'menu');
    caret.setAttribute('aria-expanded', 'false');
    caret.setAttribute('aria-label', 'Choose a different AI tool');
    caret.innerHTML = '<span class="pmg-send-to-caret" aria-hidden="true">▾</span>';

    var menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Send prompt to');

    wrap.appendChild(main);
    wrap.appendChild(caret);
    wrap.appendChild(menu);
    copyBtn.parentNode.insertBefore(wrap, copyBtn.nextSibling);

    main.addEventListener('click', function () { sendTo(getLastDest()); });
    caret.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    /* Build menu items once. */
    rebuildMenu();
    refreshMainLabel();

    /* Close menu on outside click / Escape. */
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.target === caret || (caret.contains && caret.contains(e.target))) return;
      if (menu.contains(e.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
        try { caret.focus(); } catch (_) {}
      }
    });

    return true;
  }

  function rebuildMenu() {
    var menu = document.getElementById(MENU_ID);
    if (!menu) return;
    var last = getLastDest();
    var html = '';
    DEST_ORDER.forEach(function (key) {
      var d = DESTS[key];
      var meta = d.prefill ? 'Prefills your prompt' : 'Copies your prompt';
      var lastTag = key === last
        ? '<span class="pmg-send-to-last-tag">Last Used</span>'
        : '<span class="pmg-send-to-meta">' + meta + '</span>';
      html += '<button type="button" role="menuitem" data-pmg-send="' + key + '">' +
        '<span>' + d.label + '</span>' +
        lastTag +
        '</button>';
    });
    menu.innerHTML = html;
    menu.querySelectorAll('button[data-pmg-send]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-pmg-send');
        closeMenu();
        sendTo(k);
      });
    });
  }

  function refreshMainLabel() {
    var main = document.getElementById(MAIN_BTN_ID);
    if (!main) return;
    var d = DESTS[getLastDest()];
    var label = main.querySelector('.pmg-send-to-label');
    if (label && d) label.textContent = 'Send To ' + d.label;
    if (d) main.setAttribute('title', 'Send your prompt to ' + d.label);
  }

  function toggleMenu() {
    var menu = document.getElementById(MENU_ID);
    var caret = document.getElementById(CARET_BTN_ID);
    if (!menu) return;
    var open = menu.classList.toggle('is-open');
    if (caret) caret.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      rebuildMenu();
      var first = menu.querySelector('button');
      if (first) try { first.focus(); } catch (_) {}
    }
  }
  function closeMenu() {
    var menu = document.getElementById(MENU_ID);
    var caret = document.getElementById(CARET_BTN_ID);
    if (menu) menu.classList.remove('is-open');
    if (caret) caret.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------
   * Augment the existing "Use Your Prompt In:" cards: add a
   * Gemini card if missing, and intercept clicks on every card
   * so the destination opens with the prompt prefilled (or
   * copy+open for Gemini). Falls back to the original href if
   * no prompt has been generated yet.
   * ------------------------------------------------------------ */
  function augmentOpenInRow() {
    var row = document.querySelector('.open-in-row');
    if (!row) return;

    if (!row.querySelector('.open-in-btn[data-tool="gemini"]')) {
      var card = document.createElement('div');
      card.className = 'open-in-card';
      card.innerHTML =
        '<span class="recommended-badge" id="rec-badge-gemini" hidden>Recommended</span>' +
        '<a class="btn open-in-btn" data-tool="gemini" aria-describedby="open-in-desc-gemini" ' +
          'href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">Gemini</a>' +
        '<p class="open-in-desc" id="open-in-desc-gemini">Best for Google Workspace, multimodal tasks, and image-aware chat</p>';
      row.appendChild(card);
    }

    if (row.__pmgSendToWired) return;
    row.__pmgSendToWired = true;
    row.addEventListener('click', function (e) {
      var a = e.target.closest('.open-in-btn[data-tool]');
      if (!a) return;
      var key = a.getAttribute('data-tool');
      if (!DESTS[key]) return;
      var text = getPromptText();
      if (!text) {
        /* No prompt yet: let the original href open as-is. */
        return;
      }
      e.preventDefault();
      sendTo(key);
    }, false);
  }

  /* ------------------------------------------------------------
   * Boot: try mount immediately; retry on a short interval
   * because some buttons are mutated post-DOMContentLoaded by
   * pmg-premium-polish-js.
   * ------------------------------------------------------------ */
  function boot() {
    injectStyles();
    var ok = mountSplitButton();
    augmentOpenInRow();
    if (ok) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var mounted = mountSplitButton();
      augmentOpenInRow();
      if (mounted || tries > 40) clearInterval(iv);
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Tiny debug API. */
  window.__pmgSendTo = {
    version: SCRIPT_VERSION,
    send: sendTo,
    getLast: getLastDest,
    setLast: setLastDest,
    dests: DESTS
  };
})();
