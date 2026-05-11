/* =====================================================================
 * pmg-voice.js — Voice input via Web Speech API (vox-1)
 * ---------------------------------------------------------------------
 * Mounts a small mic button below #goal, #pmg-vs-image-goal, and
 * #pmg-vs-video-goal. Click to start, click to stop. Interim results
 * append live; final results commit. Hidden on browsers without
 * SpeechRecognition. Pulsing dot respects prefers-reduced-motion.
 *
 * Language picker (per task-91): caret next to mic opens a popover
 * with en-US, en-GB, es-ES, fr-FR, de-DE, pt-BR, ja-JP, zh-CN, hi-IN.
 * Saved to localStorage['pmg.voice.lang.v1'].
 *
 * Disable: ?novoice, localStorage.pmg_voice_disable='1'.
 * ===================================================================== */
(function pmgVoice() {
  'use strict';
  if (window.__pmgVoiceInit) return;
  window.__pmgVoiceInit = true;

  try {
    if (location.search.indexOf('novoice') !== -1) return;
    if (localStorage.getItem('pmg_voice_disable') === '1') return;
  } catch (e) {}

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  var STYLE_ID = 'pmg-voice-styles';
  var LANG_KEY = 'pmg.voice.lang.v1';
  var TARGETS = ['goal', 'pmg-vs-image-goal', 'pmg-vs-video-goal'];

  var LANGS = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'es-ES', label: 'Español' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'pt-BR', label: 'Português (BR)' },
    { code: 'ja-JP', label: '日本語' },
    { code: 'zh-CN', label: '中文 (简体)' },
    { code: 'hi-IN', label: 'हिन्दी' }
  ];

  function defaultLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'en-US');
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code.toLowerCase() === nav.toLowerCase()) return LANGS[i].code;
    }
    var pre = nav.slice(0, 2).toLowerCase();
    for (var j = 0; j < LANGS.length; j++) {
      if (LANGS[j].code.slice(0, 2).toLowerCase() === pre) return LANGS[j].code;
    }
    return 'en-US';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.pmg-voice-row {',
      '  display: flex; align-items: center; gap: 6px;',
      '  margin-top: 8px; flex-wrap: wrap;',
      '}',
      '.pmg-voice-mic, .pmg-voice-lang {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  min-height: 36px; padding: 6px 12px;',
      '  background: transparent; color: var(--color-text, #e8eef2);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 24%, transparent);',
      '  border-radius: var(--radius-md, 8px);',
      '  font-size: 13px; font-weight: 600; cursor: pointer;',
      '  transition: background 120ms ease, border-color 120ms ease;',
      '}',
      '.pmg-voice-mic:hover, .pmg-voice-lang:hover {',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 10%, transparent);',
      '  border-color: color-mix(in srgb, var(--color-primary, #3ee0a0) 50%, transparent);',
      '}',
      '.pmg-voice-mic:focus-visible, .pmg-voice-lang:focus-visible {',
      '  outline: 2px solid var(--color-primary, #3ee0a0);',
      '  outline-offset: 2px;',
      '}',
      '.pmg-voice-mic[aria-pressed="true"] {',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 18%, transparent);',
      '  border-color: var(--color-primary, #3ee0a0);',
      '}',
      '.pmg-voice-dot {',
      '  display: inline-block; width: 8px; height: 8px; border-radius: 50%;',
      '  background: var(--color-danger, #ff5470);',
      '  box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger, #ff5470) 60%, transparent);',
      '}',
      '.pmg-voice-mic[aria-pressed="true"] .pmg-voice-dot {',
      '  animation: pmg-voice-pulse 1.2s ease-out infinite;',
      '}',
      '@keyframes pmg-voice-pulse {',
      '  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger, #ff5470) 60%, transparent); }',
      '  70%  { box-shadow: 0 0 0 10px color-mix(in srgb, var(--color-danger, #ff5470) 0%, transparent); }',
      '  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger, #ff5470) 0%, transparent); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .pmg-voice-mic[aria-pressed="true"] .pmg-voice-dot { animation: none; }',
      '}',
      '.pmg-voice-status {',
      '  font-size: 12px; color: var(--color-text-muted, #98a8b0);',
      '  margin-left: 4px;',
      '}',
      '.pmg-voice-langmenu {',
      '  position: absolute; z-index: 200; min-width: 180px;',
      '  background: var(--color-surface, #0f1d22);',
      '  border: 1px solid var(--color-border, rgba(91,168,176,0.3));',
      '  border-radius: var(--radius-md, 8px);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.32);',
      '  padding: 4px; max-height: 320px; overflow-y: auto;',
      '  display: flex; flex-direction: column; gap: 2px;',
      '}',
      '.pmg-voice-langmenu[hidden] { display: none; }',
      '.pmg-voice-langmenu button {',
      '  text-align: left; padding: 8px 12px; background: transparent;',
      '  border: 0; border-radius: var(--radius-sm, 6px);',
      '  color: var(--color-text, #e8eef2); font-size: 13px; cursor: pointer;',
      '}',
      '.pmg-voice-langmenu button:hover { background: rgba(91,168,176,0.15); }',
      '.pmg-voice-langmenu button[aria-current="true"] {',
      '  color: var(--color-primary, #3ee0a0); font-weight: 700;',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function buildRow(targetId) {
    var row = document.createElement('div');
    row.className = 'pmg-voice-row';
    row.setAttribute('data-pmg-voice-for', targetId);

    var lang = defaultLang();
    var mic = document.createElement('button');
    mic.type = 'button';
    mic.className = 'pmg-voice-mic';
    mic.setAttribute('aria-pressed', 'false');
    mic.setAttribute('aria-label', 'Start voice input (' + lang + ')');
    mic.innerHTML = '<span class="pmg-voice-dot" aria-hidden="true"></span><span class="pmg-voice-mic-label">Voice Input</span>';
    mic.title = 'Voice input · ' + lang;

    var langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'pmg-voice-lang';
    langBtn.setAttribute('aria-haspopup', 'true');
    langBtn.setAttribute('aria-expanded', 'false');
    langBtn.setAttribute('aria-label', 'Choose voice input language');
    langBtn.textContent = lang + ' ▾';

    var status = document.createElement('span');
    status.className = 'pmg-voice-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    row.appendChild(mic);
    row.appendChild(langBtn);
    row.appendChild(status);
    return { row: row, mic: mic, langBtn: langBtn, status: status };
  }

  function buildLangMenu(currentLang, onPick) {
    var menu = document.createElement('div');
    menu.className = 'pmg-voice-langmenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-pmg-overlay-root', '');
    menu.hidden = true;
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.textContent = l.label + '  (' + l.code + ')';
      if (l.code === currentLang) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { onPick(l.code); });
      menu.appendChild(b);
    });
    return menu;
  }

  function positionMenu(menu, anchor) {
    var r = anchor.getBoundingClientRect();
    menu.style.top = (window.scrollY + r.bottom + 4) + 'px';
    menu.style.left = (window.scrollX + r.left) + 'px';
  }

  function attachToTextarea(textarea) {
    if (!textarea || textarea.dataset.pmgVoiceMounted === '1') return;
    textarea.dataset.pmgVoiceMounted = '1';

    var built = buildRow(textarea.id);
    var row = built.row, mic = built.mic, langBtn = built.langBtn, status = built.status;

    if (textarea.nextSibling) {
      textarea.parentNode.insertBefore(row, textarea.nextSibling);
    } else {
      textarea.parentNode.appendChild(row);
    }

    var rec = null;
    var recording = false;
    var baseline = '';
    var currentLang = defaultLang();

    function setLangUI(code) {
      currentLang = code;
      try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
      langBtn.textContent = code + ' ▾';
      mic.setAttribute('aria-label', (recording ? 'Stop voice input (' : 'Start voice input (') + code + ')');
      mic.title = 'Voice input · ' + code;
    }

    function dispatchChange() {
      try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      try { textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }

    function start() {
      if (recording) return;
      try {
        rec = new SR();
      } catch (e) {
        status.textContent = 'Mic unavailable';
        return;
      }
      rec.lang = currentLang;
      rec.continuous = true;
      rec.interimResults = true;

      baseline = textarea.value || '';
      var needsSpace = baseline && !/\s$/.test(baseline);

      rec.onresult = function (ev) {
        var interim = '';
        var finals = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var r = ev.results[i];
          if (r.isFinal) finals += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finals) {
          baseline = baseline + (needsSpace ? ' ' : '') + finals.trim();
          needsSpace = baseline && !/\s$/.test(baseline);
        }
        var combined = baseline;
        if (interim) combined = baseline + (needsSpace ? ' ' : '') + interim;
        textarea.value = combined;
        dispatchChange();
      };

      rec.onerror = function (ev) {
        if (ev && ev.error === 'not-allowed') {
          status.textContent = 'Mic access blocked. Allow microphone in your browser settings.';
        } else if (ev && ev.error === 'no-speech') {
          status.textContent = 'No speech detected.';
        } else {
          status.textContent = 'Voice input error.';
        }
      };

      rec.onend = function () {
        recording = false;
        mic.setAttribute('aria-pressed', 'false');
        mic.setAttribute('aria-label', 'Start voice input (' + currentLang + ')');
        mic.querySelector('.pmg-voice-mic-label').textContent = 'Voice Input';
        if (status.textContent === 'Listening…') status.textContent = '';
      };

      try {
        rec.start();
        recording = true;
        mic.setAttribute('aria-pressed', 'true');
        mic.setAttribute('aria-label', 'Stop voice input (' + currentLang + ')');
        mic.querySelector('.pmg-voice-mic-label').textContent = 'Stop';
        status.textContent = 'Listening…';
        textarea.focus();
      } catch (e) {
        status.textContent = 'Could not start mic.';
      }
    }

    function stop() {
      if (rec && recording) {
        try { rec.stop(); } catch (e) {}
      }
    }

    mic.addEventListener('click', function () {
      if (recording) stop(); else start();
    });

    var openMenu = null;
    langBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (openMenu) {
        openMenu.remove();
        openMenu = null;
        langBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      openMenu = buildLangMenu(currentLang, function (code) {
        setLangUI(code);
        if (recording) {
          stop();
          setTimeout(start, 80);
        }
        if (openMenu) { openMenu.remove(); openMenu = null; }
        langBtn.setAttribute('aria-expanded', 'false');
      });
      document.body.appendChild(openMenu);
      openMenu.hidden = false;
      positionMenu(openMenu, langBtn);
      langBtn.setAttribute('aria-expanded', 'true');

      var off = function (e) {
        if (!openMenu) return;
        if (openMenu.contains(e.target) || e.target === langBtn) return;
        openMenu.remove();
        openMenu = null;
        langBtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', off, true);
        document.removeEventListener('keydown', escClose, true);
      };
      var escClose = function (e) {
        if (e.key === 'Escape' && openMenu) {
          openMenu.remove();
          openMenu = null;
          langBtn.setAttribute('aria-expanded', 'false');
          langBtn.focus();
          document.removeEventListener('click', off, true);
          document.removeEventListener('keydown', escClose, true);
        }
      };
      setTimeout(function () {
        document.addEventListener('click', off, true);
        document.addEventListener('keydown', escClose, true);
      }, 0);
    });

    setLangUI(currentLang);
  }

  function tryMountAll() {
    TARGETS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) attachToTextarea(el);
    });
  }

  function init() {
    injectStyles();
    tryMountAll();

    if (window.pmgMountBus && window.pmgMountBus.isActive()) {
      window.pmgMountBus.subscribe(function () { tryMountAll(); });
      return;
    }

    var mo = new MutationObserver(function () { tryMountAll(); });
    mo.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.pmgVoice = {
    setLang: function (code) {
      try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
    },
    getLang: defaultLang,
    supported: true
  };
})();
