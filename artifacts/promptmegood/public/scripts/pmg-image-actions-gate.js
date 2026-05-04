/* =====================================================================
 * pmg-image-actions-gate.js — Image-dependent action gating
 * ---------------------------------------------------------------------
 * Some action buttons inside #imageResultSection are only meaningful
 * once the user has actually generated (or upscaled) an image. Before
 * an image exists they used to look fully active, which let users
 * click them and get nothing back.
 *
 * This script:
 *   - Tracks whether #imageResultWrap currently contains a real <img>
 *     with a non-empty src.
 *   - Toggles `disabled` + `aria-disabled` on four buttons:
 *       #pmg-send-to-image-main   (Send To Midjourney)
 *       #pmg-send-to-image-caret  (caret next to it)
 *       .pmg-use-as-ref-btn       (Use As Reference)
 *       #pmg-imgx-variations-btn  (Generate 4 Variations)
 *   - Adds a `pmg-img-action-locked` class for the visual softening
 *     (opacity + grayscale + not-allowed cursor).
 *   - Adds a single capture-phase click guard so any click handler
 *     attached to those buttons (now or later) is blocked while the
 *     button is locked.
 *   - Mounts a small helper line just above the action row that reads
 *     "Generate an image first to unlock these actions." while locked.
 *
 * Touch-point isolation: this file does NOT modify any other prompt
 * flow, hero, layout, tour, or pricing logic. It only observes the
 * existing image result DOM and toggles attributes/classes.
 * ================================================================== */

(function () {
  'use strict';

  var STYLE_ID  = 'pmg-img-actions-gate-styles';
  var HELPER_ID = 'pmg-img-actions-disabled-help';
  var LOCK_CLASS = 'pmg-img-action-locked';

  /* Buttons that require a real image before they're useful. */
  var GATED_SELECTOR = [
    '#pmg-send-to-image-main',
    '#pmg-send-to-image-caret',
    '.pmg-use-as-ref-btn',
    '#pmg-imgx-variations-btn'
  ].join(', ');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Visual softening for any locked button, regardless of which
         component originally styled it. !important is needed because
         the source styles (.pmg-imgx-btn, .btn-secondary, the split
         button shell) all set their own background / opacity. */
      '.' + LOCK_CLASS + ' {',
      '  opacity: 0.45 !important;',
      '  cursor: not-allowed !important;',
      '  filter: grayscale(0.4);',
      '  box-shadow: none !important;',
      '}',
      '.' + LOCK_CLASS + ':hover {',
      '  transform: none !important;',
      '  background: inherit;',
      '}',

      /* Small helper line shown above the actions row while locked. */
      '#' + HELPER_ID + ' {',
      '  margin: 4px 0 8px;',
      '  padding: 0;',
      '  font-size: 12px;',
      '  line-height: 1.4;',
      '  color: var(--color-text-muted, #5f6b75);',
      '  font-style: italic;',
      '}',
      '#' + HELPER_ID + '[hidden] { display: none !important; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function hasImage() {
    var img = document.querySelector('#imageResultWrap img');
    if (!img) return false;
    var src = img.getAttribute('src') || '';
    return src.length > 0;
  }

  function ensureHelper() {
    var existing = document.getElementById(HELPER_ID);
    if (existing) return existing;
    var actions = document.querySelector('#imageResultSection .image-result-actions');
    if (!actions || !actions.parentNode) return null;
    var help = document.createElement('p');
    help.id = HELPER_ID;
    help.setAttribute('role', 'note');
    help.textContent = 'Generate an image first to unlock these actions.';
    actions.parentNode.insertBefore(help, actions);
    return help;
  }

  function applyState() {
    var ready = hasImage();
    var btns = document.querySelectorAll(GATED_SELECTOR);
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (ready) {
        /* Drop our visual lock unconditionally. */
        if (b.classList.contains(LOCK_CLASS)) {
          b.classList.remove(LOCK_CLASS);
        }
        /* Only restore attributes WE set. The two markers are tracked
           independently so a button that was already aria-disabled by
           another component (but had its `disabled` attr added by us)
           is restored cleanly without clobbering the other component's
           aria state. */
        if (b.dataset.pmgImgGatedDisabled === '1') {
          try { b.removeAttribute('disabled'); } catch (_) {}
          delete b.dataset.pmgImgGatedDisabled;
        }
        if (b.dataset.pmgImgGatedAria === '1') {
          b.setAttribute('aria-disabled', 'false');
          delete b.dataset.pmgImgGatedAria;
        }
      } else {
        b.classList.add(LOCK_CLASS);
        /* Claim ownership of `disabled` only if it wasn't already set
           by another component. If another component owns the disabled
           state, we leave it alone — when they release it we'll re-add
           ourselves on the next applyState() pass (the MutationObserver
           fires on attribute changes too). */
        if (!b.hasAttribute('disabled')) {
          try { b.setAttribute('disabled', ''); } catch (_) {}
          b.dataset.pmgImgGatedDisabled = '1';
        }
        /* Same ownership model for aria-disabled. */
        if (b.getAttribute('aria-disabled') !== 'true') {
          b.setAttribute('aria-disabled', 'true');
          b.dataset.pmgImgGatedAria = '1';
        }
      }
    }

    var help = ensureHelper();
    if (help) help.hidden = ready;
  }

  /* Capture-phase click guard: stops any handler — including the ones
     attached directly via addEventListener in pmg-send-to.js,
     pmg-image-extras.js, and pmg-ux.js — from running while a button
     is locked. Browsers already swallow click events on disabled
     <button> elements, but defending in capture phase covers (a) any
     case where another script momentarily clears the attribute, and
     (b) the .pmg-use-as-ref-btn which is a <button> but might be
     swapped out and re-attached. */
  function guardClick(e) {
    var t = e.target && e.target.closest && e.target.closest(GATED_SELECTOR);
    if (!t) return;
    var locked = t.classList.contains(LOCK_CLASS) ||
                 t.getAttribute('aria-disabled') === 'true' ||
                 t.hasAttribute('disabled');
    if (!locked) return;
    /* Only block when WE are the source of the lock. If some other
       code disabled the button (e.g. setActionsBusy mid-fetch), let
       it resolve normally — we don't want to suppress legitimate
       loading states. We detect "our" lock via the marker class. */
    if (!t.classList.contains(LOCK_CLASS)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }

  function init() {
    injectStyles();
    applyState();

    /* Watch the body for: (1) the buttons being mounted late by their
       respective scripts, (2) the <img> being added/removed from
       #imageResultWrap, (3) the src attribute changing on that img,
       (4) other components toggling disabled / aria-disabled on the
       gated buttons (e.g. setActionsBusy in pmg-image-extras.js).
       The applyState() pass is cheap and idempotent so reconciling on
       every relevant attribute change is safe. */
    try {
      var obs = new MutationObserver(function () { applyState(); });
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'disabled', 'aria-disabled']
      });
    } catch (_) { /* environments without MutationObserver: oh well */ }

    /* Capture-phase listener on the document so it runs before any
       handler the gated buttons attached themselves. */
    document.addEventListener('click', guardClick, true);

    /* Periodic re-check for the first ~10s to catch any race where
       buttons are mounted by retry timers in their owner scripts. */
    var t0 = Date.now();
    var iv = setInterval(function () {
      applyState();
      if (Date.now() - t0 > 10000) clearInterval(iv);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Tiny debug API. */
  window.__pmgImgActionsGate = {
    refresh: function () { applyState(); },
    hasImage: hasImage
  };
})();
