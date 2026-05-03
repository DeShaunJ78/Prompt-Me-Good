/* =============================================================
 * pmg-text-flow-v2.js
 *
 * Sibling Flow for Create A Text Prompt — visually mirrors the
 * Photography Suite (Step 2 / Step 3) pattern so the two columns
 * read as siblings rather than two unrelated layouts.
 *
 * What it does (text mode only — `body:not(.image-mode)`):
 *
 *   1. Wraps the existing prompt builder, the result panel, and
 *      the Run-With-AI block with matching "Step" header chrome
 *      (eyebrow + h2 + helper line) using the SAME visual classes
 *      already shipped on the Photography Suite
 *      (.pmg-stack-card-head, .pmg-eyebrow, .pmg-stack-helper).
 *
 *   2. Re-skins the #advanced-options "Power Ups" <details>
 *      collapsible to render with the same group-card chrome as
 *      the Photo Suite groups (same chevron, same active state).
 *      The former #settingsPanel "More Control" was promoted to
 *      a always-visible Prompt Tuning <section class="pmg-stack-card">
 *      and uses the Photo Suite stack-card chrome directly.
 *
 *   3. Adds an Action Row right after the goal CTA so it visually
 *      mirrors the Photo Suite's `Send · Surprise · Clear` row.
 *      We surface existing buttons (Fix My Prompt, Dice Idea
 *      Generator, Clear Prompt) — no new behavior, no renames.
 *
 * Strict additive: never reads/writes anything from the backend,
 * never touches Stripe/Supabase/Auth/AI, never renames an ID.
 * If the script fails to find a target, it silently no-ops so
 * the page keeps working as it did before.
 *
 * Disable hatch: ?notextflow query param OR
 *                localStorage.pmg_textflow_disable = "1".
 *
 * Init order: defer-loaded after pmg-linear-flow.js so order:flex
 * values from T15 are still respected. We only inject DOM and CSS
 * here, no order rewrites.
 * ============================================================= */
