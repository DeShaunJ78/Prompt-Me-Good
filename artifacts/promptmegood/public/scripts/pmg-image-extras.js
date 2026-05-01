/* =============================================================
 * pmg-image-extras.js  (Task #52)
 *
 * Three image-side enhancements layered on top of the existing
 * Image Generator without touching its core handler:
 *
 *   1. "Generate 4 Variations" — fires one /api/image call with
 *      n=4 (server uses gpt-image-1 with quality "low" for speed
 *      and cost), renders a 2x2 thumbnail grid in #imageResultWrap.
 *      Click any thumb to upscale to full size and prime the
 *      existing Download / Compare flow.
 *
 *   2. Before/After Slider — every regeneration captures the
 *      previous image URL into module state. When two URLs exist,
 *      a "↔ Compare With Previous" button mounts a draggable slider
 *      that overlays the new image on the old one (clip-path).
 *      Mouse, touch, and keyboard (←/→) all work. ESC closes.
 *
 *   3. "Use This Style On A New Photo" — keeps the current Photo
 *      Suite pill selection intact, clears #goal, focuses it, and
 *      shows a dismissible banner. Pills persist via existing DOM
 *      .is-active classes — we don't rebuild them.
 *
 * NO existing IDs/handlers are renamed. NO breaking server-shape
 * changes — the /api/image endpoint stays { url, urls, enhancedPrompt }
 * with `url = urls[0]` for back-compat with older callers.
 * ============================================================= */
