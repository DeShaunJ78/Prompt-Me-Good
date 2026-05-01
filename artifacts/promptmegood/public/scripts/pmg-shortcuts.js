/* =============================================================
 * pmg-shortcuts.js  (Task #27)
 *
 * Discoverable Keyboard Shortcuts cheatsheet panel.
 *
 *   - Floating "?" trigger button at bottom-left of the viewport.
 *     Hidden until the user has completed at least one successful
 *     generation. Visibility is owned by a dedicated body class
 *     `pmg-shortcuts-unlocked` that we manage from the
 *     `pmg_has_generated` localStorage flag — never removed once
 *     set, so it survives clearHasResult() and reloads.
 *
 *   - Panel groups shortcuts by area: Global, Builder, Studio,
 *     Photo Suite. Open via the trigger or by pressing "?"
 *     (Shift + /). Close via the close button, Esc, or by
 *     clicking the dimmed backdrop.
 *
 *   - Adds two new gated shortcuts:
 *       S  Focus The Studio Textarea       (#pmg-ts-textarea)
 *       R  Surprise Me                     (.pmg-photo-surprise)
 *     G (Generate) and C (Copy) are EXISTING shortcuts already
 *     wired in index.html (~line 8066) — we only document them in
 *     the cheatsheet, never re-bind them, to avoid double-firing.
 *     Both new shortcuts are inert while typing in any input /
 *     textarea / contenteditable, when a modifier key is held,
 *     or when an overlay / role="dialog" is open. Shortcuts that
 *     have no visible target on the current page (e.g. R while
 *     not in Photography Suite) silently no-op.
 *
 *   - Strictly additive: no backend / API / Stripe / Supabase /
 *     auth changes, no renamed IDs, no edits to existing
 *     handlers. Reduce-motion respected (no fade / slide
 *     transitions when the user prefers reduced motion).
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgShortcutsLoaded) return;
  window.__pmgShortcutsLoaded = true;

  /* Escape hatch — `?noshortcuts` or localStorage `pmg_disable=1`. */
  try {
    if (
      /[?&]noshortcuts\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1' ||
      localStorage.getItem('pmg_shortcuts_disable') === '1'
    ) {
      try { console.info('[pmg-shortcuts] disabled via escape hatch'); } catch (_) {}
      return;
    }
  } catch (_) {}

  var HAS_GEN_KEY = 'pmg_has_generated';
  var TRIGGER_ID = 'pmg-shortcuts-trigger';
  var PANEL_ID = 'pmg-shortcuts-panel';
  var BACKDROP_ID = 'pmg-shortcuts-backdrop';

  /* -------- CSS -------- */
  function injectStyles() {
    if (document.getElementById('pmg-shortcuts-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-shortcuts-styles';
    s.textContent = [
      /* Trigger button — small floating "?" at bottom-left so it
         does not collide with the bottom-right sticky tab or the
         bottom-center toast region. */
      '#' + TRIGGER_ID + '{',
      '  position: fixed;',
      '  left: 14px;',
      '  bottom: calc(14px + env(safe-area-inset-bottom, 0px));',
      '  z-index: 90;',
      '  display: none;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 44px;',
      '  height: 44px;',
      '  min-width: 44px;',
      '  min-height: 44px;',
      '  padding: 0;',
      '  border-radius: 999px;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f6e6a) 35%, var(--color-border, #d8d4cd));',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-primary, #0f6e6a);',
      '  font-weight: 800;',
      '  font-size: 18px;',
      '  line-height: 1;',
      '  cursor: pointer;',
      '  box-shadow: 0 4px 14px rgba(0,0,0,0.12);',
      '  transition: background-color 160ms ease, transform 120ms ease;',
      '}',
      /* Visibility is owned by the dedicated `pmg-shortcuts-unlocked`
         body class managed in this script. We deliberately do NOT key
         off `pmg-has-generated` because pmg-ux.js's clearHasResult()
         removes that class on prompt reset, which would hide an entry
         point the user has already discovered. Once unlocked, stays
         unlocked for the session/profile (localStorage-backed). */
      'body.pmg-shortcuts-unlocked #' + TRIGGER_ID + '{ display: inline-flex; }',
      '#' + TRIGGER_ID + ':hover{',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 8%, var(--color-surface, #fff));',
      '}',
      '#' + TRIGGER_ID + ':focus-visible{',
      '  outline: 2px solid var(--color-primary, #0f6e6a);',
      '  outline-offset: 2px;',
      '}',
      '#' + TRIGGER_ID + ':active{ transform: translateY(1px); }',

      /* Backdrop + panel */
      '#' + BACKDROP_ID + '{',
      '  position: fixed; inset: 0;',
      '  background: rgba(0,0,0,0.50);',
      '  z-index: 200;',
      '  display: none;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 16px;',
      '  animation: pmgShortcutsFadeIn 180ms ease;',
      '}',
      '#' + BACKDROP_ID + '.is-open{ display: flex; }',
      '@keyframes pmgShortcutsFadeIn { from { opacity: 0; } to { opacity: 1; } }',

      '#' + PANEL_ID + '{',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-text, #1a1a1a);',
      '  border-radius: 16px;',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  width: 100%;',
      '  max-width: 520px;',
      '  max-height: calc(100vh - 32px);',
      '  overflow: auto;',
      '  box-shadow: 0 20px 50px rgba(0,0,0,0.30);',
      '  padding: 20px 22px 22px;',
      '  box-sizing: border-box;',
      '  animation: pmgShortcutsSlideUp 220ms ease;',
      '}',
      '@keyframes pmgShortcutsSlideUp {',
      '  from { opacity: 0; transform: translateY(12px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',

      '#' + PANEL_ID + ' .pmg-shortcuts-head{',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 12px; margin-bottom: 4px;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-title{',
      '  margin: 0; font-size: 18px; font-weight: 800; color: var(--color-text, #1a1a1a);',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-close{',
      '  background: transparent; border: 1px solid transparent;',
      '  width: 36px; height: 36px; min-width: 36px; min-height: 36px;',
      '  border-radius: 999px; cursor: pointer;',
      '  font-size: 20px; line-height: 1; color: var(--color-text-muted, #5f6b75);',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-close:hover{',
      '  background: var(--color-surface-2, #f1efea); color: var(--color-text, #1a1a1a);',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-close:focus-visible{',
      '  outline: 2px solid var(--color-primary, #0f6e6a); outline-offset: 2px;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-sub{',
      '  margin: 0 0 14px; font-size: 13px; color: var(--color-text-muted, #5f6b75);',
      '}',

      '#' + PANEL_ID + ' .pmg-shortcuts-group{',
      '  margin: 14px 0 0;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-group-title{',
      '  font-size: 12px; font-weight: 700; letter-spacing: 0.04em;',
      /* No text-transform — group titles ("Global", "Builder", etc.)
         are written in Title Case in the source and must render
         exactly as-is (Title Case acceptance criterion). */
      '  color: var(--color-text-muted, #5f6b75);',
      '  margin: 0 0 8px;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-list{',
      '  list-style: none; margin: 0; padding: 0;',
      '  display: flex; flex-direction: column; gap: 6px;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-row{',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 12px; padding: 10px 12px;',
      '  background: var(--color-surface-2, #f5f7f7);',
      '  border: 1px solid var(--color-border, #e5e7eb);',
      '  border-radius: 10px;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-label{',
      '  font-size: 14px; font-weight: 600; color: var(--color-text, #1a1a1a);',
      '  min-width: 0; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + PANEL_ID + ' .pmg-shortcuts-keys{',
      '  display: inline-flex; gap: 4px; flex-shrink: 0;',
      '}',
      '#' + PANEL_ID + ' kbd.pmg-kbd{',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  min-width: 28px; height: 26px; padding: 0 8px;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  border-bottom-width: 2px;',
      '  border-radius: 6px;',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
      '  font-size: 12px; font-weight: 700; color: var(--color-text, #1a1a1a);',
      '  letter-spacing: 0.02em;',
      '}',

      '#' + PANEL_ID + ' .pmg-shortcuts-foot{',
      '  margin: 16px 0 0; font-size: 12px; color: var(--color-text-muted, #5f6b75);',
      '}',

      '@media (prefers-reduced-motion: reduce){',
      '  #' + BACKDROP_ID + '{ animation: none; }',
      '  #' + PANEL_ID + '{ animation: none; }',
      '  #' + TRIGGER_ID + '{ transition: none; }',
      '}',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* -------- Shortcut catalog (rendered into the panel) -------- */
  var GROUPS = [
    { title: 'Global', rows: [
      { keys: ['?'],   label: 'Open This Shortcuts Panel' },
      { keys: ['/'],   label: 'Open Search' },
      { keys: ['Esc'], label: 'Close Or Cancel' }
    ] },
    { title: 'Builder', rows: [
      { keys: ['G'], label: 'Generate Or Fix My Prompt' },
      { keys: ['C'], label: 'Copy The Result' }
    ] },
    { title: 'Studio', rows: [
      { keys: ['S'], label: 'Focus The Studio Textarea' }
    ] },
    { title: 'Photo Suite', rows: [
      { keys: ['R'], label: 'Surprise Me With A Random Brief' }
    ] }
  ];

  /* -------- Build trigger + panel DOM (idempotent) -------- */
  function ensureTrigger() {
    if (document.getElementById(TRIGGER_ID)) return;
    var btn = document.createElement('button');
    btn.id = TRIGGER_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open Keyboard Shortcuts');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', PANEL_ID);
    btn.title = 'Keyboard Shortcuts (?)';
    btn.textContent = '?';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      togglePanel();
    });
    document.body.appendChild(btn);
  }

  function ensurePanel() {
    if (document.getElementById(BACKDROP_ID)) return;

    var backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute('role', 'presentation');

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', PANEL_ID + '-title');
    panel.tabIndex = -1;

    var html = [];
    html.push('<div class="pmg-shortcuts-head">');
    html.push('  <h2 class="pmg-shortcuts-title" id="' + PANEL_ID + '-title">Keyboard Shortcuts</h2>');
    html.push('  <button type="button" class="pmg-shortcuts-close" aria-label="Close Keyboard Shortcuts">×</button>');
    html.push('</div>');
    html.push('<p class="pmg-shortcuts-sub">Quick Keys To Move Faster Through The App.</p>');

    GROUPS.forEach(function (g) {
      html.push('<section class="pmg-shortcuts-group">');
      html.push('  <h3 class="pmg-shortcuts-group-title">' + escapeHtml(g.title) + '</h3>');
      html.push('  <ul class="pmg-shortcuts-list">');
      g.rows.forEach(function (r) {
        html.push('    <li class="pmg-shortcuts-row">');
        html.push('      <span class="pmg-shortcuts-label">' + escapeHtml(r.label) + '</span>');
        html.push('      <span class="pmg-shortcuts-keys">' +
          r.keys.map(function (k) { return '<kbd class="pmg-kbd">' + escapeHtml(k) + '</kbd>'; }).join('') +
          '</span>');
        html.push('    </li>');
      });
      html.push('  </ul>');
      html.push('</section>');
    });

    html.push('<p class="pmg-shortcuts-foot">Letter Shortcuts Are Inactive While You Are Typing In A Field Or A Modal Is Open.</p>');

    panel.innerHTML = html.join('\n');
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    /* Wire close affordances. */
    var closeBtn = panel.querySelector('.pmg-shortcuts-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closePanel();
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* -------- First-generation flag check (mirror of pmg-ux.js).
     Reads BOTH the localStorage value (covers reloads) and the
     body class (covers in-session flip without a reload). -------- */
  function hasGeneratedYet() {
    try {
      var v = localStorage.getItem(HAS_GEN_KEY);
      if (v === '1' || v === 'true') return true;
    } catch (_) {}
    return !!(document.body && document.body.classList.contains('pmg-has-generated'));
  }

  /* -------- Open / close -------- */
  var lastFocus = null;

  function isPanelOpen() {
    var b = document.getElementById(BACKDROP_ID);
    return !!(b && b.classList.contains('is-open'));
  }

  function openPanel() {
    /* Single source of truth for the first-generation gate. Every
       open path (keyboard "?", trigger button click, programmatic
       window.__pmgShortcuts.open) flows through here, so this one
       check protects them all. The CSS-hides-trigger rule alone is
       not enough — class drift, style overrides, or test harnesses
       could otherwise click through. */
    if (!hasGeneratedYet()) return;
    ensurePanel();
    var b = document.getElementById(BACKDROP_ID);
    var p = document.getElementById(PANEL_ID);
    if (!b || !p) return;
    lastFocus = document.activeElement;
    b.classList.add('is-open');
    try { p.focus({ preventScroll: true }); } catch (_) { try { p.focus(); } catch (__) {} }
  }

  function closePanel() {
    var b = document.getElementById(BACKDROP_ID);
    if (!b) return;
    b.classList.remove('is-open');
    try {
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    } catch (_) {}
    lastFocus = null;
  }

  function togglePanel() {
    if (isPanelOpen()) closePanel(); else openPanel();
  }

  /* Minimal focus trap. Collects focusable descendants of the
     panel and wraps Tab/Shift+Tab around the first/last ones so
     focus cannot escape the modal while it is open. */
  function getFocusable(container) {
    if (!container) return [];
    var sel = [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    var all = container.querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.offsetParent === null && el !== container) continue; /* hidden */
      out.push(el);
    }
    return out;
  }
  function trapTab(e) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var focusables = getFocusable(panel);
    if (!focusables.length) {
      e.preventDefault();
      try { panel.focus(); } catch (_) {}
      return;
    }
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === panel || !panel.contains(active)) {
        e.preventDefault();
        try { last.focus(); } catch (_) {}
      }
    } else {
      if (active === last) {
        e.preventDefault();
        try { first.focus(); } catch (_) {}
      }
    }
  }

  /* -------- Safety gate for letter shortcuts -------- */
  function isTypingTarget(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  function isAnyOverlayOpen() {
    /* Check for our own panel + any role="dialog" that is currently
       displayed. Filter out hidden ones (display: none / aria-hidden
       true) so we do not falsely block when a modal exists in the
       DOM but is closed. */
    var ours = document.getElementById(BACKDROP_ID);
    if (ours && ours.classList.contains('is-open')) return true;
    var dialogs = document.querySelectorAll('[role="dialog"], .pmg-upgrade-overlay');
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      if (d.id === PANEL_ID) continue; /* counted via backdrop above */
      if (d.getAttribute('aria-hidden') === 'true') continue;
      var cs = window.getComputedStyle(d);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
      /* If the dialog itself is in the DOM and not hidden, treat as open. */
      var rect = d.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  /* Detect non-dialog menus/popovers that are currently open.
     We only treat `aria-expanded="true"` as blocking when the
     element is a true popup TRIGGER (it has `aria-haspopup` set
     to a popup-like value). Plain disclosure widgets (accordions,
     collapsible help panels) also use `aria-expanded` but are not
     focus-blocking, so we ignore those — otherwise S/R would
     never fire on this page (the marketing toggle and photo Q&A
     headers are always expanded by default). Also flags common
     open-menu / open-dropdown class patterns just in case. */
  function isMenuOrPopoverOpen() {
    try {
      var expanded = document.querySelectorAll('[aria-expanded="true"][aria-haspopup]');
      for (var i = 0; i < expanded.length; i++) {
        var el = expanded[i];
        if (el.closest && el.closest('#' + PANEL_ID)) continue;
        var hp = (el.getAttribute('aria-haspopup') || '').toLowerCase();
        /* Per ARIA 1.2: "true" is equivalent to "menu". Treat any
           popup-style value as blocking. Skip "false" (just in
           case it appears) and unknown strings. */
        if (hp === 'true' || hp === 'menu' || hp === 'listbox' ||
            hp === 'tree' || hp === 'grid' || hp === 'dialog') {
          return true;
        }
      }
      var openish = document.querySelectorAll(
        '[role="menu"].is-open, [role="menu"].open, [role="listbox"].is-open, ' +
        '.pmg-menu.is-open, .pmg-dropdown.is-open, .pmg-popover.is-open, ' +
        '.pmg-suggestions.is-open'
      );
      for (var j = 0; j < openish.length; j++) {
        var n = openish[j];
        if (n.id === BACKDROP_ID) continue;
        if (n.closest && n.closest('#' + PANEL_ID)) continue;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function shortcutSafe(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (isTypingTarget(e.target)) return false;
    if (isAnyOverlayOpen()) return false;
    if (isMenuOrPopoverOpen()) return false;
    return true;
  }

  /* -------- Action wiring for new shortcuts -------- */
  function isRendered(el) {
    if (!el) return false;
    if (el.disabled) return false;
    var cs = window.getComputedStyle(el);
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }
  function isInViewport(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top >= 0 && r.bottom <= vh;
  }
  function clickIfVisible(el) {
    if (!isRendered(el)) return false;
    /* If the target is off-screen, scroll it into view first so the
       user can SEE the action they triggered (validation message,
       loading state, etc). Skip the smooth scroll under reduce-
       motion preferences. */
    if (!isInViewport(el)) {
      try {
        var prefersReduce = window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({
          block: 'center',
          behavior: prefersReduce ? 'auto' : 'smooth'
        });
      } catch (_) {}
    }
    try { el.click(); return true; } catch (_) { return false; }
  }

  function doFocusStudio() {
    var ta = document.getElementById('pmg-ts-textarea');
    if (!ta) return false;
    /* If the studio collapsible is closed, open it first so the
       textarea is visible before we try to focus. */
    var details = document.getElementById('pmg-improve-collapsible');
    if (details && !details.open) details.open = true;
    try {
      ta.scrollIntoView({ block: 'center', behavior: 'auto' });
      ta.focus({ preventScroll: true });
    } catch (_) {
      try { ta.focus(); } catch (__) {}
    }
    return true;
  }

  function doSurpriseMe() {
    /* The Photography Suite renders multiple Surprise Me buttons —
       grab the first visible one. */
    var nodes = document.querySelectorAll('.pmg-photo-surprise');
    for (var i = 0; i < nodes.length; i++) {
      if (clickIfVisible(nodes[i])) return true;
    }
    return false;
  }

  /* -------- Single global keydown listener -------- */
  function onKeydown(e) {
    /* "?" toggles the panel. Gated so it does not eat a "?" the
       user is typing into an input / textarea / contenteditable.
       When OUR panel is the only thing open we still want "?" to
       close it, so we bypass the overlay-open part of the gate
       here (other modal overlays still block).
       Also gated by the first-generation flag so the panel cannot
       open before the user has run a generation at least once —
       matches the trigger-button visibility rule. */
    if (e.key === '?') {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      var ourPanelOpen = isPanelOpen();
      if (!ourPanelOpen && !hasGeneratedYet()) return;
      if (!ourPanelOpen && isAnyOverlayOpen()) return;
      e.preventDefault();
      togglePanel();
      return;
    }

    /* Esc closes our panel — does not interfere with any other Esc
       handler because we only act when our panel is visible. */
    if (e.key === 'Escape' && isPanelOpen()) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
      return;
    }

    /* Tab focus trap — only active while OUR panel is open. Keeps
       keyboard focus inside the dialog as `aria-modal` implies. */
    if (e.key === 'Tab' && isPanelOpen()) {
      trapTab(e);
      return;
    }

    if (!shortcutSafe(e)) return;

    /* Letter shortcuts NEW to this script (S, R). G and C are
       intentionally NOT handled here — they are owned by the
       existing inline handler in index.html (~line 8066). The
       cheatsheet documents them so users can discover them. */
    var k = (e.key || '').toLowerCase();
    if (k === 's') { if (doFocusStudio()) e.preventDefault(); return; }
    if (k === 'r') { if (doSurpriseMe())  e.preventDefault(); return; }
  }

  /* -------- Trigger visibility (sticky after first generation).
     We own a dedicated body class `pmg-shortcuts-unlocked` whose
     truth is `localStorage.pmg_has_generated`. We do NOT rely on
     `body.pmg-has-generated` because pmg-ux.js's clearHasResult()
     removes that on prompt reset, which would hide a discovered
     entry point. Once unlocked, stays unlocked. -------- */
  var UNLOCKED_CLASS = 'pmg-shortcuts-unlocked';

  function isFlagSet() {
    try {
      var v = localStorage.getItem(HAS_GEN_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  function applyVisibility() {
    if (!document.body) return;
    if (isFlagSet() || document.body.classList.contains('pmg-has-generated')) {
      document.body.classList.add(UNLOCKED_CLASS);
    }
  }

  /* Watch for the moment generation first happens. pmg-ux.js
     toggles `body.pmg-has-generated` synchronously when a result
     arrives, so observing body class mutations lets us flip our
     own sticky class without coupling to its lifecycle. We never
     remove UNLOCKED_CLASS — only add. */
  function listenForFlagFlip() {
    try {
      /* Cross-tab storage updates */
      window.addEventListener('storage', function (ev) {
        if (ev && ev.key === HAS_GEN_KEY) applyVisibility();
      });
    } catch (_) {}
    try {
      /* Same-tab: watch body for the pmg-has-generated class
         appearing, then mark sticky-unlocked. */
      if (document.body && typeof MutationObserver === 'function') {
        var mo = new MutationObserver(function () {
          if (document.body.classList.contains(UNLOCKED_CLASS)) {
            mo.disconnect();
            return;
          }
          applyVisibility();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (_) {}
  }

  /* -------- Init -------- */
  function init() {
    injectStyles();
    ensureTrigger();
    /* Build the panel lazily on first open to keep initial DOM
       light, but pre-build it here so accessibility tree includes
       it from the start. */
    ensurePanel();
    applyVisibility();
    listenForFlagFlip();
    document.addEventListener('keydown', onKeydown, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* Expose minimal hooks for debugging / tests. */
  window.__pmgShortcuts = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: isPanelOpen
  };
})();
