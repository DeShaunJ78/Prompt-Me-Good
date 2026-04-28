/* =====================================================================
 * PromptMeGood — PRO TIER SYSTEM (Tasks 1–4)
 *
 * Single self-contained file. Provides:
 *   TASK 1  Pro flag in localStorage + helpers (pmgIsPro / pmgUnlockPro
 *           / pmgRevokePro / showProUnlockedToast)
 *   TASK 2  All Pro-related CSS injected at runtime (no edits to
 *           existing stylesheets)
 *   TASK 3  showUpgradeModal(featureName) — shared upgrade overlay
 *   TASK 4  Per-feature gating:
 *             1. Run With AI               (3/day for free)
 *             2. Image Generation          (1/day for free)
 *             3. File And Image Analysis   (1/day for free)
 *             4. Cloud Prompt Vault        (new ☁ Cloud Sync button)
 *             5. Money Mode                (free works; Pro badge for
 *                                          advanced workflow templates)
 *             6. Brand Voice Profiles      (new button in Power Ups)
 *             7. Bulk Export & Team Folders (new Team Export button)
 *
 * Console helpers (call from DevTools when a user pays):
 *     pmgUnlockPro()      // grant Pro
 *     pmgRevokePro()      // remove Pro and reload
 *
 * Hard-rule compliance:
 *   - No backend / API / DB / payment / secret changes
 *   - No renames of any existing IDs, classes, or JS variables
 *   - All new logic in one centralized IIFE
 *   - All colors via CSS variables
 *   - Hide / move / collapse over deletion
 *   - Anchors preserved (modal CTA links to ./pricing.html#early-access)
 * ===================================================================== */
