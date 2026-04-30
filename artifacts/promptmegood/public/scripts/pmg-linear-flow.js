/* ============================================================
 * pmg-linear-flow.js — T50 Linear Flow Restoration
 * Spec: Build The Linear UI Layout For Create A Text Prompt
 *
 * Goal: make the Create A Text Prompt column flow top-to-bottom
 * with no break:
 *
 *   1.  Create A Text Prompt (header)
 *   2.  Your Goal (label)
 *   3.  Goal Textarea (visible by default)
 *   4.  Fix My Prompt (primary)
 *   5.  Help Me Start (secondary, single)
 *   6.  More Control (collapsed, single)
 *   7.  Your Fixed Prompt
 *   8.  Improve Your Prompt (Optional) — folded Text Studio Pro
 *   9.  Run With AI / Copy Prompt / Refine Prompt
 *   10. AI Response
 *   11. Final Actions
 *
 * Approach: additive. We do not edit existing function names,
 * element IDs, or static markup. Pure overlay of CSS overrides
 * and a few DOM moves to fold Text Studio Pro into the result.
 *
 * Constraints honored:
 *   - No backend / API / AI / Stripe / Supabase / image-gen logic changes.
 *   - Photography Suite (image-mode) untouched — every override is
 *     scoped with body:not(.image-mode) where it could collide.
 *   - 70% similarity rule: we re-use existing #pmg-help-me-start-btn
 *     instead of creating a new Help Me Start.
 * ============================================================ */
