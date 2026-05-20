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
    var empty = { niche: '', platform: '', platformOther: '', vibe: '' };
    try {
      var raw = localStorage.getItem(LS_KEY_CREATOR);
      if (!raw) return empty;
      var v = JSON.parse(raw);
      return {
        niche:         typeof v.niche === 'string' ? v.niche : '',
        platform:      typeof v.platform === 'string' && CREATOR_PLATFORMS.indexOf(v.platform) >= 0 ? v.platform : '',
        platformOther: typeof v.platformOther === 'string' ? v.platformOther : '',
        vibe:          typeof v.vibe === 'string' && BRAND_TONES.indexOf(v.vibe) >= 0 ? v.vibe : '',
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
    if (creator.vibe) {
      var play = TONE_PLAYBOOK[creator.vibe] || '';
      lines.push('Creator vibe: ' + creator.vibe + (play ? ' — ' + play : '.'));
    }
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
    /* ===================== BUSINESS LANE ===================== */
    {
      id: 'brand-voice',
      lane: 'business',
      persisted: true,
      title: '1. Brand Voice',
      titleSuffix: '(saved automatically)',
      desc: 'Set your target audience and brand tone once. Every prompt you build will automatically match your voice.',
      open: true,
      fields: [
        { id: 'pmg-bm-audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. busy moms, B2B SaaS founders', maxlength: 200 },
        { id: 'pmg-bm-tone',     label: 'Brand Tone',      type: 'select', options: BRAND_TONES, placeholder: 'Select a tone…' },
      ],
    },
    {
      id: 'persona',
      lane: 'business',
      title: '2. Customer Persona Builder',
      desc: 'Describe your product and get a detailed profile of your ideal buyer — their pain points, desires, and where to find them.',
      fields: [
        { id: 'pmg-bm-persona-product', label: 'Product / Service description', type: 'textarea', placeholder: 'What you sell, in one sentence or two.' },
      ],
      build: function (v) {
        return 'Act as a senior market researcher. Build a detailed buyer persona for this product/service: ' + v['pmg-bm-persona-product'] + '. ' +
          'Include: Demographics, core pain points, primary desires, buying triggers, and where they hang out online.';
      },
    },
    {
      id: 'offer',
      lane: 'business',
      title: '3. Offer Clarity Tool',
      desc: 'Turn a rough idea into a sharp value proposition, tagline, and 3 key benefits — the foundation of all your marketing copy.',
      fields: [
        { id: 'pmg-bm-offer-raw', label: 'Raw idea / offer description', type: 'textarea', placeholder: 'Your offer in your own messy words — we sharpen it.' },
      ],
      build: function (v) {
        return 'Act as a direct-response copywriter. Take this raw offer idea: ' + v['pmg-bm-offer-raw'] + ' and refine it into: ' +
          '1) A one-sentence value proposition. ' +
          '2) A punchy tagline. ' +
          '3) Three bullet points highlighting the biggest benefits (not features).';
      },
    },
    {
      id: 'funnel',
      lane: 'business',
      title: '4. Sales Funnel Builder',
      desc: 'Map out a complete 5-step funnel from first impression to closed sale — awareness, lead magnet, nurture, sales page, and close.',
      fields: [
        { id: 'pmg-bm-funnel-product',  label: 'Product',        type: 'text', placeholder: 'What you\'re selling' },
        { id: 'pmg-bm-funnel-price',    label: 'Price point',    type: 'text', placeholder: 'e.g. $97, $2,000/yr' },
        { id: 'pmg-bm-funnel-audience', label: 'Target audience', type: 'text', placeholder: 'Who you\'re selling to' },
      ],
      build: function (v) {
        return 'Act as a conversion rate optimization expert. Map out a 5-step sales funnel for this product: ' + v['pmg-bm-funnel-product'] +
          ' priced at ' + v['pmg-bm-funnel-price'] + ' targeting ' + v['pmg-bm-funnel-audience'] + '. Include: ' +
          '1) Awareness hook/ad angle. ' +
          '2) Lead magnet idea. ' +
          '3) 3-part email nurture sequence outline. ' +
          '4) Sales page core argument. ' +
          '5) Urgency/Close CTA.';
      },
    },
    {
      id: 'email-seq',
      lane: 'business',
      title: '5. Email Sequence Builder',
      desc: 'Build a ready-to-send email sequence for any stage of your business — welcome new subscribers, launch a product, or win back lost customers.',
      fields: [
        { id: 'pmg-bm-email-type',  label: 'Sequence Type', type: 'select', options: SEQUENCE_TYPES, placeholder: 'Select a sequence type…' },
        { id: 'pmg-bm-email-offer', label: 'Offer details', type: 'textarea', placeholder: 'What is this sequence selling or doing?' },
      ],
      build: function (v) {
        return 'Act as an expert email marketer. Write a complete ' + v['pmg-bm-email-type'] + ' email sequence for this offer: ' +
          v['pmg-bm-email-offer'] + '. Include subject lines, preview text, and full body copy for each email. ' +
          'Ensure a logical progression from email 1 to the final pitch.';
      },
    },
    {
      id: 'objection',
      lane: 'business',
      title: '6. Objection Crusher',
      desc: 'Turn your most common sales objections into confident, non-pushy rebuttals you can use on calls, in DMs, or on your sales page.',
      fields: [
        { id: 'pmg-bm-obj-product',   label: 'Product',         type: 'text', placeholder: 'What you\'re selling' },
        { id: 'pmg-bm-obj-objection', label: 'Main objection',  type: 'textarea', placeholder: 'e.g. "It\'s too expensive", "I don\'t have time"' },
      ],
      build: function (v) {
        return 'Act as a master sales closer. My product is ' + v['pmg-bm-obj-product'] + ' and the main objection I hear is ' +
          v['pmg-bm-obj-objection'] + '. Write a 3-part rebuttal script I can use on sales calls or in DMs to overcome this objection ' +
          'without sounding pushy. Use the "Feel, Felt, Found" framework.';
      },
    },
    {
      id: 'pricing',
      lane: 'business',
      title: '7. Pricing & Positioning Advisor',
      desc: 'Not sure if you\'re charging enough? Describe your offer and price — get specific, actionable advice on what it would take to confidently charge more.',
      fields: [
        { id: 'pmg-bm-price-current',  label: 'Current price',        type: 'text', placeholder: 'e.g. $497' },
        { id: 'pmg-bm-price-product',  label: 'Product description',  type: 'textarea', placeholder: 'What it is, who it\'s for, what they get.' },
      ],
      build: function (v) {
        return 'Act as a pricing strategist. My product is ' + v['pmg-bm-price-product'] + ' and currently costs ' + v['pmg-bm-price-current'] + '. ' +
          'If I had to double my price today, what 3 specific things would I need to add, improve, or guarantee to make the new price ' +
          'feel like a bargain?';
      },
    },
    {
      id: 'biz-multidrop',
      lane: 'business',
      title: '8. Multi-Platform Launch Drop',
      desc: 'Generate a coordinated set of platform-native posts for a launch, product, or campaign — all in one shot.',
      fields: [
        { id: 'pmg-bm-bizpack-type',  label: 'Pack type',           type: 'pack', placeholder: 'Select a pack…' },
        { id: 'pmg-bm-bizpack-offer', label: 'Your offer / idea',   type: 'textarea', placeholder: 'What are you promoting or talking about?' },
      ],
      build: function (v) {
        return buildPackPrompt(v['pmg-bm-bizpack-type'], v['pmg-bm-bizpack-offer']);
      },
    },

    /* ===================== CREATOR LANE ===================== */
    {
      id: 'creator-profile',
      lane: 'creator',
      persisted: true,
      title: '1. Creator Profile',
      titleSuffix: '(saved automatically)',
      desc: 'Set your niche, platform, and vibe once. Every prompt you build will be tuned to your content style automatically.',
      open: true,
      fields: [
        { id: 'pmg-bm-cr-niche',          label: 'Niche',                  type: 'text',   placeholder: 'e.g. home espresso, indie game dev' },
        { id: 'pmg-bm-cr-platform',       label: 'Platform Focus',         type: 'select', options: CREATOR_PLATFORMS, placeholder: 'Select a platform…' },
        { id: 'pmg-bm-cr-platform-other', label: 'Which platform?',        type: 'text',   placeholder: 'e.g. Telegram, Geneva, Lemon8' },
        { id: 'pmg-bm-cr-vibe',           label: 'Creator Vibe',           type: 'select', options: BRAND_TONES,       placeholder: 'Select a vibe…' },
      ],
    },
    {
      id: 'hooks',
      lane: 'creator',
      title: '2. Hook Generator',
      desc: 'Stop the scroll. Get 5 completely different hook styles for any topic — curiosity, controversy, story, stat, and bold promise — so you can test what hits.',
      fields: [
        { id: 'pmg-bm-hook-topic', label: 'Topic / Idea', type: 'textarea', placeholder: 'What\'s the post about?' },
      ],
      build: function (v) {
        return 'Act as a viral content strategist. Write 5 distinct, scroll-stopping hooks for this topic: ' + v['pmg-bm-hook-topic'] + '. ' +
          'Use these 5 frameworks: ' +
          '1) Curiosity gap. ' +
          '2) Contrarian/Controversial. ' +
          '3) Personal story/Failure. ' +
          '4) Shocking statistic. ' +
          '5) Bold promise. ' +
          'Keep them under 15 words each.';
      },
    },
    {
      id: 'calendar',
      lane: 'creator',
      title: '3. Content Calendar Builder',
      desc: 'Never stare at a blank screen again. Get a 2-week content calendar with formats, topics, and goals — built for your niche and posting schedule.',
      fields: [
        { id: 'pmg-bm-cal-niche', label: 'Niche',              type: 'text',   placeholder: 'e.g. fitness for new moms' },
        { id: 'pmg-bm-cal-freq',  label: 'Posting Frequency',  type: 'select', options: POSTING_FREQUENCIES, placeholder: 'Select frequency…' },
      ],
      build: function (v) {
        return 'Act as a social media manager. Build a 2-week content calendar for a creator in the ' + v['pmg-bm-cal-niche'] + ' niche, ' +
          'posting ' + v['pmg-bm-cal-freq'] + '. For each post, provide: The format (e.g., Reel, Carousel, Thread), the core topic, ' +
          'and the specific goal (Awareness, Engagement, Conversion).';
      },
    },
    {
      id: 'series',
      lane: 'creator',
      title: '4. Series Builder',
      desc: 'Turn one idea into a binge-worthy series. Get 5 episode titles, angles, and hooks that build on each other and keep your audience coming back.',
      fields: [
        { id: 'pmg-bm-series-concept', label: 'Core concept for the series', type: 'textarea', placeholder: 'The one big idea the series unpacks.' },
      ],
      build: function (v) {
        return 'Act as a YouTube/Podcast producer. Take this core concept: ' + v['pmg-bm-series-concept'] + ' and map it out into a 5-part ' +
          'episodic series. For each episode, provide a click-worthy title, the main angle/hook, and how it connects to the next episode ' +
          'to keep viewers binging.';
      },
    },
    {
      id: 'repurpose',
      lane: 'creator',
      title: '5. Repurpose Engine',
      desc: 'One piece of content, four platforms. Paste anything you\'ve already made and get a ready-to-post X thread, TikTok script, LinkedIn post, and newsletter intro.',
      fields: [
        { id: 'pmg-bm-rep-content', label: 'Original content', type: 'textarea', placeholder: 'Paste text or describe the piece in detail.' },
      ],
      build: function (v) {
        return 'Act as a content repurposing expert. Take this original content: ' + v['pmg-bm-rep-content'] + ' and extract the core insights. ' +
          'Then, write: ' +
          '1) A 5-tweet X thread. ' +
          '2) A script for a 60-second TikTok/Reel. ' +
          '3) A LinkedIn text post. ' +
          '4) A short email newsletter intro linking to the original.';
      },
    },
    {
      id: 'titles',
      lane: 'creator',
      title: '6. Viral Title & Thumbnail Concept Generator',
      desc: 'Your title and thumbnail are 90% of your views. Get 5 click-worthy title variants and a matching thumbnail concept for each — built for YouTube and Shorts.',
      fields: [
        { id: 'pmg-bm-titles-topic', label: 'Video topic', type: 'textarea', placeholder: 'What\'s the video about?' },
      ],
      build: function (v) {
        return 'Act as a YouTube growth expert. For a video about ' + v['pmg-bm-titles-topic'] + ', generate 5 highly clickable title variants ' +
          '(under 60 characters). For each title, describe a matching thumbnail concept that creates visual curiosity and complements the title ' +
          'without repeating it.';
      },
    },
    {
      id: 'cr-multidrop',
      lane: 'creator',
      title: '7. Multi-Platform Drop',
      desc: 'Generate a coordinated set of platform-native posts for a launch, product, or campaign — all in one shot.',
      fields: [
        { id: 'pmg-bm-crpack-type',  label: 'Pack type',         type: 'pack', placeholder: 'Select a pack…' },
        { id: 'pmg-bm-crpack-offer', label: 'Your offer / idea', type: 'textarea', placeholder: 'What are you promoting or talking about?' },
      ],
      build: function (v) {
        return buildPackPrompt(v['pmg-bm-crpack-type'], v['pmg-bm-crpack-offer']);
      },
    },
    {
      id: 'bio',
      lane: 'creator',
      title: '8. Creator Bio & Profile Optimizer',
      desc: 'Your bio is your first impression. Get optimized bios for TikTok, Instagram, X, and LinkedIn — each written for that platform\'s character limits and culture.',
      fields: [
        { id: 'pmg-bm-bio-niche', label: 'Niche',             type: 'text', placeholder: 'e.g. mobile photography for travel' },
        { id: 'pmg-bm-bio-value', label: 'Value proposition', type: 'text', placeholder: 'What makes you different?' },
      ],
      build: function (v) {
        return 'Act as a personal branding expert. My niche is ' + v['pmg-bm-bio-niche'] + ' and my value prop is ' + v['pmg-bm-bio-value'] + '. ' +
          'Write optimized profile bios for: ' +
          '1) X/Twitter (160 chars). ' +
          '2) Instagram (150 chars, use line breaks). ' +
          '3) TikTok (80 chars). ' +
          '4) LinkedIn headline (220 chars).';
      },
    },
    {
      id: 'collab',
      lane: 'creator',
      title: '9. Collab Pitch Builder',
      desc: 'Land brand deals and creator collabs with a professional pitch that focuses on what they get — not just what you want. Works for DMs and emails.',
      fields: [
        { id: 'pmg-bm-collab-stats',  label: 'Your stats / niche',         type: 'textarea', placeholder: 'e.g. 22k IG followers in home espresso, 4.1% ER' },
        { id: 'pmg-bm-collab-target', label: 'Target brand or creator',    type: 'text',     placeholder: 'Who you\'re pitching' },
      ],
      build: function (v) {
        return 'Act as an influencer manager. Write a professional, concise outreach email/DM pitching a collaboration. ' +
          'My niche/stats: ' + v['pmg-bm-collab-stats'] + '. Target: ' + v['pmg-bm-collab-target'] + '. ' +
          'The pitch must focus on the value they get from collaborating with me, not just what I want.';
      },
    },

    /* ===================== SHARED (BOTH TABS) ===================== */
    {
      id: 'pillar',
      lane: 'shared',
      title: 'Pillar Content Builder',
      desc: 'Build the one piece of content that powers everything else. Get a complete outline for a long-form blog post, YouTube video, or podcast episode — with built-in ideas for 3 micro-content pieces you can spin off from it.',
      fields: [
        { id: 'pmg-bm-pillar-topic',  label: 'Core topic', type: 'textarea', placeholder: 'The single idea this pillar piece explores.' },
        { id: 'pmg-bm-pillar-format', label: 'Format',     type: 'select', options: PILLAR_FORMATS, placeholder: 'Select a format…' },
      ],
      build: function (v) {
        return 'Act as a content strategist. Outline a comprehensive ' + v['pmg-bm-pillar-format'] + ' piece about ' + v['pmg-bm-pillar-topic'] + '. ' +
          'Include: ' +
          '1) A strong hook/intro. ' +
          '2) 3-5 main sections with key talking points. ' +
          '3) A clear conclusion/CTA. ' +
          '4) A list of 3 "micro-content" pieces that can be extracted from this pillar piece later.';
      },
    },
  ];

  /* Shared Multi-Platform Pack prompt — used by both lane tools. */
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
    return 'Act as a senior social-media copywriter who has shipped 10,000+ posts. ' +
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
    /* growth-mode-goal-groups-1: per-tool Build buttons are gone. The
       single sticky "Build My Prompt" button at the bottom of the drawer
       now scans every tool's fields across every group and assembles a
       unified prompt. Each tool's own build() is still called by the
       collector — see onBuildAll(). */
    var openAttr = tool.open ? ' open' : '';
    var fieldsHtml = tool.fields.map(renderField).join('');
    return [
      '<details class="pmg-bm-section" data-pmg-tool="' + esc(tool.id) + '"' + openAttr + '>',
        '<summary>' + esc(tool.title) + '</summary>',
        '<div class="pmg-bm-sec-body">',
          '<p class="pmg-bm-desc">' + esc(tool.desc) + '</p>',
          fieldsHtml,
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
  var GOAL_GROUPS = [
    { title: 'Build an Audience',  tools: ['hooks', 'bio'] },
    { title: 'Sell Something',     tools: ['funnel', 'objection', 'offer', 'pricing'] },
    { title: 'Create Content',     tools: ['calendar', 'series', 'repurpose', 'titles', 'cr-multidrop', 'biz-multidrop', 'pillar'] },
    { title: 'Launch Something',   tools: ['email-seq', 'collab'] },
    { title: 'Know Your Audience', tools: ['persona'] }
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
    /* Compact card at the top of the drawer holding the 2 Brand Voice
       fields + 3 Creator Profile fields. Same IDs the existing
       wireBrandVoice() and wireCreatorProfile() functions query for. */
    var brand = TOOLS.find(function (t) { return t.id === 'brand-voice'; });
    var creator = TOOLS.find(function (t) { return t.id === 'creator-profile'; });
    var fieldsHtml = '';
    if (brand)   fieldsHtml += brand.fields.map(renderField).join('');
    if (creator) fieldsHtml += creator.fields.map(renderField).join('');
    return [
      '<section class="pmg-bm-brand-header" aria-labelledby="pmg-bm-brand-header-title">',
        '<h3 id="pmg-bm-brand-header-title">About Your Brand</h3>',
        '<p class="pmg-bm-brand-header-sub">Fill in once. Applied to every prompt you build.</p>',
        '<div class="pmg-bm-brand-header-fields">',
          fieldsHtml,
          '<p class="pmg-bm-saved" id="pmg-bm-saved-brand-voice">✓ Saved to this device</p>',
          '<p class="pmg-bm-saved" id="pmg-bm-saved-creator-profile">✓ Saved to this device</p>',
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
    var nicheIn      = $('pmg-bm-cr-niche');
    var platIn       = $('pmg-bm-cr-platform');
    var platOtherIn  = $('pmg-bm-cr-platform-other');
    var vibeIn       = $('pmg-bm-cr-vibe');
    var savedEl      = $('pmg-bm-saved-creator-profile');
    if (!nicheIn || !platIn || !vibeIn) return;

    var creator = loadCreator();
    nicheIn.value = creator.niche;
    platIn.value  = creator.platform;
    vibeIn.value  = creator.vibe;
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
      saveCreator(
        nicheIn.value.trim(),
        platIn.value,
        vibeIn.value,
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
    vibeIn.addEventListener('change', persistAll);
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
    dispatchToText(prompt);
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

    var prompt = sections.join('\n\n');
    prompt = appendPersona(prompt, null);
    dispatchToText(prompt);
  }

  function dispatchToText(goalText) {
    /* gm-source-flag-1: Mark this generation as Growth-Mode-sourced so
       pmg-growth-actions.js mounts the Copy All / Export PDF row above
       the eventual #resultBox content. */
    try {
      window.__pmgLastSource = 'growth';
      window.__pmgLastSourceAt = Date.now();
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
