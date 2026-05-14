/* pmg-mailto-fallback.js (mlf-1)
 * Many visitors have no default mail handler set in their OS/browser, so
 * clicking <a href="mailto:..."> does literally nothing — no error, no
 * window, no feedback. This shim makes every mailto: link useful:
 *   1. Copy the address to the clipboard.
 *   2. Show a small toast: "Email copied — paste into your mail app".
 *   3. Still let the mailto: fire (so users WITH a mail client see their
 *      compose window). If the browser opens nothing, the clipboard copy
 *      and toast are the fallback.
 * Kill switches:
 *   - URL: ?mailtoFallbackKey=off
 *   - localStorage.pmg_mailto_fallback_disable = '1'
 */
(function () {
  'use strict';
  try {
    var url = new URL(window.location.href);
    if (url.searchParams.get('mailtoFallbackKey') === 'off') return;
    if (localStorage.getItem('pmg_mailto_fallback_disable') === '1') return;
  } catch (_) { /* ignore */ }

  var TOAST_ID = 'pmg-mailto-toast';
  var TOAST_TIMEOUT = 2600;
  var hideTimer = null;

  function ensureToast() {
    var el = document.getElementById(TOAST_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:32px',
      'transform:translateX(-50%) translateY(20px)',
      'background:#0d1f1c',
      'color:#e6fff8',
      'border:1px solid #1fb6a4',
      'border-radius:10px',
      'padding:12px 18px',
      'font:500 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,.45)',
      'z-index:2147483647',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity .18s ease, transform .18s ease',
      'max-width:90vw',
      'text-align:center',
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function showToast(msg) {
    var el = ensureToast();
    el.textContent = msg;
    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, TOAST_TIMEOUT);
  }

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
      ta.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { return false; }
  }

  function extractEmail(href) {
    if (!href) return null;
    var m = /^mailto:([^?]+)/i.exec(href.trim());
    return m ? decodeURIComponent(m[1]) : null;
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="mailto:" i]') : null;
    if (!a) return;
    var email = extractEmail(a.getAttribute('href'));
    if (!email) return;
    /* Don't preventDefault — let the OS try to open a mail client.
       If nothing happens, the clipboard + toast are the fallback. */
    copyText(email).then(function (ok) {
      showToast(ok
        ? 'Email copied: ' + email + ' — paste into your mail app'
        : email + ' — copy this address into your mail app');
    });
  }, true);
})();
