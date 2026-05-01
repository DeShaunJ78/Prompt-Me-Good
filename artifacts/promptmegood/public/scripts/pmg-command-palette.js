/* =============================================================
 * pmg-command-palette.js  (Task #53)
 *
 * Global ⌘K / Ctrl+K command palette for keyboard-driven
 * navigation, fuzzy search, and action triggering.
 *
 *   - ⌘K (macOS) / Ctrl+K (Windows/Linux) toggles a centered
 *     overlay from anywhere in the app — works even while the
 *     user is typing in an input/textarea (the palette is the
 *     escape hatch from focused fields).
 *
 *   - Fuzzy-searches across:
 *       * Modes              (Write / Image)
 *       * Actions            (Fix My Prompt, Improve, Surprise
 *                             Me, Generate Image, Save, Copy,
 *                             Share, Run With AI, ...)
 *       * Preset Groups      (Style, Camera & Lens, Lighting &
 *                             Mood, Composition, Color Palette)
 *       * My Combos          (user-saved photo combos)
 *       * Recent Combos      (auto-tracked recent photo combos)
 *       * Vault Prompts      (saved Vault prompts)
 *
 *   - Arrow keys navigate, Enter executes, Esc closes.
 *
 *   - Strictly additive: no backend / API / Stripe / Supabase /
 *     auth changes, no renamed IDs, no edits to existing
 *     handlers. Reduce-motion respected (no fade / slide
 *     transitions when the user prefers reduced motion).
 *
 *   - Escape hatches: `?nocmdk` query param, or
 *     `localStorage.pmg_cmdpalette_disable=1`, or the legacy
 *     `localStorage.pmg_disable=1` master kill switch.
 *
 *   - Test surface: `window.__pmgCommandPalette = { open,
 *     close, toggle, isOpen, _getCommands, _query }`.
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgCommandPaletteLoaded) return;
  window.__pmgCommandPaletteLoaded = true;

  /* Escape hatch — `?nocmdk` or localStorage flags. */
  try {
    if (
      /[?&]nocmdk\b/.test(location.search) ||
      localStorage.getItem('pmg_disable') === '1' ||
      localStorage.getItem('pmg_cmdpalette_disable') === '1'
    ) {
      try { console.info('[pmg-command-palette] disabled via escape hatch'); } catch (_) {}
      return;
    }
  } catch (_) {}

  var BACKDROP_ID = 'pmg-cmdk-backdrop';
  var PANEL_ID    = 'pmg-cmdk-panel';
  var INPUT_ID    = 'pmg-cmdk-input';
  var LIST_ID     = 'pmg-cmdk-list';
  var EMPTY_ID    = 'pmg-cmdk-empty';
  var STYLE_ID    = 'pmg-cmdk-styles';

  var IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');
  var MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';

  /* ---------------------- Styles ---------------------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + BACKDROP_ID + '{',
      '  position: fixed; inset: 0;',
      '  background: rgba(0,0,0,0.50);',
      '  z-index: 220;',  /* above shortcuts cheatsheet (200) */
      '  display: none;',
      '  align-items: flex-start;',
      '  justify-content: center;',
      '  padding: 10vh 16px 16px;',
      '  animation: pmgCmdkFadeIn 160ms ease;',
      '}',
      '#' + BACKDROP_ID + '.is-open{ display: flex; }',
      '@keyframes pmgCmdkFadeIn { from { opacity: 0; } to { opacity: 1; } }',

      '#' + PANEL_ID + '{',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-text, #1a1a1a);',
      '  border-radius: 14px;',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  width: 100%;',
      '  max-width: 600px;',
      '  max-height: min(70vh, 640px);',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  box-shadow: 0 24px 60px rgba(0,0,0,0.32);',
      '  animation: pmgCmdkSlideUp 180ms ease;',
      '}',
      '@keyframes pmgCmdkSlideUp {',
      '  from { opacity: 0; transform: translateY(8px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',

      '#' + PANEL_ID + ' .pmg-cmdk-input-wrap{',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 14px 16px;',
      '  border-bottom: 1px solid var(--color-border, #e5e7eb);',
      '}',
      '#' + PANEL_ID + ' .pmg-cmdk-input-icon{',
      '  font-size: 16px; color: var(--color-text-muted, #5f6b75);',
      '  flex-shrink: 0;',
      '}',
      '#' + INPUT_ID + '{',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '  border: none;',
      '  outline: none;',
      '  background: transparent;',
      '  color: var(--color-text, #1a1a1a);',
      '  font-size: 16px;',
      '  font-weight: 500;',
      '  font-family: inherit;',
      '  padding: 4px 0;',
      '}',
      '#' + INPUT_ID + '::placeholder{ color: var(--color-text-faint, #9aa3ad); }',
      '#' + PANEL_ID + ' .pmg-cmdk-hint{',
      '  display: inline-flex; gap: 4px; flex-shrink: 0;',
      '  font-size: 11px; color: var(--color-text-muted, #5f6b75);',
      '}',
      '#' + PANEL_ID + ' .pmg-cmdk-hint kbd{',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  min-width: 22px; height: 20px; padding: 0 5px;',
      '  background: var(--color-surface-2, #f1efea);',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  border-bottom-width: 2px;',
      '  border-radius: 4px;',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
      '  font-size: 10px; font-weight: 700; color: var(--color-text, #1a1a1a);',
      '}',

      '#' + LIST_ID + '{',
      '  flex: 1 1 auto;',
      '  overflow-y: auto;',
      '  padding: 6px 0 10px;',
      '  list-style: none; margin: 0;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-group-label{',
      '  font-size: 11px; font-weight: 700;',
      '  letter-spacing: 0.06em; text-transform: uppercase;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  padding: 10px 16px 4px;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-item{',
      '  display: flex; align-items: center; gap: 12px;',
      '  padding: 9px 16px;',
      '  cursor: pointer;',
      '  border-left: 3px solid transparent;',
      '  background: transparent;',
      '  color: var(--color-text, #1a1a1a);',
      '  user-select: none;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-item.is-active{',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 10%, transparent);',
      '  border-left-color: var(--color-primary, #0f6e6a);',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-item:hover{',
      '  background: var(--color-surface-2, #f5f7f7);',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-icon{',
      '  flex-shrink: 0;',
      '  width: 22px; text-align: center;',
      '  font-size: 16px;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-text{',
      '  flex: 1 1 auto; min-width: 0;',
      '  display: flex; flex-direction: column; gap: 1px;',
      '  overflow: hidden;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-title{',
      '  font-size: 14px; font-weight: 600;',
      '  color: var(--color-text, #1a1a1a);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-subtitle{',
      '  font-size: 12px; color: var(--color-text-muted, #5f6b75);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + LIST_ID + ' .pmg-cmdk-tag{',
      '  flex-shrink: 0;',
      '  font-size: 10px; font-weight: 700;',
      '  letter-spacing: 0.04em; text-transform: uppercase;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  background: var(--color-surface-2, #f1efea);',
      '  border: 1px solid var(--color-border, #e5e7eb);',
      '  border-radius: 999px;',
      '  padding: 2px 8px;',
      '}',

      '#' + EMPTY_ID + '{',
      '  display: none;',
      '  padding: 28px 16px;',
      '  text-align: center;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  font-size: 13px;',
      '}',
      '#' + EMPTY_ID + '.is-shown{ display: block; }',

      /* Footer with arrow / enter / esc hints */
      '#' + PANEL_ID + ' .pmg-cmdk-foot{',
      '  flex-shrink: 0;',
      '  border-top: 1px solid var(--color-border, #e5e7eb);',
      '  padding: 8px 14px;',
      '  display: flex; gap: 14px;',
      '  font-size: 11px; color: var(--color-text-muted, #5f6b75);',
      '  flex-wrap: wrap;',
      '}',
      '#' + PANEL_ID + ' .pmg-cmdk-foot kbd{',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  min-width: 18px; height: 18px; padding: 0 4px;',
      '  background: var(--color-surface-2, #f1efea);',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  border-radius: 3px;',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
      '  font-size: 10px; font-weight: 700; color: var(--color-text, #1a1a1a);',
      '  margin-right: 4px;',
      '}',

      /* Mobile: tighter spacing */
      '@media (max-width: 480px){',
      '  #' + BACKDROP_ID + '{ padding: 6vh 8px 8px; }',
      '  #' + PANEL_ID + '{ max-height: min(80vh, 640px); }',
      '  #' + PANEL_ID + ' .pmg-cmdk-foot{ display: none; }',
      '}',

      '@media (prefers-reduced-motion: reduce){',
      '  #' + BACKDROP_ID + '{ animation: none; }',
      '  #' + PANEL_ID + '{ animation: none; }',
      '}',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------------- Helpers ---------------------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isRendered(el) {
    if (!el) return false;
    if (el.disabled) return false;
    var cs = window.getComputedStyle(el);
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) { return false; }
  }

  function scrollIntoCenter(el) {
    if (!el) return;
    try {
      el.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    } catch (_) {
      try { el.scrollIntoView(); } catch (__) {}
    }
  }

  function clickIfVisible(el) {
    if (!isRendered(el)) return false;
    try { el.click(); return true; } catch (_) { return false; }
  }

  function findFirstVisible(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if (isRendered(nodes[i])) return nodes[i];
    }
    /* Fall back to the first node even if hidden — caller may
       still want to scroll-into-view + click it. */
    return nodes[0] || null;
  }

  /* ---------------------- Storage adapters ---------------------- */
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function loadVaultItems() {
    var arr = readJSON('promptmegood:history:v1');
    if (!Array.isArray(arr)) return [];
    return arr;
  }

  function loadSavedCombos() {
    var arr = readJSON('pmg.photo.savedCombos');
    if (!Array.isArray(arr)) return [];
    return arr;
  }

  function loadRecentCombos() {
    var arr = readJSON('pmg.photo.recentPresets');
    if (!Array.isArray(arr)) return [];
    return arr;
  }

  /* ---------------------- Action handlers ---------------------- */
  function actClick(selector) {
    return function () {
      var el = findFirstVisible(selector);
      if (!el) return false;
      scrollIntoCenter(el);
      return clickIfVisible(el);
    };
  }

  function actScrollToGroup(groupId) {
    return function () {
      var el = document.querySelector(
        '#pmg-photo-suite .pmg-photo-group[data-group="' + groupId + '"]'
      );
      if (!el) return false;
      /* Expand the group if collapsed, then scroll its head into view. */
      if (el.classList.contains('is-collapsed')) {
        var head = el.querySelector('.pmg-photo-group-head');
        if (head) try { head.click(); } catch (_) {}
      }
      var head2 = el.querySelector('.pmg-photo-group-head') || el;
      scrollIntoCenter(head2);
      try { head2.focus({ preventScroll: true }); } catch (_) {}
      return true;
    };
  }

  function actApplyRecentCombo(idx) {
    return function () {
      var sel = '.pmg-photo-recent-btn[data-recent-index="' + idx + '"]';
      var el = findFirstVisible(sel) || document.querySelector(sel);
      if (!el) return false;
      scrollIntoCenter(el);
      return clickIfVisible(el);
    };
  }

  function actApplySavedCombo(idx) {
    return function () {
      var sel = '.pmg-photo-saved-btn[data-saved-index="' + idx + '"]';
      var el = findFirstVisible(sel) || document.querySelector(sel);
      if (!el) return false;
      scrollIntoCenter(el);
      return clickIfVisible(el);
    };
  }

  function actRestoreVaultItem(id) {
    return function () {
      /* Step 1: switch to write mode if currently on image mode,
         since the vault and result box live in the write flow. */
      try {
        if (document.body && document.body.classList.contains('image-mode')) {
          if (typeof window.setMode === 'function') window.setMode('write');
        }
      } catch (_) {}

      /* Step 2: clear any active vault search/filter so the item
         becomes findable. */
      try {
        var search = document.getElementById('history-search');
        if (search && search.value) {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (_) {}

      /* Step 3: scroll the vault list into view. */
      var list = document.getElementById('history-list');
      if (list) scrollIntoCenter(list);

      /* Step 4: in the next tick (after re-render), find the
         matching card and click its Restore button. */
      function tryRestore(attempt) {
        var card = document.querySelector(
          '.history-item[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'
        );
        if (card) {
          var btn = card.querySelector('[data-history-action="restore"]');
          if (btn) {
            scrollIntoCenter(card);
            try { btn.click(); return true; } catch (_) {}
          }
        }
        if (attempt < 3) {
          setTimeout(function () { tryRestore(attempt + 1); }, 80);
        }
        return false;
      }
      setTimeout(function () { tryRestore(0); }, 0);
      return true;
    };
  }

  /* ---------------------- Mode switching ---------------------- */
  function currentMode() {
    /* Body class `image-mode` => image, otherwise treat as write
       (the default and the marketing-splash baseline state). */
    try {
      if (document.body && document.body.classList.contains('image-mode')) {
        return 'image';
      }
    } catch (_) {}
    return 'write';
  }

  function ensureMode(mode) {
    /* Returns true if we're already in `mode` (caller can run the
       inner action immediately), or kicks off a mode switch and
       returns false (caller should defer the inner action). */
    if (currentMode() === mode) return true;
    var id = mode === 'image' ? 'imageModeBtn' : 'writeModeBtn';
    var el = document.getElementById(id);
    if (el) { try { el.click(); return false; } catch (_) {} }
    if (typeof window.setMode === 'function') {
      try { window.setMode(mode); } catch (_) {}
    }
    return false;
  }

  function actSetMode(mode) {
    return function () {
      var id = mode === 'image' ? 'imageModeBtn' : 'writeModeBtn';
      var el = document.getElementById(id);
      if (el) { try { el.click(); return true; } catch (_) {} }
      /* Fallback to the global setMode() if the button is missing. */
      if (typeof window.setMode === 'function') {
        try { window.setMode(mode); return true; } catch (_) {}
      }
      return false;
    };
  }

  /* Wrap an action so it can run from ANY mode: if the caller is
     not currently in `mode`, switch first, wait for the workspace
     to render, then invoke the inner action with retries. This is
     what makes mode-scoped commands (e.g. image-only preset groups
     or write-only Improve With AI) globally discoverable from the
     palette per the task spec ("both modes" / "all five preset
     groups"). The inner action is the same `run` function the
     command would have used directly — no behavior changes when
     already in the right mode. */
  function actInMode(mode, innerRun) {
    return function () {
      if (ensureMode(mode)) {
        try { return innerRun() === true; } catch (_) { return false; }
      }
      /* Mode switch was kicked off — defer the inner action through
         a few rAF/timeout retries so the destination UI has time to
         mount. We bail after ~480ms total (6 attempts × 80ms) so a
         missing target doesn't loop forever. */
      var attempts = 0;
      function step() {
        attempts++;
        var ok = false;
        try { ok = innerRun() === true; } catch (_) {}
        if (ok) return;
        if (attempts < 6) setTimeout(step, 80);
      }
      setTimeout(step, 80);
      return true; /* dispatched */
    };
  }

  /* ---------------------- Cheatsheet opener ---------------------- */
  function actOpenShortcuts() {
    return function () {
      try {
        if (window.__pmgShortcuts && typeof window.__pmgShortcuts.open === 'function') {
          window.__pmgShortcuts.open();
          return true;
        }
      } catch (_) {}
      var trig = document.getElementById('pmg-shortcuts-trigger');
      return trig ? clickIfVisible(trig) : false;
    };
  }

  /* ---------------------- Build catalog ---------------------- */
  /* Visibility predicates so a command only appears when its
     target exists in the DOM. We never show stale entries. */
  function existsSel(selector) {
    return function () { return !!document.querySelector(selector); };
  }

  /* Stricter than existsSel: requires the element to actually be
     rendered (display, visibility, geometry) AND not disabled.
     Use this for any command whose run() will fail silently if
     the underlying button isn't on screen — covers mode-scoped
     actions (image-only, write-only) and ensures listed commands
     are reliably executable when chosen. */
  function renderedSel(selector) {
    return function () {
      var el = document.querySelector(selector);
      return !!(el && isRendered(el));
    };
  }

  /* Available "from any mode": the command is discoverable in the
     palette as long as either (a) the target is currently rendered
     or (b) the global setMode() API exists so we can switch modes
     and execute it via actInMode(). This satisfies the task's
     "across both modes / all preset groups" wording — users can
     find an Image-mode preset group while in Write mode and
     activating it just switches modes first. */
  function availableInMode(selector) {
    return function () {
      if (typeof window.setMode === 'function') return true;
      var el = document.querySelector(selector);
      return !!(el && isRendered(el));
    };
  }

  /* Static command catalog. Order within a group is meaningful:
     items render top-to-bottom in a group when no search query
     is active. Score-driven ordering takes over once the user
     starts typing. */
  function buildStaticCommands() {
    return [
      /* Modes */
      { id: 'mode-write', group: 'Modes', icon: '✍️',
        title: 'Switch To Write Mode',
        subtitle: 'Build a text prompt for any AI',
        keywords: ['write', 'text', 'mode', 'builder', 'prompt'],
        run: actSetMode('write'),
        /* Always available when the API surface exists. Even on
           the marketing splash before the workspace is mounted,
           setMode() expands the workspace and selects the mode —
           the palette is a first-class entry point. */
        visible: function () {
          if (typeof window.setMode === 'function') return true;
          var el = document.getElementById('writeModeBtn');
          return !!(el && isRendered(el));
        } },
      { id: 'mode-image', group: 'Modes', icon: '🎨',
        title: 'Switch To Image Mode',
        subtitle: 'Generate an AI image from a prompt',
        keywords: ['image', 'photo', 'picture', 'mode', 'generate', 'dalle'],
        run: actSetMode('image'),
        visible: function () {
          if (typeof window.setMode === 'function') return true;
          var el = document.getElementById('imageModeBtn');
          return !!(el && isRendered(el));
        } },

      /* Actions — mode-scoped commands are wrapped in actInMode()
         so users can discover and trigger them from any mode. The
         palette switches modes first if needed (no-op when already
         in the right one), then dispatches the inner action with a
         short retry window for the destination UI to mount. */
      { id: 'action-fix', group: 'Actions', icon: '✨',
        title: 'Fix My Prompt',
        subtitle: 'Run the prompt builder on your draft',
        keywords: ['fix', 'generate', 'prompt', 'build', 'run'],
        run: actInMode('write', actClick('#generateBtn')),
        visible: availableInMode('#generateBtn') },
      { id: 'action-image-generate', group: 'Actions', icon: '🎨',
        title: 'Generate Image',
        subtitle: 'Create an image with the current settings',
        keywords: ['image', 'generate', 'dalle', 'photo', 'create'],
        run: actInMode('image', actClick('#image-generate-btn')),
        visible: availableInMode('#image-generate-btn') },
      { id: 'action-improve', group: 'Actions', icon: '🪄',
        title: 'Improve With AI',
        subtitle: 'Polish your prompt with AI suggestions',
        keywords: ['improve', 'ai', 'polish', 'refine', 'tone'],
        run: actInMode('write', actClick('#improve-with-ai-btn')),
        visible: availableInMode('#improve-with-ai-btn') },
      { id: 'action-remix-detailed', group: 'Actions', icon: '📝',
        title: 'Make It More Detailed',
        subtitle: 'Add depth and specifics to the result',
        keywords: ['detailed', 'detail', 'longer', 'verbose', 'expand', 'remix'],
        run: actInMode('write', actClick('[data-remix="detailed"]')),
        visible: availableInMode('[data-remix="detailed"]') },
      { id: 'action-remix-bold', group: 'Actions', icon: '🔥',
        title: 'Make It More Bold & Direct',
        subtitle: 'Sharpen the tone and trim hedging',
        keywords: ['bold', 'direct', 'aggressive', 'sharp', 'remix'],
        run: actInMode('write', actClick('[data-remix="bold-direct"]')),
        visible: availableInMode('[data-remix="bold-direct"]') },
      { id: 'action-remix-beginner', group: 'Actions', icon: '🌱',
        title: 'Make It Beginner Friendly',
        subtitle: 'Simplify the language and structure',
        keywords: ['beginner', 'simple', 'easy', 'friendly', 'remix'],
        run: actInMode('write', actClick('[data-remix="beginner"]')),
        visible: availableInMode('[data-remix="beginner"]') },
      { id: 'action-surprise-photo', group: 'Actions', icon: '🎲',
        title: 'Surprise Me (Photo Suite)',
        subtitle: 'Roll a random photo combo',
        keywords: ['surprise', 'random', 'photo', 'roll', 'shuffle'],
        run: actInMode('image', actClick('.pmg-photo-surprise')),
        visible: availableInMode('.pmg-photo-surprise') },
      { id: 'action-surprise-text', group: 'Actions', icon: '🎲',
        title: 'Surprise Me (Text Builder)',
        subtitle: 'Get a random prompt idea',
        keywords: ['surprise', 'random', 'idea', 'text', 'roll', 'dice'],
        run: actInMode('write', actClick('#random-prompt')),
        visible: availableInMode('#random-prompt') },
      { id: 'action-save-combo', group: 'Actions', icon: '💾',
        title: 'Save This Combo',
        subtitle: 'Save the current photo selection as a named combo',
        keywords: ['save', 'combo', 'preset', 'photo'],
        run: actInMode('image', actClick('.pmg-photo-save-combo')),
        visible: availableInMode('.pmg-photo-save-combo') },
      { id: 'action-copy', group: 'Actions', icon: '📋',
        title: 'Copy Result',
        subtitle: 'Copy the generated prompt to clipboard',
        keywords: ['copy', 'clipboard', 'result'],
        run: actClick('#copy-btn'),
        visible: function () {
          var el = document.getElementById('copy-btn');
          return !!(el && isRendered(el));
        } },
      { id: 'action-share', group: 'Actions', icon: '🔗',
        title: 'Copy Shareable Link',
        subtitle: 'Share your prompt as a link',
        keywords: ['share', 'link', 'url', 'copy'],
        run: actClick('#share-btn'),
        visible: function () {
          var el = document.getElementById('share-btn');
          return !!(el && isRendered(el) && !el.hidden);
        } },
      { id: 'action-run-ai', group: 'Actions', icon: '🚀',
        title: 'Run With AI',
        subtitle: 'Test the prompt against a live model',
        keywords: ['run', 'ai', 'test', 'execute', 'try'],
        run: actClick('#runBtn'),
        visible: function () {
          var el = document.getElementById('runBtn');
          return !!(el && isRendered(el));
        } },
      { id: 'action-shortcuts', group: 'Actions', icon: '⌨️',
        title: 'Keyboard Shortcuts',
        subtitle: 'Open the shortcuts cheatsheet',
        keywords: ['shortcuts', 'keyboard', 'help', 'keys', 'cheatsheet'],
        run: actOpenShortcuts(),
        visible: function () {
          /* The cheatsheet trigger may be feature-gated or hidden
             on small viewports — gate on actual visibility, not
             just DOM existence, OR on the API surface being live
             (window.__pmgShortcuts.open) so a programmatic open
             still works even if the trigger is offscreen. */
          var hasApi = !!(window.__pmgShortcuts &&
            typeof window.__pmgShortcuts.open === 'function');
          if (hasApi) return true;
          var el = document.getElementById('pmg-shortcuts-trigger');
          return !!(el && isRendered(el));
        } },

      /* Preset Groups — discoverable from any mode per the task
         spec. Selecting a group from Write mode triggers a switch
         to Image mode first, then scrolls/expands the destination
         group via the inner action. */
      { id: 'group-style', group: 'Preset Groups', icon: '🎨',
        title: 'Style Group',
        subtitle: 'Cinematic, Portrait, Editorial, ...',
        keywords: ['style', 'cinematic', 'portrait', 'editorial', 'documentary',
                   'fashion', 'landscape', 'vintage', 'preset', 'group'],
        run: actInMode('image', actScrollToGroup('style')),
        visible: availableInMode('#pmg-photo-suite .pmg-photo-group[data-group="style"]') },
      { id: 'group-camera', group: 'Preset Groups', icon: '📷',
        title: 'Camera & Lens Group',
        subtitle: '85mm Portrait, 35mm Wide, Macro, ...',
        keywords: ['camera', 'lens', '85mm', '35mm', 'macro', 'telephoto',
                   'fisheye', 'dslr', 'preset', 'group'],
        run: actInMode('image', actScrollToGroup('camera')),
        visible: availableInMode('#pmg-photo-suite .pmg-photo-group[data-group="camera"]') },
      { id: 'group-lighting', group: 'Preset Groups', icon: '💡',
        title: 'Lighting & Mood Group',
        subtitle: 'Golden Hour, Studio Softbox, Neon Glow, ...',
        keywords: ['lighting', 'mood', 'golden', 'hour', 'studio', 'neon',
                   'shadows', 'softbox', 'preset', 'group'],
        run: actInMode('image', actScrollToGroup('lighting')),
        visible: availableInMode('#pmg-photo-suite .pmg-photo-group[data-group="lighting"]') },
      { id: 'group-composition', group: 'Preset Groups', icon: '🖼️',
        title: 'Composition Group',
        subtitle: 'Rule Of Thirds, Centered, Wide Shot, ...',
        keywords: ['composition', 'thirds', 'centered', 'symmetrical',
                   'wide', 'closeup', 'preset', 'group'],
        run: actInMode('image', actScrollToGroup('composition')),
        visible: availableInMode('#pmg-photo-suite .pmg-photo-group[data-group="composition"]') },
      { id: 'group-palette', group: 'Preset Groups', icon: '🎨',
        title: 'Color Palette Group',
        subtitle: 'Warm Tones, Cool Blues, Monochrome, ...',
        keywords: ['palette', 'color', 'warm', 'cool', 'monochrome',
                   'pastel', 'sepia', 'preset', 'group'],
        run: actInMode('image', actScrollToGroup('palette')),
        visible: availableInMode('#pmg-photo-suite .pmg-photo-group[data-group="palette"]') }
    ];
  }

  /* Dynamic command sources — refreshed each time the palette
     opens so they reflect the latest localStorage state. */
  function buildDynamicCommands() {
    var out = [];

    /* My Combos. Discoverable from any mode — the run() wrapper
       switches to image mode first (where the Photo Suite lives)
       and retries clicking the matching `.pmg-photo-saved-btn`
       through the actInMode() retry window. The visibility
       predicate keeps the entry listed as long as either (a) the
       button is currently rendered, or (b) we have a setMode API
       to switch into image mode. */
    var saved = loadSavedCombos();
    saved.forEach(function (combo, i) {
      if (!combo) return;
      var name = (typeof combo.name === 'string') ? combo.name : '';
      if (!name) return;
      out.push({
        id: 'saved-combo-' + i,
        group: 'My Combos',
        icon: '💾',
        title: name,
        subtitle: 'Apply your saved combo',
        keywords: ['combo', 'saved', 'mine', 'preset'],
        run: actInMode('image', actApplySavedCombo(i)),
        visible: (function (idx) {
          return function () {
            if (typeof window.setMode === 'function') return true;
            var btn = document.querySelector(
              '.pmg-photo-saved-btn[data-saved-index="' + idx + '"]');
            return !!(btn && isRendered(btn));
          };
        })(i)
      });
    });

    /* Recent Combos. Same cross-mode availability as My Combos —
       discoverable globally, executed in image mode after a
       short retry window. */
    var recent = loadRecentCombos();
    recent.forEach(function (combo, i) {
      if (!combo) return;
      out.push({
        id: 'recent-combo-' + i,
        group: 'Recent Combos',
        icon: '🕒',
        title: 'Recent Combo #' + (i + 1),
        subtitle: 'Re-apply a recent photo combo',
        keywords: ['recent', 'combo', 'photo', 'reuse'],
        run: actInMode('image', actApplyRecentCombo(i)),
        visible: (function (idx) {
          return function () {
            if (typeof window.setMode === 'function') return true;
            var btn = document.querySelector(
              '.pmg-photo-recent-btn[data-recent-index="' + idx + '"]');
            return !!(btn && isRendered(btn));
          };
        })(i)
      });
    });

    /* Vault Prompts. */
    var vault = loadVaultItems();
    /* Cap at a sane number to keep the list responsive. The
       palette is meant for quick navigation — power users can
       still narrow with the search box. */
    var VAULT_LIMIT = 100;
    var sliced = vault.slice(0, VAULT_LIMIT);
    sliced.forEach(function (item) {
      if (!item || !item.id) return;
      var promptText = String(item.prompt || '').trim();
      var nickname = String(item.nickname || '').trim();
      var goalText = item.data && item.data.goal ? String(item.data.goal).trim() : '';
      var title = nickname || goalText || (promptText ? promptText.slice(0, 60) : 'Saved prompt');
      var subtitle = promptText ? promptText.slice(0, 90) : 'Saved Vault prompt';
      if (promptText.length > 90) subtitle += '…';
      var tags = Array.isArray(item.tags) ? item.tags : [];
      out.push({
        id: 'vault-' + item.id,
        group: 'Vault',
        icon: item.favorite ? '⭐' : '📝',
        title: title,
        subtitle: subtitle,
        keywords: tags.concat(['vault', 'saved', 'history', 'prompt']),
        run: actRestoreVaultItem(item.id)
      });
    });

    return out;
  }

  function buildAllCommands() {
    function keepVisible(c) {
      try { return typeof c.visible !== 'function' || c.visible(); }
      catch (_) { return false; }
    }
    var staticCmds = buildStaticCommands().filter(keepVisible);
    var dynCmds = buildDynamicCommands().filter(keepVisible);
    return staticCmds.concat(dynCmds);
  }

  /* ---------------------- Fuzzy scoring ----------------------
   * Each command has a search blob = title + subtitle + group +
   * keywords. We score against a normalized query:
   *
   *   - Exact substring: high score, prefix bonus
   *   - Subsequence match (chars in order): per-char score with
   *     bonus for consecutive runs and word-boundary starts
   *   - No match: dropped
   *
   * No external dependency. Good enough for ~hundreds of items.
   * ----------------------------------------------------------- */
  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase();
  }

  function blobOf(cmd) {
    var parts = [cmd.title || '', cmd.subtitle || '', cmd.group || ''];
    if (Array.isArray(cmd.keywords)) parts = parts.concat(cmd.keywords);
    return normalize(parts.join(' '));
  }

  function fuzzyScore(query, cmd) {
    var q = normalize(query);
    if (!q) return 0;
    var title = normalize(cmd.title || '');
    var blob  = blobOf(cmd);

    /* Exact substring matches dominate. */
    var titleIdx = title.indexOf(q);
    if (titleIdx === 0) return 1000 - q.length;       /* title prefix */
    if (titleIdx > 0)   return 700 - titleIdx;         /* title contains */
    var blobIdx = blob.indexOf(q);
    if (blobIdx >= 0)   return 500 - Math.min(blobIdx, 200);

    /* Subsequence — every char of q in order in blob. */
    var qi = 0;
    var lastMatch = -1;
    var consecutive = 0;
    var bestRun = 0;
    var boundaryHits = 0;
    var matched = 0;
    for (var i = 0; i < blob.length && qi < q.length; i++) {
      var c = blob.charAt(i);
      if (c === q.charAt(qi)) {
        matched++;
        if (i === lastMatch + 1) {
          consecutive++;
          if (consecutive > bestRun) bestRun = consecutive;
        } else {
          consecutive = 1;
          if (bestRun === 0) bestRun = 1;
        }
        if (i === 0 || /\s/.test(blob.charAt(i - 1))) boundaryHits++;
        lastMatch = i;
        qi++;
      }
    }
    if (qi < q.length) return -1; /* not all chars matched */
    var score = 200 + matched * 4 + bestRun * 10 + boundaryHits * 6;
    /* Light penalty for very long blobs so short matches win. */
    score -= Math.min(blob.length, 400) / 8;
    return score;
  }

  function searchCommands(commands, query) {
    if (!query) return commands.slice();
    var scored = [];
    for (var i = 0; i < commands.length; i++) {
      var sc = fuzzyScore(query, commands[i]);
      if (sc > 0) scored.push({ cmd: commands[i], score: sc, idx: i });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx;
    });
    return scored.map(function (s) { return s.cmd; });
  }

  /* ---------------------- DOM build ---------------------- */
  function ensureDom() {
    if (document.getElementById(BACKDROP_ID)) return;

    var backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute('role', 'presentation');

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Command Palette');

    var html = [];
    html.push('<div class="pmg-cmdk-input-wrap">');
    html.push('  <span class="pmg-cmdk-input-icon" aria-hidden="true">🔎</span>');
    html.push('  <input id="' + INPUT_ID + '" type="text" autocomplete="off" ' +
              'spellcheck="false" placeholder="Type a command, prompt, or preset…" ' +
              'aria-label="Search commands" aria-controls="' + LIST_ID + '" ' +
              'aria-autocomplete="list" />');
    html.push('  <span class="pmg-cmdk-hint" aria-hidden="true"><kbd>' +
              escapeHtml(MOD_LABEL) + '</kbd><kbd>K</kbd></span>');
    html.push('</div>');
    html.push('<ul id="' + LIST_ID + '" role="listbox" aria-label="Commands"></ul>');
    html.push('<div id="' + EMPTY_ID + '">No matching commands. Try a different search.</div>');
    html.push('<div class="pmg-cmdk-foot">');
    html.push('  <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>');
    html.push('  <span><kbd>↵</kbd> Run</span>');
    html.push('  <span><kbd>Esc</kbd> Close</span>');
    html.push('</div>');

    panel.innerHTML = html.join('\n');
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    /* Wire input + delegated list click + backdrop click. */
    var input = panel.querySelector('#' + INPUT_ID);
    if (input) {
      input.addEventListener('input', function () {
        currentQuery = input.value || '';
        renderResults();
      });
      input.addEventListener('keydown', onInputKeydown);
    }
    var list = panel.querySelector('#' + LIST_ID);
    if (list) {
      list.addEventListener('click', function (ev) {
        var li = ev.target && ev.target.closest ? ev.target.closest('.pmg-cmdk-item') : null;
        if (!li) return;
        var idx = parseInt(li.getAttribute('data-result-index'), 10);
        if (!isNaN(idx)) executeAtIndex(idx);
      });
      list.addEventListener('mouseover', function (ev) {
        var li = ev.target && ev.target.closest ? ev.target.closest('.pmg-cmdk-item') : null;
        if (!li) return;
        var idx = parseInt(li.getAttribute('data-result-index'), 10);
        if (!isNaN(idx)) setActiveIndex(idx, /*scroll=*/false);
      });
    }
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) closePalette();
    });
  }

  /* ---------------------- Render ---------------------- */
  var allCommands = [];
  var currentResults = [];
  var activeIndex = 0;
  var currentQuery = '';
  var lastFocus = null;

  function renderResults() {
    var list = document.getElementById(LIST_ID);
    var empty = document.getElementById(EMPTY_ID);
    if (!list || !empty) return;
    currentResults = searchCommands(allCommands, currentQuery);

    if (!currentResults.length) {
      list.innerHTML = '';
      empty.classList.add('is-shown');
      activeIndex = -1;
      return;
    }
    empty.classList.remove('is-shown');

    var html = [];
    var lastGroup = null;
    var showGroups = !currentQuery; /* group headers only when not searching */

    for (var i = 0; i < currentResults.length; i++) {
      var c = currentResults[i];
      if (showGroups && c.group !== lastGroup) {
        lastGroup = c.group;
        html.push('<li class="pmg-cmdk-group-label" role="presentation">' +
                  escapeHtml(c.group) + '</li>');
      }
      html.push(
        '<li class="pmg-cmdk-item" role="option" data-result-index="' + i + '" ' +
          'id="pmg-cmdk-result-' + i + '">' +
          '<span class="pmg-cmdk-icon" aria-hidden="true">' + escapeHtml(c.icon || '•') + '</span>' +
          '<span class="pmg-cmdk-text">' +
            '<span class="pmg-cmdk-title">' + escapeHtml(c.title || '') + '</span>' +
            (c.subtitle ? '<span class="pmg-cmdk-subtitle">' + escapeHtml(c.subtitle) + '</span>' : '') +
          '</span>' +
          (currentQuery ? '<span class="pmg-cmdk-tag">' + escapeHtml(c.group || '') + '</span>' : '') +
        '</li>'
      );
    }
    list.innerHTML = html.join('');
    setActiveIndex(0, /*scroll=*/true);
  }

  function setActiveIndex(idx, scroll) {
    if (!currentResults.length) { activeIndex = -1; return; }
    if (idx < 0) idx = 0;
    if (idx >= currentResults.length) idx = currentResults.length - 1;
    activeIndex = idx;
    var list = document.getElementById(LIST_ID);
    if (!list) return;
    var items = list.querySelectorAll('.pmg-cmdk-item');
    for (var i = 0; i < items.length; i++) {
      if (i === idx) items[i].classList.add('is-active');
      else items[i].classList.remove('is-active');
    }
    var input = document.getElementById(INPUT_ID);
    if (input) input.setAttribute('aria-activedescendant', 'pmg-cmdk-result-' + idx);
    if (scroll && items[idx]) {
      try { items[idx].scrollIntoView({ block: 'nearest' }); } catch (_) {}
    }
  }

  function executeAtIndex(idx) {
    if (idx < 0 || idx >= currentResults.length) return;
    var cmd = currentResults[idx];
    if (!cmd || typeof cmd.run !== 'function') return;
    /* Close the palette FIRST so the action sees its real
       focus target / scroll position / visibility, not the
       overlay state. */
    closePalette();
    /* Run on the next tick so the close animation / focus
       restoration completes first. */
    setTimeout(function () {
      try { cmd.run(); } catch (e) {
        try { console.warn('[pmg-command-palette] command failed:', cmd.id, e); } catch (_) {}
      }
    }, 0);
  }

  /* ---------------------- Open / close ---------------------- */
  function isPaletteOpen() {
    var b = document.getElementById(BACKDROP_ID);
    return !!(b && b.classList.contains('is-open'));
  }

  function openPalette() {
    ensureDom();
    var b = document.getElementById(BACKDROP_ID);
    var input = document.getElementById(INPUT_ID);
    if (!b || !input) return;
    lastFocus = document.activeElement;
    /* Refresh the catalog every open so dynamic sources (vault,
       combos, current visibility of action buttons) are fresh. */
    allCommands = buildAllCommands();
    currentQuery = '';
    input.value = '';
    renderResults();
    b.classList.add('is-open');
    /* Focus the input on next frame so the browser doesn't
       race the display:flex transition. */
    requestAnimationFrame(function () {
      try { input.focus({ preventScroll: true }); }
      catch (_) { try { input.focus(); } catch (__) {} }
      try { input.select(); } catch (_) {}
    });
  }

  function closePalette() {
    var b = document.getElementById(BACKDROP_ID);
    if (!b) return;
    b.classList.remove('is-open');
    /* Restore focus to whatever opened the palette so keyboard
       users return to a sane spot. */
    try {
      if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
        lastFocus.focus({ preventScroll: true });
      }
    } catch (_) {}
    lastFocus = null;
  }

  function togglePalette() {
    if (isPaletteOpen()) closePalette(); else openPalette();
  }

  /* ---------------------- Keyboard handlers ---------------------- */
  function onInputKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(activeIndex + 1, true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(activeIndex - 1, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(currentResults.length - 1, true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeAtIndex(activeIndex);
    }
  }

  /* Tab focus trap: in this palette the only focusable element
     inside the dialog is the search input. Wrap Tab/Shift+Tab
     back to the input so focus cannot escape the modal. */
  function trapTab(e) {
    var input = document.getElementById(INPUT_ID);
    if (!input) return;
    e.preventDefault();
    try { input.focus(); } catch (_) {}
  }

  function onGlobalKeydown(e) {
    /* ⌘K / Ctrl+K — toggle. We handle this even when the user
       is typing in another input because the palette is the
       documented escape hatch from focused fields. We also
       suppress the browser's default focus-on-omnibar behavior
       for Ctrl+K in Chrome / Firefox. */
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      var k = (e.key || '').toLowerCase();
      if (k === 'k') {
        /* Ignore key-repeat: holding ⌘/Ctrl+K shouldn't rapidly
           toggle the palette open/close. Only the initial press
           registers; releasing and pressing again is required. */
        if (e.repeat) { e.preventDefault(); return; }
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }
    }

    if (!isPaletteOpen()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePalette();
      return;
    }

    if (e.key === 'Tab') {
      trapTab(e);
      return;
    }

    /* Forward arrow/enter when focus has somehow drifted off
       the input (e.g. user clicked the panel chrome). */
    var input = document.getElementById(INPUT_ID);
    if (input && document.activeElement !== input) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End'].indexOf(e.key) !== -1) {
        e.preventDefault();
        try { input.focus(); } catch (_) {}
        onInputKeydown(e);
      }
    }
  }

  /* ---------------------- Init ---------------------- */
  function init() {
    injectStyles();
    /* Build the panel lazily on first open to keep initial DOM
       light. The keydown listener still works without it. */
    document.addEventListener('keydown', onGlobalKeydown, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* ---------------------- Public API (debug / tests) ---------------------- */
  window.__pmgCommandPalette = {
    open: openPalette,
    close: closePalette,
    toggle: togglePalette,
    isOpen: isPaletteOpen,
    /* Test-only: snapshot of the catalog WITHOUT executing run(). */
    _getCommands: function () {
      return buildAllCommands().map(function (c) {
        return {
          id: c.id, group: c.group, title: c.title,
          subtitle: c.subtitle, icon: c.icon,
          keywords: (c.keywords || []).slice()
        };
      });
    },
    /* Test-only: run a query against the current catalog. */
    _query: function (q) {
      var cmds = buildAllCommands();
      return searchCommands(cmds, q || '').map(function (c) {
        return { id: c.id, group: c.group, title: c.title };
      });
    }
  };
})();
