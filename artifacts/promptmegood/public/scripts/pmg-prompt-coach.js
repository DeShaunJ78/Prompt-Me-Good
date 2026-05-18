/* pmg-prompt-coach.js — Phase 2 (coach-1)
 * Invisible-until-typing widget for the homepage, mounted in the
 * empty space between the templates trigger and the Build button.
 *
 * Fuses three previously-disjoint signals into one calm bar:
 *   - Prompt-strength score   (0–100, heuristic, client-side)
 *   - Token + cost estimate   (chars/4 → GPT-4o-mini @ $0.15/1M in)
 *   - Up to 2 adaptive chips  (gap-based tips: add audience, etc.)
 *
 * Cost: $0 API. All scoring runs in the browser on each keystroke
 * (debounced 120ms).
 *
 * Kill-switch: ?nocoach in URL or localStorage.pmg_coach_disable='1'.
 */
(function () {
  'use strict';

  // ---------- kill-switches ----------
  try {
    if (location.search.indexOf('nocoach') >= 0) return;
    if (localStorage.getItem('pmg_coach_disable') === '1') return;
  } catch (_) {}

  var SHOW_AT_CHARS = 20;         // wait for a partial thought before showing coach
  var DEBOUNCE_MS   = 120;
  var ROOT_ID       = 'pmg-coach-root';
  var BODY_CLASS    = 'pmg-coach-on';

  // ---------- heuristic scoring ----------
  // Returns { score: 0-100, signals: {len, verb, audience, context, format, specifics}, gaps: [chipKey,...] }
  function score(text) {
    var t = (text || '').trim();
    var len = t.length;
    var lower = t.toLowerCase();

    // Length curve: 0 at 0 chars, 100 at 50–280, falls off past 500.
    var lenScore = 0;
    if (len > 0)   lenScore = Math.min(100, Math.round((len / 50) * 100));
    if (len >= 50) lenScore = 100;
    if (len > 280) lenScore = Math.max(60, 100 - Math.round((len - 280) / 5));

    var verb     = /\b(write|create|build|generate|design|plan|draft|outline|summari[sz]e|explain|analy[sz]e|compare|list|describe|make|produce|translate|edit|review|rewrite|improve|optimi[sz]e)\b/i.test(t);
    var audience = /\b(for (?:a |an |my )?\w+|to (?:a |an |my )?\w+|audience|reader|customer|user|student|beginner|expert|team|client)\b/i.test(lower);
    var context  = /\b(because|so that|in order to|when|where|with|using|based on|context|background)\b/i.test(lower);
    var format   = /\b(list|table|markdown|json|bullet|paragraph|email|tweet|post|essay|outline|step|format|sections?)\b/i.test(lower);
    var specifics = /\b(\d+|specific|exactly|named?|brand|product|company)\b/i.test(lower);

    // Component weights (sum to 100): length 30, verb 15, audience 20, context 10, format 15, specifics 10
    var s = 0;
    s += Math.round(lenScore * 0.30);
    s += verb     ? 15 : 0;
    s += audience ? 20 : 0;
    s += context  ? 10 : 0;
    s += format   ? 15 : 0;
    s += specifics ? 10 : 0;
    s = Math.max(0, Math.min(100, s));

    var gaps = [];
    if (len > 0 && len < 20)  gaps.push('detail');
    if (!verb)                gaps.push('verb');
    if (!audience)            gaps.push('audience');
    if (!format && len > 30)  gaps.push('format');
    if (!specifics && len > 60) gaps.push('specifics');
    if (len > 500)            gaps.push('trim');

    return {
      score: s,
      signals: { len: len, verb: verb, audience: audience, context: context, format: format, specifics: specifics },
      gaps: gaps
    };
  }

  // ---------- adaptive chip catalog (coach-4 mini-pickers) ----------
  // Each chip opens a one-line picker beneath the bar with 3-6
  // suggested answers plus a "Type your own…" affordance. Each option
  // (or custom text) is inserted into #goal via a chip-specific
  // grammar-aware joiner — never a blind append. This avoids the
  // "...for new shoe launch to existing customers for " dangling
  // tail that Option A's user feedback exposed.

  // Strip trailing prepositions / conjunctions / whitespace so we
  // don't double-up joiners ("...for for beginners").
  var TRAILING_JOIN_RE = /(?:\s+(?:for|to|with|by|in|on|at|about|as|of|and|or)\s*[,.!?:;]?)+\s*$/i;
  function stripTrailingJoin(text) {
    return (text || '').replace(TRAILING_JOIN_RE, '').replace(/\s+$/, '');
  }
  function endsWithSentence(text) { return /[.!?]\s*$/.test(text); }

  function articleFor(word) {
    return /^[aeiou]/i.test((word || '').trim()) ? 'an' : 'a';
  }

  var CHIPS = {
    verb: {
      label: 'Use an action verb',
      question: 'What action?',
      options: ['Write', 'Create', 'Explain', 'Plan', 'Summarize', 'Compare'],
      custom: true,
      apply: function (text, choice) {
        var t = (text || '').replace(/^\s+/, '');
        // Replace an existing leading weak verb / article if present.
        t = t.replace(/^(write|create|build|generate|design|plan|draft|outline|summari[sz]e|explain|analy[sz]e|compare|list|describe|make|produce|translate|edit|review|rewrite|improve|optimi[sz]e)\s+(a |an |the )?/i, '');
        // Lowercase the very first word so the sentence reads cleanly.
        t = t.replace(/^([A-Z])/, function (_, c) { return c.toLowerCase(); });
        var lead = articleFor(t.split(/\s+/)[0] || '');
        return choice + ' ' + lead + ' ' + t;
      }
    },
    audience: {
      label: 'Who is it for?',
      question: "Who's it for?",
      options: ['Beginners', 'Customers', 'My team', 'Executives', 'Kids'],
      custom: true,
      apply: function (text, choice) {
        var clean = stripTrailingJoin(text);
        var lc = (choice || '').toLowerCase().trim();
        return clean + ' for ' + lc;
      }
    },
    format: {
      label: 'Pick a format',
      question: 'What format?',
      options: ['Email', 'Bullet list', 'Table', 'Short paragraph', 'Step-by-step'],
      custom: true,
      apply: function (text, choice) {
        var clean = stripTrailingJoin(text);
        var lc = (choice || '').toLowerCase().trim();
        var phrase;
        if (lc === 'step-by-step')      phrase = ' as a step-by-step guide';
        else if (lc === 'bullet list')  phrase = ' as a bulleted list';
        else if (lc === 'short paragraph') phrase = ' as a short paragraph';
        else                            phrase = ' as ' + articleFor(lc) + ' ' + lc;
        return clean + phrase;
      }
    },
    specifics: {
      label: 'Add specifics',
      question: 'What specific detail?',
      options: ['A number', 'A brand', 'A deadline', 'A tone'],
      custom: true,
      customRequired: true, // options just seed the placeholder
      placeholderFor: function (opt) {
        if (!opt) return 'e.g. 5 bullet points, by Friday, brand: Nike…';
        if (/number/i.test(opt))   return 'e.g. 5 bullet points, 200 words…';
        if (/brand/i.test(opt))    return 'e.g. Nike Air Max, Apple…';
        if (/deadline/i.test(opt)) return 'e.g. by Friday, this quarter…';
        if (/tone/i.test(opt))     return 'e.g. friendly, formal, punchy…';
        return '';
      },
      apply: function (text, _opt, customText) {
        if (!customText) return text;
        var clean = stripTrailingJoin(text);
        var sep = endsWithSentence(clean) ? ' ' : ' — ';
        return clean + sep + customText.trim();
      }
    },
    detail: {
      label: 'Add detail',
      question: 'What detail to add?',
      options: [],
      custom: true,
      customRequired: true,
      placeholderFor: function () { return 'Add one specific thing you want…'; },
      apply: function (text, _opt, customText) {
        if (!customText) return text;
        var clean = stripTrailingJoin(text);
        var sep = endsWithSentence(clean) ? ' ' : ' — ';
        return clean + sep + customText.trim();
      }
    },
    trim: {
      label: 'Trim it down',
      question: 'Your prompt is long — keep going or shorten it?',
      options: ['Keep as-is'],
      custom: false,
      apply: function (text) { return text; } // no-op; the question itself is the nudge
    }
  };

  // ---------- DOM build ----------
  function buildWidget() {
    if (document.getElementById(ROOT_ID)) return document.getElementById(ROOT_ID);
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'pmg-coach';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="pmg-coach__row pmg-coach__row--meter">' +
        '<div class="pmg-coach__bar" aria-hidden="true">' +
          '<div class="pmg-coach__fill" id="pmg-coach-fill"></div>' +
        '</div>' +
        '<div class="pmg-coach__meta">' +
          '<span class="pmg-coach__score" id="pmg-coach-score">0</span>' +
          '<span class="pmg-coach__label" id="pmg-coach-label">Start typing</span>' +
        '</div>' +
      '</div>' +
      '<div class="pmg-coach__row pmg-coach__row--info">' +
        '<span class="pmg-coach__chips" id="pmg-coach-chips"></span>' +
      '</div>';
    return root;
  }

  function mount() {
    if (document.getElementById(ROOT_ID)) return true;
    // coach-2: mount directly UNDER the #goal textarea, in the exact
    // slot the legacy #pmg-strength-pill used to occupy. Previous anchor
    // (#generate-section) put the coach BELOW the Build button on
    // mobile, which felt disconnected. We also retire the legacy pill
    // here since this widget supersedes it.
    var goal = document.getElementById('goal');
    if (!goal || !goal.parentNode) return false;

    var legacy = document.getElementById('pmg-strength-pill');
    if (legacy) legacy.style.display = 'none';

    var widget = buildWidget();
    // Insert immediately after the textarea (before any helper text).
    goal.parentNode.insertBefore(widget, goal.nextSibling);
    return true;
  }

  function strengthLabel(s) {
    if (s < 25)  return 'Sketchy';
    if (s < 50)  return 'Getting there';
    if (s < 75)  return 'Solid';
    if (s < 90)  return 'Strong';
    return 'Excellent';
  }

  // ---------- chip wiring (coach-4 mini-picker) ----------
  function applyAndClose(host, goalEl, key, option, customText) {
    var def = CHIPS[key];
    if (!def || !goalEl) return;
    var next = def.apply(goalEl.value || '', option, customText);
    if (typeof next === 'string') {
      goalEl.value = next;
      goalEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    delete host.dataset.pickerOpen;
    goalEl.focus();
    // Move cursor to end for natural continuation.
    try { goalEl.setSelectionRange(goalEl.value.length, goalEl.value.length); } catch (_) {}
  }

  function openPicker(host, goalEl, key) {
    var def = CHIPS[key];
    if (!def) return;
    host.dataset.pickerOpen = key;
    host.innerHTML = '';

    var picker = document.createElement('div');
    picker.className = 'pmg-coach__picker';

    // Header row: ← back  |  Question
    var head = document.createElement('div');
    head.className = 'pmg-coach__picker-head';
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'pmg-coach__picker-back';
    back.setAttribute('aria-label', 'Back');
    back.innerHTML = '←';
    back.addEventListener('click', function () {
      delete host.dataset.pickerOpen;
      lastText = null; // force a re-render
      update(goalEl);
    });
    var q = document.createElement('span');
    q.className = 'pmg-coach__picker-q';
    q.textContent = def.question;
    head.appendChild(back);
    head.appendChild(q);
    picker.appendChild(head);

    // Options row.
    var opts = document.createElement('div');
    opts.className = 'pmg-coach__picker-opts';

    (def.options || []).forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-coach__chip pmg-coach__chip--opt';
      b.textContent = opt;
      b.addEventListener('click', function () {
        if (def.customRequired) {
          // Open custom input pre-seeded with this option's placeholder.
          showCustomInput(picker, host, goalEl, key, opt);
        } else {
          applyAndClose(host, goalEl, key, opt);
        }
      });
      opts.appendChild(b);
    });

    if (def.custom) {
      var typeOwn = document.createElement('button');
      typeOwn.type = 'button';
      typeOwn.className = 'pmg-coach__chip pmg-coach__chip--type';
      typeOwn.innerHTML = '<span aria-hidden="true">✏️</span> Type your own';
      typeOwn.addEventListener('click', function () {
        showCustomInput(picker, host, goalEl, key, null);
      });
      opts.appendChild(typeOwn);
    }

    picker.appendChild(opts);
    host.appendChild(picker);

    // For chips where custom is required (detail, specifics), auto-open
    // the input so the user doesn't need an extra tap.
    if (def.customRequired) showCustomInput(picker, host, goalEl, key, null);
  }

  function showCustomInput(picker, host, goalEl, key, seedOpt) {
    var def = CHIPS[key];
    // Remove any previous input row.
    var prev = picker.querySelector('.pmg-coach__picker-input');
    if (prev) prev.remove();

    var row = document.createElement('div');
    row.className = 'pmg-coach__picker-input';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'pmg-coach__input';
    input.placeholder = (def.placeholderFor ? def.placeholderFor(seedOpt) : '') || 'Type and press Enter…';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'sentences');

    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'pmg-coach__input-go';
    go.textContent = 'Add';

    function submit() {
      var v = (input.value || '').trim();
      if (!v) { input.focus(); return; }
      applyAndClose(host, goalEl, key, seedOpt, v);
    }
    go.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') {
        delete host.dataset.pickerOpen;
        lastText = null;
        update(goalEl);
      }
    });

    row.appendChild(input);
    row.appendChild(go);
    picker.appendChild(row);
    setTimeout(function () { input.focus(); }, 30);
  }

  function renderChips(host, gaps, goalEl) {
    // Don't blow away an open picker on re-render (e.g. while user typing).
    if (host.dataset.pickerOpen) return;
    host.innerHTML = '';
    var picks = gaps.slice(0, 2);
    picks.forEach(function (key) {
      var def = CHIPS[key];
      if (!def) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-coach__chip';
      b.setAttribute('data-coach-chip', key);
      b.textContent = def.label;
      b.addEventListener('click', function () { openPicker(host, goalEl, key); });
      host.appendChild(b);
    });
  }

  // ---------- update loop ----------
  var lastText = null;
  function update(goalEl) {
    var t = goalEl ? (goalEl.value || '') : '';
    if (t === lastText) return;
    lastText = t;

    if (t.trim().length < SHOW_AT_CHARS) {
      document.body.classList.remove(BODY_CLASS);
      return;
    }
    if (!mount()) return;
    document.body.classList.add(BODY_CLASS);

    var s = score(t);

    var fill = document.getElementById('pmg-coach-fill');
    var sc   = document.getElementById('pmg-coach-score');
    var lab  = document.getElementById('pmg-coach-label');
    var chips = document.getElementById('pmg-coach-chips');

    if (fill) {
      fill.style.width = s.score + '%';
      fill.setAttribute('data-band',
        s.score >= 75 ? 'good' : s.score >= 50 ? 'ok' : 'weak');
    }
    if (sc)  sc.textContent  = String(s.score);
    if (lab) lab.textContent = strengthLabel(s.score);
    if (chips) renderChips(chips, s.gaps, goalEl);
  }

  // ---------- wiring ----------
  function attach() {
    var goal = document.getElementById('goal');
    if (!goal) return false;
    if (goal.__pmgCoachWired) return true;
    goal.__pmgCoachWired = true;

    var t = null;
    var handler = function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { update(goal); }, DEBOUNCE_MS);
    };
    goal.addEventListener('input', handler);
    goal.addEventListener('change', handler);
    // Initial render (in case of restored draft).
    update(goal);
    return true;
  }

  function boot() {
    if (attach()) return;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (attach() || tries > 60) clearInterval(iv);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
