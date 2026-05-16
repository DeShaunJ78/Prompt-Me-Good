/* pmg-scroll-hint.js (sh-1)
   ------------------------------------------------------------------
   Subtle "↓ More below" indicator that appears after a prompt is
   generated when there's content below the user's viewport (the post-
   generation row, Run With AI button, follow-up actions). Pulses
   gently to draw the eye, fades out the moment the user scrolls
   within 120px of the bottom, and disappears entirely if the user
   has already scrolled past the threshold.

   Activates only when body.pmg-has-result is present (i.e. there's
   actually generated content worth scrolling for). On the marketing /
   pre-generation states it never mounts.

   Kill switches (standard):
     - URL: ?noscrollhint
     - Per-device: localStorage.pmg_scrollhint_disable = '1'
*/
(function () {
  'use strict';
  if (window.__pmgScrollHintLoaded) return;
  window.__pmgScrollHintLoaded = true;

  try {
    var loc = (window.location && window.location.search) || '';
    if (/[?&]noscrollhint\b/.test(loc)) return;
    if (localStorage.getItem('pmg_scrollhint_disable') === '1') return;
  } catch (e) {}

  var HINT_ID = 'pmg-scroll-hint';
  var STYLE_ID = 'pmg-scroll-hint-style';
  var BOTTOM_THRESHOLD = 120;
  var hintEl = null;
  var rafPending = false;
  var scrollHandler = null;
  var resultObserver = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + HINT_ID + ' {',
      '  position: fixed;',
      '  left: 50%; bottom: 18px;',
      '  transform: translateX(-50%) translateY(8px);',
      '  z-index: 9998;',
      '  display: inline-flex; align-items: center; gap: 8px;',
      '  padding: 9px 16px;',
      '  border-radius: 999px;',
      '  background: color-mix(in srgb, var(--color-bg, #07171c) 85%, transparent);',
      '  backdrop-filter: blur(8px);',
      '  -webkit-backdrop-filter: blur(8px);',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 45%, transparent);',
      '  color: var(--color-primary, #3ee0a0);',
      '  font-size: 13px; font-weight: 600; letter-spacing: 0.01em;',
      '  box-shadow: 0 6px 24px color-mix(in srgb, #000 40%, transparent),',
      '    0 0 18px color-mix(in srgb, var(--color-primary, #3ee0a0) 22%, transparent);',
      '  opacity: 0; pointer-events: none;',
      '  transition: opacity 220ms ease, transform 220ms ease;',
      '  cursor: pointer;',
      '  animation: pmgScrollHintBob 1.8s ease-in-out infinite;',
      '}',
      '#' + HINT_ID + '.is-visible {',
      '  opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto;',
      '}',
      '#' + HINT_ID + ' .pmg-sh-arrow {',
      '  font-size: 14px; line-height: 1;',
      '  animation: pmgScrollHintArrow 1.4s ease-in-out infinite;',
      '}',
      '@keyframes pmgScrollHintBob {',
      '  0%, 100% { box-shadow: 0 6px 24px color-mix(in srgb, #000 40%, transparent),',
      '    0 0 18px color-mix(in srgb, var(--color-primary, #3ee0a0) 22%, transparent); }',
      '  50% { box-shadow: 0 8px 28px color-mix(in srgb, #000 45%, transparent),',
      '    0 0 28px color-mix(in srgb, var(--color-primary, #3ee0a0) 40%, transparent); }',
      '}',
      '@keyframes pmgScrollHintArrow {',
      '  0%, 100% { transform: translateY(0); }',
      '  50% { transform: translateY(3px); }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + HINT_ID + ', #' + HINT_ID + ' .pmg-sh-arrow { animation: none; }',
      '  #' + HINT_ID + ' { transition: opacity 120ms ease; }',
      '}',
      '@media (max-width: 480px) {',
      '  #' + HINT_ID + ' { bottom: 14px; padding: 8px 14px; font-size: 12px; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function ensureHint() {
    if (hintEl && document.body.contains(hintEl)) return hintEl;
    var el = document.createElement('button');
    el.id = HINT_ID;
    el.type = 'button';
    /* Chassis-v3 universal-hide guard. */
    el.setAttribute('data-pmg-overlay-root', '1');
    el.setAttribute('aria-label', 'Scroll down to see more actions');
    el.innerHTML = '<span class="pmg-sh-arrow" aria-hidden="true">\u2193</span><span>More below</span>';
    el.addEventListener('click', function () {
      try {
        var doc = document.documentElement;
        window.scrollTo({ top: doc.scrollHeight, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    });
    document.body.appendChild(el);
    hintEl = el;
    return el;
  }

  function show() {
    ensureStyles();
    var el = ensureHint();
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
  }

  function hide() {
    if (!hintEl) return;
    hintEl.classList.remove('is-visible');
  }

  function update() {
    rafPending = false;
    /* Only show when there's actually a generated result to scroll
       past. Prevents pre-generation marketing/empty states from
       triggering. */
    if (!document.body.classList.contains('pmg-has-result')) {
      hide();
      return;
    }
    var doc = document.documentElement;
    var scrolled = (window.pageYOffset || doc.scrollTop || 0);
    var vh = window.innerHeight || doc.clientHeight;
    var docH = doc.scrollHeight;
    var distFromBottom = docH - (scrolled + vh);
    if (distFromBottom > BOTTOM_THRESHOLD) {
      show();
    } else {
      hide();
    }
  }

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(update);
  }

  function arm() {
    if (scrollHandler) return;
    scrollHandler = onScroll;
    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('resize', scrollHandler, { passive: true });
    update();
  }

  function watchResultClass() {
    /* Wait for body.pmg-has-result to appear, then arm scroll
       listening + check immediately. If it disappears (clear flow),
       hide the hint. */
    if (document.body.classList.contains('pmg-has-result')) {
      arm();
    }
    var mo = new MutationObserver(function () {
      if (document.body.classList.contains('pmg-has-result')) {
        arm();
        update();
      } else {
        hide();
      }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    resultObserver = mo;
  }

  function boot() {
    ensureStyles();
    watchResultClass();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
