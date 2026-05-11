/* =============================================================
 * pmg-target-platform.js  (tp-1)
 *
 * Text panel "Target Platform" select. Adds a single dropdown
 * to the existing 🎛️ Tune Your Prompt section that biases the
 * assembled prompt toward a specific destination surface
 * (LinkedIn / Email / Blog / Ad Copy).
 *
 * IMPLEMENTATION NOTES
 *
 * The backend /api/generate endpoint does not (yet) accept a
 * dedicated `targetPlatform` field, and we want this feature to
 * be 100 % additive — no schema changes, no server edits. So
 * instead of plumbing a new field through, we mirror the user's
 * pick into the existing freeform `#details` textarea using a
 * unique sentinel marker so the backend already receives the
 * directive on the next Build My Prompt.
 *
 * The marker:   [PromptMeGood: optimize this prompt for X — match its
 *               tone, length conventions, and formatting.]
 *
 * On platform change we strip any previous marker, then append
 * the new one (or just strip if "None" picked). Fully visible
 * to the user — they can edit or delete it.
 *
 * Selection persists to localStorage["pmg.target.platform.v1"].
 *
 * Disable: ?notarget OR localStorage.pmg_target_platform_disable = "1".
 * Public API: window.pmgTargetPlatform.{ get, set, refresh, dismiss }.
 * ============================================================= */
(function () {
  'use strict';

  if (window.__pmgTargetPlatformInit) return;
  window.__pmgTargetPlatformInit = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('notarget') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_target_platform_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-target-platform-styles';
  var FIELD_ID = 'pmg-target-platform-field';
  var SELECT_ID = 'pmg-target-platform';
  var STORAGE_KEY = 'pmg.target.platform.v1';

  var OPTIONS = [
    { value: '',         label: 'No platform — generic output' },
    { value: 'LinkedIn', label: 'LinkedIn — professional post' },
    { value: 'Email',    label: 'Email — direct send' },
    { value: 'Blog',     label: 'Blog — long-form article' },
    { value: 'Ad Copy',  label: 'Ad Copy — short, persuasive' }
  ];

  /* Hint phrasing per platform, kept short and concrete. */
  var HINTS = {
    'LinkedIn': 'optimize for LinkedIn — professional but human tone, 1300-character soft cap, line breaks for scannability, end with one clear takeaway or question',
    'Email':    'optimize for email — clear subject line, concise paragraphs, one main CTA, no marketing fluff',
    'Blog':     'optimize for a blog article — informative tone, H2 / H3 subheadings, scannable paragraphs, useful examples, no clickbait',
    'Ad Copy':  'optimize for ad copy — short, punchy, benefit-led, single primary CTA, written for fast skim'
  };

  /* Sentinel matcher — strips any previous platform hint. */
  var MARKER_RE = /\s*\[PromptMeGood: optimize this prompt for [^\]]+\]\s*/g;

  function buildHint(value) {
    var phrase = HINTS[value];
    if (!phrase) return '';
    return '[PromptMeGood: ' + phrase + '.]';
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#' + FIELD_ID + ' { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }' +
      '#' + FIELD_ID + ' label { font-weight: 600; font-size: 0.95em; color: var(--color-text, #ece9e2); }' +
      '#' + FIELD_ID + ' select { padding: 8px 10px; border-radius: 8px;' +
      '  border: 1px solid color-mix(in srgb, var(--color-text, #ece9e2) 18%, transparent);' +
      '  background: var(--color-surface, #1c1b18); color: var(--color-text, #ece9e2); font: inherit; }' +
      '#' + FIELD_ID + ' select:focus-visible { outline: 2px solid var(--color-primary, #3ee0a0); outline-offset: 1px; }' +
      '#' + FIELD_ID + ' .pmg-tp-helper { font-size: 12px;' +
      '  color: color-mix(in srgb, var(--color-text, #ece9e2) 60%, transparent); }' +
      '#' + FIELD_ID + ' .pmg-tp-helper.is-active {' +
      '  color: var(--color-primary, #3ee0a0); }';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getSavedValue() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { return ''; }
  }
  function setSavedValue(v) {
    try { localStorage.setItem(STORAGE_KEY, v || ''); } catch (_) {}
  }

  function syncDetails(value) {
    var details = document.getElementById('details');
    if (!details) return;
    var current = details.value || '';
    /* Strip any existing PMG marker. */
    var stripped = current.replace(MARKER_RE, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    var hint = buildHint(value);
    if (!hint) {
      if (stripped !== current.trim()) {
        details.value = stripped;
        try { details.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      }
      return;
    }
    var next = stripped.length > 0 ? (stripped + '\n\n' + hint) : hint;
    if (next !== current) {
      details.value = next;
      try { details.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }
  }

  function buildField(currentValue) {
    var wrap = document.createElement('div');
    wrap.id = FIELD_ID;
    wrap.className = 'field';
    var optionsHtml = OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (o.value === currentValue ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');
    wrap.innerHTML =
      '<label for="' + SELECT_ID + '">Target Platform <span class="helper" style="font-weight:400;opacity:.7">(optional)</span></label>' +
      '<select id="' + SELECT_ID + '" name="targetPlatform" autocomplete="off">' + optionsHtml + '</select>' +
      '<p class="pmg-tp-helper' + (currentValue ? ' is-active' : '') + '">' +
        (currentValue
          ? '✓ Tuned for ' + currentValue + '. Hint added to Extra Details — edit any time.'
          : 'Pick a destination and PromptMeGood will add a tone &amp; format hint to your prompt.') +
      '</p>';
    var sel = wrap.querySelector('#' + SELECT_ID);
    var helper = wrap.querySelector('.pmg-tp-helper');
    sel.addEventListener('change', function () {
      var v = sel.value;
      setSavedValue(v);
      syncDetails(v);
      if (v) {
        helper.classList.add('is-active');
        helper.textContent = '✓ Tuned for ' + v + '. Hint added to Extra Details — edit any time.';
      } else {
        helper.classList.remove('is-active');
        helper.textContent = 'Pick a destination and PromptMeGood will add a tone & format hint to your prompt.';
      }
    });
    return wrap;
  }

  function findAnchor() {
    /* Mount AFTER the Output Format field so it sits with the
       structural tuning controls. */
    var of = document.getElementById('outputFormat');
    if (!of) return null;
    return of.closest('.field');
  }

  function ensureMounted() {
    if (document.getElementById(FIELD_ID)) return;
    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;
    var current = getSavedValue();
    var field = buildField(current);
    anchor.parentNode.insertBefore(field, anchor.nextSibling);
    /* Re-apply hint on boot if user had one saved. */
    if (current) syncDetails(current);
  }

  function observeReady() {
    var observer = new MutationObserver(function () { ensureMounted(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { observer.disconnect(); } catch (_) {} }, 30000);
  }

  function boot() {
    injectStyles();
    ensureMounted();
    observeReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgTargetPlatform = {
    get: getSavedValue,
    set: function (v) {
      setSavedValue(v);
      var sel = document.getElementById(SELECT_ID);
      if (sel) { sel.value = v || ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      else syncDetails(v || '');
    },
    refresh: ensureMounted,
    dismiss: function () {
      var f = document.getElementById(FIELD_ID);
      if (f && f.parentNode) f.parentNode.removeChild(f);
    }
  };
})();
