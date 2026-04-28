(function () {
  'use strict';

  function once(name) {
    if (window['__pmg_v5_' + name]) return false;
    window['__pmg_v5_' + name] = true;
    return true;
  }

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v5-style')) return;
    var css = [
      '/* ===== FIX 4: Hero compression + .hero-card hide on desktop ===== */',
      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(0.75rem, 1.5vw, 1.25rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-2) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-2) !important; }',
      '  .hero-actions { margin-bottom: var(--space-2) !important; }',
      '  .hero-card { display: none !important; }',
      '  .hero-grid { grid-template-columns: 1fr !important; }',
      '  .hero-testimonial { margin-top: var(--space-3) !important; }',
      '}',

      '/* ===== FIX 4: Brief-named class aliases for marketing sections ===== */',
      '@media (min-width: 920px) {',
      '  .pmg-marketing-section { display: none !important; }',
      '  .pmg-marketing-section.pmg-revealed { display: block !important; }',
      '}',

      '/* ===== FIX 2: Button hierarchy — eliminate white buttons ===== */',
      '/* SECONDARY: light tint of accent */',
      '.btn.btn-secondary,',
      '#copy-btn.btn-secondary,',
      '#share-btn,',
      '#print-btn,',
      '#fine-tune-btn.btn-secondary,',
      '.refine-buttons .btn-secondary,',
      'button.btn-secondary,',
      'a.btn.btn-secondary {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '.btn.btn-secondary:hover, button.btn-secondary:hover, a.btn.btn-secondary:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-2)) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)) !important;',
      '}',
      '/* TERTIARY: clear / print / collapse / undo / clear-all-history */',
      '#clear-prompt-btn, .btn.btn-clear, .btn-clear,',
      '#print-btn,',
      '#clear-all-history-btn,',
      '#collapse-all-btn,',
      '#undo-last-change-btn,',
      '.history-collapse-all-btn,',
      'button[data-tertiary] {',
      '  background: var(--color-surface-2) !important;',
      '  color: var(--color-text-muted) !important;',
      '  border: 1px solid var(--color-border) !important;',
      '}',
      '/* DESTRUCTIVE */',
      '.btn-destructive, button[data-destructive], #clear-all-history-confirm, .btn-danger {',
      '  background: color-mix(in srgb, #dc2626 10%, var(--color-surface-2)) !important;',
      '  color: #dc2626 !important;',
      '  border: 1px solid color-mix(in srgb, #dc2626 25%, var(--color-border)) !important;',
      '}',
      '/* Upload "Choose File" label-as-button — secondary look */',
      '.upload-btn, label.btn[for="analyze-file"] {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '/* ChatGPT / Claude / Perplexity buttons — secondary look (not primary) */',
      '.open-in-btn {',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',
      '.open-in-btn:hover {',
      '  background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface-2)) !important;',
      '}',

      '/* ===== FIX 3: Hide decorative result pills ===== */',
      '#result-panel .pill-row { display: none !important; }',

      '/* ===== FIX 3: Help Me Start — collapse the descriptive card to a slim helper ===== */',
      '.guided-cta-row {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '  gap: 4px !important;',
      '  align-items: stretch !important;',
      '  background: transparent !important;',
      '  border: 0 !important;',
      '  padding: 0 !important;',
      '  margin-top: var(--space-2) !important;',
      '}',
      '.guided-cta-row .guided-cta-text {',
      '  order: 2 !important;',
      '  display: block !important;',
      '  text-align: center !important;',
      '  font-size: var(--text-xs) !important;',
      '  color: var(--color-text-muted) !important;',
      '}',
      '.guided-cta-row .guided-cta-text strong { display: none !important; }',
      '.guided-cta-row .guided-cta-text > span:not(.guided-cta-recommended-badge) {',
      '  display: block !important;',
      '  font-size: var(--text-xs) !important;',
      '  font-weight: 400 !important;',
      '  color: var(--color-text-muted) !important;',
      '}',
      '.guided-cta-row #guided-mode-btn {',
      '  order: 1 !important;',
      '  width: 100% !important;',
      '  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)) !important;',
      '  color: var(--color-primary) !important;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important;',
      '}',

      '/* ===== FIX 3: Keyboard shortcuts panel only when Expert Mode active ===== */',
      'body:not(.is-expert-mode) #keyboard-hints { display: none !important; }',
      'body.is-expert-mode #keyboard-hints { display: block !important; }',

      '/* ===== FIX 5: "No Signup. Free." sub-label under Fix My Prompt ===== */',
      '.pmg-generate-sublabel {',
      '  display: block;',
      '  margin: 4px 0 0;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  text-align: center;',
      '}',

      '/* ===== FIX 5: What Would You Like To Do? — interactive 3-column block ===== */',
      '.pmg-wn-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(3, minmax(0, 1fr));',
      '  gap: 12px;',
      '  margin-top: 8px;',
      '}',
      '@media (max-width: 720px) { .pmg-wn-grid { grid-template-columns: 1fr; } }',
      '.pmg-wn-card {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '  align-items: flex-start;',
      '  text-align: left;',
      '  padding: 14px;',
      '  border-radius: 12px;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border));',
      '  background: var(--color-surface);',
      '  color: var(--color-text);',
      '  cursor: pointer;',
      '  font: inherit;',
      '  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;',
      '  min-height: 44px;',
      '}',
      '.pmg-wn-card:hover, .pmg-wn-card:focus-visible {',
      '  border-color: var(--color-primary);',
      '  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));',
      '  transform: translateY(-1px);',
      '  outline: none;',
      '}',
      '.pmg-wn-card-title { font-weight: 700; font-size: var(--text-sm); color: var(--color-text); display: flex; align-items: center; gap: 6px; }',
      '.pmg-wn-card-desc { font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.45; }',
      '.pmg-wn-card-arrow { color: var(--color-primary); font-weight: 700; }',

      '/* ===== FIX 5: Image result caption ===== */',
      '.pmg-image-caption {',
      '  display: block;',
      '  margin-top: 6px;',
      '  font-size: var(--text-xs);',
      '  color: var(--color-text-muted);',
      '  text-align: center;',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v5-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===== FIX 1: Mobile keyboard safety ===== */
  function setupKeyboardSafety() {
    if (!once('kbsafety')) return;

    var TEXT_INPUT_SELECTOR = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="password"], input[type="tel"], input[type="url"], textarea, [contenteditable="true"], [contenteditable=""]';

    function applyInputmodeNone() {
      var sel = [
        'button',
        '[role="button"]',
        'a.btn',
        'a[href]',
        '.popular-use-card',
        '.example-chip',
        '.mode-switch-btn',
        '.accent-swatch',
        'summary',
        '.tab',
        '.toggle',
        '.pmg-wn-card'
      ].join(',');
      var nodes = document.querySelectorAll(sel);
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.matches && el.matches(TEXT_INPUT_SELECTOR)) return;
        if (!el.hasAttribute('inputmode')) {
          try { el.setAttribute('inputmode', 'none'); } catch (e) {}
        }
      });
    }

    function hardenStickyBarInput() {
      var input = document.getElementById('mobile-sticky-input');
      if (!input) return;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
    }

    function blurOnNonInputClick() {
      document.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        var clickable = t.closest('button, a[href], a.btn, [role="button"], .popular-use-card, .mode-switch-btn, .accent-swatch, .pmg-wn-card, summary, .pill, .badge');
        if (!clickable) return;
        if (clickable.matches && clickable.matches(TEXT_INPUT_SELECTOR)) return;
        var forAttr = clickable.getAttribute && clickable.getAttribute('for');
        if (forAttr) {
          var target = document.getElementById(forAttr);
          if (target && target.matches && target.matches(TEXT_INPUT_SELECTOR)) return;
        }
        var inside = clickable.querySelector && clickable.querySelector(TEXT_INPUT_SELECTOR);
        if (inside) return;
        setTimeout(function () {
          var ae = document.activeElement;
          if (!ae) return;
          if (ae === document.body) return;
          if (ae === clickable) { try { ae.blur(); } catch (e2) {} return; }
          if (ae.matches && ae.matches(TEXT_INPUT_SELECTOR)) {
            try { ae.blur(); } catch (e3) {}
            return;
          }
          try { ae.blur(); } catch (e) {}
        }, 0);
      }, true);
    }

    function hardenWizardButtons() {
      var ids = ['guided-next', 'guided-back', 'guided-finish', 'guided-skip',
                 'guided-q-next', 'guided-q-back'];
      ids.forEach(function (id) {
        var b = document.getElementById(id);
        if (b && !b.hasAttribute('inputmode')) b.setAttribute('inputmode', 'none');
      });
      var wizard = document.getElementById('guided-overlay') || document.getElementById('guided-mode-modal');
      if (wizard) {
        wizard.style.touchAction = 'pan-y';
      }
    }

    applyInputmodeNone();
    hardenStickyBarInput();
    hardenWizardButtons();
    blurOnNonInputClick();

    setTimeout(function () { applyInputmodeNone(); hardenStickyBarInput(); hardenWizardButtons(); }, 1500);
    setTimeout(function () { applyInputmodeNone(); hardenStickyBarInput(); hardenWizardButtons(); }, 5000);
  }

  /* ===== FIX 4: Marketing section class aliases ===== */
  function aliasMarketingSections() {
    if (!once('marketingAlias')) return;
    var ids = ['use-cases', 'why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add('pmg-marketing-section');
    });
    function syncRevealed() {
      var nodes = document.querySelectorAll('.desktop-below-fold');
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.classList.contains('revealed')) n.classList.add('pmg-revealed');
      });
    }
    syncRevealed();
    var sectionEls = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (sectionEls.length) {
      var mo = new MutationObserver(function () {
        sectionEls.forEach(function (n) {
          if (n.classList.contains('revealed') && !n.classList.contains('pmg-revealed')) {
            n.classList.add('pmg-revealed');
          }
        });
      });
      sectionEls.forEach(function (n) {
        mo.observe(n, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  /* ===== FIX 5: Add "No Signup. Free." sub-label under Fix My Prompt ===== */
  function addGenerateSubLabel() {
    if (!once('generateSublabel')) return;
    var btn = document.getElementById('generateBtn');
    if (!btn) return;
    if (document.getElementById('pmg-generate-sublabel')) return;
    var p = document.createElement('p');
    p.id = 'pmg-generate-sublabel';
    p.className = 'pmg-generate-sublabel';
    p.textContent = 'No Signup. Free.';
    if (btn.parentNode) {
      btn.parentNode.insertBefore(p, btn.nextSibling);
    }
  }

  /* ===== FIX 5 / FIX 3: Help Me Start — replace verbose blurb with concise helper text ===== */
  function rewriteHelpMeStartHelper() {
    if (!once('helpMeStartHelper')) return;
    var row = document.getElementById('guided-cta-row');
    if (!row) return;
    var textEl = row.querySelector('.guided-cta-text');
    if (textEl) {
      var spans = textEl.querySelectorAll('span:not(.guided-cta-recommended-badge)');
      if (spans.length) {
        spans[spans.length - 1].textContent = "Answer 4 Quick Questions And We'll Fill The Form For You.";
      }
    }
  }

  /* ===== FIX 5: What Would You Like To Do? interactive block ===== */
  function setWhatNextTitle() {
    var wn = document.getElementById('what-next');
    if (!wn) return;
    var titleEl = wn.querySelector('.what-next-title') || wn.querySelector('h3');
    if (titleEl && titleEl.textContent !== 'What Would You Like To Do?') {
      titleEl.textContent = 'What Would You Like To Do?';
    }
    var oldList = wn.querySelector('.what-next-list');
    if (oldList) oldList.style.display = 'none';
  }

  function rebuildWhatNext() {
    if (!once('whatNext')) return;
    var wn = document.getElementById('what-next');
    if (!wn) return;
    setWhatNextTitle();

    if (wn.querySelector('.pmg-wn-grid')) return;

    var grid = document.createElement('div');
    grid.className = 'pmg-wn-grid';

    function makeCard(opts) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-wn-card';
      btn.setAttribute('inputmode', 'none');
      btn.setAttribute('aria-label', opts.title);
      var t = document.createElement('span');
      t.className = 'pmg-wn-card-title';
      t.innerHTML = '<span>' + opts.title + '</span><span class="pmg-wn-card-arrow" aria-hidden="true">→</span>';
      var d = document.createElement('span');
      d.className = 'pmg-wn-card-desc';
      d.textContent = opts.desc;
      btn.appendChild(t);
      btn.appendChild(d);
      btn.addEventListener('click', opts.onClick);
      return btn;
    }

    function clickById(id) {
      var el = document.getElementById(id);
      if (!el) return false;
      try { el.click(); return true; } catch (e) { return false; }
    }
    function scrollToId(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    grid.appendChild(makeCard({
      title: 'Run With AI',
      desc: 'See Your AI Answer Right Here — No Copy-Paste Needed.',
      onClick: function () {
        var runSection = document.getElementById('runSection');
        if (runSection && runSection.hasAttribute('hidden')) runSection.removeAttribute('hidden');
        scrollToId('runSection');
        setTimeout(function () { clickById('runBtn'); }, 100);
      }
    }));
    grid.appendChild(makeCard({
      title: 'Copy Prompt',
      desc: 'Take It To ChatGPT, Claude, Or Any AI Tool You Use.',
      onClick: function () { clickById('copy-btn'); }
    }));
    grid.appendChild(makeCard({
      title: 'Refine It',
      desc: 'Make It Stronger Before You Run It.',
      onClick: function () {
        var ft = document.getElementById('fine-tune-input') || document.getElementById('fine-tune-btn');
        if (ft) {
          ft.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (ft.tagName === 'TEXTAREA') {
            setTimeout(function () { try { ft.focus(); } catch (e) {} }, 400);
          }
        }
      }
    }));

    wn.appendChild(grid);
  }

  /* ===== FIX 5: Image result caption + button label tweak ===== */
  function imageResultPolish() {
    if (!once('imageResultPolish')) return;
    var section = document.getElementById('imageResultSection');
    if (!section) return;
    var meta = section.querySelector('.run-section-meta');
    if (meta) meta.textContent = 'Created With DALL·E 3 · Free During Early Access';
    var dl = document.getElementById('imageDownloadBtn');
    if (dl) dl.innerHTML = '⬇ Download Image';
    var again = document.getElementById('imageAgainBtn');
    if (again) again.textContent = 'Generate Another';
  }

  /* ===== FIX 8: Title case sweep for dynamic / toast / button-label text ===== */
  function titleCaseSweep() {
    if (!once('titleCaseSweep')) return;
    var pairs = [
      ['Random prompt', 'Random Prompt'],
      ['Fix my prompt', 'Fix My Prompt'],
      ['Help me start', 'Help Me Start'],
      ['Run with AI', 'Run With AI'],
      ['Copy prompt', 'Copy Prompt'],
      ['Clear prompt', 'Clear Prompt'],
      ['Update prompt', 'Update Prompt'],
      ['Improve with AI', 'Improve With AI'],
      ['More detailed', 'More Detailed'],
      ['More bold & direct', 'More Bold & Direct'],
      ['Beginner friendly', 'Beginner Friendly'],
      ['Undo last change', 'Undo Last Change'],
      ['Check prompt quality', 'Check Prompt Quality'],
      ['Copy shareable link', 'Copy Shareable Link'],
      ['Print / save PDF', 'Print / Save PDF'],
      ['Run again', 'Run Again'],
      ['Copy response', 'Copy Response'],
      ['Use demo values', 'Use Demo Values'],
      ['Show archived', 'Show Archived'],
      ['Compare two', 'Compare Two'],
      ['Collapse all', 'Collapse All'],
      ['Clear all history', 'Clear All History'],
      ['Export everything', 'Export Everything'],
      ['Import backup', 'Import Backup'],
      ['Backup / restore', 'Backup / Restore'],
      ['Hide tip', 'Hide Tip'],
      ['Use this →', 'Use This →'],
      ['Need ideas?', 'Need Ideas?'],
      ['What next?', 'What Next?'],
      ['Your goal', 'Your Goal'],
      ['Your image', 'Your Image'],
      ['Fine-tune your prompt', 'Fine-Tune Your Prompt']
    ];

    function fixIn(root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        var v = node.nodeValue;
        if (!v || v.length < 3) continue;
        var parent = node.parentNode;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
        var changed = v;
        for (var i = 0; i < pairs.length; i++) {
          if (changed.indexOf(pairs[i][0]) !== -1) {
            changed = changed.split(pairs[i][0]).join(pairs[i][1]);
          }
        }
        if (changed !== v) node.nodeValue = changed;
      }
    }

    fixIn(document.body);
    setTimeout(function () { fixIn(document.body); }, 1500);
    setTimeout(function () { fixIn(document.body); }, 5000);
  }

  /* ===== Init ===== */
  function init() {
    injectStyles();
    setupKeyboardSafety();
    aliasMarketingSections();
    addGenerateSubLabel();
    rewriteHelpMeStartHelper();
    rebuildWhatNext();
    imageResultPolish();
    titleCaseSweep();

    setTimeout(setWhatNextTitle, 100);
    setTimeout(setWhatNextTitle, 600);
    setTimeout(setWhatNextTitle, 1500);
    setTimeout(setWhatNextTitle, 3000);
  }

  function bootstrap() {
    init();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () {
        setWhatNextTitle();
        setTimeout(setWhatNextTitle, 500);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