(function () {
  if (window.__pmgImageExtrasLoaded) return;
  window.__pmgImageExtrasLoaded = true;

  /* Escape hatches for emergency rollback */
  try {
    var p = new URLSearchParams(window.location.search);
    if (p.has('noimageextras')) return;
    if (window.localStorage && localStorage.getItem('pmg_imageextras_disable') === '1') return;
  } catch (_) {}

  var SCRIPT_VERSION = 'task52-1';

  /* ------------------------------------------------------------------
   * Module state
   * ------------------------------------------------------------------ */
  var state = {
    lastImageUrl: null,        /* current full-size image src */
    previousImageUrl: null,    /* what was there before the last regen */
    variantUrls: null,         /* array of N URLs when grid is active */
    sliderOpen: false,
    handoffArmed: false,
    /* Sequence counter so out-of-order regen completions don't clobber
       newer state. Incremented at the start of every wrapped run. */
    runSeq: 0,
    inFlight: 0,
    /* Element to refocus when the slider closes (a11y). */
    sliderInvoker: null,
  };

  /* ------------------------------------------------------------------
   * Inject scoped CSS once
   * ------------------------------------------------------------------ */
  function injectCss() {
    if (document.querySelector('style[data-pmg-image-extras]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-pmg-image-extras', '1');
    s.textContent = [
      /* Action buttons we add to .image-result-actions */
      '.pmg-imgx-btn{display:inline-flex;align-items:center;gap:.4rem;min-height:44px;padding:10px 16px;border-radius:999px;background:var(--color-surface);color:var(--color-text);font-size:.92rem;font-weight:700;border:1.5px solid color-mix(in srgb, var(--color-text) 14%, transparent);cursor:pointer;transition:background .18s ease, border-color .18s ease, transform .18s ease}',
      '.pmg-imgx-btn:hover{background:color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));border-color:color-mix(in srgb, var(--color-primary) 35%, var(--color-border));transform:translateY(-1px)}',
      '.pmg-imgx-btn[hidden]{display:none!important}',
      '.pmg-imgx-btn-primary{background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));border-color:color-mix(in srgb, var(--color-primary) 38%, var(--color-border));color:var(--color-primary)}',
      '.pmg-imgx-btn-primary:hover{background:color-mix(in srgb, var(--color-primary) 18%, var(--color-surface))}',

      /* 2x2 variation grid */
      '.pmg-imgx-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}',
      '.pmg-imgx-grid-item{position:relative;width:100%;aspect-ratio:1;border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;border:2px solid transparent;background:color-mix(in srgb, var(--color-text) 8%, var(--color-surface-2));transition:border-color .18s ease, transform .18s ease}',
      '.pmg-imgx-grid-item:hover{border-color:var(--color-primary);transform:translateY(-2px)}',
      '.pmg-imgx-grid-item:focus-visible{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent)}',
      '.pmg-imgx-grid-item img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pmg-imgx-grid-item-num{position:absolute;top:8px;left:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-size:.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.pmg-imgx-grid-item-hint{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(to top, rgba(0,0,0,.75), transparent);color:#fff;font-size:.78rem;font-weight:600;text-align:center;opacity:0;transition:opacity .18s ease;pointer-events:none}',
      '.pmg-imgx-grid-item:hover .pmg-imgx-grid-item-hint,.pmg-imgx-grid-item:focus-visible .pmg-imgx-grid-item-hint{opacity:1}',
      '.pmg-imgx-grid-skeleton{aspect-ratio:1;border-radius:var(--radius-lg)}',

      /* "Show all variants" link shown after upscale */
      '.pmg-imgx-grid-back{display:inline-flex;align-items:center;gap:.4rem;margin:.5rem auto 0;padding:8px 14px;border-radius:999px;background:transparent;color:var(--color-primary);font-size:.85rem;font-weight:700;border:1.5px solid color-mix(in srgb, var(--color-primary) 32%, transparent);cursor:pointer}',
      '.pmg-imgx-grid-back:hover{background:color-mix(in srgb, var(--color-primary) 8%, transparent)}',

      /* Compare slider */
      '.pmg-imgx-cmp{position:relative;width:100%;aspect-ratio:1;border-radius:var(--radius-lg);overflow:hidden;background:#000;user-select:none;-webkit-user-select:none;touch-action:none;border:1px solid var(--color-border)}',
      '.pmg-imgx-cmp-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
      '.pmg-imgx-cmp-after-wrap{position:absolute;inset:0;overflow:hidden;will-change:clip-path}',
      '.pmg-imgx-cmp-handle{position:absolute;top:0;bottom:0;width:4px;background:#fff;box-shadow:0 0 12px rgba(0,0,0,.5);transform:translateX(-50%);pointer-events:none}',
      '.pmg-imgx-cmp-knob{position:absolute;top:50%;left:50%;width:40px;height:40px;border-radius:50%;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;transform:translate(-50%,-50%);box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:ew-resize;border:none}',
      '.pmg-imgx-cmp-knob:focus-visible{outline:3px solid var(--color-primary);outline-offset:3px}',
      '.pmg-imgx-cmp-label{position:absolute;top:10px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-size:.74rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;pointer-events:none}',
      '.pmg-imgx-cmp-label-before{left:10px}',
      '.pmg-imgx-cmp-label-after{right:10px}',
      '.pmg-imgx-cmp-close{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;cursor:pointer;z-index:5}',
      '.pmg-imgx-cmp-close:hover{background:rgba(0,0,0,.8)}',
      '@media (prefers-reduced-motion: reduce){.pmg-imgx-grid-item{transition:none}.pmg-imgx-grid-item:hover{transform:none}.pmg-imgx-btn{transition:none}.pmg-imgx-btn:hover{transform:none}}',

      /* Handoff banner */
      '.pmg-imgx-handoff{display:flex;align-items:flex-start;gap:.6rem;margin:.75rem auto;padding:.85rem 1rem;background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));border:1.5px solid color-mix(in srgb, var(--color-primary) 32%, var(--color-border));border-radius:14px;width:min(560px,100%);box-sizing:border-box;font-size:.9rem;line-height:1.5}',
      '.pmg-imgx-handoff-icon{flex:0 0 auto;font-size:1.1rem;line-height:1.2}',
      '.pmg-imgx-handoff-body{flex:1 1 auto;min-width:0;color:var(--color-text)}',
      '.pmg-imgx-handoff-body strong{color:var(--color-primary)}',
      '.pmg-imgx-handoff-close{flex:0 0 auto;background:transparent;border:none;color:var(--color-text-muted);cursor:pointer;font-size:1rem;padding:0 4px;border-radius:6px}',
      '.pmg-imgx-handoff-close:hover{color:var(--color-text)}',

      /* Mobile tightening */
      '@media (max-width:520px){.pmg-imgx-grid{gap:8px}.pmg-imgx-cmp-knob{width:34px;height:34px}.pmg-imgx-btn{padding:9px 12px;font-size:.86rem}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------
   * DOM helpers
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function isImageMode() {
    var b = document.body;
    if (!b) return false;
    return b.classList.contains('image-mode') || b.classList.contains('photo-mode-active');
  }

  /* ------------------------------------------------------------------
   * Action buttons in .image-result-actions
   * ------------------------------------------------------------------ */
  function ensureButtons() {
    var actions = document.querySelector('#imageResultSection .image-result-actions');
    if (!actions) return null;
    if (actions.dataset.pmgImgxButtons === '1') return actions;
    actions.dataset.pmgImgxButtons = '1';

    var varBtn = document.createElement('button');
    varBtn.type = 'button';
    varBtn.id = 'pmg-imgx-variations-btn';
    varBtn.className = 'pmg-imgx-btn pmg-imgx-btn-primary';
    varBtn.innerHTML = '<span aria-hidden="true">📐</span> Generate 4 Variations';
    varBtn.title = 'Create four small variants of your prompt — click one to upscale.';
    varBtn.addEventListener('click', onVariationsClick);
    actions.appendChild(varBtn);

    var cmpBtn = document.createElement('button');
    cmpBtn.type = 'button';
    cmpBtn.id = 'pmg-imgx-compare-btn';
    cmpBtn.className = 'pmg-imgx-btn';
    cmpBtn.hidden = true;
    cmpBtn.innerHTML = '<span aria-hidden="true">↔</span> Compare With Previous';
    cmpBtn.title = 'Side-by-side slider against your last image.';
    cmpBtn.addEventListener('click', onCompareClick);
    actions.appendChild(cmpBtn);

    var styleBtn = document.createElement('button');
    styleBtn.type = 'button';
    styleBtn.id = 'pmg-imgx-style-btn';
    styleBtn.className = 'pmg-imgx-btn';
    styleBtn.hidden = true;
    styleBtn.innerHTML = '<span aria-hidden="true">🖼</span> Use This Style On A New Photo';
    styleBtn.title = 'Keep the current style pills, clear the subject, describe a new photo.';
    styleBtn.addEventListener('click', onUseStyleClick);
    actions.appendChild(styleBtn);

    return actions;
  }

  function syncButtonVisibility() {
    var cmp = $('pmg-imgx-compare-btn');
    var style = $('pmg-imgx-style-btn');
    if (cmp) cmp.hidden = !(state.lastImageUrl && state.previousImageUrl);
    if (style) style.hidden = !state.lastImageUrl;
  }

  /* ------------------------------------------------------------------
   * Variations grid
   * ------------------------------------------------------------------ */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function readPromptForGeneration() {
    var goal = $('goal');
    var raw = (goal && goal.value || '').trim();
    return raw;
  }

  function setActionsBusy(busy) {
    var btns = document.querySelectorAll('#imageResultSection .image-result-actions button, #imageResultSection .image-result-actions a');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (busy) {
        b.setAttribute('aria-busy', 'true');
        if (b.tagName === 'BUTTON') b.disabled = true;
      } else {
        b.removeAttribute('aria-busy');
        if (b.tagName === 'BUTTON') b.disabled = false;
      }
    }
  }

  function renderVariationsLoading(wrap) {
    wrap.innerHTML = [
      '<div class="pmg-imgx-grid" role="status" aria-label="Generating 4 variations">',
      '  <div class="pmg-imgx-grid-skeleton pmg-skeleton-shimmer"></div>',
      '  <div class="pmg-imgx-grid-skeleton pmg-skeleton-shimmer"></div>',
      '  <div class="pmg-imgx-grid-skeleton pmg-skeleton-shimmer"></div>',
      '  <div class="pmg-imgx-grid-skeleton pmg-skeleton-shimmer"></div>',
      '</div>'
    ].join('');
  }

  function renderVariationsGrid(wrap, urls) {
    state.variantUrls = urls.slice(0);
    var count = urls.length;
    var html = ['<div class="pmg-imgx-grid" role="list" aria-label="' + count + ' image variation' + (count === 1 ? '' : 's') + ' — click to upscale">'];
    for (var i = 0; i < urls.length; i++) {
      html.push(
        '<button type="button" class="pmg-imgx-grid-item" role="listitem" data-variant-idx="' + i + '" aria-label="Variation ' + (i + 1) + ' — click to upscale">',
        '  <img src="' + escapeHtml(urls[i]) + '" alt="Variation ' + (i + 1) + '" />',
        '  <span class="pmg-imgx-grid-item-num">' + (i + 1) + '</span>',
        '  <span class="pmg-imgx-grid-item-hint">Click to upscale</span>',
        '</button>'
      );
    }
    html.push('</div>');
    wrap.innerHTML = html.join('');
    var items = wrap.querySelectorAll('.pmg-imgx-grid-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-variant-idx'), 10) || 0;
        upscaleVariant(idx);
      });
    }
  }

  function upscaleVariant(idx) {
    if (!state.variantUrls || !state.variantUrls[idx]) return;
    var url = state.variantUrls[idx];
    var wrap = $('imageResultWrap');
    if (!wrap) return;
    /* Capture the variant we leave behind as the "previous" image so
       Compare-With-Previous works between variants too. */
    if (state.lastImageUrl && state.lastImageUrl !== url) {
      state.previousImageUrl = state.lastImageUrl;
    }
    state.lastImageUrl = url;
    wrap.innerHTML = '';
    var img = document.createElement('img');
    img.src = url;
    img.alt = 'AI generated image (variation ' + (idx + 1) + ')';
    wrap.appendChild(img);
    /* Add a "Show all variants" link so the user can re-enter the grid
       without having to re-pay for another /api/image n=4 call. */
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'pmg-imgx-grid-back';
    var n = (state.variantUrls && state.variantUrls.length) || 0;
    back.innerHTML = '<span aria-hidden="true">▦</span> Show All ' + n + ' Variant' + (n === 1 ? '' : 's');
    back.addEventListener('click', function () {
      if (state.variantUrls && state.variantUrls.length) {
        renderVariationsGrid(wrap, state.variantUrls);
      }
    });
    wrap.appendChild(back);
    /* Prime the existing download button. */
    var dl = $('imageDownloadBtn');
    if (dl) {
      dl.href = url;
      dl.style.display = 'inline-flex';
      dl.classList.add('pmg-ready');
    }
    syncButtonVisibility();
  }

  function onVariationsClick() {
    var prompt = readPromptForGeneration();
    if (!prompt) {
      try { alert('Describe the image you want first, then tap Generate 4 Variations.'); } catch (_) {}
      return;
    }
    /* Stash the about-to-be-replaced image as previous. */
    var wrap = $('imageResultWrap');
    if (!wrap) return;
    var existing = wrap.querySelector('img');
    if (existing && existing.src) state.previousImageUrl = existing.src;

    var sec = $('imageResultSection');
    if (sec && sec.hasAttribute('hidden')) sec.removeAttribute('hidden');
    setActionsBusy(true);
    renderVariationsLoading(wrap);
    /* Reuse the existing progress card if present. */
    var progressEl = $('pmg-image-progress');
    if (progressEl) progressEl.classList.add('pmg-show');

    fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, n: 4 })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (resp) {
        if (progressEl) progressEl.classList.remove('pmg-show');
        if (!resp.ok || !resp.data || !Array.isArray(resp.data.urls) || !resp.data.urls.length) {
          var msg = (resp.data && resp.data.error) || 'Could not generate variations. Please try again.';
          wrap.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--color-text-muted)">⚠️ ' + escapeHtml(msg) + '</div>';
          return;
        }
        renderVariationsGrid(wrap, resp.data.urls);
        /* No single "current" image yet — the user picks one. */
        state.lastImageUrl = null;
        var dl = $('imageDownloadBtn');
        if (dl) dl.style.display = 'none';
        syncButtonVisibility();
      })
      .catch(function () {
        if (progressEl) progressEl.classList.remove('pmg-show');
        wrap.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--color-text-muted)">⚠️ Network error. Please try again.</div>';
      })
      .then(function () {
        setActionsBusy(false);
      });
  }

  /* ------------------------------------------------------------------
   * Before/After Slider
   * ------------------------------------------------------------------ */
  function buildSliderEl(beforeUrl, afterUrl) {
    var el = document.createElement('div');
    el.className = 'pmg-imgx-cmp';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Before and after image slider — drag to compare');
    el.innerHTML = [
      '<img class="pmg-imgx-cmp-img pmg-imgx-cmp-before" alt="Previous image" />',
      '<div class="pmg-imgx-cmp-after-wrap" style="clip-path:inset(0 50% 0 0)">',
      '  <img class="pmg-imgx-cmp-img pmg-imgx-cmp-after" alt="New image" />',
      '</div>',
      '<span class="pmg-imgx-cmp-label pmg-imgx-cmp-label-before">Before</span>',
      '<span class="pmg-imgx-cmp-label pmg-imgx-cmp-label-after">After</span>',
      '<div class="pmg-imgx-cmp-handle" style="left:50%"></div>',
      '<button type="button" class="pmg-imgx-cmp-knob" aria-label="Drag to compare. Use left and right arrow keys to move." aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" role="slider" tabindex="0">↔</button>',
      '<button type="button" class="pmg-imgx-cmp-close" aria-label="Close before/after comparison">×</button>'
    ].join('');
    var beforeImg = el.querySelector('.pmg-imgx-cmp-before');
    var afterImg = el.querySelector('.pmg-imgx-cmp-after');
    beforeImg.src = beforeUrl;
    afterImg.src = afterUrl;
    return el;
  }

  function setSliderPosition(el, pct) {
    pct = Math.max(0, Math.min(100, pct));
    var afterWrap = el.querySelector('.pmg-imgx-cmp-after-wrap');
    var handle = el.querySelector('.pmg-imgx-cmp-handle');
    var knob = el.querySelector('.pmg-imgx-cmp-knob');
    if (afterWrap) afterWrap.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    if (handle) handle.style.left = pct + '%';
    if (knob) knob.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function attachSliderInteraction(el) {
    var dragging = false;
    function pctFromEvent(ev) {
      var rect = el.getBoundingClientRect();
      var clientX = ev.clientX != null ? ev.clientX
        : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : 0);
      return ((clientX - rect.left) / rect.width) * 100;
    }
    function start(ev) {
      dragging = true;
      setSliderPosition(el, pctFromEvent(ev));
      ev.preventDefault();
    }
    function move(ev) {
      if (!dragging) return;
      setSliderPosition(el, pctFromEvent(ev));
      ev.preventDefault();
    }
    function end() { dragging = false; }
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    var knob = el.querySelector('.pmg-imgx-cmp-knob');
    if (knob) {
      knob.addEventListener('keydown', function (ev) {
        var current = parseInt(knob.getAttribute('aria-valuenow') || '50', 10);
        var step = ev.shiftKey ? 10 : 5;
        if (ev.key === 'ArrowLeft') {
          setSliderPosition(el, current - step); ev.preventDefault();
        } else if (ev.key === 'ArrowRight') {
          setSliderPosition(el, current + step); ev.preventDefault();
        } else if (ev.key === 'Home') {
          setSliderPosition(el, 0); ev.preventDefault();
        } else if (ev.key === 'End') {
          setSliderPosition(el, 100); ev.preventDefault();
        }
      });
    }
    var closeBtn = el.querySelector('.pmg-imgx-cmp-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSlider);
    /* ESC closes when the slider is in focus. */
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeSlider();
    });
  }

  function openSlider() {
    if (!state.lastImageUrl || !state.previousImageUrl) return;
    var wrap = $('imageResultWrap');
    if (!wrap) return;
    closeSlider(); /* idempotent — but skip focus restore on the toggle path */
    /* Remember which element opened us so we can restore focus on close. */
    state.sliderInvoker = document.activeElement;
    /* Stash the existing wrap content so we can restore on close. */
    var stash = document.createElement('div');
    stash.className = 'pmg-imgx-cmp-stash';
    stash.style.display = 'none';
    while (wrap.firstChild) stash.appendChild(wrap.firstChild);
    wrap.appendChild(stash);
    var slider = buildSliderEl(state.previousImageUrl, state.lastImageUrl);
    wrap.appendChild(slider);
    attachSliderInteraction(slider);
    state.sliderOpen = true;
    /* Move focus to the knob so keyboard users can immediately drag. */
    var knob = slider.querySelector('.pmg-imgx-cmp-knob');
    if (knob) {
      try { knob.focus(); } catch (_) {}
    }
  }

  function closeSlider() {
    var wrap = $('imageResultWrap');
    if (!wrap) return;
    var slider = wrap.querySelector('.pmg-imgx-cmp');
    var stash = wrap.querySelector('.pmg-imgx-cmp-stash');
    if (slider) slider.remove();
    if (stash) {
      while (stash.firstChild) wrap.appendChild(stash.firstChild);
      stash.remove();
    }
    var wasOpen = state.sliderOpen;
    state.sliderOpen = false;
    /* a11y: restore focus to whatever opened the slider (typically the
       Compare button). Only do this when we're actually closing an open
       slider — not during the idempotent close inside openSlider. */
    if (wasOpen && state.sliderInvoker && typeof state.sliderInvoker.focus === 'function') {
      try { state.sliderInvoker.focus(); } catch (_) {}
    }
    state.sliderInvoker = null;
  }

  function onCompareClick() {
    if (state.sliderOpen) {
      closeSlider();
    } else {
      openSlider();
    }
  }

  /* ------------------------------------------------------------------
   * Use This Style On A New Photo
   * ------------------------------------------------------------------ */
  function ensureHandoffBanner() {
    var existing = $('pmg-imgx-handoff');
    if (existing) return existing;
    var el = document.createElement('div');
    el.id = 'pmg-imgx-handoff';
    el.className = 'pmg-imgx-handoff';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.display = 'none';
    el.innerHTML = [
      '<span class="pmg-imgx-handoff-icon" aria-hidden="true">🖼</span>',
      '<div class="pmg-imgx-handoff-body">',
      '  <strong>Same style — describe a new photo.</strong>',
      '  Your style pills are still selected. Type a new subject above and tap Generate Image to apply this look to a different photo.',
      '</div>',
      '<button type="button" class="pmg-imgx-handoff-close" aria-label="Dismiss">×</button>'
    ].join('');
    var close = el.querySelector('.pmg-imgx-handoff-close');
    if (close) close.addEventListener('click', function () { hideHandoffBanner(); });
    /* Anchor: just above the image-result-section so it stays close to
       the goal field that the user is about to edit. */
    var sec = $('imageResultSection');
    if (sec && sec.parentNode) {
      sec.parentNode.insertBefore(el, sec);
    } else {
      document.body.appendChild(el);
    }
    return el;
  }

  function showHandoffBanner() {
    var el = ensureHandoffBanner();
    el.style.display = 'flex';
    state.handoffArmed = true;
  }

  function hideHandoffBanner() {
    var el = $('pmg-imgx-handoff');
    if (el) el.style.display = 'none';
    state.handoffArmed = false;
  }

  function onUseStyleClick() {
    var goal = $('goal');
    if (!goal) return;
    /* Stash the previous subject so we can offer to restore it later
       (not in MVP — but available on state for follow-up tasks). */
    state.lastSubject = goal.value;
    goal.value = '';
    showHandoffBanner();
    try {
      goal.scrollIntoView({ behavior: window.PMG_A11Y && window.PMG_A11Y.scrollBehavior ? window.PMG_A11Y.scrollBehavior() : 'smooth', block: 'center' });
    } catch (_) {}
    try { goal.focus({ preventScroll: true }); } catch (_) { try { goal.focus(); } catch (__) {} }
    /* Watching the next regeneration: when the user generates again
       and an image arrives, hide the banner. */
  }

  /* ------------------------------------------------------------------
   * Wrap runImageGeneration to track previous/current image URLs
   * ------------------------------------------------------------------ */
  function wrapGenerator() {
    var orig = window.runImageGeneration;
    if (typeof orig !== 'function') {
      setTimeout(wrapGenerator, 200);
      return;
    }
    if (orig.__pmgImgxWrapped) return;
    var wrapped = async function () {
      /* Bump the run sequence so any later post-run sampler from an
         earlier generation cannot overwrite newer state if completions
         arrive out of order. */
      var mySeq = ++state.runSeq;
      state.inFlight++;
      /* Disable our own buttons while a generation is in-flight to
         prevent overlapping triggers. */
      var actionsBtns = document.querySelectorAll(
        '#pmg-imgx-variations-btn, #pmg-imgx-compare-btn, #pmg-imgx-style-btn'
      );
      actionsBtns.forEach(function (b) { b.disabled = true; });

      /* Capture about-to-be-overwritten image URL as previous. */
      var wrap = $('imageResultWrap');
      var existing = wrap && wrap.querySelector('img');
      var preRunSrc = existing && existing.src ? existing.src : null;
      if (preRunSrc) state.previousImageUrl = preRunSrc;

      /* Close any open slider — about to regenerate. */
      if (state.sliderOpen) closeSlider();
      /* Hide stale variant cache — a fresh single-image regen invalidates it. */
      state.variantUrls = null;
      var ret;
      try {
        ret = await orig.apply(this, arguments);
      } finally {
        /* Wait a tick — original handler writes the new <img> after the
           awaited fetch completes. */
        setTimeout(function () {
          state.inFlight = Math.max(0, state.inFlight - 1);
          /* Skip if a newer run started while we were waiting. */
          if (mySeq !== state.runSeq) return;
          var w2 = $('imageResultWrap');
          var newImg = w2 && w2.querySelector('img');
          var newSrc = newImg && newImg.src ? newImg.src : null;
          var actuallyArrived = !!(newSrc && newSrc !== preRunSrc);
          if (actuallyArrived) {
            state.lastImageUrl = newSrc;
            /* Only hide the handoff banner once a *new* image has
               actually landed — failed/empty generations leave it up. */
            if (state.handoffArmed) hideHandoffBanner();
          }
          /* Re-enable our buttons regardless. */
          actionsBtns.forEach(function (b) { b.disabled = false; });
          ensureButtons();
          syncButtonVisibility();
        }, 60);
      }
      return ret;
    };
    wrapped.__pmgImgxWrapped = true;
    window.runImageGeneration = wrapped;
    /* Keep the alias in sync. */
    window.generateImage = wrapped;
  }

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */
  function boot() {
    try {
      injectCss();
      ensureButtons();
      syncButtonVisibility();
      wrapGenerator();
      /* When the user toggles into image mode after page load, the section
         exists but the buttons may not have rendered yet because the
         actions row was generated by inline scripts. Watch for it. */
      var section = $('imageResultSection');
      if (section) {
        var mo = new MutationObserver(function () {
          ensureButtons();
          syncButtonVisibility();
        });
        mo.observe(section, { childList: true, subtree: true });
      }
    } catch (e) {
      try { console.error('[pmg-image-extras] boot failed', e); } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* Expose a tiny test surface */
  window.__pmgImageExtras = {
    version: SCRIPT_VERSION,
    state: state,
    openSlider: openSlider,
    closeSlider: closeSlider,
    showHandoffBanner: showHandoffBanner,
    hideHandoffBanner: hideHandoffBanner,
    upscaleVariant: upscaleVariant,
    /* Test-only setters so headless tests can drive UI states without
       firing real /api/image calls. */
    _setLast: function (url) { state.lastImageUrl = url; syncButtonVisibility(); },
    _setPrev: function (url) { state.previousImageUrl = url; syncButtonVisibility(); },
    _setVariants: function (urls) {
      state.variantUrls = urls;
      var wrap = $('imageResultWrap');
      if (wrap) renderVariationsGrid(wrap, urls);
    }
  };
})();
