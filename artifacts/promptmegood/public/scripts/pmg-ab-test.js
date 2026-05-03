/* =============================================================
 * pmg-ab-test.js  (Task #61)
 *
 * Three connected, additive features that turn PromptMeGood
 * into something that gradually learns what "good" looks like
 * for each user:
 *
 *   1. A/B Run    — branch the current prompt into a parallel
 *                   variant, send both to the user's preferred
 *                   AI tool, then mark which one won. The winner
 *                   replaces the prompt in #resultBox so the
 *                   next save captures it.
 *   2. Why this   — once at least 2 wins are recorded (any
 *      worked       combination of A/B winners + saves, with
 *                   favorites weighted higher), surface a
 *                   small inline callout below the actions
 *                   row that lists the 2-3 pills/factors and
 *                   the words the user actually added in
 *                   their A/B edits that distinguish wins
 *                   from misses (archived saves + A/B losers).
 *   3. Auto-tag   — when a new prompt lands in the saved
 *      on save     history, suggest tags based on prompt
 *                   content + active form pills. The user
 *                   confirms or edits before they're written
 *                   to the history item's `tags` field.
 *
 * STRICT additive rules (project hard-rule compliance):
 *   - No edits to existing IDs, classes, JS variables, or
 *     handlers.
 *   - No backend / API / DB changes — everything is
 *     local-only via localStorage.
 *   - All persistence keys are namespaced (pmg.ab.*).
 *   - All new DOM nodes carry pmg-ab-* class names that don't
 *     collide with anything in the existing stylesheets.
 *   - This entire module no-ops if the disable hatches are
 *     set: ?noabtest, localStorage.pmg_abtest_disable=1, or
 *     the global localStorage.pmg_disable=1.
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgAbTestLoaded) return;
  window.__pmgAbTestLoaded = true;

  /* Escape hatches first — same pattern as every other pmg-* module. */
  try {
    if (
      /[?&]noabtest\b/.test(location.search) ||
      localStorage.getItem('pmg_abtest_disable') === '1' ||
      localStorage.getItem('pmg_disable') === '1'
    ) {
      console.info('[pmg-ab-test] disabled via escape hatch');
      return;
    }
  } catch (_) {}

  try {

  /* ------------------------------------------------------------
   * Storage keys + small helpers
   * ------------------------------------------------------------ */
  var REC_KEY    = 'pmg.ab.records.v1';     /* A/B win records */
  var SEEN_KEY   = 'pmg.ab.seenSaves.v1';   /* IDs we've already auto-tagged for */
  var HIST_KEY   = 'promptmegood:history:v1';
  var PLACEHOLDER_PREFIX = 'Your fixed prompt will appear here';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { return false; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    /* Tiny fallback if the page hasn't installed showToast yet. */
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:#01696f;color:#fff;padding:10px 16px;border-radius:999px;' +
      'font:600 13px system-ui,sans-serif;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.2)';
    document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3500);
  }

  function getResultBox() { return document.getElementById('resultBox'); }
  function getPromptText() {
    var box = getResultBox();
    if (!box) return '';
    var t = (box.textContent || '').trim();
    if (!t) return '';
    if (t.indexOf(PLACEHOLDER_PREFIX) === 0) return '';
    return t;
  }
  function setPromptText(text) {
    if (window.__pmgText && typeof window.__pmgText.setPromptText === 'function') {
      try { window.__pmgText.setPromptText(text); return; } catch (_) {}
    }
    var box = getResultBox();
    if (box) box.textContent = text;
  }
  function getFormData() {
    if (window.__pmgText && typeof window.__pmgText.getFormData === 'function') {
      try { return window.__pmgText.getFormData() || {}; } catch (_) {}
    }
    return {};
  }

  /* ------------------------------------------------------------
   * Styles — additive, prefixed, theme-variable-aware
   * ------------------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById('pmg-ab-test-styles')) return;
    var css = [
      /* Branch button matches existing .btn rhythm. */
      '.pmg-ab-branch-btn{display:inline-flex;align-items:center;gap:6px}',
      '.pmg-ab-branch-btn[disabled]{opacity:.55;cursor:not-allowed}',

      /* Why-this-worked callout — sits below the actions row. */
      '.pmg-ab-why{margin:10px 0 0;padding:10px 14px;border-radius:12px;' +
        'background:color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-2,#f1efea));' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border,#d8d4cd));' +
        'font-size:13px;line-height:1.45;color:var(--color-text,#24211c);' +
        'display:flex;gap:10px;align-items:flex-start}',
      '.pmg-ab-why-icon{flex:0 0 auto;font-size:16px;line-height:1.2;margin-top:1px}',
      '.pmg-ab-why-body{flex:1 1 auto;min-width:0}',
      '.pmg-ab-why-title{font-weight:700;color:var(--color-primary,#01696f);margin-right:6px}',
      '.pmg-ab-why-chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}',
      '.pmg-ab-why-chip{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;' +
        'background:color-mix(in srgb, var(--color-primary) 14%, transparent);' +
        'color:var(--color-primary,#01696f);' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)}',
      '.pmg-ab-why-dismiss{flex:0 0 auto;background:transparent;border:0;color:var(--color-text-muted,#67655f);' +
        'font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:6px;' +
        'min-width:28px;min-height:28px}',
      '.pmg-ab-why-dismiss:hover{background:color-mix(in srgb, var(--color-text,#000) 8%, transparent);' +
        'color:var(--color-text,#24211c)}',

      /* A/B modal */
      '.pmg-ab-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);' +
        'z-index:250;display:flex;align-items:center;justify-content:center;padding:16px;' +
        'animation:pmgAbFade .2s ease}',
      '@keyframes pmgAbFade{from{opacity:0}to{opacity:1}}',
      '.pmg-ab-modal{background:var(--color-surface,#fbfbf9);border-radius:18px;' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border,#d8d4cd));' +
        'box-shadow:0 20px 60px rgba(0,0,0,.35);max-width:920px;width:100%;' +
        'max-height:92vh;overflow:auto;padding:22px;color:var(--color-text,#24211c)}',
      '.pmg-ab-modal-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}',
      '.pmg-ab-modal-head h3{margin:0;font-size:18px;font-weight:800}',
      '.pmg-ab-modal-head p{margin:4px 0 0;font-size:13px;color:var(--color-text-muted,#67655f)}',
      '.pmg-ab-modal-close{margin-left:auto;background:transparent;border:0;font-size:22px;line-height:1;' +
        'cursor:pointer;color:var(--color-text-muted,#67655f);padding:4px 8px;border-radius:8px}',
      '.pmg-ab-modal-close:hover{background:color-mix(in srgb, var(--color-text,#000) 8%, transparent)}',
      '.pmg-ab-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '@media (max-width:680px){.pmg-ab-cols{grid-template-columns:1fr}}',
      '.pmg-ab-col{display:flex;flex-direction:column;gap:8px;background:var(--color-surface-2,#f1efea);' +
        'border:1px solid var(--color-border,#d8d4cd);border-radius:12px;padding:12px}',
      '.pmg-ab-col-head{display:flex;align-items:center;gap:8px}',
      '.pmg-ab-col-tag{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;' +
        'padding:3px 9px;border-radius:999px;background:var(--color-primary,#01696f);color:#fff}',
      '.pmg-ab-col-tag.is-b{background:#7c3aed}',
      '.pmg-ab-col-title{font-weight:700;font-size:13px}',
      '.pmg-ab-col textarea{width:100%;min-height:180px;resize:vertical;border-radius:10px;' +
        'border:1px solid var(--color-border,#d8d4cd);background:var(--color-surface,#fbfbf9);' +
        'color:var(--color-text,#24211c);padding:10px;font:inherit;font-size:13px;line-height:1.5}',
      '.pmg-ab-col textarea[readonly]{background:color-mix(in srgb, var(--color-text,#000) 4%, var(--color-surface,#fff))}',
      '.pmg-ab-col textarea:focus{outline:2px solid var(--color-primary,#01696f);outline-offset:1px}',
      '.pmg-ab-col-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.pmg-ab-col-actions .pmg-ab-btn{flex:1 1 auto;min-width:0}',
      '.pmg-ab-modal-foot{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;' +
        'border-top:1px solid var(--color-divider,#dfdcd5);padding-top:12px}',
      '.pmg-ab-btn{min-height:40px;padding:0 14px;border-radius:999px;font-weight:700;font-size:13px;' +
        'border:1px solid var(--color-border,#d8d4cd);background:var(--color-surface,#fbfbf9);' +
        'color:var(--color-text,#24211c);cursor:pointer;transition:transform .15s ease, background .15s ease}',
      '.pmg-ab-btn:hover{transform:translateY(-1px)}',
      '.pmg-ab-btn.is-primary{background:var(--color-primary,#01696f);color:#fff;border-color:transparent}',
      '.pmg-ab-btn.is-win-a{background:#01696f;color:#fff;border-color:transparent}',
      '.pmg-ab-btn.is-win-b{background:#7c3aed;color:#fff;border-color:transparent}',
      '.pmg-ab-hint{font-size:12px;color:var(--color-text-muted,#67655f);margin:0 auto 0 0;align-self:center}',

      /* Auto-tag suggest bar — sits above #history-list */
      '.pmg-ab-tagbar{margin:0 0 var(--space-3,12px);padding:10px 12px;border-radius:12px;' +
        'background:color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-2,#f1efea));' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border,#d8d4cd));' +
        'display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;' +
        'animation:pmgAbBarIn .22s ease}',
      '@keyframes pmgAbBarIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion: reduce){.pmg-ab-tagbar,.pmg-ab-overlay{animation:none}}',
      '.pmg-ab-tagbar-label{font-weight:700;color:var(--color-primary,#01696f)}',
      '.pmg-ab-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 9px;' +
        'border-radius:999px;background:var(--color-surface,#fbfbf9);' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border,#d8d4cd));' +
        'font-size:12px;font-weight:600;color:var(--color-text,#24211c)}',
      '.pmg-ab-tag-x{background:transparent;border:0;color:var(--color-text-muted,#67655f);' +
        'cursor:pointer;font-size:14px;line-height:1;padding:0 6px;border-radius:999px;min-width:22px;min-height:22px}',
      '.pmg-ab-tag-x:hover{background:color-mix(in srgb, var(--color-text,#000) 10%, transparent);' +
        'color:var(--color-text,#24211c)}',
      '.pmg-ab-tag-add{flex:1 1 120px;min-width:80px;border:1px dashed var(--color-border,#d8d4cd);' +
        'background:transparent;color:var(--color-text,#24211c);padding:4px 10px;border-radius:999px;' +
        'font-size:12px;font-weight:600}',
      '.pmg-ab-tag-add:focus{outline:2px solid var(--color-primary,#01696f);outline-offset:1px}',
      '.pmg-ab-tagbar-actions{margin-left:auto;display:flex;gap:6px}',
      '.pmg-ab-tagbar-btn{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;' +
        'cursor:pointer;border:1px solid var(--color-border,#d8d4cd);background:var(--color-surface,#fbfbf9);' +
        'color:var(--color-text,#24211c)}',
      '.pmg-ab-tagbar-btn.is-primary{background:var(--color-primary,#01696f);color:#fff;border-color:transparent}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'pmg-ab-test-styles';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* =============================================================
   * FEATURE 1 — A/B Run flow
   * ============================================================= */

  /* The Send To last destination (Task #60) — re-used here so
     "Send Both" matches what the user already prefers. Falls back
     to ChatGPT when Send To never ran. */
  var SENDTO_KEY = 'pmg.sendto.last.v1';
  var SENDTO_DESTS = {
    chatgpt:    { label: 'ChatGPT',    url: 'https://chat.openai.com/?q=',           prefill: true  },
    claude:     { label: 'Claude',     url: 'https://claude.ai/new?q=',              prefill: true  },
    gemini:     { label: 'Gemini',     url: 'https://gemini.google.com/app',         prefill: false },
    perplexity: { label: 'Perplexity', url: 'https://www.perplexity.ai/search?q=',   prefill: true  }
  };
  function lastDest() {
    try {
      var v = localStorage.getItem(SENDTO_KEY);
      if (v && SENDTO_DESTS[v]) return v;
    } catch (_) {}
    return 'chatgpt';
  }
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
      }
    } catch (_) {}
    /* Legacy execCommand fallback so Gemini handoff still leaves
       something on the clipboard in older browsers. */
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return Promise.resolve(!!ok);
    } catch (_) { return Promise.resolve(false); }
  }

  function openInTool(text, destKey) {
    var dest = SENDTO_DESTS[destKey] || SENDTO_DESTS.chatgpt;
    var win = null;
    if (dest.prefill) {
      try { win = window.open(dest.url + encodeURIComponent(text), '_blank', 'noopener'); } catch (_) {}
      return win;
    }
    /* No-prefill destinations (Gemini): open the bare URL
       synchronously inside the user gesture so popup blockers
       leave it alone, then async-copy the prompt so the user
       can paste on the other side. Mirrors pmg-send-to.js. */
    try { win = window.open(dest.url, '_blank', 'noopener'); } catch (_) {}
    copyText(text).then(function (ok) {
      if (ok) toast('Copied — paste it into ' + dest.label + ' (Ctrl/Cmd+V).');
    });
    return win;
  }

  function ensureBranchButton() {
    var copyBtn = document.getElementById('copy-btn');
    if (!copyBtn || !copyBtn.parentNode) return;
    if (copyBtn.parentNode.querySelector('.pmg-ab-branch-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary pmg-ab-branch-btn';
    btn.id = 'pmg-ab-branch-btn';
    btn.title = 'Create a parallel variant and pick the winner';
    btn.innerHTML = '<span aria-hidden="true">⇆</span> Branch A/B';
    btn.addEventListener('click', function () {
      var src = getPromptText();
      if (!src) {
        toast('Generate a prompt first, then branch it into A/B.');
        return;
      }
      openAbModal(src);
    });
    /* Insert right after Copy Prompt; we don't replace anything. */
    copyBtn.parentNode.insertBefore(btn, copyBtn.nextSibling);
  }

  function openAbModal(initialText) {
    /* Single-instance overlay — replace any existing one. */
    var prior = document.getElementById('pmg-ab-overlay');
    if (prior) try { prior.remove(); } catch (_) {}

    var overlay = document.createElement('div');
    overlay.className = 'pmg-ab-overlay';
    overlay.id = 'pmg-ab-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pmg-ab-modal-title');

    var dest = lastDest();
    var destLabel = (SENDTO_DESTS[dest] || SENDTO_DESTS.chatgpt).label;

    overlay.innerHTML =
      '<div class="pmg-ab-modal">' +
        '<div class="pmg-ab-modal-head">' +
          '<div>' +
            '<h3 id="pmg-ab-modal-title">A/B Run</h3>' +
            '<p>Tweak Variant B, then send both to ' + escapeHtml(destLabel) + ' and pick the winner. The winner replaces your prompt so your next save captures it.</p>' +
          '</div>' +
          '<button type="button" class="pmg-ab-modal-close" aria-label="Close A/B Run">×</button>' +
        '</div>' +
        '<div class="pmg-ab-cols">' +
          '<div class="pmg-ab-col">' +
            '<div class="pmg-ab-col-head">' +
              '<span class="pmg-ab-col-tag">A</span>' +
              '<span class="pmg-ab-col-title">Original</span>' +
            '</div>' +
            '<textarea id="pmg-ab-text-a" readonly aria-label="Variant A (original prompt, read-only)"></textarea>' +
            '<div class="pmg-ab-col-actions">' +
              '<button type="button" class="pmg-ab-btn" data-pmg-ab-send="a">Send A</button>' +
            '</div>' +
          '</div>' +
          '<div class="pmg-ab-col">' +
            '<div class="pmg-ab-col-head">' +
              '<span class="pmg-ab-col-tag is-b">B</span>' +
              '<span class="pmg-ab-col-title">Your variant</span>' +
            '</div>' +
            '<textarea id="pmg-ab-text-b" aria-label="Variant B (edit your alternative here)"></textarea>' +
            '<div class="pmg-ab-col-actions">' +
              '<button type="button" class="pmg-ab-btn" data-pmg-ab-send="b">Send B</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pmg-ab-modal-foot">' +
          '<span class="pmg-ab-hint">Sending to: ' + escapeHtml(destLabel) + '</span>' +
          '<button type="button" class="pmg-ab-btn is-primary" id="pmg-ab-send-both">Send Both</button>' +
          '<button type="button" class="pmg-ab-btn is-win-a" id="pmg-ab-win-a">A Won</button>' +
          '<button type="button" class="pmg-ab-btn is-win-b" id="pmg-ab-win-b">B Won</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var taA = overlay.querySelector('#pmg-ab-text-a');
    var taB = overlay.querySelector('#pmg-ab-text-b');
    taA.value = initialText;
    taB.value = initialText;
    setTimeout(function () { try { taB.focus(); taB.setSelectionRange(taB.value.length, taB.value.length); } catch (_) {} }, 30);

    function close() { try { overlay.remove(); } catch (_) {} document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
      var sendBtn = e.target.closest && e.target.closest('[data-pmg-ab-send]');
      if (sendBtn) {
        var which = sendBtn.getAttribute('data-pmg-ab-send');
        openInTool((which === 'b' ? taB.value : taA.value).trim(), dest);
        return;
      }
      if (e.target.closest && e.target.closest('.pmg-ab-modal-close')) { close(); return; }
      if (e.target.id === 'pmg-ab-send-both') {
        /* Open both synchronously inside the user-gesture stack so
           popup blockers leave them alone. Detect blocked windows
           via the null/undefined return; some browsers will block
           the second open even with noopener, so we report exactly
           what happened instead of a blanket success toast. */
        var aWin = openInTool(taA.value.trim(), dest);
        var bWin = openInTool(taB.value.trim(), dest);
        var aOk = !!aWin, bOk = !!bWin;
        if (aOk && bOk) {
          toast('Opened both variants in ' + destLabel + '.');
        } else if (aOk || bOk) {
          toast('Opened ' + (aOk ? 'A' : 'B') + ' in ' + destLabel +
            ' — your browser blocked the second tab. Click "Send ' +
            (aOk ? 'B' : 'A') + '" to open it.');
        } else {
          toast('Your browser blocked both tabs. Use the Send A / Send B buttons individually.');
        }
        return;
      }
      if (e.target.id === 'pmg-ab-win-a' || e.target.id === 'pmg-ab-win-b') {
        var winner = e.target.id === 'pmg-ab-win-a' ? 'a' : 'b';
        var aText = taA.value.trim();
        var bText = taB.value.trim();
        var winText = winner === 'a' ? aText : bText;
        var losText = winner === 'a' ? bText : aText;
        recordWin({
          winnerText: winText,
          loserText:  losText,
          form: getFormData(),
          /* Persist the explicit A→B (or B→A) word diff so the
             "Why this worked" callout can highlight the actual
             edits the user picked, not just frequency lift across
             pools. The diff is symmetric here because A and B
             share form data — pill deltas would always be empty. */
          diff: diffWords(winText, losText)
        });
        /* Replace the prompt in #resultBox with the winner so the
           next Save / Send To uses the winning copy. */
        setPromptText(winner === 'a' ? aText : bText);
        close();
        renderWhyCallout();
        toast('Variant ' + winner.toUpperCase() + ' saved as the winner. Your prompt was updated.');
      }
    });
  }

  function recordWin(record) {
    var list = readJSON(REC_KEY, []);
    if (!Array.isArray(list)) list = [];
    list.unshift({
      ts: Date.now(),
      winner: String(record.winnerText || '').slice(0, 4000),
      loser:  String(record.loserText  || '').slice(0, 4000),
      form:   record.form || {},
      /* Persisted edit delta — see Branch click handler. */
      diff:   record.diff  || { added: [], removed: [] }
    });
    /* Cap at 50 records to keep storage bounded. */
    writeJSON(REC_KEY, list.slice(0, 50));
  }

  /* Word-level diff between winner and loser text. Tokens are
     normalized via the existing tokenize() (4+ chars, no stops)
     so we surface meaningful edits, not punctuation noise. The
     differentiator scorer uses these to add a per-record bonus
     beyond the pool-frequency lift. */
  function diffWords(winText, losText) {
    var w = {}, l = {};
    tokenize(winText).forEach(function (t) { w[t] = 1; });
    tokenize(losText).forEach(function (t) { l[t] = 1; });
    var added = [], removed = [];
    Object.keys(w).forEach(function (t) { if (!l[t]) added.push(t); });
    Object.keys(l).forEach(function (t) { if (!w[t]) removed.push(t); });
    return { added: added.slice(0, 25), removed: removed.slice(0, 25) };
  }

  /* =============================================================
   * FEATURE 2 — "Why this worked" callout
   * ============================================================= */

  /* Small stop-word list so the differentiator isn't dominated
     by filler words. Kept tiny on purpose — the goal is to
     surface the user's own wording, not to do real NLP. */
  var STOP = (
    'a,an,and,as,at,be,but,by,for,from,have,if,in,into,is,it,its,of,on,or,' +
    'so,that,the,their,them,then,there,these,they,this,to,was,were,will,' +
    'with,you,your,we,our,us,i,me,my,can,do,does,not,no,yes,please,about'
  ).split(',').reduce(function (m, w) { m[w] = 1; return m; }, {});

  function tokenize(text) {
    return String(text || '').toLowerCase()
      .replace(/[^a-z0-9\s\-']/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w && w.length >= 4 && !STOP[w]; });
  }

  function pillsFromForm(form) {
    var p = [];
    if (!form) return p;
    if (form.tone)         p.push('tone:' + form.tone);
    if (form.outputFormat) p.push('format:' + form.outputFormat);
    if (form.skillLevel)   p.push('level:' + form.skillLevel);
    if (form.personality && form.personality !== 'none') p.push('voice:' + form.personality);
    if (form.outputLanguage && form.outputLanguage !== 'english') p.push('lang:' + form.outputLanguage);
    if (form.moneyMode)    p.push('money-mode');
    if (form.humanTone)    p.push('human-tone');
    if (form.clarityBoost) p.push('clarity-boost');
    if (form.maxLength)    p.push('len:<=' + form.maxLength);
    return p;
  }

  /* Pull the "winners" pool: every explicit positive signal —
     A/B winners AND every saved (non-archived) history item,
     because the spec treats Save itself as a "this was good"
     marker. Favorited saves are pushed twice to weight them
     higher than a plain save. "Losers" pool: A/B losers and
     archived saves only — never plain non-favorited saves. */
  function buildPools() {
    var recs = readJSON(REC_KEY, []);
    var hist = readJSON(HIST_KEY, []);
    if (!Array.isArray(recs)) recs = [];
    if (!Array.isArray(hist)) hist = [];

    var winners = [], losers = [];
    recs.forEach(function (r) {
      winners.push({ text: r.winner || '', form: r.form || {} });
      if (r.loser) losers.push({ text: r.loser, form: r.form || {} });
    });
    hist.forEach(function (h) {
      var entry = { text: h.prompt || '', form: h.data || {} };
      if (h.archived) { losers.push(entry); return; }
      winners.push(entry);
      /* Favorites count twice — a stronger positive signal than
         a plain save. */
      if (h.favorite) winners.push(entry);
    });
    return { winners: winners, losers: losers };
  }

  function freqMap(pool, extractor) {
    var m = {};
    pool.forEach(function (item) {
      var seen = {};
      extractor(item).forEach(function (tok) {
        if (seen[tok]) return;
        seen[tok] = 1;
        m[tok] = (m[tok] || 0) + 1;
      });
    });
    return m;
  }

  function differentiators(winners, losers) {
    if (!winners.length) return [];
    var wTok = freqMap(winners, function (i) { return tokenize(i.text); });
    var lTok = freqMap(losers,  function (i) { return tokenize(i.text); });
    var wPil = freqMap(winners, function (i) { return pillsFromForm(i.form); });
    var lPil = freqMap(losers,  function (i) { return pillsFromForm(i.form); });

    /* Per-record edit-diff bonus: tokens the user actually
       *added* to a winning A/B variant carry stronger evidence
       than mere frequency. We tally how many distinct A/B
       records added each token, normalized by total records,
       and fold that into the lift score. */
    var recs = readJSON(REC_KEY, []);
    var addedCount = {};
    var recCount = 0;
    if (Array.isArray(recs)) {
      recs.forEach(function (r) {
        if (!r || !r.diff || !Array.isArray(r.diff.added)) return;
        recCount++;
        var seen = {};
        r.diff.added.forEach(function (t) {
          if (seen[t]) return;
          seen[t] = 1;
          addedCount[t] = (addedCount[t] || 0) + 1;
        });
      });
    }
    var R = Math.max(recCount, 1);

    var W = winners.length, L = Math.max(losers.length, 1);
    function score(tok, wMap, lMap, isWord) {
      var wRate = (wMap[tok] || 0) / W;
      var lRate = (lMap[tok] || 0) / L;
      /* Require >=2 wins to mention a token, and a clear lift. */
      if ((wMap[tok] || 0) < 2) return 0;
      var lift = wRate - lRate;
      if (isWord) lift += 0.5 * ((addedCount[tok] || 0) / R);
      return lift;
    }

    var pillCands = Object.keys(wPil).map(function (k) {
      return { kind: 'pill', label: humanizePill(k), key: k, lift: score(k, wPil, lPil, false) };
    });
    var wordCands = Object.keys(wTok).map(function (k) {
      return { kind: 'word', label: '"' + k + '"', key: k, lift: score(k, wTok, lTok, true) };
    });
    return pillCands.concat(wordCands)
      .filter(function (c) { return c.lift > 0.05; })
      .sort(function (a, b) { return b.lift - a.lift; })
      .slice(0, 3);
  }

  function humanizePill(p) {
    if (p.indexOf('tone:') === 0)   return p.slice(5).replace(/-/g, ' ') + ' tone';
    if (p.indexOf('format:') === 0) return p.slice(7).replace(/-/g, ' ') + ' format';
    if (p.indexOf('level:') === 0)  return p.slice(6) + ' level';
    if (p.indexOf('voice:') === 0)  return p.slice(6) + ' voice';
    if (p.indexOf('lang:') === 0)   return p.slice(5) + ' output';
    if (p.indexOf('len:') === 0)    return 'length ' + p.slice(4);
    return p.replace(/-/g, ' ');
  }

  function getPostGenerateActionsRow() {
    /* The page has THREE .actions-row instances (builder, image
       generator, and the post-generate result row). The one we
       care about is the row that contains #copy-btn — anchor to
       it via .closest so we never land in the wrong context. */
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      var row = copyBtn.closest('.actions-row');
      if (row) return row;
    }
    return null;
  }

  function renderWhyCallout() {
    var actions = getPostGenerateActionsRow();
    if (!actions || !actions.parentNode) return;
    var existing = document.getElementById('pmg-ab-why');

    /* Respect a per-session dismiss so we don't nag. */
    if (sessionStorage.getItem('pmg.ab.why.dismissed') === '1') {
      if (existing) existing.remove();
      return;
    }

    var pools = buildPools();
    var hasSignal = pools.winners.length >= 2;
    if (!hasSignal) { if (existing) existing.remove(); return; }
    var diffs = differentiators(pools.winners, pools.losers);
    if (!diffs.length) { if (existing) existing.remove(); return; }

    var html =
      '<div class="pmg-ab-why-icon" aria-hidden="true">💡</div>' +
      '<div class="pmg-ab-why-body">' +
        '<span class="pmg-ab-why-title">Why your wins worked</span>' +
        '<span>Across your last ' + pools.winners.length + ' wins, these stood out vs. your other tries:</span>' +
        '<div class="pmg-ab-why-chips">' +
          diffs.map(function (d) {
            return '<span class="pmg-ab-why-chip">' + escapeHtml(d.label) + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button type="button" class="pmg-ab-why-dismiss" aria-label="Hide this hint for the rest of the session">×</button>';

    if (existing) {
      existing.innerHTML = html;
    } else {
      var box = document.createElement('div');
      box.className = 'pmg-ab-why';
      box.id = 'pmg-ab-why';
      box.setAttribute('role', 'note');
      box.innerHTML = html;
      box.addEventListener('click', function (e) {
        if (e.target.classList && e.target.classList.contains('pmg-ab-why-dismiss')) {
          try { sessionStorage.setItem('pmg.ab.why.dismissed', '1'); } catch (_) {}
          try { box.remove(); } catch (_) {}
        }
      });
      actions.parentNode.insertBefore(box, actions.nextSibling);
    }
  }

  /* =============================================================
   * FEATURE 3 — Auto-tag on save
   *
   * Watches #history-list for newly rendered items. When an ID
   * we haven't seen before appears, we generate suggested tags
   * from the prompt content + form pills, then show a small
   * confirm bar above the list. On Confirm, we patch the item
   * in localStorage and update the .history-item DOM in-place
   * (no call into the closure-scoped renderHistory needed).
   *
   * "Seen" IDs persist in localStorage so the bar doesn't
   * re-appear on every page reload for old items.
   * ============================================================= */

  /* Topic vocabulary — kept small, biased toward the prompt-builder
     domain. Each entry maps a regex to a tag. First-match wins per
     tag (a tag is added at most once per item). */
  var TAG_RULES = [
    [/\b(email|inbox|reply|outreach|cold message|newsletter)\b/i, 'email'],
    [/\b(blog|article|long.?form|essay|post)\b/i,                 'blog'],
    [/\b(tweet|twitter|x post|thread|linkedin|instagram|tiktok|reel|caption|hashtag)\b/i, 'social'],
    [/\b(seo|keyword|meta description|search engine|rank|google)\b/i, 'seo'],
    [/\b(ad|advert|copy ?writing|landing page|headline|cta)\b/i,  'marketing'],
    [/\b(code|function|class|javascript|typescript|python|sql|api|bug|debug|regex|stack trace)\b/i, 'code'],
    [/\b(resume|cv|cover letter|interview|job application)\b/i,   'career'],
    [/\b(brainstorm|idea|ideas|outline|list of)\b/i,              'brainstorm'],
    [/\b(summari[sz]e|tl;?dr|recap|summary)\b/i,                  'summary'],
    [/\b(translate|translation|in (spanish|french|german|japanese|chinese|portuguese))\b/i, 'translate'],
    [/\b(image|photo|illustration|render|dall.?e|midjourney|stable diffusion)\b/i, 'image'],
    [/\b(research|sources?|cite|citation|study|studies)\b/i,      'research'],
    [/\b(lesson plan|teach|explain like|tutorial|study guide|flashcard|quiz)\b/i, 'learning'],
    [/\b(money|revenue|pricing|invoice|business plan|sales|profit|budget)\b/i,    'business'],
    [/\b(story|narrative|character|plot|fiction|novel|screenplay|dialogue)\b/i,   'creative-writing']
  ];

  function suggestTags(item) {
    var text = ((item && item.prompt) || '') + ' ' + ((item && item.data && item.data.goal) || '') +
      ' ' + ((item && item.data && item.data.details) || '');
    var out = [];
    var seen = {};
    /* Content-based matches first. */
    TAG_RULES.forEach(function (rule) {
      if (out.length >= 3) return;
      if (rule[0].test(text)) {
        if (!seen[rule[1]]) { seen[rule[1]] = 1; out.push(rule[1]); }
      }
    });
    /* Form-pill fallbacks. */
    var d = (item && item.data) || {};
    if (out.length < 3 && d.moneyMode      && !seen['money-mode'])   { out.push('money-mode'); seen['money-mode'] = 1; }
    if (out.length < 3 && d.humanTone      && !seen['human-tone'])   { out.push('human-tone'); seen['human-tone'] = 1; }
    if (out.length < 3 && d.tone && d.tone !== 'bold-direct' && !seen[d.tone]) { out.push(d.tone); seen[d.tone] = 1; }
    return out;
  }

  function loadSeen() {
    var v = readJSON(SEEN_KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function markSeen(id) {
    var seen = loadSeen();
    if (seen.indexOf(id) !== -1) return;
    seen.unshift(id);
    /* Cap so the array doesn't grow without bound. Matches the
       25-item history cap with headroom for favorites. */
    writeJSON(SEEN_KEY, seen.slice(0, 80));
  }

  function findHistoryItemEl(id) {
    var list = document.getElementById('history-list');
    if (!list) return null;
    return list.querySelector('.history-item[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }

  function patchHistoryItem(id, mutator) {
    var hist = readJSON(HIST_KEY, []);
    if (!Array.isArray(hist)) return false;
    var idx = -1;
    for (var i = 0; i < hist.length; i++) { if (hist[i] && hist[i].id === id) { idx = i; break; } }
    if (idx === -1) return false;
    hist[idx] = mutator(hist[idx]) || hist[idx];
    return writeJSON(HIST_KEY, hist);
  }

  function paintTagsOnItemEl(itemEl, tags) {
    if (!itemEl) return;
    var head = itemEl.querySelector('.history-item-head');
    var existing = itemEl.querySelector('.history-item-tags');
    if (!tags || !tags.length) {
      if (existing) existing.remove();
      return;
    }
    var html = tags.map(function (t) {
      return '<button type="button" class="history-item-tag" data-history-action="filter-tag" data-tag-value="' +
        escapeHtml(t) + '" aria-label="Filter by tag ' + escapeHtml(t) + '">#' + escapeHtml(t) + '</button>';
    }).join('');
    if (existing) {
      existing.innerHTML = html;
    } else {
      var div = document.createElement('div');
      div.className = 'history-item-tags';
      div.innerHTML = html;
      if (head && head.nextSibling) head.parentNode.insertBefore(div, head.nextSibling);
      else if (head) head.parentNode.appendChild(div);
    }
  }

  function showTagBar(item) {
    var list = document.getElementById('history-list');
    if (!list || !list.parentNode) return;

    /* Only one bar at a time. */
    var prior = document.getElementById('pmg-ab-tagbar');
    if (prior) prior.remove();

    var initial = suggestTags(item);
    /* Don't pester if there's nothing to suggest. */
    if (!initial.length) { markSeen(item.id); return; }

    var bar = document.createElement('div');
    bar.className = 'pmg-ab-tagbar';
    bar.id = 'pmg-ab-tagbar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Auto-suggested tags for your latest save');
    bar.dataset.id = item.id;
    bar.innerHTML =
      '<span class="pmg-ab-tagbar-label" aria-hidden="true">🏷️ Auto-tagged:</span>' +
      '<span class="pmg-ab-tagbar-tags"></span>' +
      '<input type="text" class="pmg-ab-tag-add" placeholder="+ Add Tag" aria-label="Add another tag (press Enter)" maxlength="24" />' +
      '<span class="pmg-ab-tagbar-actions">' +
        '<button type="button" class="pmg-ab-tagbar-btn" data-pmg-ab-tagbar="skip">Skip</button>' +
        '<button type="button" class="pmg-ab-tagbar-btn is-primary" data-pmg-ab-tagbar="confirm">Confirm</button>' +
      '</span>';

    var tagsEl = bar.querySelector('.pmg-ab-tagbar-tags');
    var current = initial.slice();

    function rerender() {
      tagsEl.innerHTML = current.map(function (t) {
        return '<span class="pmg-ab-tag">#' + escapeHtml(t) +
          '<button type="button" class="pmg-ab-tag-x" data-pmg-ab-remove="' + escapeHtml(t) +
          '" aria-label="Remove tag ' + escapeHtml(t) + '">×</button></span>';
      }).join('');
    }
    rerender();

    bar.addEventListener('click', function (e) {
      var rm = e.target.closest && e.target.closest('[data-pmg-ab-remove]');
      if (rm) {
        var v = rm.getAttribute('data-pmg-ab-remove');
        current = current.filter(function (t) { return t !== v; });
        rerender();
        return;
      }
      var act = e.target.closest && e.target.closest('[data-pmg-ab-tagbar]');
      if (!act) return;
      var which = act.getAttribute('data-pmg-ab-tagbar');
      if (which === 'skip') {
        markSeen(item.id);
        bar.remove();
        return;
      }
      if (which === 'confirm') {
        if (current.length) {
          patchHistoryItem(item.id, function (it) {
            var existing = Array.isArray(it.tags) ? it.tags.slice() : [];
            current.forEach(function (t) { if (existing.indexOf(t) === -1) existing.push(t); });
            it.tags = existing.slice(0, 8);
            return it;
          });
          paintTagsOnItemEl(findHistoryItemEl(item.id), current.slice(0, 8));
          toast('Tagged as ' + current.map(function (t) { return '#' + t; }).join(' '));
        }
        markSeen(item.id);
        bar.remove();
      }
    });

    var addInput = bar.querySelector('.pmg-ab-tag-add');
    addInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      var raw = addInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      if (raw && current.indexOf(raw) === -1 && current.length < 8) {
        current.push(raw);
        rerender();
      }
      addInput.value = '';
    });

    list.parentNode.insertBefore(bar, list);
  }

  /* MutationObserver: when #history-list re-renders (the inline
     code wipes innerHTML and re-creates .history-item nodes on
     every save / favorite / tag edit), pick the newest-by-savedAt
     unseen item from localStorage. Doing the lookup against
     storage (not the DOM) is robust against the default
     "favorites-first" sort, which can push a fresh non-favorite
     save below pinned favorites. We then verify the chosen item
     is currently rendered before showing the bar so we never
     point the user at an item they can't see. */
  function watchHistory() {
    var list = document.getElementById('history-list');
    if (!list) return;

    function tick() {
      var hist = readJSON(HIST_KEY, []);
      if (!Array.isArray(hist) || !hist.length) return;
      var seen = loadSeen();
      /* Newest unseen by savedAt; falls back to insertion order
         when savedAt is missing on legacy items. */
      var sorted = hist.slice().sort(function (a, b) {
        return (b && b.savedAt || 0) - (a && a.savedAt || 0);
      });
      var picked = null;
      for (var i = 0; i < sorted.length; i++) {
        var it = sorted[i];
        if (!it || !it.id) continue;
        if (seen.indexOf(it.id) !== -1) continue;
        /* Already-tagged saves (restored from import, edited
           manually) shouldn't trigger the bar. */
        if (Array.isArray(it.tags) && it.tags.length) {
          markSeen(it.id);
          continue;
        }
        picked = it;
        break;
      }
      if (!picked) return;
      /* Don't show a bar for an item that isn't currently visible
         (e.g. filtered out by tag/search). The tag-bar dataset.id
         lets us avoid re-showing the same bar repeatedly. */
      if (!findHistoryItemEl(picked.id)) return;
      var existingBar = document.getElementById('pmg-ab-tagbar');
      if (existingBar && existingBar.dataset.id === picked.id) return;
      showTagBar(picked);
    }

    var mo = new MutationObserver(function () {
      try { tick(); } catch (_) {}
      try { renderWhyCallout(); } catch (_) {}
    });
    mo.observe(list, { childList: true, subtree: false });
    /* Initial pass after the first render. */
    setTimeout(tick, 400);
  }

  /* =============================================================
   * Boot
   * ============================================================= */
  function boot() {
    injectStyles();
    ensureBranchButton();
    watchHistory();
    renderWhyCallout();

    /* The actions row is part of the always-rendered builder, but
       some sibling pmg-* scripts mutate it later. Re-check the
       branch button on a short interval until it sticks. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      ensureBranchButton();
      if (tries > 20) clearInterval(iv);
    }, 250);

    /* If #resultBox text changes (new generation, edit, undo),
       refresh the callout — the new prompt may already match a
       known winning pattern, or wipe a stale state. */
    var box = getResultBox();
    if (box) {
      var rmo = new MutationObserver(function () {
        try { renderWhyCallout(); } catch (_) {}
      });
      rmo.observe(box, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  } catch (e) {
    /* Never break the host page on any unexpected runtime error. */
    try { console.warn('[pmg-ab-test] disabled after error:', e); } catch (_) {}
  }
})();
