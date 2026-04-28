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
    btn.addEventListener('click', function () {
      hideRetry();
      var ig = $('image-generate-btn');
      if (ig) ig.click();
    });
    var wrap = $('imageResultWrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(btn, wrap.nextSibling);
    } else if (section) {
      section.appendChild(btn);
    }
    return btn;
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

    /* Click — show progress + clear stale success/retry */
    gen.addEventListener('click', function () {
      hideSuccess();
      hideRetry();
      var dlNow = $('imageDownloadBtn');
      if (dlNow) {
        dlNow.classList.remove('pmg-ready');
        dlNow.style.display = 'none';
      }
      showProgress(section);
    }, true);

    /* Watch the wrap for the result <img> or an error message */
    if (!('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
      var img = wrap.querySelector('img');
      var txt = (wrap.textContent || '').trim();
      var looksError = /⚠️|error|failed|too many|try again|denied|network/i.test(txt) && !img;

      if (img && img.getAttribute('src')) {
        hideProgress();
        resetGenerateBtnLabel();
        var dlEl = $('imageDownloadBtn');
        styleDownloadBtn(dlEl);
        if (dlEl) {
          /* Make sure download href is set even if the original handler missed it */
          if (!dlEl.getAttribute('href') || dlEl.getAttribute('href') === '') {
            dlEl.setAttribute('href', img.getAttribute('src'));
          }
          dlEl.classList.add('pmg-ready');
          dlEl.style.display = 'inline-flex';
        }
        showSuccess(section);
      } else if (looksError) {
        hideProgress();
        resetGenerateBtnLabel();
        showRetry(section, 'Try Generating Again');
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