(function pmgProTierSystem() {
  'use strict';
  if (window.__pmgProInit) return;
  window.__pmgProInit = true;

  /* =================================================================
   * TASK 1 — Pro gate (single source of truth)
   * ================================================================= */
  var PRO_KEY = 'promptmegood:pro:v1';
  window.PMG_PRO_KEY = PRO_KEY;

  function pmgIsPro() {
    try { return localStorage.getItem(PRO_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function pmgUnlockPro() {
    try {
      localStorage.setItem(PRO_KEY, 'true');
      document.body.classList.add('pmg-is-pro');
      document.querySelectorAll('.pmg-pro-feature').forEach(function (el) {
        el.classList.remove('pmg-locked');
      });
      showProUnlockedToast();
    } catch (e) {}
  }

  function pmgRevokePro() {
    try { localStorage.removeItem(PRO_KEY); } catch (e) {}
    try { window.location.reload(); } catch (e) {}
  }

  function showProUnlockedToast() {
    var t = document.createElement('div');
    t.className = 'pmg-pro-toast';
    t.textContent = '🎉 Pro Unlocked! All Features Are Now Available.';
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (e) {} }, 4000);
  }

  window.pmgIsPro = pmgIsPro;
  window.pmgUnlockPro = pmgUnlockPro;
  window.pmgRevokePro = pmgRevokePro;
  window.showProUnlockedToast = showProUnlockedToast;

  /* Daily counters (auto-rotate at midnight via date-stamped keys) */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function counterKey(feature) { return 'pmg_' + feature + '_count_' + todayStr(); }
  function pmgGetDailyCount(feature) {
    try { return parseInt(localStorage.getItem(counterKey(feature)) || '0', 10) || 0; }
    catch (e) { return 0; }
  }
  function pmgIncrementDailyCount(feature) {
    try {
      var n = pmgGetDailyCount(feature) + 1;
      localStorage.setItem(counterKey(feature), String(n));
      return n;
    } catch (e) { return 0; }
  }

  var DAILY_LIMITS = { run: 3, img: 1, analyze: 1 };

  function pmgLimitReached(feature) {
    if (pmgIsPro()) return false;
    var lim = DAILY_LIMITS[feature];
    if (typeof lim !== 'number') return false;
    return pmgGetDailyCount(feature) >= lim;
  }
  function pmgRemainingToday(feature) {
    var lim = DAILY_LIMITS[feature] || 0;
    return Math.max(0, lim - pmgGetDailyCount(feature));
  }
  window.pmgGetDailyCount = pmgGetDailyCount;
  window.pmgIncrementDailyCount = pmgIncrementDailyCount;
  window.pmgLimitReached = pmgLimitReached;
  window.pmgRemainingToday = pmgRemainingToday;

  /* =================================================================
   * TASK 2 — Pro lock CSS
   * ================================================================= */
  var STYLE_ID = 'pmg-pro-system-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.pmg-pro-wrapper { position: relative; display: contents; }',
      '.pmg-pro-feature { position: relative; }',

      '.pmg-pro-badge {',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  font-size: 10px; font-weight: 700; line-height: 1.2;',
      '  color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));',
      '  border-radius: var(--radius-full, 999px);',
      '  padding: 2px 8px; margin-left: 6px;',
      '  vertical-align: middle; letter-spacing: 0.04em;',
      '  cursor: pointer; user-select: none;',
      '  transition: background 180ms ease;',
      '}',
      '.pmg-pro-badge:hover, .pmg-pro-badge:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));',
      '  outline: none;',
      '}',

      '.pmg-pro-lock-icon {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 20px; height: 20px; font-size: 12px;',
      '  opacity: 0.65; margin-left: 4px;',
      '  vertical-align: middle; cursor: pointer;',
      '  transition: opacity 180ms ease, transform 180ms ease;',
      '}',
      '.pmg-pro-lock-icon:hover, .pmg-pro-lock-icon:focus-visible {',
      '  opacity: 1; transform: scale(1.15); outline: none;',
      '}',
      '.pmg-locked .pmg-pro-lock-icon { opacity: 0.85; pointer-events: all; }',

      /* Locked visual: dim children (but keep lock icon and badge sharp) */
      '.pmg-locked > *:not(.pmg-pro-lock-icon):not(.pmg-pro-badge) {',
      '  opacity: 0.5; user-select: none; filter: blur(0.3px);',
      '}',

      'body.pmg-is-pro .pmg-locked > * { opacity: 1 !important; filter: none !important; }',
      'body.pmg-is-pro .pmg-pro-lock-icon { display: none !important; }',
      'body.pmg-is-pro .pmg-pro-badge {',
      '  background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface));',
      '  color: var(--color-primary);',
      '}',
      'body.pmg-is-pro .pmg-pro-badge::before { content: "✓ "; }',

      /* Upgrade overlay + modal */
      '.pmg-upgrade-overlay {',
      '  position: fixed; inset: 0;',
      '  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);',
      '  z-index: 200; display: flex; align-items: center; justify-content: center;',
      '  padding: var(--space-4, 16px); animation: pmgProFadeIn 200ms ease;',
      '}',
      '@keyframes pmgProFadeIn { from { opacity: 0; } to { opacity: 1; } }',

      '.pmg-upgrade-modal {',
      '  background: var(--color-surface);',
      '  border-radius: var(--radius-xl, 16px);',
      '  padding: var(--space-6, 24px);',
      '  max-width: 400px; width: 100%;',
      '  box-shadow: var(--shadow-lg, 0 20px 50px rgba(0,0,0,0.3));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));',
      '  text-align: center; animation: pmgProSlideUp 250ms ease;',
      '  box-sizing: border-box;',
      '}',
      '@keyframes pmgProSlideUp {',
      '  from { opacity: 0; transform: translateY(16px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',
      '.pmg-upgrade-modal-icon { font-size: 2.5rem; margin-bottom: var(--space-3, 12px); display: block; }',
      '.pmg-upgrade-modal h3 {',
      '  font-size: var(--text-lg, 18px); font-weight: 800;',
      '  margin: 0 0 var(--space-2, 8px); color: var(--color-text);',
      '}',
      '.pmg-upgrade-modal p {',
      '  font-size: var(--text-sm, 14px); color: var(--color-text-muted);',
      '  margin: 0 0 var(--space-5, 20px); line-height: 1.6;',
      '}',
      '.pmg-upgrade-modal-actions {',
      '  display: flex; flex-direction: column; gap: var(--space-2, 8px);',
      '}',
      '.pmg-upgrade-cta {',
      '  display: block; width: 100%; padding: 14px; box-sizing: border-box;',
      '  background: var(--color-primary); color: #fff !important;',
      '  border: none; border-radius: var(--radius-full, 999px);',
      '  font-size: var(--text-base, 16px); font-weight: 700;',
      '  cursor: pointer; text-decoration: none;',
      '  transition: opacity 180ms ease;',
      '}',
      '.pmg-upgrade-cta:hover { opacity: 0.9; }',
      '.pmg-upgrade-dismiss {',
      '  background: none; border: none;',
      '  color: var(--color-text-muted);',
      '  font-size: var(--text-sm, 14px); cursor: pointer;',
      '  padding: var(--space-2, 8px);',
      '  transition: color 180ms ease;',
      '}',
      '.pmg-upgrade-dismiss:hover { color: var(--color-text); }',

      /* Toast */
      '.pmg-pro-toast {',
      '  position: fixed; bottom: var(--space-6, 24px);',
      '  left: 50%; transform: translateX(-50%);',
      '  background: var(--color-primary); color: #fff;',
      '  padding: var(--space-3, 12px) var(--space-5, 20px);',
      '  border-radius: var(--radius-full, 999px);',
      '  font-weight: 700; font-size: var(--text-sm, 14px);',
      '  z-index: 300; animation: pmgProSlideUp 300ms ease;',
      '  white-space: nowrap; box-shadow: 0 8px 24px rgba(0,0,0,0.25);',
      '}',

      /* Tiny "(N of N free today)" hint next to gated buttons */
      '.pmg-daily-hint {',
      '  display: inline-block; font-size: 11px; font-weight: 600;',
      '  color: var(--color-text-muted); margin-left: 8px;',
      '  vertical-align: middle;',
      '}',
      'body.pmg-is-pro .pmg-daily-hint { display: none !important; }',

      /* New Team Export / Cloud Sync / Brand Voice buttons match button rhythm */
      '#pmg-cloud-sync-btn, #pmg-team-export-btn { display: inline-flex; align-items: center; gap: 6px; }',
      '.pmg-brand-voice-row { padding: var(--space-3, 12px); border: 1px dashed color-mix(in srgb, var(--color-primary) 25%, var(--color-border)); border-radius: var(--radius-md, 8px); margin-top: var(--space-3, 12px); display: flex; flex-direction: column; gap: var(--space-2, 8px); }',
      '.pmg-brand-voice-row strong { font-size: var(--text-sm, 14px); }',
      '.pmg-brand-voice-row span { display: block; font-size: var(--text-xs, 12px); color: var(--color-text-muted); }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* =================================================================
   * TASK 3 — Upgrade modal
   * ================================================================= */
  function showUpgradeModal(featureName) {
    var existing = document.getElementById('pmg-upgrade-overlay');
    if (existing) existing.remove();

    var safe = String(featureName || 'This Feature').replace(/[<>&"]/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c];
    });

    var overlay = document.createElement('div');
    overlay.className = 'pmg-upgrade-overlay';
    overlay.id = 'pmg-upgrade-overlay';
    overlay.innerHTML =
      '<div class="pmg-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="pmg-upgrade-title">' +
        '<span class="pmg-upgrade-modal-icon" aria-hidden="true">🔒</span>' +
        '<h3 id="pmg-upgrade-title">' + safe + ' Is A Pro Feature</h3>' +
        '<p>Upgrade To Pro For $9/Month And Unlock Unlimited Access To This Feature, Plus Cloud Sync, Image Generation, File Analysis, And More.</p>' +
        '<div class="pmg-upgrade-modal-actions">' +
          '<a class="pmg-upgrade-cta" href="./pricing.html#early-access">Join Pro Early Access</a>' +
          '<button type="button" class="pmg-upgrade-dismiss" id="pmg-upgrade-dismiss-btn">Maybe Later</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var dismissBtn = document.getElementById('pmg-upgrade-dismiss-btn');
    if (dismissBtn) dismissBtn.addEventListener('click', function () { overlay.remove(); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    var esc = function (e) {
      if (e.key === 'Escape') {
        try { overlay.remove(); } catch (_) {}
        document.removeEventListener('keydown', esc);
      }
    };
    document.addEventListener('keydown', esc);
  }
  window.showUpgradeModal = showUpgradeModal;

  /* =================================================================
   * TASK 4 — Apply locks to specific features
   * ================================================================= */

  /* Map of button-id -> { feature: counter-key, label: human-readable } */
  var GATED = {
    'runBtn':              { feature: 'run',     label: 'Run With AI' },
    'image-generate-btn':  { feature: 'img',     label: 'Image Generation' },
    'imageBtn':            { feature: 'img',     label: 'Image Generation' },
    'upload-analyze-btn':  { feature: 'analyze', label: 'File And Image Analysis' }
  };

  /* Capture-phase intercept: runs BEFORE inline onclick handlers fire.
     If user is at limit and not Pro -> open modal + stop everything.
     Otherwise increment counter and let the original handler run. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button, a');
    if (!btn || !btn.id) return;
    var cfg = GATED[btn.id];
    if (!cfg) return;
    if (pmgIsPro()) return;

    if (pmgLimitReached(cfg.feature)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showUpgradeModal(cfg.label);
      return;
    }
    pmgIncrementDailyCount(cfg.feature);
    /* Refresh hints after a tick so the count visually updates */
    setTimeout(refreshDailyHints, 0);
  }, true);

  function ensureHint(btn, feature) {
    if (!btn || !btn.parentNode) return;
    var hint = btn.parentNode.querySelector(
      '.pmg-daily-hint[data-feature="' + feature + '"]'
    );
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'pmg-daily-hint';
      hint.setAttribute('data-feature', feature);
      btn.parentNode.insertBefore(hint, btn.nextSibling);
    }
    var rem = pmgRemainingToday(feature);
    var lim = DAILY_LIMITS[feature];
    var nextText = rem > 0
      ? '(' + rem + ' Of ' + lim + ' Free Today)'
      : '(Daily Limit Reached — Upgrade For Unlimited)';
    /* Idempotent: only touch DOM when text actually changes. Avoids
       infinite MutationObserver feedback loops. */
    if (hint.textContent !== nextText) hint.textContent = nextText;
  }
  function refreshDailyHints() {
    if (pmgIsPro()) return;
    [
      ['runBtn',             'run'],
      ['image-generate-btn', 'img'],
      ['upload-analyze-btn', 'analyze']
    ].forEach(function (p) {
      ensureHint(document.getElementById(p[0]), p[1]);
    });
  }

  function addLockIcon(btn, label) {
    if (!btn) return;
    if (btn.querySelector(':scope > .pmg-pro-lock-icon')) return;
    var icon = document.createElement('span');
    icon.className = 'pmg-pro-lock-icon';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', label + ' — Pro feature');
    icon.title = label + ' — Pro feature';
    icon.textContent = '🔒';
    icon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showUpgradeModal(label);
    });
    icon.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showUpgradeModal(label);
      }
    });
    btn.appendChild(icon);
  }

  function addProBadge(targetEl, badgeText, modalLabel) {
    if (!targetEl || !targetEl.parentNode) return;
    var existing = targetEl.parentNode.querySelector(
      ':scope > .pmg-pro-badge[data-label="' + badgeText + '"]'
    );
    if (existing) return;
    var badge = document.createElement('span');
    badge.className = 'pmg-pro-badge';
    badge.setAttribute('data-label', badgeText);
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.textContent = badgeText;
    badge.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showUpgradeModal(modalLabel || badgeText);
    });
    badge.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showUpgradeModal(modalLabel || badgeText);
      }
    });
    targetEl.parentNode.insertBefore(badge, targetEl.nextSibling);
  }

  /* FEATURES 1–3: lock icons next to existing buttons */
  function decorateGatedButtons() {
    [
      ['runBtn',             'Run With AI'],
      ['image-generate-btn', 'Image Generation'],
      ['upload-analyze-btn', 'File And Image Analysis']
    ].forEach(function (p) {
      var btn = document.getElementById(p[0]);
      if (btn) addLockIcon(btn, p[1]);
    });
  }

  /* FEATURE 4: Cloud Prompt Vault — new ☁ Cloud Sync button in History head */
  function addCloudSyncButton() {
    var actions = document.querySelector('.panel-head-actions');
    if (!actions) return;
    if (actions.querySelector('#pmg-cloud-sync-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-cloud-sync-btn';
    btn.className = 'btn btn-secondary';
    btn.title = 'Sync Your Prompt Vault Across Devices';
    btn.innerHTML = '<span aria-hidden="true">☁</span> Cloud Sync';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (pmgIsPro()) {
        var prev = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span aria-hidden="true">☁</span> Syncing…';
        setTimeout(function () {
          btn.disabled = false;
          btn.innerHTML = prev;
        }, 1500);
      } else {
        showUpgradeModal('Cloud Prompt Vault');
      }
    });
    addLockIcon(btn, 'Cloud Prompt Vault');
    actions.insertBefore(btn, actions.firstChild);
  }

  /* FEATURE 5: Money Mode — keep working for free, add PRO badge */
  function gateMoneyMode() {
    var checkbox = document.getElementById('moneyMode');
    if (!checkbox) return;
    var row = checkbox.closest('.toggle-row');
    if (!row) return;
    var strong = row.querySelector('strong');
    if (!strong) return;
    addProBadge(strong, 'PRO', 'Money Mode Pro Workflows');
  }

  /* FEATURE 6: Brand Voice Profiles — new row in Power Ups (Advanced Options) */
  function addBrandVoiceButton() {
    var advBody = document.querySelector('.advanced-options-body');
    if (!advBody) return;
    if (advBody.querySelector('#pmg-brand-voice-btn')) return;

    var wrap = document.createElement('div');
    wrap.className = 'pmg-brand-voice-row pmg-pro-feature';

    var title = document.createElement('strong');
    title.textContent = 'Brand Voice Profiles';
    wrap.appendChild(title);
    addProBadge(title, 'PRO', 'Brand Voice Profiles');

    var desc = document.createElement('span');
    desc.textContent = 'Save Your Brand Voice Once And Apply It To Every Prompt Automatically.';
    wrap.appendChild(desc);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-brand-voice-btn';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Configure Brand Voice';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (pmgIsPro()) {
        showProUnlockedToast();
      } else {
        showUpgradeModal('Brand Voice Profiles');
      }
    });
    wrap.appendChild(btn);

    advBody.appendChild(wrap);
  }

  /* FEATURE 7: Bulk Export & Team Folders — new Team Export button */
  function addTeamExportButton() {
    var exportBtn = document.getElementById('export-everything');
    if (!exportBtn || !exportBtn.parentNode) return;
    if (document.getElementById('pmg-team-export-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-team-export-btn';
    btn.className = 'btn btn-secondary';
    btn.title = 'Export Bulk Prompts And Team Folders';
    btn.textContent = 'Team Export';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (pmgIsPro()) {
        showProUnlockedToast();
      } else {
        showUpgradeModal('Bulk Export And Team Folders');
      }
    });
    addLockIcon(btn, 'Bulk Export And Team Folders');
    exportBtn.parentNode.insertBefore(btn, exportBtn.nextSibling);
  }

  /* =================================================================
   * INIT
   * ================================================================= */
  function applyAll() {
    decorateGatedButtons();
    refreshDailyHints();
    gateMoneyMode();
    addCloudSyncButton();
    addTeamExportButton();
    addBrandVoiceButton();
  }

  function init() {
    injectStyles();
    if (pmgIsPro()) document.body.classList.add('pmg-is-pro');
    applyAll();
    /* Late-mount catch: a few delayed re-runs instead of a
       MutationObserver. Cheap, idempotent, and cannot create a
       feedback loop with other scripts that are also mutating
       the DOM during page warm-up. */
    [400, 1200, 3000, 6000].forEach(function (ms) {
      setTimeout(applyAll, ms);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
