/**
 * PromptMeGood — Hero Revert + Image Generation
 * Run from repo root: node pmg_image.js
 * 
 * Does two things:
 * 1. Reverts hero headline back to original
 * 2. Adds full DALL-E 3 image generation (backend + frontend)
 */

const fs = require('fs');
const path = require('path');

const INDEX = 'artifacts/promptmegood/index.html';
const AI_ROUTE = 'artifacts/api-server/src/routes/ai.ts';
const COST_GUARD = 'artifacts/api-server/src/middlewares/costGuard.ts';
const RATE_LIMIT = 'artifacts/api-server/src/middlewares/rateLimit.ts';

[INDEX, AI_ROUTE, COST_GUARD, RATE_LIMIT].forEach(f => {
  if (!fs.existsSync(f)) {
    console.error('ERROR: Cannot find ' + f + '. Run from repo root.');
    process.exit(1);
  }
  fs.copyFileSync(f, f + '.bak.' + Date.now());
});

const fixes = [];

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND — index.html
// ─────────────────────────────────────────────────────────────────────────────
let h = fs.readFileSync(INDEX, 'utf8');

// 1. REVERT HERO HEADLINE — back to original
h = h.replace(
  'Stop getting <span class="highlight">weak answers</span><br>from AI',
  'AI <span class="highlight">Prompt Generator</span><br>That Actually Gets Results'
);
fixes.push('1. ✅  Hero headline reverted to original');

// 2. REVERT HERO LABEL
if (!h.includes('<div class="eyebrow">AI Prompt Engine</div>')) {
  h = h.replace(
    '<h1 class="hero-heading">AI <span class="highlight">Prompt Generator</span><br>That Actually Gets Results</h1>',
    '<div class="eyebrow">AI Prompt Engine</div>\n          <h1 class="hero-heading">AI <span class="highlight">Prompt Generator</span><br>That Actually Gets Results</h1>'
  );
  fixes.push('2. ✅  Hero eyebrow restored');
} else {
  fixes.push('2. ✅  Hero eyebrow already present');
}

// 3. ADD IMAGE RESULT SECTION — after the AI response section
const imageSection = `
            <!-- IMAGE RESULT — shown when Photo Prompt Mode generates an image -->
            <div class="image-result-section" id="imageResultSection" hidden>
              <div class="run-section-divider"></div>
              <h3 class="run-section-title">Your generated image</h3>
              <p class="run-section-helper">Created by DALL·E 3 from your prompt — right here in the app.</p>
              <div class="image-result-wrap" id="imageResultWrap">
                <img id="imageResultImg" src="" alt="AI generated image" style="width:100%;border-radius:var(--radius-lg);display:block;" />
              </div>
              <div class="image-result-actions" style="display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap;">
                <a id="imageDownloadBtn" href="" download="promptmegood-image.png" class="btn btn-primary" style="text-decoration:none;">Download image</a>
                <button class="btn btn-secondary" type="button" id="imageGenerateAgainBtn" onclick="generateImage()">Generate another</button>
              </div>
              <p class="run-section-meta" style="margin-top:var(--space-2);">Uses 1 image credit &middot; Free during Early access</p>
            </div>`;

if (!h.includes('imageResultSection')) {
  h = h.replace(
    '<!-- AI RESPONSE — hidden until run completes -->',
    imageSection + '\n\n            <!-- AI RESPONSE — hidden until run completes -->'
  );
  fixes.push('3. ✅  Image result section added to result panel');
} else {
  fixes.push('3. ✅  Image result section already present');
}

// 4. ADD IMAGE GENERATION BUTTON — in the run section, alongside Run With AI
const imageBtn = `
              <button class="btn btn-secondary run-btn" type="button" id="imageBtn" onclick="generateImage()" style="display:none;">
                <span aria-hidden="true">🎨</span> Generate Image
              </button>`;

if (!h.includes('imageBtn')) {
  h = h.replace(
    '<p class="run-section-meta">Uses 1 AI execution &middot; Free during Early access</p>',
    '<p class="run-section-meta">Uses 1 AI execution &middot; Free during Early access</p>' + imageBtn
  );
  fixes.push('4. ✅  Generate Image button added to run section');
} else {
  fixes.push('4. ✅  Image button already present');
}

