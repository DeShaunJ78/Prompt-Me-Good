/**
 * PromptMeGood — Surgical Polish Script
 * Applies only safe, copy + CSS improvements.
 * Does NOT remove any HTML elements or JS-dependent markup.
 * Run from repo root: node pmg_polish.js
 */

const fs = require('fs');
const FILE = 'artifacts/promptmegood/index.html';

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE + '. Run from repo root.');
  process.exit(1);
}

fs.copyFileSync(FILE, FILE + '.bak.' + Date.now());
let h = fs.readFileSync(FILE, 'utf8');
const fixes = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO HEADLINE — Lead with the user's pain, not a feature description
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('AI <span class="highlight">Prompt Generator</span><br>That Actually Gets Results')) {
  h = h.replace(
    'AI <span class="highlight">Prompt Generator</span><br>That Actually Gets Results',
    'Stop getting <span class="highlight">weak answers</span><br>from AI'
  );
  fixes.push('1. ✅  Hero headline → leads with user pain');
} else {
  fixes.push('1. ⚠️  Hero headline — already updated or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BUILDER SUBTITLE — Tighter, more confident
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('Fill in your goal below — the more specific, the better. Hit Generate and get a prompt you can use instantly.')) {
  h = h.replace(
    'Fill in your goal below — the more specific, the better. Hit Generate and get a prompt you can use instantly.',
    "Describe what you want. We'll build the prompt."
  );
  fixes.push('2. ✅  Builder subtitle tightened');
} else {
  fixes.push('2. ⚠️  Builder subtitle — already updated or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GOAL FIELD LABEL — Simpler, less instructional
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<label for="goal">Your Goal (Start Here)</label>')) {
  h = h.replace(
    '<label for="goal">Your Goal (Start Here)</label>',
    '<label for="goal">Your goal</label>'
  );
  fixes.push('3. ✅  Goal label simplified');
} else {
  fixes.push('3. ⚠️  Goal label — already updated or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RESULT PANEL HEADLINE — More confident
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<h2 id="result-title">Your ready-to-use prompt</h2>')) {
  h = h.replace(
    '<h2 id="result-title">Your ready-to-use prompt</h2>\n            <p>Copy this and paste it into ChatGPT, Claude, Perplexity, Google, or any AI/search tool.</p>',
    '<h2 id="result-title">Your prompt is ready</h2>\n            <p>Copy it and paste into ChatGPT, Claude, Perplexity, or any AI tool — or run it right here.</p>'
  );
  fixes.push('4. ✅  Result panel headline made more confident');
} else {
  fixes.push('4. ⚠️  Result panel headline — already updated or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RUN SECTION — Shorter, more action-oriented labels
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<h3 class="run-section-title">Run This Prompt With AI</h3>')) {
  h = h.replace(
    '<h3 class="run-section-title">Run This Prompt With AI</h3>',
    '<h3 class="run-section-title">Run it</h3>'
  );
  fixes.push('5. ✅  Run section title shortened to "Run it"');
} else {
  fixes.push('5. ⚠️  Run section title — already updated or not found');
}

if (h.includes('Your prompt is ready. Review it above, edit if needed, then run it here.')) {
  h = h.replace(
    'Your prompt is ready. Review it above, edit if needed, then run it here.',
    'Execute this prompt and get your AI response — right here.'
  );
  fixes.push('6. ✅  Run section helper text updated');
} else {
  fixes.push('6. ⚠️  Run section helper — already updated or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. TESTIMONIAL — Fix "Guide me" casing back to proper noun
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('Guide me walked me through everything')) {
  h = h.replace(
    'Guide me walked me through everything',
    'Guide Me walked me through everything'
  );
  fixes.push('7. ✅  "Guide Me" capitalization fixed in testimonial');
} else {
  fixes.push('7. ⚠️  Guide Me testimonial — already correct');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. QUICK START — Start collapsed (it's at the bottom, power users only)
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<details class="quick-start-card" id="quick-start-card" open>')) {
  h = h.replace(
    '<details class="quick-start-card" id="quick-start-card" open>',
    '<details class="quick-start-card" id="quick-start-card">'
  );
  fixes.push('8. ✅  Quick Start starts collapsed');
} else {
  fixes.push('8. ⚠️  Quick Start — already collapsed or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. HISTORY BUTTON LABELS — Shorter for mobile
// ─────────────────────────────────────────────────────────────────────────────
h = h.replace('>Show archived<', '>Archived<');
h = h.replace('>Compare two<', '>Compare<');
h = h.replace('>Collapse all<', '>Collapse<');
h = h.replace('>Clear all history<', '>Clear all<');
fixes.push('9. ✅  History button labels shortened for mobile');

// ─────────────────────────────────────────────────────────────────────────────
// 10. EXPORT/IMPORT LABELS — Shorter
// ─────────────────────────────────────────────────────────────────────────────
h = h.replace('>Export everything<', '>Export all<');
h = h.replace('>Import backup<', '>Import<');
fixes.push('10. ✅  Export/import labels shortened');

// ─────────────────────────────────────────────────────────────────────────────
// 11. CSS POLISH BLOCK — Safe improvements only, nothing structural
// ─────────────────────────────────────────────────────────────────────────────
const polishCss = `
    /* ── PMG Safe Polish ── */

    /* Hero: comfortable breathing room */
    .hero { padding-top: clamp(3.5rem, 9vw, 6rem); padding-bottom: clamp(2rem, 5vw, 4rem); }

    /* Hero heading: tighter tracking for impact */
    .hero-heading { letter-spacing: -1px; }

    /* Generate button: smooth state transitions */
    #generateBtn { transition: opacity 180ms ease, background 180ms ease, transform 180ms ease; }
    #generateBtn:disabled { opacity: 0.65; cursor: not-allowed; transform: none !important; }

    /* Result highlight: clean flash */
    @keyframes pmgHighlight {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
      25%  { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 40%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
    }
    .result-panel.is-highlight { animation: pmgHighlight 1s ease forwards; }

    /* Testimonial cards: hover lift */
    .feedback-card-grid {
      transition: box-shadow var(--transition-interactive), transform var(--transition-interactive);
    }
    .feedback-card-grid:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    /* Use case cards: hover lift */
    .popular-use-card {
      transition: box-shadow var(--transition-interactive), transform var(--transition-interactive);
    }
    .popular-use-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

    /* Strength score: smooth reveal */
    .strength-score:not([hidden]) { animation: pmgFadeUp 0.3s ease; }
    @keyframes pmgFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    /* Run section: visually distinct */
    .run-section {
      background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      margin-top: var(--space-5);
    }
    .run-section-title {
      color: var(--color-primary);
    }
    [data-theme="dark"] .run-section {
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    }

    /* History panel actions: compact on mobile */
    .panel-head-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
    .panel-head-actions .btn {
      font-size: var(--text-xs) !important;
      padding: 6px 12px !important;
      min-height: 36px !important;
    }

    /* Improve block: breathing room */
    .improve-block {
      border-top: 1px solid var(--color-divider);
      padding-top: var(--space-4);
      margin-top: var(--space-4);
    }

    /* Mobile full-width CTAs */
    @media (max-width: 640px) {
      .hero-actions { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
      .hero-actions .btn { width: 100%; text-align: center; }
      .feedback-grid { grid-template-columns: 1fr; }
      .panel-head-actions { justify-content: flex-start; }
    }

    /* ── End PMG Safe Polish ── */
`;

const lastStyleIdx = h.lastIndexOf('</style>', h.indexOf('</head>'));
if (lastStyleIdx !== -1) {
  h = h.slice(0, lastStyleIdx) + polishCss + h.slice(lastStyleIdx);
  fixes.push('11. ✅  CSS polish injected safely');
} else {
  fixes.push('11. ⚠️  Could not find style block — CSS skipped');
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, h);

console.log('\n── PMG Polish Complete ────────────────────────────────────────');
fixes.forEach(f => console.log(' ' + f));
console.log('\n Total: ' + fixes.length + ' changes');
console.log(' File: ' + FILE);
console.log('───────────────────────────────────────────────────────────────');
console.log('\n Redeploy Replit to see changes. Hard refresh on mobile.\n');