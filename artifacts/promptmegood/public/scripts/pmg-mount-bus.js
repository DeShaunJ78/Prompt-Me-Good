/* =============================================================
 * pmg-mount-bus.js  (mb-1)
 *
 * Shared "DOM-ready-for-mounters" coordinator. Many pmg-*.js
 * scripts (coach, quick-chips, target-platform, text-feedback,
 * voice, ...) need to wait for the chassis to inject their
 * mount anchors after first paint. Historically each script ran
 * its own MutationObserver on document.body{childList,subtree}
 * for 30s — N independent observers all firing on every DOM
 * mutation, with N x M querySelectorAll cost. On mobile Safari
 * this stacks into visible boot stutter.
 *
 * This bus replaces that pattern with:
 *   - ONE shared MutationObserver
 *   - mutations coalesced through requestAnimationFrame
 *   - a single subscriber list invoked at most once per frame
 *   - auto-disconnect after 30s
 *
 * Consumers call:
 *   if (window.pmgMountBus && window.pmgMountBus.isActive()) {
 *     window.pmgMountBus.subscribe(tryMount);
 *   } else {
 *     // fall back to their own observer
 *   }
 *
 * The bus invokes each subscriber once immediately on subscribe
 * so the consumer can attempt an initial mount, then again on
 * every coalesced DOM mutation, then stops after 30s.
 *
 * Strict additive — no UI, no styles, no backend.
 * ============================================================= */
(function () {
  'use strict';

  if (window.pmgMountBus) return;

  var DURATION_MS = 30000;
  var subscribers = [];
  var pendingFrame = null;
  var disconnected = false;
  var startTime = Date.now();
  var observer = null;

  var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };

  function notify() {
    pendingFrame = null;
    if (disconnected) return;
    if (Date.now() - startTime > DURATION_MS) { disconnect(); return; }
    /* Snapshot to allow safe unsubscription mid-iteration. */
    var snapshot = subscribers.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try { snapshot[i](); } catch (_) {}
    }
  }

  function schedule() {
    if (pendingFrame || disconnected) return;
    pendingFrame = raf(notify);
  }

  function disconnect() {
    if (disconnected) return;
    disconnected = true;
    try { if (observer) observer.disconnect(); } catch (_) {}
    subscribers.length = 0;
  }

  function start() {
    if (observer || disconnected) return;
    try {
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (_) { /* no-op — consumers fall back to own observers */ }
    setTimeout(disconnect, DURATION_MS);
  }

  window.pmgMountBus = {
    subscribe: function (fn) {
      if (typeof fn !== 'function' || disconnected) return;
      subscribers.push(fn);
      /* Fire once immediately so the consumer can attempt an initial mount. */
      try { fn(); } catch (_) {}
    },
    isActive: function () { return !disconnected; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
