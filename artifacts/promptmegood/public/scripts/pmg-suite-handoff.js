/* =============================================================
 * pmg-suite-handoff.js  (Task #111)
 *
 * Hand off image-mode users to the Photography Suite after they
 * generate an image (or even just a prompt). Strict additive — no
 * backend, no rewrites of the existing build pipeline.
 *
 * Three pieces:
 *   1. HANDOFF CARD — mounted directly after .image-result-actions
 *      inside #imageResultSection. Headline "Take this photo
 *      further." with sub copy and primary CTA "Open Photography
 *      Suite →". The card has two states:
 *        a) ENABLED  — an image is rendered. CTA routes to the
 *           Suite, expands the first group, pulses the section,
 *           and hydrates the Suite with the user's prompt + the
 *           most-recently-generated image URL.
 *        b) DISABLED — only a prompt has been generated (no image
 *           yet). Swapped copy: "Generate an image first to open
 *           it in the Suite". No navigation, no gating modal.
 *
 *   2. HYDRATION — exposes window.__pmgSuiteHydration with the
 *      latest { prompt, imageUrl, at } payload, AND mounts a
 *      visible reference chip inside the Suite header so the
 *      user knows what they're refining. The Suite's own build
 *      pipeline is untouched; downstream features can read this
 *      payload without any wiring change here.
 *
 *   3. ENTRY-POINT CUE — a single short line under the workspace
 *      mode switch ("After your image, refine it in the
 *      Photography Suite for a richer shot.") so users who enter
 *      image-first see the Suite as the natural next step.
 *
 * Disable hatches:
 *   ?nosuitehandoff
 *   localStorage.pmg_suite_handoff_disable = '1'
 *   localStorage.pmg_disable               = '1'
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgSuiteHandoffLoaded) return;
  window.__pmgSuiteHandoffLoaded = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (/[?&]nosuitehandoff\b/.test(qs)) return;
    if (localStorage.getItem('pmg_suite_handoff_disable') === '1') return;
    if (localStorage.getItem('pmg_disable') === '1') return;
  } catch (_) {}

  var SCRIPT_VERSION = 'task111-1';

  var CARD_ID    = 'pmg-suite-handoff-card';
  var CTA_ID     = 'pmg-suite-handoff-cta';
  var REF_ID     = 'pmg-suite-hydration-ref';
  var CUE_ID     = 'pmg-suite-handoff-cue';
  var STYLE_ID   = 'pmg-suite-handoff-style';
  var SECTION_ID = 'photo-suite-section';
  var SUITE_ID   = 'pmg-photo-suite';

  function $id(id) { return document.getElementById(id); }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) { return false; }
  }

  /* -------- Styles -------- */
  function injectStyles() {
    if ($id(STYLE_ID)) return;
    var css = [
      '#' + CARD_ID + ' {',
      '  margin-top: 16px; padding: 16px;',
      '  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border, #e3e3e7));',
      '  border-radius: var(--radius-lg, 12px);',
      '  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface, #fff));',
      '  display: flex; flex-direction: column; gap: 8px;',
      '}',
      '#' + CARD_ID + '[hidden] { display: none !important; }',
      '#' + CARD_ID + ' .pmg-suite-handoff-head {',
      '  font-size: var(--text-base, 16px); font-weight: 700;',
      '  color: var(--color-text, #1d2a32); line-height: 1.3;',
      '}',
      '#' + CARD_ID + ' .pmg-suite-handoff-sub {',
      '  font-size: var(--text-sm, 14px);',
      '  color: var(--color-text-muted, #5f6b75); line-height: 1.4;',
      '}',
      '#' + CTA_ID + ' {',
      '  appearance: none; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  gap: 6px; padding: 12px 20px; min-height: 44px;',
      '  border: 0; border-radius: var(--radius-md, 8px);',
      '  background: var(--color-primary); color: var(--color-text-inverse, #fff);',
      '  font-size: var(--text-sm, 14px); font-weight: 700;',
      '  align-self: flex-start;',
      '  transition: background 160ms ease, transform 120ms ease;',
      '}',
      '#' + CTA_ID + ':hover:not([aria-disabled="true"]) {',
      '  background: color-mix(in srgb, var(--color-primary) 90%, #000);',
      '  transform: translateY(-1px);',
      '}',
      '#' + CTA_ID + ':focus-visible {',
      '  outline: 2px solid var(--color-primary); outline-offset: 2px;',
      '}',
      '#' + CTA_ID + '[aria-disabled="true"] {',
      '  background: var(--color-surface-2, #f1f3f5);',
      '  color: var(--color-text-muted, #5f6b75);',
      '  cursor: not-allowed;',
      '}',
      /* Mobile-first: full-width card and CTA on ≤640px. */
      '@media (max-width: 640px) {',
      '  #' + CARD_ID + ' { padding: 16px; }',
      '  #' + CTA_ID + ' { width: 100%; align-self: stretch; }',
      '}',

      /* Hydration reference chip inside the Suite header. */
      '#' + REF_ID + ' {',
      '  display: flex; align-items: center; gap: 10px;',
      '  margin: 0 0 12px; padding: 10px 12px;',
      '  border: 1px solid var(--color-border, #e3e3e7);',
      '  border-radius: var(--radius-md, 8px);',
      '  background: var(--color-surface-2, #f7f8f9);',
      '  font-size: var(--text-xs, 12px);',
      '  color: var(--color-text-muted, #5f6b75);',
      '}',
      '#' + REF_ID + ' img {',
      '  width: 36px; height: 36px; object-fit: cover;',
      '  border-radius: 6px; flex: 0 0 auto;',
      '}',
      '#' + REF_ID + ' .pmg-suite-hydration-text {',
      '  flex: 1 1 auto; min-width: 0;',
      '  overflow: hidden; text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '#' + REF_ID + ' .pmg-suite-hydration-label {',
      '  font-weight: 700; color: var(--color-text, #1d2a32);',
      '  margin-right: 6px;',
      '}',

      /* Section pulse — 600ms one-shot subtle highlight. */
      '@keyframes pmgSuiteHandoffPulse {',
      '  0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-primary) 35%, transparent); }',
      '  60%  { box-shadow: 0 0 0 10px color-mix(in srgb, var(--color-primary) 0%,  transparent); }',
      '  100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-primary) 0%,  transparent); }',
      '}',
      '#' + SECTION_ID + '.pmg-suite-handoff-pulse {',
      '  animation: pmgSuiteHandoffPulse 600ms ease-out 1;',
      '  border-radius: var(--radius-lg, 12px);',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + SECTION_ID + '.pmg-suite-handoff-pulse { animation: none; }',
      '  #' + CTA_ID + ':hover { transform: none; }',
      '}',

      /* Inline entry-point cue near #imageModeBtn. */
      '#' + CUE_ID + ' {',
      '  display: block; margin: 6px 0 0;',
      '  font-size: var(--text-xs, 12px);',
      '  color: var(--color-text-muted, #5f6b75);',
      '  line-height: 1.4;',
      '}',
      '#' + CUE_ID + ' strong { color: var(--color-text, #1d2a32); font-weight: 700; }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* -------- Card mount + state -------- */
  function imageIsReady() {
    var img = document.querySelector('#imageResultWrap img');
    if (!img) return false;
    /* Some flows insert the <img> empty-src first; treat that as
       not-yet-ready so the disabled state stays accurate. */
    var src = img.getAttribute('src');
    return !!(src && src.length > 0);
  }
  function currentImageUrl() {
    var img = document.querySelector('#imageResultWrap img');
    if (!img) return '';
    return img.getAttribute('src') || '';
  }
  function currentPrompt() {
    var goal = $id('goal');
    var v = (goal && typeof goal.value === 'string') ? goal.value.trim() : '';
    return v;
  }

  function buildCard() {
    var card = document.createElement('div');
    card.id = CARD_ID;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Photography Suite handoff');

    var head = document.createElement('div');
    head.className = 'pmg-suite-handoff-head';
    head.id = CARD_ID + '-head';
    card.appendChild(head);

    var sub = document.createElement('div');
    sub.className = 'pmg-suite-handoff-sub';
    sub.id = CARD_ID + '-sub';
    card.appendChild(sub);

    var cta = document.createElement('button');
    cta.type = 'button';
    cta.id = CTA_ID;
    cta.className = 'pmg-suite-handoff-btn';
    cta.addEventListener('click', onCtaClick);
    card.appendChild(cta);

    return card;
  }

  function ensureCard() {
    if ($id(CARD_ID)) return $id(CARD_ID);
    var actions = document.querySelector('#imageResultSection .image-result-actions');
    if (!actions || !actions.parentNode) return null;
    var card = buildCard();
    /* Insert directly after the actions row. */
    if (actions.nextSibling) {
      actions.parentNode.insertBefore(card, actions.nextSibling);
    } else {
      actions.parentNode.appendChild(card);
    }
    return card;
  }

  function refreshCard() {
    var card = ensureCard();
    if (!card) return;
    var ready = imageIsReady();
    var head = $id(CARD_ID + '-head');
    var sub  = $id(CARD_ID + '-sub');
    var cta  = $id(CTA_ID);
    if (head) head.textContent = 'Take this photo further.';
    if (sub) {
      sub.textContent = ready
        ? 'Restyle, restage, or upgrade your shot in the Photography Suite.'
        : 'Generate an image first to open it in the Suite.';
    }
    if (cta) {
      cta.textContent = ready ? 'Open Photography Suite →' : 'Waiting For Your First Image';
      cta.setAttribute('aria-disabled', ready ? 'false' : 'true');
      cta.setAttribute('aria-label',
        ready
          ? 'Open the Photography Suite and refine this image'
          : 'Generate an image first to open it in the Photography Suite'
      );
    }
    /* Card is shown whenever the section itself is shown; the
       parent #imageResultSection [hidden] toggle controls overall
       visibility. So we don't hide the card ourselves. */
  }

  /* -------- Hydration -------- */
  function setHydration(prompt, imageUrl) {
    var payload = { prompt: prompt || '', imageUrl: imageUrl || '', at: Date.now() };
    try { window.__pmgSuiteHydration = payload; } catch (_) {}
    return payload;
  }

  function mountHydrationRef(prompt, imageUrl) {
    var suite = $id(SUITE_ID);
    if (!suite) return false;
    var ref = $id(REF_ID);
    if (!ref) {
      ref = document.createElement('div');
      ref.id = REF_ID;
      ref.setAttribute('role', 'note');
      ref.setAttribute('aria-label', 'Refining your last image');
      /* Mount as the very first child of the Suite so the user
         sees the context above the pill groups. */
      suite.insertBefore(ref, suite.firstChild);
    }
    var snippet = (prompt || '').replace(/\s+/g, ' ').trim();
    if (snippet.length > 80) snippet = snippet.slice(0, 77) + '…';
    var thumb = imageUrl
      ? '<img src="' + escHtml(imageUrl) + '" alt="" />'
      : '';
    var label = imageUrl ? 'Refining:' : 'Building from:';
    var text = snippet || 'your latest prompt';
    ref.innerHTML =
      thumb +
      '<div class="pmg-suite-hydration-text">' +
        '<span class="pmg-suite-hydration-label">' + escHtml(label) + '</span>' +
        '<span class="pmg-suite-hydration-snippet">' + escHtml(text) + '</span>' +
      '</div>';
    return true;
  }

  /* -------- Routing -------- */
  function expandFirstGroup() {
    var head = document.querySelector('#' + SUITE_ID + ' .pmg-photo-group-head');
    if (!head) return;
    var group = head.parentElement;
    if (!group) return;
    if (group.classList.contains('is-collapsed')) {
      try { head.click(); } catch (_) {}
    }
  }

  function pulseSection() {
    var sec = $id(SECTION_ID);
    if (!sec) return;
    if (reducedMotion()) return;
    sec.classList.remove('pmg-suite-handoff-pulse');
    /* Force reflow so the animation re-triggers if pulsed twice. */
    void sec.offsetWidth;
    sec.classList.add('pmg-suite-handoff-pulse');
    setTimeout(function () {
      try { sec.classList.remove('pmg-suite-handoff-pulse'); } catch (_) {}
    }, 700);
  }

  function scrollToSuite() {
    var sec = $id(SECTION_ID) || $id(SUITE_ID);
    if (!sec) return;
    var behavior = (window.PMG_A11Y && typeof window.PMG_A11Y.scrollBehavior === 'function')
      ? window.PMG_A11Y.scrollBehavior()
      : (reducedMotion() ? 'auto' : 'smooth');
    try { sec.scrollIntoView({ behavior: behavior, block: 'start' }); } catch (_) {
      try { sec.scrollIntoView(); } catch (__) {}
    }
  }

  function onCtaClick(ev) {
    var cta = $id(CTA_ID);
    if (cta && cta.getAttribute('aria-disabled') === 'true') {
      if (ev) { try { ev.preventDefault(); } catch (_) {} }
      return;
    }
    handoff();
  }

  function handoff() {
    var prompt = currentPrompt();
    var imageUrl = currentImageUrl();
    setHydration(prompt, imageUrl);
    mountHydrationRef(prompt, imageUrl);
    scrollToSuite();
    /* Defer the expand + pulse a tick so the scroll has started
       before we touch the section. Keeps the visual sequence
       feeling deliberate rather than jumpy. */
    setTimeout(function () {
      expandFirstGroup();
      pulseSection();
    }, 60);
  }

  /* -------- Entry-point cue -------- */
  function mountEntryCue() {
    if ($id(CUE_ID)) return true;
    var btn = $id('imageModeBtn');
    if (!btn || !btn.parentNode || !btn.parentNode.parentNode) return false;
    /* Mount as a sibling to .image-mode-hint (already there) so
       the cue shows even if the hint is removed later. */
    var hint = document.querySelector('.image-mode-hint');
    var anchor = hint || btn.parentNode;
    var cue = document.createElement('p');
    cue.id = CUE_ID;
    cue.innerHTML =
      '<strong>Next step after your image:</strong> ' +
      'refine it in the <strong>Photography Suite</strong> — ' +
      'restyle, restage, or upgrade your shot in a tap.';
    if (anchor.parentNode) {
      if (anchor.nextSibling) {
        anchor.parentNode.insertBefore(cue, anchor.nextSibling);
      } else {
        anchor.parentNode.appendChild(cue);
      }
    }
    return true;
  }

  /* -------- Watchers -------- */
  function watch() {
    if (typeof MutationObserver !== 'function') return;
    var sec = $id('imageResultSection');
    if (sec) {
      try {
        var mo = new MutationObserver(function () { refreshCard(); });
        mo.observe(sec, {
          childList: true, subtree: true,
          attributes: true, attributeFilter: ['style', 'hidden', 'src']
        });
      } catch (_) {}
    }
    if (document.body) {
      try {
        var mo2 = new MutationObserver(function () { refreshCard(); });
        mo2.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {}
    }
  }

  /* -------- Init -------- */
  function init() {
    if (!document.body) return;
    injectStyles();
    ensureCard();
    refreshCard();
    mountEntryCue();
    watch();
    /* Late-mount retries — the Suite is built asynchronously, and
       so is the image result section in some flows. */
    [80, 250, 600, 1500, 3000].forEach(function (ms) {
      setTimeout(function () {
        ensureCard();
        refreshCard();
        mountEntryCue();
      }, ms);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  /* -------- Public API for tests + power users -------- */
  window.__pmgSuiteHandoff = {
    version:        SCRIPT_VERSION,
    handoff:        handoff,
    refresh:        refreshCard,
    cardState:      function () {
      var cta = $id(CTA_ID);
      return {
        mounted: !!$id(CARD_ID),
        ctaMounted: !!cta,
        disabled: !!(cta && cta.getAttribute('aria-disabled') === 'true'),
        cueMounted: !!$id(CUE_ID),
        refMounted: !!$id(REF_ID)
      };
    },
    hydration:      function () { return window.__pmgSuiteHydration || null; },
    _setHydration:  setHydration,
    _mountRef:      mountHydrationRef
  };
})();
