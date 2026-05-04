/* =====================================================================
 * PromptMeGood — Voice input for free-form prompt fields
 *
 * Originally added in Task #65 for the #goal textarea (the brainstorming
 * "Your Goal" field). Task #90 extends it to the post-generate
 * #fine-tune-input box so users can iterate on a draft entirely
 * hands-free. Task #91 adds a small language picker (caret + popover)
 * next to each mic so users on a non-matching system locale (e.g.
 * writing English on a Spanish machine) can choose the recognition
 * language; the choice is persisted to localStorage and reused on
 * subsequent recordings.
 *
 * Behaviour (per mic button)
 *   1. Click the mic        — start recording (browser asks for
 *                             mic permission on first use). The
 *                             button shows a pulsing dot and an
 *                             "aria-pressed=true" state. Live
 *                             interim transcripts stream into the
 *                             target textarea so the user can see
 *                             what the API is hearing.
 *   2. Click the mic again  — stop recording. The latest interim
 *                             text is committed and the dot stops.
 *   3. Switching focus, escape, hiding the page, or clicking
 *      another mic also stops cleanly. Only one mic may record at
 *      a time across the page.
 *   4. Click the ▾ caret    — opens the language picker popover.
 *                             Selecting a language stores it under
 *                             pmg.voice.lang.v1 and updates every
 *                             mic's tooltip so the active code is
 *                             visible. The change takes effect on
 *                             the next recording session.
 *
 * Design constraints (hard rules)
 *   - No backend / API / DB / payment / secret changes.
 *   - No edits to existing IDs, classes, or JS handlers.
 *   - The script is opt-out via:
 *       ?novoice                       (URL flag)
 *       localStorage.pmg_voice_disable (set to "1")
 *       localStorage.pmg_disable       (global kill switch)
 *   - All runtime errors are caught locally so a failure here
 *     can NEVER break the rest of the page.
 *   - Respects prefers-reduced-motion: pulsing animation is
 *     swapped for a solid colour change.
 *
 * Browser support
 *   - Uses window.SpeechRecognition || window.webkitSpeechRecognition
 *     (Chrome/Edge/Safari, plus Chromium-based mobile). When the
 *     API is missing, every button is rendered DISABLED with a
 *     tooltip explaining the limitation — visible discoverability
 *     beats silent hiding. The language caret is also hidden in
 *     unsupported browsers since picking a language would have no
 *     effect.
 * ===================================================================== */
