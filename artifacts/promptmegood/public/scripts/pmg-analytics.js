/* =============================================================
 * pmg-analytics.js  (Task #93)
 *
 * Tiny safe frontend event logger.
 *
 * Goals:
 *   - Send custom events to Microsoft Clarity (already loaded as
 *     project "wgs6567cte"; see index.html line ~200).
 *   - NEVER throw if Clarity is not present, blocked, or not yet
 *     initialised — buffer events and replay once Clarity arrives.
 *   - Mirror events to window.dataLayer if a GA-style tag exists
 *     (currently not present, future-proofing only).
 *   - Keep an in-memory ring buffer of the last 50 events on
 *     window.__pmgAnalytics.recent so a developer can verify in
 *     the console without external tooling.
 *   - Zero PII: callers are responsible for not putting prompt
 *     text or user content in payloads. This helper only relays
 *     short, low-cardinality strings.
 *
 * Public API:
 *   window.__pmgTrack(eventName, payload?)         // primary
 *   window.__pmgAnalytics.recent                    // last 50 events
 *   window.__pmgAnalytics.flushQueue()              // manual replay
 *
 * Disable hatches (any one of these silences this file completely):
 *   ?noanalytics                  query string
 *   localStorage.pmg_disable_analytics = '1'
 *   localStorage.pmg_disable           = '1'
 *
 * Does NOT touch: Stripe, Supabase, backend/API, payment logic.
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgAnalyticsLoaded) return;
  window.__pmgAnalyticsLoaded = true;

  /* ---- Disable hatches ---- */
  var disabled = false;
  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]noanalytics\b/.test(qs)) disabled = true;
    if (localStorage.getItem('pmg_disable_analytics') === '1') disabled = true;
    if (localStorage.getItem('pmg_disable') === '1') disabled = true;
    /* audit-3 §7: cookieless privacy gate. Honor browser-level opt-out
       signals — Do Not Track (legacy) and Global Privacy Control (the
       modern CCPA/GDPR-aligned successor) — so users who have set the
       OS/browser preference are excluded from BOTH the dataLayer mirror
       AND the in-page event queue. The Clarity SDK itself is gated
       separately (in each page's <head>) so the script never even loads
       for opted-out users — no cookies, no replay, no network call. */
    var nav = window.navigator || {};
    var dnt = nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1';
    var gpc = nav.globalPrivacyControl === true;
    if (dnt || gpc) disabled = true;
  } catch (_) {}

  var MAX_RECENT = 50;
  var MAX_QUEUE  = 100;
  var recent = [];
  var queue  = [];

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return ''; }
  }

  function isClarityReady() {
    return typeof window.clarity === 'function';
  }

  /* Send tags to Clarity. Tags are filterable in the Clarity
   * dashboard (Filters → Custom Tags). Each call updates the tag
   * for the current session — we deliberately overwrite rather
   * than appending so cardinality stays low. */
  function setClarityTag(key, value) {
    if (!isClarityReady() || value == null) return;
    try { window.clarity('set', String(key), String(value)); } catch (_) {}
  }

  function fireClarityEvent(name) {
    if (!isClarityReady()) return false;
    try { window.clarity('event', String(name)); return true; }
    catch (_) { return false; }
  }

  function pushDataLayer(name, payload) {
    /* Future-proof: if GTM / GA datalayer ever appears, mirror. */
    try {
      if (Array.isArray(window.dataLayer)) {
        var obj = { event: name };
        if (payload && typeof payload === 'object') {
          for (var k in payload) {
            if (Object.prototype.hasOwnProperty.call(payload, k)) {
              obj[k] = payload[k];
            }
          }
        }
        window.dataLayer.push(obj);
      }
    } catch (_) {}
  }

  function rememberRecent(entry) {
    recent.push(entry);
    if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
  }

  function deliver(entry) {
    /* Tags first so filters are populated when the event lands. */
    if (entry.payload && typeof entry.payload === 'object') {
      for (var k in entry.payload) {
        if (!Object.prototype.hasOwnProperty.call(entry.payload, k)) continue;
        setClarityTag('pmg_' + k, entry.payload[k]);
      }
    }
    var sent = fireClarityEvent(entry.name);
    pushDataLayer(entry.name, entry.payload);
    return sent;
  }

  function flushQueue() {
    if (disabled) { queue.length = 0; return 0; }
    if (!isClarityReady()) return 0;
    var sent = 0;
    while (queue.length) {
      var entry = queue.shift();
      if (deliver(entry)) sent++;
    }
    return sent;
  }

  function track(name, payload) {
    if (disabled) return;
    if (!name || typeof name !== 'string') return;
    var entry = {
      name: name,
      payload: payload && typeof payload === 'object' ? payload : null,
      ts: nowIso()
    };
    rememberRecent(entry);
    if (isClarityReady()) {
      deliver(entry);
    } else {
      if (queue.length >= MAX_QUEUE) queue.shift();
      queue.push(entry);
    }
  }

  /* Poll briefly for Clarity to finish loading, then flush. The
   * Clarity tag is async-injected, so on slow networks our first
   * events may arrive before window.clarity exists. */
  var pollTries = 0;
  var pollHandle = setInterval(function () {
    pollTries++;
    if (isClarityReady()) {
      flushQueue();
      clearInterval(pollHandle);
    } else if (pollTries > 30) {
      /* Give up after ~15s — Clarity is blocked or never loaded.
         Keep recent[] for in-page debugging; drop the queue so we
         don't grow unbounded. */
      queue.length = 0;
      clearInterval(pollHandle);
    }
  }, 500);

  /* Public API */
  window.__pmgTrack     = track;
  window.__pmgAnalytics = {
    version:    'task93-1',
    recent:     recent,
    flushQueue: flushQueue,
    isClarityReady: isClarityReady
  };
})();
