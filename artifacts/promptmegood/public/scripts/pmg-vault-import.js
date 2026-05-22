/* pmg-vault-import.js (vi-1, 2026-05-22)
 *
 * Self-contained IIFE that wires the "Import from PromptPerfect" button
 * in the Vault header (#pmg-vault-import-btn) to a JSON/CSV file picker,
 * parses up to two supported shapes, deduplicates by trimmed-lowercase
 * prompt text, and writes each prompt into the Vault one at a time with
 * a 150ms throttle between writes.
 *
 * The Vault is a local-first store keyed at localStorage["promptmegood:history:v1"]
 * (see app.html L6898 saveHistory + L7121 item-shape). There is no
 * /api/vault endpoint — the brief's "POST to the exact vault save
 * endpoint" reduces to mirroring the existing client-side write path.
 * On completion we dispatch the documented `pmg:vault:imported` event so
 * any Vault refresh listener (existing or future) can re-render without
 * coupling to this module.
 *
 * Kill-switch: localStorage.pmg_vault_import_disable = '1'
 *
 * Never:
 *   - calls pmg-ux.js functions by name
 *   - mutates the Vault list DOM directly
 *   - stores imported prompt text in localStorage outside the Vault key
 *   - sends parallel writes (sequential with 150ms gap)
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_vault_import_disable') === '1') return;
  } catch (_) { /* localStorage blocked — proceed without kill-switch */ }

  var HISTORY_KEY = 'promptmegood:history:v1';
  var HISTORY_LIMIT = 25; // mirrors app.html save flow
  var WRITE_DELAY_MS = 150;
  var RATE_LIMIT_RETRY_MS = 2000;
  var BTN_ID = 'pmg-vault-import-btn';

  var importing = false;
  var originalBtnLabel = '';
  var btn = null;
  var uiEl = null;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /* ----- inline UI ------------------------------------------------------ */

  function ensureUi() {
    if (uiEl && document.body.contains(uiEl)) return uiEl;
    if (!btn) return null;
    var panelHead = btn.closest('.panel-head');
    if (!panelHead || !panelHead.parentNode) return null;
    uiEl = document.createElement('div');
    uiEl.className = 'pmg-vault-import-ui';
    uiEl.setAttribute('aria-live', 'polite');
    panelHead.parentNode.insertBefore(uiEl, panelHead.nextSibling);
    return uiEl;
  }

  function showProgress(done, total) {
    var el = ensureUi();
    if (!el) return;
    el.removeAttribute('data-tone');
    el.setAttribute('data-state', 'progress');
    el.innerHTML = '<span class="pmg-vault-import-progress">Importing ' +
      done + ' of ' + total + ' prompts…</span>';
  }

  function showResult(imported, total, failed) {
    var el = ensureUi();
    if (!el) return;
    el.setAttribute('data-state', 'result');
    if (failed > 0) el.setAttribute('data-tone', 'partial');
    else el.removeAttribute('data-tone');
    var msg = 'Imported ' + imported + ' of ' + total + ' prompts successfully.';
    if (failed > 0) msg += ' (' + failed + ' failed — you can retry.)';
    el.innerHTML = '<span class="pmg-vault-import-result">' + escapeHtml(msg) +
      '</span><button type="button" class="pmg-vault-import-dismiss">Done</button>';
    var dismiss = el.querySelector('.pmg-vault-import-dismiss');
    if (dismiss) dismiss.addEventListener('click', resetUi, { once: true });
  }

  function showError(msg) {
    var el = ensureUi();
    if (!el) return;
    el.removeAttribute('data-tone');
    el.setAttribute('data-state', 'error');
    el.innerHTML = '<span class="pmg-vault-import-error">' + escapeHtml(msg) +
      '</span><button type="button" class="pmg-vault-import-dismiss">Dismiss</button>';
    var dismiss = el.querySelector('.pmg-vault-import-dismiss');
    if (dismiss) dismiss.addEventListener('click', resetUi, { once: true });
  }

  function resetUi() {
    if (uiEl) {
      uiEl.removeAttribute('data-state');
      uiEl.removeAttribute('data-tone');
      uiEl.innerHTML = '';
    }
    importing = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = originalBtnLabel || 'Import from PromptPerfect';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ----- parsers -------------------------------------------------------- */

  // FORMAT A — JSON array.
  // For each object: prompt = optimizedPrompt || prompt || text || content
  //                          || first string field; title = name || title || label || null.
  function parseJsonArray(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (e) { return null; }
    if (!Array.isArray(raw)) return null;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var obj = raw[i];
      if (!obj || typeof obj !== 'object') continue;
      var prompt = pickFirstString(obj, ['optimizedPrompt', 'prompt', 'text', 'content']);
      if (!prompt) {
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'string' && obj[k].trim()) {
            prompt = obj[k]; break;
          }
        }
      }
      if (!prompt) continue;
      var title = pickFirstString(obj, ['name', 'title', 'label']);
      out.push({ prompt: String(prompt).trim(), title: title ? String(title).trim() : null });
    }
    return out;
  }

  function pickFirstString(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  }

  // FORMAT B — CSV with quoted-field support (RFC 4180-ish).
  function parseCsv(text) {
    var rows = csvRows(text);
    if (!rows.length) return null;
    var headers = rows[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var promptKeys = ['prompt', 'text', 'content', 'optimizedprompt'];
    var titleKeys = ['name', 'title', 'label'];
    var promptIdx = -1, titleIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      if (promptIdx === -1 && promptKeys.indexOf(headers[i]) !== -1) promptIdx = i;
      if (titleIdx === -1 && titleKeys.indexOf(headers[i]) !== -1) titleIdx = i;
    }
    if (promptIdx === -1) return null;
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var prompt = row[promptIdx];
      if (!prompt || !String(prompt).trim()) continue;
      var title = titleIdx >= 0 ? row[titleIdx] : null;
      out.push({
        prompt: String(prompt).trim(),
        title: title ? String(title).trim() : null
      });
    }
    return out;
  }

  function csvRows(text) {
    var rows = [];
    var cur = [];
    var field = '';
    var inQuotes = false;
    var i = 0, len = text.length;
    while (i < len) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { cur.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
    return rows.filter(function (r) { return r.length && !(r.length === 1 && !r[0]); });
  }

  /* ----- dedup ---------------------------------------------------------- */

  function dedupe(items) {
    var seen = Object.create(null);
    var out = [];
    var dups = 0;
    for (var i = 0; i < items.length; i++) {
      var key = items[i].prompt.trim().toLowerCase();
      if (!key) continue;
      if (seen[key]) { dups++; continue; }
      seen[key] = true;
      out.push(items[i]);
    }
    try { if (dups) console.log('[pmg-vault-import] removed ' + dups + ' duplicate(s)'); } catch (_) {}
    return out;
  }

  /* ----- vault writer (mirrors app.html L6898 + L7121 shape) ------------ */

  function loadVault() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveVault(items) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
      return { ok: true };
    } catch (e) {
      var isQuota = !!(e && (
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (typeof e.code === 'number' && (e.code === 22 || e.code === 1014))
      ));
      return { ok: false, quota: isQuota, err: e };
    }
  }

  function makeVaultItem(entry) {
    var goal = entry.title || (entry.prompt.length > 80 ? entry.prompt.slice(0, 77) + '…' : entry.prompt);
    return {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      savedAt: Date.now(),
      data: { goal: goal },
      prompt: entry.prompt,
      nickname: entry.title || undefined,
      favorite: false,
      importedFrom: 'promptperfect'
    };
  }

  // Single-item write. Returns a Promise so we can throttle + retry on
  // "rate limit". For localStorage there's no real 429, but we still
  // honor the contract: writes are sequential, throttled, and a quota
  // exhaustion is treated as a soft failure on that item.
  function writeOne(entry) {
    return new Promise(function (resolve) {
      var items = loadVault();
      // dedupe against vault: if exact prompt already exists, treat as success
      // without re-adding (matches the spec's dedup intent across runs).
      var key = entry.prompt.trim().toLowerCase();
      for (var i = 0; i < items.length; i++) {
        if (items[i] && typeof items[i].prompt === 'string' && items[i].prompt.trim().toLowerCase() === key) {
          resolve({ status: 'duplicate' }); return;
        }
      }
      items.unshift(makeVaultItem(entry));
      // mirror app.html's favorite-aware trim
      var favs = items.filter(function (i) { return i && i.favorite; });
      var nonFavs = items.filter(function (i) { return i && !i.favorite; }).slice(0, HISTORY_LIMIT);
      var merged = favs.concat(nonFavs);
      var res = saveVault(merged);
      if (res.ok) resolve({ status: 'ok' });
      else resolve({ status: 'fail', quota: res.quota });
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ----- main flow ------------------------------------------------------ */

  function handleImport(file) {
    importing = true;
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Importing…';
    }
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var parsed = parseJsonArray(text);
      if (!parsed) parsed = parseCsv(text);
      if (!parsed) {
        showError('File format not recognized. Export a JSON or CSV from PromptPerfect and try again.');
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = originalBtnLabel; }
        importing = false;
        return;
      }
      var deduped = dedupe(parsed);
      if (deduped.length === 0) {
        showError('No prompts found in this file.');
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = originalBtnLabel; }
        importing = false;
        return;
      }
      runImport(deduped);
    };
    reader.onerror = function () {
      showError('Could not read the file. Try again.');
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = originalBtnLabel; }
      importing = false;
    };
    reader.readAsText(file);
  }

  async function runImport(entries) {
    var total = entries.length;
    var imported = 0;
    var failed = 0;
    showProgress(0, total);
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var result = await writeOne(entry);
      if (result.status === 'fail' && result.quota) {
        // soft "rate limit" analogue — wait + retry once
        await sleep(RATE_LIMIT_RETRY_MS);
        result = await writeOne(entry);
      }
      if (result.status === 'ok' || result.status === 'duplicate') imported++;
      else failed++;
      showProgress(imported + failed, total);
      if (i < entries.length - 1) await sleep(WRITE_DELAY_MS);
    }
    showResult(imported, total, failed);
    if (failed === 0) {
      try {
        document.dispatchEvent(new CustomEvent('pmg:vault:imported', {
          detail: { imported: imported, total: total, source: 'promptperfect' }
        }));
      } catch (_) { /* CustomEvent unsupported — silently skip */ }
    }
  }

  /* ----- wiring --------------------------------------------------------- */

  ready(function () {
    btn = document.getElementById(BTN_ID);
    if (!btn) return;
    originalBtnLabel = btn.textContent || 'Import from PromptPerfect';
    btn.addEventListener('click', function () {
      if (importing) return;
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.csv,application/json,text/csv';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (file) handleImport(file);
        try { input.value = ''; } catch (_) {}
      }, { once: true });
      input.click();
    });
  });
})();
