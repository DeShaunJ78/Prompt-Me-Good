/* =====================================================================
 * PromptMeGood — MONEY MODE PRO
 *
 * What this is:
 *   An enhancement layer on top of the existing free "Money Mode" toggle.
 *   The free toggle stays exactly as it was — this script adds a paid
 *   "Money Mode Pro" panel BELOW it, inside the same Power Ups section.
 *
 * Tier model:
 *   - Money Mode (Free) -> the existing #moneyMode checkbox. Untouched.
 *   - Money Mode Pro    -> all controls in this file. Locked unless the
 *                          user is on the Pro plan (window.pmgIsPro()).
 *                          Beta mode (T42) flips pmgIsPro to true for
 *                          everyone until the paywall activates, so the
 *                          panel is fully usable during the beta window.
 *
 * Layout rule:
 *   Strict linear top-to-bottom flow. Every control gets its own row.
 *   No side-by-side fields. The user explicitly asked for this.
 *
 * Tone of labels:
 *   Middle-ground neutral with a touch of personality. Avoid heavy
 *   marketing jargon ("conversion funnel", "monetization angle") and
 *   avoid hype-bro slang ("CRUSH IT", "10X your reach"). Plain English,
 *   light flair.
 *
 * What gets sent to the AI when Pro is active:
 *   We monkey-patch window.__pmgAI's three generate methods so that
 *   when a Pro user with options selected hits Fix My Prompt, the
 *   payload's `extraDetails` field is suffixed with a structured
 *   "[Money Mode Pro instructions]" block. The user's textarea is
 *   never modified. If the user is not Pro, or hasn't picked any Pro
 *   options, the payload passes through unchanged.
 *
 * Hard rules followed:
 *   - No edits to existing IDs or classes
 *   - No backend / API / Stripe / DB changes
 *   - All colors via CSS variables (light + dark mode safe)
 *   - Hide / lock over delete (free Money Mode toggle is untouched)
 *   - Try/catch fence so a failure here NEVER breaks the rest of the page
 * ===================================================================== */