(function () {
  'use strict';

  /* -------- Disable hatch -------- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('notextflow') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_textflow_disable') === '1') return;
  } catch (_) {}

  var BODY_CLASS  = 'pmg-text-sibling';
  var STEP1_ID    = 'pmg-tf-step1';
  var STEP2_ID    = 'pmg-tf-step2';
  var ACTION_ROW_ID = 'pmg-tf-action-row';

  /* -------- Helpers -------- */
  function $id(id) { return document.getElementById(id); }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* -------- CSS injection. Visual parity with the Photo Suite's
     stack-card chrome and group cards, scoped to the new
     `pmg-text-sibling` body class so Image Mode and other pages
     are completely unaffected. -------- */
  function injectCss() {
    if (document.getElementById('pmg-text-flow-v2-css')) return;
    var css = [
      /* Eyebrow + helper rows live OUTSIDE the existing panels so
         they read as siblings of the Photo Suite's stack-card-head
         block. We HIDE them by default (so when the user switches
         to image-mode and `body.pmg-text-sibling` is removed, the
         already-injected step nodes do NOT leak into the photo
         column layout). They only show when the body has the
         text-sibling class. */
      '.pmg-tf-step{ display: none; }',
      'body.' + BODY_CLASS + ' .pmg-tf-step{',
      '  display: block;',
      '  margin: 24px auto 8px;',
      '  max-width: var(--container-narrow, 880px);',
      '  padding: 0 16px;',
      '}',
      'body.' + BODY_CLASS + ' .pmg-tf-step-head{',
      '  display: flex;',
      '  align-items: baseline;',
      '  gap: 10px;',
      '  flex-wrap: wrap;',
      '}',
      'body.' + BODY_CLASS + ' .pmg-tf-step-head .pmg-eyebrow{',
      '  display: inline-flex;',
      '  align-items: center;',
      '  padding: 2px 10px;',
      '  border-radius: 999px;',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, transparent);',
      '  color: var(--color-primary, #0f6e6a);',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.04em;',
      '}',
      'body.' + BODY_CLASS + ' .pmg-tf-step-head h2{',
      '  margin: 0;',
      '  font-size: clamp(20px, 2.4vw, 26px);',
      '  font-weight: 800;',
      '}',
      'body.' + BODY_CLASS + ' .pmg-tf-step-helper{',
      '  margin: 6px 0 0;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  font-size: 14px;',
      '}',

      /* Step 2 is gated to appear only after the user has
         generated their first prompt — there is no point showing
         "Your Fixed Prompt" before one exists. Mirrors how the
         Photo Suite Step 3 (image generator output) reveals only
         after the suite has been used. */
      'body.' + BODY_CLASS + ' #' + STEP2_ID + '{',
      '  display: none;',
      '}',
      'body.' + BODY_CLASS + '.pmg-has-generated #' + STEP2_ID + ',',
      'body.' + BODY_CLASS + '.pmg-shortcuts-unlocked #' + STEP2_ID + '{',
      '  display: block;',
      '}',

      /* Action row mirroring Photo Suite's .pmg-photo-actions.
         We attach class .pmg-tf-action-row to the existing
         #tour-step-generate row (we never rename the original ID),
         so the selector here MUST be a class — not an id — to
         actually match. */
      'body.' + BODY_CLASS + ' .' + ACTION_ROW_ID + '{',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 10px;',
      '  margin: 14px 0 6px;',
      '  align-items: center;',
      '}',
      'body.' + BODY_CLASS + ' .' + ACTION_ROW_ID + ' .pmg-tf-spacer{',
      '  flex: 1 1 auto;',
      '}',

      /* Re-skin the #advanced-options "Power Ups" <details> block
         so it matches Photo Suite group-card chrome. The former
         #settingsPanel "More Control" collapsible was promoted to
         a always-visible Prompt Tuning <section class="pmg-stack-card">
         and uses the Photo Suite stack-card chrome directly. */
      'body.' + BODY_CLASS + ' #advanced-options{',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #1d2a32) 10%, transparent);',
      '  border-radius: 14px;',
      '  background: var(--color-surface, #fff);',
      '  padding: 0;',
      '  margin: 14px 0;',
      '  overflow: hidden;',
      '}',
      'body.' + BODY_CLASS + ' #advanced-options > summary{',
      '  list-style: none;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  width: 100%;',
      '  padding: 14px 16px;',
      '  font-weight: 700;',
      '  font-size: 15px;',
      '  cursor: pointer;',
      '  color: var(--color-text, #1d2a32);',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 4%, transparent);',
      '  border-bottom: 1px solid transparent;',
      '  transition: background-color 160ms ease;',
      '}',
      'body.' + BODY_CLASS + ' #advanced-options > summary::-webkit-details-marker{ display: none; }',
      'body.' + BODY_CLASS + ' #advanced-options > summary:hover{',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 8%, transparent);',
      '}',
      /* Open state */
      'body.' + BODY_CLASS + ' #advanced-options[open] > summary{',
      '  border-bottom-color: color-mix(in srgb, var(--color-text, #1d2a32) 8%, transparent);',
      '}',
      'body.' + BODY_CLASS + ' #advanced-options .adv-chevron{',
      '  margin-left: auto;',
      '  font-size: 14px;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  display: inline-block;',
      '}',
      'body.' + BODY_CLASS + ' #advanced-options[open] .adv-chevron{',
      '  transform: rotate(180deg) !important;',
      '}',
      'body.' + BODY_CLASS + ' #advanced-options > .advanced-options-body{',
      '  padding: 14px 16px 16px;',
      '}',

      /* Reduced motion: kill the only transition we own (summary
         hover background). */
      '@media (prefers-reduced-motion: reduce){',
      '  body.' + BODY_CLASS + ' #advanced-options > summary{',
      '    transition: none;',
      '  }',
      '}'
    ].join('\n');

    var s = document.createElement('style');
    s.id = 'pmg-text-flow-v2-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* -------- Step header builder. Returns a detached node so
     callers can position it right above their target element. */
  function buildStep(id, eyebrow, title, helper) {
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'pmg-tf-step';
    wrap.innerHTML =
      '<div class="pmg-tf-step-head">' +
        '<span class="pmg-eyebrow">' + escHtml(eyebrow) + '</span>' +
        '<h2>' + escHtml(title) + '</h2>' +
      '</div>' +
      (helper ? '<p class="pmg-tf-step-helper">' + escHtml(helper) + '</p>' : '');
    return wrap;
  }

  /* -------- Step 1 — above the existing builder section.
     Other scripts (notably the "Save Your Best Prompts" account
     panel from pmg-ux.js) also call insertBefore(section, builder)
     on a delayed setInterval. To keep our Step 1 anchored
     IMMEDIATELY above #builder regardless of insertion order,
     we place it once and then observe builder's parent so we can
     re-anchor whenever something slips between us. -------- */
  function injectStep1() {
    var builder = $id('builder');
    if (!builder || !builder.parentNode) return;
    /* Streamlined homepage mode opts out of above-the-fold decorations. */
    if (document.body && document.body.classList.contains('pmg-workstation-promote')) return;
    var step = $id(STEP1_ID);
    if (!step) {
      step = buildStep(
        STEP1_ID,
        'Step 1',
        'Build Your Prompt',
        "Tell Us What You Want — We'll Shape It Into A Prompt That Actually Works."
      );
    }
    if (builder.previousElementSibling !== step) {
      builder.parentNode.insertBefore(step, builder);
    }
  }

  /* -------- Step 2 — above the result panel. The result panel
     is more stable (no other scripts insert before it on the
     same parent), but we still call this idempotently. -------- */
  function injectStep2() {
    var result = $id('result-panel');
    if (!result || !result.parentNode) return;
    var step = $id(STEP2_ID);
    if (!step) {
      step = buildStep(
        STEP2_ID,
        'Step 2',
        'Your Fixed Prompt',
        'Edit, Refine, Or Copy It Right Here — No Copy & Paste Required.'
      );
    }
    if (result.previousElementSibling !== step) {
      result.parentNode.insertBefore(step, result);
    }
  }

  /* -------- Re-anchor watchdog. Other scripts may insert content
     between our Step headers and their target panel after our
     init has run. A lightweight MutationObserver on the parent
     keeps us pinned. We debounce with rAF so we never thrash. */
  function watchAnchors() {
    if (typeof MutationObserver !== 'function') return;
    var builder = $id('builder');
    var result  = $id('result-panel');
    var seen = new WeakSet();
    function observeParent(parent) {
      if (!parent || seen.has(parent)) return;
      seen.add(parent);
      var pending = false;
      var mo = new MutationObserver(function () {
        if (pending) return;
        pending = true;
        (window.requestAnimationFrame || setTimeout)(function () {
          pending = false;
          injectStep1();
          injectStep2();
        }, 16);
      });
      mo.observe(parent, { childList: true });
    }
    if (builder) observeParent(builder.parentNode);
    if (result)  observeParent(result.parentNode);
  }

  /* -------- Action row — mirrors Photo Suite's
     `Send · Surprise · Clear` row. We tag whichever element is the
     CURRENT actions row (whether the original `#tour-step-generate`
     div in `index.html`, or the new wrapper that pmg-ux.js builds
     under `#pmg-result-actions-row` after relocating #generateBtn,
     which also carries `data-pmg-tour-id="tour-step-generate"`)
     with class `pmg-tf-action-row` so our CSS can pick it up. We
     never move the originals — adding a class is non-destructive. */
  function adoptActionRow() {
    var row =
      document.getElementById('tour-step-generate') ||
      document.querySelector('[data-pmg-tour-id="tour-step-generate"]') ||
      document.getElementById('pmg-result-actions-row');
    if (!row) return false;
    if (!row.classList.contains('pmg-tf-action-row')) {
      row.classList.add('pmg-tf-action-row');
    }
    return true;
  }

  /* The action row may be (re)created by pmg-ux.js after our init
     runs — keep retagging if needed. Watch the form + result wrap
     for inserted action-row wrappers and re-tag them. */
  function watchActionRow() {
    if (typeof MutationObserver !== 'function') return;
    var form = document.getElementById('prompt-form') || document.body;
    var resultWrap = document.querySelector('#result-panel .result-wrap');
    var seen = adoptActionRow();
    var schedule = (function () {
      var pending = false;
      return function () {
        if (pending) return;
        pending = true;
        (window.requestAnimationFrame || setTimeout)(function () {
          pending = false;
          adoptActionRow();
        });
      };
    })();
    try {
      if (form) {
        new MutationObserver(schedule).observe(form, { childList: true, subtree: true });
      }
      if (resultWrap) {
        new MutationObserver(schedule).observe(resultWrap, { childList: true, subtree: true });
      }
    } catch (_) {}
    /* Belt-and-suspenders: a couple of late retries cover the
       initial pmg-ux.js relocation that may complete after our
       observers attach. */
    if (!seen) {
      setTimeout(adoptActionRow, 250);
      setTimeout(adoptActionRow, 1000);
      setTimeout(adoptActionRow, 2500);
    }
  }

  /* -------- Body class management. Activate only on pages that
     host the prompt builder AND only when not in image-mode. The
     pmg-mode-switch.js script toggles `body.image-mode` whenever
     the user flips modes, so we react to that. -------- */
  function applyBodyClass() {
    var hasBuilder = !!document.getElementById('builder');
    var inImageMode = document.body && document.body.classList.contains('image-mode');
    if (hasBuilder && !inImageMode) {
      document.body.classList.add(BODY_CLASS);
    } else {
      document.body.classList.remove(BODY_CLASS);
    }
  }

  function watchModeSwitch() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    try {
      var mo = new MutationObserver(function () { applyBodyClass(); });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }

  /* -------- Init -------- */
  function init() {
    if (!document.body) return;
    injectCss();
    injectStep1();
    injectStep2();
    watchAnchors();
    watchActionRow();
    applyBodyClass();
    watchModeSwitch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* Debug hooks. */
  window.__pmgTextFlow = {
    enable: function () {
      try { localStorage.removeItem('pmg_textflow_disable'); } catch (_) {}
      applyBodyClass();
    },
    disable: function () {
      try { localStorage.setItem('pmg_textflow_disable', '1'); } catch (_) {}
      if (document.body) document.body.classList.remove(BODY_CLASS);
    },
    isActive: function () {
      return !!(document.body && document.body.classList.contains(BODY_CLASS));
    }
  };
})();
