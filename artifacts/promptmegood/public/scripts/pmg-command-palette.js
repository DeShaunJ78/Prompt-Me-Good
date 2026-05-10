/* =====================================================================
 * pmg-command-palette.js — Global ⌘K / Ctrl+K command palette (cmd-1)
 * ---------------------------------------------------------------------
 * Centered overlay with fuzzy search across:
 *  - Panel switches (Text / Photography / Video) via pmgChassisV3.setActivePanel
 *  - Business Mode drawer toggle via pmgBusinessMode.open
 *  - Tour replays (intro, workstation)
 *  - Vault entries (read from localStorage 'promptmegood:history:v1')
 *  - Common actions (Start Over, Open Keyboard Shortcuts, Toggle Voice
 *    language picker focus)
 *
 * Keys: ⌘K / Ctrl+K to open or focus, Esc to close, ↑↓ to navigate,
 * Enter to execute, ⇥ to cycle. Closes on outside-click.
 *
 * Disable: ?nopalette, localStorage.pmg_palette_disable='1'.
 * ===================================================================== */
(function pmgCommandPalette() {
  'use strict';
  if (window.__pmgPaletteInit) return;
  window.__pmgPaletteInit = true;

  try {
    if (location.search.indexOf('nopalette') !== -1) return;
    if (localStorage.getItem('pmg_palette_disable') === '1') return;
  } catch (e) {}

  var STYLE_ID = 'pmg-palette-styles';
  var ROOT_ID = 'pmg-cmd-palette';
  var HISTORY_KEY = 'promptmegood:history:v1';
  var MAX_VAULT = 20;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + ROOT_ID + ' {',
      '  position: fixed; inset: 0; z-index: 250;',
      '  display: none; align-items: flex-start; justify-content: center;',
      '  padding: 10vh 16px 16px;',
      '  background: rgba(0, 0, 0, 0.55);',
      '  backdrop-filter: blur(2px);',
      '}',
      '#' + ROOT_ID + '.is-open { display: flex; }',
      '#' + ROOT_ID + ' .pmg-pal-card {',
      '  width: 100%; max-width: 600px;',
      '  background: var(--color-surface, #0f1d22);',
      '  border: 1px solid var(--color-border, rgba(91,168,176,0.3));',
      '  border-radius: var(--radius-lg, 12px);',
      '  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);',
      '  display: flex; flex-direction: column; overflow: hidden;',
      '  animation: pmg-pal-in 0.16s ease-out both;',
      '}',
      '@keyframes pmg-pal-in {',
      '  from { transform: translateY(-12px); opacity: 0; }',
      '  to   { transform: translateY(0); opacity: 1; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + ROOT_ID + ' .pmg-pal-card { animation: none; }',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-search {',
      '  width: 100%; padding: 16px 20px;',
      '  background: transparent; color: var(--color-text, #e8eef2);',
      '  border: 0; outline: 0; font-size: 16px;',
      '  border-bottom: 1px solid var(--color-border, rgba(91,168,176,0.2));',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-search::placeholder { color: var(--color-text-muted, #98a8b0); }',
      '#' + ROOT_ID + ' .pmg-pal-list {',
      '  list-style: none; margin: 0; padding: 6px;',
      '  max-height: min(60vh, 480px); overflow-y: auto;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-list li {',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 10px 14px; border-radius: var(--radius-sm, 6px);',
      '  cursor: pointer; color: var(--color-text, #e8eef2);',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-list li[aria-selected="true"],',
      '#' + ROOT_ID + ' .pmg-pal-list li:hover {',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 14%, transparent);',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-icon {',
      '  width: 28px; flex: 0 0 28px; text-align: center; opacity: 0.85;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-main {',
      '  flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-title {',
      '  font-weight: 600; font-size: 14px;',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-sub {',
      '  font-size: 12px; color: var(--color-text-muted, #98a8b0);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-cat {',
      '  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;',
      '  color: var(--color-text-muted, #98a8b0); padding: 8px 14px 4px;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-empty {',
      '  padding: 24px 16px; text-align: center;',
      '  color: var(--color-text-muted, #98a8b0); font-size: 14px;',
      '}',
      '#' + ROOT_ID + ' .pmg-pal-foot {',
      '  display: flex; gap: 14px; padding: 8px 14px;',
      '  border-top: 1px solid var(--color-border, rgba(91,168,176,0.18));',
      '  font-size: 11px; color: var(--color-text-muted, #98a8b0);',
      '}',
      '#' + ROOT_ID + ' kbd {',
      '  font-family: ui-monospace, monospace; font-size: 10.5px;',
      '  padding: 1px 5px; border-radius: 4px;',
      '  background: rgba(255,255,255,0.06);',
      '  border: 1px solid rgba(255,255,255,0.12);',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function isMac() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
  }

  function loadVault() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (e) { return e && typeof e === 'object'; }).slice(0, MAX_VAULT);
    } catch (e) { return []; }
  }

  function vaultLabel(entry) {
    if (!entry || typeof entry !== 'object') return 'Saved Prompt';
    var d = (entry.data && typeof entry.data === 'object') ? entry.data : null;
    var goal = (d && (d.goal || d.idea)) || entry.goal || '';
    var prompt = (d && (d.prompt || d.refined)) || entry.prompt || '';
    var label = goal || prompt || 'Saved Prompt';
    try { return String(label).slice(0, 90); } catch (e) { return 'Saved Prompt'; }
  }

  function setActivePanelSafe(name) {
    try { window.pmgChassisV3 && window.pmgChassisV3.setActivePanel(name); } catch (e) {}
  }

  function buildEntries() {
    var entries = [
      { id: 'panel-text',  cat: 'Navigate', icon: '✍️', title: 'Open Text Panel',         sub: 'Build a writing prompt',           run: function () { setActivePanelSafe('text'); } },
      { id: 'panel-photo', cat: 'Navigate', icon: '📷', title: 'Open Photography Panel',  sub: 'Build an image prompt',            run: function () { setActivePanelSafe('photography'); } },
      { id: 'panel-video', cat: 'Navigate', icon: '🎬', title: 'Open Video Panel',        sub: 'Build a video / Sora prompt',      run: function () { setActivePanelSafe('video'); } },
      { id: 'business',    cat: 'Navigate', icon: '💼', title: 'Open Business Mode',      sub: 'Brand voice, social packs, builders', run: function () { try { window.pmgBusinessMode && window.pmgBusinessMode.open(); } catch (e) {} } },
      { id: 'shortcuts',   cat: 'Help',     icon: '⌨️', title: 'Keyboard Shortcuts',      sub: 'Show all shortcuts',               run: function () { try { window.pmgCheatsheet && window.pmgCheatsheet.open(); } catch (e) {} } },
      { id: 'tour-intro',  cat: 'Tours',    icon: '🚀', title: 'Replay Intro Tour',       sub: 'Walk through the basics',          run: function () {
          try { localStorage.removeItem('pmg.workstationTourSeen'); } catch (e) {}
          var btn = document.querySelector('[data-tour="intro"]');
          if (btn) btn.click();
        } },
      { id: 'tour-work',   cat: 'Tours',    icon: '🧭', title: 'Replay Workstation Tour', sub: 'Tour the workstation panels',      run: function () {
          try { localStorage.removeItem('pmg.workstationTourSeen'); } catch (e) {}
          var btn = document.querySelector('[data-tour="workstation"]');
          if (btn) btn.click();
        } },
      { id: 'start-over',  cat: 'Actions',  icon: '🔄', title: 'Start Over',              sub: 'Clear current prompt + tuning',    run: function () { try { window.pmgChassisV3 && window.pmgChassisV3.startOver && window.pmgChassisV3.startOver(); } catch (e) {} } },
      { id: 'copy-result', cat: 'Actions',  icon: '📋', title: 'Copy Last Result',        sub: 'Copy the latest generated prompt', run: function () {
          var btn = document.getElementById('copy-btn') || document.getElementById('pmg-vs-image-copy') || document.getElementById('pmg-vs-video-copy');
          if (btn) btn.click();
        } }
    ];

    var vault = loadVault();
    vault.forEach(function (entry, idx) {
      entries.push({
        id: 'vault-' + (entry.id || idx),
        cat: 'Vault',
        icon: '🗂️',
        title: vaultLabel(entry),
        sub: 'From your Prompt Vault',
        run: function () {
          var openVault = document.querySelector('[data-pmg-open-vault], #vault-toggle, .pmg-vault-toggle');
          if (openVault) openVault.click();
        }
      });
    });

    return entries;
  }

  function score(entry, q) {
    if (!q) return 1;
    var hay = (entry.title + ' ' + entry.cat + ' ' + (entry.sub || '')).toLowerCase();
    var ql = q.toLowerCase();
    if (hay.indexOf(ql) !== -1) return 100 - hay.indexOf(ql);
    var i = 0, h = 0, hits = 0;
    while (i < ql.length && h < hay.length) {
      if (ql[i] === hay[h]) { hits++; i++; }
      h++;
    }
    return i === ql.length ? hits : 0;
  }

  function build() {
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Command palette');
    root.setAttribute('data-pmg-overlay-root', '');
    root.innerHTML = [
      '<div class="pmg-pal-card" role="presentation">',
      '  <input class="pmg-pal-search" type="text" autocomplete="off" spellcheck="false"',
      '         placeholder="Type a command or search…" aria-label="Search commands" />',
      '  <ul class="pmg-pal-list" role="listbox"></ul>',
      '  <div class="pmg-pal-foot">',
      '    <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>',
      '    <span><kbd>↵</kbd> Open</span>',
      '    <span><kbd>Esc</kbd> Close</span>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);
    return root;
  }

  var rootEl = null, inputEl = null, listEl = null;
  var entries = [], filtered = [], cursor = 0;

  function render(q) {
    filtered = entries.map(function (e) { return { e: e, s: score(e, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) {
        if (a.e.cat !== b.e.cat) {
          var order = ['Navigate', 'Actions', 'Tours', 'Help', 'Vault'];
          return order.indexOf(a.e.cat) - order.indexOf(b.e.cat);
        }
        return b.s - a.s;
      })
      .map(function (x) { return x.e; });

    listEl.innerHTML = '';
    if (!filtered.length) {
      var empty = document.createElement('li');
      empty.className = 'pmg-pal-empty';
      empty.textContent = 'No commands match.';
      empty.setAttribute('aria-disabled', 'true');
      listEl.appendChild(empty);
      return;
    }

    var lastCat = null;
    filtered.forEach(function (e, i) {
      if (e.cat !== lastCat) {
        var head = document.createElement('li');
        head.className = 'pmg-pal-cat';
        head.setAttribute('aria-hidden', 'true');
        head.textContent = e.cat;
        listEl.appendChild(head);
        lastCat = e.cat;
      }
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.idx = String(i);
      li.innerHTML = [
        '<span class="pmg-pal-icon" aria-hidden="true">', e.icon || '•', '</span>',
        '<span class="pmg-pal-main">',
          '<span class="pmg-pal-title"></span>',
          '<span class="pmg-pal-sub"></span>',
        '</span>'
      ].join('');
      li.querySelector('.pmg-pal-title').textContent = e.title;
      li.querySelector('.pmg-pal-sub').textContent = e.sub || '';
      li.addEventListener('mouseenter', function () { setCursor(i); });
      li.addEventListener('click', function () { execute(i); });
      listEl.appendChild(li);
    });

    if (cursor >= filtered.length) cursor = 0;
    paintCursor();
  }

  function paintCursor() {
    var nodes = listEl.querySelectorAll('li[role="option"]');
    nodes.forEach(function (n, i) {
      if (i === cursor) {
        n.setAttribute('aria-selected', 'true');
        try { n.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      } else {
        n.removeAttribute('aria-selected');
      }
    });
  }

  function setCursor(i) {
    var max = filtered.length;
    if (!max) return;
    cursor = ((i % max) + max) % max;
    paintCursor();
  }

  function execute(i) {
    var item = filtered[i];
    if (!item) return;
    close();
    setTimeout(function () {
      try { item.run(); } catch (e) {}
    }, 30);
  }

  function open() {
    if (!rootEl) {
      rootEl = build();
      inputEl = rootEl.querySelector('.pmg-pal-search');
      listEl = rootEl.querySelector('.pmg-pal-list');
      inputEl.addEventListener('input', function () { cursor = 0; render(inputEl.value.trim()); });
      inputEl.addEventListener('keydown', onKey);
      rootEl.addEventListener('click', function (ev) {
        if (ev.target === rootEl) close();
      });
    }
    entries = buildEntries();
    cursor = 0;
    inputEl.value = '';
    render('');
    rootEl.classList.add('is-open');
    setTimeout(function () { try { inputEl.focus(); } catch (e) {} }, 0);
  }

  function close() {
    if (rootEl) rootEl.classList.remove('is-open');
  }

  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setCursor(cursor + 1); return; }
    if (ev.key === 'ArrowUp')   { ev.preventDefault(); setCursor(cursor - 1); return; }
    if (ev.key === 'Enter')     { ev.preventDefault(); execute(cursor); return; }
  }

  function isOpen() {
    return !!(rootEl && rootEl.classList.contains('is-open'));
  }

  function toggle() {
    if (isOpen()) close(); else open();
  }

  function isInTextField(el) {
    if (!el) return false;
    var t = (el.tagName || '').toLowerCase();
    if (t === 'input' || t === 'textarea' || t === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener('keydown', function (ev) {
    var meta = isMac() ? ev.metaKey : ev.ctrlKey;
    if (meta && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      toggle();
      return;
    }
    if (!isOpen() && (ev.key === '?' || (ev.shiftKey && ev.key === '/')) && !isInTextField(ev.target)) {
      ev.preventDefault();
      try { window.pmgCheatsheet && window.pmgCheatsheet.open(); } catch (e) {}
    }
  });

  function init() { injectStyles(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.pmgCommandPalette = { open: open, close: close, toggle: toggle, isOpen: isOpen };
})();
