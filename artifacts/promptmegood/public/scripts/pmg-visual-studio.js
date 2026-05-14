/* ============================================================================
   PromptMeGood — Visual Studio (vs-15)
   Inline panel mode. NO MODAL.

   Exposes mountVisualStudioPanels({photoLeft, photoRight, videoLeft, videoRight})
   which builds the Image and Video workspaces directly into the v3 panels.

   - Image panel left: Reverse Engine (file upload), Photography Suite host,
     image goal textarea, Build Image Prompt, refined output, Generate.
   - Image panel right: media surface, Save / 🧬 DNA Card / Share / Regenerate.
   - Video panel left: video goal textarea, Sora tuning grid, Build Video Prompt,
     refined output, Generate.
   - Video panel right: video surface, Save / Regenerate.

   `openVisualStudio({mode})` is kept as a back-compat shim that just switches
   the v3 active panel via window.pmgChassisV3.setActivePanel(...).
   ============================================================================ */
(function () {
  'use strict';

  // vs-18 (from Director Mode reference): expanded Sora pill suite
  // to match pro tools' director controls. Added shot sizes
  // (Extreme close-up / Extreme wide), camera movements (Tilt /
  // Tracking / Orbit), Time-of-Day + Light-Direction moods (Midday /
  // Twilight / Front lit / Side lit / Back lit / Top lit), film-stock
  // styles (VHS / 16mm Film / 35mm Film / Digital), and two new
  // groups: focus (depth) and easing (movement intensity).
  var SORA_OPTIONS = {
    shot:       ['Wide', 'Medium', 'Close-up', 'Extreme close-up', 'Extreme wide', 'Aerial', 'POV', 'Tracking'],
    angle:      ['Eye Level', 'Low Angle', 'High Angle', 'Hero Angle', 'Over-the-Shoulder', 'Bird\'s-Eye', 'Worm\'s-Eye', 'Dutch Angle', 'Top-Down'],
    movement:   ['Static', 'Slow push in', 'Pan left', 'Pan right', 'Tilt', 'Handheld', 'Dolly', 'Tracking', 'Orbit'],
    mood:       ['Golden hour', 'Midday', 'Twilight', 'Night', 'Overcast', 'Studio', 'Neon', 'Front lit', 'Side lit', 'Back lit', 'Top lit'],
    focus:      ['Deep focus', 'Cinematic Bokeh', 'Selective focus'],
    easing:     ['Subtle', 'Standard', 'Intense', 'Linear', 'Natural'],
    duration:   ['5', '10'],
    resolution: ['480p', '720p', '1080p'],
    style:      ['Cinematic', 'Realistic', 'Animated', 'Documentary', 'Dreamy', 'VHS', '16mm Film', '35mm Film', 'Digital'],
  };

  // ---------- Pro Layer config (Quick Starts + Boosts + Modes) ----------
  // Each boost/mode has a `directive` string appended to the refined prompt
  // when the toggle is active. Presets pre-activate a bundle of boosts/modes
  // (and for video, also pre-press a set of Sora pills).
  var PHOTO_BOOSTS = [
    { id: 'sharp-focus',    label: 'Sharper Subject Focus', desc: 'Tack-sharp eyes & details', directive: 'razor-sharp subject focus, crisp eyes, tack-sharp details' },
    { id: 'color-grade',    label: 'Richer Color Grade',    desc: 'Cinematic contrast & balance', directive: 'rich cinematic color grade, deep contrast, balanced highlights and shadows' },
    { id: 'shallow-depth',  label: 'Shallow Depth (bokeh)', desc: 'f/1.8 creamy background',     directive: 'shallow depth of field, creamy bokeh background, f/1.8 aesthetic, subject separation' },
    { id: 'atmospheric',    label: 'Atmospheric',           desc: 'Haze, god rays, mood',        directive: 'atmospheric haze, soft god rays, volumetric light, dreamy ambience' },
    { id: 'film-grain',     label: 'Film Grain & Texture',  desc: 'Analog 35mm feel',            directive: 'subtle 35mm film grain, organic texture, analog Kodak Portra feel' },
    { id: 'negative-space', label: 'Negative Space',        desc: 'Editorial breathing room',    directive: 'generous negative space, minimalist composition, breathing room around subject' },
  ];
  var PHOTO_MODES = [
    { id: 'photoreal',         label: 'Photoreal Mode',       desc: 'Kills illustrative drift — pure photo.',         directive: 'hyperrealistic photographic style, no illustration, no painterly or CGI effects, real-camera capture' },
    { id: 'magazine-polish',   label: 'Magazine Polish Mode', desc: 'Editorial finish — cover-worthy retouching.',    directive: 'editorial magazine quality, professional retouching, cover-worthy finish, Vogue-grade polish' },
  ];
  var PHOTO_PRESETS = [
    { id: 'editorial-hero',  emoji: '📸', label: 'Editorial Hero',    desc: 'Magazine cover energy.',     boosts: ['sharp-focus', 'negative-space'], modes: ['magazine-polish'] },
    { id: 'hero-product',    emoji: '🛍️', label: 'Hero Product Shot', desc: 'Crisp commercial lighting.', boosts: ['sharp-focus', 'color-grade'],    modes: ['photoreal'] },
    { id: 'cinematic-portrait', emoji: '🎞️', label: 'Cinematic Portrait', desc: 'Film still vibes.',     boosts: ['shallow-depth', 'atmospheric', 'film-grain'], modes: [] },
    { id: 'scroll-stopper',  emoji: '📱', label: 'Scroll-Stopper',    desc: 'Bold, social-first punch.',  boosts: ['color-grade', 'sharp-focus'],    modes: ['magazine-polish'] },
  ];

  var VIDEO_BOOSTS = [
    { id: 'opening-beat',     label: 'Stronger Opening Beat',  desc: 'Hook in the first 0.5s.',         directive: 'open with a strong visual hook in the first 0.5 seconds, immediate attention grab' },
    { id: 'smoother-motion',  label: 'Smoother Camera Motion', desc: 'Gimbal-stabilized feel.',         directive: 'ultra-smooth gimbal-stabilized camera motion, no jitter, fluid movement' },
    { id: 'color-grade',      label: 'Richer Color Grade',     desc: 'Teal & orange cinema look.',      directive: 'rich cinematic color grade, teal and orange contrast, professional color science' },
    { id: 'atmospheric',      label: 'Atmospheric FX',         desc: 'Dust, haze, volumetric light.',   directive: 'atmospheric particles, dust motes, light haze, volumetric lighting beams' },
    { id: 'cleaner-framing',  label: 'Cleaner Subject Framing',desc: 'Centered, rule-of-thirds.',       directive: 'centered subject framing, balanced composition, rule-of-thirds, clean negative space' },
    { id: 'time-of-day',      label: 'Time-of-Day Drama',      desc: 'Magic hour glow.',                directive: 'magic hour lighting, golden glow, long shadows, dramatic time-of-day' },
  ];
  var VIDEO_MODES = [
    { id: 'photoreal', label: 'Photoreal Mode', desc: 'Kills animation drift — pure footage.',           directive: 'hyperrealistic photographic quality, no animation, real camera capture' },
    { id: 'filmic',    label: 'Filmic Mode',    desc: 'Anamorphic lens, grain, lens flares.',            directive: 'anamorphic lens 2.39:1 aspect, subtle film grain, soft anamorphic lens flares, cinematic feel' },
  ];
  var VIDEO_PRESETS = [
    { id: 'cinematic-trailer', emoji: '🎬', label: 'Cinematic Trailer', desc: 'Slow push, golden hour, big mood.',
      pills: { shot: 'Wide', movement: 'Slow push in', mood: 'Golden hour', style: 'Cinematic' },
      boosts: ['opening-beat', 'color-grade', 'time-of-day'], modes: ['filmic'] },
    { id: 'tiktok-hook',       emoji: '📱', label: 'TikTok Hook',       desc: 'Close, handheld, neon punch.',
      pills: { shot: 'Close-up', movement: 'Handheld', mood: 'Neon', duration: '5', style: 'Realistic' },
      boosts: ['opening-beat'], modes: [] },
    { id: 'product-reveal',    emoji: '🛍️', label: 'Product Reveal',    desc: 'Studio close-up, slow push.',
      pills: { shot: 'Close-up', movement: 'Slow push in', mood: 'Studio', style: 'Realistic' },
      boosts: ['cleaner-framing', 'color-grade'], modes: ['photoreal'] },
    { id: 'broll-atmo',        emoji: '🌅', label: 'B-Roll Atmospheric',desc: 'Wide, still, magic hour.',
      pills: { shot: 'Wide', movement: 'Static', mood: 'Golden hour', style: 'Cinematic' },
      boosts: ['atmospheric', 'time-of-day'], modes: ['filmic'] },
  ];

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ---------- Pro Layer HTML ----------
  function buildProLayerHtml(scope, presets, boosts, modes) {
    var presetHtml = presets.map(function (p) {
      return '<button type="button" class="pmg-vs-pro-preset" data-vs-pro-preset="' + p.id + '" data-vs-scope="' + scope + '">' +
               '<span class="pmg-vs-pro-preset-emoji">' + p.emoji + '</span>' +
               '<span class="pmg-vs-pro-preset-body">' +
                 '<span class="pmg-vs-pro-preset-title">' + escapeHtml(p.label) + '</span>' +
                 '<span class="pmg-vs-pro-preset-desc">' + escapeHtml(p.desc) + '</span>' +
               '</span>' +
             '</button>';
    }).join('');
    var boostHtml = boosts.map(function (b) {
      return '<button type="button" class="pmg-vs-pro-boost" data-vs-pro-boost="' + b.id + '" data-vs-scope="' + scope + '" aria-pressed="false" title="' + escapeHtml(b.desc) + '">' +
               '<span class="pmg-vs-pro-boost-title">' + escapeHtml(b.label) + '</span>' +
               '<span class="pmg-vs-pro-boost-desc">' + escapeHtml(b.desc) + '</span>' +
             '</button>';
    }).join('');
    var modeHtml = modes.map(function (m) {
      return '<label class="pmg-vs-pro-mode">' +
               '<input type="checkbox" data-vs-pro-mode="' + m.id + '" data-vs-scope="' + scope + '" />' +
               '<span class="pmg-vs-pro-mode-body">' +
                 '<span class="pmg-vs-pro-mode-title">' + escapeHtml(m.label) + '</span>' +
                 '<span class="pmg-vs-pro-mode-desc">' + escapeHtml(m.desc) + '</span>' +
               '</span>' +
             '</label>';
    }).join('');
    return [
      '<section class="pmg-vs-inline-section pmg-vs-pro-layer" data-vs-pro-scope="' + scope + '">',
        '<label class="pmgv3-section-label">⚡ Pro Tuning</label>',
        '<p style="margin:0 0 10px;font-size:12px;opacity:.65">Quick-start presets, optional boosts, and modes — exactly like Money Mode for text prompts.</p>',
        '<div class="pmg-vs-pro-sublabel">Quick Start</div>',
        '<div class="pmg-vs-pro-presets">' + presetHtml + '</div>',
        '<div class="pmg-vs-pro-sublabel">Pro Boosts <span class="pmg-vs-pro-hint">(toggle on/off)</span></div>',
        '<div class="pmg-vs-pro-boosts">' + boostHtml + '</div>',
        '<div class="pmg-vs-pro-sublabel">Modes</div>',
        '<div class="pmg-vs-pro-modes">' + modeHtml + '</div>',
      '</section>',
    ].join('');
  }

  // Read active boost/mode directives for a given scope ("photo" or "video")
  function collectProDirectives(scope, boosts, modes) {
    var out = [];
    var root = document.querySelector('[data-vs-pro-scope="' + scope + '"]');
    if (!root) return out;
    boosts.forEach(function (b) {
      var btn = root.querySelector('[data-vs-pro-boost="' + b.id + '"]');
      if (btn && btn.getAttribute('aria-pressed') === 'true') out.push(b.directive);
    });
    modes.forEach(function (m) {
      var cb = root.querySelector('[data-vs-pro-mode="' + m.id + '"]');
      if (cb && cb.checked) out.push(m.directive);
    });
    return out;
  }

  // Apply a preset: press matching boosts/modes; for video, also press Sora pills.
  function applyPreset(scope, preset) {
    var root = document.querySelector('[data-vs-pro-scope="' + scope + '"]');
    if (!root) return;
    // Clear current boosts & modes in this scope first
    root.querySelectorAll('[data-vs-pro-boost]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    root.querySelectorAll('[data-vs-pro-mode]').forEach(function (cb) { cb.checked = false; });
    (preset.boosts || []).forEach(function (id) {
      var btn = root.querySelector('[data-vs-pro-boost="' + id + '"]');
      if (btn) btn.setAttribute('aria-pressed', 'true');
    });
    (preset.modes || []).forEach(function (id) {
      var cb = root.querySelector('[data-vs-pro-mode="' + id + '"]');
      if (cb) cb.checked = true;
    });
    // Mark active preset chip
    root.querySelectorAll('[data-vs-pro-preset]').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-vs-pro-preset') === preset.id);
    });
    // Video extras: press the Sora pills the preset specifies
    if (scope === 'video' && preset.pills) {
      Object.keys(preset.pills).forEach(function (group) {
        var value = preset.pills[group];
        document.querySelectorAll('#pmgv3-panel-video .pmg-vs-pill[data-vs-sora-group="' + group + '"]').forEach(function (sib) {
          sib.setAttribute('aria-pressed', sib.getAttribute('data-vs-sora-value') === value ? 'true' : 'false');
        });
      });
    }
  }

  // ---------- Panel HTML builders ----------
  // vs-24: Photography Suite "Epic" upgrade. Adds:
  //   1. Base Style toggle (Photographic vs Digital) — drives both a
  //      style directive AND a matched negative-prompt block in
  //      buildImagePrompt().
  //   2. Lighting & Environment Studio accordion — 6 pills, multi-select,
  //      contributes data-prompt values to the refined prompt.
  //   3. Expert Tips panel — static guidance for accurate faces / family
  //      photos (no logic, just copy).
  function buildBaseStyleToggleHtml() {
    return [
      '<section class="pmg-vs-inline-section pmgv3-photo-style-toggle" data-pmgv3-base-style="photographic">',
        '<label class="pmgv3-section-label">Base Style</label>',
        '<div class="pmgv3-toggle-group" role="group" aria-label="Base Style">',
          '<button type="button" class="pmgv3-toggle-btn is-active" data-style="photographic" aria-pressed="true">📷 Photographic</button>',
          '<button type="button" class="pmgv3-toggle-btn" data-style="digital" aria-pressed="false">🎨 Digital Art</button>',
        '</div>',
        '<p class="pmgv3-style-hint" id="style-hint-photographic">Forces real-world camera lensing — DSLR realism, natural light, sharp focus. Best for portraits, product, photojournalism.</p>',
        '<p class="pmgv3-style-hint" id="style-hint-digital" style="display:none;">Optimized for stylized renders — Unreal/Octane, hyper-detail, concept art. Best for fantasy, sci-fi, illustration.</p>',
      '</section>'
    ].join('');
  }
  function buildLightingAccordionHtml() {
    var pills = [
      { p: 'golden hour lighting, warm sunlight, long shadows',           label: '🌅 Golden Hour' },
      { p: 'neon cyberpunk lighting, magenta and cyan rim light, wet streets', label: '🌃 Neon Cyberpunk' },
      { p: 'moody cinematic lighting, low-key, deep shadows, single key light', label: '🎬 Moody Cinematic' },
      { p: 'harsh flash photography, direct on-camera flash, hard shadows',     label: '⚡ Harsh Flash' },
      { p: 'soft softbox lighting, even diffusion, studio portrait',            label: '🪟 Soft Softbox' },
      { p: 'blue hour, cool dusk light, ambient sky tones',                     label: '🌌 Blue Hour' }
    ];
    var pillHtml = pills.map(function (x) {
      return '<button type="button" class="pmgv3-lighting-pill" data-prompt="' + x.p + '" aria-pressed="false">' + x.label + '</button>';
    }).join('');
    return [
      '<section class="pmg-vs-inline-section pmgv3-lighting-accordion" id="pmgv3-lighting-accordion">',
        '<button type="button" class="pmgv3-lighting-acc-header" id="pmgv3-lighting-acc-toggle" aria-expanded="false" aria-controls="pmgv3-lighting-acc-content">',
          '<span class="pmgv3-section-label" style="margin:0">💡 Lighting &amp; Environment Studio</span>',
          '<span class="pmgv3-lighting-acc-hint">Tap one or more</span>',
          '<span class="pmgv3-lighting-acc-chevron" aria-hidden="true">▾</span>',
        '</button>',
        '<div class="pmgv3-lighting-acc-content" id="pmgv3-lighting-acc-content">',
          '<div class="pmgv3-lighting-pills">' + pillHtml + '</div>',
        '</div>',
      '</section>'
    ].join('');
  }
  function buildExpertTipsHtml() {
    return [
      '<aside class="pmgv3-expert-tips-panel" role="note" aria-label="Pro tips for accurate faces and family photos">',
        '<div class="tips-header">',
          '<span class="tips-icon" aria-hidden="true">🧠</span>',
          '<strong>Pro Tip: Accurate Faces &amp; Family Photos</strong>',
        '</div>',
        '<div class="tips-content">',
          '<ul>',
            '<li><strong>Use Reference Images:</strong> In tools like Midjourney, drop a clear reference photo as a seed image to anchor likeness.</li>',
            '<li><strong>Prompt Like a Photographer:</strong> Skip generic terms — name the lens, light, mood, camera body. Specificity wins.</li>',
            '<li><strong>Face Restoration:</strong> If faces look "plasticky," post-process with a face-restoration tool (GFPGAN, CodeFormer) for cleaner detail.</li>',
            '<li><strong>Combine Photos:</strong> For groups, generate individuals separately and composite them — AI almost always butchers group shots.</li>',
          '</ul>',
        '</div>',
      '</aside>'
    ].join('');
  }
  function buildPhotoLeft() {
    // ps-1: Three-mode sub-tab restructure.
    // Create New (default) gets the prompt-builder flow. Edit Photo and
    // Reverse Engineer move into secondary tabs so the 80% case (write a
    // text prompt → generate) stops being buried under upload-first UI.
    // No IDs renamed; everything below is the same content as before,
    // just regrouped under three #photo-mode-* containers.
    return [
      '<div class="pmgv3-photo-subtabs" role="tablist" aria-label="Photography mode">',
        '<button type="button" class="photo-subtab active" data-mode="create" role="tab" aria-selected="true" aria-controls="photo-mode-create">📷 Create New</button>',
        '<button type="button" class="photo-subtab" data-mode="edit" role="tab" aria-selected="false" aria-controls="photo-mode-edit">✨ Edit Photo</button>',
        '<button type="button" class="photo-subtab" data-mode="reverse" role="tab" aria-selected="false" aria-controls="photo-mode-reverse">🔍 Reverse Engineer</button>',
      '</div>',

      // ----- 1. CREATE (default active) -----
      '<div class="photo-mode-container active" id="photo-mode-create" role="tabpanel" aria-labelledby="photo-mode-create-tab">',
        '<section class="pmg-vs-inline-section">',
          '<label class="pmgv3-section-label" for="pmg-vs-image-goal">Describe Your Image</label>',
          '<textarea id="pmg-vs-image-goal" rows="3" placeholder="A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look…"></textarea>',
          // mux-2 Live Assembly Preview: read-only field that updates as the
          // user types or toggles pills, so they can see exactly what the
          // refined prompt will look like before clicking Generate.
          '<div class="pmg-vs-live-preview is-empty" id="pmg-vs-image-live-preview" aria-live="polite" aria-label="Live prompt preview">Type your image idea above — your prompt will assemble here as you tune.</div>',
          // mux-2 Renamed: was "✨ Build My Image Prompt".
          // ps-2-build-above-fold (Task #120): primary CTA lives directly
          // under the textarea so a first-time visitor on 360x800 / 1280x800
          // can build a prompt without scrolling.
          '<button type="button" id="pmg-vs-build-image-prompt-btn" class="pmg-vs-btn pmg-vs-btn-primary pmg-vs-full-width" style="margin-top:10px">✨ Generate Image</button>',
        '</section>',
        buildBaseStyleToggleHtml(),
        // mux-2 Advanced Tuning wrapper accordion. Collapses Camera /
        // Lighting / Color / Pro Boosts behind a single closed-by-default
        // toggle so the panel reads as Subject → Style → Generate at first
        // glance. The legacy inner accordions (photo suite + lighting)
        // still exist inside; CSS hides their inner chrome so we don't
        // get a triple-nested feel.
        '<section class="pmg-vs-inline-section pmg-vs-adv-tuning" id="pmg-vs-image-adv-tuning">',
          '<button type="button" class="pmg-vs-adv-tuning-header" data-pmg-adv-target="pmg-vs-image-adv-tuning" aria-expanded="false" aria-controls="pmg-vs-image-adv-tuning-content">',
            '<span class="pmgv3-section-label" style="margin:0">🎛️ Advanced Tuning</span>',
            '<span class="pmg-vs-adv-tuning-hint">Camera · Lighting · Color · Pro Boosts</span>',
            '<span class="pmg-vs-adv-tuning-chevron" aria-hidden="true">▾</span>',
          '</button>',
          '<div class="pmg-vs-adv-tuning-content" id="pmg-vs-image-adv-tuning-content">',
            '<section class="pmg-vs-inline-section pmg-vs-photo-accordion" id="pmg-vs-photo-accordion">',
              '<button type="button" class="pmg-vs-photo-acc-header" id="pmg-vs-photo-acc-toggle" aria-expanded="false" aria-controls="pmg-vs-photo-suite-container">',
                '<span class="pmgv3-section-label" style="margin:0">🎛️ Tune Your Image</span>',
                '<span class="pmg-vs-photo-acc-hint">Style · Camera · Lighting · more</span>',
                '<span class="pmg-vs-photo-acc-chevron" aria-hidden="true">▾</span>',
              '</button>',
              '<div id="pmg-vs-photo-suite-container">',
                '<p style="margin:6px 0 0;font-size:.85rem;opacity:.7">Loading photo controls…</p>',
              '</div>',
            '</section>',
            buildLightingAccordionHtml(),
            buildProLayerHtml('photo', PHOTO_PRESETS, PHOTO_BOOSTS, PHOTO_MODES),
          '</div>',
        '</section>',
        buildExpertTipsHtml(),
        // vs-23: heads-up notice — major image models reject edits of minors.
        '<aside class="pmgv3-child-photo-warning" role="note" aria-label="Note on editing photos of children">',
          '<div class="warning-icon" aria-hidden="true">⚠️</div>',
          '<div class="warning-content">',
            '<strong>Note on Editing Photos of Children</strong>',
            '<p>Major AI platforms (Gemini, ChatGPT, Claude) have strict safety filters that often block editing or altering photos of children and minors — to prevent misuse and protect privacy. If a family-photo edit gets refused, this is likely why. For kid photos we recommend traditional tools like Photoshop or Lightroom instead.</p>',
          '</div>',
        '</aside>',
        // ps-2-build-above-fold (Task #120): the primary "Build My Image
        // Prompt" CTA was relocated up under the textarea so it is reachable
        // without scrolling. The previous duplicate that lived here below
        // the tuning sections has been removed (no second instance — same
        // ID would have been invalid HTML).
        '<section class="pmg-vs-inline-section pmg-vs-refined-output" id="pmg-vs-image-refined-section" hidden>',
          '<label class="pmgv3-section-label" for="pmg-vs-image-refined">Your Refined Prompt — edit before you generate</label>',
          '<textarea id="pmg-vs-image-refined" rows="5"></textarea>',
          '<div class="pmg-vs-actions-row" style="justify-content:flex-end;margin-top:6px">',
            '<button type="button" class="pmg-fs-trigger" data-pmg-fullscreen-target="pmg-vs-image-refined" data-pmg-fullscreen-title="Refined Image Prompt">🔍 Expand Fullscreen</button>',
          '</div>',
          '<div class="pmg-vs-actions-row">',
            '<button type="button" id="pmg-vs-image-copy" class="pmg-vs-btn pmg-vs-btn-secondary">📋 Copy</button>',
            '<button type="button" id="pmg-vs-image-generate-btn" class="pmg-vs-btn pmg-vs-btn-primary" style="flex:1">🔄 Regenerate with edits</button>',
          '</div>',
        '</section>',
      '</div>',

      // ----- 2. EDIT (Image Workshop) -----
      '<div class="photo-mode-container" id="photo-mode-edit" role="tabpanel" style="display:none;">',
        buildImageWorkshopHtml(),
      '</div>',

      // ----- 3. REVERSE ENGINEER -----
      '<div class="photo-mode-container" id="photo-mode-reverse" role="tabpanel" style="display:none;">',
        '<section class="pmg-vs-inline-section">',
          '<label class="pmgv3-section-label">🔍 Reverse Engineer an Image</label>',
          '<p style="margin:0 0 4px;font-size:13px;font-weight:600;line-height:1.35">Steal any photo&rsquo;s look in one click.</p>',
          '<p style="margin:0 0 10px;font-size:12px;opacity:.75;line-height:1.45">Drop a photo &rarr; get a prompt you can edit, riff on, and re-generate &mdash; composition, lighting, palette, and lens all decoded for you.</p>',
          '<div id="pmg-vs-reverse-dropzone" class="pmg-vs-dropzone pmg-vs-dropzone--inline">',
            '<button type="button" id="pmg-vs-reverse-engineer-btn" class="pmg-vs-btn pmg-vs-btn-secondary pmg-vs-full-width">📸 Reverse Engineer an Image · drop or click</button>',
            '<input type="file" id="pmg-vs-reverse-input" accept="image/jpeg,image/png,image/webp" hidden />',
          '</div>',
          '<div id="pmg-vs-reverse-status" class="pmg-vs-reverse-status" hidden></div>',
          /* re-3: preview-with-discard. Replaces silent auto-inject with an
             explicit "Use this prompt" / "Discard" choice so the user keeps
             control and can reject a bad analysis without inheriting it. */
          '<div id="pmg-vs-reverse-preview" class="pmg-vs-reverse-preview" hidden>',
            '<div class="pmg-vs-reverse-preview-head">',
              '<span class="pmg-vs-reverse-preview-eyebrow">✓ Decoded</span>',
              '<span class="pmg-vs-reverse-preview-meta" id="pmg-vs-reverse-preview-meta"></span>',
            '</div>',
            '<textarea id="pmg-vs-reverse-preview-text" class="pmg-vs-reverse-preview-text" rows="5" readonly aria-label="Decoded prompt preview"></textarea>',
            '<div class="pmg-vs-reverse-preview-actions">',
              '<button type="button" id="pmg-vs-reverse-use-btn" class="pmg-vs-btn pmg-vs-btn-primary">Use this prompt →</button>',
              '<button type="button" id="pmg-vs-reverse-discard-btn" class="pmg-vs-reverse-discard-link">Discard</button>',
            '</div>',
          '</div>',
        '</section>',
      '</div>',
    ].join('');
  }

  // ps-1: Wire the Photo sub-tabs (Create / Edit / Reverse).
  // Idempotent — guards via data-pmg-subtabs-wired so re-mounts are safe.
  function initPhotoSubTabs(root) {
    var scope = root || document;
    var bar = scope.querySelector('.pmgv3-photo-subtabs');
    if (!bar || bar.dataset.pmgSubtabsWired === '1') return;
    bar.dataset.pmgSubtabsWired = '1';
    bar.addEventListener('click', function (e) {
      var tab = e.target && e.target.closest && e.target.closest('.photo-subtab');
      if (!tab || !bar.contains(tab)) return;
      setPhotoSubMode(tab.getAttribute('data-mode'), scope);
    });
  }

  function setPhotoSubMode(mode, root) {
    if (!mode) return;
    var scope = root || document;
    var tabs = scope.querySelectorAll('.photo-subtab');
    var containers = scope.querySelectorAll('.photo-mode-container');
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mode') === mode;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    containers.forEach(function (c) {
      var on = c.id === ('photo-mode-' + mode);
      c.classList.toggle('active', on);
      c.style.display = on ? 'block' : 'none';
    });
  }

  function buildPhotoRight() {
    return [
      '<div class="pmg-vs-media-container">',
        '<div id="pmg-vs-image-placeholder" class="pmg-media-placeholder">',
          '<span>✨ Your image will appear here</span>',
          '<span class="pmg-vs-sub">Describe what you want, then Generate.</span>',
        '</div>',
        '<img id="pmg-vs-generated-image" alt="Generated image" hidden />',
      '</div>',
      '<div id="pmg-vs-image-actions" class="pmg-vs-actions-row" hidden>',
        '<a id="pmg-vs-image-save" class="pmg-vs-btn pmg-vs-btn-secondary" download href="#">⬇ Save</a>',
        '<button type="button" id="pmg-vs-download-dna" class="pmg-vs-btn pmg-vs-btn-secondary">🧬 DNA Card</button>',
        '<button type="button" id="pmg-vs-share-dna" class="pmg-vs-btn pmg-vs-btn-secondary" hidden>↗ Share</button>',
        '<button type="button" id="pmg-vs-image-regen" class="pmg-vs-btn pmg-vs-btn-secondary">🔄 Regenerate</button>',
      '</div>',
    ].join('');
  }

  function buildVideoLeft() {
    var soraPillsHtml = '';
    [
      ['shot',       'Shot Size'],
      ['angle',      'Camera Angle'],
      ['movement',   'Camera Movement'],
      ['mood',       'Mood & Lighting'],
      ['focus',      'Focus Depth'],
      ['easing',     'Movement Intensity'],
      ['style',      'Style / Film Stock'],
      ['duration',   'Duration (sec)'],
      ['resolution', 'Resolution'],
    ].forEach(function (row) {
      var key = row[0], label = row[1];
      var pills = SORA_OPTIONS[key].map(function (v, i) {
        var pressed = (i === 0) ? 'true' : 'false';
        return '<button type="button" class="pmg-vs-pill" data-vs-sora-group="' + key + '" data-vs-sora-value="' + v + '" aria-pressed="' + pressed + '">' + v + '</button>';
      }).join('');
      soraPillsHtml +=
        '<div class="pmg-vs-pill-group">' +
          '<div class="pmg-vs-pill-label">' + label + '</div>' +
          '<div class="pmg-vs-pill-row" role="radiogroup" aria-label="' + label + '">' + pills + '</div>' +
        '</div>';
    });

    return [
      '<section class="pmg-vs-inline-section">',
        '<label class="pmgv3-section-label" for="pmg-vs-video-goal">Describe Your Scene</label>',
        '<textarea id="pmg-vs-video-goal" rows="3" placeholder="A tracking shot of a vintage car driving through neon-lit Tokyo at night…"></textarea>',
        // mux-2 Live Assembly Preview for video.
        '<div class="pmg-vs-live-preview is-empty" id="pmg-vs-video-live-preview" aria-live="polite" aria-label="Live prompt preview">Type your video idea above — your prompt will assemble here as you tune.</div>',
        // mux-2 Renamed: was "✨ Build My Video Prompt". Moved up under
        // the textarea so it sits above-fold like the photo panel.
        '<button type="button" id="pmg-vs-build-video-prompt-btn" class="pmg-vs-btn pmg-vs-btn-primary pmg-vs-full-width" style="margin-top:10px">✨ Generate Video</button>',
      '</section>',
      // mux-2 Advanced Tuning wrapper for the video panel. Wraps Pro
      // Tips, Camera Movement, Audio Cues, all SORA pills, Pro Layer
      // and the Storyboard launcher.
      '<section class="pmg-vs-inline-section pmg-vs-adv-tuning" id="pmg-vs-video-adv-tuning">',
        '<button type="button" class="pmg-vs-adv-tuning-header" data-pmg-adv-target="pmg-vs-video-adv-tuning" aria-expanded="false" aria-controls="pmg-vs-video-adv-tuning-content">',
          '<span class="pmgv3-section-label" style="margin:0">🎛️ Advanced Tuning</span>',
          '<span class="pmg-vs-adv-tuning-hint">Camera · Lighting · Pro Boosts · Storyboard</span>',
          '<span class="pmg-vs-adv-tuning-chevron" aria-hidden="true">▾</span>',
        '</button>',
        '<div class="pmg-vs-adv-tuning-content" id="pmg-vs-video-adv-tuning-content">',
      // vs-25 epic-video — Pro Tips panel (10,000 generation rule).
      '<section class="pmg-vs-inline-section">',
        '<div class="pmgv3-expert-tips-panel">',
          '<div class="tips-header">',
            '<span class="tips-icon">🎬</span>',
            '<strong>Pro Tip: How to actually win at AI Video</strong>',
          '</div>',
          '<div class="tips-content">',
            '<ul>',
              '<li><strong>Volume Beats Perfection:</strong> Stop trying to get the perfect clip on shot one. Pros generate 10–50 variations and pick the best.</li>',
              '<li><strong>Keep Actions Simple:</strong> "Walking while talking while eating" confuses the model. One clear action per shot wins every time.</li>',
              '<li><strong>Front-Load the Important Stuff:</strong> AI pays the most attention to the first sentence. Lead with the subject and the action.</li>',
            '</ul>',
          '</div>',
        '</div>',
      '</section>',
      // vs-25 epic-video — Camera Movement (forced single choice) + Audio Cues.
      '<section class="pmg-vs-inline-section">',
        '<div class="pmgv3-camera-movement">',
          '<label class="pmgv3-section-label" for="pmgv3-camera-select">Camera Movement</label>',
          '<select id="pmgv3-camera-select" class="pmgv3-select">',
            '<option value="">— No specific movement —</option>',
            '<option value="static">Static / Locked Off (Best for high realism)</option>',
            '<option value="slow_push">Slow Push In (Builds tension or intimacy)</option>',
            '<option value="slow_pull">Slow Pull Out (Reveals scale or isolation)</option>',
            '<option value="orbit">Orbit / Circular (Great for products or dramatic reveals)</option>',
            '<option value="handheld">Handheld Follow (Adds energy and documentary feel)</option>',
            '<option value="fpv">FPV Drone (High speed, flying through spaces)</option>',
          '</select>',
          '<p class="pmgv3-style-hint">AI video works best with ONE clear camera movement. Pick the simplest one that tells your story.</p>',
        '</div>',
        '<div class="pmgv3-audio-injector" style="margin-top:12px">',
          '<label class="pmgv3-section-label" for="pmgv3-audio-cues">Sound &amp; Atmosphere</label>',
          '<input type="text" id="pmgv3-audio-cues" class="pmgv3-input" maxlength="200" autocomplete="off" placeholder="e.g. soft rain, distant traffic, faint piano…" />',
          '<p class="pmgv3-style-hint">Modern AI video tools (Veo 3, Sora) use sound descriptions to match the visual pacing — even when no audio is generated.</p>',
        '</div>',
      '</section>',
      '<section class="pmg-vs-inline-section">',
        '<label class="pmgv3-section-label">Video Tuning Suite</label>',
        '<p style="margin:0 0 8px;font-size:12px;opacity:.65">Pick a vibe in each group — we will compose the directives.</p>',
        '<div class="pmg-vs-sora-pills">' + soraPillsHtml + '</div>',
      '</section>',
      buildProLayerHtml('video', VIDEO_PRESETS, VIDEO_BOOSTS, VIDEO_MODES),
      '<section class="pmg-vs-inline-section" id="pmgv3-storyboard-mount">',
        // Storyboard launcher button is injected here by pmg-storyboard.js
      '</section>',
        // mux-2 close Advanced Tuning content + section
        '</div>',
      '</section>',
      // mux-2 The old "✨ Build My Video Prompt" button that lived here
      // was relocated to sit directly under the textarea (above-fold) and
      // renamed to "✨ Generate Video".
      '<section class="pmg-vs-inline-section pmg-vs-refined-output" id="pmg-vs-video-refined-section" hidden>',
        '<label class="pmgv3-section-label" for="pmg-vs-video-refined">Your Refined Prompt — edit before you generate</label>',
        '<textarea id="pmg-vs-video-refined" rows="5"></textarea>',
        '<div class="pmg-vs-actions-row" style="justify-content:flex-end;margin-top:6px">',
          '<button type="button" class="pmg-fs-trigger" data-pmg-fullscreen-target="pmg-vs-video-refined" data-pmg-fullscreen-title="Refined Video Prompt">🔍 Expand Fullscreen</button>',
        '</div>',
        '<div class="pmg-vs-actions-row">',
          '<button type="button" id="pmg-vs-video-copy" class="pmg-vs-btn pmg-vs-btn-secondary">📋 Copy</button>',
          '<button type="button" id="pmg-vs-video-generate-btn" class="pmg-vs-btn pmg-vs-btn-primary" style="flex:1">🔄 Regenerate with edits</button>',
        '</div>',
      '</section>',
    ].join('');
  }

  function buildVideoRight() {
    return [
      '<div class="pmg-vs-media-container">',
        '<div id="pmg-vs-video-placeholder" class="pmg-media-placeholder">',
          '<span>🎬 Your video prompt will appear here soon</span>',
          '<span class="pmg-vs-sub">Build your scene on the left, then Generate. Videos typically take 10–30 seconds.</span>',
        '</div>',
        '<video id="pmg-vs-generated-video" controls playsinline hidden></video>',
      '</div>',
      '<div id="pmg-vs-video-actions" class="pmg-vs-actions-row" hidden>',
        '<a id="pmg-vs-video-save" class="pmg-vs-btn pmg-vs-btn-secondary" download href="#">⬇ Save</a>',
        '<button type="button" id="pmg-vs-video-regen" class="pmg-vs-btn pmg-vs-btn-secondary">🔄 Regenerate</button>',
      '</div>',
    ].join('');
  }

  // ---------- Mount ----------
  var _mounted = false;

  function mountVisualStudioPanels(hosts) {
    if (!hosts) return;
    if (hosts.photoLeft && !hosts.photoLeft.querySelector('#pmg-vs-image-goal')) {
      hosts.photoLeft.innerHTML = buildPhotoLeft();
    }
    if (hosts.photoRight && !hosts.photoRight.querySelector('#pmg-vs-image-placeholder')) {
      hosts.photoRight.innerHTML = buildPhotoRight();
    }
    if (hosts.videoLeft && !hosts.videoLeft.querySelector('#pmg-vs-video-goal')) {
      hosts.videoLeft.innerHTML = buildVideoLeft();
    }
    if (hosts.videoRight && !hosts.videoRight.querySelector('#pmg-vs-video-placeholder')) {
      hosts.videoRight.innerHTML = buildVideoRight();
    }
    relocatePhotoSuite();
    if (hosts.photoLeft) initPhotoSubTabs(hosts.photoLeft);
    wireLivePreview();
    _mounted = true;
  }

  // Try to attach the existing legacy Photography Suite DOM into the new
  // photo panel container. If there is no suite on this page, leave a
  // friendly notice so users know what they're missing.
  function relocatePhotoSuite() {
    var container = $('pmg-vs-photo-suite-container');
    if (!container) return;
    var suite = document.getElementById('photo-suite-section')
             || document.getElementById('pmg-photo-suite');
    if (suite && !container.contains(suite)) {
      container.innerHTML = '';
      container.appendChild(suite);
      suite.hidden = false;
      suite.removeAttribute('aria-hidden');
      suite.style.display = '';
    } else if (!suite) {
      container.innerHTML = '<p style="margin:6px 0 0;font-size:.85rem;opacity:.7">Photo controls aren\'t available on this page.</p>';
    }
  }

  // ---------- Back-compat shim ----------
  function openVisualStudio(opts) {
    var mode = (opts && opts.mode) || 'image';
    var name = mode === 'video' ? 'video' : 'photography';
    if (window.pmgChassisV3 && typeof window.pmgChassisV3.setActivePanel === 'function') {
      window.pmgChassisV3.setActivePanel(name);
      return;
    }
    var tab = document.querySelector('.pmgv3-tab[data-module="' + name + '"]');
    if (tab) tab.click();
  }

  // ---------- Build refined prompt ----------
  // vs-24 Base-Style directives + matched negative prompts. The negative
  // block is appended on its own line after the positive prompt because
  // most image tools (Midjourney, SD WebUI, ComfyUI text-prompt boxes)
  // accept the `--no` style or simply ignore it cleanly.
  var BASE_STYLE_POSITIVE = {
    photographic: 'Shot on high-end DSLR, raw photo, unedited, photorealistic, natural lighting, sharp focus',
    digital:      'Unreal Engine 5 render, octane render, cinematic lighting, hyper-detailed, digital illustration, masterpiece'
  };
  var BASE_STYLE_NEGATIVE = {
    photographic: '--no ugly, deformed, extra limbs, cartoon, illustration, 3d render, smooth skin, plastic, watermark, text, asymmetrical face, distorted eyes',
    digital:      '--no low quality, worst quality, blurry, pixelated, watermark, text, signature, bad anatomy'
  };
  function getActiveBaseStyle() {
    var host = document.querySelector('.pmgv3-photo-style-toggle');
    var v = host && host.getAttribute('data-pmgv3-base-style');
    return (v === 'digital') ? 'digital' : 'photographic';
  }
  function collectLightingPrompts() {
    var out = [];
    document.querySelectorAll('#pmgv3-lighting-accordion .pmgv3-lighting-pill[aria-pressed="true"]').forEach(function (p) {
      var v = p.getAttribute('data-prompt');
      if (v) out.push(v);
    });
    return out;
  }
  // mux-2: pure assembler used by both buildImagePrompt (writes the
  // refined textarea + triggers Generate) and renderImagePreview
  // (read-only Live Preview block). Returns '' when no goal is set.
  function assembleImagePrompt() {
    var goalEl = $('pmg-vs-image-goal');
    var goal = goalEl && goalEl.value.trim();
    if (!goal) return '';
    var refined = goal;
    var suite = document.getElementById('photo-suite-section')
             || document.getElementById('pmg-photo-suite');
    if (suite) {
      var picked = [];
      suite.querySelectorAll('[aria-pressed="true"], .pmg-pill.is-active, .is-selected').forEach(function (n) {
        var t = (n.textContent || '').trim();
        if (t && t.length < 60) picked.push(t);
      });
      if (picked.length) refined += ' — ' + picked.join(', ');
    }
    var lighting = collectLightingPrompts();
    if (lighting.length) refined += '. ' + lighting.join('. ') + '.';
    var pro = collectProDirectives('photo', PHOTO_BOOSTS, PHOTO_MODES);
    if (pro.length) refined += '. ' + pro.join('. ') + '.';
    var bs = getActiveBaseStyle();
    refined += '. ' + BASE_STYLE_POSITIVE[bs] + '.';
    refined += '\n' + BASE_STYLE_NEGATIVE[bs];
    return refined;
  }

  function buildImagePrompt() {
    var refined = assembleImagePrompt();
    if (!refined) {
      var goalEl = $('pmg-vs-image-goal');
      if (goalEl) goalEl.focus();
      return;
    }
    var ta = $('pmg-vs-image-refined');
    if (ta) {
      ta.value = refined;
      var sec = $('pmg-vs-image-refined-section');
      if (sec) sec.hidden = false;
      // mux-2: hide the top "Generate Image" CTA after first build so the
      // refined-section's "🔄 Regenerate" becomes the single Generate button
      // and the user isn't looking at two primary CTAs at once.
      var topBtn = $('pmg-vs-build-image-prompt-btn');
      if (topBtn) topBtn.style.display = 'none';
      ta.focus();
      // scroll-image-result-1: bring the refined section into view so the
      // user actually sees what they generated. Without this, ta.focus()
      // alone doesn't reliably scroll on iOS/Chromium when the section
      // sits below the fold. Honors prefers-reduced-motion via PMG_A11Y.
      if (sec && typeof sec.scrollIntoView === 'function') {
        try {
          var beh = (window.PMG_A11Y && window.PMG_A11Y.scrollBehavior)
            ? window.PMG_A11Y.scrollBehavior() : 'smooth';
          sec.scrollIntoView({ behavior: beh, block: 'start' });
        } catch (e) { try { sec.scrollIntoView(); } catch (__) {} }
      }
    }
    // Auto-trigger the actual API call so the rename "Generate Image"
    // does what it says on the tin. The user can still edit the refined
    // textarea and click "🔄 Regenerate with edits" afterward.
    if (typeof generateImage === 'function') generateImage();
  }

  // mux-2: pure assembler for the video panel.
  function assembleVideoPrompt() {
    var goalEl = $('pmg-vs-video-goal');
    var goal = goalEl && goalEl.value.trim();
    if (!goal) return '';
    var directives = [];
    document.querySelectorAll('#pmgv3-panel-video .pmg-vs-pill[aria-pressed="true"]').forEach(function (p) {
      var key = p.getAttribute('data-vs-sora-group');
      var v = p.getAttribute('data-vs-sora-value');
      if (!key || !v) return;
      if (key === 'duration' || key === 'resolution') return;
      if (key === 'shot')          directives.push(v + ' shot');
      else if (key === 'angle')    directives.push(v.toLowerCase() + ' camera angle');
      else if (key === 'movement') directives.push(v + ' camera movement');
      else if (key === 'mood')     directives.push(v + ' lighting');
      else if (key === 'focus')    directives.push(v.toLowerCase() + ' depth of field');
      else if (key === 'easing')   directives.push(v.toLowerCase() + ' motion easing');
      else if (key === 'style')    directives.push(v + ' style');
    });
    var pro = collectProDirectives('video', VIDEO_BOOSTS, VIDEO_MODES);
    // vs-25 epic-video — Camera Movement select (forced single choice).
    var camSel = $('pmgv3-camera-select');
    var CAM_LABEL = {
      static:    'Static / locked-off camera',
      slow_push: 'Slow push in on the subject',
      slow_pull: 'Slow pull out from the subject',
      orbit:     'Orbit / circular camera move around the subject',
      handheld:  'Handheld follow camera',
      fpv:       'FPV drone flying through the scene'
    };
    if (camSel && camSel.value && CAM_LABEL[camSel.value]) {
      pro.push('Camera Movement: ' + CAM_LABEL[camSel.value] + '.');
    }
    // vs-25 epic-video — Audio Cue injector.
    var audioEl = $('pmgv3-audio-cues');
    var audio = audioEl && audioEl.value && audioEl.value.trim();
    if (audio) {
      pro.push('Audio Cues: ' + audio + '. Ensure the visual pacing and environment match these sounds.');
    }
    var allDirectives = directives.concat(pro);
    // vs-25 epic-video — always-on Anti-Jitter negative prompt block.
    var negative = '--no morphing, jittering, warping, floating limbs, sudden physics changes, text artifacts, blurry edges, unnatural physics';
    return goal +
      (allDirectives.length ? '. ' + allDirectives.join('. ') + '.' : '') +
      ' ' + negative;
  }

  function buildVideoPrompt() {
    var refined = assembleVideoPrompt();
    if (!refined) {
      var goalEl = $('pmg-vs-video-goal');
      if (goalEl) goalEl.focus();
      return;
    }
    var ta = $('pmg-vs-video-refined');
    if (ta) {
      ta.value = refined;
      var sec = $('pmg-vs-video-refined-section');
      if (sec) sec.hidden = false;
      var topBtn = $('pmg-vs-build-video-prompt-btn');
      if (topBtn) topBtn.style.display = 'none';
      ta.focus();
      // scroll-video-result-1: mirror the image-panel fix so the refined
      // video prompt scrolls into view after generation. Honors
      // prefers-reduced-motion via PMG_A11Y.
      if (sec && typeof sec.scrollIntoView === 'function') {
        try {
          var beh = (window.PMG_A11Y && window.PMG_A11Y.scrollBehavior)
            ? window.PMG_A11Y.scrollBehavior() : 'smooth';
          sec.scrollIntoView({ behavior: beh, block: 'start' });
        } catch (e) { try { sec.scrollIntoView(); } catch (__) {} }
      }
    }
    if (typeof generateVideo === 'function') generateVideo();
  }

  // mux-2: Live Assembly Preview render. Updates the read-only block
  // under each goal textarea so the user can see exactly what the
  // refined prompt looks like as they type or toggle pills.
  function renderImagePreview() {
    var box = $('pmg-vs-image-live-preview');
    if (!box) return;
    var goalEl = $('pmg-vs-image-goal');
    var hasGoal = !!(goalEl && goalEl.value.trim());
    if (!hasGoal) {
      box.classList.add('is-empty');
      box.textContent = 'Type your image idea above — your prompt will assemble here as you tune.';
      return;
    }
    var assembled = assembleImagePrompt();
    box.classList.remove('is-empty');
    box.textContent = assembled;
  }
  function renderVideoPreview() {
    var box = $('pmg-vs-video-live-preview');
    if (!box) return;
    var goalEl = $('pmg-vs-video-goal');
    var hasGoal = !!(goalEl && goalEl.value.trim());
    if (!hasGoal) {
      box.classList.add('is-empty');
      box.textContent = 'Type your video idea above — your prompt will assemble here as you tune.';
      return;
    }
    box.classList.remove('is-empty');
    box.textContent = assembleVideoPrompt();
  }
  function renderAllPreviews() {
    try { renderImagePreview(); } catch (_) {}
    try { renderVideoPreview(); } catch (_) {}
  }
  // Wire input + mutation watchers once panels mount. Pill toggles flip
  // aria-pressed via JS without firing native change events, so the
  // observer is the reliable signal for those.
  function wireLivePreview() {
    if (wireLivePreview._wired) return;
    wireLivePreview._wired = true;
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.id) return;
      if (t.id === 'pmg-vs-image-goal' || t.id === 'pmgv3-audio-cues') renderImagePreview();
      if (t.id === 'pmg-vs-video-goal' || t.id === 'pmgv3-audio-cues') renderVideoPreview();
      // Guided intake fields write back into the legacy textareas which
      // are listened to above, but cover the case where guided fields
      // exist without the textarea echo (they don't currently).
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'pmgv3-camera-select') renderVideoPreview();
      if (t.matches && t.matches('[data-vs-pro-mode]')) renderAllPreviews();
    });
    // Watch the photo + video panels for aria-pressed flips on pills,
    // base-style toggle changes, and any class flips inside the photo
    // suite. Cheap because the panels are small subtrees.
    var observe = function (sel) {
      var el = document.querySelector(sel);
      if (!el || el.dataset.pmgPreviewObserved === '1') return;
      el.dataset.pmgPreviewObserved = '1';
      var mo = new MutationObserver(function () { renderAllPreviews(); });
      mo.observe(el, { attributes: true, subtree: true,
        attributeFilter: ['aria-pressed', 'data-pmgv3-base-style', 'class'] });
    };
    var ticks = 0;
    var t = setInterval(function () {
      ticks++;
      observe('#pmgv3-panel-photography');
      observe('#pmgv3-panel-video');
      renderAllPreviews();
      if (ticks > 40) clearInterval(t);
    }, 250);
  }

  // ---------- Generate ----------
  function showImageLoading() {
    var ph = $('pmg-vs-image-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<div class="pmg-vs-spinner" aria-hidden="true"></div>' +
                   '<span>⏳ Generating image with DALL·E 3…</span>' +
                   '<span class="pmg-vs-sub">This can take 10–30 seconds.</span>';
    var img = $('pmg-vs-generated-image'); if (img) img.hidden = true;
    var act = $('pmg-vs-image-actions'); if (act) act.hidden = true;
  }
  function showVideoLoading() {
    var ph = $('pmg-vs-video-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<div class="pmg-vs-spinner" aria-hidden="true"></div>' +
                   '<span>⏳ Generating your video…</span>' +
                   '<span class="pmg-vs-sub">This can take 10–30 seconds.</span>';
    var vid = $('pmg-vs-generated-video'); if (vid) vid.hidden = true;
    var act = $('pmg-vs-video-actions'); if (act) act.hidden = true;
  }
  function showImageError(msg) {
    var ph = $('pmg-vs-image-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<span style="color:#ff8a8a">⚠️ ' + msg + '</span>';
  }
  function showVideoError(msg) {
    var ph = $('pmg-vs-video-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<span style="color:#ff8a8a">⚠️ ' + msg + '</span>';
  }
  function showVideoUpgrade(msg) {
    var ph = $('pmg-vs-video-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML =
      '<div class="pmg-vs-upgrade-card" style="text-align:left;max-width:380px;margin:0 auto">' +
        '<h4>🎬 Founding Member Feature</h4>' +
        '<p>' + msg + '</p>' +
        '<a href="/pricing.html#founding-member-waitlist" class="pmg-vs-btn pmg-vs-btn-primary pmg-vs-full-width" style="text-decoration:none">See Founding Member Plan →</a>' +
      '</div>';
  }

  async function generateImage() {
    /* Bug fix: if the user types into the goal box and clicks Generate
       without first clicking Refine, the refined textarea is empty and
       the original code silently focused an off-screen empty box (looked
       like the button was dead). Fall back to the goal box so the button
       always works. The refined value still wins when present so users
       who DID refine get the polished prompt sent to DALL-E. */
    var refinedTa = $('pmg-vs-image-refined');
    var goalTa    = $('pmg-vs-image-goal');
    var refined = (refinedTa && refinedTa.value || '').trim();
    var goal    = (goalTa    && goalTa.value    || '').trim();
    var prompt  = refined || goal;
    if (!prompt) {
      // Both empty — focus the goal box (the input the user actually sees first).
      (goalTa || refinedTa) && (goalTa || refinedTa).focus();
      return;
    }
    var btn = $('pmg-vs-image-generate-btn');
    var origLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
    showImageLoading();
    /* img-timeout-1: client-side 55s abort. /api/image is a long-running
       sequence (gpt-4.1-mini enhancer + gpt-image-1 medium-quality
       generation + 1-2MB base64 body transfer), routinely 25-50s.
       Replit's deployment proxy can drop idle connections at ~30-60s,
       and when it kills the connection mid-flight without RST the
       browser fetch sits "pending" forever — no resolve, no reject,
       spinner stuck, button locked. AbortController forces a clean
       failure path so the user can retry. 55s is below the most
       aggressive proxy timeouts we've seen and above the p95 successful
       generation latency. Long-term fix: job-id + polling architecture
       (Option 2). */
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timeoutId = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, 55000) : null;
    try {
      var fetchOpts = {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt, size: window.__pmgAspectRatio || '1024x1024' }),
      };
      if (ctrl) fetchOpts.signal = ctrl.signal;
      var res = await fetch('/api/image', fetchOpts);
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) {
        showImageError(data.error || (res.status === 429 ? 'Daily image limit reached.' : 'Image generation failed.'));
        return;
      }
      showImageResult(data.url);
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.code === 20)) {
        showImageError('Image generation is taking longer than expected. Try again — it usually works on the second attempt.');
      } else {
        showImageError('Network error. Check your connection.');
      }
    } finally {
      if (timeoutId) { try { clearTimeout(timeoutId); } catch (_) {} }
      if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    }
  }

  async function generateVideo() {
    var ta = $('pmg-vs-video-refined');
    var prompt = (ta && ta.value || '').trim();
    if (!prompt) { ta && ta.focus(); return; }
    var btn = $('pmg-vs-video-generate-btn');
    var origLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
    showVideoLoading();
    var resPill = document.querySelector('#pmgv3-panel-video .pmg-vs-pill[data-vs-sora-group="resolution"][aria-pressed="true"]');
    var durPill = document.querySelector('#pmgv3-panel-video .pmg-vs-pill[data-vs-sora-group="duration"][aria-pressed="true"]');
    var resolution = resPill ? resPill.getAttribute('data-vs-sora-value') : '720p';
    var nSeconds   = durPill ? Number(durPill.getAttribute('data-vs-sora-value')) : 5;
    try {
      var res = await fetch('/api/video', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt, resolution: resolution, n_seconds: nSeconds }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 401 || res.status === 402) {
        showVideoUpgrade(data.error || 'Video generation is a Founding Member feature.');
        return;
      }
      if (!res.ok || !data.url) {
        showVideoError(data.error || 'Video generation failed.');
        return;
      }
      showVideoResult(data.url);
    } catch (e) {
      showVideoError('Network error. Check your connection.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origLabel; }
    }
  }

  function showImageResult(url) {
    var ph  = $('pmg-vs-image-placeholder');
    var img = $('pmg-vs-generated-image');
    var act = $('pmg-vs-image-actions');
    if (img) { img.src = url; img.hidden = false; }
    if (ph)  ph.hidden = true;
    if (act) act.hidden = false;
    var save = $('pmg-vs-image-save');
    if (save) {
      save.href = url; save.target = '_blank'; save.rel = 'noopener';
      save.removeAttribute('download');
      save.textContent = '⬇ Open Image';
    }
    var shareBtn = $('pmg-vs-share-dna');
    if (shareBtn) shareBtn.hidden = !navigator.share;
  }

  function showVideoResult(url) {
    var ph  = $('pmg-vs-video-placeholder');
    var vid = $('pmg-vs-generated-video');
    var act = $('pmg-vs-video-actions');
    if (vid) { vid.src = url; vid.hidden = false; }
    if (ph)  ph.hidden = true;
    if (act) act.hidden = false;
    var save = $('pmg-vs-video-save');
    if (save) { save.href = url; save.setAttribute('download', 'promptmegood-video.mp4'); }
  }

  // ---------- Image Workshop (vs-20) ----------
  // Upload-and-enhance flow. User drops/picks a photo, toggles enhancement
  // chips (color grade, restore, vector style, anime, remove background,
  // etc.), optionally adds a free-form note, and we POST it to
  // /api/image-edit which returns a re-rendered PNG.
  var EDIT_PRESETS = [
    { id: 'upscale',     emoji: '✨', label: 'Upscale & Sharpen',
      directive: 'upscale to higher resolution, increase sharpness, recover fine detail in eyes hair and textures, no blur' },
    { id: 'color-pop',   emoji: '🎨', label: 'Color Pop',
      directive: 'punchy saturated color pop, vibrant tones, lifted shadows, magazine-style color treatment' },
    { id: 'cinematic',   emoji: '🎬', label: 'Cinematic Grade',
      directive: 'cinematic teal-and-orange color grade, film contrast, soft highlights, deep shadows, 2.39:1 mood' },
    { id: 'remove-bg',   emoji: '🪄', label: 'Remove Background',
      directive: 'isolate the main subject and replace the background with pure transparent-style flat white, clean cutout edges' },
    { id: 'restore',     emoji: '📜', label: 'Restore Old Photo',
      directive: 'restore old damaged photograph: remove scratches, dust and creases; recover faded colors; sharpen blurred edges; fix tears; keep original subject identity' },
    { id: 'day-night',   emoji: '🌙', label: 'Day → Night',
      directive: 'convert daytime scene to night, add moonlight and ambient artificial light, deep blue sky, glowing windows, preserve subject and composition' },
    { id: 'night-day',   emoji: '🌅', label: 'Night → Day',
      directive: 'convert nighttime scene to daytime, soft natural sunlight, blue sky, preserve subject and composition' },
    { id: 'vector',      emoji: '🖼️', label: 'Vector Style',
      directive: 'convert to clean vector illustration: flat solid colors, bold clean outlines, minimal gradients, suitable as a logo or sticker' },
    { id: 'anime',       emoji: '🎌', label: 'Anime Style',
      directive: 'convert to high-quality anime illustration, cel-shaded, expressive line art, Studio Ghibli palette' },
    { id: 'oil-paint',   emoji: '🎭', label: 'Oil Painting',
      directive: 'convert to classical oil painting, visible brushstrokes, rich impasto texture, Rembrandt lighting' },
    { id: 'watercolor',  emoji: '💧', label: 'Watercolor',
      directive: 'convert to soft watercolor painting, gentle paper texture, flowing pigment edges, light pastel palette' },
    { id: 'bw-film',     emoji: '⚫', label: 'B&W Film',
      directive: 'convert to high-contrast black-and-white film photograph, Tri-X grain, dramatic shadows' },
    { id: 'film-grain',  emoji: '📷', label: 'Add 35mm Grain',
      directive: 'add subtle 35mm film grain, organic analog texture, Kodak Portra warmth' },
    { id: 'studio-light',emoji: '💡', label: 'Studio Lighting',
      directive: 'relight subject with professional studio softbox setup, key light + soft fill + rim light, magazine-cover quality' },
    { id: 'clean-bg',    emoji: '🧹', label: 'Clean Background',
      directive: 'remove distracting elements from the background, simplify composition, keep subject untouched' },
    { id: 'hdr',         emoji: '🌈', label: 'HDR Look',
      directive: 'apply HDR processing — recover blown highlights, lift shadows, enhanced dynamic range, crisp local contrast' },
  ];

  function buildImageWorkshopHtml() {
    var chipsHtml = EDIT_PRESETS.map(function (p) {
      return '<button type="button" class="pmg-vs-edit-chip" data-edit-preset="' + p.id +
             '" aria-pressed="false">' + p.emoji + ' ' + escapeHtml(p.label) + '</button>';
    }).join('');
    return [
      '<section class="pmg-vs-inline-section pmg-vs-workshop">',
        '<label class="pmgv3-section-label">🖼️ Image Workshop — Upload &amp; Enhance</label>',
        '<p style="margin:0 0 10px;font-size:12px;opacity:.7">Already have a photo? Drop it in, pick the enhancements you want, and we will rebuild it.</p>',
        '<div class="pmg-vs-dropzone" id="pmg-vs-edit-dropzone" tabindex="0" role="button" aria-label="Upload image to enhance">',
          '<input type="file" id="pmg-vs-edit-input" accept="image/jpeg,image/png,image/webp" hidden />',
          '<div class="pmg-vs-dropzone-empty">',
            '<div class="pmg-vs-dropzone-icon">📤</div>',
            '<div><strong>Drop image here</strong> or <span class="pmg-vs-link-look">click to browse</span></div>',
            '<div class="pmg-vs-dropzone-hint">JPG / PNG / WEBP · up to 10 MB</div>',
          '</div>',
          '<div class="pmg-vs-dropzone-preview" hidden>',
            '<img id="pmg-vs-edit-preview" alt="Selected image preview" />',
            '<button type="button" class="pmg-vs-link" id="pmg-vs-edit-clear" aria-label="Remove selected image">✕ Remove</button>',
          '</div>',
        '</div>',
        '<div class="pmg-vs-edit-chips" role="group" aria-label="Enhancement options">' + chipsHtml + '</div>',
        '<textarea id="pmg-vs-edit-custom" rows="2" placeholder="Optional: extra direction (e.g. add a sunset, make it look like the 90s, change shirt to red…)" maxlength="500"></textarea>',
        '<button type="button" id="pmg-vs-edit-go" class="pmg-vs-btn pmg-vs-btn-primary pmg-vs-full-width" disabled>✨ Enhance Photo</button>',
        '<div id="pmg-vs-edit-status" class="pmg-vs-reverse-status" hidden></div>',
        '<div id="pmg-vs-edit-result" class="pmg-vs-edit-result" hidden>',
          '<img id="pmg-vs-edit-output" alt="Enhanced result" />',
          '<div class="pmg-vs-actions-row">',
            '<a id="pmg-vs-edit-download" class="pmg-vs-btn pmg-vs-btn-secondary" download="enhanced.png" href="#">⬇ Download PNG</a>',
            '<button type="button" id="pmg-vs-edit-svg" class="pmg-vs-btn pmg-vs-btn-secondary">🎨 Save as SVG</button>',
            '<button type="button" id="pmg-vs-edit-redo" class="pmg-vs-btn pmg-vs-btn-secondary">🔄 Try Again</button>',
          '</div>',
        '</div>',
      '</section>',
    ].join('');
  }

  var editFile = null;

  function setEditStatus(msg, kind) {
    var el = $('pmg-vs-edit-status');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'pmg-vs-reverse-status pmg-vs-reverse-status--' + (kind || 'info');
  }

  function refreshEditButton() {
    var btn = $('pmg-vs-edit-go');
    if (!btn) return;
    var hasFile = !!editFile;
    var hasPick = !!document.querySelector('.pmg-vs-edit-chip[aria-pressed="true"]') ||
                  ((($('pmg-vs-edit-custom') && $('pmg-vs-edit-custom').value) || '').trim().length > 0);
    btn.disabled = !(hasFile && hasPick);
  }

  function setEditFile(file) {
    if (!file) {
      editFile = null;
      var emp = document.querySelector('#pmg-vs-edit-dropzone .pmg-vs-dropzone-empty');
      var prev = document.querySelector('#pmg-vs-edit-dropzone .pmg-vs-dropzone-preview');
      if (emp)  emp.hidden = false;
      if (prev) prev.hidden = true;
      var img = $('pmg-vs-edit-preview');
      if (img && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      if (img) img.removeAttribute('src');
      refreshEditButton();
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setEditStatus('⚠️ Use JPG, PNG, or WEBP.', 'err');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setEditStatus('⚠️ Image is over 10 MB. Please pick a smaller one.', 'err');
      return;
    }
    editFile = file;
    setEditStatus('', 'info');
    var emp2 = document.querySelector('#pmg-vs-edit-dropzone .pmg-vs-dropzone-empty');
    var prev2 = document.querySelector('#pmg-vs-edit-dropzone .pmg-vs-dropzone-preview');
    if (emp2)  emp2.hidden = true;
    if (prev2) prev2.hidden = false;
    var img2 = $('pmg-vs-edit-preview');
    if (img2) {
      if (img2.src.startsWith('blob:')) URL.revokeObjectURL(img2.src);
      img2.src = URL.createObjectURL(file);
    }
    refreshEditButton();
  }

  async function runImageEdit() {
    if (!editFile) { setEditStatus('⚠️ Drop a photo first.', 'err'); return; }
    var directives = Array.prototype.map.call(
      document.querySelectorAll('.pmg-vs-edit-chip[aria-pressed="true"]'),
      function (el) {
        var id = el.getAttribute('data-edit-preset');
        var p = EDIT_PRESETS.filter(function (x) { return x.id === id; })[0];
        return p && p.directive;
      }
    ).filter(Boolean);
    var custom = (($('pmg-vs-edit-custom') && $('pmg-vs-edit-custom').value) || '').trim();
    if (directives.length === 0 && !custom) {
      setEditStatus('⚠️ Pick at least one enhancement chip (or describe what you want).', 'err');
      return;
    }
    var btn = $('pmg-vs-edit-go');
    if (btn) { btn.disabled = true; btn.dataset.origLabel = btn.textContent; btn.textContent = '🛠️ Rebuilding your photo… (~20s)'; }
    setEditStatus('🛠️ Sending to the AI image studio — typically takes 15-30 seconds.', 'info');
    try {
      var fd = new FormData();
      fd.append('image', editFile, editFile.name || 'upload.png');
      fd.append('directives', JSON.stringify(directives));
      if (custom) fd.append('custom', custom);
      var headers = authHeaders();
      delete headers['Content-Type'];
      var res = await fetch('/api/image-edit', { method: 'POST', body: fd, headers: headers });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) {
        setEditStatus('⚠️ ' + (data.error || 'Could not enhance that image. Try a smaller file or different chips.'), 'err');
        return;
      }
      var out = $('pmg-vs-edit-output');
      var dl  = $('pmg-vs-edit-download');
      var box = $('pmg-vs-edit-result');
      if (out) out.src = data.url;
      if (dl)  dl.href = data.url;
      if (box) box.hidden = false;
      setEditStatus('✓ Done. Download the PNG, save as SVG, or tweak the chips and try again.', 'ok');
    } catch (e) {
      setEditStatus('⚠️ Network error. Please try again.', 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origLabel || '✨ Enhance Photo'; refreshEditButton(); }
    }
  }

  // Build a valid SVG file that wraps the enhanced raster in an <image>
  // element. Not a true vector trace — but combined with the "Vector
  // Style" enhancement chip (which flattens to vector aesthetics) it
  // gives users an SVG file they can drop into design tools.
  function downloadAsSvg() {
    var img = $('pmg-vs-edit-output');
    if (!img || !img.src) return;
    var w = img.naturalWidth || 1024;
    var h = img.naturalHeight || 1024;
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
              '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
              'width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
              '<title>PromptMeGood — Enhanced Image</title>' +
              '<image width="' + w + '" height="' + h + '" xlink:href="' + img.src + '"/>' +
              '</svg>';
    var blob = new Blob([svg], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'enhanced.svg';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  // Generic drop-zone wirer — used for Reverse Engine button and the
  // Image Workshop dropzone. Folder upload note: HTML5 drag-drop yields
  // a flat FileList for folder drops on Chromium (recursively expanded),
  // so dropping a folder of photos onto either zone works for the FIRST
  // image; multi-file batch is a follow-up feature.
  function wireDropZone(zoneId, onFile) {
    var zone = document.getElementById(zoneId);
    if (!zone || zone.dataset.dropWired) return;
    zone.dataset.dropWired = '1';
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zone.classList.add('is-drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zone.classList.remove('is-drag-over');
      });
    });
    zone.addEventListener('drop', function (e) {
      var files = (e.dataTransfer && e.dataTransfer.files) || [];
      // First image wins (folder drop yields flat list on Chromium).
      var first = null;
      for (var i = 0; i < files.length; i++) {
        if (/^image\//.test(files[i].type)) { first = files[i]; break; }
      }
      if (first) onFile(first);
    });
  }

  // ---------- Reverse Engine ----------
  function pickReverseImage() {
    var input = $('pmg-vs-reverse-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  /* re-3: pending decoded analysis awaiting user accept/discard. Cleared
     on Discard or after Use this prompt successfully injects + jumps. */
  var _pendingReverse = null;
  /* re-3 race-guard: monotonic request token. Only the most-recent
     handleReverseImage() call is allowed to mutate preview/state/status.
     Prevents a slow first analyze from overwriting a fresh second one
     (or resurrecting a discarded preview) when the user re-uploads
     before the first request resolves. */
  var _reverseReqSeq = 0;

  async function handleReverseImage(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setReverseStatus('⚠️ Image is over 10 MB. Please pick a smaller one.', 'err');
      return;
    }
    // Bump the token BEFORE clearing preview / starting fetch so any
    // in-flight prior request becomes stale immediately.
    var myReq = ++_reverseReqSeq;
    // Clear any prior preview so a re-drop doesn't show stale data while
    // we re-analyze.
    hideReversePreview();
    var btn = $('pmg-vs-reverse-engineer-btn');
    if (btn) { btn.disabled = true; btn.dataset.origLabel = btn.textContent; btn.textContent = '🔬 Analyzing image DNA…'; }
    setReverseStatus('🔬 Analyzing image DNA — reading composition, light, palette…', 'info');
    try {
      var fd = new FormData();
      fd.append('image', file, file.name);
      var headers = authHeaders();
      delete headers['Content-Type'];
      var res = await fetch('/api/vision-analyze', { method: 'POST', body: fd, headers: headers });
      var data = await res.json().catch(function () { return {}; });
      // Stale response — a newer upload superseded us, or user
      // discarded. Silently drop without touching DOM/state.
      if (myReq !== _reverseReqSeq) return;
      if (!res.ok || !data.prompt) {
        setReverseStatus('⚠️ ' + (data.error || 'Could not analyze that image.'), 'err');
        return;
      }
      // re-3: stash + show preview instead of silently auto-injecting.
      _pendingReverse = { prompt: data.prompt, suite_settings: data.suite_settings || {} };
      showReversePreview(_pendingReverse);
      // Hide the small status line — the preview card is the new
      // success surface.
      var statusEl = $('pmg-vs-reverse-status');
      if (statusEl) { statusEl.hidden = true; statusEl.textContent = ''; }
    } catch (e) {
      if (myReq !== _reverseReqSeq) return;
      setReverseStatus('⚠️ Network error. Please try again.', 'err');
    } finally {
      // Button reset is safe even when stale — it just restores label.
      if (btn && myReq === _reverseReqSeq) {
        btn.disabled = false;
        btn.textContent = btn.dataset.origLabel || '📸 Reverse Engineer an Image';
      }
    }
  }

  function showReversePreview(payload) {
    var card = $('pmg-vs-reverse-preview');
    var ta   = $('pmg-vs-reverse-preview-text');
    var meta = $('pmg-vs-reverse-preview-meta');
    if (!card || !ta) return;
    ta.value = payload.prompt || '';
    if (meta) {
      var keys = Object.keys(payload.suite_settings || {}).filter(function (k) {
        return String((payload.suite_settings || {})[k] || '').trim();
      });
      meta.textContent = keys.length
        ? '+ ' + keys.length + ' suite preset' + (keys.length === 1 ? '' : 's')
        : '';
    }
    card.hidden = false;
    try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
  }

  function hideReversePreview() {
    var card = $('pmg-vs-reverse-preview');
    var ta   = $('pmg-vs-reverse-preview-text');
    if (card) card.hidden = true;
    if (ta) ta.value = '';
    _pendingReverse = null;
  }

  function discardReversePreview() {
    // re-3 race-guard: bump token so any in-flight analyze response
    // can't resurrect the preview after user explicitly discarded.
    _reverseReqSeq++;
    hideReversePreview();
    setReverseStatus('Discarded. Drop another photo to try again.', 'info');
  }

  function useReversePreview() {
    if (!_pendingReverse) return;
    var ta = $('pmg-vs-image-goal');
    if (ta) {
      ta.value = _pendingReverse.prompt;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    applySuiteSettings(_pendingReverse.suite_settings || {});
    _pendingReverse = null;
    hideReversePreview();
    // ps-1: jump back to Create so the user sees the prefilled goal.
    try { setPhotoSubMode('create'); } catch (_) {}
    setReverseStatus('✓ Prompt loaded into Create New — tweak, build, then Generate.', 'ok');
  }


  function setReverseStatus(msg, kind) {
    var el = $('pmg-vs-reverse-status');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = 'pmg-vs-reverse-status pmg-vs-reverse-status--' + (kind || 'info');
  }

  function applySuiteSettings(settings) {
    var suite = document.getElementById('photo-suite-section')
             || document.getElementById('pmg-photo-suite');
    if (!suite || !settings) return;
    var allPills = suite.querySelectorAll('.pmg-pill, [data-pmg-pill], button[role="option"]');
    if (!allPills.length) return;
    Object.keys(settings).forEach(function (cat) {
      var raw = String(settings[cat] || '').trim();
      if (!raw) return;
      var candidates = raw.split(/,|\u2022|\//).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      candidates.forEach(function (cand) {
        for (var i = 0; i < allPills.length; i++) {
          var p = allPills[i];
          var t = (p.textContent || '').trim().toLowerCase();
          if (!t) continue;
          if (t === cand || t.indexOf(cand) >= 0 || cand.indexOf(t) >= 0) {
            var already = p.getAttribute('aria-pressed') === 'true' || p.classList.contains('is-active') || p.classList.contains('is-selected');
            if (!already) { try { p.click(); } catch (_) {} }
            break;
          }
        }
      });
    });
  }

  // ---------- DNA Card ----------
  async function downloadDnaCard() {
    var img = $('pmg-vs-generated-image');
    if (!img || img.hidden || !img.src) return null;
    var prompt = ($('pmg-vs-image-refined') && $('pmg-vs-image-refined').value) ||
                 ($('pmg-vs-image-goal') && $('pmg-vs-image-goal').value) || '';
    return composeDnaCard(img.src, prompt).then(function (dataUrl) {
      if (!dataUrl) return null;
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'promptmegood-dna-card.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return dataUrl;
    });
  }

  async function shareDnaCard() {
    if (!navigator.share) return;
    var img = $('pmg-vs-generated-image');
    if (!img || img.hidden || !img.src) return;
    var prompt = ($('pmg-vs-image-refined') && $('pmg-vs-image-refined').value) ||
                 ($('pmg-vs-image-goal') && $('pmg-vs-image-goal').value) || '';
    var dataUrl = await composeDnaCard(img.src, prompt);
    if (!dataUrl) return;
    try {
      var blob = await (await fetch(dataUrl)).blob();
      var file = new File([blob], 'promptmegood-dna-card.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My PromptMeGood DNA Card', text: prompt.slice(0, 200) });
      } else {
        await navigator.share({ title: 'My PromptMeGood DNA Card', text: prompt.slice(0, 200) });
      }
    } catch (_) {}
  }

  function composeDnaCard(imgSrc, promptText) {
    /* dna-v2 delegation: when pmg-dna-card.js is loaded (default),
       use the redesigned 1080×1350 card with quality score badge,
       technique chips, and watermark. Falls through to the legacy
       v1 composer below if v2 was killed via ?nodnacard or
       localStorage.pmg_dna_card_disable='1'. */
    try {
      if (window.pmgDnaCardV2 && typeof window.pmgDnaCardV2.composeDnaCardV2 === 'function') {
        return window.pmgDnaCardV2.composeDnaCardV2(imgSrc, promptText);
      }
    } catch (_) {}
    return new Promise(function (resolve) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        var W = 1080, H = 1350, IMG_H = 1080;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.fillStyle = '#0a2420';
        ctx.fillRect(0, 0, W, H);
        var iw = im.naturalWidth, ih = im.naturalHeight;
        var scale = Math.max(W / iw, IMG_H / ih);
        var dw = iw * scale, dh = ih * scale;
        var dx = (W - dw) / 2, dy = (IMG_H - dh) / 2;
        try { ctx.drawImage(im, dx, dy, dw, dh); }
        catch (e) {
          ctx.fillStyle = '#11342f';
          ctx.fillRect(0, 0, W, IMG_H);
          ctx.fillStyle = '#3ee0a0';
          ctx.font = 'bold 28px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('(Image preview unavailable for export)', W / 2, IMG_H / 2);
        }
        ctx.fillStyle = 'rgba(10,36,32,0.78)';
        ctx.fillRect(24, IMG_H - 64, 280, 44);
        ctx.fillStyle = '#3ee0a0';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🧬 PromptMeGood', 40, IMG_H - 34);
        ctx.fillStyle = '#0a2420';
        ctx.fillRect(0, IMG_H, W, H - IMG_H);
        ctx.strokeStyle = '#3ee0a0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, IMG_H); ctx.lineTo(W, IMG_H); ctx.stroke();
        ctx.fillStyle = '#3ee0a0';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('THE PROMPT', 48, IMG_H + 36);
        ctx.fillStyle = '#e8f5f0';
        ctx.font = '20px ui-monospace, "SF Mono", Menlo, monospace';
        wrapText(ctx, (promptText || '').trim() || '(no prompt)', 48, IMG_H + 70, W - 96, 26, 7);
        try { resolve(canvas.toDataURL('image/png')); }
        catch (_) { resolve(composeFallbackDnaCard(promptText)); }
      };
      im.onerror = function () { resolve(composeFallbackDnaCard(promptText)); };
      im.src = imgSrc;
    });
  }

  function composeFallbackDnaCard(promptText) {
    var W = 1080, H = 1350, IMG_H = 1080;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#0a2420';
    ctx.fillRect(0, 0, W, H);
    var grad = ctx.createLinearGradient(0, 0, 0, IMG_H);
    grad.addColorStop(0, '#11342f'); grad.addColorStop(1, '#0a2420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, IMG_H);
    ctx.fillStyle = '#3ee0a0';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧬 PromptMeGood', W / 2, IMG_H / 2 - 30);
    ctx.fillStyle = 'rgba(232,245,240,0.7)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('(Image preview unavailable for export)', W / 2, IMG_H / 2 + 18);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The prompt that built this image is below.', W / 2, IMG_H / 2 + 50);
    ctx.strokeStyle = '#3ee0a0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, IMG_H); ctx.lineTo(W, IMG_H); ctx.stroke();
    ctx.fillStyle = '#3ee0a0';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THE PROMPT', 48, IMG_H + 36);
    ctx.fillStyle = '#e8f5f0';
    ctx.font = '20px ui-monospace, "SF Mono", Menlo, monospace';
    wrapText(ctx, (promptText || '').trim() || '(no prompt)', 48, IMG_H + 70, W - 96, 26, 7);
    try { return canvas.toDataURL('image/png'); } catch (_) { return null; }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = text.split(/\s+/);
    var line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines - 1) {
          var rest = words.slice(i).join(' ');
          while (ctx.measureText(rest + '…').width > maxWidth && rest.length) rest = rest.slice(0, -1);
          lines.push(rest + '…');
          line = '';
          break;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lineHeight);
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var token = (window.PMG_AUTH && window.PMG_AUTH.token) || null;
      if (!token && window.localStorage) token = localStorage.getItem('pmg_supabase_access_token') || null;
      if (token) h['Authorization'] = 'Bearer ' + token;
    } catch (_) {}
    return h;
  }

  function copyTextarea(taId, btnId) {
    var ta = $(taId);
    if (!ta || !navigator.clipboard) return;
    navigator.clipboard.writeText(ta.value).then(function () {
      var b = $(btnId);
      if (!b) return;
      var orig = b.textContent;
      b.textContent = '✓ Copied';
      setTimeout(function () { b.textContent = orig; }, 1400);
    });
  }

  // ---------- Wire delegated event handlers ----------
  function wire() {
    document.addEventListener('click', function (e) {
      // Back-compat: legacy [data-pmg-open-visual-studio] / #imageModeBtn → switch tab
      var legacy = e.target.closest('[data-pmg-open-visual-studio], #pmg-open-visual-studio, .pmg-vs-open');
      if (legacy) {
        e.preventDefault();
        openVisualStudio({ mode: legacy.getAttribute('data-vs-mode') || 'image' });
        return;
      }
      if (e.target.closest('#imageModeBtn')) {
        openVisualStudio({ mode: 'image' });
        return;
      }
      // Inline panel buttons
      if (e.target.closest('#pmg-vs-reverse-engineer-btn'))    { pickReverseImage(); return; }
      // re-3: preview-with-discard buttons.
      if (e.target.closest('#pmg-vs-reverse-use-btn'))         { useReversePreview(); return; }
      if (e.target.closest('#pmg-vs-reverse-discard-btn'))     { discardReversePreview(); return; }
      // Image Workshop (vs-20)
      if (e.target.closest('#pmg-vs-edit-clear'))              { setEditFile(null); return; }
      if (e.target.closest('#pmg-vs-edit-go'))                 { runImageEdit(); return; }
      if (e.target.closest('#pmg-vs-edit-svg'))                { downloadAsSvg(); return; }
      if (e.target.closest('#pmg-vs-edit-redo'))               { runImageEdit(); return; }
      var dz = e.target.closest('#pmg-vs-edit-dropzone');
      if (dz && !e.target.closest('#pmg-vs-edit-clear') && !e.target.closest('.pmg-vs-dropzone-preview img')) {
        var inp = $('pmg-vs-edit-input');
        if (inp) { inp.value = ''; inp.click(); }
        return;
      }
      var chip = e.target.closest('.pmg-vs-edit-chip');
      if (chip) {
        var on = chip.getAttribute('aria-pressed') === 'true';
        chip.setAttribute('aria-pressed', on ? 'false' : 'true');
        refreshEditButton();
        return;
      }
      // Mobile accordion toggle for the Photography Suite — keeps
      // Build My Image Prompt above the fold on ≤768px viewports.
      var accBtn = e.target.closest('#pmg-vs-photo-acc-toggle');
      if (accBtn) {
        var sec = document.getElementById('pmg-vs-photo-accordion');
        if (sec) {
          var open = sec.classList.toggle('is-mobile-open');
          accBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        return;
      }
      // vs-24: Lighting & Environment accordion toggle (real accordion on
      // all viewports — collapsed by default, opens on header tap).
      var lightHdr = e.target.closest('#pmgv3-lighting-acc-toggle');
      if (lightHdr) {
        var lsec = document.getElementById('pmgv3-lighting-accordion');
        if (lsec) {
          var lopen = lsec.classList.toggle('is-open');
          lightHdr.setAttribute('aria-expanded', lopen ? 'true' : 'false');
        }
        return;
      }
      // vs-24: Lighting pill multi-select toggle.
      var lpill = e.target.closest('.pmgv3-lighting-pill');
      if (lpill) {
        var lon = lpill.getAttribute('aria-pressed') === 'true';
        lpill.setAttribute('aria-pressed', lon ? 'false' : 'true');
        return;
      }
      // vs-24: Base Style toggle — exclusive choice between Photographic
      // and Digital. Drives both the style directive and the matched
      // negative-prompt block in buildImagePrompt().
      var styleBtn = e.target.closest('.pmgv3-photo-style-toggle .pmgv3-toggle-btn');
      if (styleBtn) {
        var styleHost = styleBtn.closest('.pmgv3-photo-style-toggle');
        var styleVal = styleBtn.getAttribute('data-style') || 'photographic';
        if (styleHost) {
          styleHost.querySelectorAll('.pmgv3-toggle-btn').forEach(function (b) {
            var on = (b === styleBtn);
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          styleHost.setAttribute('data-pmgv3-base-style', styleVal);
          var ph = document.getElementById('style-hint-photographic');
          var dh = document.getElementById('style-hint-digital');
          if (ph) ph.style.display = (styleVal === 'photographic') ? '' : 'none';
          if (dh) dh.style.display = (styleVal === 'digital')      ? '' : 'none';
        }
        return;
      }
      // mux-2 Advanced Tuning accordion toggle.
      var advHdr = e.target.closest('.pmg-vs-adv-tuning-header');
      if (advHdr) {
        var sec = advHdr.closest('.pmg-vs-adv-tuning');
        if (sec) {
          var open = sec.classList.toggle('is-open');
          advHdr.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        return;
      }
      if (e.target.closest('#pmg-vs-build-image-prompt-btn'))  { buildImagePrompt(); return; }
      if (e.target.closest('#pmg-vs-build-video-prompt-btn'))  { buildVideoPrompt(); return; }
      if (e.target.closest('#pmg-vs-image-generate-btn'))      { generateImage();    return; }
      if (e.target.closest('#pmg-vs-video-generate-btn'))      { generateVideo();    return; }
      if (e.target.closest('#pmg-vs-image-regen'))             { generateImage();    return; }
      if (e.target.closest('#pmg-vs-video-regen'))             { generateVideo();    return; }
      if (e.target.closest('#pmg-vs-download-dna'))            { downloadDnaCard();  return; }
      if (e.target.closest('#pmg-vs-share-dna'))               { shareDnaCard();     return; }
      if (e.target.closest('#pmg-vs-image-copy'))              { copyTextarea('pmg-vs-image-refined', 'pmg-vs-image-copy'); return; }
      if (e.target.closest('#pmg-vs-video-copy'))              { copyTextarea('pmg-vs-video-refined', 'pmg-vs-video-copy'); return; }
      // Sora tuning pill toggle (single-select per group)
      var pill = e.target.closest('.pmg-vs-pill[data-vs-sora-group]');
      if (pill) {
        var grp = pill.getAttribute('data-vs-sora-group');
        document.querySelectorAll('#pmgv3-panel-video .pmg-vs-pill[data-vs-sora-group="' + grp + '"]').forEach(function (sib) {
          sib.setAttribute('aria-pressed', sib === pill ? 'true' : 'false');
        });
        return;
      }
      // Pro Boost toggle (multi-select on/off)
      var boost = e.target.closest('[data-vs-pro-boost]');
      if (boost) {
        var on = boost.getAttribute('aria-pressed') === 'true';
        boost.setAttribute('aria-pressed', on ? 'false' : 'true');
        return;
      }
      // Pro Preset application
      var preset = e.target.closest('[data-vs-pro-preset]');
      if (preset) {
        var scope = preset.getAttribute('data-vs-scope');
        var pid = preset.getAttribute('data-vs-pro-preset');
        var list = scope === 'video' ? VIDEO_PRESETS : PHOTO_PRESETS;
        var match = list.filter(function (p) { return p.id === pid; })[0];
        if (match) applyPreset(scope, match);
        return;
      }
    }, true);

    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'pmg-vs-reverse-input') {
        var f = e.target.files && e.target.files[0];
        if (f) handleReverseImage(f);
      }
      if (e.target && e.target.id === 'pmg-vs-edit-input') {
        var f2 = e.target.files && e.target.files[0];
        if (f2) setEditFile(f2);
      }
      if (e.target && e.target.id === 'pmg-vs-edit-custom') refreshEditButton();
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'pmg-vs-edit-custom') refreshEditButton();
    });
    // Keyboard a11y: dropzones are role=button tabindex=0 — Space/Enter
    // should open the file picker just like a click does.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var dz = e.target && e.target.closest && e.target.closest('#pmg-vs-edit-dropzone');
      if (dz) {
        e.preventDefault();
        var inp = $('pmg-vs-edit-input');
        if (inp) { inp.value = ''; inp.click(); }
      }
    });

    // Wire drop zones whenever they appear in the DOM (panels mount async).
    var dzTicks = 0;
    var dzTimer = setInterval(function () {
      dzTicks++;
      wireDropZone('pmg-vs-edit-dropzone', setEditFile);
      wireDropZone('pmg-vs-reverse-dropzone', handleReverseImage);
      if (dzTicks > 60) clearInterval(dzTimer);
    }, 250);
  }

  // Public API
  window.openVisualStudio        = openVisualStudio;     // back-compat shim → switch tab
  window.mountVisualStudioPanels = mountVisualStudioPanels;
  window.relocatePhotoSuite      = relocatePhotoSuite;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
