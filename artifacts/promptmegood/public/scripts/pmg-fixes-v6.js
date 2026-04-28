/* PromptMeGood — North Star QC pass (v6)
 * All fixes additive on top of v2/v3/v4/v5.
 * No renames of existing IDs/classes/vars.
 * No CSS order / flex reorder on sections.
 * CSS variables only.
 */
(function () {
  'use strict';

  var FLAGS = {};
  function once(name) {
    if (FLAGS[name]) return false;
    FLAGS[name] = true;
    return true;
  }

  /* ===================================================================
   * STYLES (Fixes 1, 2, 3, 4, 7, 8, 9, 11, 12)
   * =================================================================== */
  function injectStyles() {
    if (!once('styles')) return;
    var css = [
      /* ===== FIX 11: keyframes ===== */
      '@keyframes pmgFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes pmgPulse { 0%, 100% { box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); } 50% { box-shadow: 0 4px 28px color-mix(in srgb, var(--color-primary) 50%, transparent); } }',
      '@keyframes pmgShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
      '@keyframes pmgSnap { 0% { transform: scaleY(1); } 50% { transform: scaleY(0.96); } 100% { transform: scaleY(1); } }',

      /* ===== FIX 1: hero polish (additive — main hero work already shipped in v5) ===== */
      '.hero-text-link { display: block; text-align: center; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); text-decoration: underline; text-underline-offset: 3px; transition: color 180ms ease; }',
      '.hero-text-link:hover { color: var(--color-primary); }',
      'aside.hero-card { display: none !important; }',
      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(0.75rem, 1.5vw, 1.25rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-2) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-2) !important; }',
      '  .hero-actions { margin-bottom: var(--space-2) !important; }',
      '}',

      /* ===== FIX 2: builder above the fold (alias .pmg-marketing alongside v5 .pmg-marketing-section) ===== */
      '@media (min-width: 920px) {',
      '  .pmg-marketing { display: none !important; }',
      '  .pmg-marketing.pmg-shown { display: block !important; }',
      '}',

      /* ===== FIX 3: mode-switch pills ===== */
      '.mode-switch-btn { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-2)) !important; color: var(--color-text-muted) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)) !important; border-radius: var(--radius-full) !important; font-weight: 600 !important; min-height: 48px !important; padding: 10px 20px !important; cursor: pointer !important; transition: all 180ms ease !important; }',
      '.mode-switch-btn:hover:not(.active) { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-2)) !important; border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border)) !important; color: var(--color-primary) !important; }',
      '.mode-switch-btn.active { background: var(--color-primary) !important; color: #ffffff !important; border-color: var(--color-primary) !important; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 35%, transparent) !important; font-weight: 700 !important; }',

      /* ===== FIX 4: hide things that don't help the journey ===== */
      '.tip-block, .generate-helper-tip, [data-action="dismiss-tips"] { display: none !important; }',
      '.guided-cta-recommended-badge, .weekly-new-badge, #weekly-goal-new-badge { display: none !important; }',
      '#replay-tour-btn-builder { display: none !important; }',
      'body:not(.pmg-expert-mode) #keyboard-hints { display: none !important; }',

      /* ===== FIX 4: Expert Mode visible row ===== */
      '.pmg-expert-mode-row { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }',
      '.pmg-expert-toggle { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-2)); border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)); border-radius: var(--radius-full); padding: 6px 14px; cursor: pointer; transition: all 180ms ease; }',
      '.pmg-expert-toggle:hover { color: var(--color-primary); border-color: var(--color-primary); }',
      '.pmg-expert-hint { font-size: var(--text-xs); color: var(--color-text-faint); }',

      /* ===== FIX 4: helper text below Help Me Start (not in a box) ===== */
      '.pmg-help-me-start-helper { display: block; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); padding: 0 var(--space-1); }',

      /* ===== FIX 6: post-gen stacked action rows ===== */
      '.pmg-action-stack { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4); }',
      '.pmg-action-row { display: flex; flex-direction: column; gap: var(--space-1); padding: 0; }',
      '.pmg-action-btn { width: 100%; min-height: 56px; border-radius: var(--radius-md); font-size: var(--text-base); font-weight: 700; cursor: pointer; padding: var(--space-3) var(--space-4); display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 120ms ease, box-shadow 200ms ease; }',
      '.pmg-action-btn:active { transform: translateY(1px); }',
      '.pmg-action-btn.pmg-primary { background: var(--color-primary); color: #ffffff; border: 1.5px solid var(--color-primary); box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); }',
      '.pmg-action-btn.pmg-secondary { background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-2)); color: var(--color-primary); border: 1.5px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)); }',
      '.pmg-action-desc { font-size: var(--text-sm); color: var(--color-text-muted); padding: 0 var(--space-1); line-height: 1.4; }',
      '.pmg-action-row { opacity: 0; animation: pmgFadeUp 300ms ease forwards; }',
      '.pmg-action-row.pmg-row-1 { animation-delay: 0ms; }',
      '.pmg-action-row.pmg-row-2 { animation-delay: 100ms; }',
      '.pmg-action-row.pmg-row-3 { animation-delay: 200ms; }',
      '@media (max-width: 768px) {',
      '  .pmg-action-btn { min-height: 52px; }',
      '}',

      /* ===== FIX 6: result panel prominence after generation ===== */
      '#result-panel.pmg-result-revealed { box-shadow: 0 8px 32px color-mix(in srgb, var(--color-primary) 20%, transparent); transition: box-shadow 400ms ease; animation: pmgFadeUp 400ms ease forwards; scroll-margin-top: 24px; }',
      '#result-panel { scroll-margin-top: 24px; }',

      /* ===== FIX 11 + FIX 4 + FIX 6: generating button pulse + label ===== */
      '#generateBtn.pmg-generating, #image-generate-btn.pmg-generating { animation: pmgPulse 1.5s ease infinite; }',

      /* ===== FIX 7: button hierarchy override ===== */
      /* PRIMARY */
      '#generateBtn, #image-generate-btn, #runBtn, #guided-finish, #guided-mode-btn, #pmg-build-image-btn { background: var(--color-primary) !important; color: #ffffff !important; border: 1.5px solid var(--color-primary) !important; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent) !important; min-height: 52px; }',
      /* SECONDARY (cover commonly-found buttons + open-in tool buttons) */
      '#copy-btn, #fine-tune-btn, .refine-buttons .btn, .refine-buttons button, .open-in-btn, .copy-shareable-btn, #export-btn, #import-btn, #compare-btn, #download-image-btn, #generate-another-btn, .copy-response-btn, .run-again-btn { background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface-2)) !important; color: var(--color-primary) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border)) !important; font-weight: 600 !important; }',
      /* TERTIARY */
      '#clear-prompt-btn, #print-btn, .collapse-all-btn, #undo-last-change-btn, .skip-btn, #guided-skip, #guided-back, #guided-q-back { background: var(--color-surface-2) !important; color: var(--color-text-muted) !important; border: 1px solid var(--color-border) !important; }',
      /* DESTRUCTIVE */
      '.btn-destructive, [data-destructive="true"], #clear-history-btn { background: color-mix(in srgb, #dc2626 10%, var(--color-surface-2)) !important; color: #dc2626 !important; border: 1px solid color-mix(in srgb, #dc2626 25%, var(--color-border)) !important; }',
      /* No raw white anywhere */
      '.btn[style*="background:#fff"], .btn[style*="background: #fff"], button[style*="background:#fff"], button[style*="background: #fff"] { background: var(--color-surface-2) !important; }',

      /* ===== FIX 8: text field interactivity ===== */
      '#goal, #fine-tune-input, #details, #mobile-sticky-input, .pmg-photo-text-input, textarea.pmg-text { background: var(--color-surface) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border)) !important; border-radius: var(--radius-md) !important; padding: var(--space-4) !important; font-size: var(--text-base) !important; color: var(--color-text) !important; cursor: text !important; transition: border-color 180ms ease, box-shadow 180ms ease !important; }',
      '#goal, #fine-tune-input, #details, textarea.pmg-text { min-height: 100px !important; }',
      '#goal:focus, #fine-tune-input:focus, #details:focus, #mobile-sticky-input:focus, .pmg-photo-text-input:focus, textarea.pmg-text:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent) !important; outline: none !important; }',
      '#goal::placeholder, #fine-tune-input::placeholder, #details::placeholder, #mobile-sticky-input::placeholder, .pmg-photo-text-input::placeholder { color: var(--color-text-faint) !important; font-style: italic !important; }',

      /* ===== FIX 9: site-wide pill styling (target known pill classes; no CSS reset of selected state colors that already have specific overrides) ===== */
      '.pmg-photo-pill, .suggestion-chip, .use-case-chip, .pmg-pill { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)) !important; color: var(--color-text) !important; border: 1.5px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)) !important; border-radius: var(--radius-full) !important; font-weight: 500 !important; padding: 8px 16px !important; cursor: pointer !important; transition: all 150ms ease !important; }',
      '.pmg-photo-pill:hover:not(.selected), .suggestion-chip:hover:not(.selected), .use-case-chip:hover:not(.selected), .pmg-pill:hover:not(.selected) { background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface)) !important; border-color: var(--color-primary) !important; color: var(--color-primary) !important; }',
      '.pmg-photo-pill.selected, .suggestion-chip.selected, .use-case-chip.selected, .pmg-pill.selected { background: var(--color-primary) !important; color: #ffffff !important; border-color: var(--color-primary) !important; font-weight: 700 !important; transform: scale(1.02); }',

      /* ===== FIX 6: hide v5 grid when stacked rows are mounted ===== */
      '#what-next.pmg-stacked .pmg-wn-grid { display: none !important; }',
      '#what-next.pmg-stacked .what-next-list { display: none !important; }',

      /* ===== FIX 12: mobile reinforcement ===== */
      '@media (max-width: 768px) {',
      '  .site-search, #global-search-input, .global-search, .search-label, .search-helper { display: none !important; }',
      '  .btn, button, [role="button"] { min-height: 44px; }',
      '}'
    ].join('\n');

    var s = document.createElement('style');
    s.id = 'pmg-fixes-v6-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ===================================================================
   * FIX 1: hero secondary CTA — add hero-text-link class (text-only)
   * =================================================================== */
  function polishHeroSecondaryCta() {
    if (!once('heroSecondaryCta')) return;
    var a = document.getElementById('hero-usecases-cta');
    if (!a) return;
    a.classList.add('hero-text-link');
    /* Ensure visible label is concise */
    var titleEl = a.querySelector('.cta-title');
    if (titleEl) {
      titleEl.textContent = 'Or See Real Examples →';
    } else if (!a.querySelector('.cta-sub')) {
      var current = (a.textContent || '').trim();
      if (!/Real Examples/i.test(current)) {
        a.textContent = 'Or See Real Examples →';
      }
    }
  }

  /* ===================================================================
   * FIX 2: alias .pmg-marketing on the 5 sections + reveal observers
   * =================================================================== */
  function aliasPmgMarketing() {
    if (!once('pmgMarketingAlias')) return;
    var ids = ['use-cases', 'why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    var nodes = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    nodes.forEach(function (n) { n.classList.add('pmg-marketing'); });

    /* If section already has v5's .pmg-revealed, mirror to .pmg-shown */
    nodes.forEach(function (n) {
      if (n.classList.contains('pmg-revealed') || n.classList.contains('revealed')) {
        n.classList.add('pmg-shown');
      }
    });

    /* IntersectionObserver on #builder — reveal all when builder leaves viewport */
    var builder = document.getElementById('builder');
    if (builder && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) {
            nodes.forEach(function (n) { n.classList.add('pmg-shown'); });
          }
        });
      }, { threshold: 0.1 });
      io.observe(builder);
    }

    /* Anchor click reveals all marketing sections immediately */
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var id = href.slice(1);
      if (ids.indexOf(id) !== -1) {
        nodes.forEach(function (n) { n.classList.add('pmg-shown'); });
      }
    }, true);

    /* Mirror v5 reveal class on these 5 nodes */
    var mo = new MutationObserver(function () {
      nodes.forEach(function (n) {
        if ((n.classList.contains('pmg-revealed') || n.classList.contains('revealed')) && !n.classList.contains('pmg-shown')) {
          n.classList.add('pmg-shown');
        }
      });
    });
    nodes.forEach(function (n) { mo.observe(n, { attributes: true, attributeFilter: ['class'] }); });
  }

  /* ===================================================================
   * FIX 4: move Help Me Start (#guided-mode-btn) below Fix My Prompt
   * Also drop the boxed helper and add a plain helper line below it.
   * =================================================================== */
  function reorderHelpMeStart() {
    if (!once('reorderHelpMeStart')) return;
    var help = document.getElementById('guided-mode-btn');
    var generate = document.getElementById('generateBtn');
    if (!help || !generate) return;

    var ctaRow = help.closest('#guided-cta-row, .guided-cta-row');

    /* Strip wrapping CTA row decorations so the button is clean */
    if (ctaRow) {
      var strong = ctaRow.querySelector('.guided-cta-text strong, .guided-cta-text h3, .guided-cta-text');
      if (strong) strong.style.display = 'none';
      var badge = ctaRow.querySelector('.guided-cta-recommended-badge, .recommended-badge');
      if (badge) badge.style.display = 'none';
    }

    /* Move help button to live as a sibling immediately after #generateBtn */
    if (generate.parentNode && help !== generate.nextElementSibling) {
      generate.parentNode.insertBefore(help, generate.nextSibling);
    }

    /* Inline helper below the button (not in a box) */
    if (!document.getElementById('pmg-help-me-start-helper')) {
      var p = document.createElement('p');
      p.id = 'pmg-help-me-start-helper';
      p.className = 'pmg-help-me-start-helper';
      p.textContent = 'Answer 4 quick questions and we\'ll fill everything in for you.';
      if (help.parentNode) help.parentNode.insertBefore(p, help.nextSibling);
    }

    /* Clean any empty CTA row leftover */
    if (ctaRow && !ctaRow.querySelector('button, a.btn')) {
      ctaRow.style.display = 'none';
    }
  }

  /* ===================================================================
   * FIX 4: visible Expert Mode button row
   * =================================================================== */
  function addExpertModeRow() {
    if (!once('expertModeRow')) return;
    if (document.getElementById('pmg-expert-toggle-btn')) return;

    /* Find any existing fine-print expert toggle (existing #expert-toggle, .expert-mode-toggle, etc.) */
    var existing = document.querySelector('#expert-toggle, .expert-mode-toggle, [data-toggle="expert-mode"]');

    /* Anchor must be visible — never inside a collapsed <details>.
     * Prefer the parent of #generateBtn so the row sits in the main flow. */
    var anchor = null;
    var generate = document.getElementById('generateBtn');
    if (generate && generate.parentNode) anchor = generate.parentNode;
    /* If that parent is itself inside a <details>, walk up until we are out */
    while (anchor && anchor.closest && anchor.closest('details')) {
      var details = anchor.closest('details');
      anchor = (details && details.parentNode) ? details.parentNode : null;
    }
    if (!anchor) return;

    var row = document.createElement('div');
    row.className = 'pmg-expert-mode-row';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-expert-toggle-btn';
    btn.className = 'pmg-expert-toggle';
    btn.textContent = '⚙ Expert Mode';
    btn.setAttribute('inputmode', 'none');

    var hint = document.createElement('span');
    hint.className = 'pmg-expert-hint';
    hint.textContent = 'Full Control Over Every Setting';

    btn.addEventListener('click', function () {
      document.body.classList.toggle('pmg-expert-mode');
      if (existing && typeof existing.click === 'function') {
        try { existing.click(); } catch (e) {}
      }
    });

    row.appendChild(btn);
    row.appendChild(hint);

    /* Append at end of anchor */
    anchor.appendChild(row);
  }

  /* ===================================================================
   * FIX 4 + 11: pulse + label change on Fix My Prompt while generating
   * =================================================================== */
  function decorateGenerateButton() {
    if (!once('decorateGenerate')) return;
    var btn = document.getElementById('generateBtn');
    if (!btn) return;

    var labelEl = btn.querySelector('.btn-label, .cta-title') || btn;
    var originalText = (labelEl === btn ? btn.textContent : labelEl.textContent) || 'Fix My Prompt';

    var imgBtn = document.getElementById('image-generate-btn');

    function startPulse(target, loadingText) {
      if (!target) return;
      /* Re-entry guard: if we're already pulsing, do not overwrite the saved original */
      if (target.classList.contains('pmg-generating')) return;
      target.classList.add('pmg-generating');
      if (!target.hasAttribute('data-pmg-orig-text')) {
        target.setAttribute('data-pmg-orig-text', target.textContent || '');
      }
      target.textContent = loadingText;
    }
    function stopPulse(target, fallbackText) {
      if (!target) return;
      target.classList.remove('pmg-generating');
      var orig = target.getAttribute('data-pmg-orig-text');
      if (orig) target.textContent = orig;
      else if (fallbackText) target.textContent = fallbackText;
      target.removeAttribute('data-pmg-orig-text');
    }

    btn.addEventListener('click', function () {
      startPulse(btn, 'Building Your Prompt...');
      /* Stop pulse when result panel reveals OR after 30s safety */
      var killed = false;
      function cleanup() {
        if (killed) return;
        killed = true;
        stopPulse(btn, originalText);
      }
      setTimeout(cleanup, 30000);
      var resultPanel = document.getElementById('result-panel');
      if (resultPanel && 'MutationObserver' in window) {
        var rmo = new MutationObserver(function () {
          var visible = resultPanel.offsetParent !== null && (resultPanel.textContent || '').trim().length > 30;
          if (visible) {
            cleanup();
            rmo.disconnect();
          }
        });
        rmo.observe(resultPanel, { childList: true, subtree: true, attributes: true });
        setTimeout(function () { rmo.disconnect(); }, 30000);
      }
    });

    if (imgBtn) {
      imgBtn.addEventListener('click', function () {
        startPulse(imgBtn, 'Creating Your Image With DALL·E 3...');
        setTimeout(function () { stopPulse(imgBtn); }, 30000);
        var imgRes = document.getElementById('imageResultSection');
        if (imgRes && 'MutationObserver' in window) {
          var imo = new MutationObserver(function () {
            if (!imgRes.hidden && imgRes.querySelector('img')) {
              stopPulse(imgBtn);
              imo.disconnect();
            }
          });
          imo.observe(imgRes, { childList: true, subtree: true, attributes: true });
          setTimeout(function () { imo.disconnect(); }, 30000);
        }
      });
    }
  }

  /* ===================================================================
   * FIX 6: post-generation result flow — stacked Run/Copy/Refine rows
   * (replaces v5 .pmg-wn-grid by hiding it via .pmg-stacked class)
   * =================================================================== */
  function rebuildPostGenStack() {
    if (!once('postGenStack')) return;
    var wn = document.getElementById('what-next');
    if (!wn) return;

    /* Title kept (v5 already sets it) */
    wn.classList.add('pmg-stacked');

    if (wn.querySelector('.pmg-action-stack')) return;

    var stack = document.createElement('div');
    stack.className = 'pmg-action-stack';

    var rows = [
      {
        rowClass: 'pmg-row-1',
        btnClass: 'pmg-primary',
        label: '▶ Run With AI',
        desc: 'See your AI answer right here — no copy-paste needed',
        click: function () {
          var rb = document.getElementById('runBtn');
          if (rb) { rb.click(); return; }
          if (typeof window.runWithAI === 'function') window.runWithAI();
        }
      },
      {
        rowClass: 'pmg-row-2',
        btnClass: 'pmg-secondary',
        label: 'Copy Prompt',
        desc: 'Take it to ChatGPT, Claude, or any AI tool you already use',
        click: function () {
          var cb = document.getElementById('copy-btn');
          if (cb) cb.click();
        }
      },
      {
        rowClass: 'pmg-row-3',
        btnClass: 'pmg-secondary',
        label: 'Refine It',
        desc: 'Make it stronger before you run it',
        click: function () {
          var fi = document.getElementById('fine-tune-input');
          if (fi) {
            try { fi.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            setTimeout(function () { try { fi.focus(); } catch (e2) {} }, 400);
          }
        }
      }
    ];

    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'pmg-action-row ' + r.rowClass;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-action-btn ' + r.btnClass;
      btn.textContent = r.label;
      btn.setAttribute('inputmode', 'none');
      btn.addEventListener('click', r.click);

      var desc = document.createElement('p');
      desc.className = 'pmg-action-desc';
      desc.textContent = r.desc;

      row.appendChild(btn);
      row.appendChild(desc);
      stack.appendChild(row);
    });

    wn.appendChild(stack);
  }

  /* ===================================================================
   * FIX 6: result panel reveal animation + scroll-into-view
   * =================================================================== */
  function watchResultPanel() {
    if (!once('watchResult')) return;
    var rp = document.getElementById('result-panel');
    if (!rp || !('MutationObserver' in window)) return;

    var revealed = false;
    var mo = new MutationObserver(function () {
      if (revealed) return;
      var visible = rp.offsetParent !== null;
      var hasContent = (rp.textContent || '').replace(/\s+/g, '').length > 30;
      if (visible && hasContent) {
        revealed = true;
        rp.classList.add('pmg-result-revealed');
        try { rp.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
        /* one-shot — never re-grab focus on later mutations (stream updates etc) */
        mo.disconnect();
      }
    });
    mo.observe(rp, { childList: true, subtree: true, attributes: true });
  }

  /* ===================================================================
   * FIX 10: extend mobile keyboard hardening (v5 covers most; add inputmode)
   * =================================================================== */
  function hardenMobileKeyboard() {
    if (!once('mobileKeyboardV6')) return;
    var TEXT_INPUTS = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="number"],input[type="password"],input[type="tel"],input[type="url"],textarea,[contenteditable="true"],[contenteditable=""]';

    var sels = [
      'button', 'a.btn', '[role="button"]',
      '.btn-secondary', '.btn-ghost', '.accent-swatch',
      '.popular-use-card', '.mode-switch-btn', '.pmg-photo-pill',
      '.suggestion-chip', '.use-case-chip', '.pmg-pill',
      '.history-btn', '.template-btn', 'summary',
      '.refine-buttons button', '.refine-buttons .btn',
      '.open-in-btn', '.pmg-action-btn'
    ];

    function applyInputmode(root) {
      var nodes;
      try { nodes = (root || document).querySelectorAll(sels.join(',')); }
      catch (e) { return; }
      Array.prototype.forEach.call(nodes, function (n) {
        if (n.matches && n.matches(TEXT_INPUTS)) return;
        if (n.tagName === 'BUTTON' && n.type === 'submit' && n.closest('form') && n.closest('form').querySelector(TEXT_INPUTS)) return;
        if (!n.hasAttribute('inputmode')) n.setAttribute('inputmode', 'none');
      });
    }
    applyInputmode(document);
    setTimeout(function () { applyInputmode(document); }, 1500);
    setTimeout(function () { applyInputmode(document); }, 5000);

    /* Sticky bar attrs reinforcement */
    var sticky = document.getElementById('mobile-sticky-input');
    if (sticky) {
      sticky.removeAttribute('autofocus');
      sticky.setAttribute('autocomplete', 'off');
      sticky.setAttribute('autocorrect', 'off');
      sticky.setAttribute('autocapitalize', 'off');
      sticky.setAttribute('spellcheck', 'false');
    }

    /* Wizard touch-action */
    var wiz = document.querySelector('.pmg-wizard, #pmg-wizard, .guided-wizard, [data-wizard]');
    if (wiz) wiz.style.touchAction = 'pan-y';

    /* Blur on non-input click */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var clickable = t.closest('button, a[href], [role="button"], .pmg-action-btn, .pmg-photo-pill, .pmg-pill, .mode-switch-btn');
      if (!clickable) return;
      if (clickable.matches && clickable.matches(TEXT_INPUTS)) return;
      var inside = clickable.querySelector && clickable.querySelector(TEXT_INPUTS);
      if (inside) return;
      setTimeout(function () {
        var ae = document.activeElement;
        if (ae && ae !== document.body && typeof ae.blur === 'function') {
          try { ae.blur(); } catch (e) {}
        }
      }, 10);
    }, true);
  }

  /* ===================================================================
   * FIX 13: title case sweep extension (additive to v5)
   * =================================================================== */
  function titleCaseSweepV6() {
    if (!once('titleCaseV6')) return;
    var pairs = [
      ['Improve with AI', 'Improve With AI'],
      ['Check prompt quality', 'Check Prompt Quality'],
      ['Use demo values', 'Use Demo Values'],
      ['Show archived', 'Show Archived'],
      ['Compare two', 'Compare Two'],
      ['Collapse all', 'Collapse All'],
      ['Clear all history', 'Clear All History'],
      ['Export everything', 'Export Everything'],
      ['Import backup', 'Import Backup'],
      ['Backup / restore', 'Backup / Restore'],
      ['Notes only', 'Notes Only'],
      ['Use this →', 'Use This →'],
      ['Use your prompt in:', 'Use Your Prompt In:'],
      ['Use your prompt in', 'Use Your Prompt In'],
      ['Tag insights', 'Tag Insights'],
      ['Daily streak', 'Daily Streak'],
      ['Saved prompts', 'Saved Prompts'],
      ['Total reuses', 'Total Reuses'],
      ['Top tag', 'Top Tag'],
      ['This week at a glance', 'This Week At A Glance'],
      ['Why most AI prompts fail', 'Why Most AI Prompts Fail'],
      ['What people are saying', 'What People Are Saying'],
      ['See the difference', 'See The Difference'],
      ['Build my image', 'Build My Image'],
      ['Generate another', 'Generate Another'],
      ['Skip this step →', 'Skip This Step →'],
      ['Tap to edit', 'Tap To Edit'],
      ['Add a reference image (optional)', 'Add A Reference Image (Optional)'],
      ['THIS WEEK\'S FOCUS', 'This Week\'s Focus'],
      ['THIS WEEK AT A GLANCE', 'This Week At A Glance'],
      ['MOST-USED TEMPLATE', 'Most-Used Template'],
      ['MOST-USED PROMPT', 'Most-Used Prompt'],
      ['DAILY STREAK', 'Daily Streak'],
      ['SAVED PROMPTS', 'Saved Prompts'],
      ['TOTAL REUSES', 'Total Reuses'],
      ['TOP TAG', 'Top Tag'],
      ['WHY IT MATTERS', 'Why It Matters'],
      ['EARLY FEEDBACK', 'Early Feedback'],
      ['REFINE YOUR PROMPT INSTANTLY', 'Refine Your Prompt'],
      ['Update prompt', 'Update Prompt'],
      ['Print / save PDF', 'Print / Save PDF'],
      ['Copy shareable link', 'Copy Shareable Link']
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

  /* ===================================================================
   * Init
   * =================================================================== */
  function init() {
    injectStyles();
    polishHeroSecondaryCta();
    aliasPmgMarketing();
    reorderHelpMeStart();
    addExpertModeRow();
    decorateGenerateButton();
    rebuildPostGenStack();
    watchResultPanel();
    hardenMobileKeyboard();
    titleCaseSweepV6();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
