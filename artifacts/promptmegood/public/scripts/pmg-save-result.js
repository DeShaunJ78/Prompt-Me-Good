/* pmg-save-result.js
 * Adds three things:
 *   1. Explicit "💾 Save Prompt" button in the built-prompt actions row
 *      (sits next to Copy / Download / Print / Clear). Auto-save still runs
 *      in the background — this button gives users a visible confirmation
 *      and explicit control.
 *   2. "💾 Save to Vault" button inside both AI response action rows
 *      (top + bottom). Saves the prompt + AI result as a NEW vault entry
 *      with kind:'ai_result' and parentId linking back to the source
 *      built-prompt entry (when one exists).
 *   3. Lightweight inline confirm ("Replace / Save as New / Cancel")
 *      when the same prompt already has at least one saved AI result.
 *
 * Vault data shape (backwards-compatible extension):
 *   Existing entries: { id, savedAt, data:{goal,...}, prompt, favorite, ... }
 *   NEW ai_result entries also include:
 *     kind: 'ai_result'
 *     aiResponse: string             // the streamed AI output
 *     aiModel: string                // best-guess model label
 *     aiRunAt: number                // when the AI run completed
 *     parentId: string | undefined   // links to the source built entry
 *   Existing built entries are unchanged. Missing kind => treat as 'built'.
 *
 * Kill switches: localStorage.pmg_saveresult_disable='1' OR ?saveresult=off
 */
