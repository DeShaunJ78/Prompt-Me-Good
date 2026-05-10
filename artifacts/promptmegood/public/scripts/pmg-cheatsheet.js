/* =====================================================================
 * pmg-cheatsheet.js — Keyboard shortcuts cheatsheet (cs-1)
 * ---------------------------------------------------------------------
 * Modal listing all keyboard shortcuts grouped by area. Opened via:
 *   - the `?` key (Shift + /) outside text fields
 *   - the command palette → "Keyboard Shortcuts"
 *   - window.pmgCheatsheet.open()
 *
 * Closes on Esc, backdrop click, or the × button.
 * Carries data-pmg-overlay-root so chassis universal-hide doesn't erase it.
 *
 * Disable: ?nocheatsheet, localStorage.pmg_cheatsheet_disable='1'.
 * ===================================================================== */
(function pmgCheatsheet() {
  'use strict';
  if (window.__pmgCheatsheetInit) return;
  window.__pmgCheatsheetInit = true;

  try {
    if (location.search.indexOf('nocheatsheet') !== -1) return;
    if (localStorage.getItem('pmg_cheatsheet_disable') === '1') return;
  } catch (e) {}

  var STYLE_ID = 'pmg-cheatsheet-styles';
  var ROOT_ID = 'pmg-cheatsheet';

  function isMac() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
  }
  var MOD = isMac() ? '⌘' : 'Ctrl';

  var GROUPS = [
    { name: 'Global', items: [
      { keys: [MOD + ' K'], desc: 'Open Command Palette' },
      { keys: ['?'],        desc: 'Open This Cheatsheet' },
      { keys: ['Esc'],      desc: 'Close Modal Or Dropdown' }
    ]},
    { name: 'Builder', items: [
      { keys: [MOD + ' Enter'], desc: 'Generate / Build Prompt' },
      { keys: [MOD + ' C'],     desc: 'Copy Last Result (When Focused)' }
    ]},
    { name: 'Voice', items: [
      { keys: ['Click 🎙️'], desc: 'Start Or Stop Voice Input' },
      { keys: ['▾'],        desc: 'Choose Voice Input Language' }
    ]},
    { name: 'Vault', items: [
      { keys: ['/'],   desc: 'Focus Vault Search (When Vault Open)' },
      { keys: ['Esc'], desc: 'Close Vault Drawer' }
    ]}
  ];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + ROOT_ID + ' {',
      '  position: fixed; inset: 0; z-index: 240;',
      '  display: none; align-items: center; justify-content: center;',
      '  padding: 16px; background: rgba(0, 0, 0, 0.55);',
      '}',
      '#' + ROOT_ID + '.is-open { display: flex; }',
      '#' + ROOT_ID + ' .pmg-cs-card {',
      '  width: 100%; max-width: 540px; max-height: 86vh; overflow-y: auto;',
      '  background: var(--color-surface, #0f1d22);',
      '  border: 1px solid var(--color-border, rgba(91,168,176,0.3));',
      '  border-radius: var(--radius-lg, 12px);',
      '  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);',
      '  padding: 20px 22px;',
      '  animation: pmg-cs-in 0.16s ease-out both;',
      '}',
      '@keyframes pmg-cs-in {',
      '  from { transform: scale(0.96); opacity: 0; }',
      '  to   { transform: scale(1); opacity: 1; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + ROOT_ID + ' .pmg-cs-card { animation: none; }',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-head {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  margin: 0 0 14px;',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-title {',
      '  margin: 0; font-size: 18px; font-weight: 700;',
      '  color: var(--color-text, #e8eef2);',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-close {',
      '  width: 36px; height: 36px; border-radius: 50%;',
      '  background: transparent; border: 1px solid var(--color-border, rgba(91,168,176,0.3));',
      '  color: var(--color-text, #e8eef2);',
      '  font-size: 18px; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-close:hover { background: rgba(91,168,176,0.15); }',
      '#' + ROOT_ID + ' .pmg-cs-group { margin: 14px 0 6px; }',
      '#' + ROOT_ID + ' .pmg-cs-group h3 {',
      '  margin: 0 0 8px; font-size: 11px; font-weight: 700;',
      '  text-transform: uppercase; letter-spacing: 0.08em;',
      '  color: var(--color-text-muted, #98a8b0);',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-list { list-style: none; margin: 0; padding: 0; }',
      '#' + ROOT_ID + ' .pmg-cs-list li {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 8px 0; gap: 14px;',
      '  border-bottom: 1px solid color-mix(in srgb, var(--color-border, rgba(91,168,176,0.18)) 60%, transparent);',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-list li:last-child { border-bottom: 0; }',
      '#' + ROOT_ID + ' .pmg-cs-desc {',
      '  font-size: 14px; color: var(--color-text, #e8eef2);',
      '  flex: 1 1 auto; min-width: 0;',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-keys { display: flex; gap: 4px; flex: 0 0 auto; }',
      '#' + ROOT_ID + ' .pmg-cs-keys kbd {',
      '  font-family: ui-monospace, monospace; font-size: 11.5px;',
      '  padding: 3px 7px; border-radius: 5px;',
      '  background: rgba(255,255,255,0.06);',
      '  border: 1px solid rgba(255,255,255,0.14);',
      '  color: var(--color-text, #e8eef2);',
      '}',
      '#' + ROOT_ID + ' .pmg-cs-foot {',
      '  margin: 14px 0 0; padding-top: 10px;',
      '  border-top: 1px solid color-mix(in srgb, var(--color-border, rgba(91,168,176,0.18)) 60%, transparent);',
      '  font-size: 12px; color: var(--color-text-muted, #98a8b0);',
      '  text-align: center;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var rootEl = null;

  function build() {
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Keyboard shortcuts');
    root.setAttribute('data-pmg-overlay-root', '');

    var groupsHtml = GROUPS.map(function (g) {
      var items = g.items.map(function (it) {
        var keys = it.keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join(' ');
        return '<li><span class="pmg-cs-desc"></span><span class="pmg-cs-keys">' + keys + '</span></li>';
      }).join('');
      return [
        '<div class="pmg-cs-group">',
        '  <h3>', g.name, '</h3>',
        '  <ul class="pmg-cs-list">', items, '</ul>',
        '</div>'
      ].join('');
    }).join('');

    root.innerHTML = [
      '<div class="pmg-cs-card" role="document">',
      '  <div class="pmg-cs-head">',
      '    <h2 class="pmg-cs-title">Keyboard Shortcuts</h2>',
      '    <button type="button" class="pmg-cs-close" aria-label="Close">×</button>',
      '  </div>',
      groupsHtml,
      '  <p class="pmg-cs-foot">Tip: press <kbd>?</kbd> any time to reopen this list.</p>',
      '</div>'
    ].join('');
    document.body.appendChild(root);

    var groupNodes = root.querySelectorAll('.pmg-cs-group');
    GROUPS.forEach(function (g, gi) {
      var lis = groupNodes[gi].querySelectorAll('.pmg-cs-list li');
      g.items.forEach(function (it, ii) {
        if (lis[ii]) lis[ii].querySelector('.pmg-cs-desc').textContent = it.desc;
      });
    });

    root.addEventListener('click', function (ev) {
      if (ev.target === root) close();
    });
    root.querySelector('.pmg-cs-close').addEventListener('click', close);
    return root;
  }

  function open() {
    if (!rootEl) rootEl = build();
    rootEl.classList.add('is-open');
    setTimeout(function () {
      var btn = rootEl.querySelector('.pmg-cs-close');
      if (btn) try { btn.focus(); } catch (e) {}
    }, 0);
  }

  function close() {
    if (rootEl) rootEl.classList.remove('is-open');
  }

  function isOpen() { return !!(rootEl && rootEl.classList.contains('is-open')); }

  document.addEventListener('keydown', function (ev) {
    if (isOpen() && ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  });

  function init() { injectStyles(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.pmgCheatsheet = { open: open, close: close, isOpen: isOpen };
})();
