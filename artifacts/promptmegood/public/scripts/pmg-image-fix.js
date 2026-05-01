/* =============================================================
 * pmg-image-fix.js
 * Fixes for the image-generation user experience:
 *   1. Live progress timer / status text during the ~15-25s wait
 *      (the OpenAI image API is slow; users were assuming the
 *       feature was broken because the spinner had no copy).
 *   2. Generate button label resets the moment an image arrives
 *      (v6 pulse handler only watched #result-panel, not the
 *       image wrap, so the CTA stayed stuck on "Creating...").
 *   3. Download button gets a clear success callout, larger size
 *      and explicit "Save Image To Your Device" copy so users
 *      cannot miss it.
 *   4. Defensive: if /api/image returns a real error code we show
 *      a readable message + a Retry button instead of silence.
 * NO backend changes. NO existing IDs renamed. All NEW logic.
 * ============================================================= */
(function () {
  if (window.__pmgImageFixLoaded) return;
  window.__pmgImageFixLoaded = true;

  function inject(css) {
    var s = document.createElement('style');
    s.setAttribute('data-pmg-image-fix', '1');
    s.textContent = css;
    document.head.appendChild(s);
  }

  inject([
    /* Progress timer pill */
    '#pmg-image-progress{display:none;align-items:center;justify-content:center;gap:.5rem;margin:.75rem auto 0;padding:.5rem .9rem;font-size:.9rem;color:var(--color-text);background:color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));border:1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));border-radius:999px;font-weight:600;width:max-content;max-width:100%}',
    '#pmg-image-progress.pmg-show{display:inline-flex}',
    '#pmg-image-progress .pmg-dot{width:8px;height:8px;border-radius:50%;background:var(--color-primary);animation:pmgImgDot 1s ease-in-out infinite}',
    '@keyframes pmgImgDot{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}',

    /* Shared shimmer used by both Image Generator and Transform Studio
     * skeletons. Reduce-motion users get a plain static block (no
     * sweeping highlight) via the prefers-reduced-motion override
     * further down. */
    '.pmg-skeleton-shimmer{position:relative;overflow:hidden;background:color-mix(in srgb, var(--color-text) 8%, var(--color-surface-2));border-radius:var(--radius-lg)}',
    '.pmg-skeleton-shimmer::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg, transparent 25%, color-mix(in srgb, var(--color-text) 6%, transparent) 50%, transparent 75%);background-size:220% 100%;animation:pmgSkeletonSweep 1.4s ease-in-out infinite}',
    '@keyframes pmgSkeletonSweep{0%{background-position:120% 0}100%{background-position:-120% 0}}',
    '@media (prefers-reduced-motion: reduce){.pmg-skeleton-shimmer::after{animation:none;background:none}}',

    /* Empty state inside the image result wrap */
    '.pmg-image-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-10)) var(--space-5);min-height:240px;color:var(--color-text-muted)}',
    '.pmg-image-empty-frame{width:clamp(72px,16vw,108px);aspect-ratio:1;border-radius:var(--radius-lg);border:2px dashed color-mix(in srgb, var(--color-primary) 38%, var(--color-border));background:color-mix(in srgb, var(--color-primary) 6%, transparent);display:flex;align-items:center;justify-content:center;font-size:clamp(28px,6vw,42px);color:var(--color-primary)}',
    '.pmg-image-empty-title{margin:0;font-size:var(--text-base);font-weight:700;color:var(--color-text)}',
    '.pmg-image-empty-text{margin:0;font-size:var(--text-sm);color:var(--color-text-muted);max-width:42ch;line-height:1.5}',

    /* Skeleton placeholder shaped like the final 1024x1024 image */
    '.pmg-image-skeleton{width:100%;aspect-ratio:1;min-height:240px;border-radius:var(--radius-lg)}',

    /* Error banner with Try Again */
    '.pmg-image-error{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:240px;background:color-mix(in srgb, #dc2626 8%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, #dc2626 38%, var(--color-border));border-radius:var(--radius-lg)}',
    '.pmg-image-error-icon{font-size:32px;line-height:1}',
    '.pmg-image-error-title{margin:0;font-size:var(--text-base);font-weight:700;color:#b91c1c}',
    '[data-theme="dark"] .pmg-image-error-title{color:#fca5a5}',
    '.pmg-image-error-text{margin:0;font-size:var(--text-sm);color:var(--color-text);max-width:48ch;line-height:1.5}',
    '.pmg-image-error-btn{min-height:44px;padding:10px 20px;border-radius:999px;background:var(--color-primary);color:#fff;font-weight:700;border:1.5px solid var(--color-primary);cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;font-size:var(--text-sm)}',
    '.pmg-image-error-btn:hover{filter:brightness(1.05)}',


    /* Success callout above the download button */
    '#pmg-image-success{display:none;margin:.5rem 0 .75rem;padding:.75rem 1rem;border-radius:12px;background:color-mix(in srgb, #16a34a 12%, var(--color-surface));border:1.5px solid color-mix(in srgb, #16a34a 40%, var(--color-border));color:var(--color-text);font-size:.95rem;font-weight:600;line-height:1.4;text-align:center}',
    '#pmg-image-success.pmg-show{display:block;animation:pmgImgFade .35s ease both}',
    '@keyframes pmgImgFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',

    /* Bigger, more obvious download button */
    '#imageDownloadBtn{font-size:1.05rem!important;font-weight:800!important;padding:14px 22px!important;min-height:54px!important;border-radius:999px!important;display:none;align-items:center;justify-content:center;gap:.5rem;letter-spacing:.01em;box-shadow:0 8px 22px color-mix(in srgb, var(--color-primary) 32%, transparent)!important}',
    '#imageDownloadBtn.pmg-ready{display:inline-flex!important;animation:pmgImgPulse 1.6s ease 2}',
    '@keyframes pmgImgPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}',

    /* Retry on error */
    '#pmg-image-retry{display:none;margin:.75rem auto 0;padding:10px 18px;border-radius:999px;background:var(--color-primary);color:#fff;font-weight:700;border:1.5px solid var(--color-primary);cursor:pointer;min-height:44px}',
    '#pmg-image-retry.pmg-show{display:inline-flex;align-items:center;gap:.4rem}',

    /* Stretch action row so download is the focal point */
    '.image-result-actions{align-items:center}',
    '@media (max-width:640px){#imageDownloadBtn{width:100%}}'
  ].join('\n'));

  function $(id) { return document.getElementById(id); }

  function ensureProgressEl(section) {
    var el = $('pmg-image-progress');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pmg-image-progress';
    el.setAttribute('role', 'status');
    /* aria-live=off on the live timer text to avoid per-second SR spam.
     * Milestones are announced via the wrapping status role on initial show. */
    el.setAttribute('aria-live', 'off');
    el.innerHTML = '<span class="pmg-dot" aria-hidden="true"></span><span class="pmg-text" aria-hidden="true">Creating your image — about 10–25 seconds…</span>';
    var wrap = $('imageResultWrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(el, wrap);
    } else if (section) {
      section.insertBefore(el, section.firstChild);
    }
    return el;
  }

  function ensureSuccessEl(section) {
    var el = $('pmg-image-success');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pmg-image-success';
    el.setAttribute('role', 'status');
    el.innerHTML = '✅ Your image is ready! Tap <strong>Save Image To Your Device</strong> below to download it.';
    var actions = section && section.querySelector('.image-result-actions');
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(el, actions);
    } else if (section) {
      section.appendChild(el);
    }
    return el;
  }

  function ensureRetryBtn(section) {
    var btn = $('pmg-image-retry');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'pmg-image-retry';
    btn.type = 'button';
    btn.innerHTML = '↻ Try Generating Again';
    btn.addEventListener('click', triggerRetry);
    var wrap = $('imageResultWrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(btn, wrap.nextSibling);
    } else if (section) {
      section.appendChild(btn);
    }
    return btn;
  }

  /* ---- New empty / skeleton / error renderers (Task #24) ----
   * These render INSIDE #imageResultWrap, replacing the legacy
   * `.image-placeholder`, `.image-generating-state`, and inline error
   * text. They use a small render flag so the MutationObserver below
   * does not fight with itself when we write our own markup. */
  var WRAP_STATE_ATTR = 'data-pmg-state';
  /* Re-entry guard for the MutationObserver — set true while we are
   * mutating the wrap ourselves so the observer ignores our own writes. */
  var renderingOurOwnState = false;

  function setWrapState(wrap, name, html) {
    if (!wrap) return;
    renderingOurOwnState = true;
    wrap.setAttribute(WRAP_STATE_ATTR, name);
    wrap.innerHTML = html;
    /* Release the guard on the next frame so any synchronous mutation
     * records have already been queued and ignored. */
    setTimeout(function () { renderingOurOwnState = false; }, 0);
  }

  function emptyStateHtml() {
    return [
      '<div class="pmg-image-empty" role="note">',
      '  <div class="pmg-image-empty-frame" aria-hidden="true">🖼</div>',
      '  <p class="pmg-image-empty-title">Your Generated Image Will Appear Here</p>',
      '  <p class="pmg-image-empty-text">Describe the image you want above, then tap Generate Image. We will paint it with DALL·E 3 and drop it into this frame in about 10–25 seconds.</p>',
      '</div>'
    ].join('');
  }

  function skeletonStateHtml() {
    return '<div class="pmg-image-skeleton pmg-skeleton-shimmer" role="img" aria-label="Loading generated image"></div>';
  }

  function errorStateHtml(msg) {
    var safe = String(msg || 'Something went wrong while generating your image.')
      .replace(/[<>&"]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]; });
    return [
      '<div class="pmg-image-error" role="alert">',
      '  <div class="pmg-image-error-icon" aria-hidden="true">⚠️</div>',
      '  <p class="pmg-image-error-title">Image Generation Failed</p>',
      '  <p class="pmg-image-error-text">' + safe + '</p>',
      '  <button type="button" class="pmg-image-error-btn" id="pmg-image-error-retry">↻ Try Again</button>',
      '</div>'
    ].join('');
  }

  function renderEmpty(wrap) {
    if (!wrap) return;
    if (wrap.querySelector('img')) return; /* never overwrite a real image */
    setWrapState(wrap, 'empty', emptyStateHtml());
  }

  function renderSkeleton(wrap) {
    if (!wrap) return;
    setWrapState(wrap, 'loading', skeletonStateHtml());
  }

  function renderError(wrap, msg) {
    if (!wrap) return;
    setWrapState(wrap, 'error', errorStateHtml(msg));
    var btn = wrap.querySelector('#pmg-image-error-retry');
    if (btn) btn.addEventListener('click', triggerRetry);
  }

  function triggerRetry() {
    hideRetry();
    var wrap = $('imageResultWrap');
    if (wrap) renderSkeleton(wrap);
    var ig = $('image-generate-btn');
    if (ig) {
      ig.click();
      return;
    }
    /* Fallback: photo-mode flow (image-generate-btn hidden) — call the
     * shared image generator directly. */
    if (typeof window.runImageGeneration === 'function') {
      try { window.runImageGeneration(); } catch (_) {}
    } else if (typeof window.generateImage === 'function') {
      try { window.generateImage(); } catch (_) {}
    }
  }

  function isImageMode() {
    var b = document.body;
    if (!b) return false;
    return b.classList.contains('image-mode') || b.classList.contains('photo-mode-active');
  }

  function showSectionIfImageMode(section) {
    if (!section) return;
    if (!isImageMode()) return;
    if (section.hasAttribute('hidden')) section.removeAttribute('hidden');
  }

  function maybeShowEmptyState(section, wrap) {
    if (!section || !wrap) return;
    if (!isImageMode()) return;
    if (wrap.querySelector('img')) return;
    var state = wrap.getAttribute(WRAP_STATE_ATTR);
    if (state === 'loading' || state === 'error') return;
    showSectionIfImageMode(section);
    renderEmpty(wrap);
  }

  /* Detect the legacy text loading indicator written by the inline
   * generateImage / runImageGeneration scripts in index.html. */
  function looksLikeLegacyLoading(wrap) {
    if (!wrap) return false;
    if (wrap.querySelector('.image-generating-state')) return true;
    if (wrap.querySelector('.image-spinner')) return true;
    return false;
  }

  /* Detect the legacy inline error text written into the wrap. */
  function looksLikeLegacyError(wrap) {
    if (!wrap) return null;
    if (wrap.querySelector('img')) return null;
    var state = wrap.getAttribute(WRAP_STATE_ATTR);
    if (state === 'error') return null;
    var txt = (wrap.textContent || '').trim();
    if (!/⚠️|error|failed|too many|try again|denied|network/i.test(txt)) return null;
    /* Strip leading warning glyph + whitespace for cleaner display. */
    var cleaned = txt.replace(/^[\s⚠️]+/, '').trim();
    return cleaned || 'Something went wrong while generating your image.';
  }

  function showProgress(section) {
    var el = ensureProgressEl(section);
    el.classList.add('pmg-show');
    var textEl = el.querySelector('.pmg-text');
    var start = Date.now();
    if (window.__pmgImgTimer) clearInterval(window.__pmgImgTimer);
    function tick() {
      var s = Math.floor((Date.now() - start) / 1000);
      if (textEl) {
        if (s < 5) textEl.textContent = 'Creating your image — about 10–25 seconds…';
        else if (s < 12) textEl.textContent = 'Painting the pixels… ' + s + 's';
        else if (s < 22) textEl.textContent = 'Almost there… ' + s + 's';
        else textEl.textContent = 'Big detailed images take a moment… ' + s + 's';
      }
    }
    tick();
    window.__pmgImgTimer = setInterval(tick, 1000);
  }

  function hideProgress() {
    var el = $('pmg-image-progress');
    if (el) el.classList.remove('pmg-show');
    if (window.__pmgImgTimer) {
      clearInterval(window.__pmgImgTimer);
      window.__pmgImgTimer = null;
    }
  }

  function showSuccess(section) {
    var el = ensureSuccessEl(section);
    el.classList.add('pmg-show');
  }

  function hideSuccess() {
    var el = $('pmg-image-success');
    if (el) el.classList.remove('pmg-show');
  }

  function showRetry(section, msg) {
    var btn = ensureRetryBtn(section);
    btn.classList.add('pmg-show');
    if (msg) btn.innerHTML = '↻ ' + msg;
  }

  function hideRetry() {
    var btn = $('pmg-image-retry');
    if (btn) btn.classList.remove('pmg-show');
  }

  function resetGenerateBtnLabel() {
    var btn = $('image-generate-btn');
    if (!btn) return;
    btn.classList.remove('pmg-generating');
    btn.disabled = false;
    var orig = btn.getAttribute('data-pmg-orig-text');
    if (orig) {
      btn.textContent = orig;
      btn.removeAttribute('data-pmg-orig-text');
    } else {
      btn.textContent = '🎨 Generate Image';
    }
  }

  function styleDownloadBtn(dl) {
    if (!dl) return;
    /* Friendlier label */
    if (!dl.getAttribute('data-pmg-relabeled')) {
      dl.setAttribute('data-pmg-relabeled', '1');
      dl.innerHTML = '⬇ Save Image To Your Device';
    }
    /* Sensible filename */
    if (!dl.getAttribute('download') || dl.getAttribute('download') === 'promptmegood-image.png') {
      dl.setAttribute('download', 'promptmegood-image-' + Date.now() + '.png');
    }
  }

  function init() {
    var section = $('imageResultSection');
    var wrap = $('imageResultWrap');
    var dl = $('imageDownloadBtn');
    var gen = $('image-generate-btn');
    if (!section || !wrap || !gen) {
      /* DOM not ready yet — try again shortly */
      setTimeout(init, 500);
      return;
    }
    /* Hard idempotency guard against accidental rebinding by future scripts */
    if (gen.dataset.pmgImageFixBound === '1') return;
    gen.dataset.pmgImageFixBound = '1';
    styleDownloadBtn(dl);

    /* If the user is already in image mode at script-load time, surface
     * the empty state immediately so the result frame is never blank. */
    maybeShowEmptyState(section, wrap);

    /* Watch the body for image-mode toggling so we can flip the empty
     * state in / out as the user moves between Write and Image modes. */
    if ('MutationObserver' in window) {
      var bodyMo = new MutationObserver(function () {
        if (isImageMode()) {
          maybeShowEmptyState(section, wrap);
        }
      });
      bodyMo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    /* Click — show progress + skeleton + clear stale success/retry */
    gen.addEventListener('click', function () {
      hideSuccess();
      hideRetry();
      var dlNow = $('imageDownloadBtn');
      if (dlNow) {
        dlNow.classList.remove('pmg-ready');
        dlNow.style.display = 'none';
      }
      showProgress(section);
      /* Render the skeleton straight away, then again on the next tick
       * to overwrite the inline `image-generating-state` text loader
       * that the legacy generateImage / runImageGeneration handlers
       * synchronously set after this listener runs. */
      var w = $('imageResultWrap');
      renderSkeleton(w);
      setTimeout(function () {
        var w2 = $('imageResultWrap');
        if (w2 && !w2.querySelector('img')) renderSkeleton(w2);
      }, 0);
    }, true);

    /* Watch the wrap for the result <img>, the legacy text loader, or
     * an inline error message — and translate each into our richer
     * skeleton / error banner. Re-entry guarded so we don't recurse. */
    if (!('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
      if (renderingOurOwnState) return;
      var w = wrap;
      var img = w.querySelector('img');
      if (img && img.getAttribute('src')) {
        hideProgress();
        resetGenerateBtnLabel();
        /* Image present — clear our render-state marker so future
         * mutations are evaluated freshly. */
        w.removeAttribute(WRAP_STATE_ATTR);
        var dlEl = $('imageDownloadBtn');
        styleDownloadBtn(dlEl);
        if (dlEl) {
          if (!dlEl.getAttribute('href') || dlEl.getAttribute('href') === '') {
            dlEl.setAttribute('href', img.getAttribute('src'));
          }
          dlEl.classList.add('pmg-ready');
          dlEl.style.display = 'inline-flex';
        }
        showSuccess(section);
        return;
      }
      var errMsg = looksLikeLegacyError(w);
      if (errMsg) {
        hideProgress();
        resetGenerateBtnLabel();
        renderError(w, errMsg);
        return;
      }
      if (looksLikeLegacyLoading(w)) {
        renderSkeleton(w);
        return;
      }
      /* Pre-generation placeholder text — replace with empty state. */
      var state = w.getAttribute(WRAP_STATE_ATTR);
      if (!state && w.querySelector('.image-placeholder')) {
        renderEmpty(w);
      }
    });
    mo.observe(wrap, { childList: true, subtree: true, characterData: true });

    /* Hard safety: never let the generate button stay stuck */
    var safetyTimer = setInterval(function () {
      var b = $('image-generate-btn');
      if (!b) return;
      var stuckText = (b.textContent || '').toLowerCase();
      var stuck = b.disabled || /creating|generating|⏳/.test(stuckText);
      var hasImg = wrap.querySelector('img');
      if (stuck && hasImg) resetGenerateBtnLabel();
    }, 1500);

    /* Clean up timers when the page is being unloaded so they
     * cannot linger in a long-lived session. */
    function cleanupTimers() {
      clearInterval(safetyTimer);
      if (window.__pmgImgTimer) {
        clearInterval(window.__pmgImgTimer);
        window.__pmgImgTimer = null;
      }
    }
    window.addEventListener('pagehide', cleanupTimers);
    window.addEventListener('beforeunload', cleanupTimers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