(function () {
  'use strict';

  // -------- Kill switch --------
  try {
    if (localStorage.getItem('pmg_saveresult_disable') === '1') return;
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('saveresult') === 'off') return;
  } catch (_) {}

  var HISTORY_KEY = 'promptmegood:history:v1';

  // -------- Vault helpers --------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function saveHistory(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); return true; }
    catch (_) { return false; }
  }
  function notifyVaultSaved() {
    try { document.dispatchEvent(new Event('pmg:vault-saved')); } catch (_) {}
    // Re-render the visible vault if the host page exposes renderHistory.
    try {
      if (typeof window.renderHistory === 'function') window.renderHistory();
    } catch (_) {}
  }
  function newId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Snapshot the current builder form so the saved entry can be restored later.
  function snapshotBuilderData(fallbackGoal) {
    function v(id, dflt) {
      var el = document.getElementById(id);
      if (!el) return dflt;
      if (el.type === 'checkbox') return !!el.checked;
      return el.value != null ? el.value : dflt;
    }
    var maxLen = v('maxLength', '');
    var maxLenCustom = v('maxLengthCustom', '');
    var maxLength = maxLen === 'custom' ? maxLenCustom : maxLen;
    var rulesEl = document.getElementById('rules or limits');
    return {
      goal: v('goal', '') || fallbackGoal || '',
      category: v('category', 'other'),
      skillLevel: v('skillLevel', 'beginner'),
      tone: v('tone', 'bold-direct'),
      outputFormat: v('outputFormat', 'step-by-step'),
      details: v('details', ''),
      'rules or limits': rulesEl ? rulesEl.value : '',
      maxLength: maxLength || null,
      moneyMode: v('moneyMode', false),
      humanTone: v('humanTone', false),
      clarityBoost: v('clarityBoost', false),
      outputLanguage: v('outputLanguage', 'english'),
      personality: v('personality', 'none'),
    };
  }

  // -------- Read current built prompt --------
  function getCurrentPrompt() {
    var box = document.getElementById('resultBox');
    if (!box) return '';
    var txt = (box.textContent || '').trim();
    // Filter out the empty-state placeholder.
    if (!txt || /^Your fixed prompt will appear here/i.test(txt)) return '';
    return txt;
  }

  // -------- Read current AI response --------
  var AI_ERROR_PHRASES = [
    'Network error',
    'Run failed',
    'Stream interrupted',
    'No response received',
    'AI service is temporarily unavailable',
    'Streaming not supported',
    'Rate limit reached',
    'Waiting for AI response',
  ];
  function getCurrentAiResponse() {
    var out = document.getElementById('aiResponseOutput');
    if (!out) return '';
    // If the streaming-status block is still mounted, there's no real response yet.
    if (out.querySelector && out.querySelector('.pmg-stream-status')) return '';
    if (out.classList && out.classList.contains('is-streaming')) return '';
    var txt = (out.textContent || '').trim();
    if (!txt) return '';
    for (var i = 0; i < AI_ERROR_PHRASES.length; i++) {
      if (txt.indexOf(AI_ERROR_PHRASES[i]) === 0) return '';
    }
    return txt;
  }

  // Best-effort model label. Tier inference from cap data exposed on the page.
  function guessAiModel() {
    try {
      var meta = document.querySelector('meta[name="x-pmg-tier"]');
      if (meta && meta.content) {
        if (meta.content === 'free') return 'GPT-4.1-mini';
        return 'GPT-4.1';
      }
    } catch (_) {}
    // Fallback: free tier is the visible default; the model copy in the run
    // section says GPT-4.1-mini on free, full GPT-4.1 on paid.
    return 'GPT-4.1';
  }

  // -------- Toast --------
  function showToast(anchorBtn, msg) {
    if (!anchorBtn || !anchorBtn.parentNode) return;
    var prev = anchorBtn.parentNode.querySelector('.pmg-save-toast[data-anchor="' + anchorBtn.id + '"]');
    if (prev) prev.parentNode.removeChild(prev);
    var t = document.createElement('span');
    t.className = 'pmg-save-toast';
    t.setAttribute('role', 'status');
    if (anchorBtn.id) t.setAttribute('data-anchor', anchorBtn.id);
    t.textContent = msg;
    anchorBtn.parentNode.insertBefore(t, anchorBtn.nextSibling);
    requestAnimationFrame(function () { t.classList.add('is-visible'); });
    setTimeout(function () {
      t.classList.remove('is-visible');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2400);
  }

  function flashSaved(btn, label) {
    if (!btn) return;
    var orig = btn.getAttribute('data-orig-label') || btn.textContent;
    btn.setAttribute('data-orig-label', orig);
    btn.setAttribute('data-state', 'saved');
    btn.textContent = label || '✓ Saved';
    setTimeout(function () {
      btn.removeAttribute('data-state');
      btn.textContent = orig;
    }, 1800);
  }

  // -------- Save Prompt (built) --------
  function handleSavePromptClick(btn) {
    var prompt = getCurrentPrompt();
    if (!prompt) {
      showToast(btn, 'Generate a prompt first.');
      return;
    }
    var items = loadHistory();
    // Find an existing built entry for the exact same prompt (most recent).
    var existing = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if ((it.kind || 'built') !== 'built') continue;
      if (it.prompt === prompt) { existing = it; break; }
    }
    if (existing) {
      flashSaved(btn, '✓ Already in Vault');
      return;
    }
    var goal = (document.getElementById('goal') || {}).value || '';
    items.unshift({
      id: newId(),
      savedAt: Date.now(),
      kind: 'built',
      data: snapshotBuilderData(goal),
      prompt: prompt,
      favorite: false,
    });
    if (!saveHistory(items)) {
      showToast(btn, 'Couldn\u2019t save \u2014 storage full or blocked.');
      return;
    }
    flashSaved(btn, '✓ Saved');
    notifyVaultSaved();
  }

  // -------- Save AI Result (with optional Replace / Save as New) --------
  function findExistingAiResults(prompt, items) {
    var matches = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind !== 'ai_result') continue;
      if (it.prompt === prompt) matches.push(it);
    }
    return matches;
  }

  function findParentBuiltId(prompt, items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if ((it.kind || 'built') !== 'built') continue;
      if (it.prompt === prompt) return it.id;
    }
    return undefined;
  }

  function buildAiEntry(prompt, aiResponse, parentId) {
    var goal = (document.getElementById('goal') || {}).value || '';
    return {
      id: newId(),
      savedAt: Date.now(),
      kind: 'ai_result',
      data: snapshotBuilderData(goal),
      prompt: prompt,
      favorite: false,
      aiResponse: aiResponse,
      aiModel: guessAiModel(),
      aiRunAt: Date.now(),
      parentId: parentId,
    };
  }

  function performAiSave(mode, prompt, aiResponse, anchorBtn) {
    var items = loadHistory();
    var parentId = findParentBuiltId(prompt, items);
    var existing = findExistingAiResults(prompt, items);
    if (mode === 'replace' && existing.length) {
      // Pick the truly newest existing ai_result by timestamp — never trust
      // array order, since favorites/drag/sort can reorder the underlying
      // history. Fall back to savedAt, then to existing[0]. (architect review)
      var newest = existing.slice().sort(function (a, b) {
        var at = a.aiRunAt || a.savedAt || 0;
        var bt = b.aiRunAt || b.savedAt || 0;
        return bt - at;
      })[0];
      newest.aiResponse = aiResponse;
      newest.aiModel = guessAiModel();
      newest.aiRunAt = Date.now();
      newest.savedAt = Date.now();
      newest.parentId = newest.parentId || parentId;
      // Move it to the top.
      items = items.filter(function (x) { return x.id !== newest.id; });
      items.unshift(newest);
    } else {
      items.unshift(buildAiEntry(prompt, aiResponse, parentId));
    }
    if (!saveHistory(items)) {
      showToast(anchorBtn, 'Couldn\u2019t save \u2014 storage full or blocked.');
      return;
    }
    flashSaved(anchorBtn, mode === 'replace' ? '✓ Replaced' : '✓ Saved to Vault');
    notifyVaultSaved();
  }

  function showAiSaveConfirm(anchorBtn, prompt, aiResponse, existingCount) {
    // Remove any prior popover.
    var prev = anchorBtn.parentNode.querySelector('.pmg-save-confirm[data-anchor="' + anchorBtn.id + '"]');
    if (prev) prev.parentNode.removeChild(prev);

    var pop = document.createElement('div');
    pop.className = 'pmg-save-confirm';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Replace existing AI result?');
    if (anchorBtn.id) pop.setAttribute('data-anchor', anchorBtn.id);
    var msg = document.createElement('div');
    msg.className = 'pmg-save-confirm__msg';
    msg.textContent = 'You already have ' + existingCount + ' saved AI result' +
      (existingCount === 1 ? '' : 's') + ' for this prompt. ' +
      'Replace the most recent one, or save this run as a new entry?';
    pop.appendChild(msg);

    var row = document.createElement('div');
    row.className = 'pmg-save-confirm__row';

    function makeBtn(label, kind) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (kind === 'replace' ? 'btn-secondary' : (kind === 'new' ? 'btn-primary' : 'btn-secondary'));
      b.textContent = label;
      return b;
    }

    var bReplace = makeBtn('Replace Latest', 'replace');
    var bNew = makeBtn('Save as New', 'new');
    var bCancel = makeBtn('Cancel', 'cancel');

    bReplace.addEventListener('click', function () {
      pop.parentNode && pop.parentNode.removeChild(pop);
      performAiSave('replace', prompt, aiResponse, anchorBtn);
    });
    bNew.addEventListener('click', function () {
      pop.parentNode && pop.parentNode.removeChild(pop);
      performAiSave('new', prompt, aiResponse, anchorBtn);
    });
    bCancel.addEventListener('click', function () {
      pop.parentNode && pop.parentNode.removeChild(pop);
    });

    row.appendChild(bReplace);
    row.appendChild(bNew);
    row.appendChild(bCancel);
    pop.appendChild(row);

    anchorBtn.parentNode.insertBefore(pop, anchorBtn.nextSibling);
  }

  function handleSaveAiClick(btn) {
    var prompt = getCurrentPrompt();
    var aiResponse = getCurrentAiResponse();
    if (!prompt || !aiResponse) {
      showToast(btn, 'Run With AI first, then save the result.');
      return;
    }
    var items = loadHistory();
    var existing = findExistingAiResults(prompt, items);
    if (existing.length === 0) {
      performAiSave('new', prompt, aiResponse, btn);
      return;
    }
    showAiSaveConfirm(btn, prompt, aiResponse, existing.length);
  }

  // -------- Inject buttons --------
  function injectSavePromptButton() {
    var row = document.querySelector('.pmg-result-actions-row');
    if (!row) return false;
    if (document.getElementById('pmg-save-prompt-btn')) return true;
    var copyBtn = document.getElementById('copy-btn');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-save-prompt-btn';
    btn.className = 'btn btn-secondary';
    btn.title = 'Save this prompt to your local Vault.';
    btn.textContent = '💾 Save Prompt';
    btn.addEventListener('click', function () { handleSavePromptClick(btn); });
    if (copyBtn && copyBtn.nextSibling) {
      row.insertBefore(btn, copyBtn.nextSibling);
    } else {
      row.appendChild(btn);
    }
    // Mirror the disabled-until-result behavior of #copy-btn.
    function syncDisabled() {
      var hasPrompt = !!getCurrentPrompt();
      btn.disabled = !hasPrompt;
      btn.setAttribute('aria-disabled', hasPrompt ? 'false' : 'true');
    }
    syncDisabled();
    var box = document.getElementById('resultBox');
    if (box) {
      var mo = new MutationObserver(syncDisabled);
      mo.observe(box, { childList: true, characterData: true, subtree: true });
    }
    return true;
  }

  function injectSaveAiButtons() {
    var rows = document.querySelectorAll('.ai-response-actions');
    if (!rows.length) return false;
    var injected = 0;
    rows.forEach(function (row, idx) {
      var existingId = 'pmg-save-ai-btn-' + idx;
      if (document.getElementById(existingId)) { injected++; return; }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = existingId;
      btn.className = 'btn btn-primary pmg-save-ai-btn';
      btn.title = 'Save this AI result to your Vault as a paired entry.';
      btn.textContent = '💾 Save to Vault';
      btn.addEventListener('click', function () { handleSaveAiClick(btn); });
      // Insert as the FIRST child so it's the prominent action.
      if (row.firstChild) row.insertBefore(btn, row.firstChild);
      else row.appendChild(btn);
      injected++;
    });
    syncSaveAiEnabled();
    return injected > 0;
  }

  function syncSaveAiEnabled() {
    var btns = document.querySelectorAll('.pmg-save-ai-btn');
    if (!btns.length) return;
    var section = document.getElementById('aiResponseSection');
    var visible = !!(section && !section.hidden);
    var hasResult = !!getCurrentAiResponse();
    var enable = visible && hasResult;
    btns.forEach(function (b) {
      b.disabled = !enable;
      b.setAttribute('aria-disabled', enable ? 'false' : 'true');
    });
  }

  function watchAiResponse() {
    var section = document.getElementById('aiResponseSection');
    var out = document.getElementById('aiResponseOutput');
    if (!section || !out) return;
    var mo = new MutationObserver(syncSaveAiEnabled);
    mo.observe(section, { attributes: true, attributeFilter: ['hidden'] });
    mo.observe(out, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    // Built-prompt row may not exist on every page; tolerate absence.
    injectSavePromptButton();
    injectSaveAiButtons();
    watchAiResponse();

    // Some surfaces (chassis-v3) reparent DOM after first paint. Re-try a few
    // times to make sure the buttons land in the right rows post-reparent.
    var tries = 0;
    var retry = setInterval(function () {
      tries++;
      var ok1 = injectSavePromptButton();
      var ok2 = injectSaveAiButtons();
      if ((ok1 && ok2) || tries > 30) clearInterval(retry);
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
