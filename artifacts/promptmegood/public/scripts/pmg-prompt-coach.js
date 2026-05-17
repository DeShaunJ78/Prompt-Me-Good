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

  var SHOW_AT_CHARS = 2;          // first signal appears almost immediately
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

  // ---------- token + cost estimate ----------
  // chars/4 ≈ tokens for English. GPT-4o-mini input is $0.15 / 1M tokens.
  function tokenCost(text) {
    var t = (text || '');
    var tokens = Math.max(0, Math.ceil(t.length / 4));
    var cost = tokens * 0.15 / 1000000; // USD
    return { tokens: tokens, cost: cost };
  }
  function fmtCost(c) {
    if (c <= 0)        return '$0';
    if (c < 0.0001)    return '<$0.001';
    if (c < 0.01)      return '$' + c.toFixed(4);
    return '$' + c.toFixed(3);
  }

  // ---------- adaptive chip catalog ----------
  // Single short tip per gap. Tapping a chip appends a scaffold to #goal.
  var CHIPS = {
    detail:    { label: 'Add detail',     hint: ' (include 1–2 specifics about what you want)' },
    verb:      { label: 'Use an action verb', hint: 'Write a ' },
    audience:  { label: 'Who is it for?', hint: ' for ' },
    format:    { label: 'Pick a format',  hint: ' as a bulleted list' },
    specifics: { label: 'Add specifics',  hint: ' (e.g. exact numbers, named brand, audience size)' },
    trim:      { label: 'Trim it down',   hint: null }   // info-only
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
        '<span class="pmg-coach__tokens" id="pmg-coach-tokens">~0 tokens · $0</span>' +
        '<span class="pmg-coach__chips" id="pmg-coach-chips"></span>' +
      '</div>';
    return root;
  }

  function mount() {
    if (document.getElementById(ROOT_ID)) return true;
    // Anchor before #generate-section if present (keeps coach above Build),
    // otherwise after #pmg-templates-trigger or as last child of idea-section.
    var anchor =
      document.getElementById('generate-section') ||
      document.querySelector('.idea-section .pmgv3-idea-host');
    if (!anchor || !anchor.parentNode) return false;
    var widget = buildWidget();
    anchor.parentNode.insertBefore(widget, anchor);
    return true;
  }

  function strengthLabel(s) {
    if (s < 25)  return 'Sketchy';
    if (s < 50)  return 'Getting there';
    if (s < 75)  return 'Solid';
    if (s < 90)  return 'Strong';
    return 'Excellent';
  }

  // ---------- chip wiring ----------
  function renderChips(host, gaps, goalEl) {
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
      b.addEventListener('click', function () {
        if (!def.hint || !goalEl) return;
        // Append-style scaffold for most chips; prepend for the 'verb' chip.
        if (key === 'verb') {
          goalEl.value = def.hint + (goalEl.value || '');
        } else {
          goalEl.value = (goalEl.value || '').replace(/\s+$/, '') + def.hint;
        }
        goalEl.focus();
        goalEl.dispatchEvent(new Event('input', { bubbles: true }));
      });
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
    var tc = tokenCost(t);

    var fill = document.getElementById('pmg-coach-fill');
    var sc   = document.getElementById('pmg-coach-score');
    var lab  = document.getElementById('pmg-coach-label');
    var tok  = document.getElementById('pmg-coach-tokens');
    var chips = document.getElementById('pmg-coach-chips');

    if (fill) {
      fill.style.width = s.score + '%';
      fill.setAttribute('data-band',
        s.score >= 75 ? 'good' : s.score >= 50 ? 'ok' : 'weak');
    }
    if (sc)  sc.textContent  = String(s.score);
    if (lab) lab.textContent = strengthLabel(s.score);
    if (tok) tok.textContent = '~' + tc.tokens + ' tokens · ' + fmtCost(tc.cost);
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
