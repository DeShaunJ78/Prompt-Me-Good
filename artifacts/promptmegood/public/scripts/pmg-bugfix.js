(function () {
  'use strict';

  /* ================================================================
   * BUG 1 — Force scroll-to-top on page load (no result-panel jump)
   * ================================================================ */
  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) {}

  function scrollTopIfNoHash() {
    try {
      if (!window.location.hash) {
        window.scrollTo(0, 0);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrollTopIfNoHash, { once: true });
  } else {
    scrollTopIfNoHash();
  }
  window.addEventListener('load', scrollTopIfNoHash, { once: true });

  /* ================================================================
   * BUG 4 — Hide post-generation tools until a prompt exists
   * ================================================================ */
  var STORAGE_KEY = 'pmg_has_generated';
  var PLACEHOLDER = 'Your fixed prompt will appear here.';

  function injectVisibilityCss() {
    if (document.getElementById('pmg-bugfix-result-visibility')) return;
    var css = [
      'body:not(.pmg-has-result) #quality-row,',
      'body:not(.pmg-has-result) #copy-btn,',
      'body:not(.pmg-has-result) #share-btn,',
      'body:not(.pmg-has-result) #print-btn,',
      'body:not(.pmg-has-result) #clear-prompt-btn,',
      'body:not(.pmg-has-result) #improve-block,',
      'body:not(.pmg-has-result) #fine-tune-row,',
      'body:not(.pmg-has-result) .fine-tune,',
      'body:not(.pmg-has-result) #undo-btn,',
      'body:not(.pmg-has-result) .undo-row,',
      'body:not(.pmg-has-result) #runSection,',
      'body:not(.pmg-has-result) .what-next,',
      'body:not(.pmg-has-result) #what-next,',
      'body:not(.pmg-has-result) .open-in-block,',
      'body:not(.pmg-has-result) .save-tip,',
      'body:not(.pmg-has-result) #strength-score,',
      'body:not(.pmg-has-result) #aiResponseSection,',
      'body:not(.pmg-has-result) .pmg-post-gen { display: none !important; }',
      /* Result panel itself stays visible so user always sees the placeholder. */
      ''
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'pmg-bugfix-result-visibility';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function hasRealPrompt(text) {
    if (!text) return false;
    var t = String(text).trim();
    if (!t) return false;
    if (t === PLACEHOLDER) return false;
    if (t.indexOf('Your fixed prompt will appear here') === 0) return false;
    if (t.indexOf('Your generated prompt will appear here') === 0) return false;
    if (t.indexOf('Generating your prompt') === 0) return false;
    if (t.indexOf('Generating demo prompt') === 0) return false;
    if (t.indexOf('Please enter a goal') === 0) return false;
    if (t.indexOf('Add a clear goal first') === 0) return false;
    if (t.indexOf('Could not generate') === 0) return false;
    /* require at least 30 non-whitespace chars to count as a real prompt */
    return t.replace(/\s+/g, '').length >= 30;
  }

  function markHasResult() {
    if (document.body && !document.body.classList.contains('pmg-has-result')) {
      document.body.classList.add('pmg-has-result');
    }
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  function clearHasResult() {
    if (document.body && document.body.classList.contains('pmg-has-result')) {
      document.body.classList.remove('pmg-has-result');
    }
    /* Note: per spec, localStorage flag is sticky for returning users. */
  }

  function checkResultBox() {
    var rb = document.getElementById('resultBox');
    if (!rb) return;
    if (hasRealPrompt(rb.textContent)) {
      markHasResult();
    }
  }

  function watchResultBox() {
    var rb = document.getElementById('resultBox');
    if (!rb || !('MutationObserver' in window)) return;
    var mo = new MutationObserver(function () {
      if (document.body && document.body.classList.contains('pmg-has-result')) {
        return; /* once revealed, leave it revealed (sticky) */
      }
      if (hasRealPrompt(rb.textContent)) {
        markHasResult();
      }
    });
    mo.observe(rb, { childList: true, subtree: true, characterData: true });
  }

  function wireClearButton() {
    var btn = document.getElementById('clear-prompt-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      /* Re-hide the post-gen tools until the next generation. */
      setTimeout(clearHasResult, 0);
    });
  }

  function applyOnLoad() {
    injectVisibilityCss();
    /* Returning users: surface tools immediately if they generated previously. */
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        markHasResult();
      }
    } catch (e) {}
    checkResultBox();
    watchResultBox();
    wireClearButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOnLoad, { once: true });
  } else {
    applyOnLoad();
  }
})();
