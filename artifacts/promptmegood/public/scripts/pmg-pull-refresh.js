(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Only wire on real touch devices. Avoids interfering with desktop trackpads.
  if (!('ontouchstart' in window) && (navigator.maxTouchPoints || 0) < 1) return;

  var THRESHOLD = 70;        // px of pull required to commit a refresh
  var MAX_PULL  = 130;       // visual cap on the indicator translate
  var TRIGGER_TOP = 4;       // scrollTop tolerance — must be at the top
  var EDGE_GUARD  = 24;      // ignore pulls that start far below the top
  var indicator = null;
  var startY = 0;
  var pulling = false;
  var armed   = false;
  var refreshing = false;
  var scrollEl = null;

  function ensureIndicator() {
    if (indicator) return indicator;
    var el = document.createElement('div');
    el.id = 'pmg-ptr';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="pmg-ptr-bubble">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3 12a9 9 0 1 0 3-6.7"></path>' +
          '<path d="M3 4v5h5"></path>' +
        '</svg>' +
      '</div>';
    var style = document.createElement('style');
    style.textContent =
      '#pmg-ptr{position:fixed;top:0;left:50%;transform:translate(-50%,-64px);' +
      'z-index:2147483646;pointer-events:none;transition:transform .18s ease-out,opacity .18s ease-out;opacity:0;}' +
      '#pmg-ptr.is-active{opacity:1;}' +
      '#pmg-ptr.is-snap{transition:transform .28s cubic-bezier(.2,.9,.3,1.3),opacity .2s ease-out;}' +
      '#pmg-ptr .pmg-ptr-bubble{display:flex;align-items:center;justify-content:center;width:44px;height:44px;' +
      'border-radius:50%;background:#0d2b1e;color:#3ee0a0;border:1px solid rgba(62,224,160,.45);' +
      'box-shadow:0 6px 20px rgba(0,0,0,.35);}' +
      '#pmg-ptr.is-armed .pmg-ptr-bubble{background:#3ee0a0;color:#0d2b1e;border-color:#3ee0a0;}' +
      '#pmg-ptr.is-spin svg{animation:pmgPtrSpin .8s linear infinite;}' +
      '@keyframes pmgPtrSpin{to{transform:rotate(360deg);}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
    indicator = el;
    return el;
  }

  function findScrollable(target) {
    var node = target;
    while (node && node !== document.body && node.nodeType === 1) {
      var cs = window.getComputedStyle(node);
      var oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function setIndicator(distance) {
    var el = ensureIndicator();
    var clamped = Math.min(distance, MAX_PULL);
    // 0 -> -64 (hidden above), THRESHOLD -> 32 (peek), MAX -> 60
    var ty = -64 + Math.min(clamped, MAX_PULL) * 0.95;
    el.style.transform = 'translate(-50%, ' + ty + 'px)';
    el.classList.add('is-active');
    el.classList.toggle('is-armed', distance >= THRESHOLD);
    var bubble = el.firstElementChild;
    if (bubble) {
      var rot = Math.min(distance / THRESHOLD, 1) * 360;
      bubble.style.transform = 'rotate(' + rot + 'deg)';
    }
  }

  function resetIndicator(snap) {
    var el = ensureIndicator();
    if (snap) el.classList.add('is-snap');
    el.classList.remove('is-armed', 'is-active', 'is-spin');
    el.style.transform = 'translate(-50%, -64px)';
    var bubble = el.firstElementChild;
    if (bubble) bubble.style.transform = '';
    setTimeout(function () { el.classList.remove('is-snap'); }, 320);
  }

  function commitRefresh() {
    if (refreshing) return;
    refreshing = true;
    var el = ensureIndicator();
    el.classList.add('is-active', 'is-spin');
    el.style.transform = 'translate(-50%, 28px)';
    var bubble = el.firstElementChild;
    if (bubble) bubble.style.transform = '';
    // Small delay so users see the spinner before the white reload flash.
    setTimeout(function () { window.location.reload(); }, 220);
  }

  document.addEventListener('touchstart', function (e) {
    if (refreshing) return;
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    scrollEl = findScrollable(e.target);
    var top = scrollEl.scrollTop || 0;
    // Don't arm if the user starts the gesture while already scrolled down.
    if (top > TRIGGER_TOP) { pulling = false; return; }
    // Don't hijack pulls that begin near the bottom dock / inputs.
    if (t.clientY > window.innerHeight - 120) { pulling = false; return; }
    if (t.clientY > EDGE_GUARD * 6) {
      // allow gestures from anywhere in the upper region; only block
      // if user starts from very bottom (handled above).
    }
    startY = t.clientY;
    pulling = true;
    armed = false;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!pulling || refreshing) return;
    var t = e.touches[0];
    var dy = t.clientY - startY;
    if (dy <= 0) {
      // Upward swipe — bail and let normal scrolling resume.
      if (armed) { resetIndicator(true); armed = false; }
      pulling = false;
      return;
    }
    // Re-check we're still at scroll-top (in case some inner el scrolled).
    if (scrollEl && (scrollEl.scrollTop || 0) > TRIGGER_TOP) {
      if (armed) { resetIndicator(true); armed = false; }
      pulling = false;
      return;
    }
    if (dy < 8) return;
    // Apply rubber-band damping so the gesture feels native.
    var damped = Math.pow(dy, 0.85);
    armed = true;
    setIndicator(damped);
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  function endTouch() {
    if (!pulling || refreshing) { pulling = false; return; }
    var el = ensureIndicator();
    var armedForRefresh = el.classList.contains('is-armed');
    pulling = false;
    if (armedForRefresh) {
      commitRefresh();
    } else {
      resetIndicator(true);
    }
  }
  document.addEventListener('touchend', endTouch, { passive: true });
  document.addEventListener('touchcancel', endTouch, { passive: true });
})();
