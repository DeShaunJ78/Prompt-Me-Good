/* =============================================================
 * pmg-text-feedback.js  (txt-fb-1)
 *
 * Live, always-visible feedback layer for the Create A Text Prompt
 * builder. Mounts a small calm card directly under #goal showing:
 *
 *   1. Tuning summary chips    (live mirror of category/tone/format/
 *                                length/personality — only non-default
 *                                values are shown)
 *   2. Quality meter           (Too vague / Getting there / Specific
 *                                enough — based on length + vague-word
 *                                count + presence of structured cues)
 *   3. Char / ~token counter   (rough chars/4 estimate, soft warn at
 *                                2000+ chars)
 *   4. Vague-word linter chips (only renders when matches found —
 *                                tap a chip to highlight the word in
 *                                the textarea, with a one-line tip)
 *
 * Strict additive: never reads/writes anything from the backend.
 * Updates on #goal input, tuning <select> change, and a small
 * MutationObserver in case selects are re-skinned/re-rendered by
 * pmg-pro.js.
 *
 * Visible only when the Text panel is active. Hidden via
 * body[data-active-panel="photography"|"video"] CSS in
 * pmg-text-feedback.css.
 *
 * Disable: ?nofeedback OR localStorage.pmg_feedback_disable = "1".
 *
 * Public API: window.pmgTextFeedback.{ refresh, getState, dismiss }.
 * ============================================================= */
