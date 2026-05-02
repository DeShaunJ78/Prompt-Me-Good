/* pmg-linear-flow.js — Task #15: linear top-to-bottom Create A Text
 * Prompt column. Additive overlay; all visual rules scoped with
 * body:not(.image-mode) to keep Photography Suite untouched. See
 * .local/tasks/task-15.md "## Approved Order" for the section list.
 */
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
      /* Show Goal textarea by default; T31 had it gated behind an
         "I Know What I Want" toggle. Image-mode keeps its own gate. */
      'body:not(.image-mode) #prompt-form > .field.field-primary {',
      '  display: block !important;',
      '}',

      /* Hide the top gating callout — Help Me Start is now the single
         secondary button below Fix My Prompt. */
      'body:not(.image-mode) #pmg-text-help-row { display: none !important; }',

      /* Re-show #pmg-help-me-start-btn (T45 hid it as a duplicate of
         the now-removed top callout). Same specificity as T45 selector
         + !important; this stylesheet loads last so source order wins. */
      'body:not(.image-mode) #pmg-help-me-start-btn[id] {',
      '  display: inline-flex !important;',
      '  width: auto;',
      '  max-width: 420px;',
      '  margin: 10px auto 6px;',
      '}',
      'body.pmg-t15-help-ok:not(.image-mode) #pmg-help-me-start-btn {',
      '  display: inline-flex !important;',
      '}',

      /* Force visual order via flex `order` so we are not at the mercy
         of T46/T24/polish/FIX-4 race conditions reordering #prompt-form
         children. Text-mode only.
         Refocus v2 (user feedback: "the guided wizard isnt in a good
         place flow wise. Its way too far down when it should be a subtle
         options near the text box. its causing friction. Why would a
         user work through most of the column to start completly over
         from the beginning?"): move Help Me Start BEFORE the Goal
         textarea so it reads as a "before you start" optional helper
         instead of a "now go back and start over" footnote.

         New column flow:
           eyebrow + headline (injected above by pmg-text-flow-v2.js)
           → Help Me Start          (order 0)  ← moved up from 5
           → Help Me Start helper   (order 0)  ← moved up from 6 (DOM order keeps it after the btn)
           → Goal textarea          (order 1)
           → Prompt Tuning          (order 2, #settingsPanel)
           → primary action row     (order 3, #tour-step-generate)
           → upload file            (order 4, secondary)
           → post-UC guidance       (order 7)
           → everything else        (order 9, catch-all)         */
      'body:not(.image-mode) #prompt-form {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '}',
      'body:not(.image-mode) #prompt-form > * { order: 9; }',
      'body:not(.image-mode) #prompt-form > #pmg-help-me-start-btn { order: 0; }',
      'body:not(.image-mode) #prompt-form > #pmg-hms-helper { order: 0; }',
      'body:not(.image-mode) #prompt-form > .field.field-primary { order: 1; }',
      'body:not(.image-mode) #prompt-form > #settingsPanel { order: 2; }',
      'body:not(.image-mode) #prompt-form > #tour-step-generate { order: 3; }',
      'body:not(.image-mode) #prompt-form > #upload-field { order: 4; }',
      'body:not(.image-mode) #prompt-form > #post-uc-guidance { order: 7; }',

      /* Slim-at-top override for Help Me Start. T24 paints it as a
         56px tall full-width pill with a "Most Loved" corner badge —
         that styling was right when the button sat below Fix My Prompt
         as a "do this if you got stuck" rescue. At the top of the
         column, above the Goal textarea, it needs to be a subtle
         optional helper instead of a competing primary call-to-action,
         so the textarea remains the obvious focus. */
      'body:not(.image-mode) #pmg-help-me-start-btn.pmg-help-me-start-btn {',
      '  min-height: 38px !important;',
      '  padding: 6px 14px !important;',
      '  font-size: var(--text-sm, 14px) !important;',
      '  font-weight: 600 !important;',
      '  border-radius: var(--radius-full, 999px) !important;',
      '  margin: 0 0 6px !important;',
      '  width: auto !important;',
      '  max-width: 100% !important;',
      '  align-self: flex-start;',
      '  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-primary, #0f6e6a) 12%, transparent) !important;',
      '}',
      'body:not(.image-mode) #pmg-help-me-start-btn.pmg-help-me-start-btn .pmg-hms-most-loved {',
      '  top: -7px !important;',
      '  right: 8px !important;',
      '  font-size: 9px !important;',
      '  padding: 2px 6px !important;',
      '  letter-spacing: 0.04em !important;',
      '}',
      'body:not(.image-mode) #pmg-hms-helper {',
      '  margin: 0 0 12px !important;',
      '  font-size: 12px !important;',
      '  text-align: left !important;',
      '  font-style: normal !important;',
      '  color: var(--color-text-muted, #5f6b75) !important;',
      '}',

      /* ---- Action row parity with Photography Suite ----
         Make #tour-step-generate look and behave like the Photo Suite's
         `.pmg-photo-actions` row: the primary button is prominent and
         full-width on mobile, secondary buttons are ghost-style and
         compact. Scoped to text mode so image mode is untouched. */
      'body:not(.image-mode) #tour-step-generate {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: var(--space-2, 8px);',
      '  margin-top: var(--space-3, 12px);',
      '  align-items: center;',
      '}',
      'body:not(.image-mode) #generateBtn {',
      '  flex: 1 1 auto;',
      '  min-height: 52px;',
      '  font-size: var(--text-base, 15px);',
      '  font-weight: 700;',
      '  border-radius: var(--radius-full, 999px);',
      '  background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, #6c63ff));',
      '  color: #fff;',
      '  border: 0;',
      '  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 25%, transparent);',
      '  transition: transform 120ms ease, filter 180ms ease;',
      '}',
      'body:not(.image-mode) #generateBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }',
      'body:not(.image-mode) #generateBtn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }',
      'body:not(.image-mode) #tour-step-generate #random-prompt,',
      'body:not(.image-mode) #tour-step-generate #fill-demo {',
      '  padding: 10px 18px;',
      '  font-size: var(--text-sm, 14px);',
      '  font-weight: 600;',
      '  background: var(--color-surface, #fff);',
      '  color: var(--color-text, #1d2a32);',
      '  border: 1.5px solid var(--color-border, #d0d9e0);',
      '  border-radius: var(--radius-full, 999px);',
      '  cursor: pointer;',
      '  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;',
      '}',
      'body:not(.image-mode) #tour-step-generate #random-prompt:hover,',
      'body:not(.image-mode) #tour-step-generate #fill-demo:hover {',
      '  border-color: var(--color-primary);',
      '  color: var(--color-primary);',
      '}',
      '@media (max-width: 640px) {',
      '  body:not(.image-mode) #tour-step-generate {',
      '    flex-direction: column;',
      '  }',
      '  body:not(.image-mode) #generateBtn {',
      '    width: 100%;',
      '  }',
      '  body:not(.image-mode) #tour-step-generate #random-prompt,',
      '  body:not(.image-mode) #tour-step-generate #fill-demo {',
      '    width: 100%;',
      '  }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  body:not(.image-mode) #generateBtn { transition: none; }',
      '  body:not(.image-mode) #generateBtn:hover { transform: none; }',
      '}',

      /* ---------------- Task #18: tighten #upload-field visuals ----------------
         The premium-polish CSS (index.html) applies generous padding and a
         dashed teal background to #upload-field. That reads as "huge
         dropzone" and dominates the column. Below, scoped strictly to text
         mode, we shrink padding, cap the box height (compact), guarantee
         no horizontal overflow, truncate long filenames, and ensure the
         preview row stays inside the column at narrow widths. */
      'body:not(.image-mode) #upload-field {',
      '  padding: 12px 14px !important;',
      '  margin-top: 4px;',
      '  border-radius: 12px;',
      '  max-width: 100%;',
      '  min-width: 0;',
      '  box-sizing: border-box;',
      '  overflow: hidden;',
      '}',
      'body:not(.image-mode) #upload-field .upload-label {',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  margin: 0 0 2px;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  text-transform: none;',
      '  letter-spacing: 0;',
      '}',
      'body:not(.image-mode) #upload-field .upload-helper {',
      '  font-size: 12px;',
      '  margin: 0 0 8px;',
      '  color: var(--color-text-muted, #5f6b75);',
      '}',
      'body:not(.image-mode) #upload-field .upload-controls {',
      '  gap: 8px;',
      '  align-items: center;',
      '}',
      'body:not(.image-mode) #upload-field .upload-btn {',
      '  padding: 8px 14px;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  min-height: 36px;',
      '}',
      'body:not(.image-mode) #upload-field .upload-hint {',
      '  font-size: 12px;',
      '  min-width: 0;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      'body:not(.image-mode) #upload-field .upload-preview {',
      '  margin-top: 8px;',
      '  padding: 8px 10px;',
      '  max-width: 100%;',
      '  min-width: 0;',
      '  box-sizing: border-box;',
      '  overflow: hidden;',
      '}',
      /* Image preview thumbnail — slightly smaller for the compact box. */
      'body:not(.image-mode) #upload-field .upload-preview-img {',
      '  width: 44px;',
      '  height: 44px;',
      '  border-radius: 8px;',
      '  flex-shrink: 0;',
      '}',
      /* Filename truncation safety. */
      'body:not(.image-mode) #upload-field .upload-preview-name {',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  min-width: 0;',
      '  max-width: 100%;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '  display: block;',
      '}',
      'body:not(.image-mode) #upload-field .upload-preview-size {',
      '  font-size: 11px;',
      '}',
      /* Analyze CTA — keep prominent but not towering. */
      'body:not(.image-mode) #upload-field .upload-analyze-btn {',
      '  margin-top: 10px;',
      '  padding: 10px 16px;',
      '  font-size: 14px;',
      '  min-height: 40px;',
      '}',
      /* ---------- Task #20: drag-and-drop dropzone affordance ----------
         The drop IIFE in index.html toggles .pmg-dragover on #upload-field
         while a file is being dragged over it. Scoped strictly to text
         mode so Photography Suite is never affected. The smooth transition
         lives on the base #upload-field selector so leaving the zone
         animates back as well as entering it. */
      'body:not(.image-mode) #upload-field {',
      '  transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;',
      '}',
      'body:not(.image-mode) #upload-field.pmg-dragover {',
      '  background: color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, var(--color-surface, #fff)) !important;',
      '  border-color: color-mix(in srgb, var(--color-primary, #0f6e6a) 60%, transparent) !important;',
      '  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #0f6e6a) 22%, transparent);',
      '}',
      /* Task #23: while a file is being dragged over the dropzone,
         emphasize the helper hint so the verbal label visibly
         changes alongside the border/fill swap. The hint text is
         swapped to "Drop To Attach" by the dropzone JS in
         index.html. */
      'body:not(.image-mode) #upload-field.pmg-dragover .upload-hint {',
      '  font-weight: 700;',
      '  color: var(--color-primary, #0f6e6a);',
      '}',
      /* Task #23: reduce-motion override — users with the OS
         "reduce motion" setting on get an instant state swap rather
         than the 140ms fade. Matches PMG_A11Y conventions used
         elsewhere on the page. */
      '@media (prefers-reduced-motion: reduce) {',
      '  body:not(.image-mode) #upload-field {',
      '    transition: none !important;',
      '  }',
      '}',
      /* ---------- Task #22: paste-from-clipboard hint ----------
         The HTML upload-helper now ends with a small inline span
         advertising "(or paste a screenshot)". Scope it to text mode
         and tone it down so the helper reads as a single calm line
         rather than two equally-weighted phrases. */
      'body:not(.image-mode) #upload-field .upload-paste-hint {',
      '  margin-left: 4px;',
      '  font-size: 11px;',
      '  font-style: italic;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  opacity: 0.85;',
      '  white-space: nowrap;',
      '}',
      /* ---------- No-image fallback row ----------
         When #upload-preview-img is hidden (PDF or load error) the
         premium-polish grid still reserves the 56px image column,
         leaving a visible empty gap. Re-collapse the grid to a clean
         2-column "icon · text · remove" layout and render a neutral
         file glyph in place of the broken-image icon.
         The .pmg-no-img class is applied by the analyze IIFE in
         index.html when the file is non-image or the preview <img>
         emits an `error` event. */
      'body:not(.image-mode) #upload-field .upload-preview.pmg-no-img {',
      '  grid-template-columns: 28px minmax(0, 1fr) auto;',
      '}',
      'body:not(.image-mode) #upload-field .upload-preview.pmg-no-img::before {',
      '  content: "📄";',
      '  width: 28px;',
      '  height: 28px;',
      '  border-radius: 6px;',
      '  background:',
      '    linear-gradient(180deg,',
      '      color-mix(in srgb, var(--color-primary, #0f6e6a) 14%, var(--color-surface, #fff)),',
      '      color-mix(in srgb, var(--color-primary, #0f6e6a) 6%, var(--color-surface, #fff))',
      '    );',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #0f6e6a) 28%, transparent);',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  flex-shrink: 0;',
      '  color: var(--color-primary, #0f6e6a);',
      '  font-size: 14px;',
      '  line-height: 1;',
      '  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;',
      '}',
      /* Tighten the existing image-preview grid too: when the img is
         visible, drop the column width from 56px → 44px to match the
         smaller thumb above. */
      'body:not(.image-mode) #upload-field .upload-preview:not(.pmg-no-img) {',
      '  grid-template-columns: 44px minmax(0, 1fr) auto;',
      '  gap: 10px;',
      '}',
      /* Defense against a rogue `src=""` ever rendering: also hide any',
         broken state via image-rendering / belt-and-braces. */
      'body:not(.image-mode) #upload-field .upload-preview-img:not([src]),',
      'body:not(.image-mode) #upload-field .upload-preview-img[src=""] {',
      '  display: none !important;',
      '}',

      /* Hide pre-generation noise (kbd hint, early-access note). */
      'body:not(.pmg-has-result) #builder .result-wrap > p:has(kbd) { display: none !important; }',
      'body:not(.pmg-has-result) #builder .early-access-note { display: none !important; }',

      ''
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------------- Wrap & move Text Studio Pro (REMOVED) ----------------
   * Text Studio Pro / Transform Text Pro and its T19 "Make This Prompt"
   * chip row were removed in the "Refocus on the Prompt Builder" task.
   * The wrapper, chip row, and event listeners that lived here are
   * gone; the column now ends with the primary action card. */

  /* ---------------- Position Help Me Start ----------------
   * The "Help Me Start (Answer 4 Quick Questions)" button
   * (#pmg-help-me-start-btn) is created by setupHelpMeStartButton in
   * pmg-ux.js. Its visual order is controlled by the flex `order: 0`
   * rule above (rendered before .field.field-primary at order:1).
   * We also move it in the DOM to sit right BEFORE .field.field-primary
   * so tab-order and non-flex fallback rendering match the visual order
   * — i.e. Help Me Start, then Goal textarea, then everything else.
   *
   * Refocus v2 column order (text mode):
   *   Help Me Start (0) → HMS helper (0) → Goal textarea (1)
   *   → Prompt Tuning (2) → Fix My Prompt row (3) → Upload (4)
   */
  function positionHelpMeStart() {
    /* Text mode only — image mode hides Help Me Start anyway. */
    if (document.body && document.body.classList.contains('image-mode')) return false;
    var btn = document.getElementById('pmg-help-me-start-btn');
    var primaryField = document.querySelector('#prompt-form > .field.field-primary');
    if (!btn || !primaryField) return false;
    var helper = document.getElementById('pmg-hms-helper');
    /* Already correctly positioned? btn just before primaryField,
       optionally with helper sandwiched between btn and primaryField. */
    var expectedNext = helper ? helper : primaryField;
    if (btn.dataset.pmgLinearPositioned === 'v2' &&
        btn.nextElementSibling === expectedNext &&
        (!helper || helper.nextElementSibling === primaryField)) {
      return true;
    }
    /* Move btn to be the immediate previous sibling of field-primary,
       and helper (if present) right after btn. */
    if (primaryField.parentNode) {
      primaryField.parentNode.insertBefore(btn, primaryField);
      if (helper && helper.parentNode) {
        primaryField.parentNode.insertBefore(helper, primaryField);
      }
      btn.dataset.pmgLinearPositioned = 'v2';
    }
    return true;
  }

  /* ---------------- Boot ---------------- */
  function init() {
    injectStyles();
    positionHelpMeStart();

    /* Briefly re-run positioning to win against late-loading scripts
       that re-insert children of #prompt-form. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      positionHelpMeStart();
      if (tries > 60) clearInterval(iv);
    }, 200);

    /* Watch #prompt-form so help-me-start stays anchored to the right
       spot if other scripts re-insert children. */
    var formObserver = new MutationObserver(function () {
      var btn = document.getElementById('pmg-help-me-start-btn');
      var primary = document.querySelector('#prompt-form > .field.field-primary');
      if (!btn || !primary) return;
      var helper = document.getElementById('pmg-hms-helper');
      /* Already correctly positioned? Either:
         - btn -> primary  (helper not present), or
         - btn -> helper -> primary  (full adjacency chain).
         Anything else (incl. btn -> helper -> X -> primary) means
         something inserted between helper and primary, so re-position. */
      var ok = (helper && helper.parentNode === btn.parentNode)
        ? (btn.nextElementSibling === helper && helper.nextElementSibling === primary)
        : (btn.nextElementSibling === primary);
      if (ok) return;
      btn.dataset.pmgLinearPositioned = '';
      positionHelpMeStart();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