(function pmgVoiceInput() {
  'use strict';
  if (window.__pmgVoiceInit) return;
  window.__pmgVoiceInit = true;

  /* Escape hatches — bail before touching the DOM. */
  try {
    if (
      /[?&]novoice\b/.test(location.search) ||
      localStorage.getItem('pmg_voice_disable') === '1' ||
      localStorage.getItem('pmg_disable') === '1'
    ) {
      console.info('[pmg-voice] disabled via escape hatch');
      return;
    }
  } catch (_) {}

  try {

  var STYLE_ID    = 'pmg-voice-style';
  var BTN_CLASS   = 'pmg-voice-mic';
  var DOT_CLASS   = 'pmg-voice-dot';
  var GROUP_CLASS = 'pmg-voice-group';
  var CARET_CLASS = 'pmg-voice-caret';
  var POPUP_CLASS = 'pmg-voice-langpop';
  var LANG_KEY    = 'pmg.voice.lang.v1';

  /* The minimum required language list per the task spec, with a
     few extras (Italian, Korean) that share the same regional
     pattern. Labels are written in their own locale so a user who
     can read Japanese sees 日本語, etc. — picking the right entry
     doesn't require knowing English first. */
  var LANG_OPTIONS = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'es-ES', label: 'Español (España)' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'ja-JP', label: '日本語' },
    { code: 'zh-CN', label: '中文 (简体)' },
    { code: 'hi-IN', label: 'हिन्दी' }
  ];

  /* Each entry describes one mic mount point. The original Task #65
     mic for #goal keeps its historical id so any external CSS or
     test selector that referenced it continues to work; new mounts
     get their own unique ids. */
  var MOUNTS = [
    {
      id: 'pmg-voice-mic-btn',
      caretId: 'pmg-voice-lang-btn',
      targetId: 'goal',
      /* Insert just before #clear-goal-btn so the row reads
         label | mic | clear. Falls back to append if missing. */
      anchorSelector: '#clear-goal-btn',
      tooltipIdle: 'Speak your idea — voice input',
      ariaIdle: 'Start voice input',
      ariaActive: 'Stop voice input'
    },
    {
      id: 'pmg-voice-mic-btn-finetune',
      caretId: 'pmg-voice-lang-btn-finetune',
      targetId: 'fine-tune-input',
      anchorSelector: '#clear-fine-tune-btn',
      tooltipIdle: 'Speak your changes — voice input',
      ariaIdle: 'Start voice input for fine-tune',
      ariaActive: 'Stop voice input for fine-tune'
    }
  ];

  /* Track the currently-active controller so opening a second mic
     automatically stops the first one. Only one recognition session
     should be live at a time. */
  var activeController = null;

  /* Registry of all mounted mic+caret pairs so the language picker
     can refresh every tooltip when the user changes the language.
     Populated by mountOne(). */
  var registry = [];

  function getStoredLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return (typeof v === 'string' && v) ? v : '';
    } catch (_) { return ''; }
  }
  function setStoredLang(code) {
    try { localStorage.setItem(LANG_KEY, String(code || '')); } catch (_) {}
  }
  /* Resolve the active recognition language. Stored choice wins;
     otherwise fall back to the browser locale, then to en-US so
     rec.lang always has a value. */
  function getActiveLang() {
    var stored = getStoredLang();
    if (stored) return stored;
    try { return (navigator.language || 'en-US'); } catch (_) { return 'en-US'; }
  }
  function getLangLabel(code) {
    for (var i = 0; i < LANG_OPTIONS.length; i++) {
      if (LANG_OPTIONS[i].code === code) return LANG_OPTIONS[i].label;
    }
    return code || '';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var sel = '.' + BTN_CLASS;
    var caretSel = '.' + CARET_CLASS;
    var groupSel = '.' + GROUP_CLASS;
    var popSel   = '.' + POPUP_CLASS;
    var css = [
      /* Mic button — sized to sit naturally next to .btn-clear in
         the .field-label-row (which is align-items:baseline). The
         dimensions and border match .btn-clear so the row reads
         as a coherent toolbar. Selectors target the shared class
         so additional mounts inherit the same styling. */
      sel + ' {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  background: transparent;',
      '  border: 1px solid var(--color-border);',
      '  color: var(--color-text-muted);',
      '  font-size: var(--text-xs);',
      '  font-weight: 600;',
      '  padding: 4px 10px;',
      '  border-radius: var(--radius-sm);',
      '  cursor: pointer;',
      '  min-height: 28px;',
      '  line-height: 1;',
      '  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;',
      '}',
      sel + ':hover:not(:disabled) {',
      '  color: var(--color-text);',
      '  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));',
      '  background: color-mix(in srgb, var(--color-primary) 6%, transparent);',
      '}',
      sel + ':disabled {',
      '  opacity: 0.5; cursor: not-allowed;',
      '}',
      sel + '[aria-pressed="true"] {',
      '  color: var(--color-danger);',
      '  border-color: var(--color-danger);',
      '  background: color-mix(in srgb, var(--color-danger) 8%, transparent);',
      '}',
      sel + ' .pmg-voice-icon {',
      '  font-size: 12px; line-height: 1;',
      '}',
      sel + ' .pmg-voice-label {',
      '  /* The label text is hidden on very narrow screens; the',
      '     icon + aria-label keep the affordance accessible. */',
      '}',
      '@media (max-width: 480px) {',
      '  ' + sel + ' .pmg-voice-label { display: none; }',
      '}',

      /* Group wrapper holds the mic + caret as a single visual unit
         and anchors the language popover. inline-flex with a 2px
         gap keeps the two buttons close without making them look
         glued. position:relative is what the absolutely-positioned
         popover keys off. */
      groupSel + ' {',
      '  display: inline-flex; align-items: center; gap: 2px;',
      '  position: relative;',
      '}',

      /* Caret button — narrower than the mic and uses the same base
         class so hover/border colours stay consistent. The visible
         glyph is the "▾" character. */
      caretSel + ' {',
      '  padding: 4px 6px;',
      '  min-width: 22px;',
      '  justify-content: center;',
      '}',
      caretSel + ' > span { font-size: 10px; line-height: 1; }',
      caretSel + '[aria-expanded="true"] {',
      '  color: var(--color-text);',
      '  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));',
      '  background: color-mix(in srgb, var(--color-primary) 10%, transparent);',
      '}',

      /* Popover. Absolutely positioned beneath the caret so it
         doesn't push the layout around. listbox semantics with one
         option per language. Hidden via display:none so it leaves
         no a11y trace when closed. */
      popSel + ' {',
      '  position: absolute; top: calc(100% + 4px); right: 0;',
      '  z-index: 1000;',
      '  min-width: 180px; max-width: 240px;',
      '  margin: 0; padding: 4px;',
      '  list-style: none;',
      '  background: var(--color-surface, #fff);',
      '  border: 1px solid var(--color-border);',
      '  border-radius: var(--radius-md, 8px);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.12);',
      '  font-size: var(--text-sm, 13px);',
      '}',
      popSel + '[hidden] { display: none; }',
      popSel + ' li {',
      '  display: block; margin: 0;',
      '}',
      popSel + ' .pmg-voice-langopt {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  width: 100%; gap: 8px;',
      '  padding: 6px 8px;',
      '  background: transparent; border: 0;',
      '  color: var(--color-text);',
      '  font: inherit; text-align: left;',
      '  border-radius: var(--radius-sm, 4px);',
      '  cursor: pointer;',
      '}',
      popSel + ' .pmg-voice-langopt:hover,',
      popSel + ' .pmg-voice-langopt:focus-visible {',
      '  background: color-mix(in srgb, var(--color-primary) 10%, transparent);',
      '  outline: none;',
      '}',
      popSel + ' .pmg-voice-langopt[aria-checked="true"] {',
      '  background: color-mix(in srgb, var(--color-primary) 14%, transparent);',
      '  font-weight: 600;',
      '}',
      popSel + ' .pmg-voice-langopt .pmg-voice-langcode {',
      '  color: var(--color-text-muted); font-size: 11px;',
      '  font-variant-numeric: tabular-nums;',
      '}',
      popSel + ' .pmg-voice-langopt[aria-checked="true"] .pmg-voice-langcode {',
      '  color: var(--color-text);',
      '}',

      /* Pulsing recording dot. Animated by default; swapped for a
         solid colour fade when the user has reduced-motion on. */
      '.' + DOT_CLASS + ' {',
      '  display: inline-block;',
      '  width: 8px; height: 8px; border-radius: 50%;',
      '  background: var(--color-danger);',
      '  box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.55);',
      '  animation: pmgVoicePulse 1.2s ease-out infinite;',
      '}',
      '@keyframes pmgVoicePulse {',
      '  0%   { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.55); }',
      '  70%  { box-shadow: 0 0 0 8px rgba(185, 28, 28, 0); }',
      '  100% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .' + DOT_CLASS + ' {',
      '    animation: none;',
      '    box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.25);',
      '  }',
      '}',

      /* Dark-mode tweaks so the dot + popover stay visible. */
      '[data-theme="dark"] ' + sel + '[aria-pressed="true"] {',
      '  color: var(--color-danger); border-color: var(--color-danger);',
      '  background: color-mix(in srgb, var(--color-danger) 12%, transparent);',
      '}',
      '[data-theme="dark"] .' + DOT_CLASS + ' {',
      '  background: var(--color-danger);',
      '  box-shadow: 0 0 0 0 rgba(252, 165, 165, 0.55);',
      '}',
      '[data-theme="dark"] ' + popSel + ' {',
      '  background: var(--color-surface, #1f2937);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.45);',
      '}',
      '@media (prefers-color-scheme: dark) {',
      '  :root:not([data-theme]) ' + sel + '[aria-pressed="true"] {',
      '    color: var(--color-danger); border-color: var(--color-danger);',
      '    background: color-mix(in srgb, var(--color-danger) 12%, transparent);',
      '  }',
      '  :root:not([data-theme]) .' + DOT_CLASS + ' {',
      '    background: var(--color-danger);',
      '    box-shadow: 0 0 0 0 rgba(252, 165, 165, 0.55);',
      '  }',
      '}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function getRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function showToast(msg) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    } catch (_) {}
    /* Soft fallback so we never go silent on errors. */
    try { console.info('[pmg-voice]', msg); } catch (_) {}
  }

  /* Build the idle-state tooltip for a mic, e.g.
     "Speak your idea — voice input (en-US)". The active language is
     surfaced here so users can verify which locale the recognizer
     will use without having to open the picker. */
  function idleTitleFor(spec) {
    return (spec.tooltipIdle || 'Speak your idea — voice input') + ' (' + getActiveLang() + ')';
  }

  /* After the user picks a new language, walk the registry and
     update every mic that is currently idle. Active recordings
     keep their "Stop voice input" tooltip until they stop on
     their own — we don't interrupt mid-sentence. */
  function refreshAllTooltips() {
    var lang = getActiveLang();
    var label = getLangLabel(lang);
    for (var i = 0; i < registry.length; i++) {
      var entry = registry[i];
      if (entry.btn.getAttribute('aria-pressed') !== 'true') {
        entry.btn.title = idleTitleFor(entry.spec);
      }
      if (entry.caret) {
        var caretLabel = 'Voice input language: ' + label + ' (' + lang + ')';
        entry.caret.title = caretLabel;
        entry.caret.setAttribute('aria-label', caretLabel);
      }
    }
  }

  /* State scoped to one mic button instance. The controller knows
     nothing about siblings; cross-mic coordination (only one active
     at a time) is handled at the page level via activeController. */
  function createController(btn, target, opts) {
    opts = opts || {};
    var Ctor = getRecognitionCtor();
    var rec = null;
    var recording = false;
    /* The committed text we append speech AFTER. Starts as the
       textarea content at start(); mutates if the user edits the
       textarea while recording (see rebaseIfUserEdited below). */
    var baseline = '';
    /* Final transcripts captured since the last rebase, in order. */
    var finalChunks = [];
    /* Most recent interim hypothesis. Held separately so we can
       promote it to a final chunk if the browser ends the session
       without emitting an isFinal result for in-flight speech. */
    var lastInterim = '';
    /* The exact value WE last wrote to the textarea. Lets us
       detect manual edits during recording — if target.value
       drifts from this, the user typed and we rebase so their
       text is preserved instead of overwritten. */
    var lastWrittenValue = '';

    function joinTexts(base, extra) {
      base  = String(base  || '');
      extra = String(extra || '');
      if (!extra) return base;
      if (!base)  return extra;
      /* Insert a single space between existing content and the
         appended speech, unless the existing content already ends
         with whitespace or the speech starts with punctuation. */
      var sep = /\s$/.test(base) || /^[\s.,!?;:]/.test(extra) ? '' : ' ';
      return base + sep + extra;
    }

    /* If the textarea no longer matches what we last wrote, the
       user typed (or another script mutated it). Adopt the
       current value as the new baseline and discard any in-flight
       transcripts so the next paint starts fresh from the user's
       text instead of clobbering it. */
    function rebaseIfUserEdited() {
      if (target.value !== lastWrittenValue) {
        baseline    = String(target.value || '');
        finalChunks = [];
        lastInterim = '';
      }
    }

    function paint(interim) {
      rebaseIfUserEdited();
      lastInterim = interim || '';
      var combined = finalChunks.join(' ').trim();
      var withInterim = combined
        ? (lastInterim ? combined + ' ' + lastInterim : combined)
        : (lastInterim || '');
      var next = joinTexts(baseline, withInterim);
      target.value = next;
      lastWrittenValue = next;
      /* Notify any listeners (suggestion engine, character
         counters, autosave, etc.) that the field changed. */
      try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }

    /* Promote any pending interim hypothesis to a confirmed final
       chunk. Used in onend to guarantee the latest hypothesis is
       preserved even when the browser drops the in-flight speech
       without emitting an isFinal result on stop(). */
    function commitInterim() {
      var pending = lastInterim ? lastInterim.trim() : '';
      if (!pending) return;
      finalChunks.push(pending);
      lastInterim = '';
      paint('');
    }

    function setRecordingUI(on) {
      recording = !!on;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? (opts.ariaActive || 'Stop voice input')
                                        : (opts.ariaIdle   || 'Start voice input'));
      btn.title = on ? (opts.ariaActive || 'Stop voice input')
                     : idleTitleFor(opts.spec || { tooltipIdle: opts.tooltipIdle });
      var icon = btn.querySelector('.pmg-voice-icon');
      var label = btn.querySelector('.pmg-voice-label');
      if (icon)  icon.innerHTML  = on
        ? '<span class="' + DOT_CLASS + '" aria-hidden="true"></span>'
        : '🎤';
      if (label) label.textContent = on ? 'Listening…' : 'Voice';
    }

    function start() {
      if (recording) return;
      if (!Ctor) {
        showToast("Your browser doesn't support voice input. Try Chrome, Edge, or Safari.");
        return;
      }
      try {
        rec = new Ctor();
      } catch (e) {
        showToast("Couldn't start voice input. Try refreshing the page.");
        return;
      }
      rec.continuous = true;
      rec.interimResults = true;
      /* Read the active language fresh on every start so picker
         changes between sessions are honoured immediately on the
         next recording, without needing a page reload. */
      try { rec.lang = getActiveLang(); } catch (_) {}

      baseline         = String(target.value || '');
      finalChunks      = [];
      lastInterim      = '';
      /* Seed lastWrittenValue with the current textarea content
         so rebaseIfUserEdited() doesn't fire on the very first
         paint (we haven't written anything yet, so any difference
         between baseline and target.value would be misread as a
         user edit). */
      lastWrittenValue = baseline;

      rec.onresult = function (ev) {
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var r = ev.results[i];
          var txt = (r[0] && r[0].transcript) || '';
          if (r.isFinal) {
            txt = txt.trim();
            if (txt) finalChunks.push(txt);
          } else {
            interim += txt;
          }
        }
        paint(interim.trim());
      };

      rec.onerror = function (ev) {
        var code = (ev && ev.error) || 'unknown';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          showToast('Microphone permission denied. Allow access in your browser settings to use voice input.');
        } else if (code === 'no-speech') {
          showToast("I didn't catch that — try speaking a little louder.");
        } else if (code === 'audio-capture') {
          showToast("No microphone found. Plug one in or check your system audio settings.");
        } else if (code === 'network') {
          showToast('Voice input needs an internet connection.');
        } else if (code === 'language-not-supported') {
          showToast('That language is not supported here. Pick a different one from the ▾ menu.');
        } else if (code !== 'aborted') {
          showToast('Voice input stopped: ' + code);
        }
      };

      rec.onend = function () {
        /* End fires both for normal stop() and for browser-side
           timeouts (Chrome cuts continuous recognition after long
           silence). Promote any pending interim hypothesis to a
           final chunk first — some browsers drop in-flight speech
           on stop() without emitting a matching isFinal result,
           which would otherwise lose the user's last words. */
        try { commitInterim(); } catch (_) {}
        setRecordingUI(false);
        rec = null;
        if (activeController === ctrlRef) activeController = null;
      };

      try {
        rec.start();
        setRecordingUI(true);
        /* Stop any sibling mic that was already recording so only
           one session is live at a time. */
        if (activeController && activeController !== ctrlRef) {
          try { activeController.stop(); } catch (_) {}
        }
        activeController = ctrlRef;
      } catch (e) {
        /* InvalidStateError when start() is called twice — make
           sure the UI isn't stuck in "recording". */
        setRecordingUI(false);
        rec = null;
        showToast("Couldn't start voice input. Try clicking the mic again.");
      }
    }

    function stop() {
      if (!rec) { setRecordingUI(false); return; }
      try { rec.stop(); }
      catch (_) {
        try { rec.abort(); } catch (_) {}
        setRecordingUI(false);
        rec = null;
        if (activeController === ctrlRef) activeController = null;
      }
    }

    var ctrlRef = {
      toggle: function () { recording ? stop() : start(); },
      stop:   stop,
      isOn:   function () { return recording; }
    };
    return ctrlRef;
  }

  function buildButton(id) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'btn-clear ' + BTN_CLASS;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Start voice input');
    btn.title = 'Speak your idea — voice input';
    btn.innerHTML =
      '<span class="pmg-voice-icon" aria-hidden="true">🎤</span>' +
      '<span class="pmg-voice-label">Voice</span>';
    return btn;
  }

  /* The little ▾ caret that opens the language picker. Built with
     the same .pmg-voice-mic base class so visual states (hover,
     focus, dark mode) match the mic without needing duplicated
     CSS. */
  function buildCaret(id) {
    var c = document.createElement('button');
    c.type = 'button';
    c.id = id;
    c.className = 'btn-clear ' + BTN_CLASS + ' ' + CARET_CLASS;
    c.setAttribute('aria-haspopup', 'listbox');
    c.setAttribute('aria-expanded', 'false');
    var lang = getActiveLang();
    var lbl = 'Voice input language: ' + getLangLabel(lang) + ' (' + lang + ')';
    c.setAttribute('aria-label', lbl);
    c.title = lbl;
    c.innerHTML = '<span aria-hidden="true">▾</span>';
    return c;
  }

  /* Lazy-built popover state. Exactly one popover exists per page;
     it is re-anchored to whichever caret most recently opened it
     so we don't have to manage a copy per mount. */
  var openPopover = null;       // { el, caret, onDocClick, onKeydown }

  function closePopover() {
    if (!openPopover) return;
    try {
      openPopover.el.setAttribute('hidden', '');
      openPopover.el.parentNode && openPopover.el.parentNode.removeChild(openPopover.el);
    } catch (_) {}
    try { openPopover.caret.setAttribute('aria-expanded', 'false'); } catch (_) {}
    try { document.removeEventListener('mousedown', openPopover.onDocClick, true); } catch (_) {}
    try { document.removeEventListener('keydown', openPopover.onKeydown, true); } catch (_) {}
    openPopover = null;
  }

  function buildPopover(activeCode) {
    var ul = document.createElement('ul');
    ul.className = POPUP_CLASS;
    ul.setAttribute('role', 'listbox');
    ul.setAttribute('aria-label', 'Voice input language');
    for (var i = 0; i < LANG_OPTIONS.length; i++) {
      var opt = LANG_OPTIONS[i];
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-voice-langopt';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-checked', opt.code === activeCode ? 'true' : 'false');
      b.dataset.code = opt.code;
      b.innerHTML =
        '<span class="pmg-voice-langname"></span>' +
        '<span class="pmg-voice-langcode"></span>';
      b.querySelector('.pmg-voice-langname').textContent = opt.label;
      b.querySelector('.pmg-voice-langcode').textContent = opt.code;
      li.appendChild(b);
      ul.appendChild(li);
    }
    return ul;
  }

  /* Open the picker anchored under the given caret button. The
     popover is appended into the caret's nearest .pmg-voice-group
     wrapper so it positions absolutely without scroll/resize math. */
  function openPickerFor(caret) {
    if (openPopover && openPopover.caret === caret) {
      closePopover();
      return;
    }
    closePopover();
    var group = caret.closest('.' + GROUP_CLASS);
    if (!group) return;

    var activeCode = getActiveLang();
    var ul = buildPopover(activeCode);
    group.appendChild(ul);
    caret.setAttribute('aria-expanded', 'true');

    /* Wire interactions. Outside-click and Escape both close the
       popover. Picking an option saves the selection, refreshes
       all tooltips, and closes. We use mousedown (not click) for
       the outside detector so a click-elsewhere closes before any
       other handlers run on that target. */
    function onOptionClick(e) {
      var btn = e.target && e.target.closest && e.target.closest('.pmg-voice-langopt');
      if (!btn) return;
      var code = btn.dataset.code;
      if (!code) return;
      setStoredLang(code);
      refreshAllTooltips();
      closePopover();
      try { caret.focus(); } catch (_) {}
    }
    function onDocClick(e) {
      if (!openPopover) return;
      var t = e.target;
      if (openPopover.el.contains(t) || openPopover.caret === t || openPopover.caret.contains(t)) return;
      closePopover();
    }
    function onKeydown(e) {
      if (e.key === 'Escape') {
        closePopover();
        try { caret.focus(); } catch (_) {}
      }
    }
    ul.addEventListener('click', onOptionClick);
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKeydown, true);

    openPopover = { el: ul, caret: caret, onDocClick: onDocClick, onKeydown: onKeydown };

    /* Move focus to the active option (or the first one) so
       keyboard users land in a sensible place. */
    try {
      var activeBtn = ul.querySelector('.pmg-voice-langopt[aria-checked="true"]')
                  || ul.querySelector('.pmg-voice-langopt');
      if (activeBtn) activeBtn.focus();
    } catch (_) {}
  }

  /* Mount one mic button (and its language caret) into the
     .field-label-row that wraps the given target textarea. Returns
     the controller (or null if the mount could not be wired —
     e.g. target missing on this page variant, or button already
     mounted). */
  function mountOne(spec) {
    if (document.getElementById(spec.id)) return null;
    var target = document.getElementById(spec.targetId);
    if (!target) return null;
    /* The .field-label-row may be a sibling of the textarea (the
       #goal case: <div class="field"><div class="field-label-row">…
       </div><textarea/></div>) or one level up (the #fine-tune-input
       case: <div class="fine-tune"><div class="field-label-row">…
       </div><div class="fine-tune-row"><textarea/></div></div>).
       Walk up to the closest known wrapper and search inside it so
       both layouts work without page-specific hard-coding. */
    var wrapper = target.closest('.field, .fine-tune') || target.parentNode;
    var row = wrapper && wrapper.querySelector('.field-label-row');
    if (!row) return null;

    injectStyles();

    var btn = buildButton(spec.id);
    btn.setAttribute('aria-label', spec.ariaIdle || 'Start voice input');
    btn.title = idleTitleFor(spec);

    /* Wrap mic + caret in a group so the popover can be anchored
       relative to the caret without affecting the rest of the
       row's layout. */
    var group = document.createElement('span');
    group.className = GROUP_CLASS;
    group.appendChild(btn);

    var caret = null;
    if (getRecognitionCtor()) {
      caret = buildCaret(spec.caretId || (spec.id + '-lang'));
      caret.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openPickerFor(caret);
      });
      group.appendChild(caret);
    }

    /* Insert the group right before the field's Clear button so
       the row reads label | mic+caret | clear. If there is no
       Clear button (a page variant), we just append. */
    var anchor = spec.anchorSelector ? row.querySelector(spec.anchorSelector) : null;
    if (anchor) {
      row.insertBefore(group, anchor);
    } else {
      row.appendChild(group);
    }

    /* Unsupported browsers: render disabled with explanatory
       tooltip rather than hiding silently. The spec allows
       either; visible-but-disabled is more discoverable. The
       caret was already skipped above for unsupported browsers
       since picking a language would have no effect. */
    if (!getRecognitionCtor()) {
      btn.disabled = true;
      btn.title = 'Voice input is not supported in this browser. Try Chrome, Edge, or Safari.';
      btn.setAttribute('aria-label', btn.title);
      registry.push({ btn: btn, caret: null, spec: spec });
      return null;
    }

    var ctrl = createController(btn, target, {
      tooltipIdle: spec.tooltipIdle,
      ariaIdle:    spec.ariaIdle,
      ariaActive:  spec.ariaActive,
      spec:        spec
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      ctrl.toggle();
    });
    registry.push({ btn: btn, caret: caret, spec: spec });
    return ctrl;
  }

  function mount() {
    var controllers = [];
    for (var i = 0; i < MOUNTS.length; i++) {
      var c = mountOne(MOUNTS[i]);
      if (c) controllers.push(c);
    }
    if (!controllers.length) return;

    /* Stop recording when the user navigates/hides the page or
       presses Escape — don't let an in-flight session keep the
       mic warm in the background. Wired once and applied to every
       controller so additional mounts don't need their own
       listeners. Escape also closes any open language popover. */
    function stopAll() {
      for (var i = 0; i < controllers.length; i++) {
        try { if (controllers[i].isOn()) controllers[i].stop(); } catch (_) {}
      }
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopAll(); closePopover(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') stopAll();
    });

    /* Tiny test/inspection surface. Intentionally minimal — exposes
       the storage key plumbing and the option list so e2e tests can
       verify persistence without scraping the DOM. */
    try {
      window.__pmgVoice = {
        STORAGE_KEY: LANG_KEY,
        OPTIONS: LANG_OPTIONS.slice(),
        getLang: getActiveLang,
        setLang: function (code) { setStoredLang(code); refreshAllTooltips(); },
        closePicker: closePopover
      };
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  } catch (err) {
    try { console.warn('[pmg-voice] disabled after error:', err); } catch (_) {}
  }
})();
