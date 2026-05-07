/* ============================================================================
   PromptMeGood — Visual Studio (vs-1)
   Full-screen Image + Video prompt builder modal.
   - Image tab wires to existing /api/image (DALL·E / gpt-image-1).
   - Video tab wires to /api/video (Sora). Free/trial users see upgrade CTA.
   - On open, the existing Photography Suite DOM is moved INTO the modal so
     all photo controls live in one place. On close, it's left in the modal
     until next open (idempotent — safe to call openVisualStudio many times).
   ============================================================================ */
(function () {
  'use strict';

  var MODAL_ID = 'pmg-visual-studio-modal';
  var MOBILE_BP = 768;
  var SORA_OPTIONS = {
    shot:       ['Wide', 'Medium', 'Close-up', 'Aerial', 'POV', 'Tracking'],
    movement:   ['Static', 'Slow push in', 'Pan left', 'Pan right', 'Handheld', 'Dolly'],
    mood:       ['Golden hour', 'Night', 'Overcast', 'Studio', 'Neon'],
    duration:   ['5', '10'],   // seconds — sent to Sora as n_seconds
    resolution: ['480p', '720p', '1080p'],
    style:      ['Cinematic', 'Realistic', 'Animated', 'Documentary', 'Dreamy'],
  };

  function buildModal() {
    if (document.getElementById(MODAL_ID)) return;

    var soraGridHtml = '';
    [
      ['shot',       'Shot Type'],
      ['movement',   'Movement'],
      ['mood',       'Mood & Lighting'],
      ['duration',   'Duration (sec)'],
      ['resolution', 'Resolution'],
      ['style',      'Style'],
    ].forEach(function (row) {
      var key = row[0], label = row[1];
      var opts = SORA_OPTIONS[key]
        .map(function (v) { return '<option value="' + v + '">' + v + '</option>'; })
        .join('');
      soraGridHtml +=
        '<label>' + label +
          '<select data-vs-sora="' + key + '">' + opts + '</select>' +
        '</label>';
    });

    var html =
      '<div id="' + MODAL_ID + '" class="pmg-modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="pmg-vs-title">' +
        '<div class="pmg-modal-content">' +
          '<div class="pmg-modal-header">' +
            '<h2 id="pmg-vs-title">Visual Studio</h2>' +
            '<button type="button" id="pmg-close-visual-studio" aria-label="Close Visual Studio">✕</button>' +
          '</div>' +
          '<div class="pmg-modal-body">' +

            '<div class="pmg-modal-col-builder" id="pmg-vs-step-1">' +
              '<div class="pmg-vs-tabs" role="tablist">' +
                '<button type="button" class="pmg-vs-tab active" data-vs-target="image" role="tab" aria-selected="true">🎨 Image</button>' +
                '<button type="button" class="pmg-vs-tab" data-vs-target="video" role="tab" aria-selected="false">🎬 Video<span class="pmg-vs-pro-tag">PRO</span></button>' +
              '</div>' +

              // IMAGE BUILDER
              '<div id="pmg-vs-image-builder" class="pmg-vs-builder-view">' +
                '<div class="pmg-vs-section">' +
                  '<label for="pmg-vs-image-goal">Describe Your Image</label>' +
                  '<textarea id="pmg-vs-image-goal" rows="3" placeholder="A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look…"></textarea>' +
                  '<button type="button" id="pmg-vs-reverse-engineer-btn" class="pmg-vs-btn pmg-vs-btn-secondary" style="margin-top:10px;width:100%">📸 Reverse Engineer an Image</button>' +
                  '<input type="file" id="pmg-vs-reverse-input" accept="image/jpeg,image/png,image/webp" hidden />' +
                  '<div id="pmg-vs-reverse-status" class="pmg-vs-reverse-status" hidden></div>' +
                '</div>' +
                '<details class="pmg-vs-tuning" open>' +
                  '<summary>Photography Suite — style, lighting, camera</summary>' +
                  '<div id="pmg-vs-photo-suite-container">' +
                    '<p style="margin:6px 0 0;font-size:.85rem;opacity:.7">Loading photo controls…</p>' +
                  '</div>' +
                '</details>' +
                '<button type="button" id="pmg-vs-build-image-prompt-btn" class="pmg-vs-btn pmg-vs-btn-secondary pmg-vs-full-width">✨ Build My Image Prompt</button>' +
              '</div>' +

              // VIDEO BUILDER
              '<div id="pmg-vs-video-builder" class="pmg-vs-builder-view" hidden>' +
                '<div class="pmg-vs-section">' +
                  '<label for="pmg-vs-video-goal">Describe Your Scene</label>' +
                  '<textarea id="pmg-vs-video-goal" rows="3" placeholder="A tracking shot of a vintage car driving through neon-lit Tokyo at night…"></textarea>' +
                '</div>' +
                '<details class="pmg-vs-tuning" open>' +
                  '<summary>Sora Tuning — shot, movement, mood</summary>' +
                  '<div class="pmg-vs-sora-grid">' + soraGridHtml + '</div>' +
                '</details>' +
                '<button type="button" id="pmg-vs-build-video-prompt-btn" class="pmg-vs-btn pmg-vs-btn-secondary pmg-vs-full-width">✨ Build My Video Prompt</button>' +
              '</div>' +

              // Refined output (shared)
              '<div class="pmg-vs-section pmg-vs-refined-output" hidden>' +
                '<label for="pmg-vs-refined-prompt">Your Refined Prompt — edit before you generate</label>' +
                '<textarea id="pmg-vs-refined-prompt" rows="5"></textarea>' +
                '<div class="pmg-vs-actions-row">' +
                  '<button type="button" id="pmg-vs-copy-prompt" class="pmg-vs-btn pmg-vs-btn-secondary">📋 Copy</button>' +
                  '<button type="button" id="pmg-vs-generate-btn" class="pmg-vs-btn pmg-vs-btn-primary" style="flex:1">✨ Generate</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // RESULT COLUMN
            '<div class="pmg-modal-col-result" id="pmg-vs-step-2">' +
              '<button type="button" id="pmg-vs-back-to-builder" class="pmg-mobile-only">← Edit Prompt</button>' +
              '<div class="pmg-vs-media-container">' +
                '<div id="pmg-vs-media-placeholder" class="pmg-media-placeholder">' +
                  '<span>✨ Your creation will appear here</span>' +
                  '<span class="pmg-vs-sub">Pick Image or Video, describe what you want, then Generate.</span>' +
                '</div>' +
                '<img id="pmg-vs-generated-image" alt="Generated image" hidden />' +
                '<video id="pmg-vs-generated-video" controls playsinline hidden></video>' +
              '</div>' +
              '<div id="pmg-vs-post-gen-actions" class="pmg-vs-actions-row" hidden>' +
                '<a id="pmg-vs-save-media" class="pmg-vs-btn pmg-vs-btn-secondary" download href="#">⬇ Save</a>' +
                '<button type="button" id="pmg-vs-download-dna" class="pmg-vs-btn pmg-vs-btn-secondary">🧬 DNA Card</button>' +
                '<button type="button" id="pmg-vs-share-dna" class="pmg-vs-btn pmg-vs-btn-secondary" hidden>↗ Share</button>' +
                '<button type="button" id="pmg-vs-regenerate" class="pmg-vs-btn pmg-vs-btn-secondary">🔄 Regenerate</button>' +
              '</div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  }

  function $(id) { return document.getElementById(id); }
  function modal()     { return $(MODAL_ID); }
  function modalBody() { return modal() && modal().querySelector('.pmg-modal-body'); }

  function activeMode() {
    var t = modal() && modal().querySelector('.pmg-vs-tab.active');
    return t ? t.getAttribute('data-vs-target') : 'image';
  }

  function isMobile() { return window.innerWidth <= MOBILE_BP; }

  // Track Photo Suite original DOM position so we can restore it on close.
  // Using a placeholder node is more robust than parent-ID lookup because the
  // chassis sometimes relocates parents too.
  var _suiteOriginalPlaceholder = null;
  var _suiteOriginalNextSibling = null;

  function relocatePhotoSuite() {
    var container = $('pmg-vs-photo-suite-container');
    if (!container) return;
    // Match the chassis lookup pattern: try the wrapper first, then the inner.
    var suite = document.getElementById('photo-suite-section')
             || document.getElementById('pmg-photo-suite');
    if (suite && !container.contains(suite)) {
      // Drop a placeholder where the suite lived so we can put it back exactly.
      if (!_suiteOriginalPlaceholder) {
        _suiteOriginalPlaceholder = document.createComment('pmg-vs-suite-placeholder');
        if (suite.parentNode) {
          suite.parentNode.insertBefore(_suiteOriginalPlaceholder, suite);
        }
      }
      container.innerHTML = '';
      container.appendChild(suite);
      // Make sure it's visible inside the modal regardless of legacy hidden state.
      suite.hidden = false;
      suite.removeAttribute('aria-hidden');
      suite.style.display = '';
    } else if (!suite) {
      container.innerHTML = '<p style="margin:6px 0 0;font-size:.85rem;opacity:.7">Photo controls aren\'t available on this page.</p>';
    }
  }

  function restorePhotoSuite() {
    var container = $('pmg-vs-photo-suite-container');
    var suite = container && (container.querySelector('#photo-suite-section') || container.querySelector('#pmg-photo-suite'));
    if (suite && _suiteOriginalPlaceholder && _suiteOriginalPlaceholder.parentNode) {
      _suiteOriginalPlaceholder.parentNode.insertBefore(suite, _suiteOriginalPlaceholder);
      _suiteOriginalPlaceholder.parentNode.removeChild(_suiteOriginalPlaceholder);
      _suiteOriginalPlaceholder = null;
    }
  }

  var _previouslyFocused = null;

  function openVisualStudio(opts) {
    buildModal();
    var m = modal(); if (!m) return;
    if (!m.hasAttribute('hidden')) return; // already open — no-op
    m.removeAttribute('hidden');
    var body = modalBody();
    if (body) body.classList.remove('is-step-2');

    // Default to image mode unless caller explicitly asks for video.
    var mode = (opts && opts.mode) || 'image';
    setTab(mode);

    relocatePhotoSuite();
    // Clear any prior result while preserving the prompt.
    resetResult();

    // Lock body scroll while modal is open
    document.documentElement.dataset.vsOpen = '1';
    document.body.style.overflow = 'hidden';

    // Remember what was focused so we can return to it on close.
    _previouslyFocused = document.activeElement;

    // Focus the goal textarea for the active mode
    setTimeout(function () {
      var input = mode === 'video' ? $('pmg-vs-video-goal') : $('pmg-vs-image-goal');
      if (input) try { input.focus(); } catch (_) {}
    }, 50);
  }

  function closeVisualStudio() {
    var m = modal(); if (!m) return;
    if (m.hasAttribute('hidden')) return;
    // Restore the Photo Suite to its original location BEFORE hiding the modal
    // so legacy code (Power Moves chip, photo-suite-handoff, accessibility
    // guard) finds it back where it was.
    restorePhotoSuite();
    m.setAttribute('hidden', '');
    document.documentElement.removeAttribute('data-vs-open');
    document.body.style.overflow = '';
    // Restore focus to whatever opened the modal.
    if (_previouslyFocused && typeof _previouslyFocused.focus === 'function') {
      try { _previouslyFocused.focus(); } catch (_) {}
    }
    _previouslyFocused = null;
  }

  // Keep Tab focus inside the modal while it's open. Picks the first/last
  // tabbable each time so it works after dynamic show/hide of inner sections.
  function trapFocus(e) {
    var m = modal();
    if (!m || m.hasAttribute('hidden')) return;
    if (e.key !== 'Tab') return;
    var focusables = m.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    // Filter out hidden ones (display:none ancestors return offsetParent null).
    var visible = [];
    for (var i = 0; i < focusables.length; i++) {
      if (focusables[i].offsetParent !== null || focusables[i] === document.activeElement) {
        visible.push(focusables[i]);
      }
    }
    if (visible.length === 0) return;
    var first = visible[0], last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function setTab(target) {
    var m = modal(); if (!m) return;
    var tabs = m.querySelectorAll('.pmg-vs-tab');
    tabs.forEach(function (t) {
      var active = t.getAttribute('data-vs-target') === target;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    var imgB = $('pmg-vs-image-builder');
    var vidB = $('pmg-vs-video-builder');
    if (imgB) imgB.hidden = target !== 'image';
    if (vidB) vidB.hidden = target !== 'video';
    // Reset refined output when switching modes — prompts don't transfer.
    var refined = m.querySelector('.pmg-vs-refined-output');
    if (refined) refined.hidden = true;
    resetResult();
  }

  function resetResult() {
    var ph  = $('pmg-vs-media-placeholder');
    var img = $('pmg-vs-generated-image');
    var vid = $('pmg-vs-generated-video');
    var act = $('pmg-vs-post-gen-actions');
    if (ph)  { ph.hidden = false; ph.innerHTML = '<span>✨ Your creation will appear here</span><span class="pmg-vs-sub">Pick Image or Video, describe what you want, then Generate.</span>'; }
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (vid) { vid.hidden = true; vid.removeAttribute('src'); }
    if (act) act.hidden = true;
  }

  function showLoading(label) {
    var ph = $('pmg-vs-media-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<div class="pmg-vs-spinner" aria-hidden="true"></div>' +
                   '<span>' + label + '</span>' +
                   '<span class="pmg-vs-sub">This can take 10–30 seconds.</span>';
  }

  function showError(msg) {
    var ph = $('pmg-vs-media-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML = '<span style="color:#ff8a8a">⚠️ ' + msg + '</span>';
  }

  function showUpgrade(msg) {
    var ph = $('pmg-vs-media-placeholder');
    if (!ph) return;
    ph.hidden = false;
    ph.innerHTML =
      '<div class="pmg-vs-upgrade-card" style="text-align:left;max-width:380px;margin:0 auto">' +
        '<h4>🎬 Founding Member Feature</h4>' +
        '<p>' + msg + '</p>' +
        '<a href="/pricing.html#founding-member-waitlist" class="pmg-vs-btn pmg-vs-btn-primary pmg-vs-full-width" style="text-decoration:none">See Founding Member Plan →</a>' +
      '</div>';
  }

  // --- Build prompt (refinement). For image, reuse existing /api/generate-prompt
  //     to refine free-form goal into a structured image prompt. For video,
  //     we compose the Sora directives client-side from the dropdowns.
  async function buildImagePrompt() {
    var goalEl = $('pmg-vs-image-goal');
    var goal = goalEl && goalEl.value.trim();
    if (!goal) { goalEl && goalEl.focus(); return; }
    var btn = $('pmg-vs-build-image-prompt-btn');
    var origLabel = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Building…';
    try {
      // Call /api/image which enhances internally — but we don't want to
      // generate yet. Instead, just hand-build a polished prompt from the
      // goal + any photo-suite hints. Cheap and local.
      var refined = goal;
      // Pull any selected photo-suite chips/inputs if present
      var suite = document.getElementById('photo-suite-section')
               || document.getElementById('pmg-photo-suite');
      if (suite) {
        var picked = [];
        suite.querySelectorAll('[aria-pressed="true"], .pmg-pill.is-active, .is-selected').forEach(function (n) {
          var t = (n.textContent || '').trim();
          if (t && t.length < 60) picked.push(t);
        });
        if (picked.length) refined += ' — ' + picked.join(', ');
      }
      var ta = $('pmg-vs-refined-prompt');
      ta.value = refined;
      modal().querySelector('.pmg-vs-refined-output').hidden = false;
      ta.focus();
    } finally {
      btn.disabled = false; btn.textContent = origLabel;
    }
  }

  function buildVideoPrompt() {
    var goalEl = $('pmg-vs-video-goal');
    var goal = goalEl && goalEl.value.trim();
    if (!goal) { goalEl && goalEl.focus(); return; }
    var directives = [];
    modal().querySelectorAll('[data-vs-sora]').forEach(function (sel) {
      var key = sel.getAttribute('data-vs-sora');
      var v = sel.value;
      if (!v) return;
      if (key === 'duration')   return;          // sent as n_seconds, not in prompt
      if (key === 'resolution') return;          // sent as resolution, not in prompt
      if (key === 'shot')       directives.push(v + ' shot');
      else if (key === 'movement') directives.push(v + ' camera movement');
      else if (key === 'mood')  directives.push(v + ' lighting');
      else if (key === 'style') directives.push(v + ' style');
    });
    var refined = goal + (directives.length ? '. ' + directives.join('. ') + '.' : '');
    var ta = $('pmg-vs-refined-prompt');
    ta.value = refined;
    modal().querySelector('.pmg-vs-refined-output').hidden = false;
    ta.focus();
  }

  // --- Generate
  async function generate() {
    var prompt = ($('pmg-vs-refined-prompt').value || '').trim();
    if (!prompt) { $('pmg-vs-refined-prompt').focus(); return; }
    var mode = activeMode();

    if (isMobile()) modalBody().classList.add('is-step-2');
    showLoading(mode === 'video' ? '⏳ Generating video with Sora…' : '⏳ Generating image with DALL·E 3…');

    var btn = $('pmg-vs-generate-btn');
    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = '⏳ Generating…';

    try {
      if (mode === 'video') {
        await generateVideo(prompt);
      } else {
        await generateImage(prompt);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  }

  async function generateImage(prompt) {
    try {
      var res = await fetch('/api/image', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt, size: window.__pmgAspectRatio || '1024x1024' }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) {
        showError(data.error || (res.status === 429 ? 'Daily image limit reached.' : 'Image generation failed.'));
        return;
      }
      showImageResult(data.url);
    } catch (e) {
      showError('Network error. Check your connection.');
    }
  }

  async function generateVideo(prompt) {
    var resSel  = modal().querySelector('[data-vs-sora="resolution"]');
    var durSel  = modal().querySelector('[data-vs-sora="duration"]');
    var resolution = resSel ? resSel.value : '720p';
    var nSeconds   = durSel ? Number(durSel.value) : 5;
    try {
      var res = await fetch('/api/video', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt, resolution: resolution, n_seconds: nSeconds }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 401 || res.status === 402) {
        showUpgrade(data.error || 'Video generation is a Founding Member feature.');
        return;
      }
      if (!res.ok || !data.url) {
        showError(data.error || 'Video generation failed.');
        return;
      }
      showVideoResult(data.url);
    } catch (e) {
      showError('Network error. Check your connection.');
    }
  }

  function showImageResult(url) {
    var ph = $('pmg-vs-media-placeholder');
    var img = $('pmg-vs-generated-image');
    var vid = $('pmg-vs-generated-video');
    var act = $('pmg-vs-post-gen-actions');
    if (vid) vid.hidden = true;
    if (img) { img.src = url; img.hidden = false; }
    if (ph)  ph.hidden = true;
    if (act) act.hidden = false;
    var save = $('pmg-vs-save-media');
    if (save) { save.href = url; save.setAttribute('download', 'promptmegood-image.png'); }
    // DNA card only makes sense for images
    var dna = $('pmg-vs-download-dna');
    if (dna) dna.hidden = false;
    var shareBtn = $('pmg-vs-share-dna');
    if (shareBtn) shareBtn.hidden = !navigator.share;
  }

  function showVideoResult(url) {
    var ph = $('pmg-vs-media-placeholder');
    var img = $('pmg-vs-generated-image');
    var vid = $('pmg-vs-generated-video');
    var act = $('pmg-vs-post-gen-actions');
    if (img) img.hidden = true;
    if (vid) { vid.src = url; vid.hidden = false; }
    if (ph)  ph.hidden = true;
    if (act) act.hidden = false;
    var save = $('pmg-vs-save-media');
    if (save) { save.href = url; save.setAttribute('download', 'promptmegood-video.mp4'); }
    var dna = $('pmg-vs-download-dna');
    if (dna) dna.hidden = true;
    var shareBtn = $('pmg-vs-share-dna');
    if (shareBtn) shareBtn.hidden = true;
  }

  // ---- Reverse Engine (Image → Prompt + Suite settings) ----
  function pickReverseImage() {
    var input = $('pmg-vs-reverse-input');
    if (!input) return;
    input.value = ''; // allow re-selecting the same file
    input.click();
  }

  async function handleReverseImage(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setReverseStatus('⚠️ Image is over 10 MB. Please pick a smaller one.', 'err');
      return;
    }
    var btn = $('pmg-vs-reverse-engineer-btn');
    if (btn) { btn.disabled = true; btn.dataset.origLabel = btn.textContent; btn.textContent = '🔬 Analyzing image DNA…'; }
    setReverseStatus('🔬 Analyzing image DNA — reading composition, light, palette…', 'info');
    try {
      var fd = new FormData();
      fd.append('image', file, file.name);
      // Auth header — re-use authHeaders() but drop Content-Type so the
      // browser sets the multipart boundary itself.
      var headers = authHeaders();
      delete headers['Content-Type'];
      var res = await fetch('/api/vision-analyze', { method: 'POST', body: fd, headers: headers });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.prompt) {
        setReverseStatus('⚠️ ' + (data.error || 'Could not analyze that image.'), 'err');
        return;
      }
      var ta = $('pmg-vs-image-goal');
      if (ta) {
        ta.value = data.prompt;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      applySuiteSettings(data.suite_settings || {});
      setReverseStatus('✓ Reverse engineered. Tweak the prompt below, then Generate.', 'ok');
    } catch (e) {
      setReverseStatus('⚠️ Network error. Please try again.', 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origLabel || '📸 Reverse Engineer an Image'; }
    }
  }

  function setReverseStatus(msg, kind) {
    var el = $('pmg-vs-reverse-status');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = 'pmg-vs-reverse-status pmg-vs-reverse-status--' + (kind || 'info');
  }

  // Best-effort programmatic select of Photography Suite pills/inputs based
  // on the suite_settings object returned by the vision model. We try to
  // match by visible text — if no exact match, we just leave the pill alone.
  function applySuiteSettings(settings) {
    var suite = document.getElementById('photo-suite-section')
             || document.getElementById('pmg-photo-suite');
    if (!suite || !settings) return;
    var allPills = suite.querySelectorAll('.pmg-pill, [data-pmg-pill], button[role="option"]');
    if (!allPills.length) return;
    Object.keys(settings).forEach(function (cat) {
      var raw = String(settings[cat] || '').trim();
      if (!raw) return;
      // Split comma-separated suggestions into individual phrases
      var candidates = raw.split(/,|\u2022|\//).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      candidates.forEach(function (cand) {
        for (var i = 0; i < allPills.length; i++) {
          var p = allPills[i];
          var t = (p.textContent || '').trim().toLowerCase();
          if (!t) continue;
          if (t === cand || t.indexOf(cand) >= 0 || cand.indexOf(t) >= 0) {
            // Activate only if not already active
            var already = p.getAttribute('aria-pressed') === 'true' || p.classList.contains('is-active') || p.classList.contains('is-selected');
            if (!already) {
              try { p.click(); } catch (_) {}
            }
            break; // one match per candidate is enough
          }
        }
      });
    });
  }

  // ---- Prompt DNA Card (canvas composite of image + prompt) ----
  async function downloadDnaCard() {
    var img = $('pmg-vs-generated-image');
    if (!img || img.hidden || !img.src) return null;
    var prompt = ($('pmg-vs-refined-prompt') && $('pmg-vs-refined-prompt').value) ||
                 ($('pmg-vs-image-goal') && $('pmg-vs-image-goal').value) || '';
    return composeDnaCard(img.src, prompt).then(function (dataUrl) {
      if (!dataUrl) return null;
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'promptmegood-dna-card.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return dataUrl;
    });
  }

  async function shareDnaCard() {
    if (!navigator.share) return;
    var img = $('pmg-vs-generated-image');
    if (!img || img.hidden || !img.src) return;
    var prompt = ($('pmg-vs-refined-prompt') && $('pmg-vs-refined-prompt').value) ||
                 ($('pmg-vs-image-goal') && $('pmg-vs-image-goal').value) || '';
    var dataUrl = await composeDnaCard(img.src, prompt);
    if (!dataUrl) return;
    try {
      var blob = await (await fetch(dataUrl)).blob();
      var file = new File([blob], 'promptmegood-dna-card.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My PromptMeGood DNA Card', text: prompt.slice(0, 200) });
      } else {
        await navigator.share({ title: 'My PromptMeGood DNA Card', text: prompt.slice(0, 200) });
      }
    } catch (_) { /* user cancel — fine */ }
  }

  // Compose a 1080x1350 portrait card: top 1080x1080 image, bottom 270 strip
  // with the prompt text + brand stamp. Same DOM-side image is used so we
  // already have CORS access (DALL·E URLs are public).
  function composeDnaCard(imgSrc, promptText) {
    return new Promise(function (resolve) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        var W = 1080, H = 1350, IMG_H = 1080;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        // Background — deep teal to match brand
        ctx.fillStyle = '#0a2420';
        ctx.fillRect(0, 0, W, H);
        // Image — fit-cover into 1080x1080
        var iw = im.naturalWidth, ih = im.naturalHeight;
        var scale = Math.max(W / iw, IMG_H / ih);
        var dw = iw * scale, dh = ih * scale;
        var dx = (W - dw) / 2, dy = (IMG_H - dh) / 2;
        try {
          ctx.drawImage(im, dx, dy, dw, dh);
        } catch (e) {
          // CORS taint — bail to a blank-image card
          ctx.fillStyle = '#11342f';
          ctx.fillRect(0, 0, W, IMG_H);
          ctx.fillStyle = '#3ee0a0';
          ctx.font = 'bold 28px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('(Image preview unavailable for export)', W / 2, IMG_H / 2);
        }
        // Brand stamp overlay
        ctx.fillStyle = 'rgba(10,36,32,0.78)';
        ctx.fillRect(24, IMG_H - 64, 280, 44);
        ctx.fillStyle = '#3ee0a0';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🧬 PromptMeGood', 40, IMG_H - 34);
        // Prompt strip
        ctx.fillStyle = '#0a2420';
        ctx.fillRect(0, IMG_H, W, H - IMG_H);
        ctx.strokeStyle = '#3ee0a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, IMG_H);
        ctx.lineTo(W, IMG_H);
        ctx.stroke();
        ctx.fillStyle = '#3ee0a0';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('THE PROMPT', 48, IMG_H + 36);
        ctx.fillStyle = '#e8f5f0';
        ctx.font = '20px ui-monospace, "SF Mono", Menlo, monospace';
        wrapText(ctx, promptText.trim() || '(no prompt)', 48, IMG_H + 70, W - 96, 26, 7);
        try { resolve(canvas.toDataURL('image/png')); }
        catch (_) {
          // Canvas is tainted (CORS denied at export time). Fall back to a
          // brand-only card with the prompt text + an "image unavailable"
          // notice so the user always gets a downloadable artefact.
          resolve(composeFallbackDnaCard(promptText));
        }
      };
      im.onerror = function () {
        // Image failed to load — still produce a brand-only card.
        resolve(composeFallbackDnaCard(promptText));
      };
      im.src = imgSrc;
    });
  }

  // ---- Chassis launchers (discoverability) ----
  function injectChassisLaunchers() {
    // Top-bar — primary mobile entry point. Two compact icon buttons
    // injected into .pmgv2-tb-r BEFORE the help-start pill so they sit
    // next to the avatar/help icons. Always visible, no bottom chrome.
    var topbarRight = document.querySelector('.pmgv2-tb-r');
    if (topbarRight && !document.getElementById('pmg-vs-tb-launch')) {
      var helpStart = topbarRight.querySelector('.pmgv2-help-start');
      var tbVs = document.createElement('button');
      tbVs.type = 'button';
      tbVs.id = 'pmg-vs-tb-launch';
      tbVs.className = 'pmgv2-ico pmg-vs-tb-ico';
      tbVs.setAttribute('data-pmg-open-visual-studio', '1');
      tbVs.setAttribute('data-vs-mode', 'image');
      tbVs.setAttribute('title', 'Open Visual Studio (Image + Sora Video)');
      tbVs.setAttribute('aria-label', 'Open Visual Studio');
      tbVs.textContent = '🎨';
      var tbSb = document.createElement('button');
      tbSb.type = 'button';
      tbSb.id = 'pmg-sb-tb-launch';
      tbSb.className = 'pmgv2-ico pmg-vs-tb-ico';
      tbSb.setAttribute('data-pmg-action', 'generate-storyboard');
      tbSb.setAttribute('title', 'Generate Storyboard (5-shot cinematic sequence)');
      tbSb.setAttribute('aria-label', 'Generate Storyboard');
      tbSb.textContent = '🎞️';
      if (helpStart) {
        topbarRight.insertBefore(tbVs, helpStart);
        topbarRight.insertBefore(tbSb, helpStart);
      } else {
        topbarRight.appendChild(tbVs);
        topbarRight.appendChild(tbSb);
      }
    }
    // Right-rail header — desktop primary entry point.
    var railHeader = document.querySelector('.pmgv2-tools-h');
    if (railHeader && !document.getElementById('pmg-vs-launch-rail')) {
      var railBtn = document.createElement('button');
      railBtn.type = 'button';
      railBtn.id = 'pmg-vs-launch-rail';
      railBtn.className = 'pmg-vs-launch-rail';
      railBtn.setAttribute('data-pmg-open-visual-studio', '1');
      railBtn.innerHTML = '🎨 Open Visual Studio';
      railBtn.title = 'Open the full Image + Video builder';
      railHeader.appendChild(railBtn);
    }
    // Always-visible launcher dock — sits OUTSIDE .pmgv2-composer-wrap so
    // it stays visible when the mobile composer collapses to a pill.
    // CSS positions it as a fixed bar above the composer-tab/dock on
    // mobile, and as an inline element inside .pmgv2-main on desktop.
    var main = document.querySelector('.pmgv2-main');
    if (main && !document.getElementById('pmg-vs-launch-composer')) {
      var row = document.createElement('div');
      row.id = 'pmg-vs-launch-composer-row';
      row.className = 'pmg-vs-launch-row';
      row.innerHTML =
        '<button type="button" id="pmg-vs-launch-composer" class="pmg-vs-launch-pill" data-pmg-open-visual-studio="1" data-vs-mode="image">🎨 Image Studio</button>' +
        '<button type="button" id="pmg-vs-launch-composer-video" class="pmg-vs-launch-pill" data-pmg-open-visual-studio="1" data-vs-mode="video">🎬 Sora Video</button>';
      main.appendChild(row);
      // Adopt the storyboard button if it was already mounted elsewhere.
      var sbBtn = document.getElementById('pmg-generate-storyboard-btn');
      if (sbBtn && sbBtn.parentNode !== row) {
        sbBtn.classList.add('pmg-vs-launch-pill', 'pmg-sb-launch-pill');
        sbBtn.style.cssText = '';
        sbBtn.innerHTML = '🎞️ Storyboard';
        row.appendChild(sbBtn);
      }
    }
  }

  function composeFallbackDnaCard(promptText) {
    var W = 1080, H = 1350, IMG_H = 1080;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Brand background
    ctx.fillStyle = '#0a2420';
    ctx.fillRect(0, 0, W, H);
    // Top region — brand-only card
    var grad = ctx.createLinearGradient(0, 0, 0, IMG_H);
    grad.addColorStop(0, '#11342f'); grad.addColorStop(1, '#0a2420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, IMG_H);
    ctx.fillStyle = '#3ee0a0';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧬 PromptMeGood', W / 2, IMG_H / 2 - 30);
    ctx.fillStyle = 'rgba(232,245,240,0.7)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('(Image preview unavailable for export)', W / 2, IMG_H / 2 + 18);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The prompt that built this image is below.', W / 2, IMG_H / 2 + 50);
    // Prompt strip
    ctx.strokeStyle = '#3ee0a0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, IMG_H); ctx.lineTo(W, IMG_H); ctx.stroke();
    ctx.fillStyle = '#3ee0a0';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THE PROMPT', 48, IMG_H + 36);
    ctx.fillStyle = '#e8f5f0';
    ctx.font = '20px ui-monospace, "SF Mono", Menlo, monospace';
    wrapText(ctx, (promptText || '').trim() || '(no prompt)', 48, IMG_H + 70, W - 96, 26, 7);
    try { return canvas.toDataURL('image/png'); } catch (_) { return null; }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = text.split(/\s+/);
    var line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines - 1) {
          // Last line — truncate with ellipsis
          var rest = words.slice(i).join(' ');
          while (ctx.measureText(rest + '…').width > maxWidth && rest.length) {
            rest = rest.slice(0, -1);
          }
          lines.push(rest + '…');
          line = '';
          break;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lineHeight);
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var token = (window.PMG_AUTH && window.PMG_AUTH.token) || null;
      if (!token && window.localStorage) {
        token = localStorage.getItem('pmg_supabase_access_token') || null;
      }
      if (token) h['Authorization'] = 'Bearer ' + token;
    } catch (_) {}
    return h;
  }

  // --- Wire global event listeners (delegation so buttons inside the
  //     legacy DOM keep working even after relocations).
  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pmg-open-visual-studio], #pmg-open-visual-studio, .pmg-vs-open');
      if (t) {
        e.preventDefault();
        var mode = t.getAttribute('data-vs-mode') || 'image';
        openVisualStudio({ mode: mode });
        return;
      }

      // Open modal when legacy "Create An Image" mode button is tapped.
      // We do NOT preventDefault/stopPropagation so the existing onclick
      // (setMode('image')) and any other delegated listeners still fire —
      // body.image-mode must stay in sync for Power Moves chip, image-
      // result-section visibility, and existing tests.
      if (e.target.closest('#imageModeBtn')) {
        openVisualStudio({ mode: 'image' });
        return;
      }

      // Modal internals
      if (!modal()) return;
      if (e.target.closest('#pmg-close-visual-studio')) {
        closeVisualStudio();
        return;
      }
      var tab = e.target.closest('.pmg-vs-tab');
      if (tab && modal().contains(tab)) {
        setTab(tab.getAttribute('data-vs-target'));
        return;
      }
      if (e.target.closest('#pmg-vs-back-to-builder')) {
        modalBody().classList.remove('is-step-2');
        return;
      }
      if (e.target.closest('#pmg-vs-build-image-prompt-btn')) { buildImagePrompt(); return; }
      if (e.target.closest('#pmg-vs-build-video-prompt-btn')) { buildVideoPrompt(); return; }
      if (e.target.closest('#pmg-vs-generate-btn'))            { generate();         return; }
      if (e.target.closest('#pmg-vs-regenerate'))              { generate();         return; }
      if (e.target.closest('#pmg-vs-reverse-engineer-btn'))    { pickReverseImage(); return; }
      if (e.target.closest('#pmg-vs-download-dna'))            { downloadDnaCard();  return; }
      if (e.target.closest('#pmg-vs-share-dna'))               { shareDnaCard();     return; }
      if (e.target.closest('#pmg-vs-copy-prompt')) {
        var ta = $('pmg-vs-refined-prompt');
        if (ta && navigator.clipboard) {
          navigator.clipboard.writeText(ta.value).then(function () {
            var b = $('pmg-vs-copy-prompt');
            var orig = b.textContent;
            b.textContent = '✓ Copied';
            setTimeout(function () { b.textContent = orig; }, 1400);
          });
        }
        return;
      }

      // Click on the dimmed overlay (outside content) closes the modal
      if (e.target === modal()) closeVisualStudio();
    }, true); // capture so we beat legacy handlers on #imageModeBtn

    // Esc closes; Tab is trapped inside the modal while it's open.
    document.addEventListener('keydown', function (e) {
      if (!modal() || modal().hasAttribute('hidden')) return;
      if (e.key === 'Escape') { closeVisualStudio(); return; }
      trapFocus(e);
    });

    // Reverse-engine file input — fire on selection.
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'pmg-vs-reverse-input') {
        var f = e.target.files && e.target.files[0];
        if (f) handleReverseImage(f);
      }
    });

    // Inject visible Visual Studio launchers into the chassis chrome so
    // the modal actually has a discoverable entry point on both desktop
    // (right-rail header) and mobile (composer area).
    injectChassisLaunchers();
    // Re-attempt as the chassis builds itself lazily.
    var lcObs = new MutationObserver(function () {
      injectChassisLaunchers();
      if (document.querySelector('#pmg-vs-launch-rail') &&
          document.querySelector('#pmg-vs-launch-composer')) {
        lcObs.disconnect();
      }
    });
    lcObs.observe(document.body, { childList: true, subtree: true });

    // Mobile Visual dock-tab → INLINE-MOUNT the modal panel into the
    // chassis .pmgv2-tools slot so it renders as a full page-swap (no
    // overlay, no backdrop). When tab flips away, restore modal to body
    // so the desktop "Open Visual Studio" button keeps working as a
    // proper modal. Mobile-only via matchMedia.
    var lastTab = null;
    var html = document.documentElement;
    var mql = window.matchMedia('(max-width: 900px)');
    function inlineMount() {
      var m = (typeof modal === 'function' ? modal() : null) || document.getElementById('pmg-visual-studio-modal');
      if (!m) { buildModal(); m = document.getElementById('pmg-visual-studio-modal'); }
      if (!m) return;
      var slot = document.querySelector('.pmgv2-tools');
      if (!slot) return;
      if (m.parentNode === slot) return;
      m.classList.add('pmg-vs-inline');
      m.removeAttribute('hidden');
      m.setAttribute('aria-modal', 'false');
      slot.appendChild(m);
      try { relocatePhotoSuite(); } catch (_) {}
      try { setTab('image'); } catch (_) {}
      // Don't lock body scroll — we're inline now.
      try { delete html.dataset.vsOpen; } catch (_) {}
      document.body.style.overflow = '';
    }
    function inlineUnmount() {
      var m = document.getElementById('pmg-visual-studio-modal');
      if (!m || !m.classList.contains('pmg-vs-inline')) return;
      m.classList.remove('pmg-vs-inline');
      m.setAttribute('aria-modal', 'true');
      m.setAttribute('hidden', '');
      try { restorePhotoSuite(); } catch (_) {}
      document.body.appendChild(m);
    }
    function checkTab() {
      var cur = html.getAttribute('data-pmgv2-mobile-tab');
      if (cur === lastTab) return;
      lastTab = cur;
      if (!mql.matches) { inlineUnmount(); return; }
      if (cur === 'suite') inlineMount();
      else inlineUnmount();
    }
    var mo = new MutationObserver(checkTab);
    mo.observe(html, { attributes: true, attributeFilter: ['data-pmgv2-mobile-tab'] });
    if (mql.addEventListener) mql.addEventListener('change', function () { lastTab = null; checkTab(); });
    checkTab();
  }

  // Expose for legacy callers / debugging
  window.openVisualStudio  = openVisualStudio;
  window.closeVisualStudio = closeVisualStudio;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