(function () {
  'use strict';

  if (window.__pmgTextFeedbackInit) return;
  window.__pmgTextFeedbackInit = true;

  /* ---------------- Disable hatch ---------------- */
  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('nofeedback') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_feedback_disable') === '1') return;
  } catch (_) {}

  var ROOT_ID = 'pmg-text-feedback';
  var STYLE_ID = 'pmg-text-feedback-styles';

  var TUNE_DEFAULTS = {
    category: '',
    tone: '',
    outputFormat: '',
    maxLength: '',
    personality: 'none'
  };

  var TUNE_LABELS = {
    category: 'Category',
    tone: 'Tone',
    outputFormat: 'Format',
    maxLength: 'Length',
    personality: 'Personality'
  };

  /* Vague words → suggested replacements. Kept short and opinion-light. */
  var VAGUE_WORDS = {
    'good':     'concrete quality (e.g., "fast", "concise", "well-tested")',
    'nice':     'specific trait (e.g., "minimal", "warm", "polished")',
    'thing':    'name the noun (e.g., "feature", "report", "email")',
    'things':   'name the nouns (e.g., "steps", "rules", "files")',
    'stuff':    'name what (e.g., "tasks", "data", "examples")',
    'very':     'pick a stronger adjective instead of "very …"',
    'really':   'drop "really" — pick a stronger word',
    'amazing':  'describe what makes it great (e.g., "fast", "intuitive")',
    'great':    'be specific (e.g., "thorough", "actionable")',
    'best':     'best by what measure? (speed, cost, clarity?)',
    'better':   'better than what? compared on what axis?',
    'many':     'about how many? (a number or range)',
    'few':      'about how many? (a number or range)',
    'some':     'name them or give a count',
    'a lot':    'about how much / how many?'
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/styles/pmg-text-feedback.css?v=txt-fb-1';
    document.head.appendChild(link);
  }

  function getGoalEl() {
    return document.getElementById('goal');
  }

  function readTuning() {
    var out = {};
    Object.keys(TUNE_DEFAULTS).forEach(function (key) {
      var el = document.getElementById(key);
      out[key] = el ? (el.value || '') : '';
    });
    return out;
  }

  function selectedLabel(key, value) {
    var el = document.getElementById(key);
    if (!el) return value;
    var opt = el.querySelector('option[value="' + (value || '').replace(/"/g, '\\"') + '"]');
    return opt ? (opt.textContent || value).trim() : value;
  }

  /* ---------------- Quality scoring ---------------- */

  function findVagueMatches(text) {
    if (!text) return [];
    var lower = text.toLowerCase();
    var seen = {};
    var hits = [];
    Object.keys(VAGUE_WORDS).forEach(function (word) {
      /* \b before "a lot" matches because "a" starts with a word char,
         and the literal space in the middle is preserved. \b after "lot"
         matches at the trailing word boundary. */
      var pattern = new RegExp(
        '\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
        'g'
      );
      var m;
      while ((m = pattern.exec(lower)) !== null) {
        if (!seen[word]) {
          seen[word] = true;
          hits.push({ word: word, suggestion: VAGUE_WORDS[word], index: m.index });
        }
      }
    });
    return hits;
  }

  function scoreQuality(text, vagueCount) {
    var len = (text || '').trim().length;
    if (len === 0) return { tier: 'empty', label: 'Start typing your goal', tone: 'idle' };
    if (len < 25)  return { tier: 'low',   label: 'Too vague',           tone: 'warn' };
    if (len < 80 || vagueCount >= 3) return { tier: 'mid', label: 'Getting there', tone: 'mid' };
    if (vagueCount >= 1) return { tier: 'mid', label: 'Getting there',  tone: 'mid' };
    return { tier: 'high', label: 'Specific enough', tone: 'good' };
  }

  function estimateTokens(text) {
    var len = (text || '').length;
    /* Rough heuristic — ~4 chars/token for English. */
    return Math.max(0, Math.round(len / 4));
  }

  /* ---------------- DOM ---------------- */

  function buildRoot() {
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'pmg-tfb';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Prompt quality feedback');
    root.innerHTML = [
      '<div class="pmg-tfb-row pmg-tfb-meter-row">',
        '<div class="pmg-tfb-meter" data-tone="idle" aria-live="polite">',
          '<span class="pmg-tfb-meter-dot" aria-hidden="true"></span>',
          '<span class="pmg-tfb-meter-label">Start typing your goal</span>',
        '</div>',
        '<div class="pmg-tfb-counter" aria-live="off">',
          '<span class="pmg-tfb-count-chars">0 chars</span>',
          '<span class="pmg-tfb-count-sep" aria-hidden="true">·</span>',
          '<span class="pmg-tfb-count-tokens">~0 tokens</span>',
        '</div>',
      '</div>',
      '<div class="pmg-tfb-row pmg-tfb-tuning" hidden></div>',
      '<div class="pmg-tfb-row pmg-tfb-linter" hidden>',
        '<span class="pmg-tfb-linter-label">Try sharpening:</span>',
        '<div class="pmg-tfb-linter-chips" role="list"></div>',
      '</div>'
    ].join('');
    return root;
  }

  function ensureMounted() {
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;
    var goal = getGoalEl();
    if (!goal) return null;
    var anchor = goal.closest('.field') || goal.parentNode;
    if (!anchor || !anchor.parentNode) return null;
    var root = buildRoot();
    anchor.parentNode.insertBefore(root, anchor.nextSibling);
    return root;
  }

  /* ---------------- Render ---------------- */

  function renderTuning(root) {
    var box = root.querySelector('.pmg-tfb-tuning');
    if (!box) return;
    var tuning = readTuning();
    var chips = [];
    Object.keys(TUNE_DEFAULTS).forEach(function (key) {
      var v = tuning[key];
      if (!v) return;
      if (v === TUNE_DEFAULTS[key]) return;
      var label = selectedLabel(key, v);
      if (!label) return;
      var keyLabel = escapeHtml(TUNE_LABELS[key]);
      chips.push(
        '<span class="pmg-tfb-chip" title="' + escapeAttr(TUNE_LABELS[key]) + '">' +
          '<span class="pmg-tfb-chip-key">' + keyLabel + '</span>' +
          '<span class="pmg-tfb-chip-val">' + escapeHtml(label) + '</span>' +
        '</span>'
      );
    });
    if (chips.length === 0) {
      box.hidden = true;
      box.innerHTML = '';
    } else {
      box.hidden = false;
      box.innerHTML = '<span class="pmg-tfb-tuning-label">Tuning:</span>' + chips.join('');
    }
  }

  function renderMeter(root, text, vague) {
    var meter = root.querySelector('.pmg-tfb-meter');
    var label = root.querySelector('.pmg-tfb-meter-label');
    if (!meter || !label) return;
    var q = scoreQuality(text, vague.length);
    meter.setAttribute('data-tone', q.tone);
    label.textContent = q.label;
  }

  function renderCounter(root, text) {
    var chars = root.querySelector('.pmg-tfb-count-chars');
    var tokens = root.querySelector('.pmg-tfb-count-tokens');
    var counter = root.querySelector('.pmg-tfb-counter');
    if (!chars || !tokens || !counter) return;
    var len = (text || '').length;
    var tk = estimateTokens(text);
    chars.textContent = len + ' char' + (len === 1 ? '' : 's');
    tokens.textContent = '~' + tk + ' token' + (tk === 1 ? '' : 's');
    counter.classList.toggle('is-warn', len >= 2000);
  }

  function renderLinter(root, vague) {
    var box = root.querySelector('.pmg-tfb-linter');
    var chips = root.querySelector('.pmg-tfb-linter-chips');
    if (!box || !chips) return;
    if (!vague || vague.length === 0) {
      box.hidden = true;
      chips.innerHTML = '';
      return;
    }
    box.hidden = false;
    chips.innerHTML = vague.slice(0, 5).map(function (hit) {
      return '<button type="button" class="pmg-tfb-lchip" role="listitem" ' +
             'data-vague="' + escapeAttr(hit.word) + '" ' +
             'title="' + escapeAttr(hit.suggestion) + '">' +
               '<span class="pmg-tfb-lchip-word">"' + escapeHtml(hit.word) + '"</span>' +
               '<span class="pmg-tfb-lchip-sep" aria-hidden="true">→</span>' +
               '<span class="pmg-tfb-lchip-tip">' + escapeHtml(hit.suggestion) + '</span>' +
             '</button>';
    }).join('');
  }

  function render() {
    var root = ensureMounted();
    if (!root) return;
    var goal = getGoalEl();
    var text = goal ? (goal.value || '') : '';
    var vague = findVagueMatches(text);
    renderTuning(root);
    renderMeter(root, text, vague);
    renderCounter(root, text);
    renderLinter(root, vague);
  }

  /* ---------------- Wiring ---------------- */

  function highlightWord(word) {
    var goal = getGoalEl();
    if (!goal || !word) return;
    var lower = (goal.value || '').toLowerCase();
    var pattern = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    var match = pattern.exec(lower);
    if (!match) return;
    try {
      goal.focus();
      goal.setSelectionRange(match.index, match.index + match[0].length);
      var rough = (typeof goal.scrollHeight === 'number' && goal.value.length > 0)
        ? Math.floor((match.index / goal.value.length) * goal.scrollHeight) - 40
        : 0;
      if (typeof goal.scrollTo === 'function' && rough > 0) {
        goal.scrollTo({ top: rough, behavior: 'smooth' });
      }
    } catch (_) {}
  }

  function wireRoot(root) {
    if (!root || root.__pmgTfbWired) return;
    root.__pmgTfbWired = true;
    root.addEventListener('click', function (ev) {
      var chip = ev.target && ev.target.closest && ev.target.closest('.pmg-tfb-lchip');
      if (chip) {
        highlightWord(chip.getAttribute('data-vague'));
      }
    });
  }

  function wireGoal() {
    var goal = getGoalEl();
    if (!goal || goal.__pmgTfbBound) return;
    goal.__pmgTfbBound = true;
    var debounce = null;
    goal.addEventListener('input', function () {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(render, 80);
    });
    /* Also catch programmatic value changes via change events. */
    goal.addEventListener('change', render);
  }

  function wireTuning() {
    Object.keys(TUNE_DEFAULTS).forEach(function (key) {
      var el = document.getElementById(key);
      if (!el || el.__pmgTfbBound) return;
      el.__pmgTfbBound = true;
      el.addEventListener('change', render);
    });
  }

  /* The Pro tuning UI re-renders selects; observe and re-bind. */
  function observeReady() {
    var observer = new MutationObserver(function () {
      ensureMounted();
      wireGoal();
      wireTuning();
      var root = document.getElementById(ROOT_ID);
      if (root) wireRoot(root);
      render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    /* Stop observing after 30s — by then the page is fully built. */
    setTimeout(function () { try { observer.disconnect(); } catch (_) {} }, 30000);
  }

  /* ---------------- Helpers ---------------- */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---------------- Boot ---------------- */

  function boot() {
    injectStyles();
    ensureMounted();
    wireGoal();
    wireTuning();
    var root = document.getElementById(ROOT_ID);
    if (root) wireRoot(root);
    render();
    observeReady();
    /* Refresh when other features save to vault, just to keep counters
       in sync with whatever they may have changed. Cheap call. */
    document.addEventListener('pmg:vault-saved', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgTextFeedback = {
    refresh: render,
    getState: function () {
      var goal = getGoalEl();
      var text = goal ? goal.value : '';
      var vague = findVagueMatches(text);
      return {
        text: text,
        chars: text.length,
        tokens: estimateTokens(text),
        vague: vague,
        quality: scoreQuality(text, vague.length),
        tuning: readTuning()
      };
    },
    dismiss: function () {
      var root = document.getElementById(ROOT_ID);
      if (root && root.parentNode) root.parentNode.removeChild(root);
    }
  };
})();
