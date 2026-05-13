/* ============================================================================
 * pmg-cap-comparison.js (cap-compare-1)
 * ----------------------------------------------------------------------------
 * Renders the side-by-side comparison panel inside #aiResponseOutput when a
 * signed-in free user hits their daily Run cap and POST /api/run returns a
 * 429 with the new cap-compare body shape:
 *   {
 *     success: false, ok: false,
 *     error: "Daily limit reached…",
 *     cappedAt: "run",
 *     runsCap: number,
 *     teaser:           { model, preview, truncated } | null,
 *     teaserExhausted:  boolean
 *   }
 *
 * Two render modes:
 *   1. teaser present  -> two columns. LEFT = the user's last successful
 *                         GPT-4.1-mini result (cached this session); if no
 *                         prior result, a placeholder explaining they're
 *                         seeing tomorrow's tier today. RIGHT = the GPT-4.1
 *                         teaser, with the final sentence blurred + a fade
 *                         gradient at the bottom edge so it reads as
 *                         "there's more, but you need to upgrade".
 *   2. teaserExhausted -> single full-width upgrade card. Per user direction:
 *                         a blurred placeholder when there's nothing real to
 *                         show would feel like a dead end, so we collapse to
 *                         a focused upgrade pitch instead.
 *
 * Conversion CTA copy is intentionally contextual rather than generic:
 *   - With teaser:  "You're {N}/{N} today. Unlock unlimited Runs → $79 lifetime"
 *   - Exhausted:    "You've hit your daily limit. Unlock 15 Runs/day with
 *                    full GPT-4.1 — $79 once, lifetime access."
 *
 * Disable: ?nocompare URL param OR localStorage.pmg_cap_compare_disable='1'.
 * Public API: window.pmgCapComparison.{render, recordResult, dismiss, getLast}.
 * ========================================================================= */