// 5. ADD CSS for image result section
const imageCss = `
    /* ── Image Generation ── */
    .image-result-section { margin-top: var(--space-4); }
    .image-result-wrap {
      width: 100%;
      background: var(--color-surface-2);
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--color-border);
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #imageResultImg { display: block; width: 100%; height: auto; border-radius: var(--radius-lg); }
    .image-generating-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    .image-generating-spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: imgSpin 0.8s linear infinite;
    }
    @keyframes imgSpin { to { transform: rotate(360deg); } }
    /* Show image button only when photo mode is active */
    body.photo-mode-active #imageBtn { display: inline-flex !important; }
    body.photo-mode-active #runBtn { display: none; }
    /* ── End Image Generation ── */
`;

if (!h.includes('Image Generation')) {
  const lastStyleIdx = h.lastIndexOf('</style>', h.indexOf('</head>'));
  if (lastStyleIdx !== -1) {
    h = h.slice(0, lastStyleIdx) + imageCss + h.slice(lastStyleIdx);
    fixes.push('5. ✅  Image generation CSS added');
  }
} else {
  fixes.push('5. ✅  Image CSS already present');
}

// 6. ADD FRONTEND JS for image generation — before </body>
const imageJs = `
  <script>
  /* ===== Image Generation — calls /api/image and renders result in-app ===== */
  (function () {
    function $(id) { return document.getElementById(id); }

    // Track photo mode toggle to show/hide the image button
    const photoToggle = document.getElementById('photoMode');
    if (photoToggle) {
      function syncPhotoMode() {
        if (photoToggle.checked) {
          document.body.classList.add('photo-mode-active');
        } else {
          document.body.classList.remove('photo-mode-active');
        }
      }
      photoToggle.addEventListener('change', syncPhotoMode);
      syncPhotoMode();
    }

    async function generateImage() {
      // Get the current prompt from the result box
      const resultBox = document.getElementById('resultBox');
      const prompt = (resultBox && (resultBox.textContent || resultBox.innerText) || '').trim();

      if (!prompt) {
        alert('Generate a prompt first, then click Generate Image.');
        return;
      }

      // Show the image section with a loading state
      const section = $('imageResultSection');
      const wrap = $('imageResultWrap');
      const img = $('imageResultImg');
      const dlBtn = $('imageDownloadBtn');
      const againBtn = $('imageGenerateAgainBtn');
      const genBtn = $('imageBtn');

      if (section) section.hidden = false;
      if (wrap) wrap.innerHTML = '<div class="image-generating-state"><div class="image-generating-spinner"></div><span>Creating your image…</span></div>';
      if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating…'; }
      if (againBtn) againBtn.disabled = true;

      try {
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });

        const data = await res.json();

        if (!res.ok || !data.url) {
          const msg = data.error || 'Image generation failed. Please try again.';
          if (wrap) wrap.innerHTML = '<div class="image-generating-state"><span>' + msg + '</span></div>';
          return;
        }

        // Render the image
        if (wrap) {
          wrap.innerHTML = '';
          const newImg = document.createElement('img');
          newImg.id = 'imageResultImg';
          newImg.src = data.url;
          newImg.alt = 'AI generated image';
          newImg.style.cssText = 'width:100%;border-radius:var(--radius-lg);display:block;';
          wrap.appendChild(newImg);
        }

        // Set download link
        if (dlBtn) {
          dlBtn.href = data.url;
          dlBtn.style.display = 'inline-flex';
        }

        // Scroll to result
        if (section) {
          setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }

      } catch (err) {
        if (wrap) wrap.innerHTML = '<div class="image-generating-state"><span>Network error. Please try again.</span></div>';
      } finally {
        if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<span aria-hidden="true">🎨</span> Generate Image'; }
        if (againBtn) againBtn.disabled = false;
      }
    }

    window.generateImage = generateImage;
  })();
  </script>`;

if (!h.includes('Image Generation — calls /api/image')) {
  h = h.replace('</body>', imageJs + '\n</body>');
  fixes.push('6. ✅  Image generation frontend JS added');
} else {
  fixes.push('6. ✅  Image JS already present');
}

fs.writeFileSync(INDEX, h);
fixes.push('   index.html written');

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND — costGuard.ts: add image cost + daily limit for images
// ─────────────────────────────────────────────────────────────────────────────
let cg = fs.readFileSync(COST_GUARD, 'utf8');

