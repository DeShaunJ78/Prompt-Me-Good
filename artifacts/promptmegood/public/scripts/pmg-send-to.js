/* =============================================================
 * pmg-send-to.js  (Tasks #60, #84)
 *
 * One-click "Send to" handoffs for both text-mode and image-mode
 * prompts. Two split buttons live next to the existing Copy
 * Prompt buttons; existing IDs / classes / handlers are
 * untouched.
 *
 *   1. TEXT SEND TO SPLIT BUTTON — sits directly after #copy-btn
 *      in the post-generate actions row. Destinations: ChatGPT,
 *      Claude, Gemini, Perplexity. Last choice persists in
 *      localStorage under `pmg.sendto.last.v1`.
 *
 *   2. IMAGE SEND TO SPLIT BUTTON — sits directly after
 *      #copyImagePromptBtn in the image-result-actions row.
 *      Destinations: Midjourney, Leonardo.ai, Ideogram,
 *      DALL·E (via ChatGPT), Bing Image Creator. Last choice
 *      persists separately under `pmg.sendto.image.last.v1`.
 *
 *   3. EXISTING "USE YOUR PROMPT IN:" ROW — the static cards at
 *      #copy-btn's section already include ChatGPT, Claude,
 *      Perplexity. We add a Gemini card (so all four are
 *      represented), and intercept clicks on every card so the
 *      destination URL gets the prompt prefilled (or the prompt
 *      gets copied + the destination is opened where prefill
 *      isn't supported).
 *
 * Prefill behavior per text destination:
 *   - ChatGPT    https://chat.openai.com/?q=<prompt>     prefill
 *   - Claude     https://claude.ai/new?q=<prompt>        prefill
 *   - Perplexity https://www.perplexity.ai/search?q=...  prefill
 *   - Gemini     https://gemini.google.com/app           copy+open
 *
 * Prefill behavior per image destination:
 *   - Midjourney   https://www.midjourney.com/imagine            copy+open
 *   - Leonardo.ai  https://app.leonardo.ai/                      copy+open
 *   - Ideogram     https://ideogram.ai/t/explore                 copy+open
 *   - DALL·E       https://chat.openai.com/?q=<prompt>           prefill
 *   - Bing Create  https://www.bing.com/images/create?q=<prompt> prefill
 *
 * Strict additive: no backend / API / DB / payment / secret
 * changes; no rewrites of existing handlers; the original Copy
 * Prompt and Copy Image Prompt buttons still work exactly the
 * same.
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

  var SCRIPT_VERSION = 'task85-1';
  var STYLE_ID       = 'pmg-send-to-style';
  var TIP_ID         = 'pmg-send-to-tip';
  var TIP_DISMISS_KEY = 'pmg.sendto.tips.dismissed.v1';

  /* Shared classes used by CSS so both split buttons inherit
     identical visuals. IDs remain stable for any external
     reference. */
  var SHELL_CLASS    = 'pmg-send-to-shell';
  var MAIN_CLASS     = 'pmg-send-to-main-btn';
  var CARET_CLASS    = 'pmg-send-to-caret-btn';
  var MENU_CLASS     = 'pmg-send-to-menu-pop';

  /* Text-mode split button (Task #60). */
  var WRAP_ID        = 'pmg-send-to-wrap';
  var MENU_ID        = 'pmg-send-to-menu';
  var MAIN_BTN_ID    = 'pmg-send-to-main';
  var CARET_BTN_ID   = 'pmg-send-to-caret';
  var LAST_KEY       = 'pmg.sendto.last.v1';
  var DEFAULT_DEST   = 'chatgpt';

  /* Image-mode split button (Task #84). */
  var IMG_WRAP_ID      = 'pmg-send-to-image-wrap';
  var IMG_MENU_ID      = 'pmg-send-to-image-menu';
  var IMG_MAIN_BTN_ID  = 'pmg-send-to-image-main';
  var IMG_CARET_BTN_ID = 'pmg-send-to-image-caret';
  var IMG_LAST_KEY     = 'pmg.sendto.image.last.v1';
  var IMG_DEFAULT_DEST = 'midjourney';

  /* Text destination catalog. `prefill` returns the URL to open
     with the prompt embedded (encoded). `null` = no prefill,
     copy + open the bare URL. */
  var DESTS = {
    chatgpt: {
      label: 'ChatGPT',
      url: 'https://chat.openai.com/',
      prefill: function (text) {
        return 'https://chat.openai.com/?q=' + encodeURIComponent(text);
      },
      tip: 'ChatGPT treats this as a single turn — paste a follow-up to refine the answer.'
    },
    claude: {
      label: 'Claude',
      url: 'https://claude.ai/new',
      prefill: function (text) {
        return 'https://claude.ai/new?q=' + encodeURIComponent(text);
      },
      tip: 'Claude reads the whole prompt at once — you can add constraints in a follow-up message.'
    },
    gemini: {
      label: 'Gemini',
      url: 'https://gemini.google.com/app',
      /* sendto-3: Verified in a real browser — Gemini /app does NOT
         honor ?q=, ?text=, ?prompt=, or hash variants. The page loads
         with an empty input regardless. Earlier attempts to prefill
         via the URL were a lie (toast claimed "prefilled" while the
         box stayed empty). Honest behavior: copy-to-clipboard + open
         Gemini, with a tip that tells the user to paste. */
      prefill: null,
      tip: 'Gemini does not accept prefilled prompts — your prompt is on the clipboard, just paste it in (Ctrl/Cmd+V).'
    },
    perplexity: {
      label: 'Perplexity',
      url: 'https://www.perplexity.ai/',
      prefill: function (text) {
        return 'https://www.perplexity.ai/search?q=' + encodeURIComponent(text);
      },
      tip: 'Perplexity searches the live web and cites sources — review the citations before trusting answers.'
    }
  };
  var DEST_ORDER = ['chatgpt', 'claude', 'gemini', 'perplexity'];

  /* Image destination catalog. Most image hosts don't accept a
     URL-prefilled prompt (Midjourney's web alpha, Leonardo.ai,
     Ideogram all require an authenticated session-bound input),
     so we copy the prompt and open the host. The two surfaces
     that DO accept prefill — DALL·E via ChatGPT, and Bing Image
     Creator — get a one-click prefill URL. */
  var IMG_DESTS = {
    midjourney: {
      label: 'Midjourney',
      meta: 'Copies + opens midjourney.com',
      url: 'https://www.midjourney.com/imagine',
      prefill: null,
      tip: 'Midjourney works best with short visual phrases — trim long sentences and add style keywords.'
    },
    leonardo: {
      label: 'Leonardo.ai',
      meta: 'Copies + opens app.leonardo.ai',
      url: 'https://app.leonardo.ai/',
      prefill: null,
      tip: 'Leonardo asks you to pick a model first — choose one that matches the style you want.'
    },
    ideogram: {
      label: 'Ideogram',
      meta: 'Copies + opens ideogram.ai',
      url: 'https://ideogram.ai/t/explore',
      prefill: null,
      tip: 'Ideogram is great at text inside images — wrap any text you want rendered in "quotes".'
    },
    dalle: {
      label: 'DALL·E (ChatGPT)',
      meta: 'Prefills your prompt',
      url: 'https://chat.openai.com/',
      prefill: function (text) {
        return 'https://chat.openai.com/?q=' + encodeURIComponent(text);
      },
      tip: 'DALL·E iterates conversationally — ask ChatGPT to tweak specific parts of the image.'
    },
    bing: {
      label: 'Bing Image Creator',
      meta: 'Prefills your prompt',
      url: 'https://www.bing.com/images/create',
      prefill: function (text) {
        return 'https://www.bing.com/images/create?q=' + encodeURIComponent(text);
      },
      tip: 'Bing Image Creator runs DALL·E 3 — describe subject, style, lighting, and mood for best results.'
    }
  };
  var IMG_DEST_ORDER = ['midjourney', 'leonardo', 'ideogram', 'dalle', 'bing'];

  /* ------------------------------------------------------------
   * Storage helpers — text + image keys stored separately so a
   * user can prefer (e.g.) Claude for text and Midjourney for
   * images without one overwriting the other.
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
  function getImgLastDest() {
    try {
      var v = localStorage.getItem(IMG_LAST_KEY);
      if (v && IMG_DESTS[v]) return v;
    } catch (_) {}
    return IMG_DEFAULT_DEST;
  }
  function setImgLastDest(key) {
    if (!IMG_DESTS[key]) return;
    try { localStorage.setItem(IMG_LAST_KEY, key); } catch (_) {}
  }

  /* Per-destination tip dismissal: stored as a JSON object so a
     user who dismisses the ChatGPT tip still sees the Claude tip
     the first time they hand off there. Power users who dismiss
     them all are never nagged again. */
  function getTipDismissed() {
    try {
      var v = localStorage.getItem(TIP_DISMISS_KEY);
      if (!v) return {};
      var obj = JSON.parse(v);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (_) { return {}; }
  }
  function isTipDismissed(key) {
    return !!getTipDismissed()[key];
  }
  function dismissTip(key) {
    try {
      var d = getTipDismissed();
      d[key] = 1;
      localStorage.setItem(TIP_DISMISS_KEY, JSON.stringify(d));
    } catch (_) {}
  }
  function resetTips() {
    try { localStorage.removeItem(TIP_DISMISS_KEY); } catch (_) {}
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
    /* sendto-4: required so the chassis `body > *:not(...)`
       universal-hide rule doesn't make the toast invisible. */
    t.setAttribute('data-pmg-overlay-root', '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3000);
  }

  /* ------------------------------------------------------------
   * Platform tip — a small banner shown the first few times a
   * user hands off to a destination. It explains what to expect
   * on the other side ("ChatGPT will treat this as a single
   * turn — paste a follow-up to refine"). Includes a "Don't
   * show again" affordance so power users aren't nagged. The
   * dismissal is per-destination, stored in localStorage.
   *
   * Implementation note: this runs synchronously during the
   * Send click so it cannot interfere with the popup-blocker-
   * safe `window.open` that follows in sendToCore.
   * ------------------------------------------------------------ */
  function showTip(destKey, tipText) {
    if (!tipText || !destKey) return;
    if (isTipDismissed(destKey)) return;

    /* Replace any existing tip so rapid hand-offs don't stack. */
    var existing = document.getElementById(TIP_ID);
    if (existing) { try { existing.remove(); } catch (_) {} }

    var tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.className = 'pmg-send-to-tip';
    tip.setAttribute('role', 'status');
    tip.setAttribute('aria-live', 'polite');

    var icon = document.createElement('span');
    icon.className = 'pmg-send-to-tip-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '💡';

    var msg = document.createElement('span');
    msg.className = 'pmg-send-to-tip-msg';
    msg.textContent = tipText;

    var actions = document.createElement('span');
    actions.className = 'pmg-send-to-tip-actions';

    var dontShow = document.createElement('button');
    dontShow.type = 'button';
    dontShow.className = 'pmg-send-to-tip-dismiss';
    dontShow.textContent = "Don't show again";
    dontShow.addEventListener('click', function () {
      dismissTip(destKey);
      try { tip.remove(); } catch (_) {}
    });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmg-send-to-tip-close';
    close.setAttribute('aria-label', 'Dismiss tip');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () {
      try { tip.remove(); } catch (_) {}
    });

    actions.appendChild(dontShow);
    actions.appendChild(close);

    tip.appendChild(icon);
    tip.appendChild(msg);
    tip.appendChild(actions);

    document.body.appendChild(tip);

    /* Auto-dismiss after a comfortable read time. Slightly
       longer than a regular toast since users are reading,
       not just glancing. */
    setTimeout(function () {
      if (!tip.parentNode) return;
      tip.classList.add('pmg-send-to-tip--leaving');
      setTimeout(function () { try { tip.remove(); } catch (_) {} }, 220);
    }, 6500);
  }

  /* ------------------------------------------------------------
   * Get the currently-generated text prompt. Mirrors the
   * existing #copy-btn logic so what's sent matches what's
   * copied.
   * ------------------------------------------------------------ */
  function getPromptText() {
    var box = document.getElementById('resultBox') ||
              document.querySelector('.result-box, [data-prompt-output]');
    if (!box) return '';
    var text = (box.textContent || '').trim();
    if (!text) return '';
    if (text.indexOf('Your fixed prompt will appear here') === 0) return '';
    return text;
  }

  /* Get the currently-composed image prompt. Mirrors the
     existing copyImagePrompt() logic in index.html: prefer the
     fixed prompt in #resultBox, fall back to the raw #goal
     textarea so the user can hand off even before they've run
     the fixer. */
  function getImagePromptText() {
    var rb = document.getElementById('resultBox');
    if (rb) {
      var t = (rb.textContent || rb.innerText || '').trim();
      if (t && t.indexOf('Your fixed prompt will appear here') !== 0) return t;
    }
    var goal = document.getElementById('goal');
    if (goal && goal.value) return goal.value.trim();
    return '';
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
   * Generic send: parameterised over destination catalog,
   * prompt source, and "last used" persistence. Used by both
   * the text and image split buttons.
   *
   * If the dest supports URL prefill, open that URL directly.
   * Otherwise copy to clipboard, open the bare destination, and
   * toast "ready to paste".
   *
   * The new tab is always opened with noopener so it cannot
   * reach back into PromptMeGood.
   * ------------------------------------------------------------ */
  function sendToCore(destKey, opts) {
    var dest = opts.dests[destKey];
    if (!dest) return;
    var text = opts.getText();
    if (!text) {
      toast(opts.emptyMsg);
      return;
    }
    opts.setLast(destKey);
    if (typeof opts.afterSet === 'function') opts.afterSet();

    /* sendto-4: silent send. Per product spec, do NOT show any
       toast or platform-tip banner when the tab opens — the prefill
       (where it works) handles it for logged-in users and they
       should never know the clipboard copy happened. We DO copy
       to the clipboard regardless of whether the dest has a
       prefill URL, so the user has a paste-fallback if the
       destination ignores the param or signs them out.

       Then arm a one-shot visibilitychange watcher: if the user
       returns to PromptMeGood within 60s, that strongly suggests
       the prefill didn't work (or they bounced). In that case we
       show a single helpful toast: "✓ Your prompt is still on
       your clipboard — paste it when you're ready." */
    armReturnToast(dest.label);

    var prefillUrl = (typeof dest.prefill === 'function') ? dest.prefill(text) : null;
    var openUrl = prefillUrl || dest.url;

    /* Open the tab SYNCHRONOUSLY first so popup blockers leave it
       alone (we're still inside the user-gesture stack). Clipboard
       write follows — silent, no toast on success. */
    var win = null;
    try { win = window.open(openUrl, '_blank', 'noopener'); } catch (_) {}
    copyText(text).then(function (ok) {
      if (!win) {
        try { window.open(openUrl, '_blank', 'noopener'); } catch (_) {}
      }
      // Silent. No success toast. The return-watcher handles the
      // edge case where the user comes back without using it.
    });
  }

  /* Return-toast watcher. Fires at most ONCE per launch, only if
     the user returns within 60s. Uses a module-level latch so
     repeated sends don't stack listeners. */
  var _returnArmedAt = 0;
  var _returnDestLabel = '';
  var _returnHooked = false;
  function armReturnToast(destLabel) {
    _returnArmedAt = Date.now();
    _returnDestLabel = destLabel || 'the destination';
    if (_returnHooked) return;
    _returnHooked = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (!_returnArmedAt) return;
      var elapsed = Date.now() - _returnArmedAt;
      if (elapsed > 60000) { _returnArmedAt = 0; return; }
      // Disarm immediately so a quick tab-switch loop doesn't spam.
      _returnArmedAt = 0;
      // Tiny delay so the toast layers above the tab-restore paint.
      setTimeout(function () {
        toast('\u2713 Your prompt is still on your clipboard \u2014 paste it when you\u2019re ready.');
      }, 200);
    });
  }

  function sendTo(destKey) {
    sendToCore(destKey, {
      dests: DESTS,
      getText: getPromptText,
      setLast: setLastDest,
      afterSet: refreshMainLabel,
      emptyMsg: 'Generate a prompt first.',
      tipNs: 'text:'
    });
  }
  function sendToImage(destKey) {
    sendToCore(destKey, {
      dests: IMG_DESTS,
      getText: getImagePromptText,
      setLast: setImgLastDest,
      afterSet: refreshImageMainLabel,
      emptyMsg: 'Describe the image first, then send it.',
      tipNs: 'image:'
    });
  }

  /* ------------------------------------------------------------
   * Styles — keyed on shared classes so both split buttons get
   * identical look + feel.
   * ------------------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.' + SHELL_CLASS + ' {',
      '  position: relative; display: inline-flex; align-items: stretch;',
      '  border-radius: var(--radius-full, 999px); overflow: visible;',
      '  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.06));',
      '}',
      '.' + SHELL_CLASS + ' button {',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  font-weight: 700; font-size: var(--text-sm, 14px);',
      '  cursor: pointer; min-height: 48px;',
      '  transition: background 180ms ease, transform 180ms ease;',
      '}',
      '.' + SHELL_CLASS + ' button:hover { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); }',
      '.' + MAIN_CLASS + ' {',
      '  border-top-left-radius: var(--radius-full, 999px);',
      '  border-bottom-left-radius: var(--radius-full, 999px);',
      '  padding: 0 var(--space-4, 16px) 0 var(--space-5, 20px);',
      '  border-right: none;',
      '}',
      '.' + CARET_CLASS + ' {',
      '  border-top-right-radius: var(--radius-full, 999px);',
      '  border-bottom-right-radius: var(--radius-full, 999px);',
      '  padding: 0 14px; border-left: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);',
      '}',
      '.' + SHELL_CLASS + ' .pmg-send-to-icon { font-size: 14px; opacity: 0.85; margin-right: 6px; }',
      '.' + SHELL_CLASS + ' .pmg-send-to-caret { font-size: 11px; line-height: 1; }',

      '.' + MENU_CLASS + ' {',
      '  position: absolute; top: calc(100% + 6px); right: 0;',
      '  min-width: 260px;',
      '  max-width: min(320px, calc(100vw - 24px));',
      '  padding: 6px;',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);',
      '  border-radius: var(--radius-md, 12px);',
      '  box-shadow: var(--shadow-md, 0 10px 30px rgba(0,0,0,.12));',
      '  z-index: 200; display: none;',
      '}',
      '.' + MENU_CLASS + '.is-open { display: block; }',
      '.' + MENU_CLASS + ' button {',
      '  display: flex; flex-direction: column; align-items: stretch;',
      '  width: 100%; gap: 4px;',
      '  background: transparent; color: var(--color-text);',
      '  border: none; border-radius: 8px;',
      '  padding: 10px 12px; min-height: 44px;',
      '  font-size: var(--text-sm, 14px); font-weight: 600;',
      '  text-align: left; cursor: pointer;',
      '}',
      '.' + MENU_CLASS + ' button:hover, .' + MENU_CLASS + ' button:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));',
      '  outline: none;',
      '}',
      '.' + MENU_CLASS + ' .pmg-send-to-row {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 8px; width: 100%;',
      '}',
      '.' + MENU_CLASS + ' .pmg-send-to-label-text {',
      '  white-space: nowrap; flex: 1 1 auto;',
      '}',
      '.' + MENU_CLASS + ' .pmg-send-to-meta {',
      '  font-size: 11px; font-weight: 500; color: var(--color-text-muted);',
      '  white-space: normal; line-height: 1.35;',
      '}',
      '.' + MENU_CLASS + ' .pmg-send-to-last-tag {',
      '  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;',
      '  text-transform: uppercase; color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 12%, transparent);',
      '  padding: 2px 6px; border-radius: 999px; flex: 0 0 auto;',
      '}',

      '.pmg-send-to-toast {',
      '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
      '  background: var(--color-primary); color: #fff;',
      '  padding: 10px 18px; border-radius: 999px;',
      '  font-weight: 700; font-size: 13px;',
      '  z-index: 300; box-shadow: 0 8px 24px rgba(0,0,0,.25);',
      '}',

      /* Platform tip banner — sits at the top center, slides in
         briefly, dismissible per-destination so power users
         aren\'t nagged. Higher z-index than the standard toast
         so they coexist visually if both appear at once. */
      '.pmg-send-to-tip {',
      '  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);',
      '  display: inline-flex; align-items: center; gap: 12px;',
      '  max-width: min(560px, calc(100vw - 32px));',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-text, #1a1a1a);',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #000) 12%, transparent);',
      '  border-left: 3px solid var(--color-primary, #6c5ce7);',
      '  padding: 10px 14px; border-radius: var(--radius-md, 12px);',
      '  font-size: 13px; line-height: 1.4; font-weight: 500;',
      '  box-shadow: var(--shadow-md, 0 12px 32px rgba(0,0,0,.18));',
      '  z-index: 320;',
      '  animation: pmgSendToTipIn 220ms ease-out;',
      '}',
      '.pmg-send-to-tip--leaving { animation: pmgSendToTipOut 200ms ease-in forwards; }',
      '@keyframes pmgSendToTipIn {',
      '  from { opacity: 0; transform: translate(-50%, -8px); }',
      '  to   { opacity: 1; transform: translate(-50%, 0); }',
      '}',
      '@keyframes pmgSendToTipOut {',
      '  from { opacity: 1; transform: translate(-50%, 0); }',
      '  to   { opacity: 0; transform: translate(-50%, -8px); }',
      '}',
      '.pmg-send-to-tip-icon { font-size: 16px; line-height: 1; flex: 0 0 auto; }',
      '.pmg-send-to-tip-msg { flex: 1 1 auto; min-width: 0; }',
      '.pmg-send-to-tip-actions { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; }',
      '.pmg-send-to-tip-dismiss {',
      '  background: transparent; color: var(--color-text-muted, #555);',
      '  border: none; padding: 4px 8px; border-radius: 6px;',
      '  font-size: 12px; font-weight: 600; cursor: pointer;',
      '  text-decoration: underline; text-underline-offset: 2px;',
      '}',
      '.pmg-send-to-tip-dismiss:hover, .pmg-send-to-tip-dismiss:focus-visible {',
      '  color: var(--color-primary, #6c5ce7); outline: none;',
      '}',
      '.pmg-send-to-tip-close {',
      '  background: transparent; border: none;',
      '  color: var(--color-text-muted, #555);',
      '  font-size: 18px; line-height: 1;',
      '  width: 24px; height: 24px; padding: 0;',
      '  border-radius: 999px; cursor: pointer;',
      '}',
      '.pmg-send-to-tip-close:hover, .pmg-send-to-tip-close:focus-visible {',
      '  background: color-mix(in srgb, var(--color-text, #000) 8%, transparent);',
      '  color: var(--color-text, #1a1a1a); outline: none;',
      '}',
      '@media (max-width: 540px) {',
      '  .pmg-send-to-tip { font-size: 12.5px; padding: 9px 12px; gap: 8px; }',
      '  .pmg-send-to-tip-dismiss { padding: 4px 6px; font-size: 11.5px; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .pmg-send-to-tip,',
      '  .pmg-send-to-tip--leaving { animation: none; }',
      '}',

      /* Per-tool brand styling for .open-in-card / .open-in-btn lives
         in index.html (single source of truth). */

      '@media (prefers-reduced-motion: reduce) {',
      '  .' + SHELL_CLASS + ' button { transition: none; }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------
   * Generic split-button factory. Builds the wrap/main/caret/menu
   * DOM, wires events, and inserts after the supplied anchor
   * element. Returns true on successful mount, false if the
   * anchor doesn't exist yet (caller will retry).
   * ------------------------------------------------------------ */
  function buildSplitButton(cfg) {
    if (document.getElementById(cfg.wrapId)) return true;
    var anchor = document.getElementById(cfg.anchorId);
    if (!anchor || !anchor.parentNode) return false;

    var wrap = document.createElement('span');
    wrap.id = cfg.wrapId;
    wrap.className = SHELL_CLASS;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', cfg.groupLabel);

    var main = document.createElement('button');
    main.type = 'button';
    main.id = cfg.mainId;
    main.className = MAIN_CLASS;
    main.setAttribute('aria-label', cfg.mainAriaLabel);
    main.innerHTML =
      '<span class="pmg-send-to-icon" aria-hidden="true">→</span>' +
      '<span class="pmg-send-to-label">' + cfg.initialLabel + '</span>';

    var caret = document.createElement('button');
    caret.type = 'button';
    caret.id = cfg.caretId;
    caret.className = CARET_CLASS;
    caret.setAttribute('aria-haspopup', 'menu');
    caret.setAttribute('aria-expanded', 'false');
    caret.setAttribute('aria-label', cfg.caretAriaLabel);
    caret.innerHTML = '<span class="pmg-send-to-caret" aria-hidden="true">▾</span>';

    var menu = document.createElement('div');
    menu.id = cfg.menuId;
    menu.className = MENU_CLASS;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', cfg.menuAriaLabel);

    wrap.appendChild(main);
    wrap.appendChild(caret);
    wrap.appendChild(menu);
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    main.addEventListener('click', function () { cfg.onMainClick(); });
    caret.addEventListener('click', function (e) {
      e.stopPropagation();
      cfg.onCaretToggle();
    });

    cfg.rebuildMenu();
    cfg.refreshLabel();

    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.target === caret || (caret.contains && caret.contains(e.target))) return;
      if (menu.contains(e.target)) return;
      cfg.closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        cfg.closeMenu();
        try { caret.focus(); } catch (_) {}
      }
    });

    return true;
  }

  /* ------------------------------------------------------------
   * Text split button mount.
   * ------------------------------------------------------------ */
  function mountSplitButton() {
    return buildSplitButton({
      wrapId: WRAP_ID,
      mainId: MAIN_BTN_ID,
      caretId: CARET_BTN_ID,
      menuId: MENU_ID,
      anchorId: 'copy-btn',
      groupLabel: 'Send prompt to an AI tool',
      mainAriaLabel: 'Send prompt to last-used AI tool',
      caretAriaLabel: 'Choose a different AI tool',
      menuAriaLabel: 'Send prompt to',
      initialLabel: 'Send To ChatGPT',
      onMainClick: function () { sendTo(getLastDest()); },
      onCaretToggle: toggleMenu,
      rebuildMenu: rebuildMenu,
      refreshLabel: refreshMainLabel,
      closeMenu: closeMenu
    });
  }

  function rebuildMenu() {
    var menu = document.getElementById(MENU_ID);
    if (!menu) return;
    var last = getLastDest();
    var html = '';
    DEST_ORDER.forEach(function (key) {
      var d = DESTS[key];
      var meta = d.prefill ? 'Prefills your prompt' : 'Copies your prompt';
      var isLast = key === last;
      var rowExtra = isLast ? '<span class="pmg-send-to-last-tag">Last Used</span>' : '';
      var metaLine = isLast ? '' : '<span class="pmg-send-to-meta">' + meta + '</span>';
      html += '<button type="button" role="menuitem" data-pmg-send="' + key + '">' +
        '<span class="pmg-send-to-row">' +
          '<span class="pmg-send-to-label-text">' + d.label + '</span>' +
          rowExtra +
        '</span>' +
        metaLine +
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
   * Image split button mount (Task #84).
   * ------------------------------------------------------------ */
  function mountImageSplitButton() {
    return buildSplitButton({
      wrapId: IMG_WRAP_ID,
      mainId: IMG_MAIN_BTN_ID,
      caretId: IMG_CARET_BTN_ID,
      menuId: IMG_MENU_ID,
      anchorId: 'copyImagePromptBtn',
      groupLabel: 'Send image prompt to an image generator',
      mainAriaLabel: 'Send image prompt to last-used image generator',
      caretAriaLabel: 'Choose a different image generator',
      menuAriaLabel: 'Send image prompt to',
      initialLabel: 'Send To Midjourney',
      onMainClick: function () { sendToImage(getImgLastDest()); },
      onCaretToggle: toggleImageMenu,
      rebuildMenu: rebuildImageMenu,
      refreshLabel: refreshImageMainLabel,
      closeMenu: closeImageMenu
    });
  }

  function rebuildImageMenu() {
    var menu = document.getElementById(IMG_MENU_ID);
    if (!menu) return;
    var last = getImgLastDest();
    var html = '';
    IMG_DEST_ORDER.forEach(function (key) {
      var d = IMG_DESTS[key];
      var meta = d.meta || (d.prefill ? 'Prefills your prompt' : 'Copies your prompt');
      var isLast = key === last;
      var rowExtra = isLast ? '<span class="pmg-send-to-last-tag">Last Used</span>' : '';
      var metaLine = isLast ? '' : '<span class="pmg-send-to-meta">' + meta + '</span>';
      html += '<button type="button" role="menuitem" data-pmg-send-image="' + key + '">' +
        '<span class="pmg-send-to-row">' +
          '<span class="pmg-send-to-label-text">' + d.label + '</span>' +
          rowExtra +
        '</span>' +
        metaLine +
        '</button>';
    });
    menu.innerHTML = html;
    menu.querySelectorAll('button[data-pmg-send-image]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-pmg-send-image');
        closeImageMenu();
        sendToImage(k);
      });
    });
  }

  function refreshImageMainLabel() {
    var main = document.getElementById(IMG_MAIN_BTN_ID);
    if (!main) return;
    var d = IMG_DESTS[getImgLastDest()];
    var label = main.querySelector('.pmg-send-to-label');
    if (label && d) label.textContent = 'Send To ' + d.label;
    if (d) main.setAttribute('title', 'Send your image prompt to ' + d.label);
  }

  function toggleImageMenu() {
    var menu = document.getElementById(IMG_MENU_ID);
    var caret = document.getElementById(IMG_CARET_BTN_ID);
    if (!menu) return;
    var open = menu.classList.toggle('is-open');
    if (caret) caret.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      rebuildImageMenu();
      var first = menu.querySelector('button');
      if (first) try { first.focus(); } catch (_) {}
    }
  }
  function closeImageMenu() {
    var menu = document.getElementById(IMG_MENU_ID);
    var caret = document.getElementById(IMG_CARET_BTN_ID);
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
        '<p class="open-in-desc" id="open-in-desc-gemini">Best for Google Workspace, multimodal tasks, and image-aware chat.</p>';
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
    var textOk = mountSplitButton();
    var imageOk = mountImageSplitButton();
    augmentOpenInRow();
    if (textOk && imageOk) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (!textOk) textOk = mountSplitButton();
      if (!imageOk) imageOk = mountImageSplitButton();
      augmentOpenInRow();
      if ((textOk && imageOk) || tries > 40) clearInterval(iv);
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
    sendImage: sendToImage,
    getLast: getLastDest,
    setLast: setLastDest,
    getLastImage: getImgLastDest,
    setLastImage: setImgLastDest,
    dests: DESTS,
    imageDests: IMG_DESTS,
    showTip: showTip,
    isTipDismissed: isTipDismissed,
    dismissTip: dismissTip,
    resetTips: resetTips
  };
})();
