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
         children. Text-mode only. */
      'body:not(.image-mode) #prompt-form {',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '}',
      'body:not(.image-mode) #prompt-form > * { order: 9; }',
      'body:not(.image-mode) #prompt-form > .field.field-primary { order: 1; }',
      /* Task #18: restored upload sits BETWEEN Fix My Prompt (which is
         the last child of .field.field-primary) and Help Me Start, so the
         linear column reads:
           Goal Label → Goal Textarea → Fix My Prompt → Add A File Or
           Image (Optional) → Help Me Start → More Control. */
      'body:not(.image-mode) #prompt-form > #upload-field { order: 2; }',
      'body:not(.image-mode) #prompt-form > #pmg-help-me-start-btn { order: 3; }',
      'body:not(.image-mode) #prompt-form > #pmg-hms-helper { order: 4; }',
      'body:not(.image-mode) #prompt-form > #post-uc-guidance { order: 5; }',
      'body:not(.image-mode) #prompt-form > #settingsPanel { order: 6; }',
      /* T46 leaves #tour-step-generate empty after moving #generateBtn
         out — push it to the bottom so it can't add a gap above Goal. */
      'body:not(.image-mode) #prompt-form > #tour-step-generate { order: 8; }',

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
    /* Text mode only — image mode hides Help Me Start anyway. */
    if (document.body && document.body.classList.contains('image-mode')) return false;
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
      if (!btn || !primary || btn.previousElementSibling === primary) return;
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
