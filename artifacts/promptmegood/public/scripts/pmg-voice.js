/* =====================================================================
 * PromptMeGood — Voice input for free-form prompt fields
 *
 * Originally added in Task #65 for the #goal textarea (the brainstorming
 * "Your Goal" field). Task #90 extends it to the post-generate
 * #fine-tune-input box so users can iterate on a draft entirely
 * hands-free. The mounting logic was generalised so additional fields
 * can be wired up by appending to the MOUNTS list — no other changes
 * are required.
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
 *     beats silent hiding.
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

  var STYLE_ID  = 'pmg-voice-style';
  var BTN_CLASS = 'pmg-voice-mic';
  var DOT_CLASS = 'pmg-voice-dot';

  /* Each entry describes one mic mount point. The original Task #65
     mic for #goal keeps its historical id so any external CSS or
     test selector that referenced it continues to work; new mounts
     get their own unique ids. */
  var MOUNTS = [
    {
      id: 'pmg-voice-mic-btn',
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

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var sel = '.' + BTN_CLASS;
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
      '  color: #b91c1c;',
      '  border-color: #b91c1c;',
      '  background: color-mix(in srgb, #b91c1c 8%, transparent);',
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

      /* Pulsing recording dot. Animated by default; swapped for a
         solid colour fade when the user has reduced-motion on. */
      '.' + DOT_CLASS + ' {',
      '  display: inline-block;',
      '  width: 8px; height: 8px; border-radius: 50%;',
      '  background: #b91c1c;',
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

      /* Dark-mode tweak so the dot stays visible. */
      '[data-theme="dark"] ' + sel + '[aria-pressed="true"] {',
      '  color: #fca5a5; border-color: #fca5a5;',
      '  background: color-mix(in srgb, #fca5a5 12%, transparent);',
      '}',
      '[data-theme="dark"] .' + DOT_CLASS + ' {',
      '  background: #fca5a5;',
      '  box-shadow: 0 0 0 0 rgba(252, 165, 165, 0.55);',
      '}',
      '@media (prefers-color-scheme: dark) {',
      '  :root:not([data-theme]) ' + sel + '[aria-pressed="true"] {',
      '    color: #fca5a5; border-color: #fca5a5;',
      '    background: color-mix(in srgb, #fca5a5 12%, transparent);',
      '  }',
      '  :root:not([data-theme]) .' + DOT_CLASS + ' {',
      '    background: #fca5a5;',
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
                     : (opts.tooltipIdle || 'Speak your idea — voice input');
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
      try { rec.lang = (navigator.language || 'en-US'); } catch (_) {}

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

  /* Mount one mic button into the .field-label-row that wraps the
     given target textarea. Returns the controller (or null if the
     mount could not be wired — e.g. target missing on this page
     variant, or button already mounted). */
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
    btn.title = spec.tooltipIdle || 'Speak your idea — voice input';
    /* Insert the mic right before the field's Clear button so the
       row reads label | mic | clear. If there is no Clear button
       (a page variant), we just append. */
    var anchor = spec.anchorSelector ? row.querySelector(spec.anchorSelector) : null;
    if (anchor) {
      row.insertBefore(btn, anchor);
    } else {
      row.appendChild(btn);
    }

    /* Unsupported browsers: render disabled with explanatory
       tooltip rather than hiding silently. The spec allows
       either; visible-but-disabled is more discoverable. */
    if (!getRecognitionCtor()) {
      btn.disabled = true;
      btn.title = 'Voice input is not supported in this browser. Try Chrome, Edge, or Safari.';
      btn.setAttribute('aria-label', btn.title);
      return null;
    }

    var ctrl = createController(btn, target, {
      tooltipIdle: spec.tooltipIdle,
      ariaIdle:    spec.ariaIdle,
      ariaActive:  spec.ariaActive
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      ctrl.toggle();
    });
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
       listeners. */
    function stopAll() {
      for (var i = 0; i < controllers.length; i++) {
        try { if (controllers[i].isOn()) controllers[i].stop(); } catch (_) {}
      }
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') stopAll();
    });
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
