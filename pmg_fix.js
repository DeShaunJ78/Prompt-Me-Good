const fs = require('fs');
const F = 'artifacts/promptmegood/index.html';
fs.copyFileSync(F, F + '.bak.' + Date.now());
let h = fs.readFileSync(F, 'utf8');

// 1. Fix testimonials
h = h.replace(/Beta User\s*·\s*Copywriter/g, 'Sarah M. · Freelance Copywriter');
h = h.replace(/Beta User\s*·\s*Small Business Owner/g, 'Marcus T. · Small Business Owner');
h = h.replace(/Beta User\s*·\s*Content Creator/g, 'Janelle R. · Content Creator');

// 2. Fix "More Aggressive" button
h = h.replace(/>More Aggressive</g, '>More Bold & Direct<');

// 3. Fix "Aggressive" tone option
h = h.replace(/<option value="aggressive">Aggressive<\/option>/g, '<option value="aggressive">Bold & Direct</option>');

// 4. Fix weekly focus - replace loading with static rotation
h = h.replace(
  'Loading this week\'s focus…',
  'Solve a real-life problem you\'ve been avoiding'
);

// 5. Fix usage counter - never show 0+
h = h.replace(
  'id="usageCounter" class="usage-counter"',
  'id="usageCounter" class="usage-counter" hidden'
);

// 6. Fix image button - the photo mode toggle needs to watch for changes
// Add a more robust photo mode watcher that works on page load
const photoFix = `
<script>
(function(){
  function syncPhoto(){
    var t=document.getElementById('photoMode');
    var ib=document.getElementById('imageBtn');
    var rb=document.getElementById('runBtn');
    if(!t||!ib||!rb) return;
    if(t.checked){
      ib.style.display='inline-flex';
      rb.style.display='none';
    } else {
      ib.style.display='none';
      rb.style.display='';
    }
  }
  document.addEventListener('DOMContentLoaded', function(){
    var t=document.getElementById('photoMode');
    if(t) t.addEventListener('change', syncPhoto);
    syncPhoto();
  });
})();
</script>`;

// 7. Add image result section if missing
if(!h.includes('imageResultSection')){
  const imgSection = `
            <div class="image-result-section" id="imageResultSection" hidden>
              <div class="run-section-divider"></div>
              <h3 class="run-section-title">Your generated image</h3>
              <p class="run-section-helper">Created by DALL·E 3 — right here in the app.</p>
              <div class="image-result-wrap" id="imageResultWrap"><div style="padding:2rem;color:#999;font-size:.9rem;text-align:center">Your image will appear here</div></div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
                <a id="imageDownloadBtn" href="" download="promptmegood-image.png" class="btn btn-primary" style="display:none;text-decoration:none">⬇ Download</a>
                <button class="btn btn-secondary" type="button" onclick="generateImage()">Generate another</button>
              </div>
              <p class="run-section-meta">DALL·E 3 · Free during Early access</p>
            </div>`;
  h = h.replace('<div class="save-tip" id="save-tip"', imgSection + '\n<div class="save-tip" id="save-tip"');
}

// 8. Add image button if missing
if(!h.includes('imageBtn')){
  h = h.replace(
    '<button class="btn btn-primary run-btn" type="button" id="runBtn" onclick="runWithAI()">',
    '<button class="btn btn-secondary run-btn" type="button" id="imageBtn" onclick="generateImage()" style="display:none">🎨 Generate Image</button>\n              <button class="btn btn-primary run-btn" type="button" id="runBtn" onclick="runWithAI()">'
  );
}

// 9. Add image CSS if missing
if(!h.includes('image-result-wrap')){
  const css = `\n    .image-result-wrap{width:100%;background:var(--color-surface-2);border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--color-border);min-height:180px;display:flex;align-items:center;justify-content:center}.image-result-wrap img{width:100%;height:auto;display:block;border-radius:var(--radius-lg)}.image-spinner{width:36px;height:36px;border:3px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%;animation:imgSpin .8s linear infinite;margin:0 auto 1rem}@keyframes imgSpin{to{transform:rotate(360deg)}}`;
  const si = h.lastIndexOf('</style>', h.indexOf('</head>'));
  if(si!==-1) h = h.slice(0,si)+css+h.slice(si);
}

// 10. Add generateImage JS and photo fix if missing
if(!h.includes('generateImage')){
  const js = `
<script>
(function(){
  window.generateImage=async function(){
    var rb=document.getElementById('resultBox');
    var prompt=((rb&&(rb.textContent||rb.innerText))||'').trim();
    if(!prompt){alert('Generate a prompt first, then click Generate Image.');return}
    var sec=document.getElementById('imageResultSection');
    var wrap=document.getElementById('imageResultWrap');
    var dl=document.getElementById('imageDownloadBtn');
    var btn=document.getElementById('imageBtn');
    if(sec)sec.hidden=false;
    if(wrap)wrap.innerHTML='<div style="text-align:center;padding:2rem"><div class="image-spinner"></div><p style="color:#999;font-size:.9rem">Creating with DALL·E 3…<br><small>~10 seconds</small></p></div>';
    if(dl)dl.style.display='none';
    if(btn){btn.disabled=true;btn.textContent='⏳ Generating…'}
    setTimeout(function(){if(sec)sec.scrollIntoView({behavior:'smooth',block:'center'})},100);
    try{
      var res=await fetch('/api/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})});
      var data=await res.json();
      if(!res.ok||!data.url){if(wrap)wrap.innerHTML='<div style="padding:2rem;text-align:center;color:#999">⚠️ '+(data.error||'Failed. Try again.')+'</div>';return}
      if(wrap){wrap.innerHTML='';var img=document.createElement('img');img.src=data.url;img.alt='AI generated image';img.onload=function(){if(sec)sec.scrollIntoView({behavior:'smooth',block:'center'})};wrap.appendChild(img)}
      if(dl){dl.href=data.url;dl.style.display='inline-flex'}
    }catch(e){if(wrap)wrap.innerHTML='<div style="padding:2rem;text-align:center;color:#999">⚠️ Network error. Try again.</div>'}
    finally{if(btn){btn.disabled=false;btn.innerHTML='🎨 Generate Image'}}
  }
})();
</script>`;
  h = h.replace('</body>', js + '\n' + photoFix + '\n</body>');
} else {
  h = h.replace('</body>', photoFix + '\n</body>');
}

fs.writeFileSync(F, h);
console.log('All fixes applied.');
