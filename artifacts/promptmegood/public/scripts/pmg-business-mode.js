/* pmg-business-mode.js (growth-mode-tabs-1)
 *
 * Growth Mode — header-icon drawer with a two-lane (Business / Creator)
 * tool library. The 💼 button in the chassis-v3 topbar (#pmgv3-business)
 * opens a right-side slide-in drawer. Inside the drawer:
 *
 *   - A tab switcher at the top: [Business] [Creator]
 *   - Each tab shows a stack of <details> accordions (one per tool)
 *   - Each tool has a description line, input fields, and a Build Prompt →
 *     button that assembles a goal string and feeds it into #goal +
 *     submits #prompt-form (the existing generation flow)
 *   - "Pillar Content Builder" is a shared tool that lives at the bottom
 *     of BOTH tabs
 *   - Two persisted profiles (Brand Voice for Business, Creator Profile
 *     for Creator) save to localStorage and auto-append to every prompt
 *     built in their lane
 *
 * NON-NEGOTIABLES:
 *   - No new backend / no new AI routes.
 *   - Do NOT alter generatePrompt; assemble a string + feed #goal.
 *   - Do NOT touch pmg-growth-actions.js — it mounts Copy All / Export PDF
 *     when window.__pmgLastSource === 'growth' and must keep working.
 *   - Do NOT add a 4th tab to the chassis-v3 nav.
 *
 * Persistence keys (DO NOT CHANGE — existing users have data here):
 *   - 'pmgv3:bm:brand'   { audience, tone }            (existing)
 *   - 'pmgv3:bm:creator' { niche, platform, vibe }     (new)
 *   - 'pmgv3:bm:tab'     'business' | 'creator'        (last selected lane)
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- *
   * Constants
   * ---------------------------------------------------------------- */
  var LS_KEY_BRAND   = 'pmgv3:bm:brand';
  var LS_KEY_CREATOR = 'pmgv3:bm:creator';
  var LS_KEY_TAB     = 'pmgv3:bm:tab';

  var BRAND_TONES = [
    'Professional',
    'Casual',
    'Luxury',
    'Direct-Response',
    'Educational',
    'Founder-Led',
    'Funny',
    'Street-wise',
    'Bold',
    'Warm',
    'Authoritative',
    'Inspirational',
    'Minimalist',
  ];

  /* Tone playbook: each tone gets a one-line behavior definition the AI
     can actually act on. Without these, "Luxury" or "Direct-Response" is
     just a label the model has to guess at. */
  var TONE_PLAYBOOK = {
    'Professional':    'Confident, polished, and precise. Short sentences. No slang, no emojis.',
    'Casual':          'Conversational and warm — like a friend texting. Contractions, varied sentence length, light personality.',
    'Luxury':          'Aspirational, restrained, premium. Short sentences. No hype words ("amazing", "incredible"). Imply, do not announce.',
    'Direct-Response': 'Lead with the promise. Hard, specific CTA. Honest urgency. Cut every word that does not move the reader to act.',
    'Educational':     'Clear, structured, beginner-friendly. Define jargon. One idea per sentence. Examples beat abstractions.',
    'Founder-Led':     'First person ("I", "we"). Specific moments and numbers. Skip the brand voice — sound like a real human typing fast.',
    'Funny':           'Punchlines over polish. Concrete absurdity, not vague jokes. One real insight underneath the humor or it falls flat.',
    'Street-wise':     'Culture-forward and slang-aware. Drop-style cadence. Reference sneaker / streetwear / hip-hop culture only when it fits. Never try too hard — corny kills it.',
    'Bold':            'Swagger with no apologies. Strong opinions, short lines. Take a stance the reader either agrees with or argues with — never shrug-worthy.',
    'Warm':            'Empathy first. Acknowledge how the reader feels before you tell them anything. Soft language, no jargon, no pressure. Sound like the friend who actually listens.',
    'Authoritative':   'Lead with credibility. Cite specifics, numbers, mechanisms. No hedging ("maybe", "kind of"). The reader should feel they are hearing from the expert in the room.',
    'Inspirational':   'Aspirational and forward-looking. Paint the future the reader could have, then point at the next step. Earned uplift only — no hollow motivation-poster lines.',
    'Minimalist':      'Calm and spare. Few words. White space in the prose itself. One idea per paragraph. Trust the reader — under-explain rather than over-explain.',
  };

  /* Per-platform conventions used by the Multi-Platform tools.
     growth-mode-fixes-1: extended from the original 5 socials to cover
     every platform any SOCIAL_PACK references, plus all the new
     CREATOR_PLATFORMS entries. If a pack's `includes` lists a platform
     that has no PLATFORM_RULES entry, its conventions block silently
     disappears — a real defect we've seen for Pinterest/Facebook/etc. */
  var PLATFORM_RULES = {
    'TikTok':          { length: 'Under 90 words. 3-second visual hook in the first line.',                                                           hashtags: '3 niche hashtags max.',                                          notes: 'Spoken-word rhythm — read it out loud and cut what trips you up.' },
    'Instagram':       { length: 'Caption under 220 characters for Reels, under 600 for feed posts.',                                                 hashtags: '5 mid-tail hashtags.',                                           notes: 'First line is the scroll-stopper; everything after it earns the read.' },
    'YouTube':         { length: 'Title under 60 characters. Description: hook in first 2 lines, then structured body.',                              hashtags: '3 hashtags at the end.',                                         notes: 'Hook must work without thumbnail context.' },
    'YouTube Shorts':  { length: 'Title under 40 characters. Script under 60 seconds spoken (~150 words). Hook in the first 1.5 seconds.',            hashtags: '3 hashtags, #shorts last.',                                      notes: 'No long setup — pay off the hook by second 5 or viewers swipe.' },
    'LinkedIn':        { length: 'Hook line + 4-6 short paragraphs. Under 1,300 characters.',                                                         hashtags: '3 specific hashtags. No emojis unless tone is Casual or Funny.', notes: 'No "Excited to share…" openers. Lead with insight, story, or contrarian take.' },
    'X':               { length: 'Single post under 280 characters, or numbered thread (1/, 2/, …) of 5-9 posts.',                                     hashtags: '0-2 hashtags max.',                                              notes: 'Every post must stand on its own. No "and finally…" wind-down.' },
    'Pinterest':       { length: 'Pin title under 100 characters. Pin description 100-500 characters, keyword-loaded.',                              hashtags: 'No hashtags — Pinterest is search, not social.',                  notes: 'Treat every pin as SEO. Lead with the keyword phrase, not the brand.' },
    'Facebook':        { length: 'Under 80 words for organic reach. Longer (200-400) for storytelling posts in groups.',                              hashtags: 'No hashtags in body. 1-2 at end max.',                            notes: 'Conversational, ask a question, invite comments. Avoid links in post body — drop the link in the first comment.' },
    'Threads':         { length: 'Single post under 500 characters, or short thread (3-6 posts).',                                                    hashtags: '0-1 hashtag max.',                                                notes: 'Casual, reactive, conversational — closer to group-chat energy than X.' },
    'Podcast':         { length: 'Episode title under 70 characters. Show-notes 150-400 words with timestamps. Cold-open script 30-60 seconds spoken.', hashtags: 'N/A.',                                                            notes: 'Spoken-word cadence with pause cues. Lead with the most-quotable sentence.' },
    'Newsletter':      { length: 'Subject line 30-50 characters. Pre-header 40-90 characters. Body 200-800 words.',                                    hashtags: 'N/A.',                                                            notes: 'Subject line earns the open; first line earns the read. One CTA per email.' },
    'Blog':            { length: 'Title 50-65 characters (SEO sweet spot). Body 800-1500 words minimum.',                                              hashtags: 'N/A.',                                                            notes: 'Keyword in title + first 100 words. H2 every 200-300 words. One clear CTA.' },
    'Twitch':          { length: 'Stream title under 65 characters. "Going live" post under 200 characters.',                                          hashtags: 'N/A on Twitch. 1-2 on cross-posts.',                              notes: 'Lead with what is happening RIGHT NOW. Urgency over polish.' },
    'Google Business': { length: 'Post under 1,500 characters. Lead with the offer or update in the first 100.',                                       hashtags: 'N/A.',                                                            notes: 'Local-keyword friendly. Always include a CTA button (Call / Book / Visit).' },
    'Email':           { length: 'Subject 30-50 characters. Pre-header 40-90 characters. Body 80-300 words for an announcement.',                      hashtags: 'N/A.',                                                            notes: 'One job per email. One CTA. Plain-text feel beats fancy templates.' },
  };

  /* growth-mode-fixes-1: rewrote so each pack's `label` matches its
     `includes` exactly. The old labels promised platforms (Pinterest,
     Facebook, Google Business, Email, YouTube Shorts) that were never
     in `includes`, so the AI was told to write for 4 platforms but
     received per-platform rules for only 2 — silent under-delivery. */
  var SOCIAL_PACKS = {
    launch:     { label: 'Launch Pack (TikTok + Instagram + LinkedIn + X + Email)',          platforms: 'a TikTok video script, an Instagram Reel caption, a LinkedIn post, an X thread, and an email announcement', includes: ['TikTok', 'Instagram', 'LinkedIn', 'X', 'Email'] },
    ecommerce:  { label: 'Ecommerce Product Pack (TikTok + Instagram + Pinterest + Facebook)', platforms: 'a TikTok product demo script, an Instagram Reel caption, a Pinterest pin, and a Facebook post',          includes: ['TikTok', 'Instagram', 'Pinterest', 'Facebook'] },
    founder:    { label: 'Founder Content Pack (LinkedIn + X + YouTube Shorts)',              platforms: 'a LinkedIn post, an X thread, and a YouTube Shorts script',                                                  includes: ['LinkedIn', 'X', 'YouTube Shorts'] },
    local:      { label: 'Local Business Pack (Facebook + Instagram + Google Business)',      platforms: 'a Facebook post, an Instagram caption, and a Google Business update',                                        includes: ['Facebook', 'Instagram', 'Google Business'] },
    viral:      { label: 'Viral Short-Form Pack (TikTok + Reels + YouTube Shorts)',           platforms: 'a TikTok script, an Instagram Reels caption, and a YouTube Shorts script',                                    includes: ['TikTok', 'Instagram', 'YouTube Shorts'] },
    podcast:    { label: 'Podcast Promo Pack (Podcast + Newsletter + LinkedIn + X)',          platforms: 'a podcast episode promo, a newsletter teaser, a LinkedIn post, and an X thread',                              includes: ['Podcast', 'Newsletter', 'LinkedIn', 'X'] },
    newsletter: { label: 'Newsletter Drop Pack (Newsletter + X + LinkedIn + Threads)',        platforms: 'a newsletter, an X teaser thread, a LinkedIn post, and a Threads post',                                       includes: ['Newsletter', 'X', 'LinkedIn', 'Threads'] },
  };

  var SEQUENCE_TYPES = [
    'Welcome', 'Onboarding', 'Nurture', 'Launch',
    'Post-purchase', 'Abandoned Cart', 'Upsell',
    'Win-back', 'Re-engagement', 'Referral Request',
  ];
  var SEQUENCE_LENGTHS = ['3 emails', '5 emails', '7 emails', '10 emails'];
  var POSTING_FREQUENCIES = ['Daily', '3x/week', 'Weekly'];
  var CALENDAR_RANGES = ['1 week', '2 weeks', '4 weeks'];
  var CREATOR_PLATFORMS = [
    'TikTok', 'Instagram', 'YouTube', 'LinkedIn', 'X',
    'Podcast', 'Newsletter', 'Blog', 'Pinterest', 'Twitch', 'Threads', 'Facebook',
    'Other'
  ];
  var PILLAR_FORMATS = [
    'Blog Post', 'YouTube Long-form Video', 'Podcast Episode',
    'Webinar', 'Email Course (5 lessons)', 'LinkedIn Essay',
    'Twitter Mega-Thread (15+ posts)', 'Long Instagram Carousel',
  ];
  var HOOK_FORMATS = [
    'Best fit (AI picks)', 'Short video (TikTok / Reels / Shorts)',
    'Long video (YouTube)', 'Newsletter subject line',
    'Cold DM / outreach', 'LinkedIn opener', 'Podcast cold open',
    'Blog post intro',
  ];
  var SERIES_COUNTS = ['3-part', '5-part', '7-part', '10-part'];
  var FUNNEL_TYPES = [
    'Direct-response (ad → page → buy)', 'Webinar funnel',
    'Sales call funnel (B2B)', 'Free trial funnel (SaaS)',
    'Lead magnet → email nurture → offer',
  ];
  var OBJECTION_FRAMEWORKS = [
    'Best fit (AI picks)', 'Feel-Felt-Found',
    'AIKIDO (Acknowledge + side-with)',
    'Acknowledge-Pivot-Prove',
  ];
  var PRICING_STRATEGIES = [
    'Validate my current price',
    'Find a raise opportunity',
    'Build a good/better/best tier ladder',
    'Counter an undercutting competitor',
    'Stress-test "what if I doubled it?"',
  ];
  var TITLE_FORMATS = [
    'YouTube long-form (title + thumbnail)',
    'YouTube Shorts cover',
    'TikTok title cover',
    'Podcast episode title + cover art',
    'Blog post hero (SEO title)',
    'Newsletter subject line',
  ];
  var COLLAB_ASKS = [
    'Paid sponsorship', 'Product trade / gifted',
    'Content swap / cross-promo', 'Podcast guest spot',
    'Affiliate partnership', 'Co-launch / co-creation',
  ];

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
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function selectOpts(values, placeholder) {
    var parts = ['<option value="">' + esc(placeholder || 'Select…') + '</option>'];
    values.forEach(function (v) {
      // Support either ["A","B"] or [{value,label}]
      var val = typeof v === 'string' ? v : v.value;
      var lab = typeof v === 'string' ? v : v.label;
      parts.push('<option value="' + esc(val) + '">' + esc(lab) + '</option>');
    });
    return parts.join('');
  }

  function loadBrand() {
    try {
      var raw = localStorage.getItem(LS_KEY_BRAND);
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
      localStorage.setItem(LS_KEY_BRAND, JSON.stringify({ audience: audience || '', tone: tone || '' }));
    } catch (_) {}
  }
  function loadCreator() {
    /* vibe-tone-consolidation-1: Creator Vibe was always the same field
       as Brand Tone — same options array, same downstream prompt slot,
       same toneRole() helper. The split only made sense when Business
       and Creator were separate lanes (that switcher was removed in
       growth-mode-goal-groups-1). We now backfill `vibe` from
       brand.tone whenever the creator record is missing one so any
       remaining `creator.vibe` reads keep working without a saved
       value, and so the UI can drop the duplicate field. */
    var empty = { niche: '', platform: '', platformOther: '', vibe: '' };
    try {
      var raw = localStorage.getItem(LS_KEY_CREATOR);
      var brandTone = '';
      try {
        var b = JSON.parse(localStorage.getItem(LS_KEY_BRAND) || '{}');
        if (typeof b.tone === 'string' && BRAND_TONES.indexOf(b.tone) >= 0) brandTone = b.tone;
      } catch (_) {}
      if (!raw) {
        empty.vibe = brandTone;
        return empty;
      }
      var v = JSON.parse(raw);
      var savedVibe = typeof v.vibe === 'string' && BRAND_TONES.indexOf(v.vibe) >= 0 ? v.vibe : '';
      return {
        niche:         typeof v.niche === 'string' ? v.niche : '',
        platform:      typeof v.platform === 'string' && CREATOR_PLATFORMS.indexOf(v.platform) >= 0 ? v.platform : '',
        platformOther: typeof v.platformOther === 'string' ? v.platformOther : '',
        vibe:          savedVibe || brandTone,
      };
    } catch (_) { return empty; }
  }
  function saveCreator(niche, platform, vibe, platformOther) {
    try {
      localStorage.setItem(LS_KEY_CREATOR, JSON.stringify({
        niche: niche || '',
        platform: platform || '',
        platformOther: platformOther || '',
        vibe: vibe || '',
      }));
    } catch (_) {}
  }
  function loadActiveTab() {
    try {
      var v = localStorage.getItem(LS_KEY_TAB);
      return v === 'creator' ? 'creator' : 'business';
    } catch (_) { return 'business'; }
  }
  function saveActiveTab(name) {
    try { localStorage.setItem(LS_KEY_TAB, name === 'creator' ? 'creator' : 'business'); } catch (_) {}
  }

  /* ---------------------------------------------------------------- *
   * Persona blocks appended to every prompt built in a lane
   * ---------------------------------------------------------------- */
  function brandBlock(brand) {
    var lines = [];
    if (brand.audience) lines.push('Audience: ' + brand.audience + '.');
    if (brand.tone) {
      var play = TONE_PLAYBOOK[brand.tone] || '';
      lines.push('Tone: ' + brand.tone + (play ? ' — ' + play : '.'));
    }
    return lines.length ? 'Brand Voice:\n' + lines.join('\n') : '';
  }
  function creatorBlock(creator) {
    var lines = [];
    if (creator.niche)    lines.push('Niche: ' + creator.niche + '.');
    if (creator.platform) {
      /* When the user picked "Other" and filled in the free-text input,
         use that custom name so the AI sees the actual platform (e.g.
         "Telegram", "Geneva") rather than the literal word "Other". */
      var platName = creator.platform;
      if (platName === 'Other' && creator.platformOther) platName = creator.platformOther;
      lines.push('Primary platform: ' + platName + '.');
    }
    /* vibe-tone-consolidation-1: Creator Vibe field removed from the
       UI; voice is now sourced from Brand Tone only (see loadCreator).
       brandBlock already emits the Tone line for any tool whose lane
       is 'creator' or 'shared', so we don't repeat it here. */
    return lines.length ? 'Creator Profile:\n' + lines.join('\n') : '';
  }
  function appendPersona(prompt, lane) {
    /* growth-mode-goal-groups-1: the two-lane switcher is gone. The
       shared "About Your Brand" header at the top of the drawer holds
       BOTH Brand Voice (audience/tone) and Creator Profile
       (niche/platform/vibe). For any tool's build output (lane === null,
       'business', 'creator', or the legacy 'shared'), we now append
       whichever blocks have content — both, one, or neither. */
    var blocks = [];
    if (lane === 'business') {
      var b = brandBlock(loadBrand());
      if (b) blocks.push(b);
    } else if (lane === 'creator') {
      var c = creatorBlock(loadCreator());
      if (c) blocks.push(c);
    } else {
      /* null / 'shared' / anything else → append every non-empty block. */
      var b2 = brandBlock(loadBrand());
      var c2 = creatorBlock(loadCreator());
      if (b2) blocks.push(b2);
      if (c2) blocks.push(c2);
    }
    return blocks.length ? prompt + '\n\n' + blocks.join('\n\n') : prompt;
  }

  /* ---------------------------------------------------------------- *
   * Tool registry — each tool renders the same way; only fields + the
   * build() function differ. Order in the array = order in the drawer.
   *
   * Lane: 'business' | 'creator' | 'shared'
   * Persisted: true means no Build button; the tool auto-saves its
   *            fields to a profile (Brand Voice or Creator Profile).
   * ---------------------------------------------------------------- */
  var TOOLS = [
    /* ===================== HEADER PROFILES ===================== */
    {
      id: 'brand-voice',
      lane: 'business',
      persisted: true,
      title: 'Brand Voice',
      titleSuffix: '(saved automatically)',
      desc: 'Set your audience and voice once. Every prompt you build will automatically match them.',
      open: true,
      fields: [
        /* growth-mode-master-fixes-1: audience promoted from text(200) to
           textarea(600) so the user can describe an actual persona ("busy
           moms in their 30s-40s who already tried YouTube workouts…")
           instead of a useless 2-word label ("busy moms"). Backward
           compatible — older saved 2-word values just look short. */
        { id: 'pmg-bm-audience', label: 'Target Audience', type: 'textarea', placeholder: 'Describe who you serve in 2-3 sentences. e.g. "Busy moms in their 30s-40s who want to feel strong again after kids. They piece together YouTube workouts and feel inconsistent."', maxlength: 600 },
        { id: 'pmg-bm-tone',     label: 'Voice',           type: 'select',   options: BRAND_TONES, placeholder: 'Select your voice…' },
      ],
    },
    {
      id: 'creator-profile',
      lane: 'creator',
      persisted: true,
      title: 'Creator Profile',
      titleSuffix: '(saved automatically)',
      desc: 'Set your niche and primary platform once. Every prompt you build will be tuned to your platform automatically. (Voice is set in the Brand Voice card above.)',
      open: true,
      fields: [
        { id: 'pmg-bm-cr-niche',          label: 'Niche',           type: 'text',   placeholder: 'e.g. home espresso, indie game dev' },
        { id: 'pmg-bm-cr-platform',       label: 'Platform Focus',  type: 'select', options: CREATOR_PLATFORMS, placeholder: 'Select a platform…' },
        { id: 'pmg-bm-cr-platform-other', label: 'Which platform?', type: 'text',   placeholder: 'e.g. Telegram, Geneva, Lemon8' },
      ],
    },

    /* ===================== KNOW YOUR AUDIENCE ===================== */
    {
      id: 'voc-miner',
      lane: 'business',
      title: 'Voice-of-Customer Miner',
      desc: 'Paste real customer language (reviews, DMs, comments, support tickets) and extract the exact words your audience uses. The single highest-leverage input for every other tool.',
      fields: [
        { id: 'pmg-bm-voc-raw',     label: 'Raw customer language', type: 'textarea', placeholder: 'Paste 5+ reviews, DMs, comments, survey replies, support tickets — anything they wrote in their own words.' },
        { id: 'pmg-bm-voc-product', label: 'What this is about',    type: 'text',     placeholder: 'The product / service / topic the comments are about.' },
      ],
      build: function (v) {
        return 'Act as a voice-of-customer researcher. From this raw customer language: ' + v['pmg-bm-voc-raw'] +
          ' (context: ' + v['pmg-bm-voc-product'] + '), extract: ' +
          '1) Top 10 verbatim phrases the audience actually uses (in their words, not yours). ' +
          '2) The 3 biggest pains they describe (in their words). ' +
          '3) The 3 biggest desires they describe (in their words). ' +
          '4) 5 words/phrases I should NEVER use because they do not talk like that. ' +
          '5) The single most-repeated metaphor or comparison.\n\n' +
          'End your response with this exact labeled block (replace the angle-bracket text):\n' +
          '===BRAND_AUDIENCE_SNIPPET===\n' +
          '<a tight 2-3 sentence persona summary I can copy back into my Brand Voice settings — who they are, what they want, what they currently use>\n' +
          '===END===';
      },
    },
    {
      id: 'persona',
      lane: 'business',
      title: 'Customer Persona Builder',
      desc: 'Describe your product and get a detailed profile of your ideal buyer — their pain points, desires, and where to find them.',
      fields: [
        { id: 'pmg-bm-persona-product',   label: 'Product / Service description',      type: 'textarea', placeholder: 'What you sell, in one sentence or two.' },
        { id: 'pmg-bm-persona-customers', label: 'Current customer signals (optional)', type: 'textarea', placeholder: 'Anything you know about existing customers — job titles, age range, what they bought before, where you met them.' },
        { id: 'pmg-bm-persona-price',     label: 'Price tier (optional)',              type: 'text',     placeholder: 'e.g. $47 one-off, $97/mo, $5k enterprise' },
        { id: 'pmg-bm-persona-alt',       label: 'What they use today (optional)',     type: 'text',     placeholder: 'The DIY workaround or competitor they currently use.' },
      ],
      build: function (v) {
        return 'Act as a senior market researcher. Build a detailed buyer persona for this product/service: ' + v['pmg-bm-persona-product'] + '. ' +
          (v['pmg-bm-persona-customers'] ? 'Known customer signals: ' + v['pmg-bm-persona-customers'] + '. ' : '') +
          (v['pmg-bm-persona-price']     ? 'Price tier: ' + v['pmg-bm-persona-price'] + '. ' : '') +
          (v['pmg-bm-persona-alt']       ? 'What they currently use instead: ' + v['pmg-bm-persona-alt'] + '. ' : '') +
          'Include: Demographics, core pain points, primary desires, buying triggers, objections, and where they hang out online.\n\n' +
          'End your response with this exact labeled block (replace the angle-bracket text):\n' +
          '===BRAND_AUDIENCE_SNIPPET===\n' +
          '<a tight 2-3 sentence persona summary I can copy into my Brand Voice settings — who they are, what they want, what they currently use>\n' +
          '===END===';
      },
    },

    /* ===================== SELL SOMETHING ===================== */
    {
      id: 'offer',
      lane: 'business',
      title: 'Offer Clarity Tool',
      desc: 'Turn a rough idea into a sharp value proposition, tagline, and 3 key benefits — the foundation of all your marketing copy.',
      fields: [
        { id: 'pmg-bm-offer-raw',      label: 'Raw idea / offer description', type: 'textarea', placeholder: 'Your offer in your own messy words — we sharpen it.' },
        { id: 'pmg-bm-offer-audience', label: 'Who is this for? (optional)',  type: 'text',     placeholder: 'If different from your Brand Voice audience.' },
        { id: 'pmg-bm-offer-price',    label: 'Price point (optional)',       type: 'text',     placeholder: 'e.g. $97, $2,000/yr' },
      ],
      build: function (v) {
        return 'Act as a direct-response copywriter. Take this raw offer idea: ' + v['pmg-bm-offer-raw'] + ' and refine it into: ' +
          (v['pmg-bm-offer-audience'] ? 'Audience: ' + v['pmg-bm-offer-audience'] + '. ' : '') +
          (v['pmg-bm-offer-price']    ? 'Price: ' + v['pmg-bm-offer-price'] + '. ' : '') +
          '1) A one-sentence value proposition. ' +
          '2) A punchy tagline. ' +
          '3) Three bullet points highlighting the biggest benefits (not features). ' +
          '4) The one objection this offer needs to overcome on the sales page.';
      },
    },
    {
      id: 'funnel',
      lane: 'business',
      title: 'Sales Funnel Builder',
      desc: 'Map a complete funnel from first impression to closed sale — built for the specific funnel type your business actually runs.',
      fields: [
        { id: 'pmg-bm-funnel-product',  label: 'Product',         type: 'text',   placeholder: 'What you\'re selling' },
        { id: 'pmg-bm-funnel-price',    label: 'Price point',     type: 'text',   placeholder: 'e.g. $97, $2,000/yr' },
        { id: 'pmg-bm-funnel-audience', label: 'Target audience', type: 'text',   placeholder: 'Who you\'re selling to' },
        { id: 'pmg-bm-funnel-type',     label: 'Funnel type',     type: 'select', options: FUNNEL_TYPES, placeholder: 'Select a funnel type…' },
      ],
      build: function (v) {
        var ftype = v['pmg-bm-funnel-type'] || 'Direct-response (ad → page → buy)';
        return 'Act as a conversion rate optimization expert. Map out a complete ' + ftype +
          ' funnel for this product: ' + v['pmg-bm-funnel-product'] +
          ' priced at ' + v['pmg-bm-funnel-price'] + ' targeting ' + v['pmg-bm-funnel-audience'] + '. ' +
          'Choose the right number of steps for THIS funnel type — do not force 5 steps if 3 or 7 fit better. ' +
          'For each step include: the asset/touchpoint, the one job that step does, and the metric that proves it worked.';
      },
    },
    {
      id: 'objection',
      lane: 'business',
      title: 'Objection Crusher',
      desc: 'Turn your most common sales objections into confident, non-pushy rebuttals you can use on calls, in DMs, or on your sales page.',
      fields: [
        { id: 'pmg-bm-obj-product',   label: 'Product',        type: 'text',     placeholder: 'What you\'re selling' },
        { id: 'pmg-bm-obj-objection', label: 'Main objection', type: 'textarea', placeholder: 'e.g. "It\'s too expensive", "I don\'t have time"' },
        { id: 'pmg-bm-obj-framework', label: 'Framework',      type: 'select',   options: OBJECTION_FRAMEWORKS, placeholder: 'Best fit (AI picks)' },
      ],
      build: function (v) {
        var fw = v['pmg-bm-obj-framework'];
        var fwLine = (!fw || fw === 'Best fit (AI picks)')
          ? 'Pick the best objection-handling framework for THIS specific objection and name it at the top of your response.'
          : 'Use the ' + fw + ' framework.';
        return 'Act as a master sales closer. My product is ' + v['pmg-bm-obj-product'] + ' and the main objection I hear is ' +
          v['pmg-bm-obj-objection'] + '. Write a 3-part rebuttal script I can use on sales calls or in DMs to overcome this objection ' +
          'without sounding pushy. ' + fwLine;
      },
    },
    {
      id: 'pricing',
      lane: 'business',
      title: 'Pricing & Positioning Advisor',
      desc: 'Strategic pricing analysis for YOUR situation — not a generic "double your price" exercise.',
      fields: [
        { id: 'pmg-bm-price-current',  label: 'Current price',       type: 'text',     placeholder: 'e.g. $497' },
        { id: 'pmg-bm-price-product',  label: 'Product description', type: 'textarea', placeholder: 'What it is, who it\'s for, what they get.' },
        { id: 'pmg-bm-price-strategy', label: 'What do you want?',   type: 'select',   options: PRICING_STRATEGIES, placeholder: 'Select a strategy…' },
      ],
      build: function (v) {
        var strat = v['pmg-bm-price-strategy'] || 'Validate my current price';
        return 'Act as a pricing strategist. My product is ' + v['pmg-bm-price-product'] +
          ' and currently costs ' + v['pmg-bm-price-current'] + '. ' +
          'Run this strategic exercise: "' + strat + '". ' +
          'Give me specific, actionable output — names, numbers, and the exact 3 next steps I would take this week.';
      },
    },
    {
      id: 'biz-multidrop',
      lane: 'business',
      title: 'Multi-Platform Launch Drop',
      desc: 'Generate a coordinated set of platform-native posts for a launch, product, or campaign — all in one shot.',
      fields: [
        { id: 'pmg-bm-bizpack-type',  label: 'Pack type',         type: 'pack',     placeholder: 'Select a pack…' },
        { id: 'pmg-bm-bizpack-offer', label: 'Your offer / idea', type: 'textarea', placeholder: 'What are you promoting or talking about?' },
      ],
      build: function (v) {
        return buildPackPrompt(v['pmg-bm-bizpack-type'], v['pmg-bm-bizpack-offer']);
      },
    },

    /* ===================== BUILD AN AUDIENCE ===================== */
    {
      id: 'hooks',
      lane: 'creator',
      title: 'Hook Generator',
      desc: 'Stop the scroll. Get 5 completely different hook styles — built for the specific format you\'re publishing in.',
      fields: [
        { id: 'pmg-bm-hook-topic',  label: 'Topic / Idea', type: 'textarea', placeholder: 'What\'s the post about?' },
        { id: 'pmg-bm-hook-format', label: 'Format',       type: 'select',   options: HOOK_FORMATS, placeholder: 'Best fit (AI picks)' },
      ],
      build: function (v) {
        var fmt = v['pmg-bm-hook-format'];
        var fmtLine = (!fmt || fmt === 'Best fit (AI picks)')
          ? 'Pick the strongest format for this topic and note it at the top.'
          : 'Format: ' + fmt + '.';
        return 'Act as a viral content strategist. Write 5 distinct, scroll-stopping hooks for this topic: ' + v['pmg-bm-hook-topic'] + '. ' + fmtLine + ' ' +
          'Use 5 different frameworks across the set — curiosity gap, contrarian, personal story/failure, shocking stat, bold promise — ' +
          'but adapt each to the chosen format (subject lines, video opens, DM opens, etc. each have their own rules).';
      },
    },
    {
      id: 'bio',
      lane: 'creator',
      title: 'Bio & Profile Optimizer',
      desc: 'Get an optimized bio for your primary platform + 3 platforms that pair well with it — each written for that platform\'s character limits and culture.',
      fields: [
        { id: 'pmg-bm-bio-niche', label: 'Niche',             type: 'text', placeholder: 'e.g. mobile photography for travel' },
        { id: 'pmg-bm-bio-value', label: 'Value proposition', type: 'text', placeholder: 'What makes you different?' },
      ],
      build: function (v) {
        var creator = loadCreator();
        var platform = creator.platform === 'Other' && creator.platformOther ? creator.platformOther : creator.platform;
        var platLine = platform
          ? 'My primary platform is ' + platform + '. Write the bio for ' + platform + ' first, then 3 cross-promo bios for the platforms that pair best with ' + platform + ' (e.g. Podcast pairs with Newsletter + LinkedIn; TikTok pairs with Instagram + YouTube; Newsletter pairs with X + LinkedIn).'
          : 'Write optimized profile bios for: X/Twitter (160 chars), Instagram (150 chars, use line breaks), TikTok (80 chars), LinkedIn headline (220 chars).';
        return 'Act as a personal branding expert. My niche is ' + v['pmg-bm-bio-niche'] + ' and my value prop is ' + v['pmg-bm-bio-value'] + '. ' +
          platLine + ' For each, respect that platform\'s exact character limit and conventions.';
      },
    },
    {
      id: 'audience-mine',
      lane: 'creator',
      title: 'Competitor Audience Miner',
      desc: 'Mine a competitor or adjacent creator\'s audience for gaps you can fill — and the exact language to use when you reach out.',
      fields: [
        { id: 'pmg-bm-audmine-competitor', label: 'Competitor / creator', type: 'text', placeholder: 'Their handle, channel, or name' },
        { id: 'pmg-bm-audmine-where',      label: 'Where to mine',        type: 'text', placeholder: 'e.g. YouTube comments, IG replies, podcast reviews' },
      ],
      build: function (v) {
        return 'Act as an audience researcher. I want to learn from ' + v['pmg-bm-audmine-competitor'] +
          '\'s audience by reading ' + v['pmg-bm-audmine-where'] + '. Generate: ' +
          '1) 10 specific questions to look for in their audience\'s comments (signal what people actually want). ' +
          '2) Patterns that signal real engagement vs. polite engagement. ' +
          '3) 5 specific gaps in what the competitor delivers that I could fill. ' +
          '4) A 3-question, low-pressure DM template I can send to 5 of their most engaged commenters to learn more (NOT a sales pitch — research only).';
      },
    },
    {
      id: 'first-1000',
      lane: 'creator',
      title: 'First 1,000 Followers Plan',
      desc: 'No-bullshit 60-day plan to your first 1,000 engaged followers — day-by-day for week 1, plus the platform you should focus on and what to stop doing.',
      fields: [
        { id: 'pmg-bm-f1k-niche',    label: 'Niche',             type: 'text',     placeholder: 'e.g. home espresso, indie game dev' },
        { id: 'pmg-bm-f1k-starting', label: 'Where you are now', type: 'textarea', placeholder: 'Current following, what you\'ve posted, time/week available, budget if any.' },
      ],
      build: function (v) {
        return 'Act as a no-bullshit creator coach. I\'m in ' + v['pmg-bm-f1k-niche'] +
          ' and currently: ' + v['pmg-bm-f1k-starting'] + '. ' +
          'Give me a 60-day plan to my first 1,000 engaged (not vanity) followers. Include: ' +
          '1) The ONE platform I should focus on, with reasoning. ' +
          '2) Content cadence — specific day-by-day plan for week 1. ' +
          '3) 5 outreach moves per week (real moves, not "engage with your audience"). ' +
          '4) A specific stop-doing list. ' +
          '5) The one metric to track weekly that actually predicts traction.';
      },
    },

    /* ===================== CREATE CONTENT ===================== */
    {
      id: 'calendar',
      lane: 'creator',
      title: 'Content Calendar Builder',
      desc: 'Get a content calendar for your range, your cadence, and your content pillars — so every post ladders up to your thesis.',
      fields: [
        { id: 'pmg-bm-cal-niche',   label: 'Niche',                       type: 'text',     placeholder: 'e.g. fitness for new moms' },
        { id: 'pmg-bm-cal-range',   label: 'Range',                       type: 'select',   options: CALENDAR_RANGES,    placeholder: 'Select range…' },
        { id: 'pmg-bm-cal-freq',    label: 'Posting Frequency',           type: 'select',   options: POSTING_FREQUENCIES, placeholder: 'Select frequency…' },
        { id: 'pmg-bm-cal-pillars', label: 'Content pillars (optional)',  type: 'textarea', placeholder: '2-4 themes everything you post should ladder up to. e.g. "1) postpartum recovery, 2) strength training without a gym, 3) honest mom-life stories"' },
      ],
      build: function (v) {
        var pillarLine = v['pmg-bm-cal-pillars'] ? ' Every post must ladder up to one of these pillars: ' + v['pmg-bm-cal-pillars'] + '.' : '';
        return 'Act as a social media manager. Build a ' + (v['pmg-bm-cal-range'] || '2 weeks') +
          ' content calendar for a creator in the ' + v['pmg-bm-cal-niche'] + ' niche, posting ' +
          (v['pmg-bm-cal-freq'] || 'Weekly') + '.' + pillarLine + ' ' +
          'For each post, provide: The format (e.g., Reel, Carousel, Thread), the core topic, which pillar it serves, and the specific goal (Awareness, Engagement, Conversion).';
      },
    },
    {
      id: 'series',
      lane: 'creator',
      title: 'Series Builder',
      desc: 'Turn one idea into a binge-worthy series — adapted to your primary platform, in the length that fits the idea.',
      fields: [
        { id: 'pmg-bm-series-concept', label: 'Core concept for the series', type: 'textarea', placeholder: 'The one big idea the series unpacks.' },
        { id: 'pmg-bm-series-count',   label: 'How many parts?',             type: 'select',   options: SERIES_COUNTS, placeholder: 'Select count…' },
      ],
      build: function (v) {
        var creator = loadCreator();
        var platform = creator.platform === 'Other' && creator.platformOther ? creator.platformOther : creator.platform;
        var producerRole = platform
          ? 'Act as a producer who has shipped 100+ successful series on ' + platform + ' specifically.'
          : 'Act as a YouTube/Podcast producer.';
        var count = v['pmg-bm-series-count'] || '5-part';
        return producerRole + ' Take this core concept: ' + v['pmg-bm-series-concept'] +
          ' and map it out into a ' + count + ' episodic series adapted for ' + (platform || 'long-form video / podcast') + '. ' +
          'For each episode, provide a click-worthy title (respecting ' + (platform || 'the platform') +
          '\'s character limits), the main angle/hook, and how it connects to the next episode to keep viewers binging.';
      },
    },
    {
      id: 'repurpose',
      lane: 'creator',
      title: 'Repurpose Engine',
      desc: 'Paste one piece of content and get it remixed into formats native to your primary platform — not a generic 4-pack.',
      fields: [
        { id: 'pmg-bm-rep-content', label: 'Original content', type: 'textarea', placeholder: 'Paste text or describe the piece in detail.' },
      ],
      build: function (v) {
        var creator = loadCreator();
        var platform = creator.platform === 'Other' && creator.platformOther ? creator.platformOther : creator.platform;
        /* growth-mode-master-fixes-1: per-platform output specs.
           Each describes the 3-4 assets that actually make sense for a
           creator on that platform — instead of the old hardcoded
           "X thread + TikTok + LinkedIn + newsletter" that ignored
           the user's actual surface. */
        var specs = {
          'Podcast':    '1) A 5-min monologue script for the next episode. 2) Show-notes outline with 4-6 timestamps. 3) A newsletter teaser linking to the episode. 4) 3 audiogram quote cards (the most-quotable single lines).',
          'Newsletter': '1) A subject line + cold-open paragraph. 2) The full newsletter (3-5 short sections). 3) An X teaser thread driving to subscribe. 4) A LinkedIn post extracting the single best insight.',
          'Blog':       '1) An SEO-optimized 800-word blog post (title, H2s, intro, body, CTA). 2) A LinkedIn post with the contrarian angle. 3) A newsletter snippet linking to the post. 4) 3 social pull-quote cards.',
          'Pinterest':  '1) 10 pin descriptions with keyword-loaded SEO. 2) 3 board groupings these pins belong in. 3) An idea-pin script (multi-frame). 4) A Facebook post seeding the same idea.',
          'Twitch':     '1) A stream title + category tag for the next stream. 2) 3 "going live" announcement posts (Discord, X, IG story). 3) A clip-able moments list (what to look for during stream). 4) A YouTube Shorts script repurposing the best clip.',
          'Threads':    '1) A 4-post Threads thread. 2) A single hot-take Threads post. 3) An X cross-post variant. 4) An Instagram story sequence linking to the thread.',
          'Facebook':   '1) A long-form text post (storytelling). 2) A short link teaser for groups. 3) A group-discussion-prompt variant. 4) An email newsletter snippet for cross-channel.',
          'LinkedIn':   '1) A 6-paragraph LinkedIn post. 2) An X thread with the same insight. 3) A newsletter intro using the same hook. 4) A 60-second carousel script.',
          'TikTok':     '1) A 60-second TikTok script with hook cues. 2) An Instagram Reels caption + on-screen text. 3) A YouTube Shorts script variant. 4) A 5-tweet X thread with the same insight.',
          'Instagram':  '1) An Instagram Reels script. 2) A carousel outline (5-7 slides). 3) A TikTok variant. 4) A short newsletter blurb.',
          'YouTube':    '1) A YouTube Shorts script. 2) A 5-tweet X thread with the most-shareable insight. 3) A newsletter intro linking to the video. 4) A LinkedIn post.',
          'X':          '1) A 5-tweet X thread. 2) A LinkedIn post with the same angle. 3) A newsletter snippet. 4) A TikTok script variant.',
        };
        var outputSpec = specs[platform] || '1) A 5-tweet X thread. 2) A script for a 60-second TikTok/Reel. 3) A LinkedIn text post. 4) A short email newsletter intro linking to the original.';
        var platLine = platform ? 'My primary platform is ' + platform + ', so prioritize formats native to ' + platform + '. ' : '';
        return 'Act as a content repurposing expert. ' + platLine +
          'Take this original content: ' + v['pmg-bm-rep-content'] +
          ' and extract the core insights. Then write:\n' + outputSpec;
      },
    },
    {
      id: 'titles',
      lane: 'creator',
      title: 'Title & Visual Asset Generator',
      desc: 'Your title and cover are 90% of your clicks. Get 5 click-worthy title variants + a matching visual concept for each — built for the format you actually publish in.',
      fields: [
        { id: 'pmg-bm-titles-topic',  label: 'Topic',  type: 'textarea', placeholder: 'What\'s the piece about?' },
        { id: 'pmg-bm-titles-format', label: 'Format', type: 'select',   options: TITLE_FORMATS, placeholder: 'Select format…' },
      ],
      build: function (v) {
        var fmt = v['pmg-bm-titles-format'] || 'YouTube long-form (title + thumbnail)';
        return 'Act as a content packaging expert. For a piece about ' + v['pmg-bm-titles-topic'] +
          ' in this format: ' + fmt + ', generate 5 highly clickable title variants (respecting the format\'s actual character limit). ' +
          'For each title, describe the matching visual concept (thumbnail / cover art / hero image / subject-line pre-header — whichever the format calls for) that creates curiosity and complements the title without repeating it.';
      },
    },
    {
      id: 'cr-multidrop',
      lane: 'creator',
      title: 'Multi-Platform Drop',
      desc: 'Generate a coordinated set of platform-native posts for a launch, product, or campaign — all in one shot.',
      fields: [
        { id: 'pmg-bm-crpack-type',  label: 'Pack type',         type: 'pack',     placeholder: 'Select a pack…' },
        { id: 'pmg-bm-crpack-offer', label: 'Your offer / idea', type: 'textarea', placeholder: 'What are you promoting or talking about?' },
      ],
      build: function (v) {
        return buildPackPrompt(v['pmg-bm-crpack-type'], v['pmg-bm-crpack-offer']);
      },
    },
    {
      id: 'pillar',
      lane: 'shared',
      title: 'Pillar Content Builder',
      desc: 'Build the one piece of content that powers everything else. Get a complete outline + 3 micro-content spin-offs.',
      fields: [
        { id: 'pmg-bm-pillar-topic',  label: 'Core topic', type: 'textarea', placeholder: 'The single idea this pillar piece explores.' },
        { id: 'pmg-bm-pillar-format', label: 'Format',     type: 'select',   options: PILLAR_FORMATS, placeholder: 'Select a format…' },
      ],
      build: function (v) {
        return 'Act as a content strategist. Outline a comprehensive ' + v['pmg-bm-pillar-format'] +
          ' about ' + v['pmg-bm-pillar-topic'] + '. Include: ' +
          '1) A strong hook/intro that respects the format\'s conventions. ' +
          '2) 3-5 main sections with key talking points. ' +
          '3) A clear conclusion/CTA. ' +
          '4) A list of 3 "micro-content" pieces that can be extracted from this pillar piece later (each on a different platform).';
      },
    },

    /* ===================== LAUNCH SOMETHING ===================== */
    {
      id: 'launch-announcement',
      lane: 'business',
      title: 'Launch Day Announcement Post',
      desc: 'The single post that announces your thing to the world on launch day — built for your primary platform with your voice, not generic launch-speak.',
      fields: [
        { id: 'pmg-bm-launch-what', label: 'What you\'re launching', type: 'textarea', placeholder: 'What it is, who it\'s for, why now.' },
      ],
      build: function (v) {
        var creator = loadCreator();
        var brand = loadBrand();
        var platform = creator.platform === 'Other' && creator.platformOther ? creator.platformOther : creator.platform;
        var tone = brand.tone || creator.vibe || '';
        var platLine = platform ? ' for ' + platform : '';
        return toneRole(tone) + ' Write a launch-day announcement post' + platLine + ' for: ' + v['pmg-bm-launch-what'] + '. ' +
          'Maximize scroll-stop on the first line. Cover: what it is, who it\'s for, what makes it different, and a soft CTA — in that order. ' +
          'Respect ' + (platform || 'social') + '\'s actual character/length conventions.';
      },
    },
    {
      id: 'email-seq',
      lane: 'business',
      title: 'Email Sequence Builder',
      desc: 'Build a ready-to-send email sequence for any business situation — pick the type and the length, get subject lines, pre-headers, and full body copy.',
      fields: [
        { id: 'pmg-bm-email-type',   label: 'Sequence Type',   type: 'select',   options: SEQUENCE_TYPES,   placeholder: 'Select a sequence type…' },
        { id: 'pmg-bm-email-length', label: 'Sequence Length', type: 'select',   options: SEQUENCE_LENGTHS, placeholder: 'Select length…' },
        { id: 'pmg-bm-email-offer',  label: 'Offer / context', type: 'textarea', placeholder: 'What is this sequence selling or doing?' },
      ],
      build: function (v) {
        var len = v['pmg-bm-email-length'] || '5 emails';
        return 'Act as an expert email marketer. Write a complete ' + len + ' ' + v['pmg-bm-email-type'] +
          ' email sequence for this offer: ' + v['pmg-bm-email-offer'] +
          '. For each email include: subject line, pre-header, and full body copy. ' +
          'Ensure a logical progression from email 1 to the final email, with one clear job per email.';
      },
    },
    {
      id: 'testimonial-request',
      lane: 'business',
      title: 'Testimonial Request',
      desc: 'A warm, low-pressure email or DM asking a happy customer for a usable testimonial — with specific question prompts so they actually have something to write about.',
      fields: [
        { id: 'pmg-bm-testreq-product', label: 'Product',                         type: 'text',     placeholder: 'What they bought / used' },
        { id: 'pmg-bm-testreq-context', label: 'What this customer accomplished', type: 'textarea', placeholder: 'What changed for them — specifics if you know them.' },
      ],
      build: function (v) {
        return 'Act as a customer marketing manager. Write a friendly, low-pressure email or DM requesting a testimonial from a happy customer of ' +
          v['pmg-bm-testreq-product'] + ' who: ' + v['pmg-bm-testreq-context'] + '. Include: ' +
          '1) A warm, personal opener referencing what they accomplished. ' +
          '2) 4 specific question prompts (so they have something to write about — not "give us a testimonial!"). ' +
          '3) Explicit permission language to use their words. ' +
          '4) An easy, no-guilt decline path. ' +
          '5) An estimated time commitment ("takes 5 min").';
      },
    },
    {
      id: 'launch-debrief',
      lane: 'business',
      title: 'Launch Debrief',
      desc: 'Post-launch analysis that turns raw results into a specific playbook for next time — what worked, what broke, and 5 specific things to change.',
      fields: [
        { id: 'pmg-bm-debrief-results', label: 'What happened', type: 'textarea', placeholder: 'Numbers, surprises, fails, wins — everything you can recall. Messy notes are fine.' },
      ],
      build: function (v) {
        return 'Act as a launch coach who has run 50+ launches. Given these results: ' + v['pmg-bm-debrief-results'] + ', produce: ' +
          '1) 3 things that worked + the root cause hypothesis for WHY (not just "marketing"). ' +
          '2) 3 things that broke + the root cause. ' +
          '3) 5 specific, testable changes for the next launch (with the metric each one will move). ' +
          '4) The single most important metric I should track next time that I didn\'t track this time. ' +
          '5) The one painful question I should be asking myself but probably am not.';
      },
    },
    {
      id: 'collab',
      lane: 'creator',
      title: 'Collab Pitch Builder',
      desc: 'Land brand deals and creator collabs with a professional pitch focused on what they get — built around the specific kind of partnership you want.',
      fields: [
        { id: 'pmg-bm-collab-stats',  label: 'Your stats / niche',      type: 'textarea', placeholder: 'e.g. 22k IG followers in home espresso, 4.1% ER' },
        { id: 'pmg-bm-collab-target', label: 'Target brand or creator', type: 'text',     placeholder: 'Who you\'re pitching' },
        { id: 'pmg-bm-collab-ask',    label: 'The ask',                 type: 'select',   options: COLLAB_ASKS, placeholder: 'What kind of partnership?' },
      ],
      build: function (v) {
        var ask = v['pmg-bm-collab-ask'] || 'Paid sponsorship';
        return 'Act as an influencer manager. Write a professional, concise outreach email/DM pitching a "' + ask + '" partnership. ' +
          'My niche/stats: ' + v['pmg-bm-collab-stats'] + '. Target: ' + v['pmg-bm-collab-target'] + '. ' +
          'The pitch must focus on the value THEY get from this specific type of partnership — not just what I want. Include: ' +
          '1) A personalized opener showing I know their work. ' +
          '2) The specific ask (one sentence). ' +
          '3) What they get in concrete terms. ' +
          '4) An easy yes/no close.';
      },
    },
  ];

  /* growth-mode-master-fixes-1: tone → role mapper.
     The old buildPackPrompt always opened with "senior social-media
     copywriter who has shipped 10,000+ posts" regardless of the user's
     saved Brand Voice. A user who picked "Witty & Sarcastic" or "Bold
     & Direct" got the same corporate-copywriter voice as a user who
     picked "Authoritative & Expert". This maps the saved tone to a
     role intro that actually colors the output. Returns just the
     "Act as …" sentence — caller appends the rest. */
  function toneRole(tone) {
    var map = {
      'Witty & Sarcastic':       'Act as a sharp-tongued copywriter known for biting wit and viral one-liners.',
      'Bold & Direct':           'Act as a no-bullshit copywriter who cuts every filler word and tells it straight.',
      'Warm & Friendly':         'Act as a warm, conversational copywriter who writes like a trusted friend.',
      'Authoritative & Expert':  'Act as a senior industry expert with 20+ years of credibility in this space.',
      'Playful & Casual':        'Act as a playful, slightly irreverent copywriter who never takes the topic too seriously.',
      'Empathetic & Caring':     'Act as a copywriter who leads with empathy and meets the reader where they are.',
      'Luxurious & Aspirational':'Act as a luxury brand copywriter — restrained, evocative, every word earning its place.',
      'Educational & Helpful':   'Act as a patient teacher-copywriter who explains the why before the what.',
    };
    return map[tone] || 'Act as a senior social-media copywriter who has shipped 10,000+ posts.';
  }

  /* Shared Multi-Platform Pack prompt — used by both lane tools.
     Now tone-aware: opening role flexes with the saved Brand Voice
     so the same offer in different voices reads genuinely different. */
  function buildPackPrompt(packKey, offer) {
    var pack = SOCIAL_PACKS[packKey];
    if (!pack) return '';
    var includes = pack.includes || [];
    var ruleLines = [];
    includes.forEach(function (p) {
      var r = PLATFORM_RULES[p];
      if (!r) return;
      ruleLines.push('**' + p + '** — ' + r.length + ' ' + r.hashtags + ' ' + r.notes);
    });
    var rulesBlock = ruleLines.length ? '\n\nPer-platform conventions:\n' + ruleLines.join('\n') : '';
    var brand = loadBrand();
    return toneRole(brand.tone) + ' ' +
      'Write a ' + pack.label + ' for: ' + offer + '. ' +
      'Cover ' + pack.platforms + '.' +
      rulesBlock +
      '\n\nOutput rules:\n' +
      '- One clearly labeled section per platform (use **Platform Name** as the header).\n' +
      '- Each section must feel native to its platform — no copy-paste between sections.\n' +
      '- Lead with the strongest hook; cut every filler word.';
  }

  /* ---------------------------------------------------------------- *
   * Render a single field
   * ---------------------------------------------------------------- */
  function renderField(f) {
    var labelHtml = '<label for="' + esc(f.id) + '">' + esc(f.label) + '</label>';
    var input;
    if (f.type === 'textarea') {
      input = '<textarea id="' + esc(f.id) + '" class="pmg-bm-textarea" placeholder="' + esc(f.placeholder || '') + '"></textarea>';
    } else if (f.type === 'select') {
      input = '<select id="' + esc(f.id) + '" class="pmg-bm-select">' + selectOpts(f.options || [], f.placeholder) + '</select>';
    } else if (f.type === 'pack') {
      var opts = Object.keys(SOCIAL_PACKS).map(function (k) {
        return { value: k, label: SOCIAL_PACKS[k].label };
      });
      input = '<select id="' + esc(f.id) + '" class="pmg-bm-select">' + selectOpts(opts, f.placeholder) + '</select>';
    } else {
      var ml = f.maxlength ? ' maxlength="' + Number(f.maxlength) + '"' : '';
      input = '<input id="' + esc(f.id) + '" class="pmg-bm-input" type="text" autocomplete="off"' + ml + ' placeholder="' + esc(f.placeholder || '') + '" />';
    }
    return '<div class="pmg-bm-field">' + labelHtml + input + '</div>';
  }

  function renderTool(tool) {
    /* growth-mode-wave3-1: per-tool Build button restored alongside the
       sticky "Build My Prompt". Rationale: the unified collector is great
       when the user has filled multiple sections, but the common case is
       "I just want this one tool's prompt." A small "Build just this"
       button per accordion saves the user from typing in unrelated tools
       to avoid them, AND avoids the 2-click confirm cap onBuildAll fires
       when many sections would otherwise concatenate. Wired via delegated
       click on the drawer body — see buildDrawer(). Tools without a
       build() (e.g. brand-voice, creator-profile) are skipped. */
    var openAttr = tool.open ? ' open' : '';
    var fieldsHtml = tool.fields.map(renderField).join('');
    var buildBtn = (typeof tool.build === 'function')
      ? '<button type="button" class="pmg-bm-tool-build" data-pmg-tool-build="' + esc(tool.id) + '">Build just this</button>'
      : '';
    return [
      '<details class="pmg-bm-section" data-pmg-tool="' + esc(tool.id) + '"' + openAttr + '>',
        '<summary>' + esc(tool.title) + '</summary>',
        '<div class="pmg-bm-sec-body">',
          '<p class="pmg-bm-desc">' + esc(tool.desc) + '</p>',
          fieldsHtml,
          buildBtn,
        '</div>',
      '</details>',
    ].join('');
  }

  /* ---------------------------------------------------------------- *
   * Goal Groups — the 5 collapsible sections that replace the old
   * Business/Creator lanes. Tool ID order within each group is the
   * order assembled into the unified prompt by Build My Prompt.
   *
   * NOTE: brand-voice and creator-profile are intentionally absent
   * here. Their fields now live exclusively in the shared "About
   * Your Brand" header at the top of the drawer (see buildBrandHeader),
   * which auto-saves to localStorage via wireBrandVoice() and
   * wireCreatorProfile(). Keeping their IDs in two places would
   * create duplicate DOM IDs and break sync.
   * ---------------------------------------------------------------- */
  /* growth-mode-master-fixes-1: rebalanced for the new tool roster.
     Know Your Audience promoted to top because it's the dependency
     upstream of everything else (you can't write good copy without
     knowing who you're writing to). Launch Something now holds
     launch-day assets (announcement, email seq, testimonials, debrief,
     pack drops) — the previous split of biz-multidrop / cr-multidrop
     across Create Content was arbitrary; both belong with launches. */
  var GOAL_GROUPS = [
    { title: 'Know Your Audience', tools: ['voc-miner', 'persona', 'audience-mine'] },
    { title: 'Build an Audience',  tools: ['hooks', 'bio', 'first-1000'] },
    { title: 'Sell Something',     tools: ['offer', 'funnel', 'objection', 'pricing'] },
    { title: 'Create Content',     tools: ['calendar', 'series', 'repurpose', 'titles', 'pillar'] },
    { title: 'Launch Something',   tools: ['launch-announcement', 'email-seq', 'testimonial-request', 'launch-debrief', 'biz-multidrop', 'cr-multidrop', 'collab'] }
  ];

  function renderGoalGroup(group) {
    var bodies = group.tools.map(function (id) {
      var tool = TOOLS.find(function (t) { return t.id === id; });
      return tool ? renderTool(tool) : '';
    }).join('');
    return [
      '<details class="pmg-bm-goal-group">',
        '<summary>' + esc(group.title) + '</summary>',
        '<div class="pmg-bm-group-body">',
          bodies,
        '</div>',
      '</details>'
    ].join('');
  }

  function buildBrandHeader() {
    /* growth-mode-wave3-1: split into two labeled subsections — Brand
       Voice (audience + tone) and Creator Profile (niche + platform +
       vibe) — so the user can tell them apart at a glance. Previously
       they were one undifferentiated stack. Same field IDs as before
       so wireBrandVoice() and wireCreatorProfile() still query them
       successfully; only the wrapping markup changed. */
    var brand = TOOLS.find(function (t) { return t.id === 'brand-voice'; });
    var creator = TOOLS.find(function (t) { return t.id === 'creator-profile'; });
    var brandFieldsHtml   = brand   ? brand.fields.map(renderField).join('')   : '';
    var creatorFieldsHtml = creator ? creator.fields.map(renderField).join('') : '';
    return [
      '<section class="pmg-bm-brand-header" aria-labelledby="pmg-bm-brand-header-title">',
        '<h3 id="pmg-bm-brand-header-title">About Your Brand</h3>',
        '<p class="pmg-bm-brand-header-sub">Fill in once. Applied to every prompt you build.</p>',
        '<div class="pmg-bm-brand-header-group">',
          '<p class="pmg-bm-brand-header-group-label">Brand voice</p>',
          '<div class="pmg-bm-brand-header-fields">',
            brandFieldsHtml,
            '<p class="pmg-bm-saved" id="pmg-bm-saved-brand-voice">✓ Saved to this device</p>',
          '</div>',
        '</div>',
        '<div class="pmg-bm-brand-header-group">',
          '<p class="pmg-bm-brand-header-group-label">Creator profile</p>',
          '<div class="pmg-bm-brand-header-fields">',
            creatorFieldsHtml,
            '<p class="pmg-bm-saved" id="pmg-bm-saved-creator-profile">✓ Saved to this device</p>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  /* ---------------------------------------------------------------- *
   * Drawer DOM (built once, lazily)
   * ---------------------------------------------------------------- */
  var built = false;
  var activeTab = 'business';

  function buildDrawer() {
    if (built) return;
    built = true;

    activeTab = loadActiveTab();

    var overlay = el('div', { id: 'pmg-bm-overlay', 'data-pmg-overlay-root': '' });
    overlay.addEventListener('click', closeDrawer);

    var drawer = el('aside', {
      id: 'pmg-bm-drawer',
      'data-pmg-overlay-root': '',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'pmg-bm-title',
    });

    drawer.innerHTML = [
      '<div class="pmg-bm-head">',
        '<h2 id="pmg-bm-title"><span aria-hidden="true">💼</span> Growth Mode</h2>',
        '<button type="button" class="pmg-bm-close" aria-label="Close Growth Mode">✕</button>',
      '</div>',
      '<div class="pmg-bm-body">',
        buildBrandHeader(),
        GOAL_GROUPS.map(renderGoalGroup).join(''),
      '</div>',
      /* anchor-not-float-1: footer lives OUTSIDE the scrollable body so it
         never overlaps accordion sections mid-list. The drawer is already
         display:flex / flex-direction:column so this div pins naturally to
         the drawer bottom regardless of how long the body content is. */
      '<div class="pmg-bm-footer">',
        '<p class="pmg-bm-error" id="pmg-bm-build-all-err"></p>',
        '<button type="button" class="pmg-bm-build-all">Build My Prompt</button>',
      '</div>',
    ].join('');

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    drawer.querySelector('.pmg-bm-close').addEventListener('click', closeDrawer);

    /* Wire persisted profiles (Brand Voice + Creator Profile) — fields
       now live in the shared "About Your Brand" header at the top. */
    wireBrandVoice(drawer);
    wireCreatorProfile(drawer);

    /* Single sticky Build My Prompt button — scans every tool in every
       goal group, collects non-empty fields, and assembles a unified
       prompt. See onBuildAll(). */
    var buildAllBtn = drawer.querySelector('.pmg-bm-build-all');
    if (buildAllBtn) buildAllBtn.addEventListener('click', onBuildAll);

    /* growth-mode-wave3-1: delegated per-tool Build button handler. One
       listener on the drawer covers every accordion's button — including
       any added later if the TOOLS array grows. */
    drawer.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      if (t.classList.contains('pmg-bm-tool-build')) {
        var id = t.getAttribute('data-pmg-tool-build');
        if (id) onBuild(id);
      }
    });

    /* Esc closes */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var ov = $('pmg-bm-overlay');
        if (ov && ov.classList.contains('is-open')) closeDrawer();
      }
    });
  }

  function setActiveTab(name, skipSave) {
    /* growth-mode-goal-groups-1: the two-lane switcher has been removed.
       This function is preserved as a no-op for back-compat with any
       external caller that may still reference window.pmgBusinessMode.setTab. */
    activeTab = (name === 'creator') ? 'creator' : 'business';
    if (!skipSave) saveActiveTab(activeTab);
  }

  /* ---------------------------------------------------------------- *
   * Persisted profile wiring
   * ---------------------------------------------------------------- */
  function wireBrandVoice(drawer) {
    var audIn  = $('pmg-bm-audience');
    var toneIn = $('pmg-bm-tone');
    var savedEl = $('pmg-bm-saved-brand-voice');
    if (!audIn || !toneIn) return;

    var brand = loadBrand();
    audIn.value  = brand.audience;
    toneIn.value = brand.tone;

    var savedTimer = null;
    function flash() {
      if (!savedEl) return;
      savedEl.classList.add('is-shown');
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { savedEl.classList.remove('is-shown'); }, 1400);
    }
    var saveDebounce = null;
    function persistDebounced() {
      if (saveDebounce) clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function () {
        saveBrand(audIn.value.trim(), toneIn.value);
        flash();
      }, 250);
    }
    audIn.addEventListener('input', persistDebounced);
    toneIn.addEventListener('change', function () {
      saveBrand(audIn.value.trim(), toneIn.value);
      flash();
    });
  }

  function wireCreatorProfile(drawer) {
    /* vibe-tone-consolidation-1: vibeIn was removed from the Creator
       Profile card. We keep the variable as null so persistAll can
       pass an empty string into saveCreator without crashing; vibe is
       now read from Brand Tone via the loadCreator() backfill. */
    var nicheIn      = $('pmg-bm-cr-niche');
    var platIn       = $('pmg-bm-cr-platform');
    var platOtherIn  = $('pmg-bm-cr-platform-other');
    var vibeIn       = null;
    var savedEl      = $('pmg-bm-saved-creator-profile');
    if (!nicheIn || !platIn) return;

    var creator = loadCreator();
    nicheIn.value = creator.niche;
    platIn.value  = creator.platform;
    if (platOtherIn) platOtherIn.value = creator.platformOther;

    /* Show/hide the "Which platform?" free-text input — only relevant
       when the user picked "Other" from the platform dropdown. */
    var platOtherWrap = platOtherIn ? platOtherIn.closest('.pmg-bm-field') : null;
    function syncOtherVisibility() {
      if (!platOtherWrap) return;
      platOtherWrap.style.display = (platIn.value === 'Other') ? '' : 'none';
    }
    syncOtherVisibility();

    var savedTimer = null;
    function flash() {
      if (!savedEl) return;
      savedEl.classList.add('is-shown');
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(function () { savedEl.classList.remove('is-shown'); }, 1400);
    }
    function persistAll() {
      /* vibe-tone-consolidation-1: vibe arg is always '' from this
         card now. loadCreator() backfills it from Brand Tone on read,
         so passing empty here is harmless and preserves the storage
         shape for any older clients reading the same key. */
      saveCreator(
        nicheIn.value.trim(),
        platIn.value,
        '',
        platOtherIn ? platOtherIn.value.trim() : ''
      );
      flash();
    }
    var saveDebounce = null;
    function persistDebounced() {
      if (saveDebounce) clearTimeout(saveDebounce);
      saveDebounce = setTimeout(persistAll, 250);
    }
    nicheIn.addEventListener('input', persistDebounced);
    platIn.addEventListener('change', function () {
      syncOtherVisibility();
      persistAll();
    });
    if (platOtherIn) platOtherIn.addEventListener('input', persistDebounced);
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
   * Build handler — validates required fields, assembles prompt,
   * appends the right persona block, dispatches to text panel.
   * ---------------------------------------------------------------- */
  /* Legacy single-tool builder, kept for back-compat. Not wired to any
     UI surface after growth-mode-goal-groups-1 (per-tool Build buttons
     were removed). External callers can still invoke via the public API
     if they pass a valid tool id. */
  function onBuild(toolId) {
    var tool = TOOLS.find(function (t) { return t.id === toolId; });
    if (!tool || !tool.build) return;
    var values = {};
    for (var i = 0; i < tool.fields.length; i++) {
      var f = tool.fields[i];
      var node = $(f.id);
      values[f.id] = node ? (node.value || '').trim() : '';
    }
    var prompt = tool.build(values);
    if (!prompt) return;
    prompt = appendPersona(prompt, tool.lane);
    dispatchToText(prompt, toolId);
  }

  /* Multi-tool collector — the single "Build My Prompt" sticky button.
     Iterates GOAL_GROUPS in spec order → tools in spec order → fields
     in tool order. Any tool with at least one non-empty field is
     included; its build() is called with the full values map (empty
     strings for unfilled fields, per design). Per-tool outputs are
     concatenated under `## Tool Title` headers. The shared brand /
     creator persona blocks are appended once at the end via
     appendPersona(prompt, null). */
  function onBuildAll() {
    var errEl = $('pmg-bm-build-all-err');
    if (errEl) errEl.textContent = '';

    var sections = [];
    GOAL_GROUPS.forEach(function (group) {
      group.tools.forEach(function (toolId) {
        var tool = TOOLS.find(function (t) { return t.id === toolId; });
        if (!tool || !tool.build) return;
        var values = {};
        var anyFilled = false;
        tool.fields.forEach(function (f) {
          var node = $(f.id);
          var v = node ? (node.value || '').trim() : '';
          values[f.id] = v;
          if (v) anyFilled = true;
        });
        if (!anyFilled) return;
        var out = tool.build(values);
        if (!out) return;
        sections.push('## ' + tool.title + '\n' + out);
      });
    });

    if (!sections.length) {
      if (errEl) errEl.textContent = 'Fill in at least one field above to build your prompt.';
      return;
    }

    /* growth-mode-wave3-1: 2-click confirm cap. When the user is about to
       concatenate 4+ tools into one prompt the output gets long and
       expensive. First click sets __pmgBmConfirmCap + shows an explainer;
       second click within 4s proceeds. Avoids accidental mega-prompts
       when someone forgot which sections they filled. */
    if (sections.length >= 4 && !window.__pmgBmConfirmCap) {
      window.__pmgBmConfirmCap = true;
      setTimeout(function () { window.__pmgBmConfirmCap = false; }, 4000);
      if (errEl) errEl.textContent = 'About to build ' + sections.length + ' sections into one long prompt. Click again to confirm — or use “Build just this” on the section you actually want.';
      return;
    }
    window.__pmgBmConfirmCap = false;

    var prompt = sections.join('\n\n');
    prompt = appendPersona(prompt, null);
    dispatchToText(prompt, '__all__');
  }

  function dispatchToText(goalText, toolId) {
    /* gm-source-flag-1: Mark this generation as Growth-Mode-sourced so
       pmg-growth-actions.js mounts the Copy All / Export PDF row above
       the eventual #resultBox content.
       growth-mode-wave3-1: also stash the originating tool id so the
       Brand Audience snippet observer (wireBrandAudienceObserver) only
       fires for persona / voc-miner outputs and not for, say, an offer
       or calendar build. '__all__' means Build All concatenated multiple
       tools — observer treats that as "any of the brand tools could be
       present" and still scans for the snippet. */
    try {
      window.__pmgLastSource = 'growth';
      window.__pmgLastSourceAt = Date.now();
      window.__pmgLastTool = (typeof toolId === 'string' && toolId) ? toolId : null;
    } catch (_) {}

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
       submit event in app.html. requestSubmit fires the 'submit' event
       AND triggers HTML5 validation. */
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
    setTab: setActiveTab,
  };
})();