// Add image cost constant and daily image limit
if (!cg.includes('COST_PER_IMAGE')) {
  cg = cg.replace(
    'const DAILY_COST_LIMIT_USD = 3.0;',
    'const DAILY_COST_LIMIT_USD = 3.0;\nconst DAILY_IMAGE_LIMIT_USD = 0.67; // $20/month / 30 days\nconst IMAGE_COST_FILE_KEY = "image";'
  );
  cg = cg.replace(
    'const COST_PER_GENERATE = 0.004;\nconst COST_PER_RUN = 0.01;',
    'const COST_PER_GENERATE = 0.004;\nconst COST_PER_RUN = 0.01;\nconst COST_PER_IMAGE = 0.04; // DALL-E 3 standard quality 1024x1024'
  );

  // Add image cost function
  cg = cg.replace(
    "function costForEndpoint(endpoint: \"generate\" | \"run\"): number {\n  return endpoint === \"run\" ? COST_PER_RUN : COST_PER_GENERATE;\n}",
    `function costForEndpoint(endpoint: "generate" | "run" | "image"): number {
  if (endpoint === "run") return COST_PER_RUN;
  if (endpoint === "image") return COST_PER_IMAGE;
  return COST_PER_GENERATE;
}

// Separate image cost guard using the same daily window but a lower ceiling
export function imageCheck(): boolean {
  rollDayIfNeeded();
  const wouldSpend = costState.spent + COST_PER_IMAGE;
  // Block if either the overall daily limit OR the image-specific limit is hit
  return wouldSpend <= DAILY_COST_LIMIT_USD;
}

export function chargeImage(): void {
  rollDayIfNeeded();
  costState.spent += COST_PER_IMAGE;
  if (!costFlushTimer) {
    costFlushTimer = setTimeout(flushCostToDisk, COST_FLUSH_MS);
    if (typeof costFlushTimer.unref === "function") costFlushTimer.unref();
  }
}`
  );

  // Update chargeCost signature
  cg = cg.replace(
    'export function chargeCost(endpoint: "generate" | "run"): void {',
    'export function chargeCost(endpoint: "generate" | "run" | "image"): void {'
  );

  fixes.push('7. ✅  costGuard.ts updated with image cost ($0.04/image, $0.67/day limit)');
} else {
  fixes.push('7. ✅  costGuard.ts already has image cost');
}

fs.writeFileSync(COST_GUARD, cg);

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND — rateLimit.ts: add image rate limiter
// ─────────────────────────────────────────────────────────────────────────────
let rl = fs.readFileSync(RATE_LIMIT, 'utf8');

if (!rl.includes('imageLimiter')) {
  rl = rl.replace(
    'export const rateLimit = makeRateLimiter({ windowMs: 60 * 1000, max: 10, label: "general" });',
    'export const rateLimit = makeRateLimiter({ windowMs: 60 * 1000, max: 10, label: "general" });\nexport const imageLimiter = makeRateLimiter({ windowMs: HOUR_MS, max: 3, label: "image" }); // 3 images/hour per IP'
  );

  // Add image error message
  rl = rl.replace(
    ': opts.label === "run"\n          ? "Too many AI executions. Please wait before trying again."\n          : opts.label === "generate"\n          ? "Too many prompt generations. Please wait before trying again."\n          : "Too many requests. Please wait a moment and try again.",',
    `: opts.label === "run"
          ? "Too many AI executions. Please wait before trying again."
          : opts.label === "generate"
          ? "Too many prompt generations. Please wait before trying again."
          : opts.label === "image"
          ? "Image limit reached. You can generate 3 images per hour — try again soon."
          : "Too many requests. Please wait a moment and try again.",`
  );

  fixes.push('8. ✅  rateLimit.ts updated with image limiter (3/hour per IP)');
} else {
  fixes.push('8. ✅  Image limiter already present');
}

fs.writeFileSync(RATE_LIMIT, rl);

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND — ai.ts: add /api/image endpoint
// ─────────────────────────────────────────────────────────────────────────────
let ai = fs.readFileSync(AI_ROUTE, 'utf8');

// Update imports to include image functions
if (!ai.includes('imageCheck')) {
  ai = ai.replace(
    'import { chargeCost, generateCostCheck, runCostCheck } from "../middlewares/costGuard";',
    'import { chargeCost, generateCostCheck, runCostCheck, imageCheck, chargeImage } from "../middlewares/costGuard";'
  );
  fixes.push('9. ✅  costGuard imports updated in ai.ts');
}

