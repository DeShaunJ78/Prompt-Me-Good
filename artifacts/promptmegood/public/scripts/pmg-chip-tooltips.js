/* ====================================================================
   pmg-chip-tooltips.js (cti-1)
   --------------------------------------------------------------------
   Plain-English outcome tooltips for every Photography Suite pill.
   104 entries keyed by exact pill text.

   Behavior:
     - Desktop (hover-capable): tooltip appears on hover via CSS.
     - Touch (no hover):        tooltip toggles on tap; auto-dismiss
                                after 4s, or sooner if the user taps
                                outside the suite, or taps a different
                                chip (which becomes the new pinned tip).
     - Pill click still toggles selection — the tooltip layer never
       preventDefaults, it just decorates.

   Mount:
     - Subscribes to pmgMountBus when available, else uses a scoped
       MutationObserver on #pmg-photo-suite (auto-disconnects after
       60s of no new pills).
     - apply() is idempotent — pills already decorated are skipped.

   Disable:
     - URL:   ?notooltips
     - Local: localStorage.pmg_chip_tooltips_disable = '1'

   API: window.pmgChipTooltips.{ apply, refresh, dismiss, getTip }
   ================================================================== */
(function () {
  'use strict';

  try {
    var qs = new URLSearchParams(location.search);
    if (qs.has('notooltips')) return;
    if (localStorage.getItem('pmg_chip_tooltips_disable') === '1') return;
  } catch (_) {}

  /* ---- 104 outcome tooltips, copy-locked from Part 5 review ---- */
  var TIPS = {
    /* Style (12) */
    'Cinematic': 'Wide-screen movie-still feel with rich contrast and depth.',
    'Portrait': 'Person front-and-center with a softly blurred background.',
    'Documentary': 'Real, candid moment — like a journalist took it.',
    'Editorial': 'Polished magazine-cover look with confident composition.',
    'Street Photography': 'Spontaneous everyday-life snapshot in a public setting.',
    'Fashion': 'High-end clothing-shoot energy with bold styling.',
    'Landscape': 'Sweeping outdoor scene that emphasizes scale and place.',
    'Surreal': 'Dreamlike, slightly unreal imagery that bends the rules.',
    'Vintage': 'Faded, nostalgic look like a photo from decades ago.',
    'Hyperrealistic': 'Razor-sharp detail that almost looks more real than real.',
    'Black & White': 'Strips out color so light, shadow, and shape carry the mood.',
    'Polaroid': 'Square instant-photo look with washed colors and soft edges.',

    /* Camera & Lens — Focal Length (9) */
    '14mm Ultra-Wide': 'Captures huge environments — feels expansive, almost panoramic.',
    '24mm Wide': 'Roomy view that shows lots of context around the subject.',
    '35mm Wide': 'Natural, slightly wide framing that mirrors how we see.',
    '50mm Standard': 'Looks the way your eye sees — neutral, undistorted.',
    '85mm Portrait': 'Flattering close-in framing that makes faces look their best.',
    '200mm Telephoto': 'Pulls distant subjects close and compresses the background.',
    'Macro': 'Extreme close-up showing tiny details you\u2019d normally miss.',
    'Telephoto': 'Long-reach lens look — distant subjects feel close.',
    'Fisheye': 'Bulging, super-wide view with curved edges for drama.',

    /* Camera & Lens — Camera Body (6) */
    'DSLR': 'Crisp, clean professional-camera look.',
    'Mirrorless': 'Modern pro-camera quality — sharp and color-accurate.',
    'Film Grain': 'Subtle textured grain that adds organic warmth.',
    'Drone Aerial': 'Bird\u2019s-eye view from above — sweeping, cinematic.',
    'GoPro Action': 'First-person action-cam energy with wide framing.',
    'iPhone Snap': 'Casual, quick-snap phone-photo look.',

    /* Aperture (4) */
    'f/1.4 Bokeh': 'Subject pin-sharp, background dissolved into creamy blur.',
    'f/2.8 Soft': 'Subject sharp with a gently softened background.',
    'f/8 Sharp': 'Most of the scene crisp — good for groups and details.',
    'f/16 Deep DOF': 'Everything front-to-back is in focus, like a landscape shot.',

    /* Shutter Speed (3) */
    '1/60 Motion Blur': 'Movement turns into smooth blur — feels alive, in motion.',
    '1/250 Sharp': 'Crisp action — quick movement frozen cleanly.',
    '1/1000 Frozen Action': 'Time stops — splashes, sports, freeze-frame moments.',

    /* ISO (3) */
    'ISO 100 Clean': 'Pure, noise-free image — best in bright light.',
    'ISO 400 Daylight': 'Clean look that works in everyday lighting.',
    'ISO 1600 Low-Light': 'Slightly grainy night-photo energy with mood.',

    /* Film Stock (9) */
    'Full Color': 'Standard rich, accurate color rendering.',
    'Black & White Film': 'Classic monochrome with film texture.',
    'Kodak Portra 400': 'Warm, flattering skin tones — wedding-photo classic.',
    'CineStill 800T': 'Moody nighttime film look with red glow on lights.',
    'Tri-X B&W': 'High-contrast gritty black-and-white documentary feel.',
    'VHS': 'Lo-fi 80s home-video texture with scan lines.',
    '16mm Film': 'Indie-film grain and softness, slightly nostalgic.',
    '35mm Film': 'Cinema-grade film look — rich and timeless.',
    'Digital Clean': 'Crisp modern digital — no grain, no nostalgia.',

    /* Lighting & Mood (17) */
    'Golden Hour': 'Warm honey light just after sunrise or before sunset.',
    'Midday': 'Bright direct daylight — clear, high-energy.',
    'Twilight': 'Soft fading light just after sunset, calm and pretty.',
    'Blue Hour': 'Cool deep-blue sky right before night, glowing city lights.',
    'Studio Softbox': 'Even, flattering pro-studio light with no harsh shadows.',
    'Backlit': 'Light coming from behind — glowing edges, dreamy halo.',
    'Front Lit': 'Light hits the subject head-on — flat, clear, even.',
    'Side Lit': 'Light from one side — sculpted, dramatic shape.',
    'Top Lit': 'Light from above — moody and slightly theatrical.',
    'Natural Window Light': 'Soft daylight through a window — gentle and natural.',
    'Dramatic Shadows': 'Deep, sculpted shadows for moody contrast.',
    'Neon Glow': 'Saturated nightlife colors from neon signs and city light.',
    'Candle Lit': 'Warm, intimate flicker — romantic and cozy.',
    'Overcast Diffused': 'Soft cloudy-day light — flattering and shadow-free.',
    'Moonlit': 'Cool blue night light, quiet and atmospheric.',
    'Harsh Noon': 'Strong direct sun — sharp shadows, summer-bright.',
    'Cinematic Low-Key': 'Mostly shadow with selective light, like a moody movie.',

    /* Composition (17) */
    'Rule Of Thirds': 'Subject placed off-center for natural visual balance.',
    'Centered': 'Subject sits dead-center for symmetry and focus.',
    'Center Weighted': 'Subject centered with breathing room around the edges.',
    'Symmetrical': 'Mirrored arrangement — calm, intentional, balanced.',
    'Headroom': 'Comfortable space above the subject\u2019s head — natural framing.',
    'Negative Space': 'Lots of empty area around subject — minimal and bold.',
    'Frame Within A Frame': 'Doorway, window, or arch frames the subject for depth.',
    'Leading Lines': 'Roads, fences, or rails that guide your eye to the subject.',
    'Dutch Angle': 'Tilted horizon — adds tension and unease.',
    'Bird\u2019s-Eye View': 'Looking straight down from above — map-like overview.',
    'Worm\u2019s-Eye View': 'Looking straight up — subject feels powerful and tall.',
    'Extreme Close-Up': 'Fills the frame with one tiny detail — eyelash, fabric, drop.',
    'Close-Up': 'Tight framing on subject\u2019s head/face or main object.',
    'Medium Shot': 'Subject from waist up — natural conversation distance.',
    'Wide Shot': 'Full subject visible with surrounding environment.',
    'Extreme Wide': 'Subject tiny in a vast scene — emphasizes scale.',
    'Selective Focus': 'Only one part is sharp — everything else gently blurs away.',

    /* Camera Angle (10) */
    'Eye Level': 'Camera at subject\u2019s eye height — natural and relatable.',
    'Low Angle': 'Looking up at subject — makes them feel powerful or larger.',
    'High Angle': 'Looking down at subject — feels softer or smaller.',
    'Hero Angle': 'Slight low angle that makes subject look heroic and confident.',
    'Over-The-Shoulder': 'View from behind one person looking toward another.',
    'Profile Side': 'Subject seen sideways — clean silhouette.',
    'Top-Down Flat Lay': 'Straight-down view of objects on a surface — Instagram-style.',

    /* Color Palette (11) */
    'Warm Tones': 'Reds, oranges, and yellows dominate — cozy and inviting.',
    'Cool Blues': 'Blue and cyan dominate — calm, clean, slightly cold.',
    'Monochrome': 'A single color across the whole image, in varying shades.',
    'Pastel Soft': 'Gentle washed-out colors — light, airy, dreamy.',
    'High Contrast': 'Bold blacks and whites with punchy color separation.',
    'Muted Earth': 'Browns, ochres, and olive tones — natural and grounded.',
    'Neon Saturated': 'Electric, super-vivid colors — pop, party, neon-sign energy.',
    'Sepia': 'Brown-toned vintage finish like an old-time photograph.',
    'Teal & Orange': 'Hollywood color combo — warm skin, cool background.',
    'Forest Greens': 'Deep mossy greens — earthy, lush, organic.',
    'Sunset Reds': 'Rich reds and oranges of evening sky and warm light.',

    /* Aspect Ratio (4) */
    'Square (1:1)': 'Equal sides — Instagram-feed format.',
    'Portrait (3:4)': 'Taller than wide — phone screens, portraits, posters.',
    'Landscape (4:3)': 'Wider than tall — classic photo, slideshow, monitor.',
    'Auto': 'Let the AI pick the best ratio for the scene.'
  };

  /* Bird/Worm and apostrophe variants — pills in GROUPS use the
     escaped ASCII form `Bird\'s-Eye View`. JS string `'\u2019'` is the
     curly apostrophe; the source code uses straight `'`. Map both. */
  TIPS["Bird's-Eye View"] = TIPS['Bird\u2019s-Eye View'];
  TIPS["Worm's-Eye View"] = TIPS['Worm\u2019s-Eye View'];
  TIPS["Macro"]            = TIPS['Macro']; /* duplicate-key noop, kept for parity */

  function getTip(label) {
    if (!label) return '';
    var t = TIPS[label];
    if (t) return t;
    /* Try a normalized lookup: strip leading icon + collapse whitespace. */
    var norm = String(label).replace(/^\s*[\u2700-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2300-\u23FF]+\s*/, '').trim();
    return TIPS[norm] || '';
  }

  /* ---------------- styles ---------------- */
  var STYLE_ID = 'pmg-chip-tooltips-style';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Pill needs to be the positioning context for ::after. The
         existing pmg-ux pill rule does NOT set position; default
         display: inline-flex doesn't establish a containing block,
         so explicitly set position:relative. */
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip] { position: relative; }',

      /* The tooltip itself: positioned above the pill, max-width
         capped so most lines stay single-row, arrow drawn with a
         second pseudo-element below. */
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip]::after {',
      '  content: attr(data-pmg-tip);',
      '  position: absolute;',
      '  bottom: calc(100% + 10px); left: 50%;',
      '  transform: translateX(-50%) translateY(4px);',
      '  background: #0a2420;',
      '  color: #e8f5f0;',
      '  font-size: 12.5px;',
      '  font-weight: 500;',
      '  line-height: 1.4;',
      '  padding: 8px 12px;',
      '  border-radius: 8px;',
      '  border: 1px solid color-mix(in srgb, #3ee0a0 35%, transparent);',
      '  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);',
      '  white-space: normal;',
      '  width: max-content;',
      '  max-width: 280px;',
      '  text-align: center;',
      '  text-transform: none;',
      '  letter-spacing: normal;',
      '  pointer-events: none;',
      '  opacity: 0;',
      '  transition: opacity 140ms ease, transform 140ms ease;',
      '  z-index: 9999;',
      '}',

      /* Down-pointing arrow. */
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip]::before {',
      '  content: "";',
      '  position: absolute;',
      '  bottom: calc(100% + 4px); left: 50%;',
      '  transform: translateX(-50%) translateY(4px);',
      '  width: 0; height: 0;',
      '  border-left: 6px solid transparent;',
      '  border-right: 6px solid transparent;',
      '  border-top: 6px solid #0a2420;',
      '  pointer-events: none;',
      '  opacity: 0;',
      '  transition: opacity 140ms ease, transform 140ms ease;',
      '  z-index: 9999;',
      '}',

      /* The existing pill rule sets `.is-active::before { content: "✓" }`.
         When the pill is active, suppress our arrow pseudo so we don't
         overwrite the checkmark. The tooltip text itself (::after) is
         unaffected. */
      '#pmg-photo-suite .pmg-photo-pill.is-active[data-pmg-tip]::before {',
      '  content: "\u2713";',
      '  position: static;',
      '  transform: none;',
      '  width: auto; height: auto;',
      '  border: 0;',
      '  opacity: 1;',
      '  font-weight: 700;',
      '  color: inherit;',
      '}',

      /* Desktop hover reveal — only on devices with a real hover
         capability so touch screens don't show stuck tooltips on the
         last-tapped chip after the auto-dismiss runs. */
      '@media (hover: hover) {',
      '  #pmg-photo-suite .pmg-photo-pill[data-pmg-tip]:hover::after,',
      '  #pmg-photo-suite .pmg-photo-pill[data-pmg-tip]:focus-visible::after {',
      '    opacity: 1;',
      '    transform: translateX(-50%) translateY(0);',
      '  }',
      '  #pmg-photo-suite .pmg-photo-pill[data-pmg-tip]:not(.is-active):hover::before,',
      '  #pmg-photo-suite .pmg-photo-pill[data-pmg-tip]:not(.is-active):focus-visible::before {',
      '    opacity: 1;',
      '    transform: translateX(-50%) translateY(0);',
      '  }',
      '}',

      /* Touch / .is-tip-open — explicit class wins on any device.
         Used by the tap-to-toggle handler below. */
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip].is-tip-open::after {',
      '  opacity: 1;',
      '  transform: translateX(-50%) translateY(0);',
      '}',
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip].is-tip-open:not(.is-active)::before {',
      '  opacity: 1;',
      '  transform: translateX(-50%) translateY(0);',
      '}',

      /* Edge handling: pills near the left/right edge of a row would
         overflow the container with translateX(-50%). Two helper
         classes the JS sets when a tooltip is opened. */
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip].pmg-tip-align-left::after { left: 0; transform: translateX(0) translateY(0); }',
      '#pmg-photo-suite .pmg-photo-pill[data-pmg-tip].pmg-tip-align-right::after { left: auto; right: 0; transform: translateX(0) translateY(0); }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------------- application ---------------- */
  var APPLIED_FLAG = 'data-pmg-tip-bound';

  function pillLabel(pill) {
    /* The pill text content includes the leading checkmark when active
       (via ::before in the existing CSS). Use textContent and strip a
       leading "✓ " just in case. Pills also have no children other
       than the text, so this is safe. */
    var t = (pill.textContent || '').trim();
    return t.replace(/^\u2713\s*/, '').trim();
  }

  function apply(root) {
    var scope = root || document;
    var pills = scope.querySelectorAll('#pmg-photo-suite .pmg-photo-pill');
    var n = 0;
    pills.forEach(function (p) {
      if (p.getAttribute(APPLIED_FLAG) === '1') return;
      var label = pillLabel(p);
      var tip = getTip(label);
      if (!tip) return;
      p.setAttribute('data-pmg-tip', tip);
      p.setAttribute('title', tip);          /* a11y baseline + iOS long-press */
      p.setAttribute('aria-label', label + '. ' + tip);
      p.setAttribute(APPLIED_FLAG, '1');
      n++;
    });
    if (n) { try { console.log('[pmg-chip-tooltips] decorated', n, 'pills'); } catch (_) {} }
    return n;
  }

  function refresh() { return apply(document); }

  /* ---------------- tap-to-toggle (touch) ---------------- */
  var openPill = null;
  var openTimer = null;
  var DISMISS_MS = 4000;

  function dismiss() {
    if (openPill) {
      openPill.classList.remove('is-tip-open', 'pmg-tip-align-left', 'pmg-tip-align-right');
      openPill = null;
    }
    if (openTimer) { clearTimeout(openTimer); openTimer = null; }
  }

  function alignTooltip(pill) {
    /* If the would-be tooltip extends past the viewport, snap left or
       right. Use bounding rect of the pill to estimate. Tooltip max
       width is 280px; account for that on each side. */
    var rect = pill.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var center = rect.left + rect.width / 2;
    if (center - 140 < 8) {
      pill.classList.add('pmg-tip-align-left');
    } else if (center + 140 > vw - 8) {
      pill.classList.add('pmg-tip-align-right');
    }
  }

  function pinTooltip(pill) {
    if (openPill && openPill !== pill) dismiss();
    pill.classList.add('is-tip-open');
    alignTooltip(pill);
    openPill = pill;
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(dismiss, DISMISS_MS);
  }

  function isTouchDevice() {
    try { return window.matchMedia('(hover: none)').matches; }
    catch (_) { return false; }
  }

  function bindTapToToggle() {
    if (!isTouchDevice()) return;
    /* Delegate at document level so dynamically rendered pills work
       without rebinding. Bound once, idempotent via a guard flag. */
    if (document.documentElement.getAttribute('data-pmg-cti-bound') === '1') return;
    document.documentElement.setAttribute('data-pmg-cti-bound', '1');

    document.addEventListener('click', function (e) {
      var pill = e.target.closest && e.target.closest('#pmg-photo-suite .pmg-photo-pill[data-pmg-tip]');
      if (pill) {
        /* Show the tooltip alongside the existing select toggle —
           we never preventDefault, so pmg-ux's pill click handler
           still runs and the chip still selects/deselects normally. */
        pinTooltip(pill);
        return;
      }
      /* Tap outside the suite hides the open tip. */
      if (openPill && !(e.target.closest && e.target.closest('#pmg-photo-suite'))) {
        dismiss();
      }
    }, false);

    /* Esc closes. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPill) dismiss();
    });
  }

  /* ---------------- mount ---------------- */
  function mount() {
    injectStyles();
    apply(document);
    bindTapToToggle();
  }

  function watch() {
    /* Photo Suite is async-rendered + re-renders on preset apply /
       Surprise Me / saved-combo apply. Re-scan on body mutations
       for ~60s after boot, then disconnect. */
    var attempts = 0;
    var maxAttempts = 120; /* ~60s at 500ms */
    var iv = setInterval(function () {
      attempts++;
      apply(document);
      if (attempts >= maxAttempts) clearInterval(iv);
    }, 500);

    /* Also subscribe to mount-bus when available for instant
       coverage of new pills as panels mount. */
    try {
      if (window.pmgMountBus && typeof window.pmgMountBus.subscribe === 'function' && window.pmgMountBus.isActive()) {
        window.pmgMountBus.subscribe(function () { apply(document); });
      }
    } catch (_) {}

    /* Scoped MutationObserver on the suite container once it exists. */
    function attachSuiteObserver() {
      var suite = document.getElementById('pmg-photo-suite');
      if (!suite) { setTimeout(attachSuiteObserver, 250); return; }
      try {
        var mo = new MutationObserver(function () { apply(suite); });
        mo.observe(suite, { childList: true, subtree: true });
      } catch (_) {}
    }
    attachSuiteObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(); watch(); });
  } else {
    mount(); watch();
  }

  window.pmgChipTooltips = {
    apply: apply,
    refresh: refresh,
    dismiss: dismiss,
    getTip: getTip
  };

  try { console.log('[pmg-chip-tooltips] ready (cti-1)'); } catch (_) {}
})();
