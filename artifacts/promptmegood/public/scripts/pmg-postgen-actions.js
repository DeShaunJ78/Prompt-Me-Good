/* pmg-postgen-actions.js
 * Two additive post-generate UX fixes:
 *
 * 1) Refine block consolidation — adds a 5th "Tell AI What To Change…" button
 *    to #tour-step-improve that reveals an inline textarea + Apply. The Apply
 *    button copies its value into #fine-tune-input and clicks #fine-tune-btn,
 *    re-using the existing handler. The standalone #tour-step-finalize
 *    (legacy "Fine-Tune Your Prompt" section) is hidden.
 *
 * 2) Prominent "Run This Prompt" panel — inserted right after #improve-block
 *    with two clear choices:
 *      • Run With AI Here  →  clicks #runBtn (existing in-house handler)
 *      • Send To <last>    →  window.__pmgSendTo.send(<key>) for the
 *        last-used external destination, with a caret menu to switch
 *        between ChatGPT / Claude / Gemini / Perplexity.
 *
 * Additive only. No changes to existing handlers or markup.
 */
(function () {
  'use strict';
  if (window.__pmgPostgenActionsLoaded) return;
  window.__pmgPostgenActionsLoaded = true;

  var DESTS = ['chatgpt', 'claude', 'gemini', 'perplexity'];
  var DEST_LABELS = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity'
  };

  /* -------------------------------------------------------------------
   * Styles
   * ----------------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('pmg-postgen-actions-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-postgen-actions-styles';
    s.textContent = [
      /* Hide the now-redundant standalone Fine-Tune section — but ONLY when the
         consolidated Tell-AI block has successfully mounted. The body class is
         added by buildTellAiBlock() on success so a DOM-drift failure leaves
         the legacy Fine-Tune section as a working fallback. */
      'body.pmg-tellai-ready #tour-step-finalize { display: none !important; }',

      /* Inline custom-instructions reveal inside the Refine block. */
      '.pmg-tellai-wrap { margin-top: 12px; }',
      '.pmg-tellai-panel { display: none; margin-top: 10px; padding: 12px;',
      '  background: var(--color-surface-2, #f6f3ee); border: 1px solid var(--color-divider, #e5e0d8);',
      '  border-radius: 10px; }',
      '.pmg-tellai-panel.is-open { display: block; }',
      '.pmg-tellai-panel label { display:block; font-size:13px; font-weight:600;',
      '  margin-bottom:6px; color: var(--color-text, #1f1f1f); }',
      '.pmg-tellai-panel textarea { width:100%; min-height:72px; padding:10px;',
      '  border:1px solid var(--color-border, #d4cfc4); border-radius:8px;',
      '  font:inherit; resize:vertical; box-sizing:border-box; background:var(--color-surface, #fff);',
      '  color:var(--color-text, inherit); }',
      '.pmg-tellai-actions { display:flex; gap:8px; margin-top:10px; align-items:center; }',
      '.pmg-tellai-actions .pmg-tellai-hint { font-size:12px; color:var(--color-text-muted, #6b6b6b); margin:0; }',

      /* Run This Prompt panel. */
      '.pmg-run-panel { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--color-divider, #e5e0d8);',
      '  border-radius: 12px; background: var(--color-surface, #fbf9f5); }',
      '.pmg-run-panel-title { margin:0 0 2px; font-size:14px; font-weight:700;',
      '  color: var(--color-text, #1f1f1f); }',
      '.pmg-run-panel-helper { margin:0 0 8px; font-size:12px; color: var(--color-text-muted, #6b6b6b); }',
      '.pmg-run-panel-row { display:flex; flex-wrap:wrap; gap:8px; align-items:stretch; }',
      '.pmg-run-panel-or { align-self:center; font-size:11px; font-weight:600; letter-spacing:0.06em;',
      '  color: var(--color-text-muted, #6b6b6b); text-transform:uppercase; padding: 0 2px; }',
      '.pmg-run-here-btn { flex: 1 1 220px; min-height: 44px; }',
      '.pmg-send-split { position: relative; flex: 1 1 220px; display:flex; }',
      '.pmg-send-main { flex:1; min-height:44px; border-top-right-radius:0 !important; border-bottom-right-radius:0 !important; }',
      '.pmg-send-caret { min-width:36px; padding:0 10px; border-left: 1px solid rgba(0,0,0,0.12) !important;',
      '  border-top-left-radius:0 !important; border-bottom-left-radius:0 !important; min-height:44px; }',
      '[data-theme="dark"] .pmg-send-caret { border-left-color: rgba(255,255,255,0.15) !important; }',
      '.pmg-send-menu { position:absolute; top: calc(100% + 4px); right:0; min-width: 200px;',
      '  background:var(--color-surface, #fff); border:1px solid var(--color-border, #d4cfc4); border-radius:10px;',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.08); padding: 6px; z-index: 50; display:none; }',
      '.pmg-send-menu.is-open { display:block; }',
      '.pmg-send-menu-item { display:block; width:100%; text-align:left; padding:8px 10px;',
      '  background:none; border:0; border-radius:6px; cursor:pointer; font:inherit; color:inherit; }',
      '.pmg-send-menu-item:hover, .pmg-send-menu-item:focus-visible { background: var(--color-surface-2, #f6f3ee); outline: none; }',
      '.pmg-send-menu-item.is-current { font-weight: 600; }',
      '.pmg-send-menu-item .pmg-send-menu-check { display:inline-block; width:16px; color: var(--color-accent, #1f7a6c); }',

      '@media (max-width: 540px) {',
      '  .pmg-run-panel { margin-top: 10px; padding: 10px 12px; }',
      '  .pmg-run-panel-title { font-size: 13px; }',
      '  .pmg-run-panel-helper { font-size: 11px; margin-bottom: 6px; }',
      '  .pmg-run-panel-row { flex-direction: row; flex-wrap: wrap; gap: 6px; }',
      '  .pmg-run-here-btn { flex: 1 1 auto; min-height: 44px; font-size: 14px; }',
      '  .pmg-run-panel-or { display: none; }',
      '  .pmg-send-split { flex: 0 1 auto; }',
      '  .pmg-send-main { min-height: 40px; font-size: 13px; }',
      '  .pmg-send-caret { min-height: 40px; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* -------------------------------------------------------------------
   * 1) Refine block consolidation
   * ----------------------------------------------------------------- */
  function buildTellAiBlock() {
    var improveStep = document.getElementById('tour-step-improve');
    if (!improveStep) return;
    if (improveStep.querySelector('.pmg-tellai-wrap')) return;
    var actionsRow = improveStep.querySelector('.actions-row');
    if (!actionsRow) return;

    /* The new 5th button — sits at the end of the existing actions row so
       it lines up visually with Improve With AI + the 3 presets. */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.id = 'pmg-tellai-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'pmg-tellai-panel');
    btn.textContent = 'Tell AI What To Change…';
    actionsRow.appendChild(btn);

    /* The collapsible panel sits below the actions row but inside the same
       Refine step so it feels like one block. */
    var wrap = document.createElement('div');
    wrap.className = 'pmg-tellai-wrap';
    wrap.innerHTML =
      '<div class="pmg-tellai-panel" id="pmg-tellai-panel" role="region" aria-label="Custom prompt instructions">' +
        '<label for="pmg-tellai-input">What should AI change about this prompt?</label>' +
        '<textarea id="pmg-tellai-input" rows="3" placeholder="Example: make it shorter, more persuasive, add examples, or simplify the steps."></textarea>' +
        '<div class="pmg-tellai-actions">' +
          '<button type="button" class="btn btn-primary" id="pmg-tellai-apply">Apply Changes</button>' +
          '<button type="button" class="btn btn-secondary" id="pmg-tellai-cancel">Cancel</button>' +
          '<p class="pmg-tellai-hint">Uses the same engine as the presets — your words, AI rewrite.</p>' +
        '</div>' +
      '</div>';
    /* Append after the undo-row so it sits at the bottom of the Refine step. */
    var undoRow = improveStep.querySelector('.undo-row');
    if (undoRow && undoRow.parentNode === improveStep) {
      improveStep.insertBefore(wrap, undoRow.nextSibling);
    } else {
      improveStep.appendChild(wrap);
    }

    var panel = wrap.querySelector('#pmg-tellai-panel');
    var input = wrap.querySelector('#pmg-tellai-input');
    var apply = wrap.querySelector('#pmg-tellai-apply');
    var cancel = wrap.querySelector('#pmg-tellai-cancel');

    function open() {
      panel.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      /* Mirror any text the user may have typed into the legacy field so
         we never lose work in flight. */
      var legacy = document.getElementById('fine-tune-input');
      if (legacy && legacy.value && !input.value) input.value = legacy.value;
      setTimeout(function () { try { input.focus(); } catch (_) {} }, 30);
    }
    function close() {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) close(); else open();
    });
    cancel.addEventListener('click', close);

    apply.addEventListener('click', function () {
      var text = (input.value || '').trim();
      if (!text) {
        try { input.focus(); } catch (_) {}
        return;
      }
      var legacy = document.getElementById('fine-tune-input');
      var legacyBtn = document.getElementById('fine-tune-btn');
      if (!legacy || !legacyBtn) return;
      legacy.value = text;
      try { legacy.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      legacyBtn.click();
      /* Leave the panel open so the user can iterate; clear input so the
         next Apply requires a new instruction. */
      input.value = '';
    });

    /* Allow Cmd/Ctrl+Enter to apply from the textarea. */
    input.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        apply.click();
      } else if (e.key === 'Escape') {
        close();
      }
    });

    /* Wrap apply.click() with a short transient lock to prevent rapid double-
       clicks from firing two fine-tune appends. */
    var applyLocked = false;
    apply.addEventListener('click', function (e) {
      if (applyLocked) { e.stopImmediatePropagation(); return; }
      applyLocked = true;
      apply.disabled = true;
      var prevText = apply.textContent;
      apply.textContent = 'Applying…';
      setTimeout(function () {
        applyLocked = false;
        apply.disabled = false;
        apply.textContent = prevText;
      }, 800);
    }, true); /* capture phase so the lock is set BEFORE the work handler runs */

    /* Mark the body so the legacy #tour-step-finalize CSS hide kicks in. */
    document.body.classList.add('pmg-tellai-ready');
  }

  /* -------------------------------------------------------------------
   * 2) Run This Prompt panel
   * ----------------------------------------------------------------- */
  function buildRunPanel() {
    var improveBlock = document.getElementById('improve-block');
    if (!improveBlock) return;
    if (document.getElementById('pmg-run-panel')) return;

    var panel = document.createElement('section');
    panel.className = 'pmg-run-panel pmg-post-gen';
    panel.id = 'pmg-run-panel';
    panel.setAttribute('aria-label', 'Run this prompt');
    panel.innerHTML =
      '<h3 class="pmg-run-panel-title">Run This Prompt</h3>' +
      '<p class="pmg-run-panel-helper">See the response right here, or open it in your favorite AI tool with the prompt pre-filled.</p>' +
      '<div class="pmg-run-panel-row">' +
        '<button type="button" class="btn btn-primary pmg-run-here-btn" id="pmg-run-here">' +
          '<span aria-hidden="true">▶</span> Run With AI Here' +
        '</button>' +
        '<span class="pmg-run-panel-or">or</span>' +
        '<span class="pmg-send-split">' +
          '<button type="button" class="btn btn-secondary pmg-send-main" id="pmg-send-main">' +
            '<span aria-hidden="true">↗</span> Send To <span id="pmg-send-main-label">ChatGPT</span>' +
          '</button>' +
          '<button type="button" class="btn btn-secondary pmg-send-caret" id="pmg-send-caret"' +
            ' aria-haspopup="menu" aria-expanded="false" aria-label="Choose AI tool">▾</button>' +
          '<div class="pmg-send-menu" id="pmg-send-menu" role="menu"></div>' +
        '</span>' +
      '</div>';

    /* Insert immediately after the Refine block so it's the first thing
       users see after refining (or skipping refine). */
    if (improveBlock.parentNode) {
      improveBlock.parentNode.insertBefore(panel, improveBlock.nextSibling);
    }

    /* In-house run button — defer to existing handler. */
    var runHere = panel.querySelector('#pmg-run-here');
    runHere.addEventListener('click', function () {
      var realBtn = document.getElementById('runBtn');
      if (realBtn && typeof realBtn.click === 'function') {
        realBtn.click();
        var scrollAttempts = 0;
        var scrollInterval = setInterval(function () {
          scrollAttempts++;
          var resp = document.getElementById('aiResponseSection');
          if (resp && resp.offsetHeight > 0) {
            clearInterval(scrollInterval);
            try { resp.scrollIntoView({ behavior: window.PMG_A11Y ? window.PMG_A11Y.scrollBehavior() : 'smooth', block: 'start' }); } catch (_) {}
          }
          if (scrollAttempts > 30) clearInterval(scrollInterval);
        }, 200);
        return;
      }
      /* Fallback: try the global runWithAI() if exposed. */
      if (typeof window.runWithAI === 'function') window.runWithAI();
    });

    /* Send-To split button + menu. */
    var sendMain = panel.querySelector('#pmg-send-main');
    var sendCaret = panel.querySelector('#pmg-send-caret');
    var sendMenu = panel.querySelector('#pmg-send-menu');
    var sendLabel = panel.querySelector('#pmg-send-main-label');

    function getLast() {
      try {
        var api = window.__pmgSendTo;
        if (api && typeof api.getLast === 'function') return api.getLast();
      } catch (_) {}
      return 'chatgpt';
    }
    /* Smart Send-To Router (Spec 7). Reads the current finalized prompt
       from #resultBox and asks the classifier which destination fits best.
       Weak signal / tie / disabled → falls through to ChatGPT default. */
    var lastRecommendation = null;
    var currentKey = 'chatgpt';
    var currentRec = null;
    function getCurrentPrompt() {
      var rb = document.getElementById('resultBox');
      var t = (rb && rb.textContent || '').trim();
      if (!t || t === 'Your fixed prompt will appear here.') return '';
      return t;
    }
    function getRecommendation() {
      try {
        if (!window.__pmgRouter) return null;
        var prompt = getCurrentPrompt();
        if (!prompt) return null;
        return window.__pmgRouter.recommend(prompt, 'text', null);
      } catch (_) { return null; }
    }
    function track(name, props) {
      try {
        if (typeof window.__pmgTrack === 'function') window.__pmgTrack(name, props || {});
      } catch (_) {}
    }
    function refreshLabel() {
      var rec = getRecommendation();
      /* Router wins when confidence is strong; otherwise ChatGPT default
         (we deliberately do NOT fall back to last-used here — the spec
         locks weak signal → ChatGPT to keep the morph trustworthy). */
      var key = (rec && rec.confidence === 'strong') ? rec.destination : 'chatgpt';
      currentKey = key;
      currentRec = rec;
      sendLabel.textContent = DEST_LABELS[key] || 'ChatGPT';

      /* Tooltip: explains WHY this destination is recommended. */
      var reason = (rec && rec.reason) || 'Default destination — works in any AI.';
      sendMain.setAttribute('title', reason);
      sendMain.setAttribute('aria-label', 'Send to ' + (DEST_LABELS[key] || 'ChatGPT') + '. ' + reason);

      /* Telemetry: fire once per recommendation change. */
      var sig = key + '|' + (rec ? rec.intent : 'default') + '|' + (rec ? rec.confidence : 'weak');
      if (sig !== lastRecommendation) {
        lastRecommendation = sig;
        track('router_recommend', {
          destination: key,
          intent: rec ? rec.intent : 'default',
          confidence: rec ? rec.confidence : 'weak'
        });
      }

      Array.prototype.forEach.call(sendMenu.querySelectorAll('.pmg-send-menu-item'), function (item) {
        var isCurrent = item.getAttribute('data-dest') === key;
        item.classList.toggle('is-current', isCurrent);
        var check = item.querySelector('.pmg-send-menu-check');
        if (check) check.textContent = isCurrent ? '✓' : '';
      });
    }
    /* Observe #resultBox so the morph updates whenever a new prompt is
       finalized or refined. Debounced 150ms — incremental render can fire
       many mutations in quick succession; we only want the settled value. */
    var refreshTimer = null;
    function refreshLabelDebounced() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () {
        refreshTimer = null;
        refreshLabel();
      }, 150);
    }
    function watchResultBox() {
      var rb = document.getElementById('resultBox');
      if (!rb || rb.__pmgRouterWatched) return;
      rb.__pmgRouterWatched = true;
      try {
        var mo = new MutationObserver(refreshLabelDebounced);
        mo.observe(rb, { childList: true, characterData: true, subtree: true });
      } catch (_) {}
    }
    function buildMenu() {
      sendMenu.innerHTML = '';
      DESTS.forEach(function (key) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'pmg-send-menu-item';
        item.setAttribute('role', 'menuitem');
        item.setAttribute('data-dest', key);
        item.innerHTML = '<span class="pmg-send-menu-check"></span> Send To ' + DEST_LABELS[key];
        item.addEventListener('click', function () {
          closeMenu();
          doSend(key, /*remember*/ true);
        });
        sendMenu.appendChild(item);
      });
    }
    function openMenu() {
      sendMenu.classList.add('is-open');
      sendCaret.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocClick, true);
    }
    function closeMenu() {
      sendMenu.classList.remove('is-open');
      sendCaret.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick, true);
    }
    function onDocClick(e) {
      if (!panel.contains(e.target)) closeMenu();
    }
    /* Transient lock to prevent rapid clicks from opening multiple tabs. */
    var sendLocked = false;
    function doSend(key, remember) {
      if (sendLocked) return;
      sendLocked = true;
      setTimeout(function () { sendLocked = false; }, 600);
      try {
        var api = window.__pmgSendTo;
        if (api && typeof api.send === 'function') {
          if (remember && typeof api.setLast === 'function') {
            try { api.setLast(key); } catch (_) {}
          }
          api.send(key);
          refreshLabel();
          return;
        }
      } catch (_) {}
      /* Fallback: click the matching open-in card. */
      var card = document.querySelector('.open-in-btn[data-tool="' + key + '"]');
      if (card) card.click();
    }

    /* Main click accepts the (router-driven) recommendation. */
    sendMain.addEventListener('click', function () {
      track('router_accept', {
        recommended: currentKey,
        intent: currentRec ? currentRec.intent : 'default',
        confidence: currentRec ? currentRec.confidence : 'weak'
      });
      doSend(currentKey, false);
    });
    sendCaret.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sendMenu.classList.contains('is-open')) closeMenu(); else openMenu();
    });

    /* Delegated listener on sendMenu — survives buildMenu() rebuilding the
       items. (Capture phase so it fires before the per-item doSend handler.) */
    sendMenu.addEventListener('click', function (e) {
      var item = e.target && e.target.closest && e.target.closest('.pmg-send-menu-item');
      if (!item || !sendMenu.contains(item)) return;
      var picked = item.getAttribute('data-dest');
      if (!picked) return;
      if (picked === currentKey) {
        track('router_accept', {
          recommended: currentKey,
          intent: currentRec ? currentRec.intent : 'default',
          confidence: currentRec ? currentRec.confidence : 'weak',
          via: 'menu'
        });
      } else {
        track('router_override', {
          recommended: currentKey,
          picked: picked,
          intent: currentRec ? currentRec.intent : 'default'
        });
      }
    }, true);

    buildMenu();
    refreshLabel();
    watchResultBox();
    /* If pmg-send-to.js or the result box boots after us, refresh + rewatch. */
    setTimeout(function () { refreshLabel(); watchResultBox(); }, 250);
    setTimeout(function () { refreshLabel(); watchResultBox(); }, 1000);
  }

  /* -------------------------------------------------------------------
   * Boot
   * ----------------------------------------------------------------- */
  function boot() {
    injectStyles();
    buildTellAiBlock();
    buildRunPanel();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
