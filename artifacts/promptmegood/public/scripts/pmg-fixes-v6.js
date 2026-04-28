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
      /* Per user override: keep hero-card visible at all sizes (was hidden by brief). */
      'aside.hero-card { display: block !important; }',
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
      'body:not(.pmg-expert-mode):not(.is-expert-mode) #keyboard-hints { display: none !important; }',

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
      '}',

      /* ===== FIX 5: photographer accordion ===== */
      '#pmg-photo-accordion { display: none; margin-top: var(--space-3); margin-bottom: var(--space-4); flex-direction: column; gap: var(--space-3); }',
      'body.image-mode #pmg-photo-accordion { display: flex; }',
      'body.image-mode #weekly-goal-pin { display: none !important; }',
      '.pmg-photo-card { background: var(--color-surface-2); border: 1.5px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border)); border-radius: var(--radius-lg); padding: var(--space-4); transition: border-color 200ms ease, box-shadow 200ms ease, max-height 280ms ease, padding 200ms ease, opacity 200ms ease; overflow: hidden; }',
      '.pmg-photo-card.pmg-photo-active { border-color: var(--color-primary); box-shadow: 0 4px 18px color-mix(in srgb, var(--color-primary) 14%, transparent); }',
      '.pmg-photo-card.pmg-photo-collapsed { padding: var(--space-3) var(--space-4); animation: pmgSnap 200ms ease; }',
      '.pmg-photo-card.pmg-photo-collapsed .pmg-photo-body { display: none; }',
      '.pmg-photo-card.pmg-photo-pending { opacity: 0.5; pointer-events: none; }',
      '.pmg-photo-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); cursor: pointer; user-select: none; }',
      '.pmg-photo-title { font-size: var(--text-base); font-weight: 700; color: var(--color-text); margin: 0; flex: 1; }',
      '.pmg-photo-card.pmg-photo-collapsed .pmg-photo-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); }',
      '.pmg-photo-edit-link { font-size: var(--text-xs); font-weight: 600; color: var(--color-primary); text-decoration: none; white-space: nowrap; }',
      '.pmg-photo-card:not(.pmg-photo-collapsed) .pmg-photo-edit-link { display: none; }',
      '.pmg-photo-body { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }',
      '.pmg-photo-pills { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.pmg-photo-text-input { width: 100%; }',
      '.pmg-photo-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; margin-top: var(--space-2); }',
      '.pmg-photo-next-btn { background: var(--color-primary) !important; color: #ffffff !important; border: 1.5px solid var(--color-primary) !important; border-radius: var(--radius-full); padding: 8px 18px; font-size: var(--text-sm); font-weight: 700; cursor: pointer; min-height: 40px; }',
      '.pmg-photo-skip-link { font-size: var(--text-sm); color: var(--color-text-muted); text-decoration: underline; cursor: pointer; background: transparent; border: 0; }',
      '#pmg-build-image-btn { display: none; width: 100%; min-height: 56px; border-radius: var(--radius-full); border: 1.5px solid var(--color-primary); background: var(--color-primary); color: #ffffff; font-weight: 800; font-size: var(--text-base); cursor: pointer; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent); margin-top: var(--space-2); }',
      'body.image-mode #pmg-build-image-btn.pmg-ready { display: inline-flex; align-items: center; justify-content: center; }',
      '#pmg-photo-build-msg { display: none; margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); padding: var(--space-2) var(--space-3); background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary); }',
      '#pmg-photo-build-msg.pmg-shown { display: block; animation: pmgFadeUp 300ms ease forwards; }',

      /* ===== FIX 5/11: image result loading shimmer + reveal ===== */
      '#imageResultWrap.pmg-shimmer { background: linear-gradient(90deg, var(--color-surface-2) 25%, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-2)) 50%, var(--color-surface-2) 75%); background-size: 200% 100%; animation: pmgShimmer 1.5s linear infinite; }',
      '#imageResultSection.pmg-revealed { animation: pmgFadeUp 400ms ease forwards; scroll-margin-top: 24px; }',
      '#imageResultSection { scroll-margin-top: 24px; }'
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

    function revealAll() {
      nodes.forEach(function (n) { n.classList.add('pmg-shown'); });
    }
    function allShown() {
      for (var i = 0; i < nodes.length; i++) if (!nodes[i].classList.contains('pmg-shown')) return false;
      return true;
    }

    /* IntersectionObserver on #builder — reveal all when builder leaves viewport (single-shot) */
    var builder = document.getElementById('builder');
    var io = null;
    if (builder && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) {
            revealAll();
            if (io) { io.disconnect(); io = null; }
          }
        });
      }, { threshold: 0.1 });
      io.observe(builder);
    }

    /* Anchor click reveals all marketing sections immediately (single-shot) */
    function anchorHandler(ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var id = href.slice(1);
      if (ids.indexOf(id) !== -1) {
        revealAll();
        document.removeEventListener('click', anchorHandler, true);
        if (io) { io.disconnect(); io = null; }
      }
    }
    document.addEventListener('click', anchorHandler, true);

    /* Mirror v5 reveal class on these 5 nodes — disconnect after all revealed */
    var mo = new MutationObserver(function () {
      nodes.forEach(function (n) {
        if ((n.classList.contains('pmg-revealed') || n.classList.contains('revealed')) && !n.classList.contains('pmg-shown')) {
          n.classList.add('pmg-shown');
        }
      });
      if (allShown()) { mo.disconnect(); }
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
      var nextOn = !document.body.classList.contains('is-expert-mode');
      /* Mirror onto BOTH classes so v6 and existing code (v5/index.html) agree */
      document.body.classList.toggle('pmg-expert-mode', nextOn);
      document.body.classList.toggle('is-expert-mode', nextOn);
      /* Drive the underlying checkbox so existing handlers also fire */
      var checkbox = document.getElementById('expert-mode-toggle');
      if (checkbox) {
        if (checkbox.checked !== nextOn) {
          checkbox.checked = nextOn;
          try { checkbox.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      } else if (existing && typeof existing.click === 'function') {
        try { existing.click(); } catch (e) {}
      }
    });

    /* If existing toggle changes via other code paths, mirror onto v6 class */
    var checkbox = document.getElementById('expert-mode-toggle');
    if (checkbox) {
      checkbox.addEventListener('change', function () {
        document.body.classList.toggle('pmg-expert-mode', !!checkbox.checked);
      });
    }
    /* Also observe is-expert-mode → mirror onto pmg-expert-mode */
    if ('MutationObserver' in window) {
      var bmo = new MutationObserver(function () {
        var on = document.body.classList.contains('is-expert-mode');
        document.body.classList.toggle('pmg-expert-mode', on);
      });
      bmo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

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
   * FIX 5: photographer accordion
   * =================================================================== */
  var PHOTO_QUESTIONS = [
    {
      id: 'subject', kind: 'text',
      title: 'What Is Your Main Subject?',
      placeholder: 'A person, animal, object, landscape, scene...'
    },
    {
      id: 'shot', kind: 'pills',
      title: 'Shot Type — How Close Are We?',
      options: ['Extreme Close-Up (Face, Texture, Detail)', 'Close-Up (Head And Shoulders)', 'Medium Shot (Waist Up)', 'Full Body Shot', 'Wide Shot (Subject + Environment)', "Aerial / Bird's Eye View", "Worm's Eye View (Looking Up)", 'Over The Shoulder']
    },
    {
      id: 'lens', kind: 'pills',
      title: 'Camera Lens Feel?',
      options: ['Wide Angle (Expansive, Dramatic)', 'Standard (Natural, True To Life)', 'Telephoto (Compressed, Intimate)', 'Macro (Ultra Close Detail)', 'Fisheye (Distorted, Creative)', 'Tilt-Shift (Miniature Effect)']
    },
    {
      id: 'lighting', kind: 'pills',
      title: 'Lighting Setup?',
      options: ['Golden Hour (Warm, Soft Sunset)', 'Blue Hour (Cool, Moody Dusk)', 'Harsh Midday Sun (High Contrast)', 'Overcast (Soft, Even, No Shadows)', 'Studio Lighting (Clean, Controlled)', 'Neon & Artificial (Urban Night)', 'Candlelight / Fire (Warm, Intimate)', 'Backlit (Silhouette, Halo Effect)']
    },
    {
      id: 'mood', kind: 'pills',
      title: 'Mood And Color Palette?',
      options: ['Cinematic & Dramatic', 'Bright & Airy', 'Dark & Moody', 'Warm & Nostalgic', 'Cool & Minimal', 'Vibrant & Saturated', 'Black & White', 'Vintage Film Grain']
    },
    {
      id: 'camera', kind: 'text', optional: true,
      title: 'Camera And Film Style? (Optional)',
      placeholder: 'Shot on iPhone 16 Pro, Canon 5D, Kodak Portra 400, 35mm film, 8K RAW...'
    }
  ];

  /* Pretty label keys for collapsed headers */
  var LABEL_KEYS = { subject: 'Subject', shot: 'Shot', lens: 'Lens', lighting: 'Lighting', mood: 'Mood', camera: 'Camera' };

  function buildPhotoAccordion() {
    if (!once('photoAccordion')) return;
    if (document.getElementById('pmg-photo-accordion')) return;

    /* Anchor: insert just BEFORE the form so it appears under the mode pills + image hint */
    var hint = document.querySelector('.image-mode-hint');
    var form = document.getElementById('prompt-form');
    if (!form) return;

    var acc = document.createElement('div');
    acc.id = 'pmg-photo-accordion';
    acc.setAttribute('aria-label', 'Guided Image Builder');

    var answers = {};

    function selectionLabel(qId) {
      var v = answers[qId];
      if (!v) return '';
      var s = String(v);
      if (s.length > 56) s = s.slice(0, 53) + '...';
      return s;
    }

    function renderHeaderTitle(card, q, collapsed) {
      var titleEl = card.querySelector('.pmg-photo-title');
      if (!titleEl) return;
      if (collapsed && answers[q.id]) {
        titleEl.textContent = LABEL_KEYS[q.id] + ': ' + selectionLabel(q.id);
      } else {
        titleEl.textContent = q.title;
      }
    }

    function setActiveCard(idx) {
      var cards = acc.querySelectorAll('.pmg-photo-card');
      Array.prototype.forEach.call(cards, function (c, i) {
        c.classList.remove('pmg-photo-active', 'pmg-photo-pending');
        if (i < idx) {
          if (!c.classList.contains('pmg-photo-collapsed')) c.classList.add('pmg-photo-collapsed');
        } else if (i === idx) {
          c.classList.remove('pmg-photo-collapsed');
          c.classList.add('pmg-photo-active');
        } else {
          c.classList.add('pmg-photo-pending');
        }
        renderHeaderTitle(c, PHOTO_QUESTIONS[i], c.classList.contains('pmg-photo-collapsed'));
      });
      maybeShowBuildBtn();
    }

    function commitAndAdvance(idx) {
      var card = acc.querySelectorAll('.pmg-photo-card')[idx];
      if (!card) return;
      card.classList.add('pmg-photo-collapsed');
      card.classList.remove('pmg-photo-active');
      renderHeaderTitle(card, PHOTO_QUESTIONS[idx], true);
      var nextIdx = idx + 1;
      if (nextIdx < PHOTO_QUESTIONS.length) {
        setTimeout(function () { setActiveCard(nextIdx); }, 220);
      } else {
        maybeShowBuildBtn();
      }
    }

    function maybeShowBuildBtn() {
      var btn = document.getElementById('pmg-build-image-btn');
      if (!btn) return;
      /* Subject is required; the rest can be empty (skipped) */
      if (answers.subject && String(answers.subject).trim().length > 0) {
        btn.classList.add('pmg-ready');
      } else {
        btn.classList.remove('pmg-ready');
      }
    }

    PHOTO_QUESTIONS.forEach(function (q, idx) {
      var card = document.createElement('div');
      card.className = 'pmg-photo-card';
      card.setAttribute('data-pmg-q', q.id);
      if (idx > 0) card.classList.add('pmg-photo-pending');
      else card.classList.add('pmg-photo-active');

      var header = document.createElement('div');
      header.className = 'pmg-photo-header';
      var title = document.createElement('h4');
      title.className = 'pmg-photo-title';
      title.textContent = q.title;
      var edit = document.createElement('a');
      edit.href = '#';
      edit.className = 'pmg-photo-edit-link';
      edit.textContent = 'Tap To Edit';
      edit.addEventListener('click', function (ev) { ev.preventDefault(); setActiveCard(idx); });
      header.appendChild(title);
      header.appendChild(edit);
      header.addEventListener('click', function (ev) {
        if (ev.target.tagName === 'A') return;
        if (card.classList.contains('pmg-photo-collapsed')) setActiveCard(idx);
      });
      card.appendChild(header);

      var body = document.createElement('div');
      body.className = 'pmg-photo-body';

      if (q.kind === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pmg-photo-text-input';
        input.placeholder = q.placeholder || '';
        input.setAttribute('aria-label', q.title);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); confirmText(); }
        });
        body.appendChild(input);

        var actions = document.createElement('div');
        actions.className = 'pmg-photo-actions';
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'pmg-photo-next-btn';
        nextBtn.textContent = idx === PHOTO_QUESTIONS.length - 1 ? 'Done' : 'Next →';
        nextBtn.setAttribute('inputmode', 'none');
        nextBtn.addEventListener('click', confirmText);
        actions.appendChild(nextBtn);

        if (q.optional) {
          var skip = document.createElement('button');
          skip.type = 'button';
          skip.className = 'pmg-photo-skip-link';
          skip.textContent = 'Skip This Step →';
          skip.setAttribute('inputmode', 'none');
          skip.addEventListener('click', function () {
            answers[q.id] = '';
            commitAndAdvance(idx);
          });
          actions.appendChild(skip);
        }
        body.appendChild(actions);

        function confirmText() {
          var v = (input.value || '').trim();
          if (!v && !q.optional) { input.focus(); return; }
          answers[q.id] = v;
          commitAndAdvance(idx);
        }
      } else if (q.kind === 'pills') {
        var pills = document.createElement('div');
        pills.className = 'pmg-photo-pills';
        q.options.forEach(function (opt) {
          var p = document.createElement('button');
          p.type = 'button';
          p.className = 'pmg-photo-pill';
          p.textContent = opt;
          p.setAttribute('inputmode', 'none');
          p.addEventListener('click', function () {
            Array.prototype.forEach.call(pills.querySelectorAll('.pmg-photo-pill'), function (sib) { sib.classList.remove('selected'); });
            p.classList.add('selected');
            answers[q.id] = opt;
            setTimeout(function () { commitAndAdvance(idx); }, 800);
          });
          pills.appendChild(p);
        });
        body.appendChild(pills);
      }
      card.appendChild(body);
      acc.appendChild(card);
    });

    /* Build button */
    var buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.id = 'pmg-build-image-btn';
    buildBtn.textContent = 'Build My Image';
    buildBtn.setAttribute('inputmode', 'none');
    buildBtn.addEventListener('click', function () {
      var subject = (answers.subject || '').trim();
      if (!subject) return;
      var parts = [];
      var lead = answers.shot ? (String(answers.shot).split(' (')[0] + ' of ') : '';
      parts.push(lead + subject);
      if (answers.lens) parts.push(String(answers.lens).split(' (')[0] + ' lens');
      if (answers.lighting) parts.push(String(answers.lighting).split(' (')[0]);
      if (answers.mood) parts.push(String(answers.mood));
      if (answers.camera && String(answers.camera).trim()) parts.push(String(answers.camera).trim());
      var phrase = parts.join(', ');

      var goal = document.getElementById('goal');
      if (goal) {
        /* Animate text flowing into textarea */
        goal.value = '';
        try { goal.focus(); } catch (e) {}
        var i = 0;
        var step = Math.max(1, Math.floor(phrase.length / 60));
        var timer = setInterval(function () {
          i = Math.min(phrase.length, i + step);
          goal.value = phrase.slice(0, i);
          try { goal.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
          if (i >= phrase.length) {
            clearInterval(timer);
            try { goal.blur(); } catch (e) {}
          }
        }, 18);
      }

      /* Confirmation message */
      var msg = document.getElementById('pmg-photo-build-msg');
      if (!msg) {
        msg = document.createElement('p');
        msg.id = 'pmg-photo-build-msg';
        msg.textContent = 'Your Image Description Is Ready — Click Generate Image To Create It.';
        buildBtn.parentNode.insertBefore(msg, buildBtn.nextSibling);
      }
      msg.classList.add('pmg-shown');

      /* Smooth-collapse the entire accordion (visually) */
      Array.prototype.forEach.call(acc.querySelectorAll('.pmg-photo-card'), function (c, i) {
        c.classList.add('pmg-photo-collapsed');
        renderHeaderTitle(c, PHOTO_QUESTIONS[i], true);
      });

      /* Scroll to image generate button */
      var ig = document.getElementById('image-generate-btn');
      if (ig) { try { ig.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
    });

    /* Insertion point: replace image-mode-hint behavior so accordion follows it */
    var anchor = hint && hint.parentNode ? hint : form;
    if (hint && hint.parentNode) {
      hint.parentNode.insertBefore(acc, hint.nextSibling);
      acc.parentNode.insertBefore(buildBtn, acc.nextSibling);
    } else {
      form.parentNode.insertBefore(acc, form);
      form.parentNode.insertBefore(buildBtn, form);
    }
  }

  /* ===================================================================
   * FIX 5/11: image result shimmer + reveal animation
   * =================================================================== */
  function watchImageResult() {
    if (!once('watchImageResult')) return;
    var section = document.getElementById('imageResultSection');
    var wrap = document.getElementById('imageResultWrap');
    var btn = document.getElementById('image-generate-btn');
    if (!section || !wrap || !btn) return;

    btn.addEventListener('click', function () {
      wrap.classList.add('pmg-shimmer');
      /* Always start a fresh terminal observer per click so we don't leak
       * and so a retry after a previous error gets a fresh shimmer cycle. */
      startObserver();
      /* Hard safety: clear shimmer after 60s no matter what */
      setTimeout(function () { wrap.classList.remove('pmg-shimmer'); }, 60000);
    });

    if (!('MutationObserver' in window)) return;

    var current = null;
    function startObserver() {
      if (current) { current.disconnect(); current = null; }
      var revealed = false;
      var mo = new MutationObserver(function () {
        var hasImg = !!wrap.querySelector('img');
        var hasErr = !!wrap.querySelector('.image-error, [data-image-error], .error-message');
        var bodyTxt = (wrap.textContent || '').toLowerCase();
        var looksError = hasErr || /error|failed|too many|try again|denied/i.test(bodyTxt);
        if (hasImg || looksError) {
          wrap.classList.remove('pmg-shimmer');
          if (hasImg && !revealed && !section.hidden) {
            revealed = true;
            section.classList.add('pmg-revealed');
            try { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
          }
          mo.disconnect();
          if (current === mo) current = null;
        }
      });
      mo.observe(section, { childList: true, subtree: true, attributes: true });
      current = mo;
    }
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
    buildPhotoAccordion();
    watchImageResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
