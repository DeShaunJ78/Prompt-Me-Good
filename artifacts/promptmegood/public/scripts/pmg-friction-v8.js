/* PromptMeGood — Friction-audit closing pass (v8)
 * Builds on v7. NO renames of existing IDs/classes/JS names.
 * NO backend, payment, DB, cost, or secret changes.
 * Prefer hide / move / collapse / progressive-reveal over deletion.
 * All logic isolated in this single IIFE.
 *
 * Closes brief items:
 *   B  — hide v6 "⚙ Expert Mode" pill, leave one "More Control" entry
 *   C  — DOM-move #builder above #use-cases / #how-it-works (anchors preserved)
 *   D  — structured 1-2-3 right-column empty state replacing v7 dashed coach
 *   E  — hide #what-next aside so result → action is adjacent
 *   F  — rewrite hero subhead, single dominant CTA, secondary text link
 *   I  — hide footer Replay Tour link for new users
 *   L  — collapse upload block into closed disclosure by default
 *   M  — banner sweep between key elements
 *   Title Case sweep additions
 */
(function () {
  'use strict';

  var FLAGS = {};
  function once(name) {
    if (FLAGS[name]) return false;
    FLAGS[name] = true;
    return true;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function byId(id) { return document.getElementById(id); }

  function hasGenerated() {
    try { return localStorage.getItem('pmg_has_generated') === '1'; } catch (e) { return false; }
  }
  function hasSavedTemplates() {
    try {
      var raw = localStorage.getItem('promptmegood:templates:v1');
      if (!raw) return false;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length > 0;
    } catch (e) { return false; }
  }
  function isNewUser() { return !hasGenerated() && !hasSavedTemplates(); }

  /* ===================================================================
   * STYLES
   * =================================================================== */
  function injectStyles() {
    if (!once('styles-v8')) return;
    var css = [
      /* Bucket B — hide v6's injected Expert pill so only the existing
         #settingsPanel "More Control" disclosure remains as the
         beginner-facing entry. */
      'body.pmg-v8 #pmg-expert-toggle-btn,',
      'body.pmg-v8 .pmg-expert-mode-row { display: none !important; }',

      /* Bucket E — hide #what-next aside always so the result box is
         immediately followed by the existing action stack. */
      'body.pmg-v8 #what-next { display: none !important; }',

      /* Bucket F — hero rewrite. Demote secondary stacked CTA on desktop,
         hide aside hero-card so the workspace gets primary attention,
         and provide a concise text link below the dominant CTA. The hero
         is also compressed so the Goal textarea fits within a 1280x800
         first viewport. */
      '@media (min-width: 920px) {',
      '  body.pmg-v8 .hero { padding-top: 0.6rem !important; padding-bottom: 0.4rem !important; }',
      '  body.pmg-v8 .hero-grid { grid-template-columns: 1fr !important; max-width: 720px; margin-left: auto; margin-right: auto; }',
      '  body.pmg-v8 aside.hero-card { display: none !important; }',
      '  body.pmg-v8 #hero-usecases-cta { display: none !important; }',
      '  body.pmg-v8 .hero-heading { font-size: clamp(1.5rem, 2.2vw, 2rem) !important; margin-bottom: 0.4rem !important; line-height: 1.1 !important; }',
      '  body.pmg-v8 .hero-subtext-box { margin-bottom: 0.4rem !important; padding: 0.5rem 0.85rem !important; }',
      '  body.pmg-v8 .hero-subtext { font-size: var(--text-sm) !important; line-height: 1.4 !important; }',
      '  body.pmg-v8 .hero-actions { margin-bottom: 0.4rem !important; gap: var(--space-2) !important; }',
      '  body.pmg-v8 .hero-proof-bar { font-size: var(--text-xs) !important; padding: 0.35rem 0.75rem !important; margin-bottom: 0.3rem !important; }',
      '  body.pmg-v8 .hero-testimonial { display: none !important; }',
      '}',
      '.pmg-hero-secondary-link { display: block; margin-top: var(--space-2); text-align: center; font-size: var(--text-sm); color: var(--color-text-muted); text-decoration: underline; text-underline-offset: 3px; transition: color 180ms ease; }',
      '.pmg-hero-secondary-link:hover { color: var(--color-primary); }',

      /* Bucket I — hide Replay Tour for users who have not yet engaged.
         Targets the v3-injected header link as well as the footer button.
         (Reveals automatically once pmg-new-user is dropped.) */
      'body.pmg-v8.pmg-new-user #replay-tour-btn,',
      'body.pmg-v8.pmg-new-user #pmg-replay-tour-menu-link { display: none !important; }',

      /* Bucket M — sweep banners that interrupt key flows for new users. */
      'body.pmg-v8.pmg-new-user .nudge-banner,',
      'body.pmg-v8.pmg-new-user .tip-block,',
      'body.pmg-v8.pmg-new-user .builder-expert-hint,',
      'body.pmg-v8.pmg-new-user .build-cta-guidance,',
      'body.pmg-v8.pmg-new-user #weekly-goal-pin { display: none !important; }',

      /* Bucket L — collapsed upload disclosure card. */
      '.pmg-upload-collapse-toggle { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 10px 14px; margin: 0 0 var(--space-2) 0; border-radius: var(--radius-md); border: 1px dashed color-mix(in srgb, var(--color-primary) 25%, var(--color-border)); background: color-mix(in srgb, var(--color-primary) 4%, transparent); color: var(--color-text); font-size: var(--text-sm); font-weight: 600; cursor: pointer; text-align: left; }',
      '.pmg-upload-collapse-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }',
      '.pmg-upload-collapse-toggle .pmg-upload-collapse-caret { transition: transform 180ms ease; font-size: var(--text-xs); }',
      '.pmg-upload-collapse-toggle.pmg-open .pmg-upload-collapse-caret { transform: rotate(180deg); }',
      'body.pmg-v8 #upload-field.pmg-upload-collapsed > *:not(.pmg-upload-collapse-toggle) { display: none !important; }',

      /* Bucket D — structured pre-generation card replacing v7 dashed coach. */
      'body.pmg-v8.pmg-new-user .pmg-empty-result-coach { display: none !important; }',
      '.pmg-empty-card { display: none; margin-top: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface-2)); border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border)); }',
      'body.pmg-v8.pmg-new-user .pmg-empty-card { display: block; }',
      '.pmg-empty-card-title { margin: 0 0 var(--space-2); font-size: var(--text-base); font-weight: 700; color: var(--color-text); }',
      '.pmg-empty-card-helper { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.5; }',
      '.pmg-empty-card-steps { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-2); counter-reset: pmg-step; }',
      '.pmg-empty-card-steps li { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border); font-size: var(--text-sm); color: var(--color-text); }',
      '.pmg-empty-card-steps li::before { counter-increment: pmg-step; content: counter(pmg-step); flex: 0 0 22px; height: 22px; border-radius: 50%; background: var(--color-primary); color: #ffffff; font-size: var(--text-xs); font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }',

      /* Bucket M follow-up — keep early-access pricing note hidden until
         after the first generation so the new-user view stays uncluttered. */
      'body.pmg-v8.pmg-new-user .early-access-note,',
      'body.pmg-v8.pmg-new-user #save-tip,',
      'body.pmg-v8.pmg-new-user #demo-next-step { display: none !important; }',

      ''
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'pmg-friction-v8-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* The existing #settingsPanel disclosure already provides the single
   * "More Control" entry, so v8 does not inject another one. */

  /* ===================================================================
   * BUCKET C — move #builder above #use-cases / #how-it-works
   * Anchors keep working because we move (not clone) and IDs are intact.
   * =================================================================== */
  function relocateBuilderAboveMarketing() {
    if (!once('builderAbove')) return;
    var builder = byId('builder');
    var hero = byId('top');
    if (!builder || !hero || !hero.parentNode) return;
    /* Already in position? */
    if (hero.nextElementSibling === builder) return;
    /* Insert builder immediately after the hero section. */
    hero.parentNode.insertBefore(builder, hero.nextSibling);
  }

  /* ===================================================================
   * BUCKET D — structured 1-2-3 right-column empty state
   * =================================================================== */
  function injectEmptyCard() {
    if (!once('emptyCard')) return;
    var panel = byId('result-panel');
    if (!panel) return;
    if ($('.pmg-empty-card', panel)) return;
    var resultBox = byId('resultBox');
    if (!resultBox) return;
    var card = document.createElement('div');
    card.className = 'pmg-empty-card';
    card.setAttribute('role', 'note');
    card.innerHTML =
      '<h3 class="pmg-empty-card-title">Your Fixed Prompt Will Appear Here</h3>' +
      '<p class="pmg-empty-card-helper">Type What You Want On The Left, Then Click <strong>Fix My Prompt</strong>. We\'ll Turn It Into A Strong, Clear Prompt In Seconds.</p>' +
      '<ol class="pmg-empty-card-steps">' +
        '<li>Type Your Goal</li>' +
        '<li>Click Fix My Prompt</li>' +
        '<li>Run With AI Or Copy</li>' +
      '</ol>';
    resultBox.parentNode.insertBefore(card, resultBox.nextSibling);
  }

  /* ===================================================================
   * BUCKET F — hero rewrite + secondary text link
   * =================================================================== */
  function rewriteHero() {
    if (!once('heroRewrite')) return;
    /* Replace accusatory subhead with a helpful, premium line. */
    var sub = $('.hero-subtext-box .hero-subtext');
    if (sub) {
      sub.innerHTML = 'Type Your Goal — We\'ll Turn It Into A <strong>Clear, Powerful Prompt</strong> So Your AI Tool Gives You The Result You Actually Want.';
    }
    /* Promote primary CTA label per brief. */
    var primaryCta = byId('hero-build-cta');
    if (primaryCta) {
      var t = primaryCta.querySelector('.cta-title');
      var s = primaryCta.querySelector('.cta-sub');
      if (t) t.textContent = 'Fix My Prompt — Free';
      if (s) s.textContent = 'Works In Seconds. No Signup.';
    }
    /* Add a small secondary text link below the CTA. */
    var actions = $('.hero-actions');
    if (actions && !byId('pmg-hero-secondary-link')) {
      var a = document.createElement('a');
      a.id = 'pmg-hero-secondary-link';
      a.className = 'pmg-hero-secondary-link';
      a.href = '#use-cases';
      a.textContent = 'Or See What It Can Do →';
      actions.appendChild(a);
    }
  }

  /* ===================================================================
   * BUCKET L — collapse upload block into closed disclosure
   * =================================================================== */
  function collapseUploadBlock() {
    if (!once('collapseUpload')) return;
    var field = byId('upload-field');
    if (!field) return;
    if ($('.pmg-upload-collapse-toggle', field)) return;

    /* Only collapse for new users — once they've added a file we leave it expanded. */
    var input = byId('analyze-file');
    var hasFile = input && input.files && input.files.length > 0;
    if (hasFile) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pmg-upload-collapse-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'upload-field');
    toggle.setAttribute('inputmode', 'none');
    toggle.innerHTML =
      '<span>📎 Add A File Or Image (Optional)</span>' +
      '<span class="pmg-upload-collapse-caret" aria-hidden="true">▾</span>';
    toggle.addEventListener('click', function () {
      var collapsed = field.classList.toggle('pmg-upload-collapsed');
      toggle.classList.toggle('pmg-open', !collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
    field.insertBefore(toggle, field.firstChild);
    field.classList.add('pmg-upload-collapsed');
  }

  /* ===================================================================
   * BUCKET M — sweep additional in-flow obstructions
   * =================================================================== */
  function sweepInFlowBanners() {
    if (!once('inFlowSweep')) return;
    /* Hide any tip-block that sits between Goal and Generate. */
    var generate = byId('generateBtn');
    if (!generate) return;
    var form = generate.closest('form');
    if (!form) return;
    var tips = $all('.tip-block, .generate-helper-tip', form);
    tips.forEach(function (t) { t.style.display = 'none'; });
  }

  /* ===================================================================
   * Title Case sweep — extends v5/v6 lists for visible labels
   * =================================================================== */
  function titleCaseSweep() {
    var pairs = [
      ['Add a file or image (optional)', 'Add A File Or Image (Optional)'],
      ['Upload a file or image for smarter results', 'Upload A File Or Image For Smarter Results'],
      ['Drop a file here or click to browse', 'Drop A File Here Or Click To Browse'],
      ['Choose file', 'Choose File'],
      ['Analyze my file', 'Analyze My File'],
      ['Your goal', 'Your Goal'],
      ['Your fixed prompt', 'Your Fixed Prompt'],
      ['Save image to your device', 'Save Image To Your Device'],
      ['Generate another', 'Generate Another'],
      ['Build my image', 'Build My Image'],
      ['Build my image prompt', 'Build My Image Prompt'],
      ['Use as goal', 'Use As Goal'],
      ['Need ideas?', 'Need Ideas?'],
      ['Hide tip', 'Hide Tip'],
      ['Show archived', 'Show Archived'],
      ['Random prompt', 'Random Prompt'],
      ['Run with ai', 'Run With AI'],
      ['Copy prompt', 'Copy Prompt'],
      ['Refine prompt', 'Refine Prompt'],
      ['More control', 'More Control'],
      ['Fix my prompt', 'Fix My Prompt'],
      ['Help me start', 'Help Me Start'],
      ['Or see what it can do', 'Or See What It Can Do']
    ];
    function fixIn(root) {
      if (!root) return;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = w.nextNode())) {
        var v = node.nodeValue;
        if (!v || v.length < 3) continue;
        var p = node.parentNode;
        if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue;
        var changed = v;
        for (var i = 0; i < pairs.length; i++) {
          var idx = changed.toLowerCase().indexOf(pairs[i][0].toLowerCase());
          if (idx !== -1) {
            changed = changed.substring(0, idx) + pairs[i][1] + changed.substring(idx + pairs[i][0].length);
          }
        }
        if (changed !== v) node.nodeValue = changed;
      }
    }
    fixIn(document.body);
  }

  /* ===================================================================
   * State maintenance
   * =================================================================== */
  function applyUserStateClass() {
    document.body.classList.toggle('pmg-new-user', isNewUser());
  }

  /* The v7 watchGenerationStatus had a case-sensitive comparison that was
   * defeated by v5's title-case sweep ("Your fixed prompt..." became
   * "Your Fixed Prompt..."), causing the placeholder text itself to flip
   * pmg_has_generated to true on first load and prevent pmg-new-user from
   * applying. Defensively clear the flag whenever the result box still
   * holds the empty-state placeholder text. */
  function reconcileGenerationFlag() {
    var rb = byId('resultBox');
    if (!rb) return;
    var t = (rb.textContent || '').trim().toLowerCase();
    var looksEmpty = (
      t === '' ||
      t.indexOf('your fixed prompt will appear here') === 0 ||
      t.indexOf('your prompt will appear here') === 0
    );
    if (looksEmpty) {
      try { localStorage.removeItem('pmg_has_generated'); } catch (e) {}
    }
  }

  function watchGenerationStatus() {
    if (!once('watchGen-v8')) return;
    window.addEventListener('focus', applyUserStateClass);
    var rb = byId('resultBox');
    if (!rb) return;
    var mo = new MutationObserver(function () {
      var t = (rb.textContent || '').trim().toLowerCase();
      var looksEmpty = (
        t === '' ||
        t.indexOf('your fixed prompt will appear here') === 0 ||
        t.indexOf('your prompt will appear here') === 0
      );
      if (looksEmpty) {
        try { localStorage.removeItem('pmg_has_generated'); } catch (e) {}
        applyUserStateClass();
      } else if (t.length > 20) {
        try { localStorage.setItem('pmg_has_generated', '1'); } catch (e) {}
        applyUserStateClass();
      }
    });
    mo.observe(rb, { childList: true, characterData: true, subtree: true });
  }

  /* Belt-and-suspenders: even if some later script un-hides #what-next,
   * keep it hidden inline. */
  function hideWhatNextHard() {
    var wn = byId('what-next');
    if (wn) wn.style.setProperty('display', 'none', 'important');
  }

  /* ===================================================================
   * BOOT
   * =================================================================== */
  function init() {
    document.body.classList.add('pmg-v8');
    reconcileGenerationFlag();
    applyUserStateClass();
    injectStyles();
    relocateBuilderAboveMarketing();
    rewriteHero();
    injectEmptyCard();
    collapseUploadBlock();
    sweepInFlowBanners();
    hideWhatNextHard();
    titleCaseSweep();
    watchGenerationStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  /* Re-run a few times to catch late DOM nodes (v6 builds bits lazily) */
  setTimeout(init, 400);
  setTimeout(init, 1200);
  setTimeout(init, 2500);
  setTimeout(titleCaseSweep, 4000);
})();
