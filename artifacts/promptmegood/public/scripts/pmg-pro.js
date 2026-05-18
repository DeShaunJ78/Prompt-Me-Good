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

  /* Defense-in-depth escape hatch: append `?nopmgpro` (or set
     `localStorage.pmg_disable = '1'`) to instantly disable this entire
     module without touching code. */
  try {
    if (
      /[?&]nopmgpro\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1'
    ) {
      window.pmgIsPro = function () { return false; };
      window.showUpgradeModal = function () {};
      window.pmgUnlockPro = function () {};
      window.pmgRevokePro = function () {};
      console.info('[pmg-pro] disabled via escape hatch');
      return;
    }
  } catch (_) {}

  /* Hard guard: any uncaught error in this module must NEVER break the
     rest of the page. Wrap the entire body in try/catch. */
  try {

  /* =================================================================
   * TASK 1 — Pro gate (single source of truth)
   * ================================================================= */
  var PRO_KEY = 'promptmegood:pro:v1';
  window.PMG_PRO_KEY = PRO_KEY;

  function pmgIsPro() {
    try { return localStorage.getItem(PRO_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function pmgUnlockPro(opts) {
    /* opts.silent === true skips the toast. Used by T42 (beta-mode
       auto-unlock) so the green pill at the bottom of the page does
       not pop on every reload — beta is already communicated by the
       persistent banner at the top of the page. The toast still fires
       on real user-initiated unlocks (Stripe webhook return, manual
       unlock buttons). */
    var silent = !!(opts && opts.silent);
    try {
      var wasAlreadyPro = localStorage.getItem(PRO_KEY) === 'true';
      localStorage.setItem(PRO_KEY, 'true');
      document.body.classList.add('pmg-is-pro');
      document.querySelectorAll('.pmg-pro-feature').forEach(function (el) {
        el.classList.remove('pmg-locked');
      });
      /* Suppress toast when silent OR when Pro state didn't actually
         change (avoids stacking on every periodic re-check). */
      if (!silent && !wasAlreadyPro) showProUnlockedToast();
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

  /* Task 100 — Tiered daily caps:
       - Founding / Pro  → higher fair-use caps (server-enforced via the
         /me/profile caps matrix — pmg-pro.js prefers those when present).
       - 7-day boosted trial for new visitors → { run:10, img:5, analyze:3 }.
       - Standard free   → { run:3,  img:1, analyze:1 }.
     Trial start is stamped on first encounter into localStorage and
     auto-expires after 7 days. The `DAILY_LIMITS` name is preserved
     for back-compat — it now resolves dynamically through a Proxy. */
  var FIRST_VISIT_KEY = 'promptmegood:firstVisit:v1';
  /* Read pricing/cap constants from the centralized PMG_PRICING config
     (loaded by /scripts/pmg-pricing-config.js BEFORE this script). The
     hardcoded literals are kept ONLY as a safety fallback if the config
     script failed to load, so existing call sites never NaN out. */
  var __PMG_CFG = (typeof window !== 'undefined' && window.PMG_PRICING) || {};
  var TRIAL_DAYS = (typeof __PMG_CFG.TRIAL_DAYS === 'number') ? __PMG_CFG.TRIAL_DAYS : 7;
  var TRIAL_DAILY_LIMITS = __PMG_CFG.TRIAL_DAILY_CAPS
    ? { run: __PMG_CFG.TRIAL_DAILY_CAPS.run, img: __PMG_CFG.TRIAL_DAILY_CAPS.img, analyze: __PMG_CFG.TRIAL_DAILY_CAPS.analyze }
    : { run: 10, img: 5, analyze: 3 };
  var FREE_DAILY_LIMITS = __PMG_CFG.FREE_DAILY_CAPS
    ? { run: __PMG_CFG.FREE_DAILY_CAPS.run, img: __PMG_CFG.FREE_DAILY_CAPS.img, analyze: __PMG_CFG.FREE_DAILY_CAPS.analyze }
    : { run: 3, img: 1, analyze: 1 };

  function pmgFirstVisitMs() {
    try {
      var v = localStorage.getItem(FIRST_VISIT_KEY);
      if (v) {
        var n = parseInt(v, 10);
        if (isFinite(n) && n > 0) return n;
      }
      var now = Date.now();
      localStorage.setItem(FIRST_VISIT_KEY, String(now));
      return now;
    } catch (e) { return Date.now(); }
  }
  /* Task #100 — Server-first trial source of truth.
     For signed-in users, pmg-ux.js publishes the authoritative trial
     state from /api/me/profile to window.__pmgServerProfile. We prefer
     that over the localStorage first-visit timestamp so the cap UI never
     desyncs from the server's enforcement. Anonymous visitors fall back
     to the localStorage signal so the trial banner still works pre-login. */
  function pmgServerTrialState() {
    try {
      var sp = window.__pmgServerProfile;
      if (!sp || !sp.trial) return null;
      return {
        active: !!sp.trial.active,
        daysLeft: typeof sp.trial.days_left === 'number' ? sp.trial.days_left : 0,
        plan: sp.plan || 'free',
        caps: sp.caps || null
      };
    } catch (_) { return null; }
  }
  function pmgInTrial() {
    var srv = pmgServerTrialState();
    if (srv) return srv.plan === 'free' && srv.active;
    try {
      var first = pmgFirstVisitMs();
      return (Date.now() - first) < (TRIAL_DAYS * 24 * 60 * 60 * 1000);
    } catch (e) { return false; }
  }
  function pmgTrialDaysLeft() {
    var srv = pmgServerTrialState();
    if (srv) return srv.plan === 'free' ? srv.daysLeft : 0;
    try {
      var first = pmgFirstVisitMs();
      var remainingMs = (TRIAL_DAYS * 24 * 60 * 60 * 1000) - (Date.now() - first);
      return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    } catch (e) { return 0; }
  }
  function getActiveDailyLimits() {
    /* Prefer server-published caps when available — they reflect the
       user's actual plan (founding/pro/free + trial state) authoritatively. */
    var srv = pmgServerTrialState();
    if (srv && srv.caps && typeof srv.caps.run === 'number') {
      return { run: srv.caps.run, img: srv.caps.img, analyze: srv.caps.analyze };
    }
    return pmgInTrial() ? TRIAL_DAILY_LIMITS : FREE_DAILY_LIMITS;
  }

  /* Proxy keeps the `DAILY_LIMITS[feature]` access pattern working
     everywhere it's already used, while transparently switching between
     trial and standard caps. Falls back to a plain object on engines
     without Proxy support (every modern browser has it). */
  var DAILY_LIMITS;
  try {
    DAILY_LIMITS = new Proxy({}, {
      get: function (_t, key) { return getActiveDailyLimits()[key]; }
    });
  } catch (e) {
    DAILY_LIMITS = FREE_DAILY_LIMITS;
  }

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
  window.pmgInTrial = pmgInTrial;
  window.pmgTrialDaysLeft = pmgTrialDaysLeft;

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
      /* audit-3 §6 (mobile): on short viewports (e.g. iPhone SE landscape,
         402×500 split-screen) icon + h3 + p + 3 CTAs can push the primary
         "Upgrade" button below the fold. Cap the modal at viewport height
         and let it scroll internally so the CTA is always reachable. */
      '  max-height: calc(100vh - 32px);',
      '  overflow-y: auto;',
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
      '.pmg-upgrade-cta-secondary {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  padding: 10px 18px; border-radius: var(--radius-md, 10px);',
      '  background: transparent; color: var(--color-primary);',
      '  border: 1px solid var(--color-primary);',
      '  font-weight: 700; font-size: var(--text-sm, 14px);',
      '  text-decoration: none; cursor: pointer;',
      '  transition: background 120ms ease;',
      '}',
      '.pmg-upgrade-cta-secondary:hover { background: color-mix(in srgb, var(--color-primary) 8%, transparent); text-decoration: none; }',
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
      '.pmg-brand-voice-row span { display: block; font-size: var(--text-xs, 12px); color: var(--color-text-muted); }',
      '.pmg-brand-voice-row.is-active { border-style: solid; background: color-mix(in srgb, var(--color-primary) 6%, transparent); }',
      '.pmg-brand-voice-row .pmg-bv-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--color-primary, #0f6e6a); margin-top: 2px; }',
      '.pmg-brand-voice-row .pmg-bv-dot { width: 8px; height: 8px; border-radius: 999px; background: #16a34a; box-shadow: 0 0 0 3px color-mix(in srgb, #16a34a 25%, transparent); }',

      /* Brand Voice configure modal — reuses upgrade-overlay pattern */
      '.pmg-bv-modal {',
      '  background: var(--color-surface);',
      '  border-radius: var(--radius-xl, 16px);',
      '  padding: var(--space-6, 24px);',
      '  max-width: 520px; width: 100%;',
      '  max-height: calc(100vh - 32px); overflow-y: auto;',
      '  box-shadow: var(--shadow-lg, 0 20px 50px rgba(0,0,0,0.3));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));',
      '  animation: pmgProSlideUp 250ms ease; box-sizing: border-box;',
      '}',
      '.pmg-bv-modal h3 { font-size: var(--text-lg, 18px); font-weight: 800; margin: 0 0 var(--space-2, 8px); color: var(--color-text); display: flex; align-items: center; gap: 8px; }',
      '.pmg-bv-modal .pmg-bv-sub { font-size: var(--text-sm, 14px); color: var(--color-text-muted); margin: 0 0 var(--space-4, 16px); line-height: 1.5; }',
      '.pmg-bv-field { display: block; margin-bottom: var(--space-3, 12px); }',
      '.pmg-bv-field label { display: block; font-size: 12px; font-weight: 700; color: var(--color-text); margin-bottom: 4px; letter-spacing: 0.02em; text-transform: uppercase; }',
      '.pmg-bv-field .pmg-bv-hint { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 4px; line-height: 1.4; }',
      '.pmg-bv-field input, .pmg-bv-field textarea {',
      '  width: 100%; box-sizing: border-box;',
      '  padding: 10px 12px; font-size: 14px;',
      '  font-family: inherit; color: var(--color-text);',
      '  background: var(--color-bg, #fff);',
      '  border: 1px solid var(--color-border);',
      '  border-radius: var(--radius-md, 8px);',
      '  transition: border-color 150ms ease, box-shadow 150ms ease;',
      '}',
      '.pmg-bv-field input:focus, .pmg-bv-field textarea:focus {',
      '  outline: none; border-color: var(--color-primary);',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);',
      '}',
      '.pmg-bv-field textarea { resize: vertical; min-height: 70px; line-height: 1.45; }',
      '.pmg-bv-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: var(--space-4, 16px); align-items: center; }',
      '.pmg-bv-save { flex: 1 1 160px; padding: 12px 18px; background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-full, 999px); font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity 150ms ease; }',
      '.pmg-bv-save:hover { opacity: 0.92; }',
      '.pmg-bv-save:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.pmg-bv-cancel { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 10px 16px; border-radius: var(--radius-full, 999px); font-size: 13px; font-weight: 600; cursor: pointer; }',
      '.pmg-bv-clear { background: none; border: none; color: #c0392b; padding: 10px 12px; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: auto; }',
      '.pmg-bv-clear:hover { text-decoration: underline; }',
      '.pmg-bv-error { color: #c0392b; font-size: 12px; margin-top: 6px; min-height: 16px; }',
      '[data-theme="dark"] .pmg-bv-clear { color: var(--color-danger-strong); }',
      '[data-theme="dark"] .pmg-bv-error { color: var(--color-danger); }',
      '@media (max-width: 520px) {',
      '  .pmg-bv-actions { flex-direction: column; align-items: stretch; }',
      '  .pmg-bv-clear { margin-left: 0; text-align: left; }',
      '}'
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
    /* Two-CTA upgrade modal:
         Primary  → Founding Member ($79 lifetime, price locked) — uses existing
                    [data-pmg-upgrade][data-pmg-tier="founding"] hook in
                    pmg-ux.js, which calls POST /api/create-checkout-session
                    with { tier: 'founding' } and redirects to Stripe.
         Secondary → Email capture for Pro Monthly launch notifications. */
    /* Modal copy is templated exclusively from window.PMG_PRICING so the
       canonical config is the single source of truth. If the config
       script failed to load we render a non-priced generic message
       rather than duplicating business constants in this file. */
    var __cfg2     = (typeof window !== 'undefined' && window.PMG_PRICING) || {};
    var __hasFull  = typeof __cfg2.FOUNDING_PRICE_USD === 'number'
                    && typeof __cfg2.PRO_MONTHLY_USD === 'number'
                    && typeof __cfg2.PRO_YEARLY_USD === 'number'
                    && typeof __cfg2.FOUNDING_LIMIT === 'number';
    var __lock     = __cfg2.PRICE_LOCK_TAGLINE || 'price locked for life';
    var __deadline = __cfg2.FOUNDING_DEADLINE_COPY || '';
    /* H-1 fix (audit-2): no fallbacks. If config is missing the daily
       caps shape, abort this CTA entirely rather than render with stale
       numbers (the prior fallback was pre-Pro-Studio and misleading). */
    var __fcaps2   = __cfg2.FOUNDING_DAILY_CAPS;
    if (!__fcaps2 || typeof __fcaps2.run !== 'number'
                  || typeof __fcaps2.img !== 'number'
                  || typeof __fcaps2.analyze !== 'number') {
      if (typeof console !== 'undefined') console.warn('PMG_PRICING.FOUNDING_DAILY_CAPS missing — pmg-pro CTA aborted');
      return;
    }
    var __capStr2  = __fcaps2.run + ' Run With AI, ' + __fcaps2.img +
                     ' image generations, ' + __fcaps2.analyze + ' file analyses per day';
    var __pCopy;
    if (__hasFull) {
      __pCopy =
        'Unlock higher daily caps on this feature (' + __capStr2 + '). Founding Member is a one-time $' +
        __cfg2.FOUNDING_PRICE_USD + ' payment for lifetime access to core features — limited to the first ' +
        __cfg2.FOUNDING_LIMIT + ' buyers, ' + __lock + '.' +
        (__deadline ? ' ' + __deadline : '') +
        ' Pro Monthly ($' + __cfg2.PRO_MONTHLY_USD + '/month) and Pro Yearly ($' +
        __cfg2.PRO_YEARLY_USD + '/year) launch July 1, 2026. Fair use limits apply.';
    } else {
      __pCopy =
        'Unlock higher daily caps on this feature. Founding Member is a one-time payment for lifetime access to core features — see pricing for current details. Fair use limits apply.';
    }
    overlay.innerHTML =
      '<div class="pmg-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="pmg-upgrade-title">' +
        '<span class="pmg-upgrade-modal-icon" aria-hidden="true">🔒</span>' +
        '<h3 id="pmg-upgrade-title">' + safe + ' Is A Pro Feature</h3>' +
        '<p>' + __pCopy + '</p>' +
        '<div class="pmg-upgrade-modal-actions">' +
          '<a class="pmg-upgrade-cta pmg-upgrade-btn" href="./pricing.html#early-access">Join Founding Member Waitlist</a>' +
          '<span class="pmg-upgrade-cta-helper" style="display:block;margin-top:6px;font-size:0.875em;color:var(--color-text-muted);">Checkout Opens Soon. Join The Waitlist To Be Notified.</span>' +
          '<a class="pmg-upgrade-cta-secondary" href="./pricing.html#early-access">Notify Me When Pro Launches</a>' +
          '<button type="button" class="pmg-upgrade-dismiss" id="pmg-upgrade-dismiss-btn">Maybe Later</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    /* T41 in pmg-ux.js attaches the Stripe-checkout listener on a delegated
       basis to any [data-pmg-upgrade] element. If that delegated listener
       is not present (e.g. pmg-ux.js failed to load), fall back to sending
       the user to the pricing page so the CTA never becomes a dead button. */
    var primaryBtn = overlay.querySelector('.pmg-upgrade-btn[data-pmg-tier="founding"]');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', function () {
        /* If pmg-ux.js T41 has wired Stripe checkout, it will preventDefault
           via its own delegated listener. If not, redirect to pricing as
           a graceful fallback after a short tick. */
        setTimeout(function () {
          if (!primaryBtn.__pmgStripeWired) {
            /* H2 (audit-2 deeper): deep-link to the relevant tier card
               instead of dumping the user at the top of /pricing.html.
               During beta → Founding checkout card. After beta flips →
               Pro Monthly card. Detect via window.PMG_PRICING.BETA_END. */
            var deepHash = '#founding-checkout-card';
            try {
              var beCfg = (window.PMG_PRICING && window.PMG_PRICING.BETA_END) || '';
              if (beCfg && Date.now() >= Date.parse(beCfg)) {
                deepHash = '#tier-pro-name';
              }
            } catch (_) {}
            try { window.location.href = '/pricing.html' + deepHash; } catch (_) {}
          }
        }, 250);
      });
    }

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
    'imageBtn':            { feature: 'img',     label: 'Image Generation' },
    'upload-analyze-btn':  { feature: 'analyze', label: 'File And Image Analysis' }
  };

  /* Per-button capture-phase intercept: attached ONLY to the specific
     gated buttons. Runs before inline onclick handlers. We attach
     idempotently in applyAll() so late-mounted buttons get covered too.
     Using per-button listeners (not a global document listener) means a
     bug here can NEVER block clicks on any other element on the page. */
  function gatedClickHandler(cfg) {
    return function (e) {
      try {
        if (pmgIsPro()) return;
        if (pmgLimitReached(cfg.feature)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showUpgradeModal(cfg.label);
          return;
        }
        pmgIncrementDailyCount(cfg.feature);
        setTimeout(refreshDailyHints, 0);
      } catch (_) { /* never break the underlying button */ }
    };
  }
  function attachGatedListeners() {
    Object.keys(GATED).forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || btn.__pmgGated) return;
      btn.__pmgGated = true;
      btn.addEventListener('click', gatedClickHandler(GATED[id]), true);
    });
  }

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
    var tierWord = pmgInTrial() ? 'Trial' : 'Free';
    var nextText = rem > 0
      ? '(' + rem + ' Of ' + lim + ' ' + tierWord + ' Today)'
      : '(Daily Limit Reached — Upgrade For Higher Daily Caps. Fair Use Limits Apply.)';
    /* Idempotent: only touch DOM when text actually changes. Avoids
       infinite MutationObserver feedback loops. */
    if (hint.textContent !== nextText) hint.textContent = nextText;
  }
  function refreshDailyHints() {
    if (pmgIsPro()) return;
    [
      ['runBtn',             'run'],
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

  /* FEATURE 5: Money Mode (renamed Growth Mode) — badge removed (pro-pill-fit-1).
     The toggle itself is FREE (it's just a per-prompt directive). The real
     paid Growth Mode workflows live in the 💼 drawer in the topbar (see
     pmg-business-mode.js), so the inline "Money Mode Pro" badge here was
     misleading. Function kept as a no-op for callsite stability. To restore:
     uncomment the body. */
  function gateMoneyMode() {
    return;
    // var checkbox = document.getElementById('moneyMode');
    // if (!checkbox) return;
    // var row = checkbox.closest('.toggle-row');
    // if (!row) return;
    // var strong = row.querySelector('strong');
    // if (!strong) return;
    // addProBadge(strong, 'PRO', 'Money Mode Pro Workflows');
  }

  /* =================================================================
   * FEATURE 6: Brand Voice Profiles
   * =================================================================
   * User flow:
   *   1. "Configure Brand Voice" button in Power Ups (Advanced Options).
   *   2. Click -> opens modal with form (name, voice, audience, words to
   *      use, words to avoid). Pro-gated: non-Pro sees upgrade modal.
   *   3. Save -> persists profile to localStorage, closes modal,
   *      switches the row to active state, updates button label.
   *   4. Clear -> wipes profile, returns row to default state.
   *   5. On every #prompt-form submit, a capture-phase listener
   *      temporarily appends the brand voice block to #details so the
   *      existing builder + AI flow picks it up automatically. The
   *      textarea value is restored in a microtask so the user never
   *      sees their details field mutated.
   *
   * Bug fix history: prior to this revision the click handler only
   * showed a "Pro Unlocked!" toast and did nothing else, so users
   * reported "Configure brand voice isn't working." This rewrite gives
   * the button real behavior.
   * ================================================================= */

  var BV_STORAGE_KEY = 'pmg-brand-voice-v1';
  var BV_MAX_FIELD_LEN = 200;
  var BV_INJECTION_MAX_LEN = 600;

  function bvEsc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function bvLoad() {
    try {
      var raw = localStorage.getItem(BV_STORAGE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      return {
        name: String(p.name || '').slice(0, BV_MAX_FIELD_LEN),
        voice: String(p.voice || '').slice(0, BV_MAX_FIELD_LEN),
        audience: String(p.audience || '').slice(0, BV_MAX_FIELD_LEN),
        useWords: String(p.useWords || '').slice(0, BV_MAX_FIELD_LEN),
        avoidWords: String(p.avoidWords || '').slice(0, BV_MAX_FIELD_LEN)
      };
    } catch (_) { return null; }
  }

  function bvSave(profile) {
    try {
      localStorage.setItem(BV_STORAGE_KEY, JSON.stringify(profile));
      return true;
    } catch (_) { return false; }
  }

  function bvClear() {
    try { localStorage.removeItem(BV_STORAGE_KEY); } catch (_) {}
  }

  function bvIsActive(p) {
    if (!p) return false;
    return !!(p.voice || p.audience || p.useWords || p.avoidWords || p.name);
  }

  /* Build the short text block injected into #details before submit. */
  function bvBuildInjection(p) {
    if (!bvIsActive(p)) return '';
    var parts = [];
    if (p.name) parts.push('Brand: ' + p.name);
    if (p.voice) parts.push('Voice/Tone: ' + p.voice);
    if (p.audience) parts.push('Audience: ' + p.audience);
    if (p.useWords) parts.push('Prefer These Words/Phrases: ' + p.useWords);
    if (p.avoidWords) parts.push('Avoid These Words/Phrases: ' + p.avoidWords);
    var block = '[Brand Voice Profile] ' + parts.join(' | ');
    if (block.length > BV_INJECTION_MAX_LEN) {
      block = block.slice(0, BV_INJECTION_MAX_LEN - 1) + '…';
    }
    return block;
  }

  /* Refresh the button + row to reflect current profile state. */
  function bvRefreshButton() {
    var btn = document.getElementById('pmg-brand-voice-btn');
    var row = document.querySelector('.pmg-brand-voice-row');
    if (!btn || !row) return;
    var p = bvLoad();
    var statusEl = row.querySelector('.pmg-bv-status');
    if (bvIsActive(p)) {
      btn.textContent = 'Edit Brand Voice';
      row.classList.add('is-active');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'pmg-bv-status';
        statusEl.innerHTML = '<span class="pmg-bv-dot" aria-hidden="true"></span><span class="pmg-bv-status-label"></span>';
        var firstBtn = row.querySelector('button');
        if (firstBtn) row.insertBefore(statusEl, firstBtn);
        else row.appendChild(statusEl);
      }
      var label = statusEl.querySelector('.pmg-bv-status-label');
      var who = p.name ? ('"' + p.name + '" ') : '';
      if (label) label.textContent = 'Active — ' + who + 'will be applied to every prompt.';
    } else {
      btn.textContent = 'Configure Brand Voice';
      row.classList.remove('is-active');
      if (statusEl) statusEl.remove();
    }
  }

  function bvShowToast(msg) {
    if (typeof showProUnlockedToast === 'function') {
      /* Reuse the existing toast styling */
      var t = document.createElement('div');
      t.className = 'pmg-pro-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { try { t.remove(); } catch (_) {} }, 2400);
    }
  }

  function openBrandVoiceModal() {
    var existing = document.getElementById('pmg-bv-overlay');
    if (existing) existing.remove();

    var p = bvLoad() || { name: '', voice: '', audience: '', useWords: '', avoidWords: '' };

    var overlay = document.createElement('div');
    overlay.className = 'pmg-upgrade-overlay';
    overlay.id = 'pmg-bv-overlay';
    overlay.innerHTML =
      '<div class="pmg-bv-modal" role="dialog" aria-modal="true" aria-labelledby="pmg-bv-title">' +
        '<h3 id="pmg-bv-title"><span aria-hidden="true">🎨</span> Configure Brand Voice</h3>' +
        '<p class="pmg-bv-sub">Save your brand voice once. We\'ll automatically apply it to every prompt you build, so the output sounds like <em>you</em>.</p>' +
        '<form id="pmg-bv-form" novalidate>' +
          '<div class="pmg-bv-field">' +
            '<label for="pmg-bv-name">Brand Or Persona Name <span style="font-weight:400;color:var(--color-text-muted);text-transform:none;">(Optional)</span></label>' +
            '<input id="pmg-bv-name" name="name" type="text" maxlength="' + BV_MAX_FIELD_LEN + '" placeholder="e.g. Acme Studios" value="' + bvEsc(p.name) + '">' +
          '</div>' +
          '<div class="pmg-bv-field">' +
            '<label for="pmg-bv-voice">Voice And Tone</label>' +
            '<textarea id="pmg-bv-voice" name="voice" maxlength="' + BV_MAX_FIELD_LEN + '" placeholder="e.g. Warm, witty, confident. Plain English, no jargon. Short sentences.">' + bvEsc(p.voice) + '</textarea>' +
            '<span class="pmg-bv-hint">How should the writing sound? Personality, formality, sentence rhythm.</span>' +
          '</div>' +
          '<div class="pmg-bv-field">' +
            '<label for="pmg-bv-audience">Audience</label>' +
            '<input id="pmg-bv-audience" name="audience" type="text" maxlength="' + BV_MAX_FIELD_LEN + '" placeholder="e.g. Small business owners, 30–55" value="' + bvEsc(p.audience) + '">' +
          '</div>' +
          '<div class="pmg-bv-field">' +
            '<label for="pmg-bv-use">Signature Words / Phrases <span style="font-weight:400;color:var(--color-text-muted);text-transform:none;">(Optional)</span></label>' +
            '<input id="pmg-bv-use" name="useWords" type="text" maxlength="' + BV_MAX_FIELD_LEN + '" placeholder="e.g. craft, ship, real talk" value="' + bvEsc(p.useWords) + '">' +
          '</div>' +
          '<div class="pmg-bv-field">' +
            '<label for="pmg-bv-avoid">Words / Phrases To Avoid <span style="font-weight:400;color:var(--color-text-muted);text-transform:none;">(Optional)</span></label>' +
            '<input id="pmg-bv-avoid" name="avoidWords" type="text" maxlength="' + BV_MAX_FIELD_LEN + '" placeholder="e.g. synergy, leverage, utilize" value="' + bvEsc(p.avoidWords) + '">' +
          '</div>' +
          '<div class="pmg-bv-error" id="pmg-bv-error" role="alert" aria-live="polite"></div>' +
          '<div class="pmg-bv-actions">' +
            '<button type="submit" class="pmg-bv-save" id="pmg-bv-save-btn">Save Brand Voice</button>' +
            '<button type="button" class="pmg-bv-cancel" id="pmg-bv-cancel-btn">Cancel</button>' +
            (bvIsActive(p) ? '<button type="button" class="pmg-bv-clear" id="pmg-bv-clear-btn">Clear Profile</button>' : '') +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() {
      try { overlay.remove(); } catch (_) {}
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onEsc);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var form = document.getElementById('pmg-bv-form');
    var errEl = document.getElementById('pmg-bv-error');
    var cancelBtn = document.getElementById('pmg-bv-cancel-btn');
    var clearBtn = document.getElementById('pmg-bv-clear-btn');

    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (clearBtn) clearBtn.addEventListener('click', function () {
      bvClear();
      bvRefreshButton();
      bvShowToast('Brand voice cleared.');
      close();
    });

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var newProfile = {
        name:       (document.getElementById('pmg-bv-name')     || {}).value || '',
        voice:      (document.getElementById('pmg-bv-voice')    || {}).value || '',
        audience:   (document.getElementById('pmg-bv-audience') || {}).value || '',
        useWords:   (document.getElementById('pmg-bv-use')      || {}).value || '',
        avoidWords: (document.getElementById('pmg-bv-avoid')    || {}).value || ''
      };
      Object.keys(newProfile).forEach(function (k) {
        newProfile[k] = String(newProfile[k]).trim().slice(0, BV_MAX_FIELD_LEN);
      });
      if (!bvIsActive(newProfile)) {
        if (errEl) errEl.textContent = 'Please fill in at least one field (Voice And Tone is the most useful).';
        return;
      }
      var ok = bvSave(newProfile);
      if (!ok) {
        if (errEl) errEl.textContent = 'Could not save — your browser storage may be full.';
        return;
      }
      bvRefreshButton();
      bvShowToast(newProfile.name
        ? 'Brand voice saved — "' + newProfile.name + '" will be applied to every prompt.'
        : 'Brand voice saved — will be applied to every prompt.');
      close();
    });

    /* Focus first field for keyboard users. */
    setTimeout(function () {
      var first = document.getElementById('pmg-bv-name');
      if (first && typeof first.focus === 'function') first.focus();
    }, 30);
  }
  window.openBrandVoiceModal = openBrandVoiceModal;

  /* Capture-phase submit listener: temporarily appends brand voice
     summary into #details so the existing local builder + AI payload
     picks it up unchanged. We restore the textarea value in a microtask
     so the user's saved details aren't visibly mutated.
     ---------------------------------------------------------------
     IMPORTANT contract with index.html:
     The bubble-phase submit handler in index.html (~line 7043) reads
     getFormData() **synchronously** before any await. That synchronous
     read is what makes this technique safe — by the time the microtask
     fires to restore the field, getFormData has already captured the
     injected value into its own `data` object. If that submit handler
     ever becomes async-before-getFormData, this injection will leak the
     mutated value into the visible DOM. A belt-and-suspenders setTimeout
     restore below covers cases where the microtask is skipped.
     --------------------------------------------------------------- */
  function attachBrandVoiceSubmitInjector() {
    var form = document.getElementById('prompt-form');
    if (!form || form.__pmgBvInjected) return;
    form.__pmgBvInjected = true;
    form.addEventListener('submit', function () {
      try {
        var profile = bvLoad();
        var inject = bvBuildInjection(profile);
        if (!inject) return;
        var detailsEl = document.getElementById('details');
        if (!detailsEl) return;
        var orig = detailsEl.value || '';
        /* Skip only if a previous injection block is already at the END
           of the field — i.e. trailing exactly `inject` (with optional
           leading "\n\n"). This narrower check avoids false-skipping
           when the user's own text merely happens to contain the phrase
           "[Brand Voice Profile]" somewhere. */
        var injectedSuffix = orig ? ('\n\n' + inject) : inject;
        if (orig === inject || (orig.length > injectedSuffix.length &&
            orig.slice(orig.length - injectedSuffix.length) === injectedSuffix)) {
          return;
        }
        var combined = orig ? (orig + '\n\n' + inject) : inject;
        detailsEl.value = combined;
        var restore = function () {
          if (detailsEl.value === combined) detailsEl.value = orig;
        };
        /* Restore in a microtask AFTER the original synchronous
           getFormData() read in the bubble-phase submit handler. */
        try { Promise.resolve().then(restore); } catch (_) {}
        /* Belt-and-suspenders: also schedule a macrotask restore in
           case Promise/microtask path is interfered with by another
           script. Cheap and idempotent (restore is a no-op if value
           was already restored). */
        setTimeout(restore, 0);
      } catch (_) { /* never break submit */ }
    }, true);
  }

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
        openBrandVoiceModal();
      } else {
        showUpgradeModal('Brand Voice Profiles');
      }
    });
    wrap.appendChild(btn);

    advBody.appendChild(wrap);

    /* Reflect any previously saved profile + wire the submit injector. */
    bvRefreshButton();
    attachBrandVoiceSubmitInjector();
  }

  /* Public surface for testing / debugging. */
  window.__pmgBrandVoice = {
    load: bvLoad,
    save: bvSave,
    clear: bvClear,
    isActive: bvIsActive,
    buildInjection: bvBuildInjection,
    open: openBrandVoiceModal,
    refresh: bvRefreshButton
  };

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
    try { attachGatedListeners(); } catch (_) {}
    try { decorateGatedButtons(); } catch (_) {}
    try { refreshDailyHints(); } catch (_) {}
    try { gateMoneyMode(); } catch (_) {}
    /* Audit fix: Cloud Sync, Team Export, and Brand Voice Profiles
       are not yet shipped to a publicly demonstrable state. Their
       button injection is disabled so we do not advertise unshipped
       features in the UI. Re-enable when the backing functionality
       is real and verified. */
    /* try { addCloudSyncButton(); } catch (_) {} */
    /* try { addTeamExportButton(); } catch (_) {} */
    /* try { addBrandVoiceButton(); } catch (_) {} */
  }

  function init() {
    try { injectStyles(); } catch (_) {}
    try { if (pmgIsPro()) document.body.classList.add('pmg-is-pro'); } catch (_) {}
    applyAll();
    /* Late-mount catch: a few delayed re-runs instead of a
       MutationObserver. Cheap, idempotent, and cannot create a
       feedback loop with other scripts that are also mutating
       the DOM during page warm-up. */
    [400, 1200, 3000, 6000].forEach(function (ms) {
      setTimeout(applyAll, ms);
    });
  }

  /* Defer init until window load + 200ms so we never compete with
     other scripts during first paint. Falls back to immediate init
     if window has already loaded. */
  function scheduleInit() { setTimeout(init, 200); }
  if (document.readyState === 'complete') {
    scheduleInit();
  } else {
    window.addEventListener('load', scheduleInit, { once: true });
  }

  } catch (err) {
    /* Hard fail-safe: if anything in this module throws synchronously,
       log it and disable Pro UI rather than break the page. */
    try { console.warn('[pmg-pro] disabled due to error:', err); } catch (_) {}
  }
})();
