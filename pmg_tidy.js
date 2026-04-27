const fs = require('fs');
const F = 'artifacts/promptmegood/index.html';
fs.copyFileSync(F, F + '.bak.' + Date.now());
let h = fs.readFileSync(F, 'utf8');

// 1. Testimonials — fix Beta User
h = h.replace(/Beta User\s*·\s*Copywriter/g, 'Sarah M. · Freelance Copywriter');
h = h.replace(/Beta User\s*·\s*Small Business Owner/g, 'Marcus T. · Small Business Owner');
h = h.replace(/Beta User\s*·\s*Content Creator/g, 'Janelle R. · Content Creator');

// 2. "More Aggressive" button
h = h.replace(/>More Aggressive</g, '>More Bold & Direct<');

// 3. "Aggressive" tone option
h = h.replace(/>Aggressive</g, '>Bold & Direct<');

// 4. Weekly focus — remove loading state
h = h.replace('Loading this week\'s focus…', 'Solve a real-life problem you\'ve been avoiding');

// 5. Usage counter — never show 0+
h = h.replace('<span id="usageCount">0</span>+ prompts generated', '');
h = h.replace(/id="usageCounter"[^>]*style="[^"]*"/g, 'id="usageCounter" style="display:none"');

// 6. "Free monthly limit applies" disclaimer — remove mid-flow FUD
h = h.replace('Sends your current prompt to AI for a deeper rewrite. Free monthly limit applies.', 'Sends your current prompt to AI for a deeper rewrite.');

// 7. How It Works emoji — cleaner without it
h = h.replace('## ✨How It Works', '## How It Works');

// 8. "Recommended First Step" badge — too salesy
h = h.replace('Recommended First Step\n                **Guide Me**', '**Guide Me**');
h = h.replace('<div class="guided-cta-recommended">Recommended First Step</div>', '');
h = h.replace(/Recommended First Step\s*<\/span>/g, '</span>');
h = h.replace(/<span[^>]*>Recommended First Step<\/span>/g, '');

// 9. "New" badge on weekly focus — remove
h = h.replace('<span class="weekly-new-badge">New</span>', '');

// 10. Keyboard shortcuts panel — hide by default, show in expert mode only
h = h.replace(
  '<div class="keyboard-hints" id="keyboard-hints">',
  '<div class="keyboard-hints" id="keyboard-hints" hidden>'
);

// 11. "Best For Structured Answers, Step-By-Step Guidance, And Strategy" — sentence case
h = h.replace('Best For Structured Answers, Step-By-Step Guidance, And Strategy', 'Best for structured answers, step-by-step guidance, and strategy');
h = h.replace('Best For Writing, Long-Form Content, And Natural Tone', 'Best for writing, long-form content, and natural tone');
h = h.replace('Best For Research, Real-Time Info, And Fact-Based Answers', 'Best for research, real-time info, and fact-based answers');

// 12. "Show Me The Full Tour" → sentence case
h = h.replace(/>Show Me The Full Tour</g, '>Show me the full tour<');
h = h.replace(/>Go To Start Here</g, '>Go to start here<');

// 13. "Build A Prompt / See Use Cases" hero CTAs — sentence case
h = h.replace('>Build A Prompt<', '>Build a prompt<');
h = h.replace('>Start Here With A Specific Task<', '>Start here<');
h = h.replace('>See Use Cases<', '>See use cases<');
h = h.replace('>Start Here For Ideas<', '>Browse examples<');

// 14. Use case cards — sentence case
h = h.replace(/>Make Money With AI</g, '>Make money with AI');
h = h.replace(/>Start A Business</g, '>Start a business');
h = h.replace(/>Create Viral Content</g, '>Create viral content');
h = h.replace(/>Write Better Emails</g, '>Write better emails');
h = h.replace(/>Build A Product Page</g, '>Build a product page');
h = h.replace(/>Solve A Personal Problem</g, '>Solve a personal problem');
h = h.replace(/>Use This →</g, '>Use this →');

// 15. "Your Ready-To-Use Prompt" → more confident
h = h.replace('>Your Ready-To-Use Prompt<', '>Your prompt is ready<');

// 16. Quick start — start collapsed
h = h.replace(
  '<details class="quick-start-card" id="quick-start-card" open>',
  '<details class="quick-start-card" id="quick-start-card">'
);

// 17. Run section title
h = h.replace('>Run This Prompt With AI<', '>Run it<');
h = h.replace('Your prompt is ready. Review it above, edit if needed, then run it here.', 'Execute this prompt and get your AI response — right here.');

// 18. "Refine Your Prompt Instantly" eyebrow — redundant
h = h.replace('<p class="improve-eyebrow">Tap an option to instantly upgrade your result.</p>', '');

fs.writeFileSync(F, h);
console.log('Tidy complete — 18 fixes applied.');
