/* pmg-scroll-debug.js (dbg-1, 2026-05-16)
 *
 * Diagnostic overlay for the post-generate scroll sequence. Gated by
 *   ?dbgscroll=1  in the URL  OR  localStorage.pmg_scroll_debug = '1'.
 *
 * When active, it:
 *   1. Wraps window.scrollTo / scrollBy / Element.scrollIntoView so every
 *      scroll call is logged WITH a stack trace (caller file:line).
 *   2. Listens to body class 'pmg-has-result' becoming true (= generate
 *      finished) and starts a 4-second capture window.
 *   3. At t=0,100,250,500,1000,2000,3500ms during the window, snapshots:
 *        - window scrollY
 *        - #pmgv3-strength-slot rect (top, height, visible?)
 *        - #resultBox rect (top, height, visible?)
 *        - viewport height
 *   4. Renders a fixed bottom-right overlay panel with the full log so
 *      the user can screenshot it. Tap the panel to copy log to clipboard.
 *
 * Zero impact when not gated on. Safe to ship to prod (off by default).
 */
(function () {
  'use strict';

  /* dbg-2 (2026-05-16): kill the URL gate. User visited /app?dbgscroll=1
     and reported "no scan occurred, no printed page" — most likely the
     param didn't survive a redirect or they tapped a link that stripped
     it. For this debug session ONLY, always run. Removed immediately
     after data capture. To disable: localStorage.pmg_scroll_debug='off' */
  try {
    if (localStorage.getItem('pmg_scroll_debug') === 'off') return;
  } catch (_) {}

  var log = [];
  var t0 = Date.now();
  function ts() { return ('+' + (Date.now() - t0) + 'ms').padStart(7, ' '); }
  function push(line) {
    log.push(ts() + ' ' + line);
    render();
  }

  function shortStack() {
    try {
      var s = new Error().stack || '';
      var lines = s.split('\n').slice(2, 6).map(function (l) {
        // Strip URL prefixes for readability
        return l.replace(/https?:\/\/[^/]+/g, '').trim();
      });
      return lines.join(' | ');
    } catch (_) { return '(no stack)'; }
  }

  // 1. Wrap scroll APIs
  var origScrollTo = window.scrollTo.bind(window);
  window.scrollTo = function () {
    var args = Array.prototype.slice.call(arguments);
    var y = (args[0] && typeof args[0] === 'object') ? args[0].top : args[1];
    push('scrollTo(top=' + y + ') ← ' + shortStack());
    return origScrollTo.apply(window, args);
  };
  var origScrollBy = window.scrollBy.bind(window);
  window.scrollBy = function () {
    var args = Array.prototype.slice.call(arguments);
    var y = (args[0] && typeof args[0] === 'object') ? args[0].top : args[1];
    push('scrollBy(' + y + ') ← ' + shortStack());
    return origScrollBy.apply(window, args);
  };
  var origSIV = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    var id = this.id || ('.' + (this.className || '').split(' ')[0]);
    push('scrollIntoView on ' + id + ' ← ' + shortStack());
    return origSIV.apply(this, arguments);
  };

  // 2. Snapshot at key times
  function snap(label) {
    var vh = window.innerHeight;
    var sy = window.pageYOffset;
    var ss = document.getElementById('pmgv3-strength-slot');
    var rb = document.getElementById('resultBox');
    var ssr = ss ? ss.getBoundingClientRect() : null;
    var rbr = rb ? rb.getBoundingClientRect() : null;
    var line = '[' + label + '] vh=' + vh + ' scrollY=' + Math.round(sy);
    if (ssr) line += ' | strengthSlot: top=' + Math.round(ssr.top) + ' h=' + Math.round(ssr.height) + ' vis=' + (ssr.top >= 0 && ssr.top < vh);
    else line += ' | strengthSlot: MISSING';
    if (rbr) line += ' | resultBox: top=' + Math.round(rbr.top) + ' h=' + Math.round(rbr.height);
    else line += ' | resultBox: MISSING';
    push(line);
  }

  // 3. Trigger on 'pmg-has-result' class on body
  var triggered = false;
  function startCapture() {
    if (triggered) return;
    triggered = true;
    push('=== CAPTURE STARTED (pmg-has-result detected) ===');
    [0, 100, 250, 500, 1000, 2000, 3500].forEach(function (t) {
      setTimeout(function () { snap('t=' + t); }, t);
    });
    setTimeout(function () { push('=== CAPTURE COMPLETE ==='); }, 3600);
  }

  var mo = new MutationObserver(function () {
    if (document.body && document.body.classList.contains('pmg-has-result')) {
      startCapture();
    }
  });
  if (document.body) {
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (document.body.classList.contains('pmg-has-result')) startCapture();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // 4. Overlay
  var panel;
  function render() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'pmg-scroll-debug-panel';
      panel.style.cssText =
        'position:fixed;left:6px;right:6px;bottom:6px;z-index:2147483647;' +
        'max-height:55vh;overflow:auto;background:rgba(0,0,0,0.92);' +
        'color:#0f0;font:10px/1.3 ui-monospace,Menlo,monospace;' +
        'padding:8px;border:1px solid #0f0;border-radius:6px;' +
        'white-space:pre-wrap;word-break:break-all;';
      panel.addEventListener('click', function () {
        try {
          navigator.clipboard.writeText(log.join('\n'));
          panel.style.background = 'rgba(0,80,0,0.92)';
          setTimeout(function () { panel.style.background = 'rgba(0,0,0,0.92)'; }, 400);
        } catch (_) {}
      });
      /* dbg-3: append to <html>, NOT <body>. The chassis-v3 universal-
         hide rule `body > *:not(#pmg-chassis-v3-root):not(script)`
         display:none's anything else appended to body. As a sibling
         of body, the panel escapes that rule entirely. position:fixed
         in cssText keeps it visually pinned to the viewport. */
      (document.documentElement || document.body).appendChild(panel);
    }
    if (panel) {
      panel.textContent = 'SCROLL DEBUG (tap to copy)\n' + log.join('\n');
      panel.scrollTop = panel.scrollHeight;
    }
  }
  push('dbg-1 ready. Generate a prompt; overlay shows scroll events.');
})();
