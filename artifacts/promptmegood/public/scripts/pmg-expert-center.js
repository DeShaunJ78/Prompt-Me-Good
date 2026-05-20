/* ============================================================================
 * pmg-expert-center.js
 * ----------------------------------------------------------------------------
 * Expert Command Center — a hidden, paid-tier drawer that opens from the
 * existing single ⚙ Expert Mode entry point. Five tabs:
 *
 *   1. Diagnose   — strength score, weakness, missing context, one-tap fixes
 *   2. Engineer   — Off / Auto / Custom controls for role, audience, format…
 *   3. Tune       — style/behavior toggles + sliders
 *   4. Variations — Fast & Simple / Detailed & Strategic / Bold & Persuasive
 *   5. Save       — workflows + reusable presets (localStorage)
 *
 * Public API: window.PMGExpertCenter.{ requestOpen, open, close, applied }
 *
 *   - requestOpen(opts) — entry point used by every Expert Mode button.
 *                         Handles the first-N warning gating and the
 *                         post-beta paywall, then opens the drawer.
 *   - open()            — opens immediately, bypassing warning + paywall.
 *   - close()           — closes the drawer and restores focus.
 *   - applied()         — boolean: has the user applied any change yet
 *                         in this session (drives the status pill).
 *
 * No body-class side effects (no auto-expanding advanced options, no
 * hiding tips, no forcing Auto Optimize off). All advanced controls
 * live INSIDE the drawer; the main builder stays calm.
 * ============================================================================ */
