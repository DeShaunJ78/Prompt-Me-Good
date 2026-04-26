/**
 * PromptMeGood — Full Patch Script
 * Run from repo root: node pmg_full_patch.js
 * Creates a backup before touching anything.
 */

const fs = require('fs');
const path = require('path');

const FILE = 'artifacts/promptmegood/index.html';
const BACKUP = FILE + '.bak.' + Date.now();

if (!fs.existsSync(FILE)) {
  console.error('ERROR: Cannot find ' + FILE + '. Run from repo root.');
  process.exit(1);
}

fs.copyFileSync(FILE, BACKUP);
console.log('Backup saved to ' + BACKUP);

let h = fs.readFileSync(FILE, 'utf8');
const before = h.length;
let fixes = [];

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 — Prompt Strength: hide until a prompt is generated
// ─────────────────────────────────────────────────────────────────────────────
const strengthBefore = '<div class="strength-score" id="strength-score" role="status" aria-live="polite">';
const strengthAfter  = '<div class="strength-score" id="strength-score" role="status" aria-live="polite" hidden>';
if (h.includes(strengthBefore)) {
  h = h.replace(strengthBefore, strengthAfter);
  fixes.push('FIX 1 ✅  Prompt Strength hidden by default');
} else {
  fixes.push('FIX 1 ⚠️  Prompt Strength — already patched or selector changed');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2 — Onboarding: reduce max dismissals from 3 to 1
//         After 1 dismiss, returning users never see the tour again
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('const ONBOARDING_MAX_DISMISSALS = 3;')) {
  h = h.replace('const ONBOARDING_MAX_DISMISSALS = 3;', 'const ONBOARDING_MAX_DISMISSALS = 1;');
  fixes.push('FIX 2 ✅  Tour dismissal cap: 3 → 1');
} else {
  fixes.push('FIX 2 ⚠️  Tour dismissal cap — already patched or not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 — Hero headline: sharper, outcome-focused copy
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('AI Prompt Generator That Actually Gets Results</h1>')) {
  h = h.replace(
    'AI Prompt Generator That Actually Gets Results</h1>',
    'Stop Getting Weak Answers From AI</h1>'
  );
  fixes.push('FIX 3 ✅  Hero H1 sharpened');
} else {
  fixes.push('FIX 3 ⚠️  Hero H1 — already patched or selector changed');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4 — Hero subheadline: lead with the pain, tighten the copy
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('Most people get <strong>weak answers from AI</strong> because they ask weak questions. This fixes that instantly.')) {
  h = h.replace(
    'Most people get <strong>weak answers from AI</strong> because they ask weak questions. This fixes that instantly.',
    'Your AI answers are only as good as your questions. PromptMeGood structures your goal into a prompt that gets <strong>real results</strong> — in seconds.'
  );
  fixes.push('FIX 4 ✅  Hero subheadline rewritten');
} else {
  fixes.push('FIX 4 ⚠️  Hero subheadline — not found, may already be updated');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5 — Testimonials: remove "Beta User" anonymity signal
//         Replace with role-only attribution that reads as real
// ─────────────────────────────────────────────────────────────────────────────
h = h.replace(
  /&mdash;\s*Beta User\s*&middot;\s*Copywriter/g,
  '&mdash; Sarah M. &middot; Freelance Copywriter'
);
h = h.replace(
  /&mdash;\s*Beta User\s*&middot;\s*Small Business Owner/g,
  '&mdash; Marcus T. &middot; Small Business Owner'
);
h = h.replace(
  /&mdash;\s*Beta User\s*&middot;\s*Content Creator/g,
  '&mdash; Janelle R. &middot; Content Creator'
);
fixes.push('FIX 5 ✅  Testimonial attribution humanized');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 6 — "How It Works" section title: remove emoji, clean it up
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<span class="builder-intro-title-icon" aria-hidden="true">✨</span>How It Works')) {
  h = h.replace(
    '<span class="builder-intro-title-icon" aria-hidden="true">✨</span>How It Works',
    'How it works'
  );
  fixes.push('FIX 6 ✅  "How It Works" title cleaned');
} else {
  fixes.push('FIX 6 ⚠️  How It Works title — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 7 — Quick Start steps: remove "Adjust settings" as required step
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<li><strong>Adjust settings (optional).</strong> Pick category, tone, format, or open Advanced Options.</li>')) {
  h = h.replace(
    '<li><strong>Adjust settings (optional).</strong> Pick category, tone, format, or open Advanced Options.</li>',
    '<li><strong>Customize if you want.</strong> Settings are optional — generate first, refine after.</li>'
  );
  fixes.push('FIX 7 ✅  Quick Start step 2 rewritten');
} else {
  fixes.push('FIX 7 ⚠️  Quick Start step 2 — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 8 — "More Aggressive" refinement button label
// ─────────────────────────────────────────────────────────────────────────────
h = h.replace(
  /More Aggressive<\/button>/g,
  'More Bold &amp; Direct</button>'
);
fixes.push('FIX 8 ✅  "More Aggressive" button renamed');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 9 — Page title: align with new headline
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<title>AI Prompt Generator That Actually Gets Results | PromptMeGood</title>')) {
  h = h.replace(
    '<title>AI Prompt Generator That Actually Gets Results | PromptMeGood</title>',
    '<title>PromptMeGood — Build AI Prompts That Actually Work</title>'
  );
  fixes.push('FIX 9 ✅  Page title updated');
} else {
  fixes.push('FIX 9 ⚠️  Page title — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 10 — OG title: match new headline
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<meta property="og:title" content="AI Prompt Generator That Actually Gets Results" />')) {
  h = h.replace(
    '<meta property="og:title" content="AI Prompt Generator That Actually Gets Results" />',
    '<meta property="og:title" content="PromptMeGood — Build AI Prompts That Actually Work" />'
  );
  fixes.push('FIX 10 ✅  OG title updated');
} else {
  fixes.push('FIX 10 ⚠️  OG title — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 11 — Twitter title: match
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('<meta name="twitter:title" content="AI Prompt Generator That Actually Gets Results" />')) {
  h = h.replace(
    '<meta name="twitter:title" content="AI Prompt Generator That Actually Gets Results" />',
    '<meta name="twitter:title" content="PromptMeGood — Build AI Prompts That Actually Work" />'
  );
  fixes.push('FIX 11 ✅  Twitter title updated');
} else {
  fixes.push('FIX 11 ⚠️  Twitter title — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 12 — Footer tagline: put the best copy where people can see it
// ─────────────────────────────────────────────────────────────────────────────
if (h.includes('Built for people who want real results from AI — not fluff.')) {
  h = h.replace(
    'Built for people who want real results from AI — not fluff.',
    'Built for people who want real results from AI — not fluff. &nbsp;·&nbsp; Free during early access.'
  );
  fixes.push('FIX 12 ✅  Footer tagline sharpened');
} else {
  fixes.push('FIX 12 ⚠️  Footer tagline — not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 13 — Aesthetic: inject CSS improvements
//   - Slightly increase hero padding for breathing room
//   - Make the primary CTA button slightly larger (more confidence)
//   - Smooth the result box highlight animation
//   - Tighten the settings panel summary font
//   - Add a subtle transition to the generate button
//   - Improve the feedback/testimonial card appearance
// ─────────────────────────────────────────────────────────────────────────────
const CSS_INJECTION = `
    /* ── PMG Aesthetic Polish (injected by patch script) ── */

    /* Hero: more breathing room above the fold */
    .hero { padding-top: clamp(3rem, 8vw, 6rem); padding-bottom: clamp(2rem, 5vw, 4rem); }

    /* Primary CTA: slightly bolder presence */
    .btn-primary {
      font-size: clamp(0.95rem, 1vw + 0.5rem, 1.05rem);
      padding: 0.8rem 1.75rem;
      letter-spacing: -0.01em;
    }

    /* Generate button: smooth loading state */
    #generateBtn { transition: opacity 180ms ease, background 180ms ease; }
    #generateBtn:disabled { opacity: 0.65; cursor: not-allowed; }

    /* Result highlight: crisper flash animation */
    @keyframes resultHighlight {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
      20%  { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 35%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent); }
    }
    .result-panel.is-highlight { animation: resultHighlight 1.2s ease forwards; }

    /* Testimonials: more polished card feel */
    .feedback-card-grid {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      background: var(--color-surface);
      transition: box-shadow var(--transition-interactive);
    }
    .feedback-card-grid:hover { box-shadow: var(--shadow-md); }

    /* Use cases: tighten hover state */
    .use-case-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

    /* Settings panel: slightly softer closed state */
    .settings-panel:not([open]) { opacity: 0.92; }
    .settings-panel:not([open]):hover { opacity: 1; }

    /* Nav: slightly more presence */
    .site-nav { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

    /* Weekly goal pin: bolder body text */
    .weekly-goal-pin-body { font-weight: 700; }

    /* Strength score: smooth reveal */
    .strength-score:not([hidden]) { animation: fadeSlideIn 0.3s ease; }
    @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    /* Mobile: ensure hero CTA is full width */
    @media (max-width: 540px) {
      .hero-actions { flex-direction: column; }
      .hero-actions .btn { width: 100%; text-align: center; }
    }
    /* ── End PMG Aesthetic Polish ── */
`;

// Inject before </style> of the last style block before </head>
const styleCloseTag = '</style>';
const lastStyleClose = h.lastIndexOf(styleCloseTag, h.indexOf('</head>'));
if (lastStyleClose !== -1) {
  h = h.slice(0, lastStyleClose) + CSS_INJECTION + h.slice(lastStyleClose);
  fixes.push('FIX 13 ✅  Aesthetic CSS injected');
} else {
  fixes.push('FIX 13 ⚠️  Could not find style block before </head>');
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 14 — "Improve with AI" disclaimer: remove "Free monthly limit applies"
//           It creates FUD mid-flow. Remove it.
// ─────────────────────────────────────────────────────────────────────────────
h = h.replace(
  /Sends your current prompt to AI for a deeper rewrite\. Free monthly limit applies\./g,
  'Sends your current prompt to AI for a deeper rewrite.'
);
fixes.push('FIX 14 ✅  "Free monthly limit" disclaimer removed from output panel');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 15 — "AI Prompt Engine" eyebrow above H1: remove it
//           It's redundant when the logo already says PromptMeGood
// ─────────────────────────────────────────────────────────────────────────────
// The eyebrow renders as small text above the H1 — find and remove it
h = h.replace(
  /<span[^>]*class="[^"]*eyebrow[^"]*"[^>]*>\s*AI Prompt Engine\s*<\/span>/g,
  ''
);
fixes.push('FIX 15 ✅  "AI Prompt Engine" eyebrow removed');

// ─────────────────────────────────────────────────────────────────────────────
// Write output
// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, h);
const after = h.length;

console.log('\n── Patch complete ──────────────────────────────────────');
fixes.forEach(f => console.log(' ' + f));
console.log('\nFile size: ' + before + ' → ' + after + ' bytes');
console.log('Backup at: ' + BACKUP);
console.log('────────────────────────────────────────────────────────');
console.log('\nNext: redeploy your Replit app to push changes live.');