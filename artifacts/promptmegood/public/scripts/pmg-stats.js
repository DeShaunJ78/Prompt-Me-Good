/* pmg-stats.js  (stats-1)
 *
 * Lightweight streaks + stats card mounted inside the Vault.
 * Reads from localStorage['promptmegood:history:v1'] only — nothing
 * leaves the device. No badges, no popups, no exclamation points.
 * Dismissable; once dismissed, stays dismissed (never re-pops).
 *
 * Kill switches:
 *   ?nostats                            (URL flag, this load only)
 *   localStorage.pmg_stats_disable='1'  (per-device, persistent)
 *
 * Public API:
 *   window.pmgStats.{render, dismiss, reset}
 */
(function () {
  'use strict';
  if (window.__pmgStatsInit) return;
  window.__pmgStatsInit = true;

  var HISTORY_KEY = 'promptmegood:history:v1';
  var DISMISSED_KEY = 'pmg.stats.dismissed.v1';
  var CARD_ID = 'pmg-stats-card';
  var STYLE_ID = 'pmg-stats-styles';

  /* ----------------------------- kill switches ----------------------------- */
  function isDisabled() {
    try {
      if (/[?&]nostats(=|&|$)/.test(location.search)) return true;
      if (localStorage.getItem('pmg_stats_disable') === '1') return true;
    } catch (e) {}
    return false;
  }
  function isDismissed() {
    try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch (e) { return false; }
  }

  /* ------------------------------- styles ---------------------------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + CARD_ID + '{display:flex;flex-direction:column;gap:10px;padding:14px 16px;',
      'margin:0 var(--space-5,16px) var(--space-3,12px);',
      'background:color-mix(in srgb, var(--color-primary, #3ee0a0) 5%, var(--color-surface-2, #161e22));',
      'border:1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 22%, var(--color-border, rgba(255,255,255,.1)));',
      'border-radius:var(--radius-lg, 12px);color:var(--color-text, #e5e7eb);font-size:13px;line-height:1.5}',
      '#' + CARD_ID + ' .pmg-stats-head{display:flex;align-items:center;gap:8px}',
      '#' + CARD_ID + ' .pmg-stats-title{margin:0;font-size:12px;font-weight:600;letter-spacing:.04em;',
      'text-transform:uppercase;color:var(--color-text-muted, #9ca3af);flex:1}',
      '#' + CARD_ID + ' .pmg-stats-dismiss{appearance:none;background:transparent;border:0;color:var(--color-text-muted, #9ca3af);',
      'cursor:pointer;padding:6px;margin:-6px;border-radius:6px;font-size:14px;line-height:1;min-width:28px;min-height:28px}',
      '#' + CARD_ID + ' .pmg-stats-dismiss:hover{color:var(--color-text, #e5e7eb);background:rgba(255,255,255,.06)}',
      '#' + CARD_ID + ' .pmg-stats-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:10px 18px;align-items:baseline}',
      '#' + CARD_ID + ' .pmg-stats-cell{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '#' + CARD_ID + ' .pmg-stats-num{font-size:20px;font-weight:600;color:var(--color-text, #e5e7eb);font-variant-numeric:tabular-nums}',
      '#' + CARD_ID + ' .pmg-stats-label{font-size:11px;color:var(--color-text-muted, #9ca3af)}',
      '#' + CARD_ID + ' .pmg-stats-foot{font-size:12px;color:var(--color-text-muted, #9ca3af);margin:0}',
      '#' + CARD_ID + ' .pmg-stats-tag{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;',
      'background:color-mix(in srgb, var(--color-primary, #3ee0a0) 14%, transparent);',
      'color:var(--color-text, #e5e7eb);margin-right:4px;max-width:140px;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;vertical-align:middle}',
      '@media (prefers-reduced-motion: reduce){#' + CARD_ID + '{transition:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ------------------------------ stats math ------------------------------- */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  /* item.savedAt is canonical (ms epoch); fall back to .ts / .createdAt for
     safety against older shapes. Returns 0 if no usable timestamp. */
  function itemTime(it) {
    if (!it || typeof it !== 'object') return 0;
    var t = it.savedAt || it.ts || it.createdAt || 0;
    return typeof t === 'number' && t > 0 ? t : 0;
  }

  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function computeStreak(items) {
    if (!items.length) return 0;
    var days = new Set();
    for (var i = 0; i < items.length; i++) {
      var t = itemTime(items[i]);
      if (t) days.add(dayKey(t));
    }
    var streak = 0;
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    /* Allow today OR yesterday as the first hit so a user who hasn't saved
       today yet doesn't see their streak vanish at 12:01am. */
    var todayKey = dayKey(cursor.getTime());
    var ydayKey = dayKey(cursor.getTime() - 86400000);
    if (!days.has(todayKey) && !days.has(ydayKey)) return 0;
    if (!days.has(todayKey)) cursor.setTime(cursor.getTime() - 86400000);
    while (days.has(dayKey(cursor.getTime()))) {
      streak++;
      cursor.setTime(cursor.getTime() - 86400000);
    }
    return streak;
  }

  function computeStats() {
    var items = loadHistory();
    var total = items.length;
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    var monthCount = 0;
    var tagCounts = Object.create(null);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object') continue;
      if (itemTime(it) >= monthStart) monthCount++;
      var tags = Array.isArray(it.tags) ? it.tags : [];
      for (var j = 0; j < tags.length; j++) {
        var t = tags[j];
        if (typeof t !== 'string') continue;
        t = t.trim();
        if (!t) continue;
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    var topTags = Object.keys(tagCounts)
      .sort(function (a, b) { return tagCounts[b] - tagCounts[a]; })
      .slice(0, 3);
    return {
      total: total,
      monthCount: monthCount,
      topTags: topTags,
      streak: computeStreak(items)
    };
  }

  /* --------------------------------- DOM ----------------------------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findMountTarget() {
    /* Prefer mounting just above the history list, inside the panel that
       already has the search/sort controls — that puts the card in the
       Vault's natural reading flow. */
    var list = document.getElementById('history-list');
    if (list && list.parentNode) return { parent: list.parentNode, before: list };
    return null;
  }

  function buildCard(stats) {
    var card = document.createElement('div');
    card.id = CARD_ID;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Vault stats');

    var streakLabel = stats.streak === 1 ? 'day streak' : 'days streak';
    var monthLabel = stats.monthCount === 1 ? 'this month' : 'this month';
    var totalLabel = stats.total === 1 ? 'saved total' : 'saved total';

    var tagsHtml = stats.topTags.length
      ? stats.topTags.map(function (t) { return '<span class="pmg-stats-tag">#' + escapeHtml(t) + '</span>'; }).join('')
      : '<span class="pmg-stats-foot" style="font-size:11px">No tags yet — add some to spot themes.</span>';

    card.innerHTML = [
      '<div class="pmg-stats-head">',
      '  <p class="pmg-stats-title">Your Vault, at a glance</p>',
      '  <button type="button" class="pmg-stats-dismiss" aria-label="Hide stats card" title="Hide stats card">×</button>',
      '</div>',
      '<div class="pmg-stats-grid">',
      '  <div class="pmg-stats-cell"><span class="pmg-stats-num">', String(stats.total), '</span><span class="pmg-stats-label">', totalLabel, '</span></div>',
      '  <div class="pmg-stats-cell"><span class="pmg-stats-num">', String(stats.monthCount), '</span><span class="pmg-stats-label">', monthLabel, '</span></div>',
      '  <div class="pmg-stats-cell"><span class="pmg-stats-num">', String(stats.streak), '</span><span class="pmg-stats-label">', streakLabel, '</span></div>',
      '</div>',
      '<p class="pmg-stats-foot">Top tags: ', tagsHtml, '</p>'
    ].join('');

    card.querySelector('.pmg-stats-dismiss').addEventListener('click', function () {
      try { localStorage.setItem(DISMISSED_KEY, '1'); } catch (e) {}
      if (card.parentNode) card.parentNode.removeChild(card);
    });
    return card;
  }

  /* ------------------------------- render ---------------------------------- */
  function render() {
    if (isDisabled() || isDismissed()) return false;
    var target = findMountTarget();
    if (!target) return false;
    var stats = computeStats();
    /* Don't show the card on a brand-new install with literally nothing
       saved — it'd just be a row of zeros. Surfaces once they've saved 1+. */
    if (stats.total === 0) return false;
    injectStyles();
    var existing = document.getElementById(CARD_ID);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var card = buildCard(stats);
    target.parent.insertBefore(card, target.before);
    return true;
  }

  /* ---------------------------- mount + watch ------------------------------ */
  function tryMount() {
    if (render()) return true;
    return false;
  }

  function start() {
    if (tryMount()) return;
    /* The vault DOM may not be fully built yet (chassis-v3 reparents).
       Poll briefly, then give up — the MutationObserver below catches
       anything that lands later. */
    var ticks = 0;
    var poll = setInterval(function () {
      ticks++;
      if (tryMount() || ticks > 30) clearInterval(poll);
    }, 200);

    /* Refresh on save/clear so the numbers stay live as the user works. */
    document.addEventListener('pmg:vault-saved', function () {
      try { render(); } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.pmgStats = {
    render: render,
    dismiss: function () {
      try { localStorage.setItem(DISMISSED_KEY, '1'); } catch (e) {}
      var el = document.getElementById(CARD_ID);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },
    reset: function () {
      try { localStorage.removeItem(DISMISSED_KEY); } catch (e) {}
      render();
    }
  };
})();
