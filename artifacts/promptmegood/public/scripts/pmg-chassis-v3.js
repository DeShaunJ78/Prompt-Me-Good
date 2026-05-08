/* PromptMeGood — Chassis v3 bootstrap
   Implements the "Definitive Redesign Command" PDF.
   Default ON. Opt out with ?chassis=off (raw legacy). Chassis v2 was
   removed in cv3-22 cleanup pass.
   Reparents existing #goal, #settingsPanel, #generateBtn, #resultBox, #strength-score,
   #aiResponseSection into the new shell so all existing JS handlers keep working untouched.
*/
(function () {
  'use strict';

  var V3_CLASS = 'pmg-chassis-v3';
  var qs = new URLSearchParams(window.location.search);
  var modeOverride = qs.get('chassis');

  if (modeOverride === 'off') {
    return;
  }

  document.documentElement.classList.add(V3_CLASS);
  window.__pmgChassisV3Active = true;

  var rootEl = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    if (document.getElementById('pmg-chassis-v3-root')) return;
    rootEl = buildShell();
    document.body.appendChild(rootEl);
    reparent();
    // Kill stray clones that pmg-ux.js injects (generateBtnTop in particular)
    var killTicks = 0;
    var killClones = setInterval(function () {
      killTicks++;
      if (killTicks > 30) { clearInterval(killClones); return; }
      var clones = document.querySelectorAll('#generateBtnTop, .pmg-t100-top-cta-row, [id^="generateBtnTop"]');
      clones.forEach(function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
    }, 200);
    // Force-hide collapsible sections + the generate button itself via inline style
    // (beats any CSS conflict and any legacy script that may unhide the section).
    ['tuning-panel', 'generate-section', 'prompt-output-box', 'ai-response-box'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    var genBtnHide = document.getElementById('generateBtn');
    if (genBtnHide) genBtnHide.style.setProperty('display', 'none', 'important');
    var settingsHide = document.getElementById('settingsPanel');
    if (settingsHide) settingsHide.style.setProperty('display', 'none', 'important');
    wireActions();
    wirePersistence();
    deleteTargets();
    // Re-apply the hide on a short tick in case any late legacy script flips display
    var hideTicks = 0;
    var hideTick = setInterval(function () {
      hideTicks++;
      if (hideTicks > 20) { clearInterval(hideTick); return; }
      if (document.body.classList.contains('pmgv3-analyzed')) { clearInterval(hideTick); return; }
      var gb = document.getElementById('generateBtn');
      if (gb) gb.style.setProperty('display', 'none', 'important');
      var gs = document.getElementById('generate-section');
      if (gs) gs.style.setProperty('display', 'none', 'important');
      var sp = document.getElementById('settingsPanel');
      if (sp) sp.style.setProperty('display', 'none', 'important');
      var tp = document.getElementById('tuning-panel');
      if (tp) tp.style.setProperty('display', 'none', 'important');
    }, 200);
  }

  function buildShell() {
    var root = document.createElement('div');
    root.id = 'pmg-chassis-v3-root';
    root.innerHTML = [
      '<header class="pmgv3-topbar">',
        '<button type="button" class="pmgv3-brand" id="pmgv3-brand-home" title="Return to home — clears the current tab" aria-label="Return to home">',
          '<img src="/assets/pmg-logo.png?v=6" alt="PromptMeGood" />',
          '<span>PromptMeGood</span>',
          '<span class="pmgv3-brand-beta">Beta</span>',
        '</button>',
        '<div class="pmgv3-tb-r">',
          '<a class="pmgv3-ico" id="pmgv3-help" href="/guide.html" target="_blank" rel="noopener" title="Quick Guide — opens in a new tab" aria-label="Open the PromptMeGood quick guide in a new tab">❓</a>',
          '<button class="pmgv3-ico" id="pmgv3-vault" type="button" title="Vault" aria-label="Vault">🗄️</button>',
          '<button class="pmgv3-ico" id="pmgv3-settings" type="button" title="Settings" aria-label="Settings">⚙️</button>',
          '<button class="pmgv3-upgrade" type="button" id="pmgv3-upgrade" title="See pricing — $79 one-time Founding Member (first 500, lifetime access) or Pro $9/mo">Upgrade</button>',
        '</div>',
      '</header>',
      '<nav class="pmgv3-tabs" role="tablist" aria-label="Module">',
        '<button class="pmgv3-tab is-active" data-module="text" role="tab" aria-selected="true" type="button">✍️ Text Prompts</button>',
        '<button class="pmgv3-tab" data-module="photography" role="tab" aria-selected="false" type="button">📸 Photography</button>',
        '<button class="pmgv3-tab" data-module="video" role="tab" aria-selected="false" type="button">🎬 Video</button>',
      '</nav>',
      '<div class="pmgv3-body" data-active-panel="text">',
        '<div class="pmgv3-panel" id="pmgv3-panel-text">',
        '<div class="pmgv3-left">',
          '<section class="idea-section">',
            '<label class="pmgv3-section-label" for="goal">Your Idea</label>',
            '<p class="pmgv3-section-hint">Describe what you want to create. Be as brief or detailed as you like.</p>',
            '<div class="pmgv3-idea-host">',
              /* cv3-48 fix: clear ✕ MUST live inside .pmgv3-idea-host (the
                 positioned ancestor) so its absolute placement anchors to
                 the goal field, not to the chassis root. */
              '<button type="button" id="pmgv3-goal-clear" class="pmgv3-goal-clear" title="Clear" aria-label="Clear what you typed" hidden>✕</button>',
            '</div>',
          '<button id="analyze-btn" class="btn-analyze" type="button">→ Analyze My Idea</button>',
          '</section>',
          '<section class="tuning-section is-collapsed" id="tuning-panel" style="display:none !important">',
            '<button type="button" class="tuning-header" id="tuning-mobile-toggle" aria-expanded="false" aria-controls="settingsPanel">',
              '<span class="tuning-header-row">',
                '<span class="tuning-title">🎛️ Tune Your Prompt</span>',
                '<span class="tuning-pick-count" id="tuning-pick-count" aria-hidden="true"></span>',
                '<span class="tuning-chevron" aria-hidden="true">▾</span>',
              '</span>',
              '<span class="tuning-hint">We\'ve pre-selected settings based on your idea. Adjust if needed.</span>',
            '</button>',
            '<div class="pmgv3-tuning-host"></div>',
          '</section>',
          '<section class="generate-section is-collapsed" id="generate-section" style="display:none !important">',
            '<div class="generate-divider"></div>',
            '<div class="pmgv3-generate-host"></div>',
          '</section>',
        '</div>',
        '<div class="pmgv3-right">',
          '<div class="pmgv3-right-placeholder" id="pmgv3-right-placeholder" aria-hidden="true">',
            '<div class="pmgv3-rp-icon" aria-hidden="true">✨</div>',
            '<div class="pmgv3-rp-title">Your Optimized Prompt Will Appear Here</div>',
            '<div class="pmgv3-rp-sub">Type your goal below or choose a template to generate your first prompt.</div>',
            '<ul class="pmgv3-rp-bullets">',
              '<li><span aria-hidden="true">①</span> Tell us what you want to create</li>',
              '<li><span aria-hidden="true">②</span> Tune the auto-picked settings</li>',
              '<li><span aria-hidden="true">③</span> Generate a strong, ready-to-run prompt</li>',
            '</ul>',
          '</div>',
          '<div class="output-box is-collapsed" id="prompt-output-box" style="display:none !important">',
            '<div class="strength-bar-container" id="pmgv3-strength-slot">',
              '<div class="strength-header">',
                '<span class="strength-label">Prompt Strength</span>',
                '<span class="strength-score" id="strength-score-badge">--</span>',
              '</div>',
              '<div class="strength-track"><div class="strength-fill" id="strength-fill" style="width:0%"></div></div>',
              '<div class="strength-status" id="strength-status">Analyzing…</div>',
            '</div>',
            '<label class="pmgv3-section-label" style="margin-top:12px;">Your Engineered Prompt</label>',
            '<div class="pmgv3-output-host"></div>',
            '<div class="prompt-actions">',
              '<button class="btn-secondary" type="button" id="edit-prompt-btn">✏️ Edit</button>',
              '<button class="btn-secondary" type="button" id="rewrite-btn">🔄 Rewrite</button>',
              '<button class="btn-secondary" type="button" id="save-draft-btn">💾 Save Draft</button>',
            '</div>',
            '<div class="next-step-divider"><span>Happy with your prompt?</span></div>',
            '<button class="btn-run-primary" type="button" id="run-with-ai-btn">▶ Run with AI to see your result</button>',
            '<div class="send-to-row">',
              '<button class="btn-send-to" data-platform="chatgpt" type="button">Send to ChatGPT</button>',
              '<button class="btn-send-to" data-platform="claude" type="button">Send to Claude</button>',
              '<button class="btn-send-to" data-platform="gemini" type="button">Send to Gemini</button>',
            '</div>',
          '</div>',
          '<div class="output-box ai-response-box is-collapsed" id="ai-response-box" style="display:none !important">',
            '<div class="pmgv3-air-host"></div>',
          '</div>',
        '</div>',
        '</div>', // /#pmgv3-panel-text
        '<div class="pmgv3-panel" id="pmgv3-panel-photo">',
          '<div class="pmgv3-left" id="pmgv3-photo-left"></div>',
          '<div class="pmgv3-right" id="pmgv3-photo-right"></div>',
        '</div>',
        '<div class="pmgv3-panel" id="pmgv3-panel-video">',
          '<div class="pmgv3-left" id="pmgv3-video-left"></div>',
          '<div class="pmgv3-right" id="pmgv3-video-right"></div>',
        '</div>',
      '</div>',
      '<footer class="pmgv3-bottom">',
        '<div class="quick-entry-pill">',
          '<span class="quick-entry-icon">✏️</span>',
          '<input type="text" id="quick-entry" placeholder="What do you want to build?" autocomplete="off" />',
          '<button id="quick-entry-submit" class="quick-entry-btn" type="button" aria-label="Send">▲</button>',
        '</div>',
      '</footer>',
    ].join('');
    return root;
  }

  function reparent() {
    // 0. Move #prompt-form to a stable body-level location so its submit
    //    listener (bound at app.html ~L8843) stays reachable after we
    //    reparent the form's input children into the v3 shell. Form is
    //    kept display:none — the visible inputs live inside v3 slots and
    //    submit via the [form="prompt-form"] HTML5 attribute association.
    var rescueForm = document.getElementById('prompt-form');
    if (rescueForm && rescueForm.parentNode !== document.body) {
      document.body.appendChild(rescueForm);
      rescueForm.style.setProperty('display', 'none', 'important');
      rescueForm.setAttribute('data-pmgv3-rescued', '1');
    }

    // 1. Move #goal field into idea host
    var goalEl = document.getElementById('goal');
    if (goalEl) {
      var goalField = goalEl.closest('.field') || goalEl;
      var ideaHost = rootEl.querySelector('.pmgv3-idea-host');
      if (ideaHost && goalField.parentNode !== ideaHost) {
        ideaHost.appendChild(goalField);
      }
    }

    // 2. Move #settingsPanel into tuning host
    var settings = document.getElementById('settingsPanel');
    if (settings) {
      var tuningHost = rootEl.querySelector('.pmgv3-tuning-host');
      if (tuningHost && settings.parentNode !== tuningHost) {
        tuningHost.appendChild(settings);
      }
      settings.style.setProperty('display', 'none', 'important');
      settings.setAttribute('data-pmgv3-collapsed', '1');
    }

    // 3. Move #generateBtn into generate-section. Keep it inside #prompt-form for submit semantics
    //    by ALSO moving #prompt-form into the body so the button stays a form submit child.
    var form = document.getElementById('prompt-form');
    var genBtn = document.getElementById('generateBtn');
    if (genBtn && form) {
      // Move form to a hidden container so the form remains the parent of relocated children.
      // The actual children (idea field, settings, generate button) are now physically nested
      // inside our shell, but the form element wraps them via DOM ancestry through host slots.
      // Simpler: move generateBtn into generate host; rely on form-attribute to keep submit.
      genBtn.setAttribute('form', 'prompt-form');
      genBtn.textContent = '✨ Done Tuning — Generate My Prompt';
      var genHost = rootEl.querySelector('.pmgv3-generate-host');
      if (genHost && genBtn.parentNode !== genHost) {
        genHost.appendChild(genBtn);
      }
      // Hard-hide the button itself; analyze click will un-hide.
      genBtn.style.setProperty('display', 'none', 'important');
      genBtn.setAttribute('data-pmgv3-collapsed', '1');
      // Same for #goal so submit on Enter still works
      if (goalEl) goalEl.setAttribute('form', 'prompt-form');
      // Ensure the form element still exists somewhere in the DOM so 'form' attribute resolves.
      if (form && !document.body.contains(form)) {
        document.body.appendChild(form);
        form.style.display = 'none';
      }
    }

    // 4. Move #resultBox into prompt output host
    var resultBox = document.getElementById('resultBox');
    if (resultBox) {
      var outHost = rootEl.querySelector('.pmgv3-output-host');
      if (outHost && resultBox.parentNode !== outHost) {
        outHost.appendChild(resultBox);
      }
      // Spec uses #output as the textarea ID; provide an alias getter on the global so
      // any spec-conformant code that tries document.getElementById('output') succeeds.
      if (!document.getElementById('output')) {
        try {
          // Add an attribute so it can also be reached via [data-spec-id]
          resultBox.setAttribute('data-spec-id', 'output');
        } catch (e) {}
      }
    }

    // 5. Move #strength-score into strength slot (replacing default markup)
    var legacyStrength = document.getElementById('strength-score');
    var strengthSlot = rootEl.querySelector('#pmgv3-strength-slot');
    if (legacyStrength && strengthSlot) {
      // Append legacy node alongside the spec markup so existing fill/pct updates still work
      legacyStrength.classList.add('pmgv3-relocated');
      legacyStrength.removeAttribute('hidden');
      strengthSlot.appendChild(legacyStrength);
    }

    // 6. Move #aiResponseSection into Box 2 host
    var air = document.getElementById('aiResponseSection');
    if (air) {
      var airHost = rootEl.querySelector('.pmgv3-air-host');
      if (airHost && air.parentNode !== airHost) {
        airHost.appendChild(air);
      }
      air.removeAttribute('hidden');
    }
  }

  /* cv3-49 — Session persistence. Mobile Safari aggressively unloads
     backgrounded tabs to free memory, so when a user taps "Send to
     Gemini/ChatGPT" and then returns to PromptMeGood, the page reloads
     fresh and the user's idea + tuning + generated prompt are gone.
     This is a critical UX failure — losing work mid-task is one of
     the fastest ways to lose a user. We persist the live session to
     localStorage on every change and restore it on boot.

     Storage:
       pmgv3:session = { goal, tuning:{id:value}, prompt, ts }
     TTL: 7 days. Disable hatches: ?fresh=1 in URL,
     localStorage.pmgv3_persist_disable='1'. */
  var SESSION_KEY = 'pmgv3:session';
  var SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
  var _persistTimer = null;
  var _persistSuspended = false;
  function persistDisabled() {
    try {
      if (/[?&]fresh\b/.test(window.location.search || '')) return true;
      if (localStorage.getItem('pmgv3_persist_disable') === '1') return true;
    } catch (e) {}
    return false;
  }
  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.ts && (Date.now() - parsed.ts) > SESSION_TTL_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }
  function writeSession() {
    if (persistDisabled() || _persistSuspended) return;
    try {
      var goal = document.getElementById('goal');
      var rb = document.getElementById('resultBox');
      var tuning = {};
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (sel && sel.value) tuning[id] = sel.value;
      });
      var promptText = (rb && rb.textContent || '').trim();
      if (promptText === 'Your fixed prompt will appear here.') promptText = '';
      var data = {
        goal: goal ? goal.value : '',
        tuning: tuning,
        prompt: promptText,
        ts: Date.now()
      };
      // Skip writes when there's no real user content. Tuning selects
      // ALWAYS have a default value (e.g. "other"/"beginner") so we
      // can't gate on tuning emptiness — only goal+prompt count as
      // signal. Without this, pagehide on a cleared page re-persists
      // a junk session right after Start Over.
      if (!data.goal && !data.prompt) return;
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function schedulePersist() {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(writeSession, 400);
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  // Expose for doStartOver / external callers.
  window.pmgChassisV3 = window.pmgChassisV3 || {};
  window.pmgChassisV3.clearSession = clearSession;
  window.pmgChassisV3.saveSession = writeSession;

  function wirePersistence() {
    if (persistDisabled()) return;
    // 1. Restore on boot (if any). Run after wireActions has bound handlers
    //    so dispatched 'change' events refresh the pill UI.
    var snap = readSession();
    if (snap) restoreSession(snap);
    // 2. Save on user input — debounced.
    var goal = document.getElementById('goal');
    if (goal) goal.addEventListener('input', schedulePersist);
    TUNE_FIELDS.forEach(function (id) {
      var sel = document.getElementById(id);
      if (sel) sel.addEventListener('change', schedulePersist);
    });
    // 3. Save when the result text changes — #resultBox is updated
    //    by the legacy form-submit handler so we observe it.
    var rb = document.getElementById('resultBox');
    if (rb && typeof MutationObserver !== 'undefined') {
      try {
        var mo = new MutationObserver(schedulePersist);
        mo.observe(rb, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
    }
    // 4. Belt-and-braces: save on visibility change (user is about to
    //    leave the tab — e.g. tapping "Send to Gemini").
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') writeSession();
    });
    window.addEventListener('pagehide', writeSession);
    window.addEventListener('beforeunload', writeSession);
  }

  function restoreSession(snap) {
    try {
      var goal = document.getElementById('goal');
      if (goal && snap.goal) {
        goal.value = snap.goal;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (snap.tuning) {
        TUNE_FIELDS.forEach(function (id) {
          var sel = document.getElementById(id);
          if (!sel) return;
          var v = snap.tuning[id];
          if (typeof v !== 'string') return;
          var ok = false;
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === v) { ok = true; break; }
          }
          if (!ok) return;
          sel.value = v;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        });
      }
      if (snap.prompt) {
        var rb = document.getElementById('resultBox');
        if (rb) {
          rb.textContent = snap.prompt;
          // Reveal the result box + Run-with-AI button using the same
          // sequence the Generate handler uses, so the restored prompt
          // is visible immediately on reload.
          var box = document.getElementById('prompt-output-box');
          if (box) {
            box.classList.remove('is-collapsed');
            box.removeAttribute('hidden');
            box.style.setProperty('display', 'block', 'important');
          }
          var rwa = document.getElementById('run-with-ai-btn');
          if (rwa) {
            rwa.style.setProperty('display', 'block', 'important');
            rwa.removeAttribute('hidden');
          }
          document.body.classList.add('pmg-has-result');
        }
      }
      // If there was a goal OR prompt, reveal the post-analyze surface
      // so the user lands back where they left off.
      if (snap.goal || snap.prompt) {
        var t = document.getElementById('tuning-panel');
        var g = document.getElementById('generate-section');
        if (t) { t.classList.remove('is-collapsed'); t.removeAttribute('hidden'); t.style.removeProperty('display'); }
        if (g) { g.classList.remove('is-collapsed'); g.removeAttribute('hidden'); g.style.removeProperty('display'); }
        var aBtn = document.getElementById('analyze-btn');
        if (aBtn) aBtn.style.display = 'none';
        document.body.classList.add('pmgv3-analyzed');
      }
    } catch (e) {}
  }

  function wireActions() {
    // Analyze: reveal tuning + generate
    var analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', function () {
        var t = document.getElementById('tuning-panel');
        var g = document.getElementById('generate-section');
        document.body.classList.add('pmgv3-analyzed');
        if (t) {
          t.classList.remove('is-collapsed');
          t.removeAttribute('hidden');
          t.style.removeProperty('display');
          /* cv3-47: tuning accordion always starts COLLAPSED after Analyze
             — on desktop AND mobile. The "AI tuned N picks" badge in the
             header tells the user the AI made selections; they don't have
             to see them to proceed. They can expand by clicking the
             header. This eliminates the "two equally prominent green
             buttons" problem on first-time analysis. */
          t.classList.remove('is-mobile-open');
          /* cv3-47: keep ARIA state synchronized in case the user
             expanded the accordion on a previous analysis pass. */
          var ariaToggle = document.getElementById('tuning-mobile-toggle');
          if (ariaToggle) ariaToggle.setAttribute('aria-expanded', 'false');
        }
        if (g) { g.classList.remove('is-collapsed'); g.removeAttribute('hidden'); g.style.removeProperty('display'); }
        var gbShow = document.getElementById('generateBtn');
        if (gbShow) { gbShow.style.removeProperty('display'); gbShow.removeAttribute('data-pmgv3-collapsed'); }
        var spShow = document.getElementById('settingsPanel');
        if (spShow) { spShow.style.removeProperty('display'); spShow.removeAttribute('data-pmgv3-collapsed'); }
        /* cv3-47: replace the loud "→ Analyze My Idea" button with a
           tiny low-contrast "← Re-analyze" text link. Power users can
           still re-run analysis; the green Generate button below is now
           the only prominent CTA on screen. Idempotent — second click
           on the link no-ops the injection. */
        try {
          if (analyzeBtn.style.display !== 'none') {
            analyzeBtn.style.display = 'none';
          }
          if (!document.getElementById('pmgv3-reanalyze')) {
            var link = document.createElement('button');
            link.type = 'button';
            link.id = 'pmgv3-reanalyze';
            link.className = 'pmgv3-reanalyze';
            link.textContent = '← Re-analyze';
            link.addEventListener('click', function () { analyzeBtn.click(); });
            analyzeBtn.parentNode.insertBefore(link, analyzeBtn.nextSibling);
          }
        } catch (e) {}
        /* cv3-47: subtle "Ready" label above the Generate button so the
           user understands the analysis step has completed and Generate
           is the next action. Inserted once. */
        try {
          if (g && !document.getElementById('pmgv3-ready-label')) {
            var ready = document.createElement('div');
            ready.id = 'pmgv3-ready-label';
            ready.className = 'pmgv3-ready-label';
            ready.textContent = '✓ Ready — your settings are tuned';
            g.insertBefore(ready, g.firstChild);
          }
        } catch (e) {}
        // Trigger existing auto-optimize logic if available so pills pre-fill
        try {
          var autoOpt = document.getElementById('auto-optimize-toggle');
          if (autoOpt && !autoOpt.checked) autoOpt.click();
        } catch (e) {}
        try {
          if (window.pmgAutoOptimize && typeof window.pmgAutoOptimize === 'function') {
            window.pmgAutoOptimize();
          }
        } catch (e) {}
        // cv3-30 audit 2.1: AI auto-picks tuning defaults so the user can hit
        // Generate immediately. Calls /api/auto-tune with the idea text and
        // sets each <select>.value + dispatches change so the existing pill
        // sync repaints. Falls back silently on error — user can still tune
        // manually. Disable hatches: ?noautotune or localStorage.pmg_autotune_disable.
        try { autoTuneFromIdea(); } catch (e) {}
        /* cv3-47: scroll to the Generate section, not the tuning section.
           Generate is the next action; the collapsed tuning header is
           visible just above it. */
        if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // Generate (legacy submit): explicitly fire form submit since form-attribute
    // association across reparented DOM is unreliable, then reveal Box 1.
    var genBtn = document.getElementById('generateBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function (e) {
        // Prevent native form-attribute submission — we explicitly call
        // form.requestSubmit() below. Without this, browsers honoring the
        // [form="prompt-form"] association would fire submit twice (one
        // native, one from requestSubmit), causing duplicate API calls.
        e.preventDefault();
        // Reveal Box 1 immediately so the user sees feedback. The box
        // is rendered with inline `style="display:none !important"` so
        // we force-override with setProperty('display','block','important')
        // — clearing the property string-style is unreliable across
        // browsers when !important was set inline.
        var box = document.getElementById('prompt-output-box');
        if (box) {
          box.classList.remove('is-collapsed');
          box.removeAttribute('hidden');
          box.style.setProperty('display', 'block', 'important');
        }
        // Belt-and-braces: explicitly unhide the Run with AI button.
        // Some legacy scripts have been seen leaving display:none on it.
        var rwa = document.getElementById('run-with-ai-btn');
        if (rwa) {
          rwa.style.setProperty('display', 'block', 'important');
          rwa.removeAttribute('hidden');
        }
        // Explicitly fire submit on #prompt-form. The button was reparented out
        // of the form so HTML5 form-attribute association is unreliable; the
        // form itself lives in body (moved by reparent() step 0) so its
        // submit listener (app.html ~L8843) is still bound. requestSubmit()
        // dispatches the submit event and the legacy handler runs as normal.
        var form = document.getElementById('prompt-form');
        if (form && typeof form.requestSubmit === 'function') {
          try { form.requestSubmit(); }
          catch (err) { try { form.submit(); } catch (e2) {} }
        } else if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        setTimeout(mirrorStrength, 350);
      });
    }
    // cv3-30 audit 2.1 helper: ask the server to pick the best tuning defaults
    // for this idea and apply them. No-op if the user disabled it via
    // ?noautotune or localStorage.pmg_autotune_disable='1', or if the idea is
    // too short to be meaningful.
    function autoTuneFromIdea() {
      try {
        var loc = (window.location && window.location.search) || '';
        if (/[?&]noautotune\b/.test(loc)) return;
        if (localStorage.getItem('pmg_autotune_disable') === '1') return;
      } catch (e) {}
      var goal = document.getElementById('goal');
      var idea = goal && goal.value ? String(goal.value).trim() : '';
      if (idea.length < 4) return;
      var statusBadge = document.getElementById('tuning-pick-count');
      var prevText = statusBadge ? statusBadge.textContent : '';
      if (statusBadge) {
        statusBadge.textContent = 'AI tuning…';
        statusBadge.style.background = 'rgba(0, 200, 150, 0.2)';
      }
      /* cv3-48: snapshot the user's pre-analyze tuning state so we can
         offer a "↺ Revert to my selections" link if the AI overwrites
         picks. Only render the link when at least one field actually
         changed AND the user had at least one non-default selection
         before analyze (otherwise there's nothing meaningful to undo). */
      var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
      var snapshot = {};
      var hadManualSelection = false;
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        snapshot[id] = sel.value;
        if (sel.value && sel.selectedIndex > 0) hadManualSelection = true;
      });
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timeoutId = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
      fetch('/api/auto-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: idea }),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.ok || !data.picks) return;
          var picks = data.picks;
          var anyChanged = false;
          TUNE_FIELDS.forEach(function (id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            var v = picks[id];
            if (typeof v !== 'string') return;
            // Verify the value exists as an <option> before assigning so we
            // don't silently set an invalid select state.
            var ok = false;
            for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].value === v) { ok = true; break; }
            }
            if (!ok) return;
            if (sel.value === v) return;
            sel.value = v;
            anyChanged = true;
            try { sel.dispatchEvent(new Event('change', { bubbles: true })); }
            catch (err) {
              var evt = document.createEvent('HTMLEvents');
              evt.initEvent('change', true, false);
              sel.dispatchEvent(evt);
            }
          });
          if (anyChanged && hadManualSelection) {
            try { mountRevertTuningLink(snapshot); } catch (e) {}
          }
        })
        .catch(function () {
          // Silent fail — user can still tune manually.
        })
        .then(function () {
          clearTimeout(timeoutId);
          if (statusBadge) {
            statusBadge.style.removeProperty('background');
            statusBadge.textContent = prevText || '';
          }
        });
    }

    /* cv3-48 — Reset & Navigation suite: Clear / Undo / Start Over / Home.
       Spec: "PromptMeGood: Navigation & Reset Specification" (May 8, 2026).
       Each function is independent and idempotent; safe to call repeatedly. */
    function mountRevertTuningLink(snap) {
      var hdr = document.getElementById('tuning-mobile-toggle');
      if (!hdr) return;
      var existing = document.getElementById('pmgv3-revert-tuning');
      if (existing) existing.remove();
      var link = document.createElement('button');
      link.type = 'button';
      link.id = 'pmgv3-revert-tuning';
      link.className = 'pmgv3-revert-tuning';
      link.textContent = '↺ Revert to my selections';
      link.title = 'Restore the tuning you had selected before Analyze';
      link.addEventListener('click', function (ev) {
        // Header is a button — stop the click from bubbling and toggling
        // the accordion open/close.
        ev.stopPropagation();
        ev.preventDefault();
        Object.keys(snap).forEach(function (id) {
          var sel = document.getElementById(id);
          if (!sel) return;
          if (sel.value === snap[id]) return;
          sel.value = snap[id];
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); }
          catch (err) {
            var evt = document.createEvent('HTMLEvents');
            evt.initEvent('change', true, false);
            sel.dispatchEvent(evt);
          }
        });
        link.remove();
      });
      // Insert AFTER the header button so it sits inside the tuning section
      // but doesn't get swallowed by the header's click target.
      hdr.parentNode.insertBefore(link, hdr.nextSibling);
    }

    function doStartOver() {
      // cv3-49: drop the persisted session AND suspend the persistence
      // layer for ~700ms so the cascade of input/change events fired by
      // the reset below doesn't immediately re-write a half-empty
      // session (default-tuning-but-no-goal) back into localStorage.
      _persistSuspended = true;
      try { clearSession(); } catch (e) {}
      setTimeout(function () {
        _persistSuspended = false;
        // Final clear in case anything slipped through.
        try { clearSession(); } catch (e) {}
      }, 700);
      // 1. Clear the goal textarea
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = '';
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // 2. Reset all tuning selects to their default (first option) and
      //    notify listeners so the pill UI repaints.
      var TUNE_FIELDS = ['category', 'skillLevel', 'tone', 'outputFormat', 'maxLength', 'outputLanguage', 'personality'];
      TUNE_FIELDS.forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        if (sel.options && sel.options.length) {
          sel.selectedIndex = 0;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      });
      // 3. Hide result panel + AI response
      document.body.classList.remove('pmg-has-result', 'pmgv3-analyzed');
      var box = document.getElementById('prompt-output-box');
      if (box) {
        box.classList.add('is-collapsed');
        box.style.setProperty('display', 'none', 'important');
      }
      var air = document.getElementById('aiResponseSection');
      if (air) {
        air.setAttribute('hidden', '');
        air.style.setProperty('display', 'none', 'important');
      }
      /* cv3-48 fix: also collapse the v3 wrapper for the AI response
         (#ai-response-box). #aiResponseSection is the legacy node; the
         wrapper is what's actually visible after Run with AI. Without
         this Start Over leaves an empty mint-bordered box on screen. */
      var airBox = document.getElementById('ai-response-box');
      if (airBox) {
        airBox.classList.add('is-collapsed');
        airBox.setAttribute('hidden', '');
        airBox.style.setProperty('display', 'none', 'important');
      }
      // 4. Hide tuning + generate sections
      ['tuning-panel', 'generate-section'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('is-collapsed');
        el.classList.remove('is-mobile-open');
        el.style.setProperty('display', 'none', 'important');
      });
      // 5. Restore Analyze button + drop the post-analyze adornments
      var aBtn = document.getElementById('analyze-btn');
      if (aBtn) aBtn.style.removeProperty('display');
      var rl = document.getElementById('pmgv3-reanalyze'); if (rl) rl.remove();
      var rdy = document.getElementById('pmgv3-ready-label'); if (rdy) rdy.remove();
      var rev = document.getElementById('pmgv3-revert-tuning'); if (rev) rev.remove();
      // 6. Scroll to the top of the form
      try {
        var form = document.querySelector('.idea-section') || document.body;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_e) {}
      }
      if (goal) { try { goal.focus(); } catch (e) {} }
    }
    // Expose so other scripts (or the home-button handler) can call it.
    window.pmgChassisV3 = window.pmgChassisV3 || {};
    window.pmgChassisV3.startOver = doStartOver;

    function mountStartOverLinks() {
      // (a) Below the Generate button, inside #generate-section.
      var gen = document.getElementById('generate-section');
      if (gen && !document.getElementById('pmgv3-startover-generate')) {
        var l1 = document.createElement('button');
        l1.type = 'button';
        l1.id = 'pmgv3-startover-generate';
        l1.className = 'pmgv3-startover';
        l1.textContent = '↩ Start Over';
        l1.addEventListener('click', doStartOver);
        gen.appendChild(l1);
      }
      // (b) At the bottom of the result panel.
      var box = document.getElementById('prompt-output-box');
      if (box && !document.getElementById('pmgv3-startover-result')) {
        var l2 = document.createElement('button');
        l2.type = 'button';
        l2.id = 'pmgv3-startover-result';
        l2.className = 'pmgv3-startover pmgv3-startover-result';
        l2.textContent = '↩ Start Over — build a new prompt';
        l2.addEventListener('click', doStartOver);
        box.appendChild(l2);
      }
    }
    mountStartOverLinks();

    // Goal-textarea ✕ (Clear) — only visible when the field has content.
    function wireGoalClear() {
      var clr = document.getElementById('pmgv3-goal-clear');
      var goal = document.getElementById('goal');
      if (!clr || !goal) return;
      function sync() {
        var hasText = goal.value && goal.value.length > 0;
        if (hasText) clr.removeAttribute('hidden');
        else clr.setAttribute('hidden', '');
      }
      sync();
      goal.addEventListener('input', sync);
      clr.addEventListener('click', function () {
        goal.value = '';
        goal.dispatchEvent(new Event('input', { bubbles: true }));
        try { goal.focus(); } catch (e) {}
        sync();
      });
    }
    // Reparent runs after buildShell, so #goal lives inside .pmgv3-idea-host
    // by the time wireActions fires. Poll briefly in case timing slips.
    (function pollGoalClear(n) {
      if (n > 30) return;
      if (document.getElementById('goal') && document.getElementById('pmgv3-goal-clear')) {
        wireGoalClear();
      } else {
        setTimeout(function () { pollGoalClear(n + 1); }, 200);
      }
    })(0);

    // Logo → Home: hard reset. Closes overlays, switches to Text tab, then
    // runs Start Over.
    var brandHome = document.getElementById('pmgv3-brand-home');
    if (brandHome) {
      brandHome.addEventListener('click', function () {
        // Close vault drawer if open
        try {
          var vd = document.getElementById('pmgv3-vault-drawer');
          var vo = document.getElementById('pmgv3-vault-overlay');
          if (vd) vd.classList.remove('is-open');
          if (vo) { vo.classList.remove('is-open'); vo.style.setProperty('display', 'none', 'important'); }
        } catch (e) {}
        // Close Expert Command Center if open
        try {
          if (window.PMGExpertCenter && typeof window.PMGExpertCenter.close === 'function') {
            window.PMGExpertCenter.close();
          }
        } catch (e) {}
        // Close any storyboard / body-appended overlays
        try {
          var ovs = document.querySelectorAll('[data-pmg-overlay-root].is-open, [data-pmg-overlay-root][style*="display: flex"], [data-pmg-overlay-root][style*="display:flex"]');
          Array.prototype.forEach.call(ovs, function (o) {
            o.classList.remove('is-open');
            o.style.setProperty('display', 'none', 'important');
          });
        } catch (e) {}
        // Back to Text tab
        try { setActivePanel('text'); } catch (e) {}
        // Hard reset the active tab
        doStartOver();
      });
    }

    // cv3-30 audit 3.1: mobile accordion toggle for the text-panel tuning
    // section. Tap the header → expand/collapse #settingsPanel. Desktop
    // ignores the click handler effect because CSS doesn't gate visibility
    // on .is-mobile-open above 768px.
    var tuneToggle = document.getElementById('tuning-mobile-toggle');
    if (tuneToggle) {
      tuneToggle.addEventListener('click', function (e) {
        var sec = document.getElementById('tuning-panel');
        if (!sec) return;
        var open = sec.classList.toggle('is-mobile-open');
        tuneToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          // Smooth-scroll the now-expanded grid into view on mobile so the
          // user doesn't lose visual context.
          try {
            var sp = document.getElementById('settingsPanel');
            if (sp && sp.scrollIntoView) {
              setTimeout(function () { sp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
            }
          } catch (err) {}
        }
      });
    }
    // Live pick-count badge so the collapsed header still tells the user
    // how many tuning choices are active.
    function updatePickCount() {
      var badge = document.getElementById('tuning-pick-count');
      if (!badge) return;
      var sp = document.getElementById('settingsPanel');
      if (!sp) { badge.textContent = ''; return; }
      var n = sp.querySelectorAll('.pmg-tune-pill.is-active, .pmg-pill.is-active').length;
      badge.textContent = n > 0 ? (n + ' pick' + (n === 1 ? '' : 's')) : '';
    }
    setInterval(updatePickCount, 1200);

    // Mirror strength on a polling tick so it stays current
    setInterval(mirrorStrength, 1500);

    // Re-assert generate button label on a tick — other scripts may overwrite text
    var GEN_LABEL = '✨ Generate My Prompt';
    setInterval(function () {
      var b = document.getElementById('generateBtn');
      if (b && rootEl.contains(b) && b.textContent.trim() !== GEN_LABEL) {
        b.textContent = GEN_LABEL;
      }
    }, 800);

    // Run with AI: reveal Box 2 + delegate to legacy #runBtn
    var runBtn = document.getElementById('run-with-ai-btn');
    if (runBtn) {
      runBtn.addEventListener('click', function () {
        var box = document.getElementById('ai-response-box');
        if (box) { box.classList.remove('is-collapsed'); box.removeAttribute('hidden'); box.style.display = ''; }
        var legacyRun = document.getElementById('runBtn');
        if (legacyRun) {
          legacyRun.click();
        } else if (typeof window.runWithAI === 'function') {
          window.runWithAI();
        }
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Edit / Rewrite / Save Draft — wire to existing handlers if present
    bindIfPresent('edit-prompt-btn', function () {
      var rb = document.getElementById('resultBox');
      if (rb) { rb.focus(); document.execCommand && document.execCommand('selectAll', false, null); }
    });
    bindIfPresent('rewrite-btn', function () {
      // Re-submit the form
      var f = document.getElementById('prompt-form');
      if (f) {
        if (typeof f.requestSubmit === 'function') f.requestSubmit();
        else f.submit();
      }
    });
    bindIfPresent('save-draft-btn', function () {
      // Best-effort: try common existing save handlers
      var existing = document.querySelector('#save-vault-btn, #pmg-save-vault-btn, #savePromptBtn, [data-pmg-save-vault]');
      if (existing) existing.click();
      else {
        try {
          var rb = document.getElementById('resultBox');
          var draft = (rb && rb.textContent || '').trim();
          if (draft) {
            localStorage.setItem('pmgv3:lastDraft', JSON.stringify({ text: draft, savedAt: Date.now() }));
            flash('Draft saved locally');
          }
        } catch (e) {}
      }
    });

    // Send-to-platform buttons (Step 5A)
    var sendBtns = rootEl.querySelectorAll('.btn-send-to');
    Array.prototype.forEach.call(sendBtns, function (btn) {
      btn.addEventListener('click', function () {
        var rb = document.getElementById('resultBox');
        var prompt = (rb && rb.textContent || '').trim();
        if (!prompt || prompt === 'Your fixed prompt will appear here.') {
          flash('Generate a prompt first.');
          return;
        }
        var encoded = encodeURIComponent(prompt);
        var urls = {
          chatgpt: 'https://chatgpt.com/?q=' + encoded,
          claude: 'https://claude.ai/new?q=' + encoded,
          gemini: 'https://gemini.google.com/app?q=' + encoded,
        };
        var platform = btn.dataset.platform;
        try { navigator.clipboard.writeText(prompt); } catch (e) {}
        if (urls[platform]) window.open(urls[platform], '_blank', 'noopener');
      });
    });

    // Quick entry → mirror into #goal then trigger Analyze
    var qe = document.getElementById('quick-entry');
    var qsub = document.getElementById('quick-entry-submit');
    function submitQuick() {
      if (!qe) return;
      var val = qe.value.trim();
      if (!val) return;
      var goal = document.getElementById('goal');
      if (goal) {
        goal.value = val;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      qe.value = '';
      var a = document.getElementById('analyze-btn');
      if (a) a.click();
    }
    if (qsub) qsub.addEventListener('click', submitQuick);
    if (qe) {
      qe.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
      });
    }

    // Module tabs — panel switcher (no modals)
    var tabs = rootEl.querySelectorAll('.pmgv3-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        setActivePanel(tab.dataset.module);
      });
    });

    // Vault icon → open the vault drawer overlay (chassis-v3 hides the
    // legacy #history section via the body > * universal-hide rule, so a
    // simple delegated click never surfaced anything; we lazily build a
    // right-side drawer and reparent #history into it on first open).
    bindIfPresent('pmgv3-vault', function () { openVaultDrawer(); });

    // Settings icon → open the Expert Command Center (Diagnose / Engineer /
    // Tune / Variations / Save). The in-flow tuning accordion is still
    // reachable via its own "🎛️ Tune Your Prompt" header, so the gear
    // is reserved for the power-user surface. Falls back to the legacy
    // tuning-panel scroll if the Expert Center script hasn't loaded.
    bindIfPresent('pmgv3-settings', function () {
      try {
        if (window.PMGExpertCenter && typeof window.PMGExpertCenter.requestOpen === 'function') {
          window.PMGExpertCenter.requestOpen();
          return;
        }
      } catch (_e) {}
      openSettings();
    });
    /* Defense-in-depth: even if the gear button is re-rendered or
       PMGExpertCenter loads after wireActions(), a document-level
       capture-phase delegate guarantees the gear always does
       *something*. Idempotent (no-op if already attached).

       Two improvements over the previous version:
       1. stopImmediatePropagation() prevents the bindIfPresent
          bubble-phase listener above from firing a second time when
          PMGExpertCenter exists (was causing a double-open).
       2. If PMGExpertCenter has not loaded yet, we still fall back
          to openSettings() so the click is never silently swallowed. */
    if (!window.__pmgv3SettingsDelegate) {
      window.__pmgv3SettingsDelegate = true;
      document.addEventListener('click', function (e) {
        var hit = e.target && e.target.closest && e.target.closest('#pmgv3-settings');
        if (!hit) return;
        e.preventDefault();
        try { e.stopImmediatePropagation(); } catch (_e) {}
        try {
          if (window.PMGExpertCenter && typeof window.PMGExpertCenter.requestOpen === 'function') {
            /* skipWarning: the warning <dialog> lives deep inside the
               legacy footer, which the chassis hides via the body > *
               universal-hide rule. Calling showModal() on a hidden
               dialog throws and the click gets silently swallowed.
               The gear is a deliberate power-user click — go straight
               to the drawer. Paywall gating still applies inside
               requestOpen(). */
            window.PMGExpertCenter.requestOpen({ skipWarning: true });
            return;
          }
        } catch (_e) {}
        try { openSettings(); } catch (_e) {}
      }, true);
    }

    bindIfPresent('pmgv3-upgrade', function () {
      window.location.href = '/pricing.html';
    });
  }

  /* -------------------- Vault drawer overlay -------------------- */
  function ensureVaultDrawerStyles() {
    if (document.getElementById('pmgv3-vault-drawer-css')) return;
    var s = document.createElement('style');
    s.id = 'pmgv3-vault-drawer-css';
    s.textContent = [
      '#pmgv3-vault-overlay { position: fixed; inset: 0; z-index: 99990; background: rgba(0,0,0,0.55); opacity: 0; pointer-events: none; transition: opacity 0.18s ease; }',
      '#pmgv3-vault-overlay.is-open { opacity: 1; pointer-events: auto; }',
      '#pmgv3-vault-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 92vw); z-index: 99991; background: #0d2b1e; color: #e6f7ee; box-shadow: -8px 0 24px rgba(0,0,0,0.45); transform: translateX(100%); transition: transform 0.22s ease; display: flex; flex-direction: column; overflow: hidden; }',
      '#pmgv3-vault-overlay.is-open + #pmgv3-vault-drawer, #pmgv3-vault-drawer.is-open { transform: translateX(0); }',
      '.pmgv3-vault-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); flex: 0 0 auto; }',
      '.pmgv3-vault-drawer-head h2 { margin: 0; font-size: 18px; color: #e6f7ee; }',
      '.pmgv3-vault-drawer-close { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #e6f7ee; font-size: 18px; cursor: pointer; }',
      '.pmgv3-vault-drawer-close:hover { background: rgba(0,200,150,0.08); color: #00c896; }',
      '.pmgv3-vault-drawer-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 18px 24px; }',
      /* When #history is hosted inside the drawer it must override the chassis universal-hide. */
      '#pmgv3-vault-drawer #history { display: block !important; visibility: visible !important; opacity: 1 !important; }',
      '#pmgv3-vault-drawer #history .panel { background: transparent; box-shadow: none; border: 0; padding: 0; }',
      '#pmgv3-vault-drawer #history .pmg-vault-toggle { display: none !important; }',
      '@media (max-width: 480px) { #pmgv3-vault-drawer { width: 100vw; } }'
    ].join('\n');
    document.head.appendChild(s);
  }
  function openVaultDrawer() {
    ensureVaultDrawerStyles();
    var overlay = document.getElementById('pmgv3-vault-overlay');
    var drawer  = document.getElementById('pmgv3-vault-drawer');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pmgv3-vault-overlay';
      overlay.setAttribute('data-pmg-overlay-root', '');
      overlay.addEventListener('click', closeVaultDrawer);
      document.body.appendChild(overlay);
    }
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'pmgv3-vault-drawer';
      /* MUST be set before append: the chassis `body > *:not(...)`
         universal-hide rule hides anything appended directly under
         <body> unless it carries `data-pmg-overlay-root`. The overlay
         above already has it; the drawer was missing it, so the
         drawer was added to the DOM with class `is-open` but
         `display: none / visibility: hidden` — the user saw nothing. */
      drawer.setAttribute('data-pmg-overlay-root', '');
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-label', 'Prompt Vault');
      drawer.innerHTML = [
        '<div class="pmgv3-vault-drawer-head">',
          '<h2>🔒 Prompt Vault</h2>',
          '<button type="button" class="pmgv3-vault-drawer-close" aria-label="Close vault">✕</button>',
        '</div>',
        '<div class="pmgv3-vault-drawer-body" id="pmgv3-vault-drawer-body"></div>'
      ].join('');
      drawer.querySelector('.pmgv3-vault-drawer-close').addEventListener('click', closeVaultDrawer);
      document.body.appendChild(drawer);
    }
    var body = document.getElementById('pmgv3-vault-drawer-body');
    var hist = document.getElementById('history');
    if (hist && body && hist.parentNode !== body) {
      body.appendChild(hist);
      // Force-expand if a previous session left it collapsed.
      var panel = hist.querySelector('.panel');
      if (panel) panel.classList.remove('pmg-vault-collapsed');
    }
    // Trigger a render of vault contents if the legacy script exposes one.
    try { if (typeof window.renderHistory === 'function') window.renderHistory(); } catch (_e) {}
    /* Resilience: if #history was never mounted (some script removed it
       or the chassis loaded before app.html parsed), avoid showing a
       blank drawer — render a friendly empty-state so the gear/vault
       interaction always reads as intentional. Idempotent: only fills
       when the drawer body has nothing in it. */
    if (body && !body.firstElementChild) {
      var es = document.createElement('div');
      es.id = 'pmgv3-vault-empty';
      es.style.cssText = 'padding: 28px 8px; text-align: center; color: #9bccb6; font-size: 14px; line-height: 1.55;';
      es.innerHTML = [
        '<div style="font-size: 36px; margin-bottom: 10px;" aria-hidden="true">🗄️</div>',
        '<div style="font-weight: 700; color: #e6f7ee; margin-bottom: 6px;">Your Vault Is Empty</div>',
        '<div>Generate a prompt and tap <strong style="color:#3ee0a0;">💾 Save Draft</strong> to keep it here for later.</div>'
      ].join('');
      body.appendChild(es);
    } else if (body) {
      // If real content is now present, remove any stale empty-state node.
      var stale = document.getElementById('pmgv3-vault-empty');
      if (stale && body.firstElementChild !== stale) try { stale.remove(); } catch (_e) {}
    }
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    document.addEventListener('keydown', vaultDrawerEsc);
  }
  function closeVaultDrawer() {
    var overlay = document.getElementById('pmgv3-vault-overlay');
    var drawer  = document.getElementById('pmgv3-vault-drawer');
    if (overlay) overlay.classList.remove('is-open');
    if (drawer)  drawer.classList.remove('is-open');
    document.removeEventListener('keydown', vaultDrawerEsc);
  }
  function vaultDrawerEsc(e) { if (e.key === 'Escape') closeVaultDrawer(); }

  /* -------------------- Settings opener -------------------- */
  function openSettings() {
    try { setActivePanel('text'); } catch (_e) {}
    setTimeout(function () {
      var panel = document.getElementById('tuning-panel');
      if (panel) panel.classList.add('is-mobile-open');
      // Settings panel itself ships with inline display:none; force visible.
      var sp = document.getElementById('settingsPanel');
      if (sp) {
        sp.style.setProperty('display', 'block', 'important');
        try { sp.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_e) { sp.scrollIntoView(); }
        // Brief highlight pulse so the user sees where it landed.
        sp.style.transition = 'box-shadow 0.6s ease';
        sp.style.boxShadow = '0 0 0 3px rgba(0,200,150,0.45)';
        setTimeout(function () { sp.style.boxShadow = ''; }, 1200);
      } else {
        // Last-ditch: if no settingsPanel exists, surface the theme toggle.
        var theme = document.querySelector('[data-theme-toggle], .theme-toggle');
        if (theme) theme.click();
      }
    }, 60);
  }

  function mirrorStrength() {
    var pct = document.getElementById('strength-score-pct');
    var fill = document.getElementById('strength-fill');
    var badge = document.getElementById('strength-score-badge');
    var status = document.getElementById('strength-status');
    if (!pct) return;
    var val = parseInt(String(pct.textContent).replace(/[^0-9]/g, ''), 10);
    if (isNaN(val)) return;
    if (fill) fill.style.width = Math.min(100, Math.max(0, val)) + '%';
    if (badge) badge.textContent = String(val);
    if (status) {
      if (val >= 80) status.textContent = '⚡ Strong — Ready to Run';
      else if (val >= 50) status.textContent = '✓ Good — could be sharper';
      else status.textContent = 'Needs more detail';
    }
  }

  function bindIfPresent(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  function flash(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
      'background:#0a2218;color:#00c896;border:1px solid #00c896;padding:10px 16px;' +
      'border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
    document.body.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1800);
    setTimeout(function () { el.remove(); }, 2200);
  }

  function deleteTargets() {
    // Hard-remove a small set of nodes by ID so they cannot be revealed by other scripts
    ['pmg-help-me-start-btn', 'guided-mode-dialog', 'guided-mode-btn',
     'pmg-shortcuts-panel', 'pmg-result-confirm', 'pmg-t42-beta-banner',
     'auto-optimize-row', 'post-uc-guidance']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
  }

  // Defensive stray-form rescue: if any late-loading legacy script reparents
  // #prompt-form out of body, move it back so its submit listener stays
  // reachable. Form is display:none either way (visible inputs live in v3 slots).
  var mo = new MutationObserver(function () {
    var stray = document.getElementById('prompt-form');
    if (stray && stray.parentNode !== document.body) {
      document.body.appendChild(stray);
      stray.style.setProperty('display', 'none', 'important');
      stray.setAttribute('data-pmgv3-rescued', '1');
    }
  });
  if (document.body) {
    mo.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      mo.observe(document.body, { childList: true });
    });
  }

  function setActivePanel(name) {
    if (!name) return;
    var validNames = { text: 1, photography: 1, video: 1 };
    if (!validNames[name]) return;
    var body = rootEl && rootEl.querySelector('.pmgv3-body');
    if (body) body.setAttribute('data-active-panel', name);
    var tabs = rootEl && rootEl.querySelectorAll('.pmgv3-tab');
    if (tabs) {
      Array.prototype.forEach.call(tabs, function (t) {
        var active = t.dataset.module === name;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    // Toggle legacy body.image-mode so the Photography Suite's gated
    // pill groups, image-mode-only buttons, and helper text become
    // visible while the Photo panel is active. Strip it for Text/Video.
    try {
      if (name === 'photography') {
        document.body.classList.add('image-mode');
        if (typeof window.setMode === 'function') { try { window.setMode('image'); } catch (_) {} }
        // re-relocate in case suite (re)built since last switch
        if (typeof window.relocatePhotoSuite === 'function') {
          try { window.relocatePhotoSuite(); } catch (_) {}
        }
      } else {
        document.body.classList.remove('image-mode');
        if (typeof window.setMode === 'function') { try { window.setMode('write'); } catch (_) {} }
      }
    } catch (_) {}
  }

  // Mount Visual Studio inline panels once the chassis + VS script are both ready.
  function mountVSWhenReady() {
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (attempts > 40) { clearInterval(iv); return; }
      if (typeof window.mountVisualStudioPanels !== 'function') return;
      var pl = document.getElementById('pmgv3-photo-left');
      var pr = document.getElementById('pmgv3-photo-right');
      var vl = document.getElementById('pmgv3-video-left');
      var vr = document.getElementById('pmgv3-video-right');
      if (!pl || !pr || !vl || !vr) return;
      window.mountVisualStudioPanels({
        photoLeft: pl, photoRight: pr, videoLeft: vl, videoRight: vr,
      });
      clearInterval(iv);
    }, 100);
  }
  // Kick off mount after boot; chassis-v3 runs first so VS may not be defined yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountVSWhenReady);
  } else {
    mountVSWhenReady();
  }
  // Allow ?panel=photography|video|text deep-linking (also useful for tests).
  var initialPanel = qs.get('panel');
  if (initialPanel === 'photography' || initialPanel === 'video') {
    var panelTries = 0;
    var panelInt = setInterval(function () {
      panelTries++;
      if (panelTries > 30) { clearInterval(panelInt); return; }
      if (rootEl && rootEl.querySelector('.pmgv3-body')) {
        setActivePanel(initialPanel);
        clearInterval(panelInt);
      }
    }, 100);
  }
  // Re-attempt to relocate the photo suite as legacy mounts run.
  var psTries = 0;
  var psInt = setInterval(function () {
    psTries++;
    if (psTries > 30) { clearInterval(psInt); return; }
    if (typeof window.relocatePhotoSuite === 'function') {
      try { window.relocatePhotoSuite(); } catch (_) {}
    }
  }, 200);

  // Expose for debugging + VS back-compat shim
  window.pmgChassisV3 = {
    rebuild: function () {
      var existing = document.getElementById('pmg-chassis-v3-root');
      if (existing) existing.remove();
      boot();
    },
    setActivePanel: setActivePanel,
  };
})();
