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

      /* Hide Text Studio Pro until first generation; afterward it
         appears collapsed inside #pmg-improve-collapsible. */
      'body:not(.pmg-has-result) #pmg-improve-collapsible { display: none !important; }',
      'body:not(.pmg-has-result) #transform-studio:not(#pmg-improve-collapsible #transform-studio) {',
      '  display: none !important;',
      '}',

      /* "Improve Your Prompt (Optional)" collapsible chrome (text mode). */
      'body:not(.image-mode) #pmg-improve-collapsible {',
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

      /* Folded studio sits flush — no double card chrome. */
      '#pmg-improve-collapsible #pmg-ts-panel { margin: 0; border-radius: 0 0 14px 14px; }',

      /* ---------- T19: "Make This Prompt:" guided chip row ---------- */
      '#pmg-improve-chips {',
      '  padding: 14px 16px 8px;',
      '  border-bottom: 1px solid var(--color-divider, #dfdcd5);',
      '  background: var(--color-surface, #fbfbf9);',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '}',
      '#pmg-improve-chips-label {',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  color: var(--color-text-muted, #67655f);',
      '  letter-spacing: 0.02em;',
      '  text-transform: none;',
      '  margin: 0;',
      '}',
      '#pmg-improve-chips-row {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 8px;',
      '}',
      '.pmg-improve-chip {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '  min-height: 44px;',
      '  padding: 8px 14px;',
      '  border-radius: 999px;',
      '  background: var(--color-surface-2, #f1efea);',
      '  color: var(--color-text, #24211c);',
      '  border: 1px solid var(--color-border, #d8d4cd);',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: background 160ms ease, border-color 160ms ease, transform 120ms ease;',
      '  white-space: nowrap;',
      '}',
      '.pmg-improve-chip:hover:not(:disabled) {',
      '  background: color-mix(in srgb, var(--color-primary, #01696f) 10%, var(--color-surface-2, #f1efea));',
      '  border-color: color-mix(in srgb, var(--color-primary, #01696f) 35%, var(--color-border, #d8d4cd));',
      '}',
      '.pmg-improve-chip:active:not(:disabled) { transform: translateY(1px); }',
      '.pmg-improve-chip:disabled {',
      '  opacity: 0.55;',
      '  cursor: not-allowed;',
      '}',
      '.pmg-improve-chip.is-active {',
      '  background: var(--color-primary, #01696f);',
      '  color: var(--color-text-inverse, #fff);',
      '  border-color: var(--color-primary, #01696f);',
      '}',
      '.pmg-improve-chip-status {',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  margin-left: 4px;',
      '  opacity: 0.85;',
      '}',
      '.pmg-improve-chip-status[hidden] { display: none; }',
      '@media (max-width: 480px) {',
      '  .pmg-improve-chip { flex: 1 1 calc(50% - 4px); padding: 8px 10px; font-size: 13px; }',
      '}',
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
    /* Text mode only — Photography Suite has its own panels and must
       not have its DOM rearranged by this overlay. */
    if (document.body && document.body.classList.contains('image-mode')) return false;
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

    /* T19: prepend the "Make This Prompt:" guided chip row ABOVE the
       studio so the panel opens into a friendly five-button menu
       instead of the full advanced surface. */
    var chipRow = buildImproveChipRow();
    if (chipRow) body.appendChild(chipRow);

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

  /* ----------------------------------------------------------------------
   * T19: "Make This Prompt:" guided chip row.
   *
   * MAPPING (chip label → existing MODES id in pmg-text-studio.js:86-294):
   *   - "More Specific"     → tighten     (Tighten The Structure)
   *   - "More Persuasive"   → persuasive  (Make It More Persuasive)
   *   - "More Detailed"     → expand      (Expand The Idea)
   *   - "Beginner Friendly" → simplify    (Simplify The Message)
   *   - "Professional Tone" → translate   (Translate For An Audience)
   *
   * Each chip:
   *   1) Pre-fills the existing #pmg-ts-textarea with the current
   *      #resultBox text (the user's "Your Fixed Prompt").
   *   2) Selects the matching mode by clicking the existing mode card
   *      (this also handles Pro gating + upgrade-modal flow).
   *   3) Clicks the existing #pmg-ts-action button to fire the
   *      EXISTING runTransformation() — no new transform endpoint,
   *      no new AI plumbing.
   *   4) Polls for completion, then writes the FIRST output section
   *      back into #resultBox IN PLACE so Run / Copy / Refine stay
   *      adjacent and visible. The studio output below remains as
   *      the detail / change-list view.
   * ---------------------------------------------------------------------- */
  var CHIP_DEFS = [
    { label: 'More Specific',     modeId: 'tighten',    pro: true  },
    { label: 'More Persuasive',   modeId: 'persuasive', pro: true  },
    { label: 'More Detailed',     modeId: 'expand',     pro: true  },
    { label: 'Beginner Friendly', modeId: 'simplify',   pro: true  },
    { label: 'Professional Tone', modeId: 'translate',  pro: true  }
  ];
  var chipInFlight = false;

  function buildImproveChipRow() {
    if (document.getElementById('pmg-improve-chips')) return null;
    var wrap = document.createElement('div');
    wrap.id = 'pmg-improve-chips';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Make This Prompt');

    var label = document.createElement('p');
    label.id = 'pmg-improve-chips-label';
    label.textContent = 'Make This Prompt:';

    var row = document.createElement('div');
    row.id = 'pmg-improve-chips-row';

    CHIP_DEFS.forEach(function (def) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmg-improve-chip';
      btn.dataset.chipMode = def.modeId;
      btn.dataset.chipLabel = def.label;
      btn.setAttribute('aria-label', 'Rewrite this prompt: ' + def.label);

      var labelSpan = document.createElement('span');
      labelSpan.className = 'pmg-improve-chip-label';
      labelSpan.textContent = def.label;

      var statusSpan = document.createElement('span');
      statusSpan.className = 'pmg-improve-chip-status';
      statusSpan.hidden = true;
      statusSpan.setAttribute('aria-live', 'polite');

      btn.appendChild(labelSpan);
      btn.appendChild(statusSpan);
      btn.addEventListener('click', function () { runChipTransform(def, btn); });
      row.appendChild(btn);
    });

    wrap.appendChild(label);
    wrap.appendChild(row);
    return wrap;
  }

  function setAllChipsDisabled(disabled) {
    var all = document.querySelectorAll('#pmg-improve-chips-row .pmg-improve-chip');
    Array.prototype.forEach.call(all, function (b) {
      b.disabled = disabled;
      b.setAttribute('aria-busy', disabled ? 'true' : 'false');
    });
  }

  function setChipStatus(btn, msg, autoClearMs) {
    if (!btn) return;
    var s = btn.querySelector('.pmg-improve-chip-status');
    if (!s) return;
    if (!msg) { s.hidden = true; s.textContent = ''; return; }
    s.hidden = false;
    s.textContent = msg;
    if (autoClearMs) {
      setTimeout(function () {
        if (s && s.textContent === msg) {
          s.hidden = true;
          s.textContent = '';
          if (btn) btn.classList.remove('is-active');
        }
      }, autoClearMs);
    }
  }

  function getResultBoxText() {
    var rb = document.getElementById('resultBox');
    if (!rb) return '';
    var t = (rb.innerText || rb.textContent || '').trim();
    /* Skip the placeholder copy. */
    if (!t || t === 'Your fixed prompt will appear here.') return '';
    return t;
  }

  function isProUser() {
    try {
      if (typeof window.pmgIsPro === 'function') return !!window.pmgIsPro();
      if (document.body && document.body.classList.contains('pmg-is-pro')) return true;
    } catch (_) {}
    return false;
  }

  /* Tracks the chip currently driving a transform so the global
     completion / error event listeners can update the right button. */
  var activeChip = null;
  var activeChipModeId = null;
  var chipTimeoutId = null;

  function runChipTransform(def, chipBtn) {
    if (chipInFlight) return;

    /* Pro gating: if mode requires Pro and user isn't, just click the
       matching mode card so the existing upgrade modal flow runs.
       Beta-mode unlock makes this a no-op for everyone today. */
    if (def.pro && !isProUser()) {
      var card = document.querySelector('#pmg-ts-modes .pmg-ts-mode-card[data-mode-id="' + def.modeId + '"]');
      if (card) card.click();
      return;
    }

    var prompt = getResultBoxText();
    if (!prompt) {
      setChipStatus(chipBtn, 'Generate A Prompt First', 3000);
      return;
    }

    var ta = document.getElementById('pmg-ts-textarea');
    var actionBtn = document.getElementById('pmg-ts-action');
    var modeCard = document.querySelector('#pmg-ts-modes .pmg-ts-mode-card[data-mode-id="' + def.modeId + '"]');
    var resultBox = document.getElementById('resultBox');
    if (!ta || !actionBtn || !modeCard || !resultBox) {
      setChipStatus(chipBtn, 'Try Again', 3000);
      return;
    }
    /* If the studio is already running a manual transform, don't pile
       on — let the user finish or wait. */
    if (actionBtn.classList.contains('is-loading')) {
      setChipStatus(chipBtn, 'Studio Busy', 2400);
      return;
    }

    chipInFlight = true;
    activeChip = chipBtn;
    activeChipModeId = def.modeId;
    setAllChipsDisabled(true);
    chipBtn.classList.add('is-active');
    setChipStatus(chipBtn, 'Updating…');

    /* Pre-fill the studio textarea with the current Fixed Prompt and
       fire 'input' so the studio's internal state.text is synced. */
    ta.value = prompt;
    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}

    /* Select the mode (wires aria-checked + selected state) and
       trigger the existing run pipeline. */
    try { modeCard.click(); } catch (_) {}

    /* Use a microtask delay so refreshActionButton completes before
       we fire the action button. */
    setTimeout(function () {
      try {
        actionBtn.click();
      } catch (_) {
        finishChipFlow(chipBtn, 'Try Again', true);
        return;
      }
      /* Hard timeout safety net (90s) in case neither completion nor
         error event fires (e.g. AI client misconfigured). */
      chipTimeoutId = setTimeout(function () {
        if (chipInFlight && activeChip === chipBtn) {
          finishChipFlow(chipBtn, 'Took Too Long', true);
        }
      }, 90000);
    }, 30);
  }

  /* Apply a successful transform to #resultBox in place. */
  function applyChipResult(text) {
    var resultBox = document.getElementById('resultBox');
    if (!resultBox || !text) return false;
    resultBox.textContent = text;
    /* Notify any listeners (T26 observers, strength score, etc.) so
       dependent UI refreshes. */
    try {
      resultBox.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {}
    /* Keep the user near the result; don't jump them down to the
       studio output that the studio already scrolled to. */
    try {
      resultBox.scrollIntoView({
        behavior: window.PMG_A11Y && window.PMG_A11Y.scrollBehavior
          ? window.PMG_A11Y.scrollBehavior() : 'smooth',
        block: 'center'
      });
    } catch (_) {}
    return true;
  }

  function finishChipFlow(chipBtn, statusMsg, isError) {
    chipInFlight = false;
    activeChip = null;
    activeChipModeId = null;
    if (chipTimeoutId) { clearTimeout(chipTimeoutId); chipTimeoutId = null; }
    setAllChipsDisabled(false);
    if (chipBtn) {
      setChipStatus(chipBtn, statusMsg, isError ? 4000 : 2400);
      if (isError) {
        chipBtn.classList.remove('is-active');
      }
    }
  }

  /* Listen for the studio's transform completion / error events
     (added in pmg-text-studio.js). When a transform we kicked off
     finishes, copy the first-section text into #resultBox in place. */
  document.addEventListener('pmg-ts:transform-complete', function (e) {
    if (!chipInFlight || !activeChip) return;
    var detail = e && e.detail ? e.detail : {};
    if (activeChipModeId && detail.modeId && detail.modeId !== activeChipModeId) return;
    var text = (detail.firstSectionBody || '').trim();
    if (text && applyChipResult(text)) {
      finishChipFlow(activeChip, 'Updated', false);
    } else {
      finishChipFlow(activeChip, 'Try Again', true);
    }
  });
  document.addEventListener('pmg-ts:transform-error', function (e) {
    if (!chipInFlight || !activeChip) return;
    var detail = e && e.detail ? e.detail : {};
    if (activeChipModeId && detail.modeId && detail.modeId !== activeChipModeId) return;
    finishChipFlow(activeChip, 'Try Again', true);
  });

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
    wrapAndMoveStudio();

    /* pmg-text-studio.js mounts #transform-studio on its own schedule;
       poll briefly until it shows up. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      positionHelpMeStart();
      if (wrapAndMoveStudio() || tries > 60) clearInterval(iv);
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

    /* Re-apply Title Case if the studio header re-renders. */
    var titleObserver = new MutationObserver(applyTitleCaseLabels);
    var attach = function () {
      var t = document.getElementById('pmg-ts-title');
      if (t) {
        titleObserver.observe(t, { childList: true, characterData: true, subtree: true });
      } else {
        setTimeout(attach, 400);
      }
    };
    attach();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
