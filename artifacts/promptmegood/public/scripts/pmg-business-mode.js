/* ============================================================================
   PromptMeGood — Business Mode (bm-1)
   Premium outcome-specific workspace. Mounts into #pmgv3-panel-business
   built by pmg-chassis-v3.js. Provides:
     1. Brand Voice Vault (left header) — synced with the Pro Brand Voice
        Profile (storage key 'pmg-brand-voice-v1'), so the two surfaces
        share the same vault.
     2. Six Workflow Packs grid (Entrepreneur, E-Commerce, Builder,
        Creator, Marketing, Customer Experience).
     3. Pack -> templates list -> dynamic variable execution form.
     4. Generate Master Prompt: variable substitution + Brand Voice
        injection -> right column output.
     5. Quality view toggle [View Final Prompt | View AI Analysis].
   All state is local. No server calls. The generated prompt is plain
   text the user can copy / send to AI / save to vault.
   ============================================================================ */
(function () {
  'use strict';

  var BV_KEY = 'pmg-brand-voice-v1'; // shared with pmg-pro.js Brand Voice
  var BV_MAX = 1500;

  /* ---- Templates (6 packs × 3 templates) ---- */
  var PACKS = [
    {
      id: 'entrepreneur',
      icon: '🏢',
      title: 'Entrepreneur & Business',
      sub: 'Offers, landing pages, cold outreach',
      templates: [
        {
          id: 'offer-creation',
          name: 'Offer Creation',
          why: 'Forces you to package value, price, guarantee, and bonuses — the 4 levers of an irresistible offer.',
          template: 'Help me craft an irresistible offer for [PRODUCT/SERVICE]. Target audience is [AUDIENCE]. Price point is [PRICE]. Include a strong guarantee and 3 bonuses.'
        },
        {
          id: 'landing-page',
          name: 'Landing Page Copy',
          why: 'Uses the PAS (Problem-Agitation-Solution) framework with a hook headline and a clear CTA.',
          template: 'Write high-converting landing page copy for [PRODUCT]. Include a hook headline, 3 PAS (Problem-Agitation-Solution) bullet points, and a strong CTA.'
        },
        {
          id: 'cold-email',
          name: 'Cold Email Sequence',
          why: 'A 3-touch sequence is the proven minimum to get past inbox noise and land a meeting.',
          template: 'Write a 3-part cold email sequence targeting [DECISION MAKER] at [INDUSTRY] companies. Goal is to book a 15-minute demo for [PRODUCT].'
        }
      ]
    },
    {
      id: 'ecommerce',
      icon: '🛍️',
      title: 'E-Commerce & Shopify',
      sub: 'Product copy, ad angles, cart recovery',
      templates: [
        {
          id: 'product-description',
          name: 'Shopify Product Description',
          why: 'SEO-friendly + emotional benefit framing converts higher than spec-only descriptions.',
          template: 'Write an SEO-optimized Shopify product description for [PRODUCT NAME]. Key features: [FEATURES]. Focus on the emotional benefit, not just specs.'
        },
        {
          id: 'fb-ad-angles',
          name: 'Facebook Ad Angles',
          why: '3 distinct angles (logical, emotional, urgency) covers all major buyer psychology triggers.',
          template: 'Generate 3 distinct Facebook ad angles for [PRODUCT]. Angle 1: Logical/ROI. Angle 2: Emotional/Status. Angle 3: Urgency/Scarcity.'
        },
        {
          id: 'abandoned-cart',
          name: 'Abandoned Cart Email',
          why: 'A helpful + incentive 2-step combo recovers ~10% of abandoned carts on average.',
          template: 'Write a 2-part abandoned cart email sequence for [PRODUCT]. Email 1: Helpful reminder. Email 2: 10% discount offer with 24-hour urgency.'
        }
      ]
    },
    {
      id: 'builder',
      icon: '💻',
      title: 'Builder (Replit / Bolt / Cursor)',
      sub: 'PRDs, debugging, schemas',
      templates: [
        {
          id: 'app-spec',
          name: 'App Spec PRD',
          why: 'A structured PRD gives the AI agent the scope and stack constraints it needs to ship working code.',
          template: 'Write a detailed PRD (Product Requirements Document) for an AI agent to build a [APP TYPE] using [TECH STACK]. Core features: [FEATURES].'
        },
        {
          id: 'debug-prompt',
          name: 'Debugging Prompt',
          why: 'Forcing error + expected behavior + framework context prevents the AI from guessing at the wrong fix.',
          template: 'I am getting this error: [ERROR MESSAGE] in my [LANGUAGE/FRAMEWORK] code. The expected behavior is [EXPECTED]. Write a prompt to diagnose and fix this.'
        },
        {
          id: 'db-schema',
          name: 'Database Schema',
          why: 'Producing SQL DDL alongside the schema design saves a follow-up round-trip.',
          template: 'Design a relational database schema for a [APP TYPE]. It needs to track [ENTITIES]. Provide the SQL table creation scripts.'
        }
      ]
    },
    {
      id: 'creator',
      icon: '🎬',
      title: 'Creator (YouTube, TikTok, Social)',
      sub: 'Scripts, hooks, content calendars',
      templates: [
        {
          id: 'youtube-script',
          name: 'YouTube Script',
          why: 'A 15-second hook is the single biggest predictor of retention; chapters keep the watch-time rolling.',
          template: 'Write a YouTube script about [TOPIC]. Start with a 15-second hook. Outline 3 main chapters. End with a call to subscribe.'
        },
        {
          id: 'tiktok-hooks',
          name: 'TikTok Hook Generator',
          why: 'Negative Hook + Curiosity Gap are the two highest-performing patterns on short-form video.',
          template: 'Give me 5 viral TikTok hooks for a video about [TOPIC]. Use the "Negative Hook" and "Curiosity Gap" frameworks.'
        },
        {
          id: 'content-calendar',
          name: '30-Day Content Calendar',
          why: 'A multi-format mix (long, short, written) builds reach across platforms in parallel.',
          template: 'Create a 30-day content calendar for a [NICHE] creator. Include 2 YouTube long-form ideas, 4 Shorts ideas, and 8 Twitter threads.'
        }
      ]
    },
    {
      id: 'marketing',
      icon: '📣',
      title: 'Marketing & Advertising',
      sub: 'Search ads, webinars, PR',
      templates: [
        {
          id: 'google-ad',
          name: 'Google Search Ad',
          why: 'Locks the headlines/descriptions to Google\'s exact character limits so the output is pasteable.',
          template: 'Write 3 Headlines (max 30 chars) and 2 Descriptions (max 90 chars) for a Google Search Ad targeting the keyword [KEYWORD].'
        },
        {
          id: 'webinar-outline',
          name: 'Webinar Outline',
          why: 'The intro/teach/pitch ratio of 5/30/10 is the standard high-converting webinar structure.',
          template: 'Outline a 45-minute webinar teaching [TOPIC]. Include a 5-minute intro, 30 minutes of teaching, and a 10-minute pitch for [PRODUCT].'
        },
        {
          id: 'press-release',
          name: 'Press Release',
          why: 'Pull-quote + boilerplate is what reporters expect; missing them gets a release ignored.',
          template: 'Write a professional press release announcing [EVENT/LAUNCH]. Include a quote from [SPOKESPERSON NAME] and a company boilerplate.'
        }
      ]
    },
    {
      id: 'customer',
      icon: '🎧',
      title: 'Customer Experience',
      sub: 'Support, onboarding, policies',
      templates: [
        {
          id: 'support-reply',
          name: 'Support Reply',
          why: 'Empathy-first language paired with a concrete resolution defuses ~80% of escalations.',
          template: 'Draft an empathetic reply to a customer who is angry about [ISSUE]. Offer them [RESOLUTION].'
        },
        {
          id: 'onboarding',
          name: 'Onboarding Sequence',
          why: 'A 3-email sequence with a single first-action goal beats long welcome guides on activation rate.',
          template: 'Write a 3-part welcome email sequence for new users of [SOFTWARE/SERVICE]. Goal: Get them to complete [FIRST ACTION].'
        },
        {
          id: 'refund-policy',
          name: 'Refund Policy',
          why: 'Clear + friendly + firm reduces support volume and protects margin in equal measure.',
          template: 'Write a clear, friendly, and firm refund policy for a [BUSINESS TYPE]. Terms: [TERMS].'
        }
      ]
    }
  ];

  /* ---- Brand Voice Vault storage helpers (sync with pmg-pro.js) ---- */
  function loadBrand() {
    try {
      var raw = localStorage.getItem(BV_KEY);
      if (!raw) return { audience: '', tone: '', negative: '', name: '', useWords: '' };
      var p = JSON.parse(raw) || {};
      return {
        audience: String(p.audience || '').slice(0, BV_MAX),
        tone:     String(p.voice    || '').slice(0, BV_MAX), // pro stores as 'voice'
        negative: String(p.avoidWords || '').slice(0, BV_MAX),
        name:     String(p.name || ''),       // preserved untouched
        useWords: String(p.useWords || '')   // preserved untouched
      };
    } catch (_) { return { audience: '', tone: '', negative: '', name: '', useWords: '' }; }
  }

  function saveBrand(vault) {
    try {
      var existing = (function () {
        try { return JSON.parse(localStorage.getItem(BV_KEY) || '{}') || {}; }
        catch (_) { return {}; }
      })();
      var next = {
        // preserve any pro-only fields written by pmg-pro.js
        name: existing.name || '',
        useWords: existing.useWords || '',
        // overwrite the three vault-managed fields
        voice: String(vault.tone || '').slice(0, BV_MAX),
        audience: String(vault.audience || '').slice(0, BV_MAX),
        avoidWords: String(vault.negative || '').slice(0, BV_MAX)
      };
      localStorage.setItem(BV_KEY, JSON.stringify(next));
      return true;
    } catch (_) { return false; }
  }

  function buildBrandInjection(b) {
    if (!b) return '';
    var bits = [];
    if (b.audience) bits.push('The target audience is ' + b.audience + '.');
    if (b.tone)     bits.push('The tone must be ' + b.tone + '.');
    if (b.negative) bits.push('STRICT NEGATIVE CONSTRAINTS: ' + b.negative + '.');
    if (!bits.length) return '';
    return '\n\n[SYSTEM INSTRUCTION: ' + bits.join(' ') + ']';
  }

  /* ---- Tiny DOM helpers ---- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'class') n.className = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          n.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null) {
          n.setAttribute(k, attrs[k]);
        }
      }
    }
    if (kids) {
      (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
        if (c == null) return;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return n;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  /* Parse [BRACKETED TOKENS] out of a template string into a unique
     ordered list of variable names. Tokens may contain spaces and
     slashes (e.g. [PRODUCT/SERVICE], [DECISION MAKER]). */
  function parseVariables(template) {
    var out = [];
    var seen = {};
    var re = /\[([^\[\]]+)\]/g;
    var m;
    while ((m = re.exec(template)) !== null) {
      var name = m[1].trim();
      if (!seen[name]) { seen[name] = true; out.push(name); }
    }
    return out;
  }

  /* Substitute filled-in values back into the template, preserving any
     unfilled [TOKENS] so the user can still see what they skipped. */
  function fillTemplate(template, values) {
    return template.replace(/\[([^\[\]]+)\]/g, function (full, name) {
      var key = name.trim();
      var v = values[key];
      if (v && String(v).trim()) return String(v).trim();
      return full;
    });
  }

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  /* ---- Mount ---- */
  function mount(panel) {
    if (!panel || panel.dataset.pmgBmMounted === '1') return;
    panel.dataset.pmgBmMounted = '1';

    var left  = el('div', { class: 'pmgv3-left',  id: 'pmgv3-business-left'  });
    var right = el('div', { class: 'pmgv3-right', id: 'pmgv3-business-right' });
    panel.appendChild(left);
    panel.appendChild(right);

    renderVault(left);
    renderDashboard(left);
    renderEmptyOutput(right);
  }

  /* ---- Brand Voice Vault ---- */
  function renderVault(host) {
    var existingVault = host.querySelector('.pmg-business-brand-vault');
    if (existingVault) existingVault.remove();
    var b = loadBrand();

    var vault = el('div', { class: 'pmg-business-brand-vault' });
    vault.appendChild(el('h3', { html: '<span aria-hidden="true">🏛️</span> Your Brand Voice Vault' }));
    vault.appendChild(el('p', { text: 'Set this once. Every prompt will automatically use these rules.' }));

    vault.appendChild(el('label', { for: 'biz-audience', text: 'Target Audience (Who are you talking to?)' }));
    var audInp = el('input', { type: 'text', id: 'biz-audience', placeholder: 'e.g., Busy moms, B2B SaaS founders' });
    audInp.value = b.audience || '';
    vault.appendChild(audInp);

    vault.appendChild(el('label', { for: 'biz-tone', text: 'Brand Tone (How do you sound?)' }));
    var toneInp = el('input', { type: 'text', id: 'biz-tone', placeholder: 'e.g., Professional but witty, empathetic, no jargon' });
    toneInp.value = b.tone || '';
    vault.appendChild(toneInp);

    vault.appendChild(el('label', { for: 'biz-negative', text: 'Negative Constraints (What should the AI NEVER do?)' }));
    var negInp = el('textarea', { id: 'biz-negative', placeholder: 'e.g., Never use emojis, avoid corporate buzzwords, do not invent statistics' });
    negInp.value = b.negative || '';
    vault.appendChild(negInp);

    var row = el('div', { class: 'pmg-bv-row' });
    var saveBtn = el('button', { id: 'biz-save-brand', class: 'btn-secondary', type: 'button', text: 'Save Brand Voice' });
    var savedFlag = el('span', { class: 'pmg-bv-saved-flag', html: '<span aria-hidden="true">✓</span> Saved — applied to every Business Mode prompt.' });
    if ((b.audience || b.tone || b.negative)) savedFlag.classList.add('is-visible');

    saveBtn.addEventListener('click', function () {
      var ok = saveBrand({
        audience: audInp.value,
        tone: toneInp.value,
        negative: negInp.value
      });
      if (ok) {
        savedFlag.classList.add('is-visible');
        saveBtn.textContent = 'Saved ✓';
        setTimeout(function () { saveBtn.textContent = 'Save Brand Voice'; }, 1600);
      }
    });

    row.appendChild(saveBtn);
    row.appendChild(savedFlag);
    vault.appendChild(row);

    // Insert at the very top of the left column.
    if (host.firstChild) host.insertBefore(vault, host.firstChild);
    else host.appendChild(vault);
  }

  /* ---- Pack grid (dashboard) ---- */
  function renderDashboard(host) {
    // Remove any pack/template/execution view from a previous render.
    Array.prototype.forEach.call(
      host.querySelectorAll('.pmg-business-packs-title, .pmg-business-pack-grid, .pmg-business-templates, .pmg-business-execution'),
      function (n) { n.remove(); }
    );

    host.appendChild(el('div', { class: 'pmg-business-packs-title', text: 'Workflow Packs' }));
    var grid = el('div', { class: 'pmg-business-pack-grid' });
    PACKS.forEach(function (pack) {
      var btn = el('button', { class: 'pmg-business-pack', type: 'button', 'data-pack': pack.id });
      btn.appendChild(el('span', { class: 'pmg-business-pack-icon', 'aria-hidden': 'true', text: pack.icon }));
      btn.appendChild(el('div', { class: 'pmg-business-pack-title', text: pack.title }));
      btn.appendChild(el('div', { class: 'pmg-business-pack-sub', text: pack.sub }));
      btn.addEventListener('click', function () { renderTemplateList(host, pack); });
      grid.appendChild(btn);
    });
    host.appendChild(grid);
  }

  /* ---- Templates list (after a pack is opened) ---- */
  function renderTemplateList(host, pack) {
    Array.prototype.forEach.call(
      host.querySelectorAll('.pmg-business-packs-title, .pmg-business-pack-grid, .pmg-business-templates, .pmg-business-execution'),
      function (n) { n.remove(); }
    );

    var wrap = el('div', { class: 'pmg-business-templates' });
    var header = el('div', { class: 'pmg-business-templates-header' });
    header.appendChild(el('h4', { html: '<span aria-hidden="true">' + pack.icon + '</span> ' + pack.title }));
    var back = el('button', { class: 'pmg-business-back-btn', type: 'button', text: '← All packs' });
    back.addEventListener('click', function () { renderDashboard(host); });
    header.appendChild(back);
    wrap.appendChild(header);

    pack.templates.forEach(function (tpl) {
      var item = el('button', { class: 'pmg-business-template-item', type: 'button', 'data-template': tpl.id });
      item.appendChild(el('div', { class: 'pmg-business-template-name', text: tpl.name }));
      var preview = tpl.template.length > 110 ? tpl.template.slice(0, 107) + '…' : tpl.template;
      item.appendChild(el('div', { class: 'pmg-business-template-preview', text: preview }));
      item.addEventListener('click', function () { renderExecution(host, pack, tpl); });
      wrap.appendChild(item);
    });

    host.appendChild(wrap);
  }

  /* ---- Execution view (variable form) ---- */
  function renderExecution(host, pack, tpl) {
    Array.prototype.forEach.call(
      host.querySelectorAll('.pmg-business-packs-title, .pmg-business-pack-grid, .pmg-business-templates, .pmg-business-execution'),
      function (n) { n.remove(); }
    );

    var vars = parseVariables(tpl.template);
    var view = el('div', { class: 'pmg-business-execution' });

    var header = el('div', { class: 'pmg-business-templates-header' });
    header.appendChild(el('h4', { html: '<span aria-hidden="true">' + pack.icon + '</span> ' + tpl.name }));
    var back = el('button', { class: 'pmg-business-back-btn', type: 'button', text: '← Back to ' + pack.title });
    back.addEventListener('click', function () { renderTemplateList(host, pack); });
    header.appendChild(back);
    view.appendChild(header);

    view.appendChild(el('p', { class: 'pmg-be-hint', text: 'Fill in the blanks below. Your Brand Voice Vault rules will be appended automatically.' }));

    var inputs = {};
    vars.forEach(function (name) {
      var id = 'var-' + slugify(name);
      view.appendChild(el('label', { for: id, text: name }));
      // Long fields (FEATURES, ENTITIES, ERROR MESSAGE, TERMS) get a textarea.
      var isLong = /FEATURES|ENTITIES|ERROR|TERMS|EXPECTED|RESOLUTION|ISSUE/i.test(name);
      var input = el(isLong ? 'textarea' : 'input', {
        type: isLong ? null : 'text',
        id: id,
        placeholder: 'Your ' + name.toLowerCase()
      });
      view.appendChild(input);
      inputs[name] = input;
    });

    var genBtn = el('button', { id: 'biz-generate-prompt', class: 'btn-primary', type: 'button', text: 'Generate Master Prompt' });
    genBtn.addEventListener('click', function () {
      var values = {};
      vars.forEach(function (n) { values[n] = inputs[n].value; });
      var filled = fillTemplate(tpl.template, values);
      var brand = loadBrand();
      var injection = buildBrandInjection(brand);
      var finalPrompt = filled + injection;
      writeOutput(finalPrompt, tpl, brand);
    });
    view.appendChild(genBtn);

    host.appendChild(view);
  }

  /* ---- Right column: empty / output / quality toggle ---- */
  function renderEmptyOutput(rightHost) {
    clear(rightHost);
    var empty = el('div', { class: 'pmg-business-output-empty' });
    empty.appendChild(el('div', { class: 'pmg-boe-icon', 'aria-hidden': 'true', text: '💼' }));
    empty.appendChild(el('div', {
      html: '<strong style="color:#fff;display:block;margin-bottom:6px;">Pick a pack on the left to start.</strong>' +
            'Your Brand Voice Vault rules will automatically be applied to every Business Mode prompt — set them once at the top of the left column.'
    }));
    rightHost.appendChild(empty);
  }

  function writeOutput(finalPrompt, tpl, brand) {
    var rightHost = document.getElementById('pmgv3-business-right');
    if (!rightHost) return;
    clear(rightHost);

    var wrap = el('div', { class: 'pmg-business-output' });

    // Quality toggle — pair of toggle buttons (NOT a tablist; we don't
    // implement the full ARIA tabs contract: arrow-key navigation,
    // role="tabpanel" wrappers, aria-controls linkage. Using
    // aria-pressed on plain buttons gives assistive tech the correct
    // semantics for the simpler "two-state toggle" pattern.)
    var toggle = el('div', { class: 'pmg-business-quality-toggle' });
    var btnFinal = el('button', { type: 'button', class: 'is-active', 'data-view': 'final', 'aria-pressed': 'true', text: 'View Final Prompt' });
    var btnAnalysis = el('button', { type: 'button', 'data-view': 'analysis', 'aria-pressed': 'false', text: 'View AI Analysis' });
    toggle.appendChild(btnFinal);
    toggle.appendChild(btnAnalysis);
    wrap.appendChild(toggle);

    var resultBox = el('div', { class: 'pmg-business-result-box', text: finalPrompt });
    var analysisBox = buildAnalysisBox(tpl, brand);
    analysisBox.style.display = 'none';
    wrap.appendChild(resultBox);
    wrap.appendChild(analysisBox);

    // Actions row: Copy, Save to Vault, Send to ChatGPT.
    var actions = el('div', { class: 'pmg-business-result-actions' });
    var copyBtn = el('button', { type: 'button', text: '📋 Copy' });
    copyBtn.addEventListener('click', function () {
      var done = function () {
        copyBtn.textContent = '✓ Copied';
        setTimeout(function () { copyBtn.textContent = '📋 Copy'; }, 1400);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(finalPrompt).then(done, done);
        } else {
          var ta = document.createElement('textarea');
          ta.value = finalPrompt;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (_) {}
          ta.remove();
          done();
        }
      } catch (_) { done(); }
    });
    actions.appendChild(copyBtn);

    var vaultBtn = el('button', { type: 'button', text: '🗄️ Save to Vault' });
    vaultBtn.addEventListener('click', function () {
      try {
        // Match the real vault contract used by app.html (~L5988) and
        // pmg-ux.js: HISTORY_KEY = 'promptmegood:history:v1', items
        // shaped { id, savedAt, data: { goal, ... } } — getLatestVaultItem
        // filters on `i.data && i.data.goal`, so `data.goal` is required
        // for the entry to surface in the Vault drawer.
        var key = 'promptmegood:history:v1';
        var raw = localStorage.getItem(key);
        var arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) arr = [];
        arr.unshift({
          id: 'biz-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          savedAt: Date.now(),
          createdAt: Date.now(),
          source: 'business-mode',
          data: {
            goal: tpl.name + ' (Business Mode)',
            prompt: finalPrompt,
            category: 'business',
            template: tpl.id
          }
        });
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
        document.dispatchEvent(new Event('pmg:vault-saved'));
        vaultBtn.textContent = '✓ Saved to Vault';
        setTimeout(function () { vaultBtn.textContent = '🗄️ Save to Vault'; }, 1600);
      } catch (_) {
        vaultBtn.textContent = 'Save failed';
        setTimeout(function () { vaultBtn.textContent = '🗄️ Save to Vault'; }, 1600);
      }
    });
    actions.appendChild(vaultBtn);

    var sendBtn = el('button', { type: 'button', text: '↗ Send to ChatGPT' });
    sendBtn.addEventListener('click', function () {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try { navigator.clipboard.writeText(finalPrompt); } catch (_) {}
        }
        var url = 'https://chat.openai.com/?q=' + encodeURIComponent(finalPrompt);
        window.open(url, '_blank', 'noopener');
      } catch (_) {}
    });
    actions.appendChild(sendBtn);

    wrap.appendChild(actions);

    // Toggle handlers
    btnFinal.addEventListener('click', function () {
      btnFinal.classList.add('is-active');
      btnFinal.setAttribute('aria-pressed', 'true');
      btnAnalysis.classList.remove('is-active');
      btnAnalysis.setAttribute('aria-pressed', 'false');
      resultBox.style.display = '';
      analysisBox.style.display = 'none';
    });
    btnAnalysis.addEventListener('click', function () {
      btnAnalysis.classList.add('is-active');
      btnAnalysis.setAttribute('aria-pressed', 'true');
      btnFinal.classList.remove('is-active');
      btnFinal.setAttribute('aria-pressed', 'false');
      resultBox.style.display = 'none';
      analysisBox.style.display = '';
    });

    rightHost.appendChild(wrap);
  }

  function buildAnalysisBox(tpl, brand) {
    var box = el('div', { class: 'pmg-business-analysis-box' });
    box.appendChild(el('h5', { text: 'Why this prompt is powerful' }));
    box.appendChild(el('p', { text: tpl.why || 'Battle-tested template structure used by professional copywriters and engineers.' }));

    box.appendChild(el('h5', { text: 'What was applied' }));
    var ul = el('ul');
    ul.appendChild(el('li', { text: 'Variable substitution: your inputs were filled into the proven template structure.' }));
    if (brand && (brand.audience || brand.tone || brand.negative)) {
      var bits = [];
      if (brand.audience) bits.push('audience (' + brand.audience + ')');
      if (brand.tone)     bits.push('tone (' + brand.tone + ')');
      if (brand.negative) bits.push('negative constraints');
      ul.appendChild(el('li', { text: 'Brand Voice Vault appended: ' + bits.join(', ') + ' — so the output sounds like you, not like a generic AI.' }));
    } else {
      ul.appendChild(el('li', { text: 'No Brand Voice set yet — add one at the top of the left column to inject your audience, tone, and negative constraints automatically.' }));
    }
    ul.appendChild(el('li', { text: 'Hidden system instruction: the brand rules are framed as a system-level directive so AI models prioritize them over conflicting guidance in the user prompt.' }));
    box.appendChild(ul);

    box.appendChild(el('h5', { text: 'Tip' }));
    box.appendChild(el('p', { text: 'Paste this into ChatGPT, Claude, or Gemini. Iterate by adjusting the Brand Voice Vault — every future prompt inherits the change automatically.' }));

    return box;
  }

  /* ---- Boot ---- */
  function whenPanelReady(cb) {
    var ticks = 0;
    var t = setInterval(function () {
      var p = document.getElementById('pmgv3-panel-business');
      if (p) { clearInterval(t); cb(p); return; }
      if (++ticks > 150) { clearInterval(t); }
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { whenPanelReady(mount); });
  } else {
    whenPanelReady(mount);
  }

  // Public test/debug surface.
  window.PMGBusiness = {
    packs: PACKS,
    loadBrand: loadBrand,
    saveBrand: saveBrand,
    parseVariables: parseVariables,
    fillTemplate: fillTemplate,
    buildBrandInjection: buildBrandInjection
  };
})();
