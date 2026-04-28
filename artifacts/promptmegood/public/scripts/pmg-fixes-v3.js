(function () {
  'use strict';
  if (window.__PMG_FIXES_V3__) return;
  window.__PMG_FIXES_V3__ = true;

  var HAS_GENERATED_KEY = 'pmg_has_generated';
  var MODAL_SHOWN_KEY = 'pmg_modal_shown';
  var WELCOME_SEEN_KEY = 'pmg_welcome_seen';

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v3-style')) return;
    var css = [
      'body.pmg-pre-gen .pmg-post-gen { display: none !important; }',
      '#weekly-goal-new-badge, .weekly-new-badge { display: none !important; }',
      '#replay-tour-btn-builder { display: none !important; }',
      '#guided-cta-row { display: none !important; }',
      '.build-cta-guidance { display: none !important; }',
      '.demo-helper { display: none !important; }',
      '.pmg-help-link { display: inline-block; margin: 8px 0 4px; padding: 6px 4px; background: transparent; border: 0; color: var(--color-primary); font: inherit; font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }',
      '.pmg-help-link:hover, .pmg-help-link:focus-visible { background: color-mix(in srgb, var(--color-primary) 8%, transparent); border-radius: 4px; outline: none; }',
      '.what-next { border-left: 3px solid var(--color-primary) !important; background: color-mix(in srgb, var(--color-primary) 9%, transparent) !important; }',
      '.what-next-list li strong { font-weight: 800 !important; }',
      '#print-btn { background: transparent !important; border: 0 !important; padding: 6px 4px !important; color: var(--color-text-muted) !important; text-decoration: underline !important; text-underline-offset: 3px !important; box-shadow: none !important; min-height: auto !important; font-weight: 500 !important; }',
      '#print-btn:hover, #print-btn:focus-visible { color: var(--color-primary) !important; }',
      '#runBtn { font-size: var(--text-base, 16px) !important; font-weight: 700 !important; padding: 16px 28px !important; }',
      '.pmg-replay-tour-menu { display: inline-flex; align-items: center; min-height: 44px; padding: 6px 10px; }',
      '@media (max-width: 768px) {',
      '  .global-search { display: none !important; }',
      '  .btn, button, [role="button"] { min-height: 44px; }',
      '  #builder-title, .builder-transition, #guided-cta-row, .build-cta-guidance, .demo-helper { display: none !important; }',
      '  #weekly-goal-pin { display: none !important; }',
      '  #mobile-sticky-dismiss { display: none !important; }',
      '  #pmg-mobile-sticky-tab { display: none !important; }',
      '}',
      'body:not(.pmg-has-generated) #weekly-goal-pin { display: none !important; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v3-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readHasGenerated() {
    try { return localStorage.getItem(HAS_GENERATED_KEY) === 'true'; }
    catch (e) { return false; }
  }

  function applyGenerationGate() {
    var hasGen = readHasGenerated();
    document.body.classList.toggle('pmg-pre-gen', !hasGen);
    document.body.classList.toggle('pmg-has-generated', hasGen);
  }

  function watchGenerationFlag() {
    try {
      var origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        var ret = origSet.apply(this, arguments);
        if (key === HAS_GENERATED_KEY) {
          try { applyGenerationGate(); } catch (e) {}
        }
        return ret;
      };
    } catch (e) {}
    window.addEventListener('storage', function (ev) {
      if (ev && ev.key === HAS_GENERATED_KEY) applyGenerationGate();
    });
    var resultBox = document.getElementById('resultBox');
    if (resultBox && 'MutationObserver' in window) {
      var obs = new MutationObserver(function () {
        var txt = (resultBox.textContent || '').trim();
        if (!txt) return;
        var hasMeaningfulContent = txt.length > 40 && !/will appear here|generating/i.test(txt);
        if (hasMeaningfulContent && !readHasGenerated()) {
          try { localStorage.setItem(HAS_GENERATED_KEY, 'true'); } catch (e) {}
          applyGenerationGate();
        }
      });
      obs.observe(resultBox, { childList: true, characterData: true, subtree: true });
    }
  }

  function setupTourModalGate() {
    var banner = document.getElementById('tour-banner');
    if (!banner) return;
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    var alreadyShown = safeGet(MODAL_SHOWN_KEY) === 'true' || safeGet(WELCOME_SEEN_KEY) === 'true';
    if (alreadyShown) {
      banner.hidden = true;
      banner.style.display = 'none';
      return;
    }
    if (!banner.hidden) {
      banner.hidden = true;
      banner.style.display = 'none';
      window.setTimeout(function () {
        if (safeGet(MODAL_SHOWN_KEY) === 'true' || safeGet(WELCOME_SEEN_KEY) === 'true') return;
        banner.hidden = false;
        banner.style.removeProperty('display');
        safeSet(MODAL_SHOWN_KEY, 'true');
      }, 3000);
    }
    var dismissIds = ['tour-skip', 'tour-show', 'tour-jump'];
    dismissIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () {
        safeSet(MODAL_SHOWN_KEY, 'true');
        safeSet(WELCOME_SEEN_KEY, 'true');
      });
    });
  }

  function addReplayTourToMenu() {
    var topActions = document.querySelector('.top-actions');
    if (!topActions) return;
    if (document.getElementById('pmg-replay-tour-menu-link')) return;
    var btn = document.createElement('button');
    btn.id = 'pmg-replay-tour-menu-link';
    btn.type = 'button';
    btn.className = 'ghost-link pmg-replay-tour-menu';
    btn.textContent = 'Replay Tour';
    btn.addEventListener('click', function () {
      var footerBtn = document.getElementById('replay-tour-btn');
      var builderBtn = document.getElementById('replay-tour-btn-builder');
      var target = footerBtn || builderBtn;
      if (target) target.click();
    });
    topActions.appendChild(btn);
  }

  function insertHelpMeStartLink() {
    var generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;
    if (document.getElementById('pmg-help-me-start-link')) return;
    var link = document.createElement('button');
    link.type = 'button';
    link.id = 'pmg-help-me-start-link';
    link.className = 'pmg-help-link';
    link.textContent = 'Not Sure Where To Start? Let Us Help →';
    link.addEventListener('click', function () {
      var guided = document.getElementById('guided-mode-btn');
      if (guided) guided.click();
    });
    var actionsRow = generateBtn.parentNode;
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.parentNode.insertBefore(link, actionsRow.nextSibling);
    }
  }

  function moveRandomPromptIntoSettings() {
    var btn = document.getElementById('random-prompt');
    if (!btn) return;
    var settings = document.getElementById('settingsPanel');
    if (!settings) return;
    if (btn.dataset.pmgMoved === '1') return;
    var grid = settings.querySelector('.settings-grid') || settings;
    var wrap = document.createElement('div');
    wrap.className = 'pmg-random-prompt-wrap';
    wrap.style.cssText = 'grid-column: 1 / -1; margin: 0 0 12px; padding: 10px 12px; background: color-mix(in srgb, var(--color-primary) 6%, transparent); border-radius: var(--radius-md, 8px);';
    var label = document.createElement('p');
    label.style.cssText = 'margin: 0 0 8px; font-size: 12px; color: var(--color-text-muted); font-weight: 600;';
    label.textContent = 'Need Inspiration?';
    btn.classList.remove('pmg-post-gen');
    btn.removeAttribute('hidden');
    btn.style.removeProperty('display');
    wrap.appendChild(label);
    wrap.appendChild(btn);
    if (grid.firstChild) grid.insertBefore(wrap, grid.firstChild); else grid.appendChild(wrap);
    btn.dataset.pmgMoved = '1';
  }

  function reorderOutputActions() {
    var runSection = document.getElementById('runSection');
    var whatNext = document.getElementById('what-next');
    var copyBtn = document.getElementById('copy-btn');
    var improveBlock = document.getElementById('improve-block');
    var qualityRow = document.getElementById('quality-row');
    if (!runSection || !whatNext || !copyBtn || !improveBlock) return;
    if (document.getElementById('pmg-copy-wrap')) return;

    var resultBox = document.getElementById('resultBox');
    var anchor = resultBox && resultBox.parentNode ? resultBox.nextSibling : improveBlock;
    var parent = improveBlock.parentNode;
    if (!parent) return;

    try {
      parent.insertBefore(runSection, improveBlock);
      parent.insertBefore(whatNext, improveBlock);
    } catch (e) {}

    var copyWrap = document.createElement('div');
    copyWrap.id = 'pmg-copy-wrap';
    copyWrap.className = 'actions-row pmg-copy-wrap';
    copyWrap.style.cssText = 'margin: 12px 0;';
    if (copyBtn.parentNode) copyBtn.parentNode.removeChild(copyBtn);
    copyWrap.appendChild(copyBtn);
    parent.insertBefore(copyWrap, improveBlock);
  }

  function setupWeeklyFallback() {
    var body = document.getElementById('weekly-goal-body');
    if (!body) return;
    setTimeout(function () {
      var txt = (body.textContent || '').trim();
      if (!txt || /loading|spinner|…/i.test(txt) || txt.length < 8) {
        body.textContent = 'Try This: Write A Prompt To Help You Earn Extra Income This Week.';
      }
    }, 3000);
  }

  function neutralizeStickyTab() {
    var tab = document.getElementById('pmg-mobile-sticky-tab');
    if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
    var dismiss = document.getElementById('mobile-sticky-dismiss');
    if (dismiss) {
      dismiss.setAttribute('hidden', 'hidden');
      dismiss.style.display = 'none';
    }
    try {
      sessionStorage.removeItem('pmg.mobileStickyCollapsed');
    } catch (e) {}
    var bar = document.getElementById('mobile-sticky-bar');
    if (bar) bar.classList.remove('is-collapsed');
  }

  function init() {
    injectStyles();
    applyGenerationGate();
    watchGenerationFlag();
    setupTourModalGate();
    addReplayTourToMenu();
    insertHelpMeStartLink();
    moveRandomPromptIntoSettings();
    reorderOutputActions();
    setupWeeklyFallback();
    neutralizeStickyTab();
    setTimeout(neutralizeStickyTab, 200);
    setTimeout(neutralizeStickyTab, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