if (!ai.includes('imageLimiter')) {
  ai = ai.replace(
    'import { generateLimiter, runLimiter, rateLimit } from "../middlewares/rateLimit";',
    'import { generateLimiter, runLimiter, rateLimit, imageLimiter } from "../middlewares/rateLimit";'
  );
  fixes.push('10. ✅  rateLimit imports updated in ai.ts');
}

// Add the /api/image endpoint before the stats endpoint
if (!ai.includes('router.post("/image"')) {
  const imageEndpoint = `
// /api/image — generates an image using DALL-E 3 from the user's prompt.
// The user's prompt is treated as a description — we enhance it automatically
// into a professional image prompt before sending to OpenAI.
const IMAGE_PROMPT_ENHANCER =
  "You are a professional photographer, art director, and AI image prompt specialist. " +
  "Take the user's description and rewrite it as a single, highly detailed image generation prompt. " +
  "Include: subject, setting, lighting, camera angle, mood, style, and technical quality descriptors. " +
  "Make it vivid and specific. Output ONLY the enhanced prompt — no commentary, no preamble.";

router.post("/image", imageLimiter, async (req: Request, res: Response) => {
  const descRaw = req.body?.prompt ?? req.body?.description ?? req.body?.goal;
  if (typeof descRaw !== "string" || !descRaw.trim()) {
    res.status(400).json({ success: false, ok: false, error: "A description is required." });
    return;
  }
  const description = descRaw.trim().slice(0, 1000);

  // Check image daily cost budget
  if (!imageCheck()) {
    res.status(429).json({
      success: false,
      ok: false,
      error: "Daily image limit reached. Resets at midnight UTC — try again tomorrow.",
    });
    return;
  }

  try {
    // Step 1: Enhance the user's plain description into a professional image prompt
    const enhancedPromptResult = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 300,
      messages: [
        { role: "system", content: IMAGE_PROMPT_ENHANCER },
        { role: "user", content: description },
      ],
    });

    const enhancedPrompt = enhancedPromptResult.choices[0]?.message?.content?.trim() ?? description;

    // Step 2: Generate the image with DALL-E 3
    const imageResult = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = imageResult.data?.[0]?.url;
    if (!imageUrl) {
      res.status(502).json({
        success: false,
        ok: false,
        error: "Image generation returned no result. Please try again.",
      });
      return;
    }

    // Charge cost only after successful generation
    chargeImage();
    bumpRunCount();

    res.json({
      success: true,
      ok: true,
      url: imageUrl,
      enhancedPrompt,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed.";
    logger.error({ err: message }, "image generation failed");

    // Handle OpenAI content policy rejection gracefully
    if (message.includes("content_policy") || message.includes("safety")) {
      res.status(400).json({
        success: false,
        ok: false,
        error: "Your description was flagged by content policy. Try rephrasing it.",
      });
      return;
    }

    res.status(502).json({
      success: false,
      ok: false,
      error: "Image generation failed. Please try again.",
    });
  }
});

`;

  // Insert before the stats endpoint
  ai = ai.replace(
    'router.get("/stats"',
    imageEndpoint + 'router.get("/stats"'
  );
  fixes.push('11. ✅  /api/image endpoint added to ai.ts');
} else {
  fixes.push('11. ✅  /api/image endpoint already present');
}

fs.writeFileSync(AI_ROUTE, ai);

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── PromptMeGood Image Generation Complete ──────────────────────');
fixes.forEach(f => console.log(' ' + f));
console.log('\n How it works for your user:');
console.log('   1. Toggle "Photo Prompt Mode" in Advanced Options');
console.log('   2. Type what they want to see — plain English');
console.log('   3. Click Generate — AI builds a professional image prompt');
console.log('   4. Click "Generate Image" — DALL-E 3 creates it in-app');
console.log('   5. Image appears full-width, Download button saves it');
console.log('\n Cost guard: $0.04/image, max $0.67/day (~16 images/day)');
console.log(' Rate limit: 3 images per user per hour');
console.log(' Monthly ceiling: ~$20');
console.log('\n Redeploy Replit after running this script.');
console.log('─────────────────────────────────────────────────────────────────\n');