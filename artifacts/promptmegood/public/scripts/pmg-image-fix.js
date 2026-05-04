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
    /* ---- Image-generation waiting card (Task: image-progress polish)
     *
     * Replaces the original single-line "progress pill" with a richer
     * card that has:
     *   - 3 staggered pulsing dots (visual "working")
     *   - Phased status text that crossfades on phase change
     *   - Elapsed seconds counter (per-second numeric tick)
     *   - Asymptotic progress bar (fast at first, slowing) capped at
     *     ~94% so it never claims completion before the image returns.
     *
     * The element keeps id `pmg-image-progress` for backwards compat
     * with `showProgress` / `hideProgress` and any existing tests.
     * Reduce-motion users get a static card (no shimmer / no pulse /
     * no crossfade) — see prefers-reduced-motion overrides further
     * down. */
    '#pmg-image-progress{display:none;flex-direction:column;gap:.55rem;margin:.75rem auto 0;padding:.85rem 1rem;font-size:.92rem;color:var(--color-text);background:color-mix(in srgb, var(--color-primary) 9%, var(--color-surface));border:1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));border-radius:14px;width:min(420px,100%);box-sizing:border-box}',
    '#pmg-image-progress.pmg-show{display:flex;animation:pmgImgCardIn .35s ease both}',
    '@keyframes pmgImgCardIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
    '#pmg-image-progress .pmg-row{display:flex;align-items:center;gap:.6rem;min-width:0}',
    '#pmg-image-progress .pmg-dots{display:inline-flex;gap:4px;flex:0 0 auto}',
    '#pmg-image-progress .pmg-dot{width:7px;height:7px;border-radius:50%;background:var(--color-primary);animation:pmgImgDot 1.1s ease-in-out infinite}',
    '#pmg-image-progress .pmg-dot:nth-child(2){animation-delay:.18s}',
    '#pmg-image-progress .pmg-dot:nth-child(3){animation-delay:.36s}',
    '@keyframes pmgImgDot{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}',
    /* Phase text with crossfade. Two stacked spans so the next phase
     * fades in over the previous one without layout jitter. */
    '#pmg-image-progress .pmg-text-wrap{position:relative;flex:1 1 auto;min-width:0;min-height:1.25em;font-weight:600;line-height:1.25}',
    '#pmg-image-progress .pmg-text{position:absolute;inset:0;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .28s ease}',
    '#pmg-image-progress .pmg-text.pmg-out{opacity:0}',
    '#pmg-image-progress .pmg-text.pmg-in{opacity:1}',
    '#pmg-image-progress .pmg-elapsed{flex:0 0 auto;font-variant-numeric:tabular-nums;font-weight:700;font-size:.8rem;color:var(--color-text-muted);padding:2px 8px;border-radius:999px;background:color-mix(in srgb, var(--color-primary) 14%, transparent)}',
    /* Progress bar — uses width transitions for a smooth fill. */
    '#pmg-image-progress .pmg-bar{position:relative;width:100%;height:6px;border-radius:999px;background:color-mix(in srgb, var(--color-text) 9%, transparent);overflow:hidden}',
    '#pmg-image-progress .pmg-bar-fill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:999px;background:linear-gradient(90deg,var(--color-primary),color-mix(in srgb,var(--color-primary) 70%, #ffffff));transition:width .9s cubic-bezier(.22,.61,.36,1)}',
    /* Reduce-motion: kill all moving parts. */
    '@media (prefers-reduced-motion: reduce){#pmg-image-progress.pmg-show{animation:none}#pmg-image-progress .pmg-dot{animation:none;opacity:.7;transform:none}#pmg-image-progress .pmg-text{transition:none}#pmg-image-progress .pmg-bar-fill{transition:none}}',
    /* Visually-hidden mirror used to politely announce phase changes
     * to screen readers without spamming them on every second. */
    '#pmg-image-progress .pmg-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

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
    '.pmg-image-error{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);text-align:center;padding:clamp(var(--space-6),5vw,var(--space-8)) var(--space-5);min-height:240px;background:color-mix(in srgb, var(--color-danger-strong) 8%, var(--color-surface-2));border:1.5px dashed color-mix(in srgb, var(--color-danger-strong) 38%, var(--color-border));border-radius:var(--radius-lg)}',
    '.pmg-image-error-icon{font-size:32px;line-height:1}',
    '.pmg-image-error-title{margin:0;font-size:var(--text-base);font-weight:700;color:var(--color-danger)}',
    '[data-theme="dark"] .pmg-image-error-title{color:var(--color-danger)}',
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
    /* aria-live=off on the entire card. Phase changes are mirrored
     * to the dedicated `.pmg-sr-only` polite span below so screen
     * readers hear meaningful milestones (not the per-second timer). */
    el.setAttribute('aria-live', 'off');
    /* Two stacked .pmg-text spans: one is the "current" phase, the
     * other is the "incoming" phase. We toggle pmg-in / pmg-out
     * classes to crossfade without relayout. */
    el.innerHTML = [
      '<div class="pmg-row">',
      '  <span class="pmg-dots" aria-hidden="true">',
      '    <span class="pmg-dot"></span>',
      '    <span class="pmg-dot"></span>',
      '    <span class="pmg-dot"></span>',
      '  </span>',
      '  <span class="pmg-text-wrap" aria-hidden="true">',
      '    <span class="pmg-text pmg-text-a pmg-in"></span>',
      '    <span class="pmg-text pmg-text-b pmg-out"></span>',
      '  </span>',
      '  <span class="pmg-elapsed" aria-hidden="true">0s</span>',
      '</div>',
      '<div class="pmg-bar" aria-hidden="true"><span class="pmg-bar-fill"></span></div>',
      '<span class="pmg-sr-only" aria-live="polite"></span>'
    ].join('');
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

  /* Phased status messages. Each entry: { until: <seconds threshold>,
   * text: <copy>}. The phase whose `until` first exceeds elapsed
   * seconds wins. The last phase has Infinity so it always matches
   * for very-long generations. We deliberately keep messages short
   * + concrete so the user feels the system is working through
   * specific stages, not just spinning. */
  var IMG_PHASES = [
    { until: 3,        text: 'Reading your prompt…' },
    { until: 7,        text: 'Sketching the composition…' },
    { until: 12,       text: 'Choosing colors and lighting…' },
    { until: 18,       text: 'Painting the details…' },
    { until: 25,       text: 'Adding finishing touches…' },
    { until: 40,       text: 'Almost ready — big images take longer…' },
    { until: Infinity, text: 'Still working — rich scenes need extra time…' }
  ];

  /* Asymptotic progress curve. Returns 0..0.94 — never 1.0, because
   * we only know the image is *actually* done when the API returns.
   * Profile: ~30% by 5s, ~60% by 15s, ~80% by 25s, ~94% by 60s. */
  function progressForElapsed(s) {
    var pct = 1 - Math.exp(-s / 18);   // approaches 1 asymptotically
    return Math.min(0.94, pct);
  }

  function phaseForElapsed(s) {
    for (var i = 0; i < IMG_PHASES.length; i++) {
      if (s < IMG_PHASES[i].until) return IMG_PHASES[i].text;
    }
    return IMG_PHASES[IMG_PHASES.length - 1].text;
  }

  /* Crossfade the visible phase text. We track which span is the
   * "active" (visible) one on the element so we don't have to read
   * computed styles. */
  function setPhaseText(el, nextText) {
    var a = el.querySelector('.pmg-text-a');
    var b = el.querySelector('.pmg-text-b');
    if (!a || !b) return;
    var activeIsA = a.classList.contains('pmg-in');
    var current = activeIsA ? a : b;
    var incoming = activeIsA ? b : a;
    if ((current.textContent || '').trim() === nextText) return;
    incoming.textContent = nextText;
    /* Force a reflow so the transition reliably triggers when both
     * spans are toggled in the same frame. */
    void incoming.offsetWidth;
    incoming.classList.remove('pmg-out');
    incoming.classList.add('pmg-in');
    current.classList.remove('pmg-in');
    current.classList.add('pmg-out');
  }

  function showProgress(section) {
    var el = ensureProgressEl(section);
    el.classList.add('pmg-show');
    var textA = el.querySelector('.pmg-text-a');
    var elapsedEl = el.querySelector('.pmg-elapsed');
    var fillEl = el.querySelector('.pmg-bar-fill');
    var srEl = el.querySelector('.pmg-sr-only');
    var start = Date.now();
    var lastPhase = '';
    /* Seed the visible phase span synchronously so the first frame
     * isn't blank (crossfade only triggers on phase *changes*). */
    if (textA) textA.textContent = IMG_PHASES[0].text;
    /* Reset the progress bar to 0 each generation. */
    if (fillEl) fillEl.style.width = '0%';
    if (elapsedEl) elapsedEl.textContent = '0s';
    if (srEl) srEl.textContent = IMG_PHASES[0].text;
    lastPhase = IMG_PHASES[0].text;

    if (window.__pmgImgTimer) clearInterval(window.__pmgImgTimer);
    function tick() {
      var s = Math.floor((Date.now() - start) / 1000);
      if (elapsedEl) elapsedEl.textContent = s + 's';
      var nextPhase = phaseForElapsed(s);
      if (nextPhase !== lastPhase) {
        setPhaseText(el, nextPhase);
        if (srEl) srEl.textContent = nextPhase;
        lastPhase = nextPhase;
      }
      if (fillEl) {
        var pct = (progressForElapsed(s) * 100).toFixed(1);
        fillEl.style.width = pct + '%';
      }
    }
    tick();
    window.__pmgImgTimer = setInterval(tick, 1000);
  }

  function hideProgress() {
    var el = $('pmg-image-progress');
    if (el) {
      /* Snap the bar to 100% briefly before hiding so the success
       * moment feels resolved instead of cut off mid-fill. The
       * card's CSS transition handles the visual sweep, then the
       * pmg-show class is removed on a short delay. */
      var fillEl = el.querySelector('.pmg-bar-fill');
      if (fillEl) fillEl.style.width = '100%';
      setTimeout(function () {
        var still = $('pmg-image-progress');
        if (still) still.classList.remove('pmg-show');
      }, 220);
    }
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
        /* Trigger the waiting card here too — the click-handler path
         * only fires when #image-generate-btn is clicked, but the real
         * user flow goes through .pmg-photo-send -> sendToImageGenerator
         * -> window.generateImage() (a direct call, no DOM click). The
         * legacy spinner appearing in the wrap is the universal signal
         * that generation has begun, regardless of entry point. */
        var pcard = $('pmg-image-progress');
        if (!pcard || !pcard.classList.contains('pmg-show')) {
          showProgress(section);
        }
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
