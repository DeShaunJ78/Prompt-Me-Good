/* pmg-guided-intake.js — gi-1
 * Guided intake (Variant A from the canvas review). Injects 4 labeled
 * fields (Subject / Environment / Action / Style) ABOVE the existing
 * #pmg-vs-image-goal and #pmg-vs-video-goal textareas, with a persistent
 * "Or write freeform instead" toggle.
 *
 * Design contract:
 *   - The existing textarea remains the source-of-truth that
 *     buildImagePrompt() / buildVideoPrompt() and downstream features
 *     (auto-boost, storyboard, session persistence) read from. In guided
 *     mode we just keep the textarea hidden and write the assembled
 *     string into its .value, dispatching input/change so listeners react.
 *   - Mode is persisted per-panel in localStorage:
 *       pmgv3:vs:intake-mode:image | :video  ->  'guided' | 'freeform'
 *   - Field values are persisted per-panel in localStorage:
 *       pmgv3:vs:intake:image | :video  ->  {subject,environment,action,style}
 *   - Default mode for first-time users: 'guided'.
 *
 * Disable: localStorage.pmg_guided_intake_disable = '1', or ?noguided.
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_guided_intake_disable') === '1') return;
    if (/[?&]noguided\b/.test(location.search)) return;
  } catch (_) {}

  var STORAGE_PREFIX = 'pmgv3:vs:intake';
  var DEFAULT_MODE = 'guided';

  var SCOPES = {
    image: {
      goalId: 'pmg-vs-image-goal',
      buildBtnId: 'pmg-vs-build-image-prompt-btn',
      placeholders: {
        subject: 'a woman in a red trench coat',
        environment: 'rainy Tokyo street at night',
        action: 'walking, looking up at neon signs'
      },
      styles: ['Cinematic', 'Editorial', 'Photoreal', 'Anime', 'Polaroid', 'Studio'],
      freeformPlaceholder: 'A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look\u2026'
    },
    video: {
      goalId: 'pmg-vs-video-goal',
      buildBtnId: 'pmg-vs-build-video-prompt-btn',
      placeholders: {
        subject: 'a vintage motorcycle',
        environment: 'neon-lit Tokyo street at night',
        action: 'driving slowly past glowing storefronts'
      },
      styles: ['Cinematic', 'Documentary', 'Anime', 'Music Video', 'Commercial', 'B-Roll'],
      freeformPlaceholder: 'A tracking shot of a vintage car driving through neon-lit Tokyo at night\u2026'
    }
  };

  function readMode(scopeKey) {
    try {
      var v = localStorage.getItem(STORAGE_PREFIX + '-mode:' + scopeKey);
      return (v === 'freeform' || v === 'guided') ? v : DEFAULT_MODE;
    } catch (_) { return DEFAULT_MODE; }
  }
  function writeMode(scopeKey, mode) {
    try { localStorage.setItem(STORAGE_PREFIX + '-mode:' + scopeKey, mode); } catch (_) {}
  }
  function readFields(scopeKey) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + ':' + scopeKey);
      if (!raw) return {};
      var p = JSON.parse(raw);
      return (p && typeof p === 'object') ? p : {};
    } catch (_) { return {}; }
  }
  function writeFields(scopeKey, fields) {
    try { localStorage.setItem(STORAGE_PREFIX + ':' + scopeKey, JSON.stringify(fields)); } catch (_) {}
  }

  function assemble(fields) {
    var parts = [];
    var s = (fields.subject || '').trim();
    var e = (fields.environment || '').trim();
    var a = (fields.action || '').trim();
    var st = (fields.style || '').trim();
    if (s) parts.push(s);
    if (e) parts.push(e);
    if (a) parts.push(a);
    if (st) parts.push(st + ' style');
    return parts.join(', ');
  }

  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildShellHtml(scopeKey, cfg) {
    var styleOpts = ['<option value="">Select a style (optional)</option>']
      .concat(cfg.styles.map(function (s) {
        return '<option value="' + escAttr(s) + '">' + escAttr(s) + '</option>';
      })).join('');
    return [
      '<div class="pmg-gi" data-pmg-gi-scope="' + scopeKey + '">',
        '<div class="pmg-gi-toggle-row">',
          '<button type="button" class="pmg-gi-toggle" data-pmg-gi-toggle aria-pressed="false">',
            '<span class="pmg-gi-toggle-icon" aria-hidden="true">\u21BB</span>',
            '<span class="pmg-gi-toggle-label">Or write freeform instead</span>',
          '</button>',
        '</div>',
        '<div class="pmg-gi-fields" data-pmg-gi-fields>',
          '<div class="pmg-gi-field">',
            '<label class="pmgv3-section-label" for="pmg-gi-' + scopeKey + '-subject">Subject</label>',
            '<input id="pmg-gi-' + scopeKey + '-subject" type="text" class="pmgv3-input pmg-gi-input" data-pmg-gi-field="subject" autocomplete="off" maxlength="200" placeholder="' + escAttr(cfg.placeholders.subject) + '" />',
            '<div class="pmg-gi-hint">Who or what is the focus?</div>',
          '</div>',
          '<div class="pmg-gi-field">',
            '<label class="pmgv3-section-label" for="pmg-gi-' + scopeKey + '-environment">Environment</label>',
            '<input id="pmg-gi-' + scopeKey + '-environment" type="text" class="pmgv3-input pmg-gi-input" data-pmg-gi-field="environment" autocomplete="off" maxlength="200" placeholder="' + escAttr(cfg.placeholders.environment) + '" />',
            '<div class="pmg-gi-hint">Where is this happening?</div>',
          '</div>',
          '<div class="pmg-gi-field">',
            '<label class="pmgv3-section-label" for="pmg-gi-' + scopeKey + '-action">Action / Mood</label>',
            '<input id="pmg-gi-' + scopeKey + '-action" type="text" class="pmgv3-input pmg-gi-input" data-pmg-gi-field="action" autocomplete="off" maxlength="200" placeholder="' + escAttr(cfg.placeholders.action) + '" />',
            '<div class="pmg-gi-hint">What are they doing? How does it feel?</div>',
          '</div>',
          '<div class="pmg-gi-field">',
            '<label class="pmgv3-section-label" for="pmg-gi-' + scopeKey + '-style">Style</label>',
            '<select id="pmg-gi-' + scopeKey + '-style" class="pmgv3-select pmg-gi-select" data-pmg-gi-field="style">' + styleOpts + '</select>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  function applyMode(host, mode, goalEl, cfg) {
    host.setAttribute('data-pmg-gi-mode', mode);
    var btn = host.querySelector('[data-pmg-gi-toggle]');
    var lbl = btn && btn.querySelector('.pmg-gi-toggle-label');
    var icn = btn && btn.querySelector('.pmg-gi-toggle-icon');
    if (mode === 'freeform') {
      if (btn) btn.setAttribute('aria-pressed', 'true');
      if (lbl) lbl.textContent = 'Use guided fields instead';
      if (icn) icn.textContent = '\u21A9';
      goalEl.style.display = '';
      goalEl.removeAttribute('aria-hidden');
      goalEl.placeholder = cfg.freeformPlaceholder;
    } else {
      if (btn) btn.setAttribute('aria-pressed', 'false');
      if (lbl) lbl.textContent = 'Or write freeform instead';
      if (icn) icn.textContent = '\u21BB';
      goalEl.style.display = 'none';
      goalEl.setAttribute('aria-hidden', 'true');
    }
  }

  function syncGoalFromFields(scopeKey, host, goalEl) {
    var fields = {};
    host.querySelectorAll('[data-pmg-gi-field]').forEach(function (el) {
      fields[el.getAttribute('data-pmg-gi-field')] = el.value || '';
    });
    writeFields(scopeKey, fields);
    var assembled = assemble(fields);
    if (goalEl.value !== assembled) {
      goalEl.value = assembled;
      try { goalEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { goalEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }
  }

  function restoreFields(scopeKey, host) {
    var saved = readFields(scopeKey);
    host.querySelectorAll('[data-pmg-gi-field]').forEach(function (el) {
      var key = el.getAttribute('data-pmg-gi-field');
      if (saved[key] != null) el.value = saved[key];
    });
  }

  function mountFor(scopeKey) {
    var cfg = SCOPES[scopeKey];
    var goalEl = document.getElementById(cfg.goalId);
    if (!goalEl) return false;
    if (goalEl.dataset.pmgGiWired === '1') return true;

    var shell = document.createElement('div');
    shell.innerHTML = buildShellHtml(scopeKey, cfg);
    var host = shell.firstElementChild;
    goalEl.parentNode.insertBefore(host, goalEl);
    goalEl.dataset.pmgGiWired = '1';

    restoreFields(scopeKey, host);

    var mode = readMode(scopeKey);
    applyMode(host, mode, goalEl, cfg);
    if (mode === 'guided') {
      syncGoalFromFields(scopeKey, host, goalEl);
    }

    host.querySelectorAll('[data-pmg-gi-field]').forEach(function (el) {
      var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(ev, function () {
        if (host.getAttribute('data-pmg-gi-mode') === 'guided') {
          syncGoalFromFields(scopeKey, host, goalEl);
        }
      });
    });

    var btn = host.querySelector('[data-pmg-gi-toggle]');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = host.getAttribute('data-pmg-gi-mode') || 'guided';
        var next = current === 'guided' ? 'freeform' : 'guided';
        writeMode(scopeKey, next);
        applyMode(host, next, goalEl, cfg);
        if (next === 'guided') {
          syncGoalFromFields(scopeKey, host, goalEl);
          var first = host.querySelector('[data-pmg-gi-field]');
          if (first) try { first.focus(); } catch (_) {}
        } else {
          try { goalEl.focus(); } catch (_) {}
        }
      });
    }

    // Capture-phase click on the Build button: in guided mode, sync first
    // and focus the first empty field if the assembled prompt is empty,
    // since the textarea is hidden and the legacy buildImage/VideoPrompt()
    // calls goalEl.focus() which is silently a no-op when display:none.
    var buildBtn = document.getElementById(cfg.buildBtnId);
    if (buildBtn) {
      buildBtn.addEventListener('click', function () {
        if (host.getAttribute('data-pmg-gi-mode') !== 'guided') return;
        syncGoalFromFields(scopeKey, host, goalEl);
        if (!goalEl.value.trim()) {
          var first = host.querySelector('[data-pmg-gi-field]');
          if (first) try { first.focus(); } catch (_) {}
        }
      }, true);
    }

    return true;
  }

  var _mo = null;
  function tryMount() {
    var photoOk = mountFor('image');
    var videoOk = mountFor('video');
    if (photoOk && videoOk && _mo) {
      _mo.disconnect();
      _mo = null;
    }
  }

  function init() {
    tryMount();
    if (!_mo && !(document.getElementById('pmg-vs-image-goal') &&
                  document.getElementById('pmg-vs-video-goal') &&
                  document.getElementById('pmg-vs-image-goal').dataset.pmgGiWired === '1' &&
                  document.getElementById('pmg-vs-video-goal').dataset.pmgGiWired === '1')) {
      _mo = new MutationObserver(tryMount);
      _mo.observe(document.body, { childList: true, subtree: true });
      // Safety: stop observing after 30s regardless.
      setTimeout(function () {
        if (_mo) { _mo.disconnect(); _mo = null; }
      }, 30000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.pmgGuidedIntake = {
    setMode: function (scopeKey, mode) {
      if (!SCOPES[scopeKey]) return;
      if (mode !== 'guided' && mode !== 'freeform') return;
      writeMode(scopeKey, mode);
      var goalEl = document.getElementById(SCOPES[scopeKey].goalId);
      if (!goalEl) return;
      var host = goalEl.parentNode &&
        goalEl.parentNode.querySelector('[data-pmg-gi-scope="' + scopeKey + '"]');
      if (host) applyMode(host, mode, goalEl, SCOPES[scopeKey]);
    },
    getMode: readMode,
    remount: tryMount
  };
})();
