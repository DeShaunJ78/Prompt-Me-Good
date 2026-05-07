/* ============================================================================
   PromptMeGood — Storyboard Studio (sb-1)
   Text concept → /api/storyboard returns 5 prompts → 5 parallel /api/image
   calls → render thumbnails → optional handoff to Visual Studio video tab.
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
      '<div id="' + MODAL_ID + '" class="pmg-modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pmg-sb-title">' +
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

  function renderPanels() {
    var c = $('pmg-sb-content');
    if (!c) return;
    var concept = '<div class="pmg-sb-concept"><strong>Concept</strong>' + escapeHtml(_currentConcept) + '</div>';
    var panelsHtml = _currentPanels.map(function (p, i) {
      return (
        '<div class="pmg-sb-panel" data-sb-idx="' + i + '">' +
          '<div class="pmg-sb-panel-img" data-sb-img-slot="' + i + '">' +
            (p.status === 'pending'  ? '<div class="pmg-sb-spinner" aria-hidden="true"></div>' :
             p.status === 'done'     ? '<img src="' + escapeHtml(p.imageUrl) + '" alt="Storyboard panel ' + (i + 1) + '" />' :
             /* failed */              '<div class="pmg-sb-fail">⚠️ ' + escapeHtml(p.error || 'Image failed.') + '</div>') +
          '</div>' +
          '<div class="pmg-sb-panel-text">' +
            '<span class="pmg-sb-shot-label">Shot ' + (i + 1) + '</span>' +
            '<div>' + escapeHtml(p.prompt) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    var actions =
      '<div class="pmg-sb-actions">' +
        '<button type="button" id="pmg-sb-send-to-video" class="pmg-sb-btn pmg-sb-btn-primary">🎬 Send to Video Studio</button>' +
        '<button type="button" id="pmg-sb-copy-prompts" class="pmg-sb-btn pmg-sb-btn-secondary">📋 Copy All Prompts</button>' +
      '</div>';
    c.innerHTML = concept +
      '<div class="pmg-sb-panels">' + panelsHtml + '</div>' +
      actions;
  }

  function updatePanel(i) {
    var slot = document.querySelector('[data-sb-img-slot="' + i + '"]');
    if (!slot) return;
    var p = _currentPanels[i];
    if (!p) return;
    if (p.status === 'done') {
      slot.innerHTML = '<img src="' + escapeHtml(p.imageUrl) + '" alt="Storyboard panel ' + (i + 1) + '" />';
    } else if (p.status === 'failed') {
      slot.innerHTML = '<div class="pmg-sb-fail">⚠️ ' + escapeHtml(p.error || 'Image failed.') + '</div>';
    }
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
    if (typeof window.openVisualStudio === 'function') {
      window.openVisualStudio({ mode: 'video' });
      // Wait for the video builder textarea to mount, then pre-fill.
      setTimeout(function () {
        var ta = document.getElementById('pmg-vs-video-goal');
        if (ta) {
          ta.value = sequence;
          ta.focus();
          // Trigger any input listeners
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 60);
    }
  }

  function injectTrigger() {
    var existing = $(TRIGGER_ID);
    var launcherRowEl = document.getElementById('pmg-vs-launch-composer-row');
    if (existing) {
      // Promote into the launcher row if it appeared after first injection.
      if (launcherRowEl && existing.parentNode !== launcherRowEl) {
        existing.classList.add('pmg-vs-launch-pill', 'pmg-sb-launch-pill');
        existing.style.cssText = '';
        existing.innerHTML = '🎞️ Storyboard';
        launcherRowEl.appendChild(existing);
      }
      return;
    }
    // PRIMARY: drop the button into the chassis composer-wrap so it sits
    // directly under the Goal textarea on both desktop and mobile (always
    // visible regardless of liftFormAuxIntoThread). FALLBACK: legacy form.
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = TRIGGER_ID;
    btn.className = 'pmg-sb-btn pmg-sb-btn-secondary';
    btn.innerHTML = '🎞️ Storyboard';
    btn.setAttribute('data-pmg-action', 'generate-storyboard');
    var launcherRow = document.getElementById('pmg-vs-launch-composer-row');
    if (launcherRow) {
      btn.classList.add('pmg-vs-launch-pill', 'pmg-sb-launch-pill');
      launcherRow.appendChild(btn);
      return;
    }
    var main = document.querySelector('.pmgv2-main');
    if (main) {
      btn.style.cssText = 'margin-top:8px;width:100%;font-size:.92rem;padding:10px 14px';
      main.appendChild(btn);
      return;
    }
    var anchor = document.getElementById('fix-prompt-btn')
              || document.querySelector('#prompt-form button[type="submit"]')
              || document.querySelector('#prompt-form');
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  }

  function getGoalText() {
    var goalEl = document.getElementById('goal');
    return goalEl ? (goalEl.value || '').trim() : '';
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('#' + TRIGGER_ID + ', [data-pmg-open-storyboard]');
      if (t) {
        e.preventDefault();
        openStoryboard(getGoalText());
        return;
      }
      if (!modal()) return;
      if (e.target.closest('#pmg-close-storyboard')) { closeStoryboard(); return; }
      if (e.target === modal()) { closeStoryboard(); return; }
      if (e.target.closest('#pmg-sb-send-to-video')) { sendToVideoStudio(); return; }
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