(function () {
  'use strict';

  if (window.pmgCapComparison) return;

  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.has('nocompare')) return;
    if (window.localStorage && window.localStorage.pmg_cap_compare_disable === '1') return;
  } catch (_) {}

  var _lastResultText = '';
  var PRICING_HREF = '/pricing.html#founding';

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Split the teaser into a "clear" body + a "trailing" snippet. The
   *  trailing snippet gets blurred + faded so it reads as "more is locked".
   *  Strategy: keep the first ~75% of characters clear, blur the rest. */
  function splitTeaser(text) {
    var s = String(text || '').trim();
    if (!s) return { head: '', tail: '' };
    if (s.length < 60) return { head: s, tail: '' };
    var cut = Math.max(60, Math.floor(s.length * 0.72));
    // Try to cut on a sentence/word boundary near `cut` so the blur
    // doesn't bisect a word awkwardly.
    var window = s.slice(Math.max(0, cut - 30), Math.min(s.length, cut + 30));
    var rel = window.search(/[.!?]\s+/);
    if (rel >= 0) {
      cut = Math.max(0, cut - 30) + rel + 1;
    } else {
      var spaceRel = window.lastIndexOf(' ');
      if (spaceRel > 0) cut = Math.max(0, cut - 30) + spaceRel;
    }
    return { head: s.slice(0, cut).trim(), tail: s.slice(cut).trim() };
  }

  function buildComparisonHtml(payload, currentPrompt) {
    var teaser = payload && payload.teaser;
    var split = splitTeaser(teaser && teaser.preview);
    var capN = Number(payload && payload.runsCap) || 2;
    var leftHasPrior = !!_lastResultText && _lastResultText.length > 0;
    var leftLabel = leftHasPrior
      ? 'Your last result · GPT-4.1-mini'
      : 'GPT-4.1-mini · today\u2019s free tier';
    var leftBody = leftHasPrior
      ? escapeHtml(_lastResultText)
      : escapeHtml(
          'You\u2019ve used all ' + capN + ' free runs today. The right side ' +
          'shows the same prompt you just tried, run on full GPT-4.1.'
        );

    var rightHead = escapeHtml(split.head);
    var rightTail = escapeHtml(split.tail);

    return [
      '<div class="pmg-cap-compare" data-mode="compare" role="region" aria-label="Daily Run limit reached \u2014 compare GPT-4.1-mini vs GPT-4.1">',
      '  <div class="pmg-cap-compare__head">',
      '    <span class="pmg-cap-compare__eyebrow">\u26A0 Daily Run limit reached</span>',
      '    <span class="pmg-cap-compare__meta">Resets at midnight UTC</span>',
      '  </div>',
      '  <div class="pmg-cap-compare__cols">',
      '    <div class="pmg-cap-compare__col pmg-cap-compare__col--free">',
      '      <div class="pmg-cap-compare__col-label">' + escapeHtml(leftLabel) + '</div>',
      '      <div class="pmg-cap-compare__col-body">' + leftBody + '</div>',
      '    </div>',
      '    <div class="pmg-cap-compare__col pmg-cap-compare__col--paid">',
      '      <div class="pmg-cap-compare__col-label">',
      '        <span class="pmg-cap-compare__badge">GPT-4.1 \u00b7 preview</span>',
      '      </div>',
      '      <div class="pmg-cap-compare__col-body pmg-cap-compare__col-body--paid">',
      '        <span class="pmg-cap-compare__teaser-head">' + (rightHead || escapeHtml('—')) + '</span>',
      (rightTail ? '        <span class="pmg-cap-compare__teaser-tail">' + rightTail + '</span>' : ''),
      '        <div class="pmg-cap-compare__teaser-fade" aria-hidden="true"></div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="pmg-cap-compare__cta-row">',
      '    <a class="pmg-cap-compare__cta" href="' + PRICING_HREF + '" data-pmg-cap-compare-cta="teaser">',
      '      You\u2019re ' + capN + '/' + capN + ' today. Unlock unlimited Runs \u2192 $79 lifetime',
      '    </a>',
      '    <button type="button" class="pmg-cap-compare__dismiss" data-pmg-cap-compare-dismiss="1" aria-label="Dismiss">Dismiss</button>',
      '  </div>',
      '</div>',
    ].filter(Boolean).join('\n');
  }

  function buildExhaustedHtml(payload) {
    var capN = Number(payload && payload.runsCap) || 2;
    return [
      '<div class="pmg-cap-compare" data-mode="exhausted" role="region" aria-label="Daily Run limit reached">',
      '  <div class="pmg-cap-compare__head">',
      '    <span class="pmg-cap-compare__eyebrow">\u26A0 Daily Run limit reached</span>',
      '    <span class="pmg-cap-compare__meta">Resets at midnight UTC</span>',
      '  </div>',
      '  <div class="pmg-cap-compare__solo">',
      '    <div class="pmg-cap-compare__solo-title">You\u2019ve hit your daily limit.</div>',
      '    <div class="pmg-cap-compare__solo-sub">',
      '      You ran ' + capN + ' prompts today on GPT-4.1-mini. Founding members get ',
      '      <strong>15 Runs/day on full GPT-4.1</strong> \u2014 same prompt, sharper output, longer answers.',
      '    </div>',
      '    <a class="pmg-cap-compare__cta pmg-cap-compare__cta--solo" href="' + PRICING_HREF + '" data-pmg-cap-compare-cta="exhausted">',
      '      Unlock 15 Runs/day with full GPT-4.1 \u2014 $79 once, lifetime access',
      '    </a>',
      '    <button type="button" class="pmg-cap-compare__dismiss pmg-cap-compare__dismiss--solo" data-pmg-cap-compare-dismiss="1" aria-label="Dismiss">Dismiss</button>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function render(payload, container, currentPrompt) {
    if (!container) return false;
    var safe = payload && typeof payload === 'object' ? payload : {};
    var hasTeaser = !!(safe.teaser && safe.teaser.preview);
    var html = hasTeaser
      ? buildComparisonHtml(safe, currentPrompt)
      : buildExhaustedHtml(safe);
    try {
      container.classList.remove('is-streaming');
      container.classList.remove('is-clamped');
      container.innerHTML = html;
      // Make sure the panel is visible (some prior states inline-hide).
      container.removeAttribute('hidden');
      container.style.removeProperty('display');
      container.style.removeProperty('visibility');
      try { container.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    } catch (_) {
      return false;
    }
    return true;
  }

  function dismiss() {
    var nodes = document.querySelectorAll('.pmg-cap-compare');
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].parentNode && nodes[i].parentNode.removeChild(nodes[i]); } catch (_) {}
    }
  }

  function recordResult(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return;
    _lastResultText = t.length > 8000 ? t.slice(0, 8000) : t;
  }

  function getLast() { return _lastResultText; }

  // Delegated dismiss handler. CTA is a real <a href> so default nav works.
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-pmg-cap-compare-dismiss="1"]')) {
      dismiss();
    }
  });

  window.pmgCapComparison = { render: render, dismiss: dismiss, recordResult: recordResult, getLast: getLast };
})();