(function pmgMoneyModeProInit() {
  'use strict';
  if (window.__pmgMMProInit) return;
  window.__pmgMMProInit = true;

  /* Defense: same escape hatches as pmg-pro.js. */
  try {
    if (
      /[?&]nopmgpro\b/.test(location.search) ||
      /[?&]nommpro\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1' ||
      localStorage.getItem('pmg_mmpro_disable') === '1'
    ) {
      try { console.info('[pmg-mm-pro] disabled via escape hatch'); } catch (_) {}
      return;
    }
  } catch (_) {}

  try {

  /* ------------------------------------------------------------------
   * State — persisted in localStorage so selections survive reloads.
   * ------------------------------------------------------------------ */
  var STATE_KEY = 'promptmegood:money_mode_pro:v1';
  var DEFAULT_STATE = {
    intent: '',
    platform: '',
    style: '',
    boosts: {
      hook: false,
      money: false,
      cta: false,
      persuasion: false,
      shareable: false,
      simplify: false
    }
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return clone(DEFAULT_STATE);
      var parsed = JSON.parse(raw);
      var merged = clone(DEFAULT_STATE);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.intent === 'string') merged.intent = parsed.intent;
        if (typeof parsed.platform === 'string') merged.platform = parsed.platform;
        if (typeof parsed.style === 'string') merged.style = parsed.style;
        if (parsed.boosts && typeof parsed.boosts === 'object') {
          Object.keys(merged.boosts).forEach(function (k) {
            merged.boosts[k] = !!parsed.boosts[k];
          });
        }
      }
      return merged;
    } catch (_) {
      return clone(DEFAULT_STATE);
    }
  }
  function saveState(s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = loadState();

  /* ------------------------------------------------------------------
   * Option lists — single source of truth used by the UI and the
   * payload-augmentation logic.
   * ------------------------------------------------------------------ */
  var INTENTS = [
    { value: '',                 label: 'Pick a goal' },
    { value: 'get_views',        label: 'Get Views' },
    { value: 'grow_audience',    label: 'Grow An Audience' },
    { value: 'sell_product',     label: 'Sell A Product' },
    { value: 'promote_service',  label: 'Promote A Service' },
    { value: 'boost_engagement', label: 'Boost Engagement' },
    { value: 'educate',          label: 'Educate' },
    { value: 'entertain',        label: 'Entertain' }
  ];

  var PLATFORMS = [
    { value: '',          label: 'Pick a platform' },
    { value: 'tiktok',    label: 'TikTok' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube',   label: 'YouTube' },
    { value: 'x',         label: 'X (Twitter)' },
    { value: 'email',     label: 'Email' },
    { value: 'sales',     label: 'Sales Page' }
  ];

  var STYLES = [
    { value: '',              label: 'Pick a style' },
    { value: 'short_punchy',  label: 'Short & Punchy' },
    { value: 'story',         label: 'Story-Driven' },
    { value: 'high_energy',   label: 'High Energy' },
    { value: 'professional',  label: 'Professional' },
    { value: 'conversational',label: 'Conversational' },
    { value: 'direct_sales',  label: 'Direct Sales' },
    { value: 'educational',   label: 'Educational' }
  ];

  /* Each boost: id (state key), label, sub-copy, instruction the AI
     receives when active. Instructions stay plain so the model can
     act on them. */
  var BOOSTS = [
    {
      id: 'hook',
      label: 'Stronger Opening Hook',
      sub: 'Open with something that earns the next line.',
      instruction: 'Open with a specific, attention-grabbing hook in the first sentence so the reader is pulled in immediately.'
    },
    {
      id: 'money',
      label: 'Sharper Money Angle',
      sub: 'Lean into value, offers, and outcomes.',
      instruction: 'Frame the response around concrete value, offers, and real outcomes for the reader.'
    },
    {
      id: 'cta',
      label: 'Clear Next Step',
      sub: 'End with a clean ask so people know what to do.',
      instruction: 'Finish with a single, clear call-to-action that tells the reader exactly what to do next.'
    },
    {
      id: 'persuasion',
      label: 'More Persuasive',
      sub: 'Lead with benefits and proof.',
      instruction: 'Lead with benefits to the reader, back claims with proof, and use confident, benefit-driven language throughout.'
    },
    {
      id: 'shareable',
      label: 'More Shareable',
      sub: 'Built to get passed around.',
      instruction: 'Make the response shareable: punchy phrasing, an emotional or surprising angle, and one quotable line worth screenshotting.'
    },
    {
      id: 'simplify',
      label: 'Cleaner & Simpler',
      sub: 'Trim the fluff. Make every line earn its place.',
      instruction: 'Cut filler. Use plain language. Every sentence must earn its place — no hedging, no throat-clearing.'
    }
  ];

  /* Quick-start presets. Apply a fixed combination of boosts, intent,
     platform, and style. */
  var PRESETS = [
    {
      id: 'viral',
      label: 'Go Viral',
      icon: '🎯',
      hint: 'Hook + shareable + TikTok + high energy.',
      apply: {
        boosts: { hook: true, shareable: true },
        intent: 'get_views',
        platform: 'tiktok',
        style: 'high_energy'
      }
    },
    {
      id: 'sell',
      label: 'Sell Something',
      icon: '💸',
      hint: 'Money + CTA + persuasion + direct sales.',
      apply: {
        boosts: { money: true, cta: true, persuasion: true },
        intent: 'sell_product',
        platform: '',
        style: 'direct_sales'
      }
    },
    {
      id: 'grow',
      label: 'Grow Audience',
      icon: '📈',
      hint: 'Hook + simplify + CTA + conversational.',
      apply: {
        boosts: { hook: true, simplify: true, cta: true },
        intent: 'grow_audience',
        platform: '',
        style: 'conversational'
      }
    }
  ];

  /* ------------------------------------------------------------------
   * Pro check — defers to window.pmgIsPro() (set by pmg-pro.js).
   * If pmg-pro.js hasn't loaded yet for any reason, default to LOCKED
   * (safer to over-lock than to leak the feature).
   * ------------------------------------------------------------------ */
  function isPro() {
    try {
      if (typeof window.pmgIsPro === 'function') return !!window.pmgIsPro();
      if (document.body && document.body.classList.contains('pmg-is-pro')) return true;
    } catch (_) {}
    return false;
  }

  function openUpgradeModal() {
    try {
      if (typeof window.showUpgradeModal === 'function') {
        window.showUpgradeModal('Money Mode Pro');
        return;
      }
    } catch (_) {}
    /* Fallback: if the shared modal is unavailable, send the user to
       the pricing page rather than do nothing. */
    try { window.location.assign('./pricing.html#early-access'); } catch (_) {}
  }

  /* ------------------------------------------------------------------
   * CSS — all class names prefixed pmg-mmpro- to avoid collisions.
   * ------------------------------------------------------------------ */
  var STYLE_ID = 'pmg-mmpro-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* ===== Container ===== */
      '.pmg-mmpro-panel {',
      '  margin: var(--space-4) 0 0;',
      '  padding: var(--space-4) var(--space-5);',
      '  border-radius: var(--radius-lg);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));',
      '  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 8%, transparent);',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: var(--space-4);',
      '  position: relative;',
      '  isolation: isolate;',
      '}',

      /* ===== Header row ===== */
      '.pmg-mmpro-header {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 4px;',
      '}',
      '.pmg-mmpro-title-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  flex-wrap: wrap;',
      '}',
      '.pmg-mmpro-title {',
      '  margin: 0;',
      '  font-size: var(--text-lg, 1.125rem);',
      '  font-weight: 700;',
      '  color: var(--color-text);',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '}',
      '.pmg-mmpro-pro-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  padding: 2px 8px;',
      '  border-radius: 999px;',
      '  background: var(--color-primary);',
      '  color: var(--color-on-primary, #fff);',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.06em;',
      '  text-transform: uppercase;',
      '}',
      '.pmg-mmpro-sub {',
      '  margin: 0;',
      '  font-size: var(--text-sm);',
      '  color: var(--color-text-muted);',
      '  line-height: 1.4;',
      '}',
      '.pmg-mmpro-tooltip-toggle {',
      '  align-self: flex-start;',
      '  margin: 4px 0 0;',
      '  background: none;',
      '  border: none;',
      '  padding: 0;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-primary);',
      '  cursor: pointer;',
      '  text-decoration: underline;',
      '  text-underline-offset: 3px;',
      '}',
      '.pmg-mmpro-tooltip-body {',
      '  margin: 4px 0 0;',
      '  padding: 10px 12px;',
      '  border-radius: var(--radius-md);',
      '  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-bg));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 35%, transparent);',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text);',
      '  line-height: 1.5;',
      '}',
      '.pmg-mmpro-tooltip-body[hidden] { display: none; }',

      /* ===== Section label (Quick Start / Pro Boosts) ===== */
      '.pmg-mmpro-section-label {',
      '  margin: 0;',
      '  font-size: var(--text-xs);',
      '  font-weight: 700;',
      '  color: var(--color-primary);',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.08em;',
      '}',

      /* ===== Quick presets — stacked vertically for linear flow ===== */
      '.pmg-mmpro-presets {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '}',
      '.pmg-mmpro-preset-btn {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  width: 100%;',
      '  padding: 10px 14px;',
      '  border-radius: var(--radius-md);',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));',
      '  color: var(--color-text);',
      '  font: inherit;',
      '  font-weight: 600;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  transition: background var(--transition-interactive),',
      '              border-color var(--transition-interactive),',
      '              transform var(--transition-interactive),',
      '              box-shadow var(--transition-interactive);',
      '}',
      '.pmg-mmpro-preset-btn:hover,',
      '.pmg-mmpro-preset-btn:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));',
      '  border-color: var(--color-primary);',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 14%, transparent);',
      '  outline: none;',
      '}',
      '.pmg-mmpro-preset-btn:active { transform: translateY(0); }',
      '.pmg-mmpro-preset-icon {',
      '  flex: 0 0 auto;',
      '  font-size: 18px;',
      '  line-height: 1;',
      '}',
      '.pmg-mmpro-preset-text {',
      '  flex: 1 1 auto;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 2px;',
      '  min-width: 0;',
      '}',
      '.pmg-mmpro-preset-label {',
      '  font-size: var(--text-md);',
      '  font-weight: 700;',
      '  color: var(--color-text);',
      '}',
      '.pmg-mmpro-preset-hint {',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  font-weight: 500;',
      '}',

      /* ===== Field row — every dropdown sits on its own row ===== */
      '.pmg-mmpro-field {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '}',
      '.pmg-mmpro-field-label {',
      '  font-size: var(--text-sm);',
      '  font-weight: 600;',
      '  color: var(--color-text);',
      '}',
      '.pmg-mmpro-field select {',
      '  width: 100%;',
      '  padding: 10px 14px;',
      '  border-radius: var(--radius-md);',
      '  border: 1px solid var(--color-border);',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  font: inherit;',
      '  font-size: var(--text-md);',
      '  cursor: pointer;',
      '  transition: border-color var(--transition-interactive), box-shadow var(--transition-interactive);',
      '}',
      '.pmg-mmpro-field select:hover { border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }',
      '.pmg-mmpro-field select:focus-visible {',
      '  outline: none;',
      '  border-color: var(--color-primary);',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);',
      '}',

      /* ===== Boosts list — one toggle per row, no side-by-side ===== */
      '.pmg-mmpro-boosts {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '}',
      '.pmg-mmpro-boost-row {',
      '  display: flex;',
      '  align-items: flex-start;',
      '  justify-content: space-between;',
      '  gap: 12px;',
      '  padding: 10px 12px;',
      '  border-radius: var(--radius-md);',
      '  background: var(--color-surface);',
      '  border: 1px solid var(--color-border);',
      '  transition: border-color var(--transition-interactive), background var(--transition-interactive);',
      '}',
      '.pmg-mmpro-boost-row.is-active {',
      '  border-color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));',
      '}',
      '.pmg-mmpro-boost-text {',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 2px;',
      '}',
      '.pmg-mmpro-boost-label {',
      '  font-size: var(--text-md);',
      '  font-weight: 600;',
      '  color: var(--color-text);',
      '  line-height: 1.3;',
      '}',
      '.pmg-mmpro-boost-sub {',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  line-height: 1.4;',
      '}',
      '.pmg-mmpro-boost-switch {',
      '  flex: 0 0 auto;',
      '  position: relative;',
      '  display: inline-block;',
      '  width: 42px;',
      '  height: 24px;',
      '  margin-top: 2px;',
      '}',
      '.pmg-mmpro-boost-switch input {',
      '  opacity: 0;',
      '  width: 0;',
      '  height: 0;',
      '}',
      '.pmg-mmpro-boost-slider {',
      '  position: absolute;',
      '  inset: 0;',
      '  border-radius: 999px;',
      '  background: color-mix(in srgb, var(--color-text) 18%, transparent);',
      '  transition: background var(--transition-interactive);',
      '  cursor: pointer;',
      '}',
      '.pmg-mmpro-boost-slider::before {',
      '  content: "";',
      '  position: absolute;',
      '  top: 3px;',
      '  left: 3px;',
      '  width: 18px;',
      '  height: 18px;',
      '  border-radius: 50%;',
      '  background: var(--color-surface);',
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.18);',
      '  transition: transform var(--transition-interactive);',
      '}',
      '.pmg-mmpro-boost-switch input:checked + .pmg-mmpro-boost-slider { background: var(--color-primary); }',
      '.pmg-mmpro-boost-switch input:checked + .pmg-mmpro-boost-slider::before { transform: translateX(18px); }',
      '.pmg-mmpro-boost-switch input:focus-visible + .pmg-mmpro-boost-slider {',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '}',

      /* ===== Live feedback line ===== */
      '.pmg-mmpro-feedback {',
      '  margin: 0;',
      '  padding: 10px 12px;',
      '  border-radius: var(--radius-md);',
      '  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg));',
      '  border: 1px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text);',
      '  line-height: 1.5;',
      '}',
      '.pmg-mmpro-feedback strong { color: var(--color-primary); font-weight: 700; }',
      '.pmg-mmpro-feedback.is-empty { color: var(--color-text-muted); font-style: italic; }',

      /* ===== Locked state (free user, paywall ON) ===== */
      '.pmg-mmpro-panel.is-locked .pmg-mmpro-presets,',
      '.pmg-mmpro-panel.is-locked .pmg-mmpro-field,',
      '.pmg-mmpro-panel.is-locked .pmg-mmpro-boosts,',
      '.pmg-mmpro-panel.is-locked .pmg-mmpro-feedback {',
      '  opacity: 0.55;',
      '  filter: saturate(0.65);',
      '  pointer-events: none;',
      '  user-select: none;',
      '}',
      '.pmg-mmpro-panel.is-locked .pmg-mmpro-locked-overlay {',
      '  display: flex;',
      '}',
      '.pmg-mmpro-locked-overlay {',
      '  display: none;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 14px 16px;',
      '  border-radius: var(--radius-md);',
      '  background: var(--color-surface);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));',
      '  text-align: center;',
      '}',
      '.pmg-mmpro-locked-text {',
      '  margin: 0;',
      '  font-size: var(--text-sm);',
      '  color: var(--color-text);',
      '  line-height: 1.4;',
      '}',
      '.pmg-mmpro-locked-cta {',
      '  align-self: center;',
      '  padding: 8px 16px;',
      '  border-radius: var(--radius-md);',
      '  background: var(--color-primary);',
      '  color: var(--color-on-primary, #fff);',
      '  border: none;',
      '  font: inherit;',
      '  font-weight: 700;',
      '  font-size: var(--text-sm);',
      '  cursor: pointer;',
      '  transition: transform var(--transition-interactive), box-shadow var(--transition-interactive);',
      '}',
      '.pmg-mmpro-locked-cta:hover,',
      '.pmg-mmpro-locked-cta:focus-visible {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 35%, transparent);',
      '  outline: none;',
      '}',

      /* ===== Mobile tightening ===== */
      '@media (max-width: 540px) {',
      '  .pmg-mmpro-panel { padding: var(--space-3) var(--space-4); gap: var(--space-3); }',
      '  .pmg-mmpro-preset-btn { padding: 9px 12px; }',
      '  .pmg-mmpro-boost-row { padding: 9px 10px; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------
   * Build the panel DOM. Returns the root element.
   * ------------------------------------------------------------------ */
  var PANEL_ID = 'pmg-mmpro-panel';

  function buildPanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    var panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'pmg-mmpro-panel';
    panel.setAttribute('aria-labelledby', 'pmg-mmpro-title');

    /* --- Header --- */
    var header = document.createElement('header');
    header.className = 'pmg-mmpro-header';

    var titleRow = document.createElement('div');
    titleRow.className = 'pmg-mmpro-title-row';
    var title = document.createElement('h3');
    title.id = 'pmg-mmpro-title';
    title.className = 'pmg-mmpro-title';
    title.innerHTML = '<span aria-hidden="true">⚡</span> Money Mode Pro';
    var badge = document.createElement('span');
    badge.className = 'pmg-mmpro-pro-badge';
    badge.textContent = 'Pro';
    titleRow.appendChild(title);
    titleRow.appendChild(badge);

    var sub = document.createElement('p');
    sub.className = 'pmg-mmpro-sub';
    sub.textContent = 'Tune your prompt for attention, action, and real results.';

    var tipBtn = document.createElement('button');
    tipBtn.type = 'button';
    tipBtn.className = 'pmg-mmpro-tooltip-toggle';
    tipBtn.setAttribute('aria-expanded', 'false');
    tipBtn.setAttribute('aria-controls', 'pmg-mmpro-tooltip-body');
    tipBtn.textContent = 'What does this do?';

    var tipBody = document.createElement('p');
    tipBody.id = 'pmg-mmpro-tooltip-body';
    tipBody.className = 'pmg-mmpro-tooltip-body';
    tipBody.hidden = true;
    tipBody.textContent = 'Helps your prompt actually perform — stronger hooks, sharper messaging, clearer asks, and structure built to land.';

    tipBtn.addEventListener('click', function () {
      var open = tipBody.hidden;
      tipBody.hidden = !open;
      tipBtn.setAttribute('aria-expanded', String(open));
      tipBtn.textContent = open ? 'Hide explanation' : 'What does this do?';
    });

    header.appendChild(titleRow);
    header.appendChild(sub);
    header.appendChild(tipBtn);
    header.appendChild(tipBody);

    /* --- Locked overlay (only visible when .is-locked) --- */
    var lockOverlay = document.createElement('div');
    lockOverlay.className = 'pmg-mmpro-locked-overlay';
    var lockText = document.createElement('p');
    lockText.className = 'pmg-mmpro-locked-text';
    lockText.innerHTML = '<strong>Money Mode Pro</strong> is part of the paid plan. Upgrade to unlock presets, intent, platform tuning, and the boost toggles below.';
    var lockCta = document.createElement('button');
    lockCta.type = 'button';
    lockCta.className = 'pmg-mmpro-locked-cta';
    lockCta.textContent = 'Upgrade To Money Mode Pro';
    lockCta.addEventListener('click', function (e) {
      e.preventDefault();
      openUpgradeModal();
    });
    lockOverlay.appendChild(lockText);
    lockOverlay.appendChild(lockCta);

    /* --- Quick Start presets --- */
    var presetLabel = document.createElement('p');
    presetLabel.className = 'pmg-mmpro-section-label';
    presetLabel.textContent = 'Quick Start';

    var presetWrap = document.createElement('div');
    presetWrap.className = 'pmg-mmpro-presets';
    PRESETS.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-mmpro-preset-btn';
      btn.dataset.presetId = p.id;
      btn.innerHTML =
        '<span class="pmg-mmpro-preset-icon" aria-hidden="true">' + p.icon + '</span>' +
        '<span class="pmg-mmpro-preset-text">' +
          '<span class="pmg-mmpro-preset-label">' + escapeHtml(p.label) + '</span>' +
          '<span class="pmg-mmpro-preset-hint">' + escapeHtml(p.hint) + '</span>' +
        '</span>';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!isPro()) { openUpgradeModal(); return; }
        applyPreset(p);
      });
      presetWrap.appendChild(btn);
    });

    /* --- Dropdowns: intent, platform, style (each on its own row) --- */
    function buildSelect(idSuffix, labelText, options, currentValue, onChange) {
      var field = document.createElement('div');
      field.className = 'pmg-mmpro-field';
      var lbl = document.createElement('label');
      lbl.className = 'pmg-mmpro-field-label';
      lbl.htmlFor = 'pmg-mmpro-' + idSuffix;
      lbl.textContent = labelText;
      var sel = document.createElement('select');
      sel.id = 'pmg-mmpro-' + idSuffix;
      sel.dataset.mmproField = idSuffix;
      options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === currentValue) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('mousedown', proGuard);
      sel.addEventListener('keydown', proGuard);
      sel.addEventListener('change', function () {
        if (!isPro()) { openUpgradeModal(); return; }
        onChange(sel.value);
      });
      field.appendChild(lbl);
      field.appendChild(sel);
      return field;
    }

    var intentField = buildSelect(
      'intent', "What's this prompt for?", INTENTS, state.intent,
      function (v) { state.intent = v; saveState(state); updateFeedback(); }
    );
    var platformField = buildSelect(
      'platform', 'Where will it land?', PLATFORMS, state.platform,
      function (v) { state.platform = v; saveState(state); updateFeedback(); }
    );
    var styleField = buildSelect(
      'style', 'How should it sound?', STYLES, state.style,
      function (v) { state.style = v; saveState(state); updateFeedback(); }
    );

    /* --- Pro Boosts (one toggle per row) --- */
    var boostsLabel = document.createElement('p');
    boostsLabel.className = 'pmg-mmpro-section-label';
    boostsLabel.textContent = 'Pro Boosts';

    var boostsWrap = document.createElement('div');
    boostsWrap.className = 'pmg-mmpro-boosts';
    BOOSTS.forEach(function (b) {
      var row = document.createElement('div');
      row.className = 'pmg-mmpro-boost-row';
      row.dataset.boostId = b.id;
      if (state.boosts[b.id]) row.classList.add('is-active');

      var text = document.createElement('div');
      text.className = 'pmg-mmpro-boost-text';
      var lbl = document.createElement('span');
      lbl.className = 'pmg-mmpro-boost-label';
      lbl.textContent = b.label;
      var subc = document.createElement('span');
      subc.className = 'pmg-mmpro-boost-sub';
      subc.textContent = b.sub;
      text.appendChild(lbl);
      text.appendChild(subc);

      var sw = document.createElement('label');
      sw.className = 'pmg-mmpro-boost-switch';
      sw.setAttribute('aria-label', 'Toggle ' + b.label);
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!state.boosts[b.id];
      input.dataset.mmproBoost = b.id;
      input.addEventListener('mousedown', proGuard);
      input.addEventListener('keydown', proGuard);
      input.addEventListener('change', function () {
        if (!isPro()) {
          input.checked = !input.checked;
          openUpgradeModal();
          return;
        }
        state.boosts[b.id] = input.checked;
        saveState(state);
        row.classList.toggle('is-active', input.checked);
        updateFeedback();
      });
      var slider = document.createElement('span');
      slider.className = 'pmg-mmpro-boost-slider';
      slider.setAttribute('aria-hidden', 'true');
      sw.appendChild(input);
      sw.appendChild(slider);

      row.appendChild(text);
      row.appendChild(sw);
      boostsWrap.appendChild(row);
    });

    /* --- Live feedback line --- */
    var feedback = document.createElement('p');
    feedback.id = 'pmg-mmpro-feedback';
    feedback.className = 'pmg-mmpro-feedback';

    /* Assemble in strict linear order */
    panel.appendChild(header);
    panel.appendChild(lockOverlay);
    panel.appendChild(presetLabel);
    panel.appendChild(presetWrap);
    panel.appendChild(intentField);
    panel.appendChild(platformField);
    panel.appendChild(styleField);
    panel.appendChild(boostsLabel);
    panel.appendChild(boostsWrap);
    panel.appendChild(feedback);

    return panel;
  }

  /* Click-guard for selects/toggles when locked. Stops the native
     interaction before the browser opens the dropdown. */
  function proGuard(e) {
    if (isPro()) return;
    /* Allow Tab so focus can still leave a locked field. */
    if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift')) return;
    e.preventDefault();
    e.stopPropagation();
    openUpgradeModal();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------
   * Apply a preset: merge into state, refresh the UI, save.
   * ------------------------------------------------------------------ */
  function applyPreset(p) {
    if (!p || !p.apply) return;
    /* Reset all boosts to false, then enable the preset's boosts. */
    Object.keys(state.boosts).forEach(function (k) { state.boosts[k] = false; });
    if (p.apply.boosts) {
      Object.keys(p.apply.boosts).forEach(function (k) {
        if (k in state.boosts) state.boosts[k] = !!p.apply.boosts[k];
      });
    }
    if (typeof p.apply.intent === 'string')   state.intent = p.apply.intent;
    if (typeof p.apply.platform === 'string') state.platform = p.apply.platform;
    if (typeof p.apply.style === 'string')    state.style = p.apply.style;
    saveState(state);
    syncUiToState();
    updateFeedback();
  }

  /* Reflect state into the live DOM (called after preset application
     and after the panel is first built). */
  function syncUiToState() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    ['intent', 'platform', 'style'].forEach(function (k) {
      var sel = panel.querySelector('[data-mmpro-field="' + k + '"]');
      if (sel) sel.value = state[k] || '';
    });
    BOOSTS.forEach(function (b) {
      var input = panel.querySelector('input[data-mmpro-boost="' + b.id + '"]');
      var row = panel.querySelector('[data-boost-id="' + b.id + '"]');
      if (input) input.checked = !!state.boosts[b.id];
      if (row) row.classList.toggle('is-active', !!state.boosts[b.id]);
    });
  }

  /* ------------------------------------------------------------------
   * Live feedback line
   * ------------------------------------------------------------------ */
  function labelFor(list, value) {
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i].label;
    return '';
  }
  function activeBoostLabels() {
    return BOOSTS.filter(function (b) { return state.boosts[b.id]; }).map(function (b) { return b.label; });
  }
  function updateFeedback() {
    var el = document.getElementById('pmg-mmpro-feedback');
    if (!el) return;
    var parts = [];
    var intentLbl = labelFor(INTENTS, state.intent);
    var platformLbl = labelFor(PLATFORMS, state.platform);
    var styleLbl = labelFor(STYLES, state.style);
    var boosts = activeBoostLabels();
    if (intentLbl) parts.push('<strong>' + escapeHtml(intentLbl) + '</strong>');
    if (platformLbl) parts.push('on <strong>' + escapeHtml(platformLbl) + '</strong>');
    if (styleLbl) parts.push('· <strong>' + escapeHtml(styleLbl) + '</strong>');
    if (boosts.length) parts.push('· ' + boosts.map(escapeHtml).join(' · '));
    if (!parts.length) {
      el.classList.add('is-empty');
      el.textContent = 'Pick a goal, platform, style, or boost to tune your prompt.';
    } else {
      el.classList.remove('is-empty');
      el.innerHTML = 'Tuned for ' + parts.join(' ');
    }
  }

  /* ------------------------------------------------------------------
   * Lock / unlock the panel based on Pro status. Call on init and
   * whenever pmg-pro broadcasts a change (we re-check periodically).
   * ------------------------------------------------------------------ */
  function refreshLockState() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.toggle('is-locked', !isPro());
  }

  /* ------------------------------------------------------------------
   * Mount the panel inside the existing Power Ups <details> body,
   * directly AFTER the existing free Money Mode toggle row, so the
   * vertical reading order is:
   *
   *   Money Mode (Free)   <- existing toggle
   *   Money Mode Pro      <- this panel
   *   Human Voice Mode    <- existing
   *   Clarity Boost Mode  <- existing
   *   Photo Prompt Mode   <- existing
   * ------------------------------------------------------------------ */
  function mount() {
    if (document.getElementById(PANEL_ID)) return true;
    var moneyToggle = document.getElementById('moneyMode');
    if (!moneyToggle) return false;
    /* Walk up from the checkbox to its containing .toggle-row so we
       can insert our panel as the .toggle-row's next sibling. */
    var row = moneyToggle.closest('.toggle-row');
    if (!row || !row.parentNode) return false;
    var panel = buildPanel();
    row.parentNode.insertBefore(panel, row.nextSibling);
    syncUiToState();
    updateFeedback();
    refreshLockState();
    return true;
  }

  /* ------------------------------------------------------------------
   * Augment the AI payload with Money Mode Pro instructions.
   * Only runs when:
   *   - the user is Pro, AND
   *   - at least one Pro option is set.
   * Otherwise the payload is returned unchanged.
   * ------------------------------------------------------------------ */
  function buildInstructionBlock() {
    var lines = [];
    var intentLbl = labelFor(INTENTS, state.intent);
    var platformLbl = labelFor(PLATFORMS, state.platform);
    var styleLbl = labelFor(STYLES, state.style);
    if (intentLbl)   lines.push('- Goal: ' + intentLbl);
    if (platformLbl) lines.push('- Platform: ' + platformLbl + ' (tune tone, length, and structure for this surface)');
    if (styleLbl)    lines.push('- Output style: ' + styleLbl);
    var activeInstructions = BOOSTS
      .filter(function (b) { return state.boosts[b.id]; })
      .map(function (b) { return '- ' + b.instruction; });
    if (activeInstructions.length) {
      lines.push('- Performance boosts:');
      activeInstructions.forEach(function (l) { lines.push('  ' + l); });
    }
    if (!lines.length) return '';
    return '\n\n[Money Mode Pro instructions]\n' + lines.join('\n');
  }

  function augmentPayload(payload) {
    try {
      if (!isPro()) return payload;
      if (!payload || typeof payload !== 'object') return payload;
      var block = buildInstructionBlock();
      if (!block) return payload;
      /* Append to extraDetails without mutating the user's textarea. */
      var existing = typeof payload.extraDetails === 'string' ? payload.extraDetails : '';
      var augmented = existing ? (existing + block) : block.replace(/^\n+/, '');
      return Object.assign({}, payload, { extraDetails: augmented, moneyModePro: true });
    } catch (_) {
      return payload;
    }
  }

  /* Wrap window.__pmgAI's three generate methods, idempotently. */
  function tryWrapAI() {
    var ai = window.__pmgAI;
    if (!ai || ai.__pmgMMProWrapped) return !!ai;
    ai.__pmgMMProWrapped = true;
    ['generateStream', 'generateStructured', 'generateRaw'].forEach(function (method) {
      if (typeof ai[method] !== 'function') return;
      var orig = ai[method].bind(ai);
      ai[method] = function (payload /*, ...rest */) {
        var rest = Array.prototype.slice.call(arguments, 1);
        var augmented = augmentPayload(payload);
        return orig.apply(null, [augmented].concat(rest));
      };
    });
    return true;
  }

  /* ------------------------------------------------------------------
   * Init — inject styles, mount on the form, retry until DOM is ready,
   * wrap __pmgAI when it becomes available, periodically re-sync the
   * lock state in case T42 flips Pro on/off after page load.
   * ------------------------------------------------------------------ */
  function init() {
    injectStyles();

    var mountTries = 0;
    var mountIv = setInterval(function () {
      mountTries++;
      if (mount()) clearInterval(mountIv);
      if (mountTries >= 60) clearInterval(mountIv); /* ~24s cap */
    }, 400);

    var aiTries = 0;
    var aiIv = setInterval(function () {
      aiTries++;
      tryWrapAI();
      if (aiTries >= 60) clearInterval(aiIv);
    }, 500);

    /* Re-evaluate lock state every 2s — pmg-pro / T42 may flip the
       flag asynchronously after the panel is mounted. Cheap operation
       that just toggles a class, so the constant interval is fine. */
    setInterval(refreshLockState, 2000);

    /* Also refresh immediately when storage events fire (multi-tab). */
    try {
      window.addEventListener('storage', function (e) {
        if (!e || e.key === window.PMG_PRO_KEY) refreshLockState();
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  } catch (err) {
    try { console.warn('[pmg-mm-pro] init error (suppressed):', err); } catch (_) {}
  }
})();
