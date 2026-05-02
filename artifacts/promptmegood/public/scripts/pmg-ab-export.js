/* =============================================================
 * pmg-ab-export.js  (Task #89)
 *
 * Lets users export and re-import the two A/B-learning storage
 * keys that pmg-ab-test.js writes:
 *
 *   - pmg.ab.records.v1   (A/B winner / loser records that feed
 *                          the "Why this worked" callout)
 *   - pmg.ab.seenSaves.v1 (history IDs we've already auto-tagged
 *                          for, so the tag bar doesn't re-pester
 *                          on imported saves)
 *
 * Without this, a browser-data wipe or a device move loses every
 * "what worked" insight the Why callout depends on. Importing
 * merges with de-duplication so re-importing the same file is a
 * no-op and merging two devices keeps the union.
 *
 * STRICT additive (project hard-rule compliance):
 *   - No edits to existing IDs, classes, JS variables, or
 *     handlers. We anchor next to the existing #export-everything
 *     button and inject brand-new pmg-ab-* IDs only.
 *   - No backend / API / DB changes — local-only via localStorage.
 *   - Refresh after import is done by triggering a no-op childList
 *     mutation on #history-list, which pmg-ab-test.js already
 *     observes for both the Why callout and the auto-tag bar. We
 *     do not call into pmg-ab-test internals.
 *   - Escape hatches mirror every other pmg-* module:
 *       ?noabexport, localStorage.pmg_abexport_disable=1, or the
 *       global localStorage.pmg_disable=1.
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgAbExportLoaded) return;
  window.__pmgAbExportLoaded = true;

  try {
    if (
      /[?&]noabexport\b/.test(location.search) ||
      localStorage.getItem('pmg_abexport_disable') === '1' ||
      localStorage.getItem('pmg_disable') === '1'
    ) {
      console.info('[pmg-ab-export] disabled via escape hatch');
      return;
    }
  } catch (_) {}

  try {

  /* ------------------------------------------------------------
   * Storage keys + caps — kept in sync with pmg-ab-test.js.
   * ------------------------------------------------------------ */
  var REC_KEY  = 'pmg.ab.records.v1';
  var SEEN_KEY = 'pmg.ab.seenSaves.v1';
  var REC_CAP  = 50;   /* matches recordWin() cap */
  var SEEN_CAP = 80;   /* matches markSeen() cap */

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { return false; }
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg); return; } catch (_) {}
    }
    /* Lightweight fallback — same shape as the rest of pmg-* modules. */
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:#01696f;color:#fff;padding:10px 16px;border-radius:999px;' +
      'font:600 13px system-ui,-apple-system,sans-serif;z-index:9999;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.2)';
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3500);
  }

  /* ------------------------------------------------------------
   * Export
   * ------------------------------------------------------------ */
  function buildPayload() {
    var recs = readJSON(REC_KEY, []);
    var seen = readJSON(SEEN_KEY, []);
    return {
      app: 'PromptMeGood',
      kind: 'ab-data',
      version: 1,
      exportedAt: new Date().toISOString(),
      records:   Array.isArray(recs) ? recs : [],
      seenSaves: Array.isArray(seen) ? seen : []
    };
  }

  function downloadExport() {
    var payload = buildPayload();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'promptmegood-ab-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    try { document.body.removeChild(a); } catch (_) {}
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 1000);
    toast('A/B data exported (' + payload.records.length + ' wins, ' +
      payload.seenSaves.length + ' tagged saves).');
  }

  /* ------------------------------------------------------------
   * Import — merge with de-duplication
   * ------------------------------------------------------------ */

  /* Records dedupe by (ts, winner-text, loser-text). The cap is
     applied newest-first by ts so re-importing an old backup
     can never displace newer wins on the current device. */
  function mergeRecords(existing, incoming) {
    var out = [];
    var sigs = {};
    function sig(r) {
      return String(r && r.ts || 0) + '|' +
        String(r && r.winner || '').slice(0, 200) + '|' +
        String(r && r.loser  || '').slice(0, 200);
    }
    function push(r) {
      if (!r || typeof r !== 'object') return;
      var s = sig(r);
      if (sigs[s]) return;
      sigs[s] = 1;
      out.push(r);
    }
    (Array.isArray(existing) ? existing : []).forEach(push);
    (Array.isArray(incoming) ? incoming : []).forEach(push);
    out.sort(function (a, b) { return (b && b.ts || 0) - (a && a.ts || 0); });
    return out.slice(0, REC_CAP);
  }

  function mergeSeen(existing, incoming) {
    var out = [];
    var seen = {};
    function push(id) {
      if (typeof id !== 'string' || !id) return;
      if (seen[id]) return;
      seen[id] = 1;
      out.push(id);
    }
    (Array.isArray(existing) ? existing : []).forEach(push);
    (Array.isArray(incoming) ? incoming : []).forEach(push);
    return out.slice(0, SEEN_CAP);
  }

  /* pmg-ab-test.js installs a MutationObserver on #history-list
     (childList) that re-runs the auto-tag tick AND the Why
     callout. A transient comment node is the cheapest no-op
     mutation that is guaranteed to fire that observer without
     touching any visible DOM. We also nudge #resultBox because
     pmg-ab-test installs a second observer on it that re-renders
     the Why callout — belt and suspenders if the user is
     looking at a fresh prompt. */
  function nudgeAbRefresh() {
    try {
      var list = document.getElementById('history-list');
      if (list) {
        var probe = document.createComment('pmg-ab-export-refresh');
        list.appendChild(probe);
        list.removeChild(probe);
      }
    } catch (_) {}
    try {
      var box = document.getElementById('resultBox');
      if (box) {
        var probe2 = document.createComment('pmg-ab-export-refresh');
        box.appendChild(probe2);
        box.removeChild(probe2);
      }
    } catch (_) {}
  }

  function applyImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data || data.app !== 'PromptMeGood' || data.kind !== 'ab-data') {
          throw new Error('Not a PromptMeGood A/B data file');
        }
        var existingRecs = readJSON(REC_KEY, []);
        var existingSeen = readJSON(SEEN_KEY, []);
        var beforeRecs = (Array.isArray(existingRecs) ? existingRecs.length : 0);
        var beforeSeen = (Array.isArray(existingSeen) ? existingSeen.length : 0);

        var mergedRecs = mergeRecords(existingRecs, data.records);
        var mergedSeen = mergeSeen(existingSeen,    data.seenSaves);

        writeJSON(REC_KEY,  mergedRecs);
        writeJSON(SEEN_KEY, mergedSeen);

        var addedRecs = mergedRecs.length - beforeRecs;
        var addedSeen = mergedSeen.length - beforeSeen;
        nudgeAbRefresh();
        toast('A/B data imported (' +
          (addedRecs > 0 ? '+' + addedRecs : '0') + ' wins, ' +
          (addedSeen > 0 ? '+' + addedSeen : '0') + ' tagged saves).');
      } catch (err) {
        toast('A/B import failed: ' + ((err && err.message) || 'invalid file'));
      }
    };
    reader.onerror = function () { toast('A/B import failed: could not read file.'); };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------
   * Inject the buttons next to #export-everything
   * ------------------------------------------------------------ */
  function ensureButtons() {
    var anchor = document.getElementById('export-everything');
    if (!anchor || !anchor.parentNode) return false;
    if (document.getElementById('pmg-ab-export-btn')) return true;

    var parent = anchor.parentNode;

    var importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'pmg-ab-import-file';
    importInput.accept = 'application/json,.json';
    importInput.style.display = 'none';

    var exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.id = 'pmg-ab-export-btn';
    exportBtn.className = 'btn btn-secondary';
    exportBtn.title = 'Download your A/B winners and tagged-save markers as JSON';
    exportBtn.textContent = 'Export A/B data';

    var importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.id = 'pmg-ab-import-btn';
    importBtn.className = 'btn btn-secondary';
    importBtn.title = 'Merge an A/B data JSON file back into this device';
    importBtn.textContent = 'Import A/B data';

    exportBtn.addEventListener('click', function () { downloadExport(); });
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      applyImportFile(f);
      /* Reset so re-selecting the same file still fires change. */
      try { importInput.value = ''; } catch (_) {}
    });

    parent.appendChild(importInput);
    parent.appendChild(exportBtn);
    parent.appendChild(importBtn);
    return true;
  }

  function boot() {
    if (ensureButtons()) return;
    /* The dashboard panel-head is part of the always-rendered
       page, but defer just in case other pmg-* modules mutate
       the row late. Stop polling after ~10s. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (ensureButtons() || tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  } catch (e) {
    /* Never break the host page on any unexpected runtime error. */
    try { console.warn('[pmg-ab-export] disabled after error:', e); } catch (_) {}
  }
})();
