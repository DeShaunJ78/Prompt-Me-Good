/* =============================================================
 * pmg-router.js  (Spec 7 — Smart Send-To Router)
 *
 * Pure-function classifier. Given a prompt string + mode +
 * optional framework, returns the recommended external AI
 * destination — OR `chatgpt` as the safe default when signal
 * is weak.
 *
 * Confidence rule (locked):
 *   - A category needs 2+ signals to win.
 *   - If multiple categories win, return chatgpt (tie = no morph).
 *   - If zero categories win, return chatgpt (weak = no morph).
 *   - Single-keyword matches are NEVER enough on their own.
 *
 * Exposed:
 *   window.__pmgRouter.recommend(promptText, mode, framework?)
 *     → { destination, confidence, reason, intent }
 *
 * Kill-switches:
 *   ?norouter on the URL, or localStorage.pmg_router_disable='1'
 *   → always returns chatgpt / weak / 'default'
 * ============================================================= */
(function () {
  'use strict';
  if (window.__pmgRouter) return;

  var DEFAULT = {
    destination: 'chatgpt',
    confidence: 'weak',
    reason: 'Works well in any AI — defaulting to ChatGPT.',
    intent: 'default'
  };

  function disabled() {
    try {
      if (location.search.indexOf('norouter') !== -1) return true;
      if (localStorage.getItem('pmg_router_disable') === '1') return true;
    } catch (_) {}
    return false;
  }

  /* Keyword banks — lowercase, word-boundary matched. */
  var LONGFORM_KW = ['essay','article','report','analysis','breakdown','document','whitepaper','chapter','manuscript','thesis','dissertation'];
  var CODE_KW     = ['code','function','bug','refactor','debug','script','algorithm','class','method','exception'];
  var CODE_LANG   = ['typescript','javascript','python','rust','java','golang','go','sql','react','vue','angular','node','swift','kotlin','c++','c#','php','ruby'];
  var RESEARCH_EXPLICIT = ['latest','current','today','2025','2026','news','citation','citations','sources','recent','breaking','live'];
  var RESEARCH_SOFT     = ['research','compare','versus','alternatives','options','best'];
  var MULTIMODAL_KW     = ['image','photo','picture','visual','diagram','chart','infographic','screenshot','graph'];

  function wordCount(s) {
    if (!s) return 0;
    return (s.trim().match(/\S+/g) || []).length;
  }

  function countMatches(text, words) {
    var hits = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      /* word-boundary match, escaping a few regex chars */
      var safe = w.replace(/[+#]/g, '\\$&');
      var re = new RegExp('\\b' + safe + '\\b', 'i');
      if (re.test(text)) hits++;
    }
    return hits;
  }

  function classify(promptText, mode, framework) {
    if (disabled()) return DEFAULT;
    var text = String(promptText || '');
    if (!text.trim()) return DEFAULT;
    if (mode && mode !== 'text') return DEFAULT; /* v1: text panel only */

    var wc = wordCount(text);
    var fw = (framework || '').toLowerCase();

    /* ----- Score each category ----- */
    var scores = {};

    /* Long-form: word budget > 800 counts as 1 signal; framework=longform
       counts as 1 signal; each long-form keyword counts as 1. Needs 2+. */
    var longSignals = 0;
    if (wc > 800) longSignals++;
    if (fw === 'longform' || fw === 'long-form' || fw === 'essay' || fw === 'article') longSignals++;
    longSignals += countMatches(text, LONGFORM_KW);
    if (longSignals >= 2) scores.longform = longSignals;

    /* Code: needs both a code keyword AND a language/production marker. */
    var codeKwHits = countMatches(text, CODE_KW);
    var langHits = countMatches(text, CODE_LANG);
    var prodHit = /\bproduction\b/i.test(text) ? 1 : 0;
    var codeFwHit = (fw === 'code' || fw === 'technical') ? 1 : 0;
    /* Locked rule: 1+ code keyword AND 1+ from {language, "production",
       framework}. Two pure code keywords with no technical anchor are NOT
       enough — spec discipline to prevent generic "fix bug" from morphing. */
    if (codeKwHits >= 1 && (langHits + prodHit + codeFwHit) >= 1) {
      scores.code = codeKwHits + langHits + prodHit + codeFwHit;
    }

    /* Research: need 2+ signals total (explicit + soft combined). A single
       "latest" or "today" alone is NOT enough — locked spec. */
    var explicitHits = countMatches(text, RESEARCH_EXPLICIT);
    var softHits = countMatches(text, RESEARCH_SOFT);
    var researchTotal = explicitHits + softHits;
    if (researchTotal >= 2) scores.research = researchTotal + (explicitHits > 0 ? 1 : 0);

    /* Multimodal (text panel only — image/video panels handle this themselves).
       Needs 2+ keyword hits. */
    var mmHits = countMatches(text, MULTIMODAL_KW);
    if (mmHits >= 2) scores.multimodal = mmHits;

    /* Constructive intent beats informational intent. The optimized prompt
       in #resultBox often contains research-flavored words ("latest",
       "sources", "compare") as sub-instructions even when the user's true
       intent is to WRITE/CODE/ANALYZE-IMAGES. If any constructive category
       fires, treat research as a sub-step and drop it from contention. */
    if ((scores.longform || scores.code || scores.multimodal) && scores.research) {
      delete scores.research;
    }

    /* ----- Pick a winner ----- */
    var keys = Object.keys(scores);
    if (keys.length === 0) return DEFAULT;

    /* Sort by score desc. Tie among remaining constructive categories = no morph. */
    keys.sort(function (a, b) { return scores[b] - scores[a]; });
    if (keys.length > 1 && scores[keys[0]] === scores[keys[1]]) {
      return DEFAULT;
    }

    var winner = keys[0];
    switch (winner) {
      case 'longform':
        return {
          destination: 'claude',
          confidence: 'strong',
          reason: 'Recommended for long-form, structured writing.',
          intent: 'longform'
        };
      case 'code':
        return {
          destination: 'claude',
          confidence: 'strong',
          reason: 'Recommended for code and technical reasoning.',
          intent: 'code'
        };
      case 'research':
        return {
          destination: 'perplexity',
          confidence: 'strong',
          reason: 'Recommended for research with live citations.',
          intent: 'research'
        };
      case 'multimodal':
        return {
          destination: 'gemini',
          confidence: 'strong',
          reason: 'Recommended for image and visual analysis.',
          intent: 'multimodal'
        };
      default:
        return DEFAULT;
    }
  }

  window.__pmgRouter = {
    recommend: classify,
    DEFAULT: DEFAULT
  };
})();
