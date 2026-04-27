/**
 * pmg_image_only.js
 * Re-applies just the image-generation frontend pieces (HTML section, button,
 * CSS block, JS) onto the overhaul-aesthetic base. Backend is already wired.
 */
const fs = require('fs');
const INDEX = 'artifacts/promptmegood/index.html';
let h = fs.readFileSync(INDEX, 'utf8');
const fixes = [];

const imageSection = `
            <!-- IMAGE RESULT — shown when Photo Prompt Mode generates an image -->
            <div class="image-result-section" id="imageResultSection" hidden>
              <div class="run-section-divider"></div>
              <h3 class="run-section-title">Your generated image</h3>
              <p class="run-section-helper">Created from your prompt — right here in the app.</p>
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
  fixes.push('1. image result section');
} else {
  fixes.push('1. image result section already present');
}

const imageBtn = `
              <button class="btn btn-secondary run-btn" type="button" id="imageBtn" onclick="generateImage()" style="display:none;">
                <span aria-hidden="true">🎨</span> Generate Image
              </button>`;

if (!h.includes('imageBtn')) {
  h = h.replace(
    '<p class="run-section-meta">Uses 1 AI execution &middot; Free during Early access</p>',
    '<p class="run-section-meta">Uses 1 AI execution &middot; Free during Early access</p>' + imageBtn
  );
  fixes.push('2. image button');
} else {
  fixes.push('2. image button already present');
}

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
    body.photo-mode-active #imageBtn { display: inline-flex !important; }
    body.photo-mode-active #runBtn { display: none; }
    /* ── End Image Generation ── */
`;

if (!h.includes('Image Generation')) {
  const lastStyleIdx = h.lastIndexOf('</style>', h.indexOf('</head>'));
  if (lastStyleIdx !== -1) {
    h = h.slice(0, lastStyleIdx) + imageCss + h.slice(lastStyleIdx);
    fixes.push('3. image CSS');
  }
} else {
  fixes.push('3. image CSS already present');
}

const imageJs = `
  <script>
  (function () {
    function $(id) { return document.getElementById(id); }
    const photoToggle = document.getElementById('photoMode');
    if (photoToggle) {
      function syncPhotoMode() {
        if (photoToggle.checked) document.body.classList.add('photo-mode-active');
        else document.body.classList.remove('photo-mode-active');
      }
      photoToggle.addEventListener('change', syncPhotoMode);
      syncPhotoMode();
    }
    async function generateImage() {
      const resultBox = document.getElementById('resultBox');
      const prompt = (resultBox && (resultBox.textContent || resultBox.innerText) || '').trim();
      if (!prompt) { alert('Generate a prompt first, then click Generate Image.'); return; }
      const section = $('imageResultSection');
      const wrap = $('imageResultWrap');
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
        if (wrap) {
          wrap.innerHTML = '';
          const newImg = document.createElement('img');
          newImg.id = 'imageResultImg';
          newImg.src = data.url;
          newImg.alt = 'AI generated image';
          newImg.style.cssText = 'width:100%;border-radius:var(--radius-lg);display:block;';
          wrap.appendChild(newImg);
        }
        if (dlBtn) { dlBtn.href = data.url; dlBtn.style.display = 'inline-flex'; }
        if (section) {
          setTimeout(() => { section.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
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

if (!h.includes('window.generateImage')) {
  h = h.replace('</body>', imageJs + '\n</body>');
  fixes.push('4. image JS');
} else {
  fixes.push('4. image JS already present');
}

fs.writeFileSync(INDEX, h);
console.log('Done:');
fixes.forEach(f => console.log('  ' + f));
console.log('Final lines:', h.split('\n').length);
