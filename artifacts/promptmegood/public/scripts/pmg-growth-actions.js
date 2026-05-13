/* pmg-growth-actions.js (ga-1)
 *
 * When a result lands in #resultBox AND it was dispatched from Growth
 * Mode (window.__pmgLastSource === 'growth'), mount a small action row
 * above the result with two buttons:
 *
 *   📋 Copy All Sections   — copy resultBox text to clipboard
 *   📄 Export as PDF       — lazy-load html2pdf.js + download .pdf
 *
 * Strict additive. Existing Copy / Send-to / Save buttons untouched.
 *
 * Disable hatches:
 *   ?nogrowthactions                       query param
 *   localStorage.pmg_growthactions_disable = '1'
 *   localStorage.pmg_disable               = '1'
 */
(function () {
  'use strict';
  if (window.__pmgGrowthActionsLoaded) return;
  window.__pmgGrowthActionsLoaded = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nogrowthactions\b/.test(qs)) return;
    if (localStorage.getItem('pmg_growthactions_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var ROW_ID            = 'pmg-growth-actions-row';
  var STATUS_ID         = 'pmg-growth-actions-status';
  /* Long enough to survive slow generations + retries on flaky networks.
     Architect-flagged: with consume-once semantics below, a longer window
     is safe — the flag is cleared on first reconcile that sees real
     result text, so it can't leak into a later non-Growth submission. */
  var GROWTH_FRESH_MS   = 10 * 60 * 1000;
  var H2PDF_CDN         = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
  var H2PDF_SRI         = 'sha512-MpDFIChbcXl2QgipQrt1VcPHMldRILetapBl5MPCA9Y8r7qvlwx1/Mc9hNTzY+kS5kX6PdoDq41ws1HiVNLdZA==';

  var loadingPdfLib = null;

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (loadingPdfLib) return loadingPdfLib;
    loadingPdfLib = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = H2PDF_CDN;
      s.integrity = H2PDF_SRI;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = function () {
        if (window.html2pdf) resolve(window.html2pdf);
        else { loadingPdfLib = null; reject(new Error('html2pdf failed to expose global')); }
      };
      s.onerror = function () {
        /* Reset so the user can retry — otherwise a single network blip
           leaves Export PDF permanently broken until reload. */
        loadingPdfLib = null;
        reject(new Error('Failed to load html2pdf from CDN'));
      };
      document.head.appendChild(s);
    });
    return loadingPdfLib;
  }

  function isGrowthFresh() {
    var t = window.__pmgLastSource === 'growth' ? (window.__pmgLastSourceAt || 0) : 0;
    return t && (Date.now() - t) < GROWTH_FRESH_MS;
  }

  function track(name, props) {
    try { if (window.__pmgTrack) window.__pmgTrack(name, props || {}); } catch (_) {}
  }

  function getResultText() {
    var box = document.getElementById('resultBox');
    return box ? (box.textContent || '').trim() : '';
  }

  function buildRow() {
    var row = document.createElement('div');
    row.id = ROW_ID;
    row.className = 'pmg-ga-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Growth Mode result actions');

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'pmg-ga-btn';
    copyBtn.innerHTML = '<span aria-hidden="true">📋</span> Copy All Sections';

    var pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'pmg-ga-btn';
    pdfBtn.innerHTML = '<span aria-hidden="true">📄</span> Export as PDF';

    var status = document.createElement('span');
    status.id = STATUS_ID;
    status.className = 'pmg-ga-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    copyBtn.addEventListener('click', function () { onCopyAll(status); });
    pdfBtn.addEventListener('click', function () { onExportPdf(pdfBtn, status); });

    row.appendChild(copyBtn);
    row.appendChild(pdfBtn);
    row.appendChild(status);
    return row;
  }

  function onCopyAll(status) {
    var text = getResultText();
    if (!text || text === 'Your fixed prompt will appear here.') {
      status.textContent = 'Nothing to copy yet.';
      return;
    }
    status.textContent = 'Copying…';
    try {
      var p = navigator.clipboard && navigator.clipboard.writeText(text);
      if (p && p.then) {
        p.then(function () {
          status.textContent = '✓ Copied all sections to clipboard.';
          track('growth_copy_all', { chars: text.length });
        }).catch(function () {
          status.textContent = 'Could not copy automatically — select the result and copy manually.';
        });
      } else {
        status.textContent = 'Could not copy — clipboard unavailable.';
      }
    } catch (e) {
      status.textContent = 'Could not copy: ' + (e && e.message ? e.message : 'unknown');
    }
  }

  function onExportPdf(btn, status) {
    var text = getResultText();
    if (!text || text === 'Your fixed prompt will appear here.') {
      status.textContent = 'Nothing to export yet.';
      return;
    }
    btn.disabled = true;
    var origLabel = btn.innerHTML;
    btn.innerHTML = '<span aria-hidden="true">⏳</span> Preparing PDF…';
    status.textContent = '';
    loadHtml2Pdf().then(function (h2p) {
      var stamp = new Date().toISOString().slice(0, 10);
      var filename = 'PromptMeGood-Growth-' + stamp + '.pdf';

      /* Build a clean off-screen node so the PDF doesn't inherit the dark
         theme or the contenteditable affordances. PDF-friendly: white bg,
         black text, generous margins, monospace for clarity. */
      var node = document.createElement('div');
      node.style.cssText = 'padding:24px 28px;background:#fff;color:#0f172a;font-family:Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.55;max-width:760px;';
      var header = document.createElement('div');
      header.style.cssText = 'border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:16px;';
      header.innerHTML = '<div style="font-weight:700;font-size:14pt;color:#0f766e;">PromptMeGood — Growth Mode Output</div>' +
                        '<div style="font-size:10pt;color:#475569;margin-top:2px;">Generated ' + new Date().toLocaleString() + '</div>';
      var body = document.createElement('pre');
      body.style.cssText = 'white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:inherit;line-height:inherit;margin:0;';
      body.textContent = text;
      node.appendChild(header);
      node.appendChild(body);

      return h2p().set({
        margin:       [12, 12, 16, 12],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(node).save().then(function () {
        status.textContent = '✓ PDF downloaded.';
        track('growth_export_pdf', { chars: text.length });
      });
    }).catch(function (err) {
      status.textContent = 'Could not export PDF: ' + (err && err.message ? err.message : 'unknown error');
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = origLabel;
    });
  }

  function ensureRow() {
    var box = document.getElementById('resultBox');
    if (!box) return;
    if (document.getElementById(ROW_ID)) return;
    var row = buildRow();
    /* Insert directly before #resultBox so it sits as a header row above
       the editable result. */
    box.parentNode.insertBefore(row, box);
  }

  function removeRow() {
    var row = document.getElementById(ROW_ID);
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  function reconcile() {
    var box = document.getElementById('resultBox');
    if (!box) return;
    var text = (box.textContent || '').trim();
    var isPlaceholder = text === 'Your fixed prompt will appear here.';
    var hasReal = text && !isPlaceholder;

    /* Consume-once attribution (architect-flagged): when real content
       arrives, decide row visibility based on the flag AT THIS MOMENT,
       then clear the flag. This way a Growth dispatch can't leak into
       a later non-Growth submission. */
    if (hasReal) {
      if (isGrowthFresh()) {
        ensureRow();
        try {
          window.__pmgLastSource = null;
          window.__pmgLastSourceAt = 0;
        } catch (_) {}
      }
      /* If a non-Growth result lands while a row is still mounted from
         a previous Growth result, drop it — it would copy/export the
         wrong content. */
      else if (document.getElementById(ROW_ID)) {
        removeRow();
      }
      return;
    }

    /* Only remove the row when text resets to the literal placeholder
       (e.g. Reset button, fresh load). Don't auto-remove on transient
       empty states from user edits inside the contenteditable result. */
    if (isPlaceholder) removeRow();
  }

  function start() {
    var box = document.getElementById('resultBox');
    if (!box) {
      /* Poll for resultBox to exist (chassis-v3 reparents legacy DOM). */
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (document.getElementById('resultBox') || tries > 60) {
          clearInterval(iv);
          if (document.getElementById('resultBox')) start();
        }
      }, 200);
      return;
    }
    /* Watch for content changes on resultBox (text replaced by generate
       flow or cleared on tab switch / refresh). */
    try {
      var mo = new MutationObserver(function () { reconcile(); });
      mo.observe(box, { childList: true, characterData: true, subtree: true });
    } catch (_) {}
    /* Initial check in case Growth Mode dispatched + result arrived
       before this script booted. */
    reconcile();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