(function () {
  'use strict';

  if (window.__PMG_LINEAR_FLOW__) return;
  window.__PMG_LINEAR_FLOW__ = true;

  /* ---------------- CSS overrides ---------------- */
  function injectStyles() {
    if (document.getElementById('pmg-linear-flow-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-linear-flow-styles';
    s.textContent = [
      /* (1) Show Goal textarea by default in text mode. The earlier
         T31 system hid it behind an "I Know What I Want" gate; for
         the linear flow the goal must be the first input the user
         sees. Image-mode keeps its own behavior. */
      'body:not(.image-mode) #prompt-form > .field.field-primary {',
      '  display: block !important;',
      '}',

      /* (2) Hide the gating callout #pmg-text-help-row at the top
         of the column. Help Me Start is now a single secondary
         button below Fix My Prompt (already wired by setupHelpMeStartButton). */
      'body:not(.image-mode) #pmg-text-help-row { display: none !important; }',

      /* (2b) The earlier T45 fix hid #pmg-help-me-start-btn because it
         duplicated the (now hidden) top callout. With the callout gone,
         this button becomes the SINGLE secondary "Help Me Start" entry
         point sitting below Fix My Prompt. Re-show it here. We must beat
         BOTH the T45 selector (#pmg-help-me-start-btn[id]) and the T15.2
         body.pmg-t15-help-ok rule, so use the same specificity + !important
         and rely on source order (this stylesheet loads last). */
      'body:not(.image-mode) #pmg-help-me-start-btn[id] {',
      '  display: inline-flex !important;',
      '  width: auto;',
      '  max-width: 420px;',
      '  margin: 10px auto 6px;',
      '}',
      'body.pmg-t15-help-ok:not(.image-mode) #pmg-help-me-start-btn {',
      '  display: inline-flex !important;',
      '}',

      /* (2c) Force visual order with flexbox `order`. Multiple other
         scripts (T46, T24, polish, FIX 4) move children of #prompt-form
         on different schedules, and a JS race can leave help-me-start at
         the top of the form (above the Goal label). Switching the form
         to a flex column with explicit order values guarantees the
         visual order regardless of DOM order. Only applied in TEXT mode
         so we do not disturb Photography Suite. */
      'body:not(.image-mode) #prompt-form {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '}',
      'body:not(.image-mode) #prompt-form > * { order: 9; }',
      'body:not(.image-mode) #prompt-form > .field.field-primary { order: 1; }',
      'body:not(.image-mode) #prompt-form > #pmg-help-me-start-btn { order: 2; }',
      'body:not(.image-mode) #prompt-form > #pmg-hms-helper { order: 3; }',
      'body:not(.image-mode) #prompt-form > #upload-field { order: 4; }',
      'body:not(.image-mode) #prompt-form > #post-uc-guidance { order: 5; }',
      'body:not(.image-mode) #prompt-form > #settingsPanel { order: 6; }',
      /* tour-step-generate is the now-empty actions row left behind
         by T46 — push it last so it never inserts a gap above the
         goal field. */
      'body:not(.image-mode) #prompt-form > #tour-step-generate { order: 8; }',

      /* (3) Hide the keyboard-shortcut hint and the early-access
         note until first generation — pure pre-gen noise. */
      'body:not(.pmg-has-result) #builder .result-wrap > p:has(kbd) { display: none !important; }',
      'body:not(.pmg-has-result) #builder .early-access-note { display: none !important; }',

      /* (4) Hide #transform-studio entirely until first generation.
         After first generation it shows up COLLAPSED inside the
         "Improve Your Prompt (Optional)" details below. */
      'body:not(.pmg-has-result) #pmg-improve-collapsible { display: none !important; }',
      /* (4b) When studio has been folded into the collapsible, suppress
         any stray un-wrapped #transform-studio that may briefly mount
         outside the collapsible during init. */
      'body:not(.pmg-has-result) #transform-studio:not(#pmg-improve-collapsible #transform-studio) {',
      '  display: none !important;',
      '}',

      /* (5) Style the new collapsible "Improve Your Prompt (Optional)". */
      '#pmg-improve-collapsible {',
      '  border: 1px solid var(--color-border, #d9d9d9);',
      '  border-radius: 14px;',
      '  background: var(--color-surface, #fff);',
      '  margin: var(--space-4, 16px) 0;',
      '  overflow: hidden;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,0.04);',
      '}',
      '#pmg-improve-collapsible > summary {',
      '  cursor: pointer;',
      '  padding: 14px 16px;',
      '  list-style: none;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 12px;',
      '  font-weight: 600;',
      '  background: var(--color-surface-alt, #f5f7f7);',
      '  min-height: 44px;',
      '  flex-wrap: wrap;',
      '}',
      '#pmg-improve-collapsible > summary::-webkit-details-marker { display: none; }',
      '#pmg-improve-collapsible > summary::marker { content: ""; }',
      '#pmg-improve-collapsible .pmg-improve-summary-text {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  font-size: 16px;',
      '  color: var(--color-text, #1a1a1a);',
      '  flex: 1 1 auto;',
      '  min-width: 0;',
      '}',
      '#pmg-improve-collapsible .pmg-improve-summary-cta {',
      '  background: var(--color-primary, #006064);',
      '  color: #fff;',
      '  padding: 10px 16px;',
      '  border-radius: 10px;',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  min-height: 44px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  white-space: nowrap;',
      '  user-select: none;',
      '}',
      '#pmg-improve-collapsible[open] .pmg-improve-summary-cta::after { content: " ▴"; }',
      '#pmg-improve-collapsible:not([open]) .pmg-improve-summary-cta::after { content: " ▾"; }',
      '#pmg-improve-collapsible > .pmg-improve-body { padding: 0; }',
      '#pmg-improve-collapsible #transform-studio { padding: 0; margin: 0; display: block !important; }',

      /* (6) When folded into the collapsible, the studio panel does',
         not need its own outer card chrome; reset margin so it sits
         flush. */
      '#pmg-improve-collapsible #pmg-ts-panel { margin: 0; border-radius: 0 0 14px 14px; }',
      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- Title Case label fixes (small, targeted) ---------------- */
  function applyTitleCaseLabels() {
    /* The text-studio header reads "Text Studio Pro"; per spec
       rename only the visible heading, not the JS-internal terms. */
    var title = document.getElementById('pmg-ts-title');
    if (title && title.getAttribute('data-pmg-renamed') !== '1') {
      title.innerHTML = '<span aria-hidden="true">✨</span> Improve Your Prompt (Optional)';
      title.setAttribute('data-pmg-renamed', '1');
    }
  }

  /* ---------------- Wrap & move Text Studio Pro ---------------- */
  function wrapAndMoveStudio() {
    var studio = document.getElementById('transform-studio');
    var resultPanel = document.getElementById('result-panel');
    if (!studio || !resultPanel) return false;
    if (document.getElementById('pmg-improve-collapsible')) {
      /* Already wrapped — re-apply title case in case studio re-rendered. */
      applyTitleCaseLabels();
      return true;
    }

    /* Build the collapsible shell. */
    var details = document.createElement('details');
    details.id = 'pmg-improve-collapsible';
    details.className = 'pmg-post-gen';
    details.setAttribute('aria-label', 'Improve Your Prompt (Optional)');

    var summary = document.createElement('summary');
    summary.innerHTML =
      '<span class="pmg-improve-summary-text">' +
        '<span aria-hidden="true">✨</span>' +
        '<span>Want To Make This Even Better?</span>' +
      '</span>' +
      '<span class="pmg-improve-summary-cta" aria-hidden="true">Improve This Prompt</span>';
    details.appendChild(summary);

    var body = document.createElement('div');
    body.className = 'pmg-improve-body';
    details.appendChild(body);

    /* Move the studio into the body. */
    body.appendChild(studio);

    /* Insert the collapsible at the END of .result-wrap so it sits
       just below the final-actions block and the existing JS that
       reorders the result-wrap (reorderResultPanel) does not need
       to know about it. This matches the spec's "OR directly below
       those actions if that better preserves existing JS." */
    var wrap = resultPanel.querySelector('.result-wrap');
    if (wrap) {
      wrap.appendChild(details);
    } else {
      resultPanel.appendChild(details);
    }

    applyTitleCaseLabels();
    return true;
  }

  /* ---------------- Position Help Me Start below Fix My Prompt ----------------
   * The Most Loved "Help Me Start (Answer 4 Quick Questions)" button
   * (#pmg-help-me-start-btn) is created by setupHelpMeStartButton in
   * pmg-ux.js and inserted relative to the original #generateBtn. But
   * T46 later moves #generateBtn out of the form into the result-wrap,
   * and the polish script reorders the form, so #pmg-help-me-start-btn
   * frequently ends up in the wrong place — most often visible at the
   * top of the column ABOVE the Goal field.
   *
   * Per spec the linear order is:
   *   ... → Goal Textarea → Fix My Prompt → Help Me Start → More Control
   *
   * Inside the form #generateBtn is replaced by the T46 export-to-fix
   * button (#pmg-export-to-fix-btn) inside #pmg-export-to-fix-row, which
   * sits at the END of .field.field-primary. So the correct position
   * for Help Me Start is: AS THE NEXT SIBLING OF .field.field-primary.
   */
  function positionHelpMeStart() {
    var btn = document.getElementById('pmg-help-me-start-btn');
    var primaryField = document.querySelector('#prompt-form > .field.field-primary');
    if (!btn || !primaryField) return false;
    if (btn.dataset.pmgLinearPositioned === '1' &&
        btn.previousElementSibling === primaryField) {
      return true;
    }
    var helper = document.getElementById('pmg-hms-helper');
    /* Move btn to be the immediate next sibling of field-primary. */
    if (primaryField.parentNode) {
      primaryField.parentNode.insertBefore(btn, primaryField.nextSibling);
      if (helper && helper.parentNode) {
        primaryField.parentNode.insertBefore(helper, btn.nextSibling);
      }
      btn.dataset.pmgLinearPositioned = '1';
    }
    return true;
  }

  /* ---------------- Boot ---------------- */
  function init() {
    injectStyles();
    /* Try once now, then poll briefly because pmg-text-studio.js
       mounts on its own schedule. */
    if (wrapAndMoveStudio()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      positionHelpMeStart();
      if (wrapAndMoveStudio() || tries > 60) clearInterval(iv);
    }, 200);
    /* And try positioning right away in case help-me-start was already
       inserted before this script ran. */
    positionHelpMeStart();
    setTimeout(positionHelpMeStart, 500);
    setTimeout(positionHelpMeStart, 1500);
    setTimeout(positionHelpMeStart, 3000);

    /* Watch the form for any structural change and reposition.
       Multiple other scripts (T46, T24, polish, FIX 4) inject and move
       things into the form on different schedules — a MutationObserver
       is the safest way to keep Help Me Start anchored to the right spot. */
    try {
      var formObserver = new MutationObserver(function () {
        var btn = document.getElementById('pmg-help-me-start-btn');
        var primary = document.querySelector('#prompt-form > .field.field-primary');
        if (!btn || !primary) return;
        if (btn.previousElementSibling !== primary) {
          /* Reset the flag so positionHelpMeStart will move it. */
          btn.dataset.pmgLinearPositioned = '';
          positionHelpMeStart();
        }
      });
      var attachFormObs = function () {
        var f = document.getElementById('prompt-form');
        if (f) {
          formObserver.observe(f, { childList: true, subtree: false });
        } else {
          setTimeout(attachFormObs, 400);
        }
      };
      attachFormObs();
    } catch (_) {}

    /* Also re-apply title case if the studio header ever re-renders. */
    var titleObserver;
    try {
      titleObserver = new MutationObserver(function () {
        applyTitleCaseLabels();
      });
      var attach = function () {
        var t = document.getElementById('pmg-ts-title');
        if (t) {
          titleObserver.observe(t, { childList: true, characterData: true, subtree: true });
        } else {
          setTimeout(attach, 400);
        }
      };
      attach();
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
