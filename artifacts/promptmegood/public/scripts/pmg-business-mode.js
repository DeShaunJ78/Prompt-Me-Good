/* pmg-business-mode.js (bm-2)
 *
 * Header-icon Business Mode panel.
 *
 * The 💼 button in the chassis-v3 topbar (#pmgv3-business) opens a
 * right-side slide-in drawer. Inside the drawer, three accordion
 * sections let the user define their Brand Voice (persisted to
 * localStorage), pick a Social Prompt Pack, or focus on a single
 * Platform. Clicking "Build Prompt" assembles a single goal string,
 * closes the drawer, switches to the Text Prompts tab, fills #goal,
 * and submits the existing #prompt-form so the existing
 * generatePrompt flow runs unchanged.
 *
 * NON-NEGOTIABLES (per implementation brief):
 *   - No new backend / no new AI routes.
 *   - Do NOT alter generatePrompt; assemble a string + feed #goal.
 *   - Do NOT touch the Money Mode toggle.
 *   - Do NOT add a 4th tab to the chassis-v3 nav.
 */
(function () {
  'use strict';

  var LS_KEY = 'pmgv3:bm:brand';
  var BRAND_TONES = [
    'Professional',
    'Casual',
    'Luxury',
    'Direct-Response',
    'Educational',
    'Founder-Led',
    'Funny',
  ];

  var SOCIAL_PACKS = {
    launch:     { label: 'Launch Pack',            platforms: 'TikTok, Instagram, LinkedIn, X, and an email announcement' },
    ecommerce:  { label: 'Ecommerce Product Pack', platforms: 'a TikTok product demo, an Instagram Reel, a Pinterest pin, and a Facebook post' },
    founder:    { label: 'Founder Content Pack',   platforms: 'a LinkedIn post, an X thread, and a YouTube Short script' },
    local:      { label: 'Local Business Pack',    platforms: 'a Facebook post, an Instagram caption, and a Google Business update' },
    viral:      { label: 'Viral Short-Form Pack',  platforms: 'TikTok, Instagram Reels, and YouTube Shorts' },
  };

  var PLATFORMS    = ['TikTok', 'Instagram', 'YouTube', 'LinkedIn', 'X'];
  var CONTENT_TYPES = ['Hook', 'Script', 'Caption', 'Thread', 'Ad Copy'];
  var GOALS        = ['Awareness', 'Engagement', 'Leads', 'Sales', 'Education'];

  /* ---------------------------------------------------------------- *
   * Helpers
   * ---------------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function loadBrand() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return { audience: '', tone: '' };
      var v = JSON.parse(raw);
      return {
        audience: typeof v.audience === 'string' ? v.audience : '',
        tone:     typeof v.tone === 'string' && BRAND_TONES.indexOf(v.tone) >= 0 ? v.tone : '',
      };
    } catch (_) { return { audience: '', tone: '' }; }
  }
  function saveBrand(audience, tone) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ audience: audience || '', tone: tone || '' }));
    } catch (_) {}
  }

  /* ---------------------------------------------------------------- *
   * Drawer DOM (built once, lazily)
   * ---------------------------------------------------------------- */
  var built = false;

  function buildDrawer() {
    if (built) return;
    built = true;

    var overlay = el('div', { id: 'pmg-bm-overlay', 'data-pmg-overlay-root': '' });
    overlay.addEventListener('click', closeDrawer);

    var drawer = el('aside', {
      id: 'pmg-bm-drawer',
      'data-pmg-overlay-root': '',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'pmg-bm-title',
    });

    var toneOptions = ['<option value="">Select a tone…</option>']
      .concat(BRAND_TONES.map(function (t) {
        return '<option value="' + t + '">' + t + '</option>';
      })).join('');

    var packOptions = ['<option value="">Select a pack…</option>']
      .concat(Object.keys(SOCIAL_PACKS).map(function (k) {
        return '<option value="' + k + '">' + SOCIAL_PACKS[k].label + '</option>';
      })).join('');

    var platformOptions = ['<option value="">Select a platform…</option>']
      .concat(PLATFORMS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; })).join('');

    var contentTypeOptions = ['<option value="">Select a content type…</option>']
      .concat(CONTENT_TYPES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; })).join('');

    var goalOptions = ['<option value="">Select a goal…</option>']
      .concat(GOALS.map(function (g) { return '<option value="' + g + '">' + g + '</option>'; })).join('');

    drawer.innerHTML = [
      '<div class="pmg-bm-head">',
        '<h2 id="pmg-bm-title"><span aria-hidden="true">💼</span> Business Mode</h2>',
        '<button type="button" class="pmg-bm-close" aria-label="Close Business Mode">✕</button>',
      '</div>',
      '<div class="pmg-bm-body">',
        '<p class="pmg-bm-intro">Marketing prompt workstation for business owners and creators. Set your Brand Voice once, then build a Social Pack or focus on a single platform — your prompt drops into the Text Prompts tab and generates automatically.</p>',

        /* Brand Voice */
        '<details class="pmg-bm-section" id="pmg-bm-sec-brand" open>',
          '<summary>1. Brand Voice <span style="font-weight:400;color:rgba(230,247,238,0.55);font-size:12px;margin-left:6px;">(saved automatically)</span></summary>',
          '<div class="pmg-bm-sec-body">',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-audience">Target Audience</label>',
              '<input id="pmg-bm-audience" class="pmg-bm-input" type="text" maxlength="200" autocomplete="off" placeholder="e.g. busy moms, B2B SaaS founders" />',
            '</div>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-tone">Brand Tone</label>',
              '<select id="pmg-bm-tone" class="pmg-bm-select">' + toneOptions + '</select>',
            '</div>',
            '<p class="pmg-bm-saved" id="pmg-bm-saved">✓ Saved to this device</p>',
          '</div>',
        '</details>',

        /* Social Prompt Packs */
        '<details class="pmg-bm-section" id="pmg-bm-sec-pack">',
          '<summary>2. Social Prompt Packs</summary>',
          '<div class="pmg-bm-sec-body">',
            '<p class="pmg-bm-hint">Generate a coordinated set of prompts for multiple platforms in one shot.</p>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-pack">Pack</label>',
              '<select id="pmg-bm-pack" class="pmg-bm-select">' + packOptions + '</select>',
            '</div>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-pack-offer">Your Offer / Idea</label>',
              '<textarea id="pmg-bm-pack-offer" class="pmg-bm-textarea" placeholder="What are you promoting or talking about?"></textarea>',
            '</div>',
            '<button type="button" class="pmg-bm-build" id="pmg-bm-pack-build">Build Prompt →</button>',
            '<p class="pmg-bm-error" id="pmg-bm-pack-err"></p>',
          '</div>',
        '</details>',

        /* Platform Builder */
        '<details class="pmg-bm-section" id="pmg-bm-sec-platform">',
          '<summary>3. Platform Builder</summary>',
          '<div class="pmg-bm-sec-body">',
            '<p class="pmg-bm-hint">Focus on one platform with a specific content type and goal.</p>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-platform">Platform</label>',
              '<select id="pmg-bm-platform" class="pmg-bm-select">' + platformOptions + '</select>',
            '</div>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-content-type">Content Type</label>',
              '<select id="pmg-bm-content-type" class="pmg-bm-select">' + contentTypeOptions + '</select>',
            '</div>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-goal">Goal</label>',
              '<select id="pmg-bm-goal" class="pmg-bm-select">' + goalOptions + '</select>',
            '</div>',
            '<div class="pmg-bm-field">',
              '<label for="pmg-bm-platform-offer">Your Offer / Idea</label>',
              '<textarea id="pmg-bm-platform-offer" class="pmg-bm-textarea" placeholder="What are you promoting or talking about?"></textarea>',
            '</div>',
            '<button type="button" class="pmg-bm-build" id="pmg-bm-platform-build">Build Prompt →</button>',
            '<p class="pmg-bm-error" id="pmg-bm-platform-err"></p>',
          '</div>',
        '</details>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    drawer.querySelector('.pmg-bm-close').addEventListener('click', closeDrawer);

    /* Brand Voice persistence */
    var brand = loadBrand();
    var audIn = $('pmg-bm-audience');
    var toneIn = $('pmg-bm-tone');
    if (audIn)  audIn.value = brand.audience;
    if (toneIn) toneIn.value = brand.tone;

    var savedTimer = null;
    function flashSaved() {
      var s = $('pmg-bm-saved');
      if (!s) return;
      s.classList.add('is-shown');
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { s.classList.remove('is-shown'); }, 1400);
    }
    var saveDebounce = null;
    function persistBrandDebounced() {
      if (saveDebounce) clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function () {
        saveBrand(audIn ? audIn.value.trim() : '', toneIn ? toneIn.value : '');
        flashSaved();
      }, 250);
    }
    if (audIn)  audIn.addEventListener('input', persistBrandDebounced);
    if (toneIn) toneIn.addEventListener('change', function () {
      saveBrand(audIn ? audIn.value.trim() : '', toneIn.value);
      flashSaved();
    });

    /* Build Prompt handlers */
    var packBtn = $('pmg-bm-pack-build');
    if (packBtn) packBtn.addEventListener('click', onBuildPack);
    var platBtn = $('pmg-bm-platform-build');
    if (platBtn) platBtn.addEventListener('click', onBuildPlatform);

    /* Esc closes */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var ov = $('pmg-bm-overlay');
        if (ov && ov.classList.contains('is-open')) closeDrawer();
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * Open / close
   * ---------------------------------------------------------------- */
  function openDrawer() {
    buildDrawer();
    var ov = $('pmg-bm-overlay');
    var dr = $('pmg-bm-drawer');
    if (ov) ov.classList.add('is-open');
    if (dr) dr.classList.add('is-open');
  }
  function closeDrawer() {
    var ov = $('pmg-bm-overlay');
    var dr = $('pmg-bm-drawer');
    if (ov) ov.classList.remove('is-open');
    if (dr) dr.classList.remove('is-open');
  }

  /* ---------------------------------------------------------------- *
   * Assemble + dispatch
   * ---------------------------------------------------------------- */
  function brandSuffix() {
    /* Read LIVE values from the drawer inputs (if mounted) so a Build
       Prompt click immediately after typing in Brand Voice never
       races the 250ms debounced localStorage save. Falls back to
       localStorage when the drawer isn't built yet. */
    var audIn = $('pmg-bm-audience');
    var toneIn = $('pmg-bm-tone');
    var audience = audIn ? audIn.value.trim() : '';
    var tone     = toneIn ? toneIn.value : '';
    if (!audience && !tone) {
      var b = loadBrand();
      audience = b.audience;
      tone = b.tone;
    } else {
      /* Force-flush any pending debounced save so the next session
         restore reads what the user just typed. */
      saveBrand(audience, tone);
    }
    var parts = [];
    if (audience) parts.push('My target audience is ' + audience + '.');
    if (tone)     parts.push('My brand tone is ' + tone + '.');
    return parts.length ? ' ' + parts.join(' ') : '';
  }

  function onBuildPack() {
    var packEl = $('pmg-bm-pack');
    var offerEl = $('pmg-bm-pack-offer');
    var errEl = $('pmg-bm-pack-err');
    if (errEl) errEl.textContent = '';
    var packKey = packEl ? packEl.value : '';
    var offer = offerEl ? offerEl.value.trim() : '';
    if (!packKey) { if (errEl) errEl.textContent = 'Pick a pack first.'; return; }
    if (!offer)   { if (errEl) errEl.textContent = 'Tell us what you\'re promoting or talking about.'; return; }
    var pack = SOCIAL_PACKS[packKey];
    var goal = 'I need a ' + pack.label + ' for: ' + offer +
               '. Generate distinct, platform-native copy for ' + pack.platforms + '.' +
               brandSuffix();
    dispatchToText(goal);
  }

  function onBuildPlatform() {
    var pEl = $('pmg-bm-platform');
    var cEl = $('pmg-bm-content-type');
    var gEl = $('pmg-bm-goal');
    var oEl = $('pmg-bm-platform-offer');
    var errEl = $('pmg-bm-platform-err');
    if (errEl) errEl.textContent = '';
    var platform = pEl ? pEl.value : '';
    var ctype    = cEl ? cEl.value : '';
    var pgoal    = gEl ? gEl.value : '';
    var offer    = oEl ? oEl.value.trim() : '';
    if (!platform || !ctype || !pgoal) {
      if (errEl) errEl.textContent = 'Pick a platform, content type, and goal.';
      return;
    }
    if (!offer) {
      if (errEl) errEl.textContent = 'Tell us what you\'re promoting or talking about.';
      return;
    }
    var goal = 'Write a ' + platform + ' ' + ctype +
               ' aimed at ' + pgoal.toLowerCase() +
               ' for: ' + offer + '.' +
               brandSuffix();
    dispatchToText(goal);
  }

  function dispatchToText(goalText) {
    closeDrawer();
    /* Switch to Text Prompts tab so the user lands on the right surface. */
    try {
      if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
        window.pmgChassisV3.setActivePanel('text');
      }
    } catch (_) {}

    /* Inject into #goal + fire input event so any listeners (autosize,
       persistence, strength meter) update. */
    var goalEl = $('goal');
    if (goalEl) {
      goalEl.value = goalText;
      try { goalEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { goalEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }

    /* Submit the existing #prompt-form — generatePrompt is wired to its
       submit event in app.html (~L8843). requestSubmit fires the
       'submit' event AND triggers HTML5 validation. */
    var form = $('prompt-form');
    if (form) {
      try {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.submit();
      } catch (_) { try { form.submit(); } catch (__) {} }
    }
  }

  /* ---------------------------------------------------------------- *
   * Wire 💼 header icon (poll until chassis-v3 builds it)
   * ---------------------------------------------------------------- */
  function wireIcon() {
    var btn = $('pmgv3-business');
    if (!btn) return false;
    if (btn.getAttribute('data-bm-wired') === '1') return true;
    btn.setAttribute('data-bm-wired', '1');
    btn.addEventListener('click', openDrawer);
    return true;
  }
  function bootWire() {
    if (wireIcon()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (wireIcon() || tries > 60) clearInterval(iv);
    }, 200);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWire);
  } else {
    bootWire();
  }

  /* Tiny public API for tests / programmatic use. */
  window.pmgBusinessMode = {
    open: openDrawer,
    close: closeDrawer,
  };
})();
