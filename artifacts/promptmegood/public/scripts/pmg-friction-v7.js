/* PromptMeGood — Friction-audit fixes (v7)
 * Approved buckets A + B + C from the audit report.
 * All NEW logic in this file. No renames of existing IDs/classes.
 * No CSS order/flex reorder; CSS variables only.
 *
 * Bucket A (quick wins) — items 1, 7, 9, 10, + keyboard hint
 * Bucket B (above-fold) — items 2, 3, 4, 8, 11
 * Bucket C (image coaching) — item 5 + photo accordion progress
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

  /* ---------- "Has the user done anything yet?" signals ---------- */
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
    if (!once('styles-v7')) return;
    var css = [
      /* --- Bucket A item 1: hide leftover guided-cta-row label/badge once
             v6 has moved the button. The row is left behind with just the
             label "Help Me Start" + description acting as a duplicate. --- */
      'body.pmg-v7 #guided-cta-row { display: none !important; }',

      /* --- Bucket A item 7: hide Clear button on empty textarea --- */
      'body.pmg-v7 .btn-clear[data-clear-target].pmg-clear-empty { display: none !important; }',

      /* --- Bucket A item 9: hide stats dashboard for users with zero activity --- */
      'body.pmg-v7.pmg-new-user #weekly-summary,',
      'body.pmg-v7.pmg-new-user #streak-calendar { display: none !important; }',

      /* --- Bucket A item 10: hide Export/Import in empty Input Summary --- */
      'body.pmg-v7.pmg-new-user #export-everything,',
      'body.pmg-v7.pmg-new-user #import-everything { display: none !important; }',

      /* --- Bucket A keyboard-shortcut hint hidden until first generation --- */
      'body.pmg-v7.pmg-new-user .pmg-shortcut-hint { display: none !important; }',

      /* --- Bucket B item 2: collapse the three Expert-Mode entry points
             into the single visible row that v6 already added. --- */
      'body.pmg-v7 #expert-mode-link,',
      'body.pmg-v7 #expert-mode-toggle-wrap,',
      'body.pmg-v7 #expert-mode-badge { display: none !important; }',

      /* --- Bucket B item 3: tighten hero so #goal sits within first viewport
             on desktop. Margin shaved, hero-card de-emphasised. --- */
      '@media (min-width: 920px) {',
      '  body.pmg-v7 .hero { padding-top: 1.25rem !important; padding-bottom: 0.5rem !important; }',
      '  body.pmg-v7 .hero-heading { font-size: clamp(1.75rem, 2.6vw, 2.5rem) !important; margin-bottom: 0.4rem !important; line-height: 1.15 !important; }',
      '  body.pmg-v7 .hero-subtext-box { margin-bottom: 0.5rem !important; padding: 0.75rem 1rem !important; }',
      '  body.pmg-v7 .hero-actions { margin-bottom: 0.5rem !important; }',
      '  body.pmg-v7 .hero-trust-row { margin-bottom: 0.5rem !important; padding: 0.4rem 0.9rem !important; }',
      '  body.pmg-v7 .hero-testimonial { margin-bottom: 0.5rem !important; padding: 0.6rem 0.9rem !important; }',
      '}',

      /* --- Bucket B item 4: collapse empty "Your Fixed Prompt" panel for
             new users; show its full content once they have generated. --- */
      'body.pmg-v7.pmg-new-user #result-panel .result-wrap > .pill-row,',
      'body.pmg-v7.pmg-new-user #result-panel #pinned-note,',
      'body.pmg-v7.pmg-new-user #result-panel #improve-block,',
      'body.pmg-v7.pmg-new-user #result-panel #what-next,',
      'body.pmg-v7.pmg-new-user #result-panel .result-edit-row { display: none !important; }',
      'body.pmg-v7.pmg-new-user #result-panel #resultBox { min-height: 96px !important; opacity: 0.6 !important; font-style: italic; }',
      'body.pmg-v7.pmg-new-user .pmg-empty-result-coach { display: block !important; margin-top: var(--space-3); padding: var(--space-3); border-radius: var(--radius-md); background: color-mix(in srgb, var(--color-primary) 6%, transparent); border: 1px dashed color-mix(in srgb, var(--color-primary) 25%, var(--color-border)); font-size: var(--text-sm); color: var(--color-text-muted); text-align: center; }',
      '.pmg-empty-result-coach { display: none; }',

      /* --- Bucket B item 11: demote header search for users who have nothing
             to search yet; replace with a small icon button that expands. --- */
      'body.pmg-v7.pmg-new-user .global-search { display: none !important; }',

      /* --- Bucket C item 5: persistent inline coach above Build button + 
             progress chip on the photo accordion. --- */
      '.pmg-photo-progress { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 var(--space-2) 0; padding: 4px 12px; border-radius: var(--radius-full); background: color-mix(in srgb, var(--color-primary) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); font-size: var(--text-xs); font-weight: 600; color: var(--color-primary); }',
      '.pmg-photo-progress-dot { width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--color-primary) 35%, transparent); }',
      '.pmg-photo-progress-dot.pmg-on { background: var(--color-primary); }',
      '.pmg-build-coach { display: block; margin: var(--space-2) 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: color-mix(in srgb, var(--color-primary) 8%, transparent); border-left: 3px solid var(--color-primary); font-size: var(--text-sm); color: var(--color-text); line-height: 1.45; }',
      '.pmg-build-coach strong { color: var(--color-primary); }',

      ''
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'pmg-friction-v7-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ===================================================================
   * BUCKET A — Item 7: clear-button visibility tied to textarea content
   * =================================================================== */
  function wireClearButtonAutoHide() {
    if (!once('clearAutoHide')) return;
    var pairs = [
      { btn: 'clear-goal-btn', target: 'goal' },
      { btn: 'clear-details-btn', target: 'details' },
      { btn: 'clear-rules or limits-btn', target: 'rules or limits' },
      { btn: 'clear-fine-tune-btn', target: 'fine-tune-input' }
    ];
    function refresh() {
      pairs.forEach(function (p) {
        var btn = document.getElementById(p.btn);
        var tgt = document.getElementById(p.target);
        if (!btn || !tgt) return;
        var val = (tgt.value || '').trim();
        btn.classList.toggle('pmg-clear-empty', val.length === 0);
      });
    }
    pairs.forEach(function (p) {
      var tgt = document.getElementById(p.target);
      if (!tgt || tgt.dataset.pmgV7ClearBound === '1') return;
      tgt.dataset.pmgV7ClearBound = '1';
      tgt.addEventListener('input', refresh);
      tgt.addEventListener('change', refresh);
    });
    refresh();
  }

  /* ===================================================================
   * BUCKET A — Item 9 + 10 + keyboard hint:
   * Tag the keyboard-shortcut paragraph so CSS can hide it for new users.
   * =================================================================== */
  function tagShortcutHint() {
    if (!once('shortcutHint')) return;
    var nodes = $all('#result-panel p, #result-panel .panel-meta, #result-panel small');
    nodes.forEach(function (n) {
      var t = (n.textContent || '').toLowerCase();
      if (t.indexOf('press') !== -1 && t.indexOf('to generate') !== -1 && t.indexOf('to copy') !== -1) {
        n.classList.add('pmg-shortcut-hint');
      }
    });
  }

  /* ===================================================================
   * BUCKET B — Item 4: empty-state coach inside result panel
   * =================================================================== */
  function injectEmptyResultCoach() {
    if (!once('emptyResultCoach')) return;
    var panel = $('#result-panel');
    if (!panel) return;
    if ($('.pmg-empty-result-coach', panel)) return;
    var resultBox = $('#resultBox', panel);
    if (!resultBox) return;
    var coach = document.createElement('div');
    coach.className = 'pmg-empty-result-coach';
    coach.setAttribute('role', 'note');
    coach.innerHTML =
      '👈 <strong>Type your goal on the left</strong>, then tap <strong>Fix My Prompt</strong>. ' +
      'Your improved prompt will appear right here, ready to copy or run.';
    resultBox.parentNode.insertBefore(coach, resultBox.nextSibling);
  }

  /* ===================================================================
   * BUCKET C — Item 5: photo accordion progress + Build button coach
   * =================================================================== */
  function wireImageCoach() {
    if (!once('imageCoach')) return;

    function ensureProgressChip() {
      var acc = document.getElementById('pmg-photo-accordion');
      if (!acc) return null;
      var chip = document.getElementById('pmg-photo-progress');
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'pmg-photo-progress';
        chip.className = 'pmg-photo-progress';
        chip.setAttribute('role', 'status');
        chip.setAttribute('aria-live', 'polite');
        acc.parentNode.insertBefore(chip, acc);
      }
      return chip;
    }

    function ensureBuildCoach() {
      var build = document.getElementById('pmg-build-image-btn');
      if (!build) return null;
      var coach = document.getElementById('pmg-build-coach');
      if (!coach) {
        coach = document.createElement('p');
        coach.id = 'pmg-build-coach';
        coach.className = 'pmg-build-coach';
        coach.innerHTML = 'Answer the questions above, then tap <strong>Build My Image</strong>. We\'ll combine your answers into one strong prompt and generate the picture.';
        build.parentNode.insertBefore(coach, build);
      }
      return coach;
    }

    function countAnswered() {
      var cards = $all('#pmg-photo-accordion .pmg-photo-card');
      var total = cards.length || 6;
      var answered = 0;
      cards.forEach(function (c) {
        var input = c.querySelector('textarea, input[type="text"], select');
        var val = input ? (input.value || '').trim() : '';
        if (val.length > 0) answered++;
      });
      return { answered: answered, total: total };
    }

    function refreshChip() {
      var chip = ensureProgressChip();
      if (!chip) return;
      var n = countAnswered();
      var dots = '';
      for (var i = 0; i < n.total; i++) {
        dots += '<span class="pmg-photo-progress-dot' + (i < n.answered ? ' pmg-on' : '') + '"></span>';
      }
      chip.innerHTML = dots + '<span>' + n.answered + ' of ' + n.total + ' answered</span>';
    }

    function isImageMode() {
      return document.body.classList.contains('image-mode');
    }

    function refreshAll() {
      if (!isImageMode()) return;
      ensureBuildCoach();
      refreshChip();
    }

    /* React to answers + mode switches */
    document.addEventListener('input', function (e) {
      if (e.target && e.target.closest && e.target.closest('#pmg-photo-accordion')) refreshChip();
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.closest && e.target.closest('#pmg-photo-accordion')) refreshChip();
    });
    var imgBtn = document.getElementById('imageModeBtn');
    if (imgBtn) imgBtn.addEventListener('click', function () { setTimeout(refreshAll, 200); });

    /* Watch DOM in case accordion is built lazily by v6 */
    var mo = new MutationObserver(function () {
      if (document.getElementById('pmg-photo-accordion')) refreshAll();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    refreshAll();
  }

  /* ===================================================================
   * Recompute "new user" body class
   * =================================================================== */
  function applyUserStateClass() {
    document.body.classList.toggle('pmg-new-user', isNewUser());
  }

  function watchGenerationStatus() {
    if (!once('watchGen')) return;
    /* Re-check on focus (storage might have changed in another tab) */
    window.addEventListener('focus', applyUserStateClass);
    /* Re-check when result box content changes (signals a fresh generation) */
    var rb = document.getElementById('resultBox');
    if (rb) {
      var mo = new MutationObserver(function () {
        var t = (rb.textContent || '').trim();
        if (t && t.indexOf('Your fixed prompt will appear here') !== 0) {
          try { localStorage.setItem('pmg_has_generated', '1'); } catch (e) {}
          applyUserStateClass();
        }
      });
      mo.observe(rb, { childList: true, characterData: true, subtree: true });
    }
    /* Re-check whenever an image arrives */
    var imgWrap = document.getElementById('imageResultWrap');
    if (imgWrap) {
      var mo2 = new MutationObserver(function () {
        if (imgWrap.querySelector('img')) {
          try { localStorage.setItem('pmg_has_generated', '1'); } catch (e) {}
          applyUserStateClass();
        }
      });
      mo2.observe(imgWrap, { childList: true, subtree: true });
    }
  }

  /* ===================================================================
   * BOOT
   * =================================================================== */
  function init() {
    document.body.classList.add('pmg-v7');
    applyUserStateClass();
    injectStyles();
    wireClearButtonAutoHide();
    tagShortcutHint();
    injectEmptyResultCoach();
    wireImageCoach();
    watchGenerationStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  /* Re-run a few times to catch late DOM (v6 builds the photo accordion lazily) */
  setTimeout(init, 400);
  setTimeout(init, 1200);
  setTimeout(init, 2500);
})();