(function () {
  'use strict';
  if (window.PMGExpertCenter) return;

  var FIRST_N_WARNINGS = 3;
  var ACTIVATIONS_KEY  = 'promptmegood:expertModeActivations:v1';
  var WORKFLOWS_KEY    = 'promptmegood:expertCenter:workflows:v1';
  var STATE_KEY        = 'promptmegood:expertCenter:state:v1';

  /* =====================================================================
   * Helpers
   * ===================================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    if (children != null) {
      var arr = Array.isArray(children) ? children : [children];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (c == null || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }
  function track(name, payload) {
    try { if (typeof window.__pmgTrack === 'function') window.__pmgTrack(name, payload || null); } catch (e) {}
  }
  function getActivations() {
    try { return parseInt(localStorage.getItem(ACTIVATIONS_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function bumpActivations() {
    try { var n = getActivations() + 1; localStorage.setItem(ACTIVATIONS_KEY, String(n)); return n; } catch (e) { return 0; }
  }
  function isPaidUser() {
    try { return !!(window.pmgIsPro && window.pmgIsPro()); } catch (e) { return false; }
  }
  function isInBeta() {
    try {
      var end = window.PMG_PRICING && window.PMG_PRICING.BETA_END;
      if (!end) return true;
      return Date.now() < new Date(end).getTime();
    } catch (e) { return true; }
  }
  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeState(state) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state || {})); } catch (e) {}
  }
  function readWorkflows() {
    try {
      var v = JSON.parse(localStorage.getItem(WORKFLOWS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeWorkflows(list) {
    try { localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch (e) {}
  }
  function getGoalText() { var ta = $('#goal'); return ta ? (ta.value || '') : ''; }
  function setGoalText(value, opts) {
    var ta = $('#goal');
    if (!ta) return;
    ta.value = value || '';
    /* Dispatch only 'input' (the standard textarea-content event).
       We deliberately skip 'change' to avoid re-triggering Auto
       Optimize / Smart Suggestions pipelines that listen for
       'change' and could rewrite parts of what the user just
       applied from the Command Center. */
    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    if (!opts || opts.scroll !== false) {
      try { ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }

  /* =====================================================================
   * Diagnose: client-side strength scoring
   * ===================================================================== */
  var VAGUE_RX = /\b(stuff|things?|something|anything|good|great|nice|cool|best|amazing|awesome|kind of|sort of|maybe|various|several|some|a lot|many)\b/gi;
  var ROLE_RX = /\b(you are|act as|role:|as an? [a-z]+ (expert|consultant|writer|developer|coach|engineer|specialist|analyst|professional|copywriter|designer|strategist))\b/i;
  var AUDIENCE_RX = /\b(audience|target|reader|customer|for (a|an|my|our) [a-z]+|aimed at|targeted to|written for|for beginners|for experts|for [a-z]+ users)\b/i;
  var FORMAT_RX = /\b(format|list|bullet|step|table|json|markdown|paragraph|outline|headings?|numbered|sections?)\b/i;
  var TONE_RX = /\b(tone|voice|style|formal|casual|friendly|professional|playful|persuasive|conversational|warm|direct)\b/i;
  var CONSTRAINT_RX = /\b(must|should|do not|don't|avoid|never|always|maximum|minimum|under \d|less than|fewer than|word limit|character limit|exactly \d)\b/i;
  var ACTION_RX = /\b(write|create|build|design|generate|draft|compose|outline|explain|summari[sz]e|analy[sz]e|review|brainstorm|list|describe|plan|critique|suggest|recommend|teach|translate|debug|fix|refactor|edit|rewrite|propose|compare)\b/i;

  function scorePrompt(text) {
    text = (text || '').toString();
    if (!text || text.trim().length < 4) {
      return {
        score: 0, label: 'Empty', wc: 0,
        hits: {}, missing: [], weakest: null, vagueWords: []
      };
    }
    var words = text.trim().split(/\s+/).filter(Boolean);
    var wc = words.length;
    var vagueWords = [];
    text.replace(VAGUE_RX, function (m) { if (vagueWords.indexOf(m.toLowerCase()) === -1) vagueWords.push(m.toLowerCase()); return m; });
    var hits = {
      role:       ROLE_RX.test(text),
      audience:   AUDIENCE_RX.test(text),
      format:     FORMAT_RX.test(text),
      tone:       TONE_RX.test(text),
      constraint: CONSTRAINT_RX.test(text),
      action:     ACTION_RX.test(text),
      length:     wc >= 12,
      detail:     wc >= 30,
      vague:      vagueWords.length === 0
    };
    var weights = { action: 12, length: 8, detail: 12, role: 12, audience: 12, format: 10, tone: 8, constraint: 12, vague: 14 };
    var score = 0;
    for (var k in hits) if (hits[k]) score += weights[k] || 0;
    if (score > 100) score = 100;
    var missing = [];
    if (!hits.action)     missing.push({ key: 'action',     label: 'A clear action verb (write, build, summarize, …)' });
    if (!hits.detail)     missing.push({ key: 'detail',     label: 'More detail — aim for at least 30 words' });
    if (!hits.role)       missing.push({ key: 'role',       label: 'Who AI should act as ("Act as a copywriter…")' });
    if (!hits.audience)   missing.push({ key: 'audience',   label: 'Who the answer is for (audience / reader)' });
    if (!hits.format)     missing.push({ key: 'format',     label: 'Output format (list / steps / table / paragraphs)' });
    if (!hits.tone)       missing.push({ key: 'tone',       label: 'Tone of voice (friendly / professional / direct)' });
    if (!hits.constraint) missing.push({ key: 'constraint', label: 'Constraints (length, do/don\'t, must include)' });
    if (!hits.vague)      missing.push({ key: 'vague',      label: 'Replace vague words (' + vagueWords.slice(0, 3).join(', ') + ')' });
    var label = score >= 80 ? 'Strong' : score >= 55 ? 'Good' : score >= 30 ? 'Needs Work' : 'Too Vague';
    return { score: score, label: label, wc: wc, hits: hits, missing: missing, weakest: missing[0] || null, vagueWords: vagueWords };
  }

  /* Plain-English coach verdict — built from scorePrompt() output, no AI call.
     Returns "what's working" + "biggest fix" so the score feels earned, not arbitrary. */
  var STRENGTH_NAMES = {
    action:     'a clear action verb',
    detail:     'enough detail to work with',
    role:       'a defined role for the AI',
    audience:   'a clear audience',
    format:     'an output format',
    tone:       'a tone direction',
    constraint: 'specific rules and limits',
    vague:      'no vague filler words'
  };
  var STRENGTH_PRIORITY = ['action', 'audience', 'format', 'role', 'constraint', 'tone', 'detail', 'vague'];
  function verdictEnglish(s) {
    if (!s || s.score === 0) return '';
    var working = [];
    for (var i = 0; i < STRENGTH_PRIORITY.length && working.length < 2; i++) {
      var k = STRENGTH_PRIORITY[i];
      if (s.hits[k]) working.push(STRENGTH_NAMES[k]);
    }
    var fixText = {
      action:     'add a clear action verb (write, build, summarize…) so AI knows what to do',
      detail:     'add more detail — even 30 words gives AI much more to work with',
      role:       'tell AI who to act as ("Act as a senior copywriter…") — it shifts the whole answer',
      audience:   'tell AI who the answer is for — that single change makes results feel custom-built',
      format:     'tell AI the output format — list, table, paragraphs — so you don\'t have to reformat',
      tone:       'add a tone direction (friendly, direct, professional) so the voice matches your need',
      constraint: 'add a constraint or two (length, must-include, things to avoid) to sharpen the result',
      vague:      'replace vague words like "' + (s.vagueWords[0] || 'stuff') + '" with something specific'
    };
    var fixKey = s.weakest && s.weakest.key;
    var fix = fixKey ? fixText[fixKey] : null;
    var opener;
    if (s.score >= 80)      opener = 'Your prompt is in great shape.';
    else if (s.score >= 55) opener = 'Your prompt is in solid shape.';
    else if (s.score >= 30) opener = 'Your prompt needs work — AI may give you a generic answer.';
    else                    opener = 'Your prompt is too vague — AI will probably guess wrong.';
    var workingSent = '';
    if (working.length === 2)      workingSent = ' You\'ve got ' + working[0] + ' and ' + working[1] + '.';
    else if (working.length === 1) workingSent = ' You\'ve got ' + working[0] + '.';
    if (s.score >= 80 && !fix) return opener + workingSent + ' AI will likely give you a useful, on-target answer.';
    var fixSent = fix ? ' The single biggest thing you can do: ' + fix + '.' : '';
    return opener + workingSent + fixSent;
  }

  /* Send-to destinations for Variations cards. Mirrors pmg-send-to.js URL
     patterns; inlined here so this script doesn't depend on that one's
     load order. Gemini has no working prefill — copy + open instead. */
  var EC_SEND_DESTS = [
    { id: 'chatgpt',    label: 'ChatGPT',    prefill: function (t) { return 'https://chat.openai.com/?q=' + encodeURIComponent(t); } },
    { id: 'claude',     label: 'Claude',     prefill: function (t) { return 'https://claude.ai/new?q=' + encodeURIComponent(t); } },
    { id: 'gemini',     label: 'Gemini',     prefill: null, url: 'https://gemini.google.com/app' },
    { id: 'perplexity', label: 'Perplexity', prefill: function (t) { return 'https://www.perplexity.ai/search?q=' + encodeURIComponent(t); } }
  ];

  /* =====================================================================
   * Engineer: structured sections (Off / Auto / Custom)
   * ===================================================================== */
  var ENGINEER_SECTIONS = [
    { key: 'role',        label: 'Role',                       placeholder: 'Senior brand copywriter with 10 years of B2B SaaS experience.',
      helper: 'Tell AI what expert role to play.',
      auto: function () { return 'You are an expert assistant who reads the request below carefully and answers with the depth and craft a seasoned professional would bring.'; } },
    { key: 'objective',   label: 'Objective',                  placeholder: 'Write a 200-word landing page hero…',
      helper: 'Define the exact result you want.',
      auto: function (goal) { return 'Deliver a complete answer to the request, prioritizing clarity and immediate usefulness over breadth.'; } },
    { key: 'audience',    label: 'Audience',                   placeholder: 'Busy founders evaluating tools in under 60 seconds.',
      helper: 'Tell AI who the answer is for.',
      auto: function () { return 'Smart adult reader, no specific expertise required. Avoid jargon unless you define it.'; } },
    { key: 'context',     label: 'Context',                    placeholder: 'My product is …',
      helper: 'Add background details AI needs to understand the task.',
      auto: function () { return 'Use only the information provided in the request. If anything important is missing, briefly state the assumption you made.'; } },
    { key: 'constraints', label: 'Constraints',                placeholder: 'Under 200 words. No emojis. American English.',
      helper: 'Set rules, limits, or requirements AI must follow.',
      auto: function () { return 'Keep the response focused; cut anything that does not directly help the reader. No filler phrases.'; } },
    { key: 'tone',        label: 'Tone',                       placeholder: 'Direct, confident, lightly witty.',
      helper: 'Choose how the answer should sound.',
      auto: function () { return 'Clear, confident, conversational. Sound like a trusted human expert, not a corporate PR statement.'; } },
    { key: 'format',      label: 'Output Format',              placeholder: '1) Hook 2) Subhead 3) 3 bullet benefits 4) CTA',
      helper: 'Choose the shape of the answer, like checklist, table, email, or step-by-step plan.',
      auto: function () { return 'Use short paragraphs, bolded mini-headers if there is more than one section, and a numbered or bulleted list when items are parallel.'; } },
    { key: 'examples',    label: 'Examples',                   placeholder: 'Good: "Stripe for invoicing." Bad: "We help businesses succeed."',
      helper: 'Show AI what a good answer should resemble.',
      auto: function () { return 'When useful, include one short example to illustrate the pattern you want.'; } },
    { key: 'avoid',       label: 'Avoid Rules',                placeholder: 'No clichés. No "leverage", "synergy", "unlock potential".',
      helper: 'Tell AI what not to include.',
      auto: function () { return 'Avoid hype words ("revolutionary", "game-changing"), corporate clichés, generic disclaimers, and apologetic hedging.'; } },
    { key: 'next',        label: 'Next Steps',                 placeholder: 'After answering, suggest 2 ways to test it.',
      helper: 'What AI should suggest after the main answer.',
      auto: function () { return 'After the main answer, suggest one concrete next step the reader can take in the next 10 minutes.'; } },
    { key: 'success',     label: 'Success Criteria',           placeholder: 'Reader can ship this in 5 minutes without edits.',
      helper: 'Define what a great answer must accomplish.',
      auto: function () { return 'A great answer is specific, immediately actionable, and would not need a follow-up clarification round.'; } },
    { key: 'questions',   label: 'Clarifying Questions First', placeholder: 'Ask me up to 3 questions before drafting.',
      helper: 'Ask questions before answering if important details are missing.',
      auto: function () { return 'Before drafting, list any 1-3 critical unknowns as a short numbered list and stop. Wait for my answers before producing the full response.'; } }
  ];

  /* =====================================================================
   * Tune: toggles + sliders
   * ===================================================================== */
  var TUNE_TOGGLES = [
    { key: 'askFirst',    label: 'Ask Questions First',         text: 'Before answering, list any 1-3 critical unknowns as a short numbered list and stop.' },
    { key: 'defaults',    label: 'Assume Reasonable Defaults',  text: 'Where the request is ambiguous, pick the most useful default and state it briefly before answering.' },
    { key: 'challenge',   label: 'Challenge My Assumptions',    text: 'If the request contains a faulty premise or a likely-bad approach, name it before answering.' },
    { key: 'directFirst', label: 'Give Direct Answer First',    text: 'Lead with the answer. Put any reasoning, caveats, or alternatives after.' },
    { key: 'reasoning',   label: 'Show Reasoning Summary',      text: 'After the answer, include a 2-3 sentence "Why" section explaining the key reasoning.' },
    { key: 'examples',    label: 'Use Examples',                text: 'Include at least one concrete example to illustrate the main point.' },
    { key: 'noGeneric',   label: 'Avoid Generic Advice',        text: 'No generic advice ("be authentic", "know your audience"). Every recommendation must be specific and actionable.' },
    { key: 'execution',   label: 'Prioritize Execution',        text: 'Bias toward what the reader can ship today over theory or background.' },
    { key: 'human',       label: 'Make It More Human',          text: 'Sound like a trusted person, not a corporate document. Use contractions, vary sentence length, drop the hedging.' },
    { key: 'lessRobotic', label: 'Make It Less Robotic',        text: 'Skip the boilerplate intro and outro. No "Certainly!" or "I hope this helps."' }
  ];
  var TUNE_SLIDERS = [
    { key: 'warmth',     left: 'Direct',       right: 'Warm',
      text: function (v) { return v < 33 ? 'Be blunt and direct. Skip pleasantries.' : v > 66 ? 'Be warm, encouraging, and human in tone.' : null; } },
    { key: 'depth',      left: 'Simple',       right: 'Detailed',
      text: function (v) { return v < 33 ? 'Keep it short and at a beginner-friendly level.' : v > 66 ? 'Go deep with detail, nuance, and edge cases.' : null; } },
    { key: 'formality',  left: 'Casual',       right: 'Professional',
      text: function (v) { return v < 33 ? 'Casual, conversational tone — like a friend texting.' : v > 66 ? 'Professional tone suitable for a business setting.' : null; } },
    { key: 'risk',       left: 'Safe',         right: 'Bold',
      text: function (v) { return v < 33 ? 'Stick to safe, widely-accepted recommendations.' : v > 66 ? 'Be bold. Make a strong call even if it goes against conventional advice.' : null; } },
    { key: 'creativity', left: 'Plain',        right: 'Creative',
      text: function (v) { return v < 33 ? 'Plain and literal. No flourishes.' : v > 66 ? 'Be creative and surprising in approach.' : null; } },
    { key: 'length',     left: 'Short',        right: 'Deep',
      text: function (v) { return v < 33 ? 'Keep the response under ~150 words.' : v > 66 ? 'Take the space you need — go deep where it adds value.' : null; } }
  ];
  var VARIATIONS = [
    { id: 'fast',     label: 'Fast & Simple',         subtitle: 'A shorter prompt for quick results.',
      wrap: function (p) { return p + '\n\nDeliver this in the fastest, simplest form: short paragraphs, plain language, no preamble. Lead with the answer. Skip pleasantries.'; } },
    { id: 'detailed', label: 'Detailed & Strategic',  subtitle: 'A more detailed prompt for stronger planning and execution.',
      wrap: function (p) { return p + '\n\nDeliver this with strategic depth: structured sections, key reasoning explained, edge cases addressed, and one concrete next step. Use bolded mini-headers and short paragraphs.'; } },
    { id: 'bold',     label: 'Bold & Persuasive',     subtitle: 'A more direct prompt with stronger language and sharper instructions.',
      wrap: function (p) { return p + '\n\nDeliver this with conviction: take a strong point of view, drop the hedging, name what is wrong about the obvious approach, and give the reader a single clear recommendation. Be persuasive without being a salesperson.'; } }
  ];

  /* =====================================================================
   * Prompt builders
   * ===================================================================== */
  function buildEngineeredPrompt(goal, sections) {
    var parts = [];
    var blocks = [];
    ENGINEER_SECTIONS.forEach(function (def) {
      var s = sections[def.key];
      if (!s || s.mode === 'off') return;
      var body = s.mode === 'auto' ? def.auto(goal) : (s.value || '').trim();
      if (!body) return;
      blocks.push({ label: def.label, body: body });
    });
    if (!blocks.length) return goal || '';
    blocks.forEach(function (b) {
      parts.push('## ' + b.label + '\n' + b.body);
    });
    parts.push('## Request\n' + (goal || '').trim());
    return parts.join('\n\n');
  }
  function buildTunedPrompt(goal, tune) {
    var lines = [];
    TUNE_TOGGLES.forEach(function (t) {
      if (tune.toggles && tune.toggles[t.key]) lines.push('- ' + t.text);
    });
    TUNE_SLIDERS.forEach(function (s) {
      var v = tune.sliders ? tune.sliders[s.key] : 50;
      if (typeof v !== 'number') v = 50;
      var msg = s.text(v);
      if (msg) lines.push('- ' + msg);
    });
    if (!lines.length) return goal || '';
    return (goal || '').trim() + '\n\n## Style & Behavior\n' + lines.join('\n');
  }

  /* =====================================================================
   * Status pill (small "Expert Settings Applied" indicator near goal)
   * ===================================================================== */
  var _appliedThisSession = false;
  function showStatusPill(message) {
    _appliedThisSession = true;
    var goal = $('#goal');
    if (!goal) return;
    var anchor = goal.parentNode;
    if (!anchor) return;
    var pill = $('#pmg-expert-applied-pill');
    if (!pill) {
      pill = el('div', {
        id: 'pmg-expert-applied-pill',
        class: 'pmg-expert-applied-pill',
        role: 'status',
        'aria-live': 'polite'
      });
      anchor.insertBefore(pill, goal);
    }
    pill.textContent = '✓ ' + (message || 'Expert Settings Applied');
    pill.classList.remove('is-flash');
    void pill.offsetWidth;
    pill.classList.add('is-flash');
  }

  /* =====================================================================
   * AI helpers — uses /api/generate via window.__pmgAI when available,
   * falls back to direct fetch.
   * ===================================================================== */
  function aiGenerate(prompt) {
    return new Promise(function (resolve, reject) {
      /* caps-enforcement-1 (2026-05-13): tag Expert Command Center calls
         with feature:"expert" so the backend's denyExpertIfPaywalled gate
         in routes/ai.ts can isolate them from generic /api/generate
         traffic (Auto-Boost, Tuning, etc.). Pre-July-1 the backend
         ignores the field; post-July-1 it returns 403 to free/anonymous
         users, matching the existing UI gate. */
      var body = JSON.stringify({ prompt: prompt, feature: 'expert' });
      fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        credentials: 'same-origin'
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { reject(new Error('HTTP ' + r.status + ': ' + (t || ''))); });
        return r.json().then(function (j) {
          var text = (j && (j.text || j.output || j.result || j.completion)) || '';
          if (!text) return reject(new Error('No text returned'));
          resolve(String(text));
        });
      }).catch(reject);
    });
  }

  /* =====================================================================
   * Drawer construction
   * ===================================================================== */
  var _root = null;        /* host element */
  var _backdrop = null;
  var _panel = null;
  var _tabs = null;
  var _bodies = {};
  var _activeTab = 'diagnose';
  var _previousFocus = null;
  var _isOpen = false;
  var _state = readState();
  if (!_state.engineer) _state.engineer = {};
  if (!_state.tune) _state.tune = { toggles: {}, sliders: {} };
  if (!_state.insider) _state.insider = {};

  function injectStyles() {
    if (document.getElementById('pmg-expert-center-css')) return;
    var css = '' +
      '#pmg-expert-center-root{position:fixed;inset:0;z-index:99999;pointer-events:none;}' +
      '#pmg-expert-center-root.is-open{pointer-events:auto;}' +
      '.pmg-ec-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);opacity:0;transition:opacity .22s ease;}' +
      '#pmg-expert-center-root.is-open .pmg-ec-backdrop{opacity:1;}' +
      '.pmg-ec-panel{position:absolute;top:0;right:0;bottom:0;width:min(560px,100%);background:var(--color-surface,#fff);color:var(--color-text,#0f172a);' +
        'box-shadow:-12px 0 32px rgba(15,23,42,.18);transform:translateX(100%);transition:transform .26s cubic-bezier(.2,.8,.2,1);' +
        'display:flex;flex-direction:column;outline:none;}' +
      '#pmg-expert-center-root.is-open .pmg-ec-panel{transform:translateX(0);}' +
      '@media (max-width:860px){.pmg-ec-panel{width:100%;}}' +
      '.pmg-ec-head{padding:14px 16px;border-bottom:1px solid var(--color-border,#e2e8f0);display:flex;align-items:center;gap:10px;}' +
      '.pmg-ec-head h2{margin:0;font-size:1.05rem;font-weight:700;flex:1;display:flex;align-items:center;gap:8px;}' +
      '.pmg-ec-head .pmg-ec-paid-badge{display:inline-block;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--color-primary,#0f766e) 15%,transparent);color:var(--color-primary,#0f766e);font-size:.7rem;font-weight:700;letter-spacing:.04em;}' +
      '.pmg-ec-close{appearance:none;border:0;background:transparent;color:var(--color-text-muted,#475569);font-size:1.5rem;line-height:1;padding:6px 10px;border-radius:8px;cursor:pointer;}' +
      '.pmg-ec-close:hover,.pmg-ec-close:focus-visible{background:color-mix(in srgb,var(--color-text,#0f172a) 8%,transparent);outline:none;}' +
      '.pmg-ec-tabs{display:flex;gap:0;border-bottom:1px solid var(--color-border,#e2e8f0);overflow-x:auto;-webkit-overflow-scrolling:touch;}' +
      '.pmg-ec-tab{flex:0 0 auto;appearance:none;border:0;background:transparent;color:var(--color-text-muted,#475569);padding:10px 14px;font-size:.92rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;}' +
      '.pmg-ec-tab[aria-selected="true"]{color:var(--color-primary,#0f766e);border-bottom-color:var(--color-primary,#0f766e);}' +
      '.pmg-ec-tab:focus-visible{outline:2px solid var(--color-primary,#0f766e);outline-offset:-2px;}' +
      '.pmg-ec-body{flex:1;overflow-y:auto;padding:16px;}' +
      '.pmg-ec-tabpane{display:none;}' +
      '.pmg-ec-tabpane.is-active{display:block;}' +
      '.pmg-ec-empty{padding:24px;text-align:center;border:1px dashed var(--color-border,#e2e8f0);border-radius:10px;color:var(--color-text-muted,#475569);}' +
      '.pmg-ec-score-card{padding:14px;border:1px solid var(--color-border,#e2e8f0);border-radius:12px;margin-bottom:14px;background:color-mix(in srgb,var(--color-primary,#0f766e) 4%,transparent);}' +
      '.pmg-ec-score-row{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;}' +
      '.pmg-ec-score-num{font-size:2rem;font-weight:800;color:var(--color-primary,#0f766e);}' +
      '.pmg-ec-score-label{font-weight:700;}' +
      '.pmg-ec-score-meta{margin-left:auto;color:var(--color-text-muted,#475569);font-size:.85rem;}' +
      '.pmg-ec-bar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--color-text,#0f172a) 8%,transparent);overflow:hidden;}' +
      '.pmg-ec-bar > span{display:block;height:100%;background:var(--color-primary,#0f766e);transition:width .3s ease;}' +
      '.pmg-ec-section{margin-bottom:18px;}' +
      '.pmg-ec-section h3{margin:0 0 8px;font-size:.95rem;font-weight:700;}' +
      '.pmg-ec-list{margin:0;padding-left:18px;color:var(--color-text-muted,#475569);}' +
      '.pmg-ec-list li{margin-bottom:4px;}' +
      '.pmg-ec-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;}' +
      '.pmg-ec-actions button{appearance:none;border:1px solid var(--color-border,#e2e8f0);background:var(--color-surface,#fff);color:var(--color-text,#0f172a);padding:10px 12px;border-radius:10px;font-weight:600;cursor:pointer;text-align:left;font-size:.88rem;line-height:1.25;transition:background .15s,border-color .15s;}' +
      '.pmg-ec-actions button:hover,.pmg-ec-actions button:focus-visible{border-color:var(--color-primary,#0f766e);background:color-mix(in srgb,var(--color-primary,#0f766e) 6%,transparent);outline:none;}' +
      '.pmg-ec-actions button[disabled]{opacity:.5;cursor:not-allowed;}' +
      '.pmg-ec-engineer-row{display:grid;grid-template-columns:1fr;gap:6px;padding:10px 12px;border:1px solid var(--color-border,#e2e8f0);border-radius:10px;margin-bottom:8px;background:var(--color-surface,#fff);}' +
      '.pmg-ec-engineer-row > header{display:flex;align-items:center;gap:8px;}' +
      '.pmg-ec-engineer-row label.pmg-ec-engineer-name{font-weight:600;flex:1;}' +
      '.pmg-ec-engineer-helper{margin:0;color:var(--color-text-muted,#475569);font-size:.82rem;line-height:1.4;}' +
      '.pmg-ec-intro{margin:0 0 14px;color:var(--color-text-muted,#475569);font-size:.92rem;line-height:1.45;}' +
      '.pmg-ec-section-helper{margin:-4px 0 8px;color:var(--color-text-muted,#475569);font-size:.85rem;line-height:1.4;}' +
      '.pmg-ec-mode-group{display:inline-flex;border:1px solid var(--color-border,#e2e8f0);border-radius:999px;overflow:hidden;}' +
      '.pmg-ec-mode-group button{appearance:none;background:transparent;border:0;padding:4px 10px;font-size:.78rem;font-weight:600;color:var(--color-text-muted,#475569);cursor:pointer;}' +
      '.pmg-ec-mode-group button[aria-pressed="true"]{background:var(--color-primary,#0f766e);color:#fff;}' +
      '.pmg-ec-engineer-row textarea{width:100%;min-height:60px;padding:8px 10px;border:1px solid var(--color-border,#e2e8f0);border-radius:8px;font-family:inherit;font-size:.88rem;resize:vertical;background:var(--color-bg,#fff);color:var(--color-text,#0f172a);}' +
      '.pmg-ec-engineer-row textarea:focus-visible{outline:2px solid var(--color-primary,#0f766e);outline-offset:-2px;border-color:transparent;}' +
      '.pmg-ec-engineer-row[data-mode="off"] textarea{display:none;}' +
      '.pmg-ec-engineer-row[data-mode="auto"] textarea{display:none;}' +
      '.pmg-ec-engineer-row[data-mode="auto"] .pmg-ec-engineer-auto-hint{display:block;}' +
      '.pmg-ec-engineer-auto-hint{display:none;font-size:.82rem;color:var(--color-text-muted,#475569);font-style:italic;}' +
      '.pmg-ec-preview{margin-top:14px;padding:12px;border:1px dashed var(--color-border,#e2e8f0);border-radius:10px;background:color-mix(in srgb,var(--color-primary,#0f766e) 3%,transparent);}' +
      '.pmg-ec-preview h4{margin:0 0 6px;font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted,#475569);}' +
      '.pmg-ec-preview pre{margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem;line-height:1.45;max-height:240px;overflow:auto;}' +
      '.pmg-ec-tune-toggle{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--color-border,#e2e8f0);border-radius:10px;margin-bottom:6px;cursor:pointer;}' +
      '.pmg-ec-tune-toggle input{margin-top:3px;}' +
      '.pmg-ec-tune-toggle .lbl{font-weight:600;}' +
      '.pmg-ec-tune-toggle .desc{display:block;font-size:.82rem;color:var(--color-text-muted,#475569);margin-top:2px;}' +
      '.pmg-ec-slider{margin:14px 0;}' +
      '.pmg-ec-slider .pmg-ec-slider-name{display:block;font-size:.88rem;font-weight:700;color:var(--color-text,#0f172a);margin-bottom:6px;}' +
      '.pmg-ec-slider header{display:flex;justify-content:space-between;font-size:.82rem;color:var(--color-text-muted,#475569);margin-bottom:4px;}' +
      '.pmg-ec-slider input[type=range]{width:100%;}' +
      '.pmg-ec-slider .pmg-ec-slider-readout{display:block;margin-top:6px;font-size:.82rem;font-style:italic;color:var(--color-text-muted,#475569);min-height:1.1em;}' +
      '.pmg-ec-insider-field{margin-bottom:14px;}' +
      '.pmg-ec-insider-field label{display:block;font-size:.88rem;font-weight:700;margin-bottom:4px;color:var(--color-text,#0f172a);}' +
      '.pmg-ec-insider-field textarea{width:100%;min-height:72px;padding:8px 10px;border:1px solid var(--color-border,#cbd5e1);border-radius:8px;font-family:inherit;font-size:.92rem;line-height:1.4;resize:vertical;box-sizing:border-box;background:var(--color-surface,#fff);color:var(--color-text,#0f172a);}' +
      '.pmg-ec-insider-field textarea:focus{outline:none;border-color:var(--color-primary,#0f766e);box-shadow:0 0 0 3px rgba(15,118,110,.18);}' +
      '.pmg-ec-variation{padding:12px;border:1px solid var(--color-border,#e2e8f0);border-radius:12px;margin-bottom:10px;}' +
      '.pmg-ec-variation header{display:flex;align-items:center;gap:10px;margin-bottom:6px;}' +
      '.pmg-ec-variation header h3{margin:0;font-size:.95rem;}' +
      '.pmg-ec-variation header .sub{color:var(--color-text-muted,#475569);font-size:.82rem;margin-left:auto;}' +
      '.pmg-ec-variation pre{margin:0 0 10px;white-space:pre-wrap;font-family:inherit;font-size:.86rem;line-height:1.45;max-height:160px;overflow:auto;background:color-mix(in srgb,var(--color-text,#0f172a) 4%,transparent);padding:8px 10px;border-radius:8px;}' +
      '.pmg-ec-cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--color-border,#e2e8f0);}' +
      '.pmg-ec-cta-row button,.pmg-ec-cta-row a{appearance:none;border:1px solid var(--color-border,#e2e8f0);background:var(--color-surface,#fff);color:var(--color-text,#0f172a);padding:10px 14px;border-radius:10px;font-weight:600;cursor:pointer;text-decoration:none;font-size:.92rem;}' +
      '.pmg-ec-cta-row .pmg-ec-primary{background:var(--color-primary,#0f766e);border-color:var(--color-primary,#0f766e);color:#fff;}' +
      '.pmg-ec-cta-row .pmg-ec-primary:hover,.pmg-ec-cta-row .pmg-ec-primary:focus-visible{filter:brightness(1.05);outline:none;}' +
      '.pmg-ec-cta-row button:hover,.pmg-ec-cta-row a:hover{border-color:var(--color-primary,#0f766e);}' +
      '.pmg-ec-paywall{padding:20px;border-radius:12px;border:1px solid color-mix(in srgb,var(--color-primary,#0f766e) 30%,transparent);background:color-mix(in srgb,var(--color-primary,#0f766e) 6%,transparent);}' +
      '.pmg-ec-paywall h3{margin:0 0 8px;}' +
      '.pmg-ec-paywall p{margin:0 0 10px;color:var(--color-text-muted,#475569);}' +
      '.pmg-ec-loading{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:pmg-ec-spin .7s linear infinite;vertical-align:middle;margin-right:6px;}' +
      '@keyframes pmg-ec-spin{to{transform:rotate(360deg);}}' +
      '.pmg-ec-status{margin-top:8px;font-size:.85rem;color:var(--color-text-muted,#475569);min-height:1.2em;}' +
      '.pmg-expert-applied-pill{display:inline-flex;align-items:center;padding:4px 10px;margin:0 0 6px;border-radius:999px;background:color-mix(in srgb,var(--color-primary,#0f766e) 12%,transparent);color:var(--color-primary,#0f766e);font-size:.78rem;font-weight:700;letter-spacing:.02em;align-self:flex-start;width:fit-content;}' +
      '.pmg-expert-applied-pill.is-flash{animation:pmg-ec-pillpop .5s ease;}' +
      '@keyframes pmg-ec-pillpop{0%{transform:scale(.85);opacity:.5}50%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){.pmg-ec-panel,.pmg-ec-backdrop{transition:none !important;}.pmg-expert-applied-pill.is-flash,.pmg-ec-loading{animation:none !important;}}';
    var style = el('style', { id: 'pmg-expert-center-css', html: css });
    document.head.appendChild(style);
  }

  function buildShell() {
    if (_root) return;
    injectStyles();
    _root = el('div', { id: 'pmg-expert-center-root', 'aria-hidden': 'true' });
    _backdrop = el('div', { class: 'pmg-ec-backdrop', onclick: function () { closeDrawer(); } });
    _panel = el('div', {
      class: 'pmg-ec-panel', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'pmg-ec-title', tabindex: '-1'
    });
    var head = el('div', { class: 'pmg-ec-head' }, [
      el('h2', { id: 'pmg-ec-title' }, [
        '⚙ Expert Command Center',
        el('span', { class: 'pmg-ec-paid-badge', title: 'Paid feature — free during open beta' }, 'PAID')
      ]),
      el('button', { class: 'pmg-ec-close', type: 'button', 'aria-label': 'Close Expert Command Center', onclick: function () { closeDrawer(); } }, '×')
    ]);
    var TABS = [
      { id: 'diagnose',   label: 'Find Weak Spots',   help: 'Find what is weak, missing, or unclear before you run your prompt.' },
      { id: 'insider',    label: 'Make It Yours',     help: "Give the AI the context it couldn't possibly know about your business, voice, and rules." },
      { id: 'engineer',   label: 'Correct the AI',    help: 'Control how your prompt is structured before AI answers.' },
      { id: 'tune',       label: 'Set the Guardrails', help: 'Dial in voice and depth with toggles and sliders.' },
      { id: 'variations', label: 'Variations',        help: 'Create different versions of your prompt for different styles or goals.' },
      { id: 'save',       label: 'Vault',             help: 'Save prompt setups you may want to reuse later.' }
    ];
    _tabs = el('div', { class: 'pmg-ec-tabs', role: 'tablist' });
    var body = el('div', { class: 'pmg-ec-body' });
    TABS.forEach(function (t) {
      var btn = el('button', {
        class: 'pmg-ec-tab', type: 'button', role: 'tab',
        id: 'pmg-ec-tab-' + t.id, 'aria-controls': 'pmg-ec-pane-' + t.id,
        'aria-selected': t.id === _activeTab ? 'true' : 'false',
        tabindex: t.id === _activeTab ? '0' : '-1',
        title: t.help || null,
        onclick: function () { switchTab(t.id); }
      }, t.label);
      _tabs.appendChild(btn);
      var pane = el('section', {
        class: 'pmg-ec-tabpane' + (t.id === _activeTab ? ' is-active' : ''),
        id: 'pmg-ec-pane-' + t.id, role: 'tabpanel', 'aria-labelledby': 'pmg-ec-tab-' + t.id,
        tabindex: '0'
      });
      _bodies[t.id] = pane;
      body.appendChild(pane);
    });
    _panel.appendChild(head);
    _panel.appendChild(_tabs);
    _panel.appendChild(body);
    _root.appendChild(_backdrop);
    _root.appendChild(_panel);
    document.body.appendChild(_root);

    /* Keyboard handling — Tab/Arrow are scoped to the panel; ESC is
       handled globally below so it works even if focus is inside an
       input/textarea where some pages stop propagation. */
    _panel.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') trapFocus(e);
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'tab') {
        e.preventDefault();
        var ids = TABS.map(function (t) { return t.id; });
        var idx = ids.indexOf(_activeTab);
        var next = e.key === 'ArrowRight' ? (idx + 1) % ids.length : (idx - 1 + ids.length) % ids.length;
        switchTab(ids[next]);
        var nextBtn = $('#pmg-ec-tab-' + ids[next], _tabs);
        if (nextBtn) nextBtn.focus();
      }
    });

    /* Global ESC handler — capture phase. Closes the drawer whenever
       the drawer is the topmost overlay. Yields to ANY other overlay
       that may be on top so we never steal ESC from a sibling: native
       <dialog> elements, the command palette (#pmg-cmdk-backdrop),
       and any element using the app-wide `.is-open` overlay
       convention (compare, backup, onboarding tour, workstation tour,
       etc.). This selector mirrors the canonical "is any overlay
       open?" check used elsewhere in index.html. */
    var OVERLAY_SELECTOR = 'dialog[open], #pmg-cmdk-backdrop:not([hidden]), .is-open';
    document.addEventListener('keydown', function (e) {
      if (!_isOpen) return;
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      /* Find any other overlay that's open right now. The drawer
         itself uses `.is-open` on _root, so exclude that. */
      var others = document.querySelectorAll(OVERLAY_SELECTOR);
      for (var i = 0; i < others.length; i++) {
        if (others[i] !== _root) return; /* yield ESC to that overlay */
      }
      e.preventDefault();
      e.stopPropagation();
      closeDrawer();
    }, true);
  }

  function switchTab(id) {
    if (!_bodies[id]) return;
    _activeTab = id;
    $$('.pmg-ec-tab', _tabs).forEach(function (b) {
      var on = b.id === 'pmg-ec-tab-' + id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
    Object.keys(_bodies).forEach(function (k) {
      _bodies[k].classList.toggle('is-active', k === id);
    });
    renderActivePane();
    track('expert_center_tab_view', { tab: id });
  }

  function renderActivePane() {
    var pane = _bodies[_activeTab];
    if (!pane) return;
    pane.innerHTML = '';
    if (_activeTab === 'diagnose')   renderDiagnose(pane);
    else if (_activeTab === 'insider')    renderInsider(pane);
    else if (_activeTab === 'engineer')   renderEngineer(pane);
    else if (_activeTab === 'tune')       renderTune(pane);
    else if (_activeTab === 'variations') renderVariations(pane);
    else if (_activeTab === 'save')       renderSave(pane);
  }

  /* =====================================================================
   * DIAGNOSE pane
   * ===================================================================== */
  function renderDiagnose(pane) {
    var goal = getGoalText().trim();
    if (!goal) {
      pane.appendChild(el('div', { class: 'pmg-ec-empty' }, [
        'Type a goal in the main prompt box to see your prompt strength score.',
        el('br'), el('br'),
        el('button', { class: 'pmg-ec-primary', type: 'button', onclick: function () { goToPromptBox(); }, style: 'padding:10px 14px;border-radius:10px;border:0;background:var(--color-primary,#0f766e);color:#fff;font-weight:600;cursor:pointer;' }, 'Go To Prompt Box')
      ]));
      return;
    }
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      'Find what is weak, missing, or unclear before you run your prompt.'));

    var s = scorePrompt(goal);
    var verdictText = verdictEnglish(s);
    var cardKids = [
      el('div', { class: 'pmg-ec-score-row' }, [
        el('span', { class: 'pmg-ec-score-num' }, String(s.score)),
        el('span', { class: 'pmg-ec-score-label' }, s.label),
        el('span', { class: 'pmg-ec-score-meta' }, s.wc + ' words')
      ])
    ];
    if (verdictText) {
      cardKids.push(el('p', {
        class: 'pmg-ec-verdict',
        style: 'margin:8px 0 10px;color:var(--color-text,#0f172a);font-size:.92rem;line-height:1.5;'
      }, verdictText));
    }
    cardKids.push(el('div', { class: 'pmg-ec-bar', 'aria-hidden': 'true' }, el('span', { style: 'width:' + s.score + '%' })));
    var card = el('div', { class: 'pmg-ec-score-card' }, cardKids);
    pane.appendChild(el('div', { class: 'pmg-ec-section' }, [
      el('h3', null, 'Prompt Strength Analyzer'),
      el('p', { class: 'pmg-ec-section-helper' }, 'Scores your prompt and shows the biggest thing to fix.'),
      card
    ]));

    if (s.weakest) {
      pane.appendChild(el('div', { class: 'pmg-ec-section' }, [
        el('h3', null, 'Biggest Fix'),
        el('p', { class: 'pmg-ec-section-helper' }, 'The one change most likely to improve your result.'),
        el('p', { style: 'margin:0;color:var(--color-text-muted,#475569);' }, s.weakest.label)
      ]));
    }
    if (s.missing.length) {
      var ul = el('ul', { class: 'pmg-ec-list' });
      s.missing.slice(0, 6).forEach(function (m) { ul.appendChild(el('li', null, m.label)); });
      pane.appendChild(el('div', { class: 'pmg-ec-section' }, [
        el('h3', null, 'Missing Context Detector'),
        el('p', { class: 'pmg-ec-section-helper' }, 'Finds missing details like audience, goal, tone, format, or examples.'),
        ul
      ]));
    }

    var status = el('div', { class: 'pmg-ec-status', 'aria-live': 'polite' });
    var actions = el('div', { class: 'pmg-ec-actions' });
    function makeBtn(label, fn, tip) {
      var attrs = { type: 'button', onclick: fn };
      if (tip) attrs.title = tip;
      return el('button', attrs, label);
    }
    actions.appendChild(makeBtn('Fix This Like A Prompt Architect', function () { fixLikeEngineer(status); }, 'Rewrite your prompt with role, audience, format, tone, constraints, and a success criterion.'));
    actions.appendChild(makeBtn('Ask Me 5 Questions', function () { askFiveQuestions(status); }, 'Generate 5 short clarifying questions to refine your goal before AI answers.'));
    actions.appendChild(makeBtn('Auto-Fill Safe Defaults', function () { autoFillDefaults(); status.textContent = 'Default Architect settings applied. Open the Architect tab to fine-tune, or tap Apply To Main Prompt below.'; }, 'Pre-fill safe Architect defaults so you can fine-tune from a sensible starting point.'));
    actions.appendChild(makeBtn('Add Missing Context', function () { addMissingContext(status); }, 'Inserts a checklist of details your prompt is missing, ready for you to fill in.'));
    actions.appendChild(makeBtn('Pressure Test Prompt', function () { pressureTest(status); }, 'Risk Checker — flags vague, risky, confusing, or overbroad instructions.'));
    pane.appendChild(el('div', { class: 'pmg-ec-section' }, [
      el('h3', null, 'One-Tap Fixes'),
      el('p', { class: 'pmg-ec-section-helper' }, 'Hover any button for a short description of what it does.'),
      actions
    ]));
    pane.appendChild(status);

    pane.appendChild(buildCtaRow([
      { label: 'Switch To Architect', primary: false, onclick: function () { switchTab('engineer'); } },
      { label: 'Apply To Main Prompt', primary: true, onclick: function () {
          var __prevGoal = getGoalText();
          var built = buildEngineeredPrompt(getGoalText().trim(), _state.engineer);
          var tuned = buildTunedPrompt(built, _state.tune);
          setGoalText(tuned);
          showStatusPill('Expert Settings Applied');
          track('expert_center_apply', { source: 'diagnose' });
          applyAndClose();
          /* eccb-1: surface a "what + why" banner under #goal after the
             drawer closes (applyAndClose has an ~80ms scroll delay). */
          setTimeout(function () {
            try {
              if (window.pmgEccChanges && window.pmgEccChanges.showSettings) {
                window.pmgEccChanges.showSettings({
                  source: 'diagnose',
                  previousGoal: __prevGoal,
                  engineer: _state.engineer,
                  tune: _state.tune
                });
              }
            } catch (_) {}
          }, 220);
        } }
    ]));
  }

  function fixLikeEngineer(statusEl) {
    var goal = getGoalText().trim();
    if (!goal) { statusEl.textContent = 'Type a goal first.'; return; }
    var __prevGoal = getGoalText();
    statusEl.innerHTML = '<span class="pmg-ec-loading"></span>Rewriting like a prompt architect…';
    var instruction = 'You are a senior prompt engineer. Rewrite the request below as a high-quality prompt that any modern AI assistant could answer well. ' +
      'Add: a clear role for the AI to play, the target audience, the desired output format, the tone, 2-3 useful constraints, and a one-line success criterion. ' +
      'Keep the original intent. Output ONLY the rewritten prompt — no preamble, no explanation, no markdown fences.\n\nORIGINAL REQUEST:\n' + goal;
    aiGenerate(instruction).then(function (text) {
      var __newGoal = text.trim();
      setGoalText(__newGoal);
      showStatusPill('Prompt Rewritten');
      track('expert_center_fix_engineer');
      statusEl.textContent = 'Done. Your prompt has been rewritten in the main goal box.';
      window.setTimeout(function () { renderActivePane(); }, 50);
      /* eccb-1: rewrite-mode banner. Wait long enough for the drawer to
         close if the user dismisses it, then surface the diff banner. */
      setTimeout(function () {
        try {
          if (window.pmgEccChanges && window.pmgEccChanges.showRewrite) {
            window.pmgEccChanges.showRewrite({
              source: 'diagnose',
              previousGoal: __prevGoal,
              newGoal: __newGoal
            });
          }
        } catch (_) {}
      }, 400);
    }).catch(function (err) {
      statusEl.textContent = 'Could not rewrite right now: ' + (err && err.message ? err.message : 'unknown error');
    });
  }
  function askFiveQuestions(statusEl) {
    var goal = getGoalText().trim();
    if (!goal) { statusEl.textContent = 'Type a goal first.'; return; }
    statusEl.innerHTML = '<span class="pmg-ec-loading"></span>Asking the right questions…';
    var instruction = 'Read the request below. Ask exactly five short clarifying questions that, if answered, would let you produce a great response. ' +
      'Number them 1 to 5. No preamble. No closing summary. Each question should be one sentence.\n\nREQUEST:\n' + goal;
    aiGenerate(instruction).then(function (text) {
      var newPrompt = goal + '\n\n## Please Answer These First\n' + text.trim();
      setGoalText(newPrompt);
      showStatusPill('Questions Added');
      statusEl.textContent = 'Five clarifying questions added below your prompt.';
    }).catch(function (err) { statusEl.textContent = 'Could not generate questions: ' + (err && err.message ? err.message : 'unknown error'); });
  }
  function autoFillDefaults() {
    ENGINEER_SECTIONS.forEach(function (def) {
      if (!_state.engineer[def.key] || _state.engineer[def.key].mode === 'off') {
        _state.engineer[def.key] = { mode: 'auto', value: '' };
      }
    });
    writeState(_state);
    track('expert_center_autofill_defaults');
  }
  function addMissingContext(statusEl) {
    var goal = getGoalText().trim();
    if (!goal) { statusEl.textContent = 'Type a goal first.'; return; }
    var s = scorePrompt(goal);
    if (!s.missing.length) { statusEl.textContent = 'No obvious missing context. Try Pressure Test for deeper feedback.'; return; }
    var lines = ['## Add These Details', ''];
    s.missing.slice(0, 5).forEach(function (m) { lines.push('- ' + m.label); });
    setGoalText(goal + '\n\n' + lines.join('\n'));
    showStatusPill('Missing Context Added');
    statusEl.textContent = 'Inserted a checklist of missing context below your prompt — fill in what you can, then run.';
  }
  function pressureTest(statusEl) {
    var goal = getGoalText().trim();
    if (!goal) { statusEl.textContent = 'Type a goal first.'; return; }
    statusEl.innerHTML = '<span class="pmg-ec-loading"></span>Pressure-testing your prompt…';
    var instruction = 'You are a senior prompt-engineering reviewer. Pressure-test the prompt below. ' +
      'In under 180 words, list (a) the single biggest weakness, (b) two specific edge cases the prompt ignores, ' +
      'and (c) the one rewrite that would most improve quality. Be direct. No preamble.\n\nPROMPT TO TEST:\n' + goal;
    aiGenerate(instruction).then(function (text) {
      statusEl.innerHTML = '';
      statusEl.appendChild(el('strong', null, 'Pressure Test Result'));
      statusEl.appendChild(el('div', { style: 'margin-top:6px;white-space:pre-wrap;color:var(--color-text,#0f172a);' }, text.trim()));
    }).catch(function (err) { statusEl.textContent = 'Pressure test failed: ' + (err && err.message ? err.message : 'unknown error'); });
  }

  /* =====================================================================
   * ENGINEER pane
   * ===================================================================== */
  function renderEngineer(pane) {
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      'Control how your prompt is structured before AI answers. Set each section to Off, Auto (we fill it in), or Custom (your own text). The preview below updates live.'));
    ENGINEER_SECTIONS.forEach(function (def) { pane.appendChild(buildEngineerRow(def)); });

    var preview = el('pre');
    var box = el('div', { class: 'pmg-ec-preview' }, [
      el('h4', null, 'Live Preview'), preview
    ]);
    pane.appendChild(box);
    function refresh() {
      var goal = getGoalText().trim();
      var built = buildEngineeredPrompt(goal, _state.engineer);
      preview.textContent = built || '(Type a goal in the main prompt box to see the preview.)';
    }
    refresh();
    pane._refreshPreview = refresh;
    pane.appendChild(buildCtaRow([
      { label: 'Reset To Simple Prompt', primary: false, onclick: function () { _state.engineer = {}; writeState(_state); renderActivePane(); } },
      { label: 'Apply This Structure', primary: true, onclick: function () {
          var goal = getGoalText().trim();
          if (!goal) { window.alert('Type a goal in the main prompt box first.'); return; }
          var __prevGoal = getGoalText();
          var built = buildEngineeredPrompt(goal, _state.engineer);
          setGoalText(built);
          showStatusPill('Architect Structure Applied');
          track('expert_center_apply', { source: 'engineer' });
          applyAndClose();
          setTimeout(function () {
            try {
              if (window.pmgEccChanges && window.pmgEccChanges.showSettings) {
                window.pmgEccChanges.showSettings({
                  source: 'engineer',
                  previousGoal: __prevGoal,
                  engineer: _state.engineer,
                  tune: { toggles: {}, sliders: {} }
                });
              }
            } catch (_) {}
          }, 220);
        } }
    ]));
  }
  function buildEngineerRow(def) {
    var s = _state.engineer[def.key] || { mode: 'off', value: '' };
    _state.engineer[def.key] = s;
    var row = el('div', { class: 'pmg-ec-engineer-row', 'data-mode': s.mode });
    var modes = el('div', { class: 'pmg-ec-mode-group', role: 'group', 'aria-label': def.label + ' mode' });
    ['off','auto','custom'].forEach(function (m) {
      var b = el('button', {
        type: 'button', 'aria-pressed': s.mode === m ? 'true' : 'false',
        onclick: function () {
          s.mode = m;
          row.setAttribute('data-mode', m);
          $$('.pmg-ec-mode-group button', row).forEach(function (bb, i) {
            bb.setAttribute('aria-pressed', ['off','auto','custom'][i] === m ? 'true' : 'false');
          });
          writeState(_state);
          var pane = _bodies.engineer;
          if (pane && pane._refreshPreview) pane._refreshPreview();
        }
      }, m === 'off' ? 'Off' : m === 'auto' ? 'Auto' : 'Custom');
      modes.appendChild(b);
    });
    row.appendChild(el('header', null, [
      el('label', { class: 'pmg-ec-engineer-name' }, def.label),
      modes
    ]));
    if (def.helper) {
      row.appendChild(el('p', { class: 'pmg-ec-engineer-helper' }, def.helper));
    }
    row.appendChild(el('div', { class: 'pmg-ec-engineer-auto-hint' },
      'Auto: ' + def.auto(getGoalText())));
    var ta = el('textarea', { placeholder: def.placeholder, rows: '3' });
    ta.value = s.value || '';
    ta.addEventListener('input', function () {
      s.value = ta.value;
      writeState(_state);
      var pane = _bodies.engineer;
      if (pane && pane._refreshPreview) pane._refreshPreview();
    });
    row.appendChild(ta);
    return row;
  }

  /* =====================================================================
   * INSIDER pane — "Make It Yours"
   * Six textareas the user fills with context the AI can't possibly know
   * (insider language, hard rules, anti-patterns, calibration sample,
   * never-say, always-include). Apply appends a ## Your Rules block to
   * #goal. Re-apply is idempotent — any existing ## Your Rules block is
   * stripped before the new one is appended.
   * ===================================================================== */
  var INSIDER_FIELDS = [
    { key: 'insiderContext',     label: 'Insider Context',     placeholder: "Things only you know \u2014 internal names, proprietary process names, jargon your audience uses that no one outside would recognize." },
    { key: 'hardRules',          label: 'Hard Rules',          placeholder: "Absolute constraints the AI must never violate. E.g. \"Never mention competitors by name.\" \"Always end with a question.\"" },
    { key: 'antiPatterns',       label: 'Anti-Patterns',       placeholder: "Specific phrases or structures the AI defaults to that you hate. E.g. \"Never start a sentence with 'Certainly'.\" \"No bullet lists.\"" },
    { key: 'calibrationExample', label: 'Calibration Example', placeholder: "Paste a sample of your best previous output. The AI will match this standard." },
    { key: 'neverSay',           label: 'Never Say',           placeholder: "Words, phrases, or topics that must never appear in the output." },
    { key: 'alwaysInclude',      label: 'Always Include',      placeholder: "Elements, phrases, or references that must always appear in the output." }
  ];
  var INSIDER_RULES_HEADER = '## Your Rules';

  function stripExistingRulesBlock(goal) {
    if (!goal) return '';
    /* Match `## Your Rules` (optional preceding blank line) through end of
       string or next `## ` heading, then trim trailing whitespace. */
    var rx = /\n*##\s*Your Rules[\s\S]*?(?=\n##\s|$)/;
    return goal.replace(rx, '').replace(/\s+$/, '');
  }

  function buildRulesBlock(state) {
    var lines = [INSIDER_RULES_HEADER];
    var any = false;
    INSIDER_FIELDS.forEach(function (f) {
      var v = (state[f.key] || '').trim();
      if (!v) return;
      lines.push('[' + f.label + ': ' + v + ']');
      any = true;
    });
    return any ? lines.join('\n') : '';
  }

  function renderInsider(pane) {
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      "The AI doesn't know your business, your rules, or your voice. This is where you teach it. Fill in whatever applies \u2014 skip what doesn't."));

    var formWrap = el('div', { class: 'pmg-ec-section' });
    INSIDER_FIELDS.forEach(function (f) {
      var ta = el('textarea', {
        id: 'pmg-ec-insider-' + f.key,
        placeholder: f.placeholder,
        rows: '3'
      });
      ta.value = _state.insider[f.key] || '';
      ta.addEventListener('input', function () {
        _state.insider[f.key] = ta.value;
        writeState(_state);
      });
      formWrap.appendChild(el('div', { class: 'pmg-ec-insider-field' }, [
        el('label', { for: 'pmg-ec-insider-' + f.key }, f.label),
        ta
      ]));
    });
    pane.appendChild(formWrap);

    pane.appendChild(buildCtaRow([
      { label: 'Reset', primary: false, onclick: function () {
          _state.insider = {};
          writeState(_state);
          renderActivePane();
        } },
      { label: 'Apply These Rules', primary: true, onclick: function () {
          var block = buildRulesBlock(_state.insider);
          if (!block) { window.alert('Fill in at least one field to apply your rules.'); return; }
          var current = getGoalText();
          var __prevGoal = current;
          var stripped = stripExistingRulesBlock(current);
          var next = (stripped ? stripped + '\n\n' : '') + block;
          setGoalText(next);
          showStatusPill('Your Rules Applied');
          track('expert_center_apply', { source: 'insider' });
          applyAndClose();
          setTimeout(function () {
            try {
              if (window.pmgEccChanges && window.pmgEccChanges.showSettings) {
                window.pmgEccChanges.showSettings({
                  source: 'insider',
                  previousGoal: __prevGoal,
                  insider: _state.insider
                });
              }
            } catch (_) {}
          }, 220);
        } }
    ]));
  }

  /* =====================================================================
   * TUNE pane
   * ===================================================================== */
  function renderTune(pane) {
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      'Dial in voice and depth. Toggles add specific behavior rules; sliders adjust style intensity (the middle position adds nothing).'));
    var togglesWrap = el('div');
    TUNE_TOGGLES.forEach(function (t) {
      var on = !!_state.tune.toggles[t.key];
      var inp = el('input', { type: 'checkbox' });
      inp.checked = on;
      inp.addEventListener('change', function () {
        _state.tune.toggles[t.key] = inp.checked;
        writeState(_state);
      });
      var lbl = el('label', { class: 'pmg-ec-tune-toggle' }, [
        inp,
        el('span', null, [
          el('span', { class: 'lbl' }, t.label),
          el('span', { class: 'desc' }, t.text)
        ])
      ]);
      togglesWrap.appendChild(lbl);
    });
    pane.appendChild(el('div', { class: 'pmg-ec-section' }, [el('h3', null, 'Behavior Toggles'), togglesWrap]));

    var slidersWrap = el('div');
    TUNE_SLIDERS.forEach(function (s) {
      var v = typeof _state.tune.sliders[s.key] === 'number' ? _state.tune.sliders[s.key] : 50;
      var inp = el('input', { type: 'range', min: '0', max: '100', value: String(v) });
      inp.addEventListener('input', function () {
        _state.tune.sliders[s.key] = parseInt(inp.value, 10);
        writeState(_state);
      });
      var nameLabel = s.key.charAt(0).toUpperCase() + s.key.slice(1);
      var readout = el('span', { class: 'pmg-ec-slider-readout' }, s.text(v) || 'Neutral');
      inp.addEventListener('input', function () {
        var cur = parseInt(inp.value, 10);
        readout.textContent = s.text(cur) || 'Neutral';
      });
      slidersWrap.appendChild(el('div', { class: 'pmg-ec-slider' }, [
        el('span', { class: 'pmg-ec-slider-name' }, nameLabel),
        el('header', null, [el('span', null, s.left), el('span', null, s.right)]),
        inp,
        readout
      ]));
    });
    pane.appendChild(el('div', { class: 'pmg-ec-section' }, [el('h3', null, 'Style Sliders'), slidersWrap]));

    pane.appendChild(buildCtaRow([
      { label: 'Reset Tuning', primary: false, onclick: function () { _state.tune = { toggles: {}, sliders: {} }; writeState(_state); renderActivePane(); } },
      { label: 'Apply Tuning', primary: true, onclick: function () {
          var goal = getGoalText().trim();
          if (!goal) { window.alert('Type a goal in the main prompt box first.'); return; }
          var __prevGoal = getGoalText();
          var built = buildEngineeredPrompt(goal, _state.engineer);
          var tuned = buildTunedPrompt(built, _state.tune);
          setGoalText(tuned);
          showStatusPill('Tuning Applied');
          track('expert_center_apply', { source: 'tune' });
          applyAndClose();
          setTimeout(function () {
            try {
              if (window.pmgEccChanges && window.pmgEccChanges.showSettings) {
                window.pmgEccChanges.showSettings({
                  source: 'tune',
                  previousGoal: __prevGoal,
                  engineer: _state.engineer,
                  tune: _state.tune
                });
              }
            } catch (_) {}
          }, 220);
        } }
    ]));
  }

  /* =====================================================================
   * VARIATIONS pane
   * ===================================================================== */
  function renderVariations(pane) {
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      'Create different versions of your prompt for different styles or goals. Each version is generated separately so you can compare and pick the one that fits.'));
    var goal = getGoalText().trim();
    if (!goal) {
      pane.appendChild(el('div', { class: 'pmg-ec-empty' }, 'Type a goal in the main prompt box first, then come back to generate three variations.'));
      return;
    }
    pane.appendChild(el('p', { style: 'margin:0 0 12px;color:var(--color-text-muted,#475569);' },
      'Tap the button to generate three rewrites of your prompt in different styles. Use the one you like, or compare them side-by-side.'));
    var status = el('div', { class: 'pmg-ec-status', role: 'status', 'aria-live': 'polite' });
    var output = el('div');
    var genBtn = el('button', {
      type: 'button',
      class: 'pmg-ec-primary',
      style: 'padding:10px 14px;border-radius:10px;border:0;background:var(--color-primary,#0f766e);color:#fff;font-weight:700;cursor:pointer;',
      onclick: function () { generateVariations(genBtn, output, status); }
    }, 'Create 3 Versions');
    pane.appendChild(genBtn);
    pane.appendChild(status);
    pane.appendChild(output);
  }
  function generateVariations(btn, output, status) {
    var goal = getGoalText().trim();
    if (!goal) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="pmg-ec-loading"></span>Generating…';
    output.innerHTML = '';
    status.textContent = '';
    var promises = VARIATIONS.map(function (v) {
      return aiGenerate(v.wrap(goal) + '\n\nIMPORTANT: Output ONLY the rewritten prompt. No preamble.').then(function (text) {
        return { id: v.id, label: v.label, subtitle: v.subtitle, text: text.trim() };
      });
    });
    Promise.all(promises).then(function (results) {
      btn.disabled = false; btn.textContent = 'Regenerate 3 Versions';
      results.forEach(function (r) {
        var pre = el('pre');
        pre.textContent = r.text;
        var sendRow = el('div', {
          style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center;'
        }, [
          el('span', { style: 'font-size:.78rem;color:var(--color-text-muted,#475569);font-weight:600;margin-right:2px;' }, 'Send to:')
        ]);
        EC_SEND_DESTS.forEach(function (dest) {
          sendRow.appendChild(el('button', {
            type: 'button',
            'aria-label': 'Send "' + r.label + '" to ' + dest.label,
            style: 'padding:6px 10px;border-radius:8px;border:1px solid var(--color-border,#e2e8f0);background:transparent;font-weight:600;cursor:pointer;font-size:.82rem;',
            onclick: (function (d, text, lbl) { return function () {
              var url = d.prefill ? d.prefill(text) : d.url;
              try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) {}
              track('expert_center_variation_sendto', { variant: r.id, dest: d.id });
              if (d.prefill) {
                status.textContent = 'Opened ' + d.label + ' with "' + lbl + '" prefilled.';
                return;
              }
              status.textContent = 'Opening ' + d.label + ' — copying "' + lbl + '"…';
              try {
                var p = navigator.clipboard && navigator.clipboard.writeText(text);
                if (p && p.then) {
                  p.then(function () {
                    status.textContent = 'Copied "' + lbl + '" to clipboard. Paste into ' + d.label + ' when it opens.';
                  }).catch(function () {
                    status.textContent = 'Could not copy automatically — select the prompt above and copy it manually, then paste into ' + d.label + '.';
                  });
                } else {
                  status.textContent = 'Could not copy automatically — select the prompt above and copy it manually, then paste into ' + d.label + '.';
                }
              } catch (e) {
                status.textContent = 'Could not copy automatically — select the prompt above and copy it manually, then paste into ' + d.label + '.';
              }
            }; })(dest, r.text, r.label)
          }, '↗ ' + dest.label));
        });
        var card = el('div', { class: 'pmg-ec-variation' }, [
          el('header', null, [
            el('h3', null, r.label),
            el('span', { class: 'sub' }, r.subtitle)
          ]),
          pre,
          el('div', { style: 'display:flex;gap:8px;' }, [
            el('button', {
              class: 'pmg-ec-primary', type: 'button',
              style: 'padding:8px 12px;border-radius:8px;border:0;background:var(--color-primary,#0f766e);color:#fff;font-weight:600;cursor:pointer;',
              onclick: function () {
                setGoalText(r.text);
                showStatusPill('Variation Applied: ' + r.label);
                track('expert_center_variation_use', { variant: r.id });
                closeDrawer();
              }
            }, 'Use This Version'),
            el('button', {
              type: 'button',
              style: 'padding:8px 12px;border-radius:8px;border:1px solid var(--color-border,#e2e8f0);background:transparent;font-weight:600;cursor:pointer;',
              onclick: function () {
                try {
                  navigator.clipboard.writeText(r.text);
                  status.textContent = 'Copied "' + r.label + '" to clipboard.';
                } catch (e) { status.textContent = 'Could not copy.'; }
              }
            }, 'Copy')
          ]),
          sendRow
        ]);
        output.appendChild(card);
      });
      track('expert_center_variations_generated');
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = 'Create 3 Versions';
      status.textContent = 'Could not generate variations: ' + (err && err.message ? err.message : 'unknown error');
    });
  }

  /* =====================================================================
   * SAVE pane
   * ===================================================================== */
  function renderSave(pane) {
    pane.appendChild(el('p', { class: 'pmg-ec-intro' },
      'Save prompt setups you may want to reuse later. The current prompt plus your Architect and Tune settings get bundled into a reusable workflow stored locally in your browser.'));
    var nameInput = el('input', {
      type: 'text', placeholder: 'Workflow name (e.g., "Landing Page Hero")',
      style: 'width:100%;padding:10px 12px;border:1px solid var(--color-border,#e2e8f0);border-radius:8px;font-size:.95rem;margin-bottom:8px;'
    });
    var status = el('div', { class: 'pmg-ec-status' });
    var saveBtn = el('button', {
      type: 'button', class: 'pmg-ec-primary',
      style: 'padding:10px 14px;border-radius:10px;border:0;background:var(--color-primary,#0f766e);color:#fff;font-weight:700;cursor:pointer;',
      onclick: function () {
        var name = (nameInput.value || '').trim();
        var goal = getGoalText().trim();
        if (!name) { status.textContent = 'Give your workflow a name first.'; return; }
        if (!goal) { status.textContent = 'Type a prompt in the main goal box first.'; return; }
        var list = readWorkflows();
        list.unshift({
          id: 'wf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: name,
          goal: goal,
          engineer: JSON.parse(JSON.stringify(_state.engineer || {})),
          tune: JSON.parse(JSON.stringify(_state.tune || { toggles: {}, sliders: {} })),
          createdAt: Date.now()
        });
        if (list.length > 50) list.length = 50;
        writeWorkflows(list);
        nameInput.value = '';
        status.textContent = 'Saved.';
        track('expert_center_workflow_save');
        renderActivePane();
      }
    }, 'Save Workflow');
    pane.appendChild(el('div', { class: 'pmg-ec-section' }, [
      el('h3', null, 'Save As Workflow'),
      el('p', { class: 'pmg-ec-section-helper' }, 'Save this setup so you can reuse the same prompt structure again.'),
      nameInput,
      saveBtn,
      status
    ]));

    var list = readWorkflows();
    var listSec = el('div', { class: 'pmg-ec-section' }, el('h3', null, 'Saved Workflows (' + list.length + ')'));
    if (!list.length) {
      listSec.appendChild(el('div', { class: 'pmg-ec-empty' }, 'No saved workflows yet.'));
    } else {
      list.forEach(function (wf) {
        var item = el('div', {
          style: 'padding:10px 12px;border:1px solid var(--color-border,#e2e8f0);border-radius:10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;'
        }, [
          el('div', { style: 'flex:1;min-width:0;' }, [
            el('div', { style: 'font-weight:600;' }, wf.name),
            el('div', { style: 'font-size:.8rem;color:var(--color-text-muted,#475569);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, (wf.goal || '').slice(0, 90))
          ]),
          el('button', {
            type: 'button',
            style: 'padding:6px 10px;border-radius:8px;border:1px solid var(--color-border,#e2e8f0);background:transparent;font-weight:600;cursor:pointer;font-size:.82rem;',
            onclick: function () {
              setGoalText(wf.goal);
              _state.engineer = JSON.parse(JSON.stringify(wf.engineer || {}));
              _state.tune = JSON.parse(JSON.stringify(wf.tune || { toggles: {}, sliders: {} }));
              writeState(_state);
              showStatusPill('Workflow Loaded: ' + wf.name);
              track('expert_center_workflow_load');
              closeDrawer();
            }
          }, 'Load'),
          el('button', {
            type: 'button',
            'aria-label': 'Delete workflow ' + wf.name,
            style: 'padding:6px 10px;border-radius:8px;border:1px solid var(--color-border,#e2e8f0);background:transparent;color:var(--color-text-muted,#475569);font-weight:600;cursor:pointer;font-size:.82rem;',
            onclick: function () {
              if (!window.confirm('Delete workflow "' + wf.name + '"?')) return;
              var l = readWorkflows().filter(function (w) { return w.id !== wf.id; });
              writeWorkflows(l);
              renderActivePane();
            }
          }, 'Delete')
        ]);
        listSec.appendChild(item);
      });
    }
    pane.appendChild(listSec);
  }

  function buildCtaRow(buttons) {
    var row = el('div', { class: 'pmg-ec-cta-row' });
    buttons.forEach(function (b) {
      var node = el('button', {
        type: 'button',
        class: b.primary ? 'pmg-ec-primary' : null,
        onclick: b.onclick
      }, b.label);
      row.appendChild(node);
    });
    return row;
  }

  /* =====================================================================
   * Focus trap
   * ===================================================================== */
  function getFocusable() {
    return $$('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', _panel)
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }
  function trapFocus(e) {
    var nodes = getFocusable();
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* =====================================================================
   * Open / Close
   * ===================================================================== */
  function openDrawer() {
    buildShell();
    if (_isOpen) return;
    _previousFocus = document.activeElement;
    _isOpen = true;
    _root.classList.add('is-open');
    _root.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    renderActivePane();
    window.requestAnimationFrame(function () {
      var firstTab = $('.pmg-ec-tab[aria-selected="true"]', _tabs);
      if (firstTab) try { firstTab.focus(); } catch (e) {}
    });
    track('expert_center_open');
  }
  function closeDrawer() {
    if (!_isOpen || !_root) return;
    _isOpen = false;
    _root.classList.remove('is-open');
    _root.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (_previousFocus && typeof _previousFocus.focus === 'function') {
      try { _previousFocus.focus(); } catch (e) {}
    }
    track('expert_center_close', { applied: _appliedThisSession });
  }

  /* ecc-apply-visibility-1: ECC's Apply ___ buttons used to call
     closeDrawer() only. That worked when ECC was opened directly
     from the topbar gear, but when opened FROM INSIDE the Tune
     Prompt overlay (the common entry now that we have a modal
     overlay), closing ECC left the user staring at the still-open
     Tune overlay — they never saw their freshly rewritten #goal and
     reasonably concluded "ECC did nothing to my prompt."
     applyAndClose closes ECC AND, if the Tune overlay is the parent
     context, closes that too, dropping the user back at the workstation
     with #goal visibly updated. We deliberately do NOT auto-fire Build
     — the user should review the rewrite and choose whether to Run
     With AI, send to ChatGPT/Claude, or build the engineered prompt. */
  function applyAndClose() {
    closeDrawer();
    try {
      var ov = document.getElementById('pmg-tune-overlay');
      if (ov && ov.classList.contains('is-open') && window.pmgTuneChips
          && typeof window.pmgTuneChips.close === 'function') {
        window.pmgTuneChips.close(false);
      }
    } catch (_) {}
    /* ecc-apply-visibility-2: After both overlays close, the user is
       parked on the workstation with a freshly rewritten #goal. They
       previously had no visual cue this happened — the right panel
       still showed its empty placeholder ("Your Optimized prompt will
       appear here") and the legacy Build button is way down the page.
       Make the success obvious: toast + scroll-to-goal + pulse
       highlight on the textarea + briefly surface a sticky "Build My
       Prompt" CTA next to the goal. */
    setTimeout(function () {
      try {
        var goal = document.getElementById('goal');
        if (goal) {
          var behavior = (window.PMG_A11Y && window.PMG_A11Y.scrollBehavior) ? window.PMG_A11Y.scrollBehavior() : 'smooth';
          try { goal.scrollIntoView({ behavior: behavior, block: 'center' }); } catch (_) {}
          goal.classList.add('pmg-ecc-applied-pulse');
          setTimeout(function () { try { goal.classList.remove('pmg-ecc-applied-pulse'); } catch (_) {} }, 2400);
        }
        showApplyToast();
        showInlineBuildCta();
      } catch (_) {}
    }, 80);
  }

  /* Lightweight toast — uses the platform showToast if present, else mounts our own. */
  function showApplyToast() {
    var msg = '\u2713 Prompt rewritten — review your goal box, then Build My Prompt.';
    try {
      if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    } catch (_) {}
    var t = document.createElement('div');
    t.className = 'pmg-ecc-apply-toast';
    t.setAttribute('data-pmg-overlay-root', '');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 3200);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 3800);
  }

  /* Surface an inline "Build My Prompt" CTA right under #goal so the
     user doesn't have to scroll to find the legacy button. Auto-removes
     once the user clicks it OR after 30s OR if a result lands. */
  function showInlineBuildCta() {
    var goal = document.getElementById('goal');
    if (!goal) return;
    var existing = document.getElementById('pmg-ecc-inline-build');
    if (existing) { try { existing.remove(); } catch (_) {} }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-ecc-inline-build';
    btn.className = 'pmg-ecc-inline-build';
    btn.setAttribute('data-pmg-overlay-root', '');
    btn.textContent = '\u2728 Build My Prompt';
    btn.addEventListener('click', function () {
      var real = document.getElementById('generateBtn');
      if (real && typeof real.click === 'function') real.click();
      try { btn.remove(); } catch (_) {}
    });
    /* Insert immediately after the goal textarea's wrapping field group
       if possible, else after the textarea itself. */
    var anchor = goal.closest('.pmgv3-field') || goal.closest('.pmg-field') || goal.parentNode;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    } else if (goal.parentNode) {
      goal.parentNode.insertBefore(btn, goal.nextSibling);
    }
    /* Auto-clear when the result actually lands. */
    var clear = function () { try { btn.remove(); } catch (_) {} };
    document.addEventListener('pmg:builder-finalized', clear, { once: true });
    setTimeout(clear, 30000);
  }

  /* ecc-go-to-prompt-1: When ECC's Diagnose tab opens with an empty
     prompt box, the user sees a "Go To Prompt Box" button. Previously
     it just called focus() on #goal — but that fails on mobile because
     (a) #goal lives in the Text panel which may not be active (Photo /
     Video tabs hide it), (b) focus() doesn't scroll the page on
     mobile, and (c) without scroll the user has no idea anything
     happened. This helper closes the drawer, switches to the Text
     panel via chassis API, scrolls #goal smoothly into the comfortable
     spot under the topbar, then focuses to pop the keyboard. We call
     focus() BEFORE the rAF/scroll so we don't lose the user-gesture
     window iOS requires for programmatic focus to open the keyboard.
     preventScroll on focus avoids a double-scroll fight. Falls back
     gracefully if any step fails. */
  function goToPromptBox() {
    closeDrawer();
    try {
      if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
        window.pmgChassisV3.setActivePanel('text');
      }
    } catch (_) {}
    var ta = document.getElementById('goal');
    if (!ta) return;
    /* First focus inside the user-gesture window so iOS will pop the
       keyboard. preventScroll keeps our smooth-scroll in charge. */
    try { ta.focus({ preventScroll: true }); } catch (e) {
      try { ta.focus(); } catch (_) {}
    }
    /* Two rAF ticks so the panel switch and any layout settle before
       we measure / scroll / re-focus. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var liveTa = document.getElementById('goal') || ta;
        /* Re-focus: the panel switch can blur the textarea by
           reflowing the chassis layout. Focus again so the cursor
           lands in the box even if the keyboard didn't already pop. */
        if (document.activeElement !== liveTa) {
          try { liveTa.focus({ preventScroll: true }); } catch (e) {
            try { liveTa.focus(); } catch (_) {}
          }
        }
        /* Smooth-scroll using the same pickScroller pattern as
           pmg-adv-mirror.js — chassis v3 has its own inner scroll
           container, so window.scrollTo is usually a no-op. */
        try {
          var topbar = document.querySelector('.pmgv3-topbar');
          var stickyBottom = 0;
          if (topbar) {
            var tbRect = topbar.getBoundingClientRect();
            if (tbRect.top <= 4 && tbRect.bottom > 0) stickyBottom = tbRect.bottom;
          }
          var rect = liveTa.getBoundingClientRect();
          var delta = rect.top - (stickyBottom + 14);
          if (Math.abs(delta) < 24) return;
          var scroller = pickScrollerForGoal(liveTa);
          var current = (scroller === window)
            ? (window.scrollY || window.pageYOffset || 0)
            : scroller.scrollTop;
          var nextTop = current + delta;
          if (scroller === window) {
            window.scrollTo({ top: nextTop, behavior: 'smooth' });
          } else {
            try { scroller.scrollTo({ top: nextTop, behavior: 'smooth' }); }
            catch (_) { scroller.scrollTop = nextTop; }
          }
        } catch (_) {
          try { liveTa.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (__) {}
        }
      });
    });
  }

  function pickScrollerForGoal(el) {
    var node = el.parentNode;
    while (node && node !== document.body && node.nodeType === 1) {
      var cs = window.getComputedStyle(node);
      var oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentNode;
    }
    return window;
  }

  /* =====================================================================
   * Paywall (free + post-beta)
   * ===================================================================== */
  function showPaywall() {
    buildShell();
    Object.keys(_bodies).forEach(function (k) {
      _bodies[k].classList.toggle('is-active', k === _activeTab);
    });
    var pane = _bodies[_activeTab];
    pane.innerHTML = '';
    pane.appendChild(el('div', { class: 'pmg-ec-paywall' }, [
      el('h3', null, 'Expert Command Center is a Pro Feature'),
      el('p', null, 'Diagnose, Architect, Tune, Variations, and Save are included with the Founding Member ($79 one-time, price locked for life) and Pro plans. Founding Member is limited to the first 500 buyers.'),
      el('div', { class: 'pmg-ec-cta-row', style: 'border:0;padding:0;margin:0;' }, [
        el('a', { href: '/pricing.html', class: 'pmg-ec-primary' }, 'See Pricing'),
        el('button', { type: 'button', onclick: closeDrawer }, 'Maybe Later')
      ])
    ]));
    if (!_isOpen) {
      _previousFocus = document.activeElement;
      _isOpen = true;
      _root.classList.add('is-open');
      _root.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
    }
    track('expert_center_paywall_shown');
  }

  /* =====================================================================
   * Public entry: requestOpen — handles warning + paywall gating.
   * ===================================================================== */
  var _warningPending = false;   /* re-entrancy guard for warning dialog */
  var _requestPending = false;   /* re-entrancy guard for requestOpen   */

  function showWarning(onConfirm) {
    var dialog = $('#expert-warning-dialog');
    var confirm = $('#expert-warning-confirm');
    var cancel = $('#expert-warning-cancel');
    /* If the dialog isn't usable, fall through to confirmed path
       (best-effort — user clicked Expert Mode, they want to open). */
    if (!dialog || typeof dialog.showModal !== 'function') { onConfirm(); return; }
    /* Re-entrancy: if we're already showing the warning (e.g. a
       second click landed before the first dialog was dismissed),
       do nothing — never auto-confirm on top of a pending prompt. */
    if (_warningPending || dialog.open) return;
    _warningPending = true;
    function cleanup() {
      _warningPending = false;
      confirm && confirm.removeEventListener('click', onYes);
      cancel && cancel.removeEventListener('click', onNo);
      dialog.removeEventListener('cancel', onNo);
    }
    function onYes(e) {
      if (e) e.preventDefault();
      cleanup();
      try { dialog.close(); } catch (er) {}
      bumpActivations();
      onConfirm();
    }
    function onNo(e) {
      if (e) e.preventDefault();
      cleanup();
      try { dialog.close(); } catch (er) {}
      track('expert_center_warning_cancel');
    }
    confirm && confirm.addEventListener('click', onYes);
    cancel && cancel.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onNo);
    try {
      dialog.showModal();
      track('expert_center_warning_shown');
    } catch (e) {
      /* showModal failed — most likely because the dialog was
         already open in another stack. Tear down our listeners
         WITHOUT auto-confirming. The user can click again. */
      cleanup();
    }
  }

  function requestOpen(opts) {
    opts = opts || {};
    /* Re-entrancy: if a previous requestOpen is still mid-flight
       (two click handlers both fired in the same tick), no-op the
       second one. Cleared on next tick. */
    if (_requestPending) return;
    _requestPending = true;
    window.setTimeout(function () { _requestPending = false; }, 0);

    /* Paywall: if user is NOT paid AND NOT in beta, show paywall instead. */
    if (!isPaidUser() && !isInBeta()) {
      showPaywall();
      return;
    }
    /* If drawer is already open, no-op (avoids double-open). */
    if (_isOpen) return;
    var seen = getActivations();
    if (seen < FIRST_N_WARNINGS && !opts.skipWarning) {
      showWarning(function () { openDrawer(); });
    } else {
      openDrawer();
    }
  }

  window.PMGExpertCenter = {
    requestOpen: requestOpen,
    open: openDrawer,
    close: closeDrawer,
    applied: function () { return _appliedThisSession; }
  };

  /* =====================================================================
   * Auto-wire all known entry points (idempotent — safe to run after
   * the page has already wired them).
   * ===================================================================== */
  function wireEntryPoints() {
    /* Nav button (#pmg-nav-expert-link) — pmg-ux.js created this with
       its own toggle handler. Replace it cleanly. */
    var nav = $('#pmg-nav-expert-link');
    if (nav && !nav.__pmgEcWired) {
      var clone = nav.cloneNode(true);
      nav.parentNode.replaceChild(clone, nav);
      clone.__pmgEcWired = true;
      clone.addEventListener('click', function (e) { e.preventDefault(); requestOpen(); });
    }
    /* Form button (#expert-mode-link) — same approach. */
    var link = $('#expert-mode-link');
    if (link && !link.__pmgEcWired) {
      var clone2 = link.cloneNode(true);
      link.parentNode.replaceChild(clone2, link);
      clone2.__pmgEcWired = true;
      clone2.textContent = 'Open Expert Command Center →';
      clone2.addEventListener('click', function (e) { e.preventDefault(); requestOpen(); });
    }
    /* Hidden helper button (#pmg-expert-toggle-btn). */
    var btn = $('#pmg-expert-toggle-btn');
    if (btn && !btn.__pmgEcWired) {
      var clone3 = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone3, btn);
      clone3.__pmgEcWired = true;
      clone3.addEventListener('click', function (e) { e.preventDefault(); requestOpen(); });
    }
    /* expert-topbar-1 (audit-2 round 2): dedicated Expert button in the
       chassis-v3 workstation topbar (#pmgv3-expert). chassis-v3 builds
       the topbar after this script runs, so retry-poll until it appears
       (mirrors pmg-business-mode.js pattern for #pmgv3-business). */
    var topbar = $('#pmgv3-expert');
    if (topbar && !topbar.__pmgEcWired) {
      topbar.__pmgEcWired = true;
      topbar.addEventListener('click', function (e) { e.preventDefault(); requestOpen(); });
    }
    /* Hero link in the marketing section. */
    var hero = $('#hero-expert-link-btn');
    if (hero && !hero.__pmgEcWired) {
      hero.__pmgEcWired = true;
      var origClick = hero.onclick;
      hero.addEventListener('click', function (e) {
        e.preventDefault();
        var builder = $('#builder');
        if (builder) try { builder.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (er) {}
        window.setTimeout(requestOpen, 350);
      }, true);
    }
    /* Header checkbox (#expert-mode-toggle) — neutralize the legacy
       change handler by intercepting and routing to requestOpen. */
    var cb = $('#expert-mode-toggle');
    if (cb && !cb.__pmgEcWired) {
      cb.__pmgEcWired = true;
      cb.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cb.checked = false;
        requestOpen();
      }, true);
    }
  }

  /* ecc-reparent-1: The #expert-warning-dialog lives in app.html inside
     <main id="main">, which chassis-v3's universal hide rule sets to
     display:none. Even though the dialog has data-pmg-overlay-root, a
     hidden parent suppresses children, so dialog.showModal() succeeded
     silently and the warning never appeared (so the ECC drawer never
     got past the warning step from any entry point that triggered it).
     Reparent to document.body once at boot — same pattern as the ECC
     drawer (_root) which is already body-mounted. Idempotent. */
  function reparentWarningDialog() {
    var dlg = document.getElementById('expert-warning-dialog');
    if (!dlg || dlg.parentNode === document.body) return;
    try { document.body.appendChild(dlg); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { reparentWarningDialog(); wireEntryPoints(); }, { once: true });
  } else {
    reparentWarningDialog();
    wireEntryPoints();
  }
  /* Re-run after a tick because pmg-ux.js may inject the nav button
     after our initial pass. Also briefly observes header mutations
     to catch late insertions, then disconnects to avoid a long-lived
     subtree observer running for the entire session. */
  window.setTimeout(wireEntryPoints, 600);
  window.setTimeout(wireEntryPoints, 1500);
  if ('MutationObserver' in window) {
    var _mo = null;
    var _moStop = null;
    var startObserver = function () {
      if (!document.body || _mo) return;
      _mo = new MutationObserver(function () { wireEntryPoints(); });
      _mo.observe(document.body, { childList: true, subtree: true });
      /* Disconnect after 5s — by then pmg-ux.js has long since
         injected the nav button. Anything later that needs Expert
         Center wiring should call window.PMGExpertCenter.requestOpen()
         directly. */
      _moStop = window.setTimeout(function () {
        try { _mo && _mo.disconnect(); } catch (e) {}
        _mo = null;
      }, 5000);
    };
    if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    /* Also disconnect early if the page hides (user switches tab) — saves cycles. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' && _mo) {
        try { _mo.disconnect(); } catch (e) {}
        _mo = null;
        if (_moStop) { window.clearTimeout(_moStop); _moStop = null; }
      }
    });
  }

})();
