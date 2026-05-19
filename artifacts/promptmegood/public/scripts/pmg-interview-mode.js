/* =============================================================================
 * pmg-interview-mode.js (im-1, 2026-05-19) — v4 Master Spec §2.3
 * -----------------------------------------------------------------------------
 * Interview Mode tier-split logic.
 *
 *   FREE TIER: when the #interviewMode checkbox is on AND the user is on
 *   the free plan, the Build click is intercepted and 3 client-side
 *   clarifying questions are rendered into #resultBox. Zero API cost.
 *
 *   PAID TIERS: the toggle is forwarded through the normal /generate
 *   request body as `interviewMode: true`. The backend swaps SYSTEM_PROMPT
 *   to the clarifying-questions branch. /generate is not behind the daily
 *   per-user run cap, so this is naturally cap-exempt for paid users.
 *
 * We hook the form submit at capture so we run before pmg-ux.js's submit
 * handler. If anything goes wrong reading the plan, we fail OPEN (let the
 * request proceed) so we never block a paid user from building.
 *
 * Kill switches:
 *   ?nointerview   |   localStorage.pmg_interview_mode_disable = '1'
 * ========================================================================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  try {
    var qs = (location && location.search) || '';
    if (/[?&]nointerview(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_interview_mode_disable') === '1') return;
  } catch (_) {}

  /* readPlan: returns the explicit user plan, or 'unknown' if nothing
     authoritative was found. Architect P1 (2026-05-19): defaulting to
     'free' could intercept a paid user's click during a DOM race and
     lose their API call. shouldInterceptForFree() now requires
     plan === 'free' exactly — 'unknown' falls through to /generate. */
  function readPlan() {
    try {
      var attr = (document.documentElement && document.documentElement.getAttribute('data-plan')) ||
                 (document.body && document.body.getAttribute('data-plan')) || '';
      if (attr) return String(attr).toLowerCase();
      if (window.PMG_USER && window.PMG_USER.plan) return String(window.PMG_USER.plan).toLowerCase();
    } catch (_) {}
    return 'unknown';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  /* Build 3 clarifying questions purely from the local form state.
     Questions are picked from a small library that reads category /
     tone / personality / goal length to pick the most useful trio. */
  function buildLocalQuestions() {
    var goal = val('goal');
    var category = val('category').toLowerCase();
    var tone = val('tone');
    var personality = val('personality');
    var qs = [];

    /* Q1 — outcome specificity (always asked, phrased by length) */
    if (goal.length < 60) {
      qs.push('What does a successful answer look like for you — what would you do with it the moment you read it?');
    } else {
      qs.push('Out of everything you described, what is the single most important outcome — the one thing that absolutely has to work?');
    }

    /* Q2 — audience / context */
    if (/market|sales|business|growth|startup|brand|launch|product/.test(category)) {
      qs.push('Who is this answer for — what does your audience already know, and what would make them act?');
    } else if (/dev|code|tech|engineer|api/.test(category)) {
      qs.push('What stack, language, or constraints does this need to fit into? (Versions, frameworks, anything off-limits.)');
    } else if (/write|content|copy|essay|blog|email/.test(category)) {
      qs.push('Who is the reader, and what voice or examples should the writing match?');
    } else {
      qs.push('Who is this for, and is there any context (budget, deadline, skill level, tools) the AI should respect?');
    }

    /* Q3 — tone / format specificity */
    if (tone || personality) {
      qs.push('Are there any examples — a piece you love, a tone you want to match, or a format the answer should follow?');
    } else {
      qs.push('Is there a specific tone, length, or format you want — or should the AI pick what fits best?');
    }

    return qs;
  }

  function renderLocal(questions) {
    var box = document.getElementById('resultBox') || document.querySelector('.result-box, #resultText');
    if (!box) {
      try { alert('Interview Mode questions:\n\n1. ' + questions[0] + '\n2. ' + questions[1] + '\n3. ' + questions[2]); } catch (_) {}
      return;
    }
    var html =
      '<div class="pmg-interview-out" style="padding:18px 16px;line-height:1.5;">' +
        '<div style="font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;opacity:.75;">🎯 Interview Mode — answer these first</div>' +
        '<p style="margin:0 0 14px 0;opacity:.85;">Answer any of these in your goal box (or just one of them) and toggle Interview Mode off — you\'ll get a much sharper prompt.</p>' +
        '<ol style="margin:0;padding-left:22px;">' +
          '<li style="margin-bottom:10px;">' + escapeHtml(questions[0]) + '</li>' +
          '<li style="margin-bottom:10px;">' + escapeHtml(questions[1]) + '</li>' +
          '<li>' + escapeHtml(questions[2]) + '</li>' +
        '</ol>' +
      '</div>';
    box.innerHTML = html;
    try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function shouldInterceptForFree() {
    var iv = document.getElementById('interviewMode');
    if (!iv || !iv.checked) return false;
    var plan = readPlan();
    return plan === 'free';
  }

  /* Attach at capture so we run BEFORE pmg-ux.js's submit handler. */
  function attach() {
    var form = document.getElementById('prompt-form') || document.querySelector('form#prompt-form');
    if (!form) return false;
    if (form.__pmgInterviewBound) return true;
    form.__pmgInterviewBound = true;

    form.addEventListener('submit', function (e) {
      if (!shouldInterceptForFree()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        renderLocal(buildLocalQuestions());
      } catch (err) {
        try { console.warn('[pmg-interview-mode] local render failed', err); } catch (_) {}
      }
    }, true);

    /* Some chassis paths fire the build via an analyze-btn click that
       doesn't submit through the form. Catch that too. */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      var hit = t.closest('#analyze-btn, .btn-analyze, #generateBtn');
      if (!hit) return;
      if (!shouldInterceptForFree()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        renderLocal(buildLocalQuestions());
      } catch (err) {
        try { console.warn('[pmg-interview-mode] local render failed', err); } catch (_) {}
      }
    }, true);

    return true;
  }

  function start() {
    if (attach()) return;
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (attach() || attempts > 60) clearInterval(iv);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
