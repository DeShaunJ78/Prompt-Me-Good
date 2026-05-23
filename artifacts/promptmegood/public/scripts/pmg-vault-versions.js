/* pmg-vault-versions.js (vv-1, 2026-05-23)
 *
 * Spec 3 — Prompt Versioning. Tracks multiple versions of a saved Vault
 * entry when the user re-saves a prompt with the same title (case-
 * insensitive, trimmed). Renders a version badge + collapsible history
 * panel on cards that have 2+ versions, with a Restore button per row.
 *
 * Kill switch: localStorage.pmg_vault_versions_disable === '1'
 *
 * Storage:    same HISTORY_KEY as the rest of the Vault. Each entry
 *             gains an optional `versions: [{text, savedAt, label}]`
 *             field — oldest first.
 * Save event: listens to document 'pmg:vault-saved' (existing signal,
 *             see app.html L7179).
 * Render:     listens to 'pmg:vault:imported' + MutationObserver on
 *             #history-list (re-renders triggered by other scripts
 *             rebuild the card DOM, so we re-decorate on every mutation).
 *
 * Never calls any pmg* function by name. Never rewrites the entries
 * array without read-modify-write. Never adds more than one badge or
 * history panel per card (idempotent decoration via data attribute).
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_vault_versions_disable') === '1') return;
  } catch (_) { /* ignore */ }

  var HISTORY_KEY = 'promptmegood:history:v1';

  /* ---------- Storage helpers (read-modify-write) ---------- */
  function loadItems() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function saveItems(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
    catch (_) { /* quota or disabled — fail silently */ }
  }

  function titleOf(item) {
    var t = (item && (item.nickname || (item.data && item.data.goal))) || '';
    return String(t).trim().toLowerCase();
  }

  function nowIso() { return new Date().toISOString(); }

  /* ---------- THING 1 — intercept saves & track versions ----------
     The existing addToHistory() in app.html prepends a new entry on
     every save (no title-based merge). After 'pmg:vault-saved' fires
     we look at the most-recently-saved entry (items[0]) and ask: is
     there an OLDER entry with the same title? If yes, fold this save
     into that older entry's versions array and remove the duplicate
     fresh entry. */
  function ingestLatestSave() {
    var items = loadItems();
    if (!items.length) return;
    var latest = items[0];
    if (!latest || !latest.prompt) return;
    var key = titleOf(latest);
    if (!key) return;

    /* Find an earlier sibling with the same title (skip index 0). */
    var twinIdx = -1;
    for (var i = 1; i < items.length; i++) {
      if (titleOf(items[i]) === key) { twinIdx = i; break; }
    }

    if (twinIdx === -1) {
      /* First save of this title — initialize versions with v1 if missing. */
      if (!Array.isArray(latest.versions) || !latest.versions.length) {
        latest.versions = [{
          text: latest.prompt,
          savedAt: nowIso(),
          label: 'v1'
        }];
        saveItems(items);
      }
      return;
    }

    var twin = items[twinIdx];
    /* Seed twin.versions with its existing text as v1 if absent. */
    if (!Array.isArray(twin.versions) || !twin.versions.length) {
      twin.versions = [{
        text: twin.prompt,
        savedAt: typeof twin.savedAt === 'number'
          ? new Date(twin.savedAt).toISOString()
          : (twin.savedAt || nowIso()),
        label: 'v1'
      }];
    }
    /* Avoid pushing an identical-text version twice in a row. */
    var lastVer = twin.versions[twin.versions.length - 1];
    if (!lastVer || lastVer.text !== latest.prompt) {
      twin.versions.push({
        text: latest.prompt,
        savedAt: nowIso(),
        label: 'v' + (twin.versions.length + 1)
      });
    }
    /* Promote new text + carry forward data snapshot. */
    twin.prompt = latest.prompt;
    if (latest.data && typeof latest.data === 'object') {
      twin.data = latest.data;
    }
    twin.savedAt = latest.savedAt || Date.now();

    /* Remove the duplicate fresh entry (index 0). */
    items.splice(0, 1);
    /* Move the updated twin to the top so the user sees it where the
       fresh save landed. After splice, twin is at twinIdx - 1. */
    var newIdx = twinIdx - 1;
    if (newIdx > 0) {
      items.splice(newIdx, 1);
      items.unshift(twin);
    }
    saveItems(items);

    /* Ask the rest of the app to re-render the vault so the version
       badge appears immediately. */
    try {
      document.dispatchEvent(new CustomEvent('pmg:vault:imported', {
        detail: { count: 0, duplicates: 0, source: 'vault-versions' }
      }));
    } catch (_) { /* ignore */ }
  }

  /* ---------- Relative time helper ---------- */
  function relativeTime(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var diff = Date.now() - t;
    if (diff < 60 * 1000) return 'just now';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' hours ago';
    try { return new Date(t).toLocaleDateString(); } catch (_) { return ''; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- THING 2 — decorate vault cards ---------- */
  function decorateCard(card) {
    if (!card || card.getAttribute('data-pmg-ver-decorated') === '1') return;
    var id = card.getAttribute('data-id');
    if (!id) return;

    var items = loadItems();
    var entry = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === id) { entry = items[i]; break; }
    }
    if (!entry || !Array.isArray(entry.versions) || entry.versions.length < 2) return;

    var goalEl = card.querySelector('.history-item-goal');
    if (!goalEl || goalEl.querySelector('.pmg-ver-badge')) return;

    var n = entry.versions.length;
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'pmg-ver-badge';
    badge.setAttribute('aria-label', 'Toggle version history (' + n + ' versions)');
    badge.setAttribute('aria-expanded', 'false');
    badge.textContent = 'v' + n;
    goalEl.appendChild(badge);

    var historyDiv = document.createElement('div');
    historyDiv.className = 'pmg-ver-history';
    historyDiv.hidden = true;
    var rowsHtml = '<div class="pmg-ver-history-title">Version History</div>';
    /* Newest first. */
    for (var k = entry.versions.length - 1; k >= 0; k--) {
      var v = entry.versions[k];
      rowsHtml +=
        '<div class="pmg-ver-row">' +
          '<span class="pmg-ver-label">' + escapeHtml(v.label || ('v' + (k + 1))) + '</span>' +
          '<span class="pmg-ver-date">' + escapeHtml(relativeTime(v.savedAt) || '') + '</span>' +
          '<button type="button" class="pmg-ver-restore btn btn-secondary" data-pmg-ver-restore="' + k + '">Restore</button>' +
        '</div>';
    }
    historyDiv.innerHTML = rowsHtml;
    card.appendChild(historyDiv);

    badge.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isHidden = historyDiv.hidden;
      historyDiv.hidden = !isHidden;
      badge.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    historyDiv.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.matches || !t.matches('[data-pmg-ver-restore]')) return;
      e.preventDefault();
      e.stopPropagation();
      var idx = parseInt(t.getAttribute('data-pmg-ver-restore'), 10);
      restoreVersion(id, idx);
    });

    card.setAttribute('data-pmg-ver-decorated', '1');
  }

  function restoreVersion(entryId, versionIdx) {
    var items = loadItems();
    var entry = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === entryId) { entry = items[i]; break; }
    }
    if (!entry || !Array.isArray(entry.versions)) return;
    var v = entry.versions[versionIdx];
    if (!v || typeof v.text !== 'string') return;
    entry.prompt = v.text;
    saveItems(items);
    try {
      document.dispatchEvent(new CustomEvent('pmg:vault:imported', {
        detail: { count: 0, duplicates: 0, source: 'vault-versions-restore' }
      }));
    } catch (_) { /* ignore */ }
  }

  function decorateAll() {
    var cards = document.querySelectorAll('.history-item[data-id]:not([data-pmg-ver-decorated="1"])');
    for (var i = 0; i < cards.length; i++) decorateCard(cards[i]);
  }

  /* ---------- Boot ---------- */
  function boot() {
    document.addEventListener('pmg:vault-saved', function () {
      /* The Vault re-renders synchronously inside addToHistory before
         this event fires, so card DOM exists when we ingest. We still
         schedule a microtask delay so any listeners ahead of us finish. */
      setTimeout(function () { ingestLatestSave(); decorateAll(); }, 0);
    });
    document.addEventListener('pmg:vault:imported', function () {
      setTimeout(decorateAll, 0);
    });

    var list = document.getElementById('history-list');
    if (list && typeof MutationObserver === 'function') {
      var mo = new MutationObserver(function () { decorateAll(); });
      mo.observe(list, { childList: true, subtree: true });
    }

    decorateAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
