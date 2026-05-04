/* =============================================================
 * pmg-whatnext.js  (Task #92)
 *
 * Adaptive "What Next?" panel — appears AFTER a successful result
 * (text or image). Pure layer-on-top: never appears before first
 * generation, never moves any existing element, never changes any
 * backend / Stripe / Supabase / API logic. All actions reuse
 * existing handlers (Fix My Prompt, Improve With AI, Run With AI,
 * Photography Suite, window.__pmgHandoff).
 *
 * Intent buckets (detected silently from goal text):
 *   - creative-visual   → visual / design language
 *   - business-marketing
 *   - writing-social
 *   - practical-sensitive (e.g. homeless, eviction, no money, crisis)
 *   - general (fallback)
 *
 * Crisis sub-flag (immediate danger language) shows a calm safety
 * line above the buttons. Practical/sensitive prompts NEVER get
 * image-first suggestions.
 *
 * Disable hatches:
 *   ?nowhatnext              query param
 *   localStorage.pmg_whatnext_disable = '1'
 *   localStorage.pmg_disable          = '1'
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgWhatNextLoaded) return;
  window.__pmgWhatNextLoaded = true;

  /* ---- Disable hatches ---- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nowhatnext\b/.test(qs)) return;
    if (localStorage.getItem('pmg_whatnext_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var VERSION = 'task94-1';

  /* -------------------------------------------------------------
   * Analytics — safe no-op if pmg-analytics.js is absent / blocked.
   * ----------------------------------------------------------- */
  function emit(name, payload) {
    try {
      if (typeof window.__pmgTrack === 'function') {
        window.__pmgTrack(name, payload || {});
      }
    } catch (_) {}
  }

  /* -------------------------------------------------------------
   * Intent detection
   * ----------------------------------------------------------- */
  var SENSITIVE_KW = [
    'homeless', 'sleeping in my car', 'sleep in my car', 'eviction', 'evicted',
    'unsafe', 'emergency', 'crisis', 'food bank', 'shelter', 'no shelter',
    'rent due', 'cant pay rent', "can't pay rent", 'cant afford', "can't afford",
    'no money', 'broke', 'lost my job', 'no job', 'need help', 'need a job',
    'starving', 'no food', 'hungry', 'utilities shut off', 'power shut off',
    'domestic violence', 'abuse', 'abused', 'abusive', 'scared',
    'cant feed', "can't feed", 'foreclosure'
  ];
  var CRISIS_KW = [
    'suicide', 'suicidal', 'kill myself', 'killing myself', 'end my life',
    'want to die', 'hurt myself', 'self harm', 'self-harm',
    'in immediate danger', 'in danger', 'going to hurt', 'about to hurt',
    'overdose', 'overdosing'
  ];
  var VISUAL_KW = [
    'image', 'photo', 'photograph', 'picture', 'illustration', 'logo',
    'poster', 'thumbnail', 'render', 'artwork', 'painting', 'mockup',
    'banner', 'graphic', 'design a', 'design an', 'icon', 'avatar',
    'portrait', 'wallpaper', 'cover art', 'album cover'
  ];
  var BUSINESS_KW = [
    'launch', 'product', 'customer', 'campaign', 'ad copy', 'landing page',
    'pitch', 'deck', 'proposal', 'revenue', 'sales', 'marketing',
    'startup', 'brand', 'pricing', 'cold email', 'lead gen', 'b2b',
    'investor', 'roadmap'
  ];
  var WRITING_KW = [
    'write', 'post', 'tweet', 'linkedin', 'instagram', 'facebook',
    'blog', 'article', 'newsletter', 'caption', 'story', 'essay',
    'email', 'copy', 'headline', 'tagline', 'social media',
    'announce', 'announcement'
  ];

  function hasAny(text, list) {
    if (!text) return false;
    var t = text.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (t.indexOf(list[i]) !== -1) return true;
    }
    return false;
  }

  function detectIntent(text) {
    if (hasAny(text, CRISIS_KW))    return { bucket: 'practical-sensitive', crisis: true };
    if (hasAny(text, SENSITIVE_KW)) return { bucket: 'practical-sensitive', crisis: false };
    if (hasAny(text, VISUAL_KW))    return { bucket: 'creative-visual',     crisis: false };
    if (hasAny(text, BUSINESS_KW))  return { bucket: 'business-marketing',  crisis: false };
    if (hasAny(text, WRITING_KW))   return { bucket: 'writing-social',      crisis: false };
    return { bucket: 'general', crisis: false };
  }

  /* -------------------------------------------------------------
   * DOM helpers
   * ----------------------------------------------------------- */
  function $id(id) { return document.getElementById(id); }
  function getGoalText() {
    var g = $id('goal');
    return g ? (g.value || '').trim() : '';
  }
  function getResponseText() {
    var r = $id('aiResponseOutput');
    if (!r) return '';
    return (r.textContent || '').trim();
  }
  function showToast(msg) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg); return; } catch (_) {}
    }
    try { console.info('[pmg-whatnext]', msg); } catch (_) {}
  }
  function smoothScrollTo(el) {
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {
      try { el.scrollIntoView(); } catch (__) {}
    }
  }
  function softHighlight(el) {
    if (!el) return;
    el.classList.add('pmg-wn-highlight');
    setTimeout(function () { el.classList.remove('pmg-wn-highlight'); }, 1800);
  }
  function trim(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trim() + '…';
  }

  /* -------------------------------------------------------------
   * Styles
   * ----------------------------------------------------------- */
  function injectStyles() {
    if ($id('pmg-wn-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-wn-styles';
    s.textContent = [
      /* Panel — lifted card, distinct surface, generous padding. */
      '.pmg-wn-panel{margin-top:32px;padding:26px 24px;border:1px solid #ece6da;',
      '  border-radius:18px;background:#ffffff;',
      '  box-shadow:0 1px 2px rgba(15,23,42,0.04),0 10px 32px rgba(15,23,42,0.06);}',
      '.pmg-wn-panel[hidden]{display:none!important;}',
      '.pmg-wn-eyebrow{font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;',
      '  color:var(--color-primary,#0f766e);margin:0 0 6px;}',
      '.pmg-wn-title{margin:0 0 6px;font-size:20px;font-weight:800;color:var(--color-text,#1f1f1f);',
      '  letter-spacing:-0.01em;line-height:1.25;}',
      '.pmg-wn-helper{margin:0 0 18px;font-size:13.5px;color:var(--color-text-muted,#6b6b6b);',
      '  line-height:1.55;}',
      '.pmg-wn-safety{margin:0 0 18px;padding:12px 14px;border-radius:12px;',
      '  background:#fff4e0;border:1px solid #e6c79a;font-size:13px;color:#5a3d10;line-height:1.5;}',
      '.pmg-wn-safety strong{color:#3d2807;}',
      '.pmg-wn-actions{display:block;}',
      /* Primary — visually dominant, full-width, two-line stack. */
      '.pmg-wn-btn{font:inherit;cursor:pointer;text-align:center;white-space:normal;',
      '  line-height:1.25;border-style:solid;}',
      '.pmg-wn-btn.pmg-wn-primary{display:flex;flex-direction:column;align-items:center;',
      '  justify-content:center;gap:3px;width:100%;min-height:56px;padding:12px 20px;',
      '  border-radius:14px;background:var(--color-primary,#0f766e);color:#fff;',
      '  border:1px solid var(--color-primary,#0f766e);font-weight:700;',
      '  box-shadow:0 6px 18px rgba(15,118,110,0.22);',
      '  transition:transform .12s ease,box-shadow .12s ease,filter .12s ease;}',
      '.pmg-wn-btn.pmg-wn-primary:hover,.pmg-wn-btn.pmg-wn-primary:focus-visible{',
      '  filter:brightness(1.05);outline:none;',
      '  box-shadow:0 8px 22px rgba(15,118,110,0.30);}',
      '.pmg-wn-btn.pmg-wn-primary:active{transform:translateY(1px);',
      '  box-shadow:0 4px 12px rgba(15,118,110,0.26);}',
      '.pmg-wn-btn-title{font-size:15.5px;font-weight:800;line-height:1.2;}',
      '.pmg-wn-btn-sub{font-size:12.5px;font-weight:500;opacity:0.92;line-height:1.3;}',
      /* Secondaries — quieter row beneath the primary. */
      '.pmg-wn-secondaries{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
      '.pmg-wn-btn.pmg-wn-secondary{flex:1 1 0;min-height:42px;padding:8px 14px;',
      '  border-radius:10px;background:transparent;color:var(--color-text-muted,#6b6b6b);',
      '  border:1px solid var(--color-border,#d4cfc4);font-weight:600;font-size:13px;',
      '  transition:color .12s ease,border-color .12s ease,background .12s ease;}',
      '.pmg-wn-btn.pmg-wn-secondary:hover,.pmg-wn-btn.pmg-wn-secondary:focus-visible{',
      '  color:var(--color-primary,#0f766e);border-color:var(--color-primary,#0f766e);',
      '  background:rgba(15,118,110,0.04);outline:none;}',
      /* Mobile: keep linear, no horizontal overflow, primary stays dominant. */
      '@media (max-width:540px){',
      '  .pmg-wn-panel{padding:22px 18px;margin-top:24px;border-radius:16px;}',
      '  .pmg-wn-title{font-size:18px;}',
      '  .pmg-wn-btn.pmg-wn-primary{min-height:60px;}',
      '  .pmg-wn-btn-title{font-size:15px;}',
      '  .pmg-wn-secondaries{flex-direction:column;gap:8px;}',
      '  .pmg-wn-btn.pmg-wn-secondary{flex:1 1 100%;width:100%;min-height:44px;}',
      '}',
      /* Soft highlight halo (used by Hero Image scroll target). */
      '.pmg-wn-highlight{box-shadow:0 0 0 3px rgba(15,118,110,0.35),0 0 24px rgba(15,118,110,0.15)!important;',
      '  transition:box-shadow .35s ease;border-radius:14px;}',
      '@media (prefers-reduced-motion:reduce){',
      '  .pmg-wn-btn,.pmg-wn-btn.pmg-wn-primary,.pmg-wn-btn.pmg-wn-secondary{transition:none;}',
      '  .pmg-wn-highlight{transition:none;}',
      '}',
      '[data-theme="dark"] .pmg-wn-panel{background:var(--color-surface,#1c1b18);border-color:var(--color-border,#34312d);}',
      '[data-theme="dark"] .pmg-wn-safety{background:#3d2807;border-color:#5a3d10;color:#fcd34d;}',
      '[data-theme="dark"] .pmg-wn-safety strong{color:#fef3c7;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* -------------------------------------------------------------
   * Action button menus
   * ----------------------------------------------------------- */
  function getTextActions(intent) {
    if (intent.bucket === 'practical-sensitive') {
      /* Order matters — buildPanel renders 1 primary + first 2 secondaries.
         Most actionable in crisis: action plan (primary), step-by-step,
         ask-for-help. local-details kept reachable via runAction() but
         not surfaced to honour the 1+2 rule. */
      return [
        { key: 'action-plan',    label: 'Turn Into Action Plan',          primary: true,
          subtext: 'Turn This Into Concrete Steps For Today' },
        { key: 'step-by-step',   label: 'Make This Step-By-Step',         primary: false },
        { key: 'ask-for-help',   label: 'Write Message Asking For Help',  primary: false },
        { key: 'local-details',  label: 'Add Local Details',              primary: false }
      ];
    }
    if (intent.bucket === 'creative-visual') {
      return [
        { key: 'hero-image',     label: 'Make A Hero Image', primary: true,
          subtext: 'Turn This Into A Visual' },
        { key: 'create-caption', label: 'Create Caption',    primary: false },
        { key: 'improve-prompt', label: 'Improve Prompt',    primary: false }
      ];
    }
    if (intent.bucket === 'business-marketing' || intent.bucket === 'writing-social') {
      return [
        { key: 'hero-image',     label: 'Make A Hero Image',  primary: true,
          subtext: 'Turn This Into A Visual' },
        { key: 'create-caption', label: 'Create Caption',     primary: false },
        { key: 'improve-prompt', label: 'Improve Prompt',     primary: false }
      ];
    }
    /* general fallback — bridge with improve as the recommended next step */
    return [
      { key: 'improve-prompt', label: 'Improve Prompt',    primary: true,
        subtext: 'Make This Clearer And More Effective' },
      { key: 'hero-image',     label: 'Make A Hero Image', primary: false },
      { key: 'create-caption', label: 'Create Caption',    primary: false }
    ];
  }

  function getImageActions() {
    /* Image results never get the sensitive variant — image gen is
       not used for crisis prompts. Always show the bridge trio. */
    return [
      { key: 'write-text-for-image', label: 'Write Text For This Image', primary: true,
        subtext: 'Caption, Headline, Or Post Copy For This Image' },
      { key: 'create-caption-image', label: 'Create Caption',            primary: false },
      { key: 'another-style',        label: 'Generate Another Style',    primary: false }
    ];
  }

  /* -------------------------------------------------------------
   * Action handlers
   * ----------------------------------------------------------- */
  function clickIfPresent(id) {
    var el = $id(id);
    if (el && typeof el.click === 'function') { el.click(); return true; }
    return false;
  }

  function seedGoalAndNudge(text, nudgeMsg) {
    var g = $id('goal');
    if (!g) return;
    g.value = text;
    try { g.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { g.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    smoothScrollTo(g);
    setTimeout(function () { try { g.focus(); } catch (_) {} }, 350);
    showToast(nudgeMsg || 'Updated Your Goal — Tap Fix My Prompt');
  }

  function actionHeroImage() {
    /* Prefer the existing handoff API (mode switch + pill seed). */
    try {
      var api = window.__pmgHandoff;
      if (api && typeof api.textToImage === 'function') {
        api.textToImage();
      }
    } catch (_) {}
    /* Then scroll to and softly highlight the photo suite so the
       user can review/edit the brief before generating. */
    setTimeout(function () {
      var suite = $id('pmg-photo-suite');
      if (suite) {
        smoothScrollTo(suite);
        softHighlight(suite);
        return;
      }
      /* Fallback — switch to image mode so the Photography Suite mounts, then scroll to it. */
      try { if (typeof window.setMode === 'function') window.setMode('image'); } catch (_) {}
      var late = $id('pmg-photo-suite') || $id('photo-suite-section');
      if (late) smoothScrollTo(late);
    }, 100);
    showToast('Image Brief Ready — Review And Tap Generate Image');
  }

  function actionWriteTextForImage() {
    try {
      var api = window.__pmgHandoff;
      if (api && typeof api.imageToText === 'function') {
        api.imageToText();
      }
    } catch (_) {}
    /* Fallback / supplement: seed the goal with a write-about-this
       prompt so even users without the handoff API get a useful
       starting point. */
    var brief = '';
    try {
      var ip = $id('imagePromptOutput') || $id('aiResponseOutput');
      if (ip) brief = (ip.textContent || '').trim();
    } catch (_) {}
    if (!brief) brief = getGoalText();
    var seed = 'Write A Short, Vivid Description Of An Image Featuring: ' +
               trim(brief, 240) +
               '. Use Plain, Sensory Language. Two To Three Sentences.';
    var g = $id('goal');
    /* Only re-seed if the handoff didn't already populate the goal. */
    if (g && (!g.value || g.value.trim().length < 10)) {
      seedGoalAndNudge(seed, 'Updated Your Goal — Tap Fix My Prompt');
    } else {
      smoothScrollTo(g);
      showToast('Switched To Text Mode — Edit And Tap Fix My Prompt');
    }
  }

  function actionImproveprompt() {
    /* Re-use the existing Improve With AI button — no new pattern. */
    if (clickIfPresent('improve-with-ai-btn')) {
      var btn = $id('improve-with-ai-btn');
      if (btn) smoothScrollTo(btn);
      return;
    }
    /* Fallback: click the in-house Fix My Prompt button. */
    clickIfPresent('generateBtn');
    var gen = $id('generateBtn');
    if (gen) smoothScrollTo(gen);
  }

  function actionCreateCaption(fromImage) {
    var source = fromImage
      ? trim(($id('imageResultWrap') && $id('imageResultWrap').textContent) || getGoalText(), 240)
      : trim(getResponseText() || getGoalText(), 240);
    if (!source) source = getGoalText();
    var seed = 'Write A Short, Engaging Social Media Caption (Under 240 Characters) For This Content. ' +
               'Friendly Tone, One Hook, One Call To Action. Source: ' + source;
    seedGoalAndNudge(seed);
  }

  function actionAnotherStyle() {
    /* Roll new photography pills, then trigger the existing image
       regenerate handler. */
    var rolled = false;
    var surprise = document.querySelector('.pmg-photo-surprise');
    if (surprise && typeof surprise.click === 'function') {
      try { surprise.click(); rolled = true; } catch (_) {}
    }
    setTimeout(function () {
      if (!clickIfPresent('imageAgainBtn')) clickIfPresent('imageBtn');
    }, rolled ? 300 : 50);
    showToast('Rolling A New Style — Generating…');
  }

  function actionActionPlan() {
    var goal = trim(getGoalText(), 280);
    var resp = trim(getResponseText(), 360);
    var seed = 'Take My Situation And Turn It Into A Clear Practical Action Plan. ' +
               'Use Plain Language. Number Each Step. Separate What I Should Do Today From What I Should Do This Week. ' +
               'List Any Free Or Low-Cost Resources I Can Use. Be Calm And Direct. ' +
               'My Situation: ' + goal +
               (resp ? ' Earlier Suggestion I Got: ' + resp : '');
    seedGoalAndNudge(seed);
  }

  function actionStepByStep() {
    var goal = trim(getGoalText(), 280);
    var resp = trim(getResponseText(), 360);
    var seed = 'Rewrite The Following Into A Clear Numbered Step-By-Step Plan A Stressed Person Can Follow Today. ' +
               'One Action Per Step, Plain Language, No Jargon. ' +
               'Original Goal: ' + goal +
               (resp ? ' Original Response: ' + resp : '');
    seedGoalAndNudge(seed);
  }

  function actionLocalDetails() {
    var goal = trim(getGoalText(), 280);
    var seed = 'Adapt The Following To My Local Area. ' +
               'Suggest Specific Types Of Resources I Should Search For — Shelters, Food Banks, Community Aid, Hotlines, Local Government Offices, Faith Communities. ' +
               'Tell Me What To Search For And What Questions To Ask. Do Not Invent Specific Phone Numbers. ' +
               'My Situation: ' + goal;
    seedGoalAndNudge(seed);
  }

  function actionAskForHelp() {
    var goal = trim(getGoalText(), 280);
    var seed = 'Help Me Write A Short, Dignified Message I Can Send To A Friend, Family Member, Social Worker, Or Local Resource Asking For Help. ' +
               'Be Specific About What I Need But Not Desperate. Keep It Under 120 Words. Offer Two Versions — One For A Friend, One For A Professional. ' +
               'My Situation: ' + goal;
    seedGoalAndNudge(seed);
  }

  function runAction(key) {
    switch (key) {
      case 'hero-image':            return actionHeroImage();
      case 'write-text-for-image':  return actionWriteTextForImage();
      case 'improve-prompt':        return actionImproveprompt();
      case 'create-caption':        return actionCreateCaption(false);
      case 'create-caption-image':  return actionCreateCaption(true);
      case 'another-style':         return actionAnotherStyle();
      case 'action-plan':           return actionActionPlan();
      case 'step-by-step':          return actionStepByStep();
      case 'local-details':         return actionLocalDetails();
      case 'ask-for-help':          return actionAskForHelp();
    }
  }

  /* -------------------------------------------------------------
   * Panel rendering
   *
   * IMPORTANT: callers must guard with a signature hash before
   * invoking buildPanel — otherwise re-creating the panel mutates
   * the observed result-section subtree, which re-fires our
   * MutationObserver and creates a render loop. mountTextWhatNext
   * and mountImageWhatNext both compute a signature and short-
   * circuit when the panel is already current.
   * ----------------------------------------------------------- */
  var lastSig = { text: '', image: '' };

  function buildPanel(panelId, title, helper, actions, opts) {
    var existing = $id(panelId);
    if (existing) existing.parentNode.removeChild(existing);

    var panel = document.createElement('section');
    panel.id = panelId;
    panel.className = 'pmg-wn-panel pmg-post-gen';
    panel.setAttribute('aria-label', title);

    var html = '<p class="pmg-wn-eyebrow">Suggested Next Step</p>' +
               '<h3 class="pmg-wn-title">' + title + '</h3>';
    if (opts && opts.crisis) {
      html += '<p class="pmg-wn-safety"><strong>If You Are In Immediate Danger,</strong> ' +
              'Contact Local Emergency Services. Your Safety Comes First.</p>';
    }
    if (helper) {
      html += '<p class="pmg-wn-helper">' + helper + '</p>';
    }

    /* Split into 1 primary + up to 2 secondaries. The primary is the
     * first action with .primary === true (or the first action overall
     * as a defensive fallback). All other reachable actions remain
     * callable via window.__pmgWhatNext.runAction(key). */
    var primaryAction = null;
    var secondaryActions = [];
    actions.forEach(function (a) {
      if (!primaryAction && a.primary) primaryAction = a;
      else if (secondaryActions.length < 2) secondaryActions.push(a);
    });
    if (!primaryAction && actions.length) {
      primaryAction = actions[0];
      secondaryActions = actions.slice(1, 3);
    }

    html += '<div class="pmg-wn-actions" role="group" aria-label="What Next Actions">';
    if (primaryAction) {
      var sub = primaryAction.subtext
        ? '<span class="pmg-wn-btn-sub">' + primaryAction.subtext + '</span>'
        : '';
      html += '<button type="button" class="pmg-wn-btn pmg-wn-primary"' +
              ' data-wn-action="' + primaryAction.key + '"' +
              ' data-wn-label="' + primaryAction.label + '">' +
              '<span class="pmg-wn-btn-title">' + primaryAction.label + '</span>' +
              sub +
              '</button>';
    }
    if (secondaryActions.length) {
      html += '<div class="pmg-wn-secondaries">';
      secondaryActions.forEach(function (a) {
        html += '<button type="button" class="pmg-wn-btn pmg-wn-secondary"' +
                ' data-wn-action="' + a.key + '"' +
                ' data-wn-label="' + a.label + '">' + a.label + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;

    panel.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-wn-action]');
      if (!btn) return;
      try {
        /* Prefer data-wn-label so the analytics label stays a clean
           single string ("Make A Hero Image") even when the primary
           button stacks a title + subtext span pair. */
        var lbl = btn.getAttribute('data-wn-label')
          || (btn.textContent || '').trim();
        emit('pmg_what_next_clicked', {
          source: (panelId === 'pmg-wn-image') ? 'image_result' : 'text_result',
          bucket: (opts && opts.bucket) || 'creative-visual',
          crisis: !!(opts && opts.crisis),
          action: btn.getAttribute('data-wn-action') || '',
          label:  lbl.slice(0, 60),
          ts:     new Date().toISOString()
        });
      } catch (_) {}
      var key = btn.getAttribute('data-wn-action');
      if (!key) return;
      runAction(key);
    });
    return panel;
  }

  function helperFor(intent, isImage) {
    if (isImage) {
      return 'Keep going with this image — write a description, draft a caption, or roll a different style.';
    }
    if (intent.bucket === 'practical-sensitive') {
      return 'Take The Answer Above And Turn It Into Something You Can Act On Today.';
    }
    if (intent.bucket === 'creative-visual' ||
        intent.bucket === 'business-marketing' ||
        intent.bucket === 'writing-social') {
      return 'Pair Your Words With An Image, Refine It Further, Or Spin Off A Caption.';
    }
    return 'Refine This Prompt, Add A Hero Image, Or Spin Off A Caption.';
  }

  /* -------------------------------------------------------------
   * Mounting after a result
   * ----------------------------------------------------------- */
  function mountTextWhatNext() {
    var section = $id('aiResponseSection');
    if (!section || section.hidden) {
      /* Section was hidden again — drop the panel + clear sig so
         a future result re-mounts cleanly. */
      var stale = $id('pmg-wn-text');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      lastSig.text = '';
      return;
    }
    var output = $id('aiResponseOutput');
    var respText = output ? (output.textContent || '').trim() : '';
    if (!respText) return;

    var combined = (getGoalText() + '\n' + respText).slice(0, 4000);
    var intent = detectIntent(combined);

    /* Signature short-circuit — if nothing relevant changed, do not
       rebuild. Critical: rebuilding mutates the observed subtree
       and would re-fire our own MutationObserver in a loop. */
    var sig = 'T|' + intent.bucket + '|' + (intent.crisis ? '1' : '0') +
              '|' + respText.length + '|' + respText.slice(0, 64);
    if (sig === lastSig.text && $id('pmg-wn-text')) return;
    lastSig.text = sig;

    var actions = getTextActions(intent);
    var title = intent.bucket === 'practical-sensitive'
      ? 'What Would Help Right Now?'
      : 'What Next?';
    var panel = buildPanel(
      'pmg-wn-text',
      title,
      helperFor(intent, false),
      actions,
      { crisis: intent.crisis, bucket: intent.bucket }
    );
    emit('pmg_what_next_shown', {
      source: 'text_result',
      bucket: intent.bucket,
      crisis: !!intent.crisis,
      action_count: actions.length,
      ts:     new Date().toISOString()
    });
    /* Place after the action row in the AI response section so it
       sits right under "Copy Response / Run Again". */
    var actionsRow = section.querySelector('.ai-response-actions');
    if (actionsRow && actionsRow.parentNode === section) {
      section.insertBefore(panel, actionsRow.nextSibling);
    } else {
      section.appendChild(panel);
    }
  }

  function mountImageWhatNext() {
    var section = $id('imageResultSection');
    if (!section || section.hidden) {
      var stale = $id('pmg-wn-image');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      lastSig.image = '';
      return;
    }
    var wrap = $id('imageResultWrap');
    if (!wrap) return;
    /* Only mount once an actual <img> has rendered (not the placeholder). */
    var img = wrap.querySelector('img');
    if (!img) return;

    /* Signature short-circuit — see mountTextWhatNext for rationale. */
    var src = img.getAttribute('src') || '';
    var sig = 'I|' + src.length + '|' + src.slice(0, 96);
    if (sig === lastSig.image && $id('pmg-wn-image')) return;
    lastSig.image = sig;

    var actions = getImageActions();
    var panel = buildPanel(
      'pmg-wn-image',
      'What Next?',
      helperFor({ bucket: 'creative-visual' }, true),
      actions,
      { crisis: false, bucket: 'creative-visual' }
    );
    emit('pmg_what_next_shown', {
      source: 'image_result',
      bucket: 'creative-visual',
      crisis: false,
      action_count: actions.length,
      ts:     new Date().toISOString()
    });
    var actionsRow = section.querySelector('.image-result-actions');
    if (actionsRow && actionsRow.parentNode === section) {
      section.insertBefore(panel, actionsRow.nextSibling);
    } else {
      section.appendChild(panel);
    }
  }

  /* -------------------------------------------------------------
   * Observers — mount only when results actually appear
   * ----------------------------------------------------------- */
  function observeResults() {
    var textSection = $id('aiResponseSection');
    var imageSection = $id('imageResultSection');

    var debounce = null;
    function refresh() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(function () {
        try { mountTextWhatNext(); } catch (e) { try { console.warn('[pmg-wn] text mount', e); } catch (_) {} }
        try { mountImageWhatNext(); } catch (e) { try { console.warn('[pmg-wn] image mount', e); } catch (_) {} }
      }, 80);
    }

    if (textSection) {
      var to = new MutationObserver(refresh);
      to.observe(textSection, {
        attributes: true, attributeFilter: ['hidden'],
        childList: true, subtree: true, characterData: true
      });
    }
    if (imageSection) {
      var io = new MutationObserver(refresh);
      io.observe(imageSection, {
        attributes: true, attributeFilter: ['hidden'],
        childList: true, subtree: true
      });
    }
    /* One catch-up pass in case content was already rendered before
       the observers attached. */
    refresh();
  }

  /* -------------------------------------------------------------
   * Boot
   * ----------------------------------------------------------- */
  function boot() {
    injectStyles();
    observeResults();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* -------------------------------------------------------------
   * Public API for tests
   * ----------------------------------------------------------- */
  window.__pmgWhatNext = {
    version:        VERSION,
    detectIntent:   detectIntent,
    mountText:      mountTextWhatNext,
    mountImage:     mountImageWhatNext,
    runAction:      runAction
  };
})();
