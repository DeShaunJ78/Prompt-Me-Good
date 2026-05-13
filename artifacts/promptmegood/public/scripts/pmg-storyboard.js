/* ============================================================================
   PromptMeGood — Storyboard Studio (sb-2)
   Text concept → /api/storyboard returns 5 prompts → 5 parallel /api/image
   calls → render thumbnails → optional handoff to Visual Studio video tab.
   sb-2 adds: per-frame 🔄 Regenerate button + 🖨 Export PDF (print-to-PDF
   2-up portrait, zero deps).
   ============================================================================ */
(function () {
  'use strict';

  var MODAL_ID = 'pmg-storyboard-modal';
  var TRIGGER_ID = 'pmg-generate-storyboard-btn';
  var IMAGE_PARALLEL = 5;

  function $(id) { return document.getElementById(id); }
  function modal() { return $(MODAL_ID); }

  function buildModal() {
    if (modal()) return;
    var html =
      '<div id="' + MODAL_ID + '" class="pmg-modal-overlay" data-pmg-overlay-root="1" hidden role="dialog" aria-modal="true" aria-labelledby="pmg-sb-title">' +
        '<div class="pmg-modal-content">' +
          '<div class="pmg-modal-header">' +
            '<h2 id="pmg-sb-title">🎞️ Storyboard Studio</h2>' +
            '<button type="button" id="pmg-close-storyboard" aria-label="Close Storyboard">✕</button>' +
          '</div>' +
          '<div class="pmg-modal-body">' +
            '<div id="pmg-sb-content"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    var w = document.createElement('div');
    w.innerHTML = html;
    document.body.appendChild(w.firstChild);
  }

  var _previouslyFocused = null;
  var _currentPanels = [];
  var _currentConcept = '';
  // Session token — incremented every open / close. Any in-flight fetch or
  // image generation that doesn't match the live token must NOT mutate UI
  // or consume further API calls. Also drives an AbortController for the
  // text fetch.
  var _sessionId = 0;
  var _abortCtrl = null;

  function openStoryboard(concept) {
    buildModal();
    var m = modal(); if (!m) return;
    if (!m.hasAttribute('hidden')) return;
    // New session — invalidate any prior in-flight work.
    _sessionId++;
    if (_abortCtrl) { try { _abortCtrl.abort(); } catch (_) {} }
    _abortCtrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    m.removeAttribute('hidden');
    document.documentElement.dataset.sbOpen = '1';
    document.body.style.overflow = 'hidden';
    _previouslyFocused = document.activeElement;
    _currentConcept = (concept || '').trim();
    _currentPanels = [];
    if (!_currentConcept) {
      renderError("Please type a concept first, then tap Generate Storyboard.");
      return;
    }
    renderLoading();
    fetchPanels(_currentConcept, _sessionId);
  }

  function closeStoryboard() {
    var m = modal(); if (!m || m.hasAttribute('hidden')) return;
    m.setAttribute('hidden', '');
    document.documentElement.removeAttribute('data-sb-open');
    document.body.style.overflow = '';
    // Invalidate any in-flight requests so they neither mutate UI nor
    // consume more /api/image budget after the user dismisses the modal.
    _sessionId++;
    if (_abortCtrl) { try { _abortCtrl.abort(); } catch (_) {} _abortCtrl = null; }
    if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
      try { _previouslyFocused.focus(); } catch (_) {}
    }
    _previouslyFocused = null;
  }

  function renderLoading() {
    var c = $('pmg-sb-content');
    if (!c) return;
    c.innerHTML =
      '<div class="pmg-sb-loading">' +
        '<div class="pmg-sb-spinner-lg" aria-hidden="true"></div>' +
        '<div style="font-weight:700">Composing your 5-shot storyboard…</div>' +
        '<div style="margin-top:6px;opacity:.75;font-size:.85rem">Director GPT is breaking your idea into cinematic beats.</div>' +
      '</div>';
  }

  function renderError(msg) {
    var c = $('pmg-sb-content');
    if (!c) return;
    c.innerHTML = '<div class="pmg-sb-error">⚠️ ' + escapeHtml(msg) + '</div>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var token = (window.PMG_AUTH && window.PMG_AUTH.token) || null;
      if (!token && window.localStorage) token = localStorage.getItem('pmg_supabase_access_token') || null;
      if (token) h['Authorization'] = 'Bearer ' + token;
    } catch (_) {}
    return h;
  }

  async function fetchPanels(goal, sessionId) {
    try {
      var res = await fetch('/api/storyboard', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ goal: goal }),
        signal: _abortCtrl ? _abortCtrl.signal : undefined,
      });
      if (sessionId !== _sessionId) return; // stale
      var data = await res.json().catch(function () { return {}; });
      if (sessionId !== _sessionId) return;
      if (!res.ok || !Array.isArray(data.panels) || data.panels.length === 0) {
        renderError(data.error || 'Could not generate storyboard. Please try a clearer concept.');
        return;
      }
      _currentPanels = data.panels.slice(0, 5).map(function (p) {
        return { prompt: String(p), imageUrl: null, status: 'pending', error: null };
      });
      renderPanels();
      generateAllImages(sessionId);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (sessionId !== _sessionId) return;
      renderError('Network error reaching the storyboard service.');
    }
  }

  function panelImgInner(p, i) {
    if (p.status === 'pending') return '<div class="pmg-sb-spinner" aria-hidden="true"></div>';
    if (p.status === 'done')    return '<img src="' + escapeHtml(p.imageUrl) + '" alt="Storyboard panel ' + (i + 1) + '" />';
    return '<div class="pmg-sb-fail">⚠️ ' + escapeHtml(p.error || 'Image failed.') + '</div>';
  }

  function panelTextInner(p, i) {
    var regen = (p.status === 'pending')
      ? '<button type="button" class="pmg-sb-regen-btn" data-sb-regen="' + i + '" disabled aria-label="Regenerating shot ' + (i + 1) + '">⏳ Regenerating…</button>'
      : '<button type="button" class="pmg-sb-regen-btn" data-sb-regen="' + i + '" aria-label="Regenerate shot ' + (i + 1) + '">🔄 Regenerate</button>';
    return (
      '<span class="pmg-sb-shot-label">Shot ' + (i + 1) + '</span>' +
      '<div class="pmg-sb-prompt-text">' + escapeHtml(p.prompt) + '</div>' +
      regen
    );
  }

  function renderPanels() {
    var c = $('pmg-sb-content');
    if (!c) return;
    var concept = '<div class="pmg-sb-concept"><strong>Concept</strong>' + escapeHtml(_currentConcept) + '</div>';
    var panelsHtml = _currentPanels.map(function (p, i) {
      return (
        '<div class="pmg-sb-panel" data-sb-idx="' + i + '">' +
          '<div class="pmg-sb-panel-img" data-sb-img-slot="' + i + '">' + panelImgInner(p, i) + '</div>' +
          '<div class="pmg-sb-panel-text" data-sb-text-slot="' + i + '">' + panelTextInner(p, i) + '</div>' +
        '</div>'
      );
    }).join('');
    var actions =
      '<div class="pmg-sb-actions">' +
        '<button type="button" id="pmg-sb-send-to-video" class="pmg-sb-btn pmg-sb-btn-primary">🎬 Send to Video Studio</button>' +
        '<button type="button" id="pmg-sb-export-pdf" class="pmg-sb-btn pmg-sb-btn-secondary">🖨 Export PDF</button>' +
        '<button type="button" id="pmg-sb-copy-prompts" class="pmg-sb-btn pmg-sb-btn-secondary">📋 Copy All Prompts</button>' +
      '</div>';
    c.innerHTML = concept +
      '<div class="pmg-sb-panels">' + panelsHtml + '</div>' +
      actions;
  }

  function updatePanel(i) {
    var p = _currentPanels[i];
    if (!p) return;
    var imgSlot = document.querySelector('[data-sb-img-slot="' + i + '"]');
    if (imgSlot) imgSlot.innerHTML = panelImgInner(p, i);
    var textSlot = document.querySelector('[data-sb-text-slot="' + i + '"]');
    if (textSlot) textSlot.innerHTML = panelTextInner(p, i);
  }

  function regenerateOne(i) {
    var p = _currentPanels[i];
    if (!p || p.status === 'pending') return;
    p.status = 'pending';
    p.error = null;
    p.imageUrl = null;
    updatePanel(i);
    // Reuse the live session token so the result lands in the open modal.
    generateOne(i, _sessionId);
  }

  // Build a self-contained print document (2-up portrait) and open it in a
  // new window. Browser's native print dialog handles the "Save as PDF"
  // step. Zero deps. Pop-up blockers: triggered from a click handler so
  // the user-gesture bypass applies.
  function exportPdf() {
    var dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    var titleText = 'Storyboard — ' + (_currentConcept.slice(0, 60) || 'Untitled');
    var panelsHtml = _currentPanels.map(function (p, i) {
      var inner;
      if (p.status === 'done' && p.imageUrl) {
        inner = '<img src="' + escapeHtml(p.imageUrl) + '" alt="Shot ' + (i + 1) + '" crossorigin="anonymous" />';
      } else {
        inner = '<div class="pmg-pdf-noimg">Image not generated</div>';
      }
      return (
        '<div class="pmg-pdf-panel">' +
          '<div class="pmg-pdf-shot">Shot ' + (i + 1) + '</div>' +
          inner +
          '<div class="pmg-pdf-prompt">' + escapeHtml(p.prompt) + '</div>' +
        '</div>'
      );
    }).join('');

    var doc =
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />' +
      '<title>' + escapeHtml(titleText) + '</title>' +
      '<style>' +
        '@page { size: letter portrait; margin: 0.6in 0.6in 0.8in; }' +
        '* { box-sizing: border-box; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; }' +
        '.pmg-pdf-header { border-bottom: 2px solid #0a2420; padding-bottom: 14px; margin-bottom: 22px; }' +
        '.pmg-pdf-header h1 { margin: 0; font-size: 11pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #0a2420; }' +
        '.pmg-pdf-header .pmg-pdf-concept { font-size: 14pt; line-height: 1.35; color: #111; margin: 8px 0 0; font-weight: 600; }' +
        '.pmg-pdf-header .pmg-pdf-meta { font-size: 9pt; color: #666; margin-top: 8px; letter-spacing: 0.02em; }' +
        '.pmg-pdf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }' +
        '.pmg-pdf-panel { break-inside: avoid; page-break-inside: avoid; border: 1px solid #d4d4d4; border-radius: 6px; padding: 10px; background: #fff; }' +
        '.pmg-pdf-shot { font-size: 8pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #0a2420; margin-bottom: 6px; }' +
        '.pmg-pdf-panel img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 4px; background: #eee; display: block; }' +
        '.pmg-pdf-panel .pmg-pdf-noimg { width: 100%; aspect-ratio: 1 / 1; border: 1px dashed #c0c0c0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 9pt; background: #fafafa; }' +
        '.pmg-pdf-panel .pmg-pdf-prompt { font-size: 9pt; line-height: 1.45; color: #333; margin-top: 8px; }' +
        '.pmg-pdf-footer { position: fixed; bottom: 0.3in; left: 0.6in; right: 0.6in; text-align: center; font-size: 8pt; color: #888; border-top: 1px solid #e8e8e8; padding-top: 6px; }' +
      '</style></head><body>' +
        '<div class="pmg-pdf-header">' +
          '<h1>🎞️ Storyboard</h1>' +
          '<div class="pmg-pdf-concept">' + escapeHtml(_currentConcept) + '</div>' +
          '<div class="pmg-pdf-meta">' + escapeHtml(dateStr) + ' · 5 shots</div>' +
        '</div>' +
        '<div class="pmg-pdf-grid">' + panelsHtml + '</div>' +
        '<div class="pmg-pdf-footer">Built with PromptMeGood · promptmegood.com</div>' +
        '<script>(function(){' +
          'function go(){ try { window.focus(); window.print(); } catch(_) {} }' +
          'window.addEventListener("load", function(){' +
            'var imgs = document.images || [];' +
            'var pending = imgs.length;' +
            'if (!pending) { setTimeout(go, 200); return; }' +
            'var done = function(){ if (--pending <= 0) setTimeout(go, 250); };' +
            'for (var i = 0; i < imgs.length; i++) {' +
              'if (imgs[i].complete) { done(); }' +
              'else { imgs[i].addEventListener("load", done); imgs[i].addEventListener("error", done); }' +
            '}' +
            'setTimeout(function(){ try { go(); } catch(_) {} }, 6000);' +
          '});' +
        '})();<' + '/script>' +
      '</body></html>';

    var w = window.open('', '_blank');
    if (!w) {
      // Pop-up blocked — surface a friendly hint instead of failing silently.
      var btn = document.getElementById('pmg-sb-export-pdf');
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = '⚠️ Pop-up blocked — allow & retry';
        setTimeout(function () { btn.textContent = orig; }, 2600);
      }
      return;
    }
    w.document.open();
    w.document.write(doc);
    w.document.close();
  }

  async function generateOne(i, sessionId) {
    var p = _currentPanels[i];
    if (!p) return;
    try {
      var res = await fetch('/api/image', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: p.prompt, size: '1024x1024' }),
        signal: _abortCtrl ? _abortCtrl.signal : undefined,
      });
      if (sessionId !== _sessionId) return; // stale — drop, don't render
      var data = await res.json().catch(function () { return {}; });
      if (sessionId !== _sessionId) return;
      if (res.status === 429) {
        p.status = 'failed';
        p.error = 'Daily image limit reached.';
      } else if (!res.ok || !data.url) {
        p.status = 'failed';
        p.error = data.error || 'Generation failed.';
      } else {
        p.status = 'done';
        p.imageUrl = data.url;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (sessionId !== _sessionId) return;
      p.status = 'failed';
      p.error = 'Network error.';
    }
    if (sessionId === _sessionId) updatePanel(i);
  }

  // Run with limited parallelism — DALL·E 3 + free-tier caps mean firing
  // 5 at once usually 429s the user. Cap at 2 in flight. The pump checks
  // the session token between each launch so closing/reopening the modal
  // halts further consumption.
  async function generateAllImages(sessionId) {
    var inFlight = 0;
    var idx = 0;
    var max = Math.min(2, IMAGE_PARALLEL);
    return new Promise(function (resolve) {
      function pump() {
        if (sessionId !== _sessionId) { if (inFlight === 0) resolve(); return; }
        while (inFlight < max && idx < _currentPanels.length) {
          var i = idx++;
          inFlight++;
          generateOne(i, sessionId).finally(function () {
            inFlight--;
            if (sessionId !== _sessionId && inFlight === 0) { resolve(); return; }
            if (idx >= _currentPanels.length && inFlight === 0) resolve();
            else pump();
          });
        }
      }
      pump();
    });
  }

  function sendToVideoStudio() {
    var sequence = _currentPanels.map(function (p, i) {
      return 'Shot ' + (i + 1) + ': ' + p.prompt;
    }).join(' → ');
    closeStoryboard();
    // Switch v3 chassis to the Video panel (no modal).
    if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
      window.pmgChassisV3.setActivePanel('video');
    } else if (typeof window.openVisualStudio === 'function') {
      window.openVisualStudio({ mode: 'video' });
    }
    setTimeout(function () {
      var ta = document.getElementById('pmg-vs-video-goal');
      if (ta) {
        ta.value = sequence;
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 80);
  }

  function injectTrigger() {
    // Storyboard launcher belongs inside the v3 Video panel. If the mount
    // slot doesn't exist yet, do nothing — the search observer will retry
    // until v3 builds it.
    var videoMount = document.getElementById('pmgv3-storyboard-mount');
    if (!videoMount) return;
    var existing = $(TRIGGER_ID);
    if (existing) {
      if (existing.parentNode !== videoMount) {
        existing.className = 'pmg-vs-btn pmg-vs-btn-secondary pmg-vs-full-width';
        existing.style.cssText = '';
        existing.innerHTML = '🎞️ Generate Storyboard from Idea';
        videoMount.appendChild(existing);
      }
      return;
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = TRIGGER_ID;
    btn.setAttribute('data-pmg-action', 'generate-storyboard');
    btn.className = 'pmg-vs-btn pmg-vs-btn-secondary pmg-vs-full-width';
    btn.innerHTML = '🎞️ Generate Storyboard from Idea';
    videoMount.appendChild(btn);
  }

  function getGoalText() {
    // Storyboard launches from inside the Video panel, so the Video
    // textarea is the natural source of the concept. Fall back to the
    // Text Prompts goal box for back-compat (legacy entry points).
    var videoEl = document.getElementById('pmg-vs-video-goal');
    var v = videoEl ? (videoEl.value || '').trim() : '';
    if (v) return v;
    var goalEl = document.getElementById('goal');
    return goalEl ? (goalEl.value || '').trim() : '';
  }

  function flashEmptyHint() {
    // Show a small inline hint near the video goal input rather than
    // opening the modal straight into an error state.
    var videoEl = document.getElementById('pmg-vs-video-goal');
    if (videoEl) {
      try { videoEl.focus(); } catch (_) {}
      try { videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }
    var host = (videoEl && videoEl.parentNode) || document.getElementById('pmgv3-panel-video');
    if (!host) return;
    var hintId = 'pmg-sb-empty-hint';
    var existing = document.getElementById(hintId);
    if (existing) { existing.remove(); }
    var hint = document.createElement('div');
    hint.id = hintId;
    hint.setAttribute('role', 'status');
    hint.style.cssText = 'margin:8px 0 0;padding:8px 10px;border-radius:8px;background:rgba(255,170,40,0.12);border:1px solid rgba(255,170,40,0.4);color:#ffcc66;font-size:13px;';
    hint.textContent = '✏️ Type your video idea above first, then tap Generate Storyboard.';
    host.insertBefore(hint, videoEl ? videoEl.nextSibling : null);
    setTimeout(function () { try { hint.remove(); } catch (_) {} }, 4000);
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('#' + TRIGGER_ID + ', [data-pmg-open-storyboard]');
      if (t) {
        e.preventDefault();
        var concept = getGoalText();
        if (!concept) { flashEmptyHint(); return; }
        openStoryboard(concept);
        return;
      }
      if (!modal()) return;
      if (e.target.closest('#pmg-close-storyboard')) { closeStoryboard(); return; }
      if (e.target === modal()) { closeStoryboard(); return; }
      if (e.target.closest('#pmg-sb-send-to-video')) { sendToVideoStudio(); return; }
      if (e.target.closest('#pmg-sb-export-pdf')) { exportPdf(); return; }
      var regenBtn = e.target.closest('[data-sb-regen]');
      if (regenBtn) {
        var idx = parseInt(regenBtn.getAttribute('data-sb-regen'), 10);
        if (!isNaN(idx)) regenerateOne(idx);
        return;
      }
      if (e.target.closest('#pmg-sb-copy-prompts')) {
        if (navigator.clipboard) {
          var txt = _currentPanels.map(function (p, i) { return 'Shot ' + (i + 1) + ': ' + p.prompt; }).join('\n\n');
          navigator.clipboard.writeText(txt);
          var b = e.target.closest('#pmg-sb-copy-prompts');
          var orig = b.textContent;
          b.textContent = '✓ Copied';
          setTimeout(function () { b.textContent = orig; }, 1400);
        }
        return;
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal() && !modal().hasAttribute('hidden')) {
        closeStoryboard();
      }
    });

    // Re-attempt injection after dynamic UI changes, then disconnect as
    // soon as the button is mounted to avoid a long-lived full-subtree
    // observer churning on unrelated DOM mutations. Re-attach (one shot)
    // if the button is later removed by other code.
    function ensureTrigger() {
      injectTrigger();
      if ($(TRIGGER_ID)) {
        if (window._pmgSbObserver) { window._pmgSbObserver.disconnect(); window._pmgSbObserver = null; }
        // Watch only for removal; cheaper than full subtree observation.
        var holder = $(TRIGGER_ID).parentNode;
        if (holder && !window._pmgSbRemovalObserver) {
          window._pmgSbRemovalObserver = new MutationObserver(function () {
            if (!$(TRIGGER_ID)) {
              window._pmgSbRemovalObserver.disconnect();
              window._pmgSbRemovalObserver = null;
              // restart the search observer
              startSearchObserver();
            }
          });
          window._pmgSbRemovalObserver.observe(holder, { childList: true });
        }
      }
    }
    function startSearchObserver() {
      if (window._pmgSbObserver) return;
      window._pmgSbObserver = new MutationObserver(function () { ensureTrigger(); });
      window._pmgSbObserver.observe(document.body, { childList: true, subtree: true });
    }
    ensureTrigger();
    if (!$(TRIGGER_ID)) startSearchObserver();
  }

  window.openStoryboard = openStoryboard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
