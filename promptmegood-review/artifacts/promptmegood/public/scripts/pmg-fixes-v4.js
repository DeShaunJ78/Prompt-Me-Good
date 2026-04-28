(function () {
  'use strict';
  if (window.__PMG_FIXES_V4__) return;
  window.__PMG_FIXES_V4__ = true;

  var HAS_GENERATED_KEY = 'pmg_has_generated';

  function readHasGenerated() {
    try {
      var v = localStorage.getItem(HAS_GENERATED_KEY);
      if (v === 'true' || v === '1') return true;
    } catch (e) {}
    return !!(document.body && document.body.classList && document.body.classList.contains('pmg-has-generated'));
  }

  function injectStyles() {
    if (document.getElementById('pmg-fixes-v4-style')) return;
    var css = [
      '#builder, #weekly-goal-pin, #aiResponseSection, #imageResultSection, #runSection, #improve-block, #pmg-what-next-block, #resultBox { scroll-margin-top: 24px; }',

      '.pmg-strength-pill { display: none; align-items: center; gap: 8px; margin: 6px 0 10px; padding: 6px 12px; border-radius: 999px; background: var(--color-surface-2, color-mix(in srgb, var(--color-primary) 4%, transparent)); border: 1px solid var(--color-border); font-size: 13px; font-weight: 600; width: fit-content; transition: background 0.2s ease, border-color 0.2s ease; }',
      '.pmg-strength-pill.is-visible { display: inline-flex; }',
      '.pmg-strength-dot { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; transition: background 0.2s ease, box-shadow 0.2s ease; }',
      '.pmg-strength-pill[data-level="too-short"] .pmg-strength-dot { background: #9ca3af; }',
      '.pmg-strength-pill[data-level="getting"] .pmg-strength-dot { background: #f59e0b; }',
      '.pmg-strength-pill[data-level="good"] .pmg-strength-dot { background: #3b82f6; }',
      '.pmg-strength-pill[data-level="strong"] .pmg-strength-dot { background: #10b981; box-shadow: 0 0 0 4px color-mix(in srgb, #10b981 20%, transparent); }',
      '.pmg-strength-pill[data-level="strong"] { animation: pmgStrengthPulse 0.6s ease-out 1; }',
      '@keyframes pmgStrengthPulse { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }',

      '.pmg-what-next-block { display: none; margin: 16px 0; padding: 16px; background: color-mix(in srgb, var(--color-primary) 6%, transparent); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md, 8px); }',
      'body.pmg-has-generated .pmg-what-next-block { display: block; }',
      '.pmg-what-next-title { margin: 0 0 12px; font-size: var(--text-base, 16px); font-weight: 700; color: var(--color-text); }',
      '.pmg-what-next-rows { display: flex; flex-direction: column; gap: 8px; }',
      '.pmg-what-next-row { display: flex; align-items: center; gap: 12px; min-height: 52px; width: 100%; padding: 12px 14px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-text); text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.05s; font: inherit; }',
      '.pmg-what-next-row:hover, .pmg-what-next-row:focus-visible { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)); outline: none; }',
      '.pmg-what-next-row:active { transform: scale(0.99); }',
      '.pmg-what-next-icon { font-size: 22px; flex: 0 0 auto; width: 32px; text-align: center; }',
      '.pmg-what-next-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }',
      '.pmg-what-next-label { font-weight: 700; font-size: 15px; }',
      '.pmg-what-next-desc { font-size: 13px; color: var(--color-text-muted); line-height: 1.4; }',
      '@media (min-width: 769px) {',
      '  .pmg-what-next-rows { flex-direction: row; }',
      '  .pmg-what-next-row { flex-direction: column; align-items: center; text-align: center; min-height: 80px; padding: 14px 12px; }',
      '  .pmg-what-next-icon { font-size: 24px; width: auto; }',
      '  .pmg-what-next-text { align-items: center; text-align: center; }',
      '}',

      '.pmg-photo-assistant { display: none; margin: 0 0 16px; padding: 16px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: var(--radius-lg, 12px); }',
      'body.image-mode .pmg-photo-assistant { display: block; }',
      'body.image-mode .pmg-photo-assistant.is-collapsed { display: none; }',
      '.pmg-photo-edit-link { display: none; margin: 0 0 12px; padding: 8px 12px; background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-primary); cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; text-align: left; }',
      'body.image-mode .pmg-photo-edit-link.is-visible { display: inline-block; }',
      '.pmg-photo-head { margin: 0 0 12px; }',
      '.pmg-photo-title { margin: 0 0 4px; font-size: var(--text-base, 16px); font-weight: 700; color: var(--color-text); }',
      '.pmg-photo-sub { margin: 0; font-size: 13px; color: var(--color-text-muted); }',
      '.pmg-photo-q { padding: 12px 0; border-top: 1px solid var(--color-border); }',
      '.pmg-photo-q:first-of-type { border-top: 0; padding-top: 4px; }',
      '.pmg-photo-q-label { display: block; margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--color-text); }',
      '.pmg-photo-q-input { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); background: var(--color-surface, #fff); color: var(--color-text); font: inherit; font-size: 14px; box-sizing: border-box; }',
      '.pmg-photo-q-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent); }',
      '.pmg-photo-pills { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.pmg-photo-pill { padding: 8px 14px; background: var(--color-surface, #fff); border: 1px solid var(--color-border); border-radius: 999px; cursor: pointer; font: inherit; font-size: 13px; color: var(--color-text); min-height: 36px; transition: background 0.15s, border-color 0.15s, color 0.15s; }',
      '.pmg-photo-pill:hover { border-color: var(--color-primary); }',
      '.pmg-photo-pill[aria-pressed="true"] { background: var(--color-primary); border-color: var(--color-primary); color: #fff; font-weight: 600; }',
      '.pmg-photo-build-btn { width: 100%; margin-top: 14px; padding: 14px 20px; min-height: 48px; }',

      '.pmg-help-me-start-btn { display: none; width: 100%; margin: 8px 0 4px; min-height: 44px; }',
      'body:not(.image-mode) .pmg-help-me-start-btn { display: inline-flex; }',
      'body.image-mode .pmg-help-me-start-btn { display: none !important; }',
      '#pmg-help-me-start-link { display: none !important; }',

      '.pmg-nav-search-toggle { display: none; align-items: center; justify-content: center; width: 40px; min-width: 40px; height: 40px; padding: 0; background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md, 8px); color: var(--color-text); cursor: pointer; font-size: 18px; }',
      '.pmg-nav-search-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }',
      '@media (max-width: 768px) {',
      '  .global-search { display: none !important; }',
      '  .global-search.pmg-expanded { display: flex !important; position: absolute; top: 100%; right: 0; left: 0; z-index: 60; padding: 12px 16px; background: var(--color-surface, #fff); border-bottom: 1px solid var(--color-border); margin: 0; max-width: none; }',
      '  .global-search.pmg-expanded .global-search-label, .global-search.pmg-expanded .global-search-helper { display: none; }',
      '}',

      '#guided-overlay, .guided-overlay, .modal-content, [data-guided], #guided-mode-modal { touch-action: pan-y !important; -webkit-overflow-scrolling: touch !important; }',
      '#guided-overlay .modal-content, .guided-overlay .modal-content { max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }',

      'body.pmg-image-reordered #generateBtn { display: none !important; }',

      '.hero-proof-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-2, 8px) var(--space-3, 12px); margin-top: var(--space-4, 16px); padding: var(--space-3, 12px) var(--space-4, 16px); background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border-radius: 999px; border: 1px solid color-mix(in srgb, var(--color-primary) 15%, var(--color-border)); }',
      '.hero-proof-item { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-xs, 12px); font-weight: 600; color: var(--color-text-muted); white-space: nowrap; }',
      '.hero-proof-sep { color: var(--color-border); font-size: var(--text-sm, 14px); }',
      '@media (max-width: 540px) {',
      '  .hero-proof-sep { display: none; }',
      '  .hero-proof-bar { gap: var(--space-2, 8px); border-radius: var(--radius-lg, 12px); padding: 10px 12px; }',
      '  .hero-proof-item { font-size: 11px; }',
      '}',

      '@media (min-width: 920px) {',
      '  .hero { padding-top: clamp(1.5rem, 3vw, 2.5rem) !important; padding-bottom: clamp(1rem, 2vw, 1.5rem) !important; min-height: unset !important; }',
      '  .hero-heading { font-size: clamp(2rem, 3.2vw, 3rem) !important; margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-subtext-box { margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-actions { margin-bottom: var(--space-3, 12px) !important; }',
      '  .hero-proof-bar { margin-top: var(--space-3, 12px) !important; padding-top: 8px !important; padding-bottom: 8px !important; }',
      '  .hero-testimonial { margin-top: var(--space-3, 12px) !important; }',
      '  .desktop-below-fold { display: none !important; }',
      '  .desktop-below-fold.revealed { display: block !important; }',
      '}',

      '@media (min-width: 1024px) {',
      '  .pmg-result-sticky { position: sticky; top: 24px; align-self: start; }',
      '}',

      '@media (max-width: 768px) {',
      '  .pmg-strength-pill { width: 100%; max-width: none; justify-content: flex-start; }',
      '  .pmg-photo-pills { gap: 6px; }',
      '  .pmg-photo-pill { padding: 10px 14px; min-height: 44px; font-size: 14px; }',
      '  .pmg-nav-search-toggle { display: inline-flex; }',
      '}',
      '@media (min-width: 769px) {',
      '  .pmg-nav-search-toggle { display: none !important; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pmg-fixes-v4-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setupGoalLabelMode() {
    var goalLabel = document.querySelector('label[for="goal"]');
    if (!goalLabel) return;
    function update() {
      var isImg = document.body.classList.contains('image-mode');
      goalLabel.textContent = isImg ? 'Your Image' : 'Your Goal';
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupStrengthIndicator() {
    var goal = document.getElementById('goal');
    if (!goal) return;
    if (document.getElementById('pmg-strength-pill')) return;
    var pill = document.createElement('div');
    pill.id = 'pmg-strength-pill';
    pill.className = 'pmg-strength-pill';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    pill.dataset.level = 'too-short';
    var dot = document.createElement('span');
    dot.className = 'pmg-strength-dot';
    var label = document.createElement('span');
    label.className = 'pmg-strength-label';
    label.textContent = 'Too Short';
    pill.appendChild(dot);
    pill.appendChild(label);

    var helper = goal.parentNode ? goal.parentNode.querySelector('.helper') : null;
    if (helper && helper.parentNode) {
      helper.parentNode.insertBefore(pill, helper);
    } else if (goal.parentNode) {
      goal.parentNode.insertBefore(pill, goal.nextSibling);
    }

    var POWER = /\b(who|what|how|why|help me|i want|i need|my|for|because|so that|make sure|avoid|include|step by step|list|explain|create|write|build|find|give me|show me)\b/i;
    function update() {
      var v = (goal.value || '').trim();
      if (!v) {
        pill.classList.remove('is-visible');
        return;
      }
      pill.classList.add('is-visible');
      var len = v.length;
      var lvl = 'too-short';
      var txt = 'Too Short';
      if (POWER.test(v) && len >= 21) {
        lvl = 'strong'; txt = 'Strong ✓';
      } else if (len > 120) {
        lvl = 'strong'; txt = 'Strong ✓';
      } else if (len >= 61) {
        lvl = 'good'; txt = 'Good';
      } else if (len >= 21) {
        lvl = 'getting'; txt = 'Getting There';
      }
      var prev = pill.dataset.level;
      pill.dataset.level = lvl;
      label.textContent = txt;
      if (lvl === 'strong' && prev !== 'strong') {
        pill.style.animation = 'none';
        void pill.offsetWidth;
        pill.style.animation = '';
      }
    }
    goal.addEventListener('input', update);
    goal.addEventListener('change', update);
    update();

    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        setTimeout(function () { pill.classList.remove('is-visible'); }, 100);
      });
    }
  }

  var PHOTO_QUESTIONS = [
    { key: 'subject', type: 'text', label: 'What Is The Main Subject?', placeholder: 'A person, animal, object, landscape, scene...' },
    { key: 'shot', type: 'pills', label: 'Shot Type — How Close Are We?', options: [
      'Extreme Close-Up (Face, Texture, Detail)',
      'Close-Up (Head And Shoulders)',
      'Medium Shot (Waist Up)',
      'Full Body Shot',
      'Wide Shot (Subject + Environment)',
      "Aerial / Bird's Eye View",
      "Worm's Eye View (Looking Up)",
      'Over The Shoulder'
    ]},
    { key: 'lens', type: 'pills', label: 'Camera Lens Feel?', options: [
      'Wide Angle (Expansive, Dramatic)',
      'Standard (Natural, True To Life)',
      'Telephoto (Compressed, Intimate)',
      'Macro (Ultra Close Detail)',
      'Fisheye (Distorted, Creative)',
      'Tilt-Shift (Miniature Effect)'
    ]},
    { key: 'lighting', type: 'pills', label: 'Lighting Setup?', options: [
      'Golden Hour (Warm, Soft Sunset)',
      'Blue Hour (Cool, Moody Dusk)',
      'Harsh Midday Sun (High Contrast)',
      'Overcast (Soft, Even, No Shadows)',
      'Studio Lighting (Clean, Controlled)',
      'Neon & Artificial (Urban Night)',
      'Candlelight / Fire (Warm, Intimate)',
      'Backlit (Silhouette, Halo Effect)'
    ]},
    { key: 'mood', type: 'pills', label: 'Mood And Color Palette?', options: [
      'Cinematic & Dramatic',
      'Bright & Airy',
      'Dark & Moody',
      'Warm & Nostalgic',
      'Cool & Minimal',
      'Vibrant & Saturated',
      'Black & White',
      'Vintage Film Grain'
    ]},
    { key: 'camera', type: 'text', label: 'Camera And Film Style? (Optional)', placeholder: 'Shot on iPhone 16 Pro, Canon 5D, Kodak Portra 400, 35mm film, 8K RAW...' }
  ];

  function setupPhotoAssistant() {
    if (document.getElementById('pmg-photo-assistant')) return;
    var goal = document.getElementById('goal');
    var goalField = goal ? goal.closest('.field') : null;
    if (!goalField || !goalField.parentNode) return;

    var assistant = document.createElement('div');
    assistant.id = 'pmg-photo-assistant';
    assistant.className = 'pmg-photo-assistant';

    var head = document.createElement('div');
    head.className = 'pmg-photo-head';
    var title = document.createElement('p');
    title.className = 'pmg-photo-title';
    title.textContent = 'Photographer Vision Assistant';
    var sub = document.createElement('p');
    sub.className = 'pmg-photo-sub';
    sub.textContent = "Answer 6 quick questions and we'll build your perfect image prompt — like a professional photographer would.";
    head.appendChild(title);
    head.appendChild(sub);
    assistant.appendChild(head);

    var answers = {};

    PHOTO_QUESTIONS.forEach(function (q) {
      var wrap = document.createElement('div');
      wrap.className = 'pmg-photo-q';
      var lbl = document.createElement('label');
      lbl.className = 'pmg-photo-q-label';
      lbl.textContent = q.label;
      wrap.appendChild(lbl);
      if (q.type === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pmg-photo-q-input';
        input.placeholder = q.placeholder || '';
        input.dataset.photoKey = q.key;
        input.addEventListener('input', function () { answers[q.key] = input.value.trim(); });
        wrap.appendChild(input);
      } else if (q.type === 'pills') {
        var pillsWrap = document.createElement('div');
        pillsWrap.className = 'pmg-photo-pills';
        q.options.forEach(function (opt) {
          var pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'pmg-photo-pill';
          pill.setAttribute('aria-pressed', 'false');
          pill.textContent = opt;
          pill.addEventListener('click', function () {
            var pressed = pill.getAttribute('aria-pressed') === 'true';
            Array.prototype.forEach.call(pillsWrap.querySelectorAll('.pmg-photo-pill'), function (p) {
              p.setAttribute('aria-pressed', 'false');
            });
            if (!pressed) {
              pill.setAttribute('aria-pressed', 'true');
              answers[q.key] = opt;
            } else {
              answers[q.key] = '';
            }
          });
          pillsWrap.appendChild(pill);
        });
        wrap.appendChild(pillsWrap);
      }
      assistant.appendChild(wrap);
    });

    var buildBtn = document.createElement('button');
    buildBtn.type = 'button';
    buildBtn.className = 'btn btn-primary pmg-photo-build-btn';
    buildBtn.id = 'pmg-photo-build-btn';
    buildBtn.textContent = 'Build My Image Prompt →';
    assistant.appendChild(buildBtn);

    var editLink = document.createElement('button');
    editLink.type = 'button';
    editLink.id = 'pmg-photo-edit-link';
    editLink.className = 'pmg-photo-edit-link';
    editLink.textContent = '✏️ Edit Image Details';

    goalField.parentNode.insertBefore(editLink, goalField);
    goalField.parentNode.insertBefore(assistant, goalField);

    function stripParen(s) { return (s || '').replace(/\s*\([^)]*\)\s*/g, '').trim(); }
    buildBtn.addEventListener('click', function () {
      var subject = answers.subject || '';
      var shot = stripParen(answers.shot || '');
      var lens = stripParen(answers.lens || '');
      var lighting = stripParen(answers.lighting || '');
      var mood = stripParen(answers.mood || '');
      var camera = answers.camera || '';
      var parts = [];
      if (shot && subject) parts.push(shot.toLowerCase() + ' of ' + subject);
      else if (subject) parts.push(subject);
      if (lens) parts.push(lens.toLowerCase() + ' lens');
      if (lighting) parts.push(lighting.toLowerCase() + ' lighting');
      if (mood) parts.push(mood.toLowerCase());
      if (camera) parts.push(camera);
      var combined = parts.join(', ').replace(/\s+,/g, ',').trim();
      if (goal && combined) {
        goal.value = combined;
        goal.dispatchEvent(new Event('input', { bubbles: true }));
      }
      assistant.classList.add('is-collapsed');
      editLink.classList.add('is-visible');
      if (goal) goal.focus();
    });
    editLink.addEventListener('click', function () {
      assistant.classList.remove('is-collapsed');
      editLink.classList.remove('is-visible');
    });
  }

  function setupHelpMeStartButton() {
    var generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;
    if (document.getElementById('pmg-help-me-start-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-help-me-start-btn';
    btn.className = 'btn btn-secondary pmg-help-me-start-btn';
    btn.textContent = '💡 Help Me Start';
    btn.addEventListener('click', function () {
      var orig = document.getElementById('guided-mode-btn');
      if (orig) orig.click();
    });
    var actionsRow = generateBtn.parentNode;
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.parentNode.insertBefore(btn, actionsRow.nextSibling);
    }
  }

  function setupWhatNextBlock() {
    if (document.getElementById('pmg-what-next-block')) return;
    var resultBox = document.getElementById('resultBox');
    if (!resultBox || !resultBox.parentNode) return;
    var block = document.createElement('div');
    block.id = 'pmg-what-next-block';
    block.className = 'pmg-what-next-block pmg-post-gen';
    var title = document.createElement('h3');
    title.className = 'pmg-what-next-title';
    title.textContent = 'What Would You Like To Do?';
    var rows = document.createElement('div');
    rows.className = 'pmg-what-next-rows';

    function makeRow(icon, lbl, desc, handler) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'pmg-what-next-row';
      var ic = document.createElement('span');
      ic.className = 'pmg-what-next-icon';
      ic.setAttribute('aria-hidden', 'true');
      ic.textContent = icon;
      var txt = document.createElement('span');
      txt.className = 'pmg-what-next-text';
      var l = document.createElement('span');
      l.className = 'pmg-what-next-label';
      l.textContent = lbl;
      var d = document.createElement('span');
      d.className = 'pmg-what-next-desc';
      d.textContent = desc;
      txt.appendChild(l); txt.appendChild(d);
      row.appendChild(ic); row.appendChild(txt);
      row.addEventListener('click', handler);
      return row;
    }

    rows.appendChild(makeRow('▶', 'Run With AI', 'See your AI response right here — no copy-paste needed', function () {
      var rb = document.getElementById('runBtn');
      if (rb) rb.click();
    }));
    rows.appendChild(makeRow('📋', 'Copy Prompt', 'Take it to ChatGPT, Claude, or any AI tool you use', function () {
      var cb = document.getElementById('copy-btn');
      if (cb) cb.click();
    }));
    rows.appendChild(makeRow('✏️', 'Refine It', 'Make it stronger before you run it', function () {
      var ib = document.getElementById('improve-block');
      if (ib) ib.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    block.appendChild(title);
    block.appendChild(rows);
    resultBox.parentNode.insertBefore(block, resultBox.nextSibling);
  }

  function reorderResultPanel() {
    var resultBox = document.getElementById('resultBox');
    var whatNext = document.getElementById('pmg-what-next-block');
    var runSection = document.getElementById('runSection');
    var improve = document.getElementById('improve-block');
    var qualityRow = document.getElementById('quality-row');
    var actionsRows = document.querySelectorAll('#tour-final-actions > .actions-row');
    var copyWrap = document.getElementById('pmg-copy-wrap');
    if (!resultBox || !improve || !improve.parentNode) return;
    var parent = improve.parentNode;
    try {
      if (whatNext && resultBox.nextSibling !== whatNext) parent.insertBefore(whatNext, resultBox.nextSibling);
      if (runSection && whatNext) parent.insertBefore(runSection, whatNext.nextSibling);
      if (improve && runSection) parent.insertBefore(improve, runSection.nextSibling);
      if (qualityRow && improve) parent.insertBefore(qualityRow, improve.nextSibling);
      if (copyWrap && qualityRow) parent.insertBefore(copyWrap, qualityRow.nextSibling);
    } catch (e) {}
  }

  function reorderImageMode() {
    var goal = document.getElementById('goal');
    var imageBtn = document.getElementById('image-generate-btn');
    var uploadField = document.getElementById('upload-field');
    if (!goal || !imageBtn) return;
    var goalField = goal.closest('.field');
    if (!goalField || !goalField.parentNode) return;
    var parent = goalField.parentNode;
    try {
      if (imageBtn.parentNode !== parent) {
        parent.insertBefore(imageBtn, goalField.nextSibling);
      } else if (imageBtn.previousSibling !== goalField) {
        parent.insertBefore(imageBtn, goalField.nextSibling);
      }
      imageBtn.style.cssText = 'margin-top: 12px; width: 100%; min-height: 48px;';
    } catch (e) {}
  }

  function moveUploadBelowHelpMeStart() {
    var uploadField = document.getElementById('upload-field');
    var helpBtn = document.getElementById('pmg-help-me-start-btn');
    if (!uploadField || !helpBtn) return;
    if (uploadField.dataset.pmgMoved === '1') return;
    var anchor = helpBtn.parentNode === uploadField.parentNode ? helpBtn : uploadField.parentNode.querySelector('#tour-step-generate');
    if (!anchor || anchor.parentNode !== uploadField.parentNode) return;
    try {
      anchor.parentNode.insertBefore(uploadField, anchor.nextSibling);
      uploadField.dataset.pmgMoved = '1';
    } catch (e) {}
  }

  function setupNavSearchToggle() {
    var search = document.querySelector('.global-search');
    if (!search) return;
    if (document.getElementById('pmg-nav-search-toggle')) return;
    var input = search.querySelector('input');
    var topActions = document.querySelector('.top-actions');
    var navToggle = document.querySelector('.nav-toggle');
    var btn = document.createElement('button');
    btn.id = 'pmg-nav-search-toggle';
    btn.type = 'button';
    btn.className = 'pmg-nav-search-toggle';
    btn.setAttribute('aria-label', 'Search');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '🔍';
    btn.addEventListener('click', function () {
      var expanded = search.classList.toggle('pmg-expanded');
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (expanded && input) setTimeout(function () { input.focus(); }, 50);
    });
    if (navToggle && navToggle.parentNode) {
      navToggle.parentNode.insertBefore(btn, navToggle);
    } else if (topActions && topActions.parentNode) {
      topActions.parentNode.insertBefore(btn, topActions);
    } else if (search.parentNode) {
      search.parentNode.insertBefore(btn, search);
    }
    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.getAttribute && t.getAttribute('contenteditable') === 'true'));
      if (ev.key === '/' && !inField) {
        ev.preventDefault();
        if (!search.classList.contains('pmg-expanded')) btn.click();
        else if (input) input.focus();
      } else if (ev.key === 'Escape' && search.classList.contains('pmg-expanded')) {
        btn.click();
      }
    });
  }

  function setupQuickStartGate() {
    var card = document.getElementById('quick-start-card');
    var examplesBlock = document.querySelector('.examples-block');
    var targets = [];
    if (card) targets.push(card);
    if (examplesBlock) targets.push(examplesBlock);
    if (!targets.length) return;
    function update() {
      var gen = readHasGenerated();
      targets.forEach(function (el) {
        if (!gen) el.style.display = 'none';
        else el.style.removeProperty('display');
      });
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupResultStickyDesktop() {
    var resultPanel = document.getElementById('result-panel');
    if (resultPanel) {
      resultPanel.classList.add('pmg-result-sticky');
    }
  }

  function setupImageGenerateMode() {
    function update() {
      var isImg = document.body.classList.contains('image-mode');
      document.body.classList.toggle('pmg-image-reordered', isImg);
    }
    update();
    var obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function setupAboveFoldReveal() {
    if (window.matchMedia && !window.matchMedia('(min-width: 920px)').matches) {
      revealAllBelowFold();
      return;
    }
    var sections = document.querySelectorAll('.desktop-below-fold');
    if (!sections.length) return;
    var builder = document.getElementById('builder');
    var revealed = false;
    var hasBeenIntersecting = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      Array.prototype.forEach.call(sections, function (s) { s.classList.add('revealed'); });
    }
    if (!builder || !('IntersectionObserver' in window)) {
      reveal();
      return;
    }
    var vh = function () { return window.innerHeight || document.documentElement.clientHeight || 800; };
    function checkInitialPosition() {
      var b = builder.getBoundingClientRect();
      if (b.bottom < 0 || b.top > vh() * 2) {
        reveal();
        return true;
      }
      if (b.top < vh() && b.bottom > 0) {
        hasBeenIntersecting = true;
      }
      return false;
    }
    if (checkInitialPosition()) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var rect = entry.boundingClientRect;
        if (entry.isIntersecting) {
          hasBeenIntersecting = true;
        } else if (hasBeenIntersecting && rect.bottom < vh() * 0.5) {
          reveal();
          io.disconnect();
        }
      });
    }, { threshold: [0, 0.25, 0.5, 1] });
    io.observe(builder);
    var lastY = window.scrollY;
    var lastScrollTime = Date.now();
    var scrollHandler = function () {
      var y = window.scrollY;
      var now = Date.now();
      if (!hasBeenIntersecting) {
        var b = builder.getBoundingClientRect();
        if (b.top < vh() && b.bottom > 0) hasBeenIntersecting = true;
      }
      if (now - lastScrollTime > 50 && hasBeenIntersecting && y > lastY + 30) {
        var br = builder.getBoundingClientRect();
        if (br.bottom < vh() * 0.5) {
          reveal();
          window.removeEventListener('scroll', scrollHandler, { passive: true });
          try { io.disconnect(); } catch (e) {}
        }
      }
      lastY = y;
      lastScrollTime = now;
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('pageshow', function (e) {
      if (revealed) return;
      if (e && e.persisted) {
        setTimeout(function () { checkInitialPosition(); }, 50);
      }
    });
    var firstFocusableInBuilder = builder.querySelector('input, textarea, select, button, [href], [tabindex]');
    function onFocusBridge(ev) {
      if (revealed) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('#builder') || (firstFocusableInBuilder && t === firstFocusableInBuilder)) {
        reveal();
      }
    }
    document.addEventListener('focusin', onFocusBridge);
  }

  function revealAllBelowFold() {
    var sections = document.querySelectorAll('.desktop-below-fold');
    Array.prototype.forEach.call(sections, function (s) { s.classList.add('revealed'); });
  }

  function setupAnchorRevealOverride() {
    var hiddenIds = ['use-cases', 'why-prompts-fail', 'how-it-works', 'early-feedback', 'see-the-difference'];
    function maybeRevealForHash(hash) {
      if (!hash) return;
      var id = hash.replace(/^#/, '');
      if (hiddenIds.indexOf(id) === -1) return;
      revealAllBelowFold();
      var el = document.getElementById(id);
      if (el) {
        requestAnimationFrame(function () {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
        });
      }
    }
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.length < 2) return;
      var id = href.slice(1);
      if (hiddenIds.indexOf(id) === -1) return;
      revealAllBelowFold();
    }, true);
    window.addEventListener('hashchange', function () { maybeRevealForHash(location.hash); });
    if (location.hash) {
      setTimeout(function () { maybeRevealForHash(location.hash); }, 50);
    }
  }

  function setupReplayTourScrollGuard() {
    var btns = [
      document.getElementById('replay-tour-btn'),
      document.getElementById('replay-tour-btn-builder')
    ].filter(Boolean);
    btns.forEach(function (btn) {
      if (btn.dataset.pmgScrollGuard === '1') return;
      btn.dataset.pmgScrollGuard = '1';
      btn.addEventListener('click', function () {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      }, { capture: true });
    });
  }

  function init() {
    injectStyles();
    setupGoalLabelMode();
    setupStrengthIndicator();
    setupPhotoAssistant();
    setupHelpMeStartButton();
    moveUploadBelowHelpMeStart();
    setupWhatNextBlock();
    reorderResultPanel();
    setTimeout(reorderResultPanel, 200);
    reorderImageMode();
    setupNavSearchToggle();
    setupQuickStartGate();
    setupResultStickyDesktop();
    setupImageGenerateMode();
    setupReplayTourScrollGuard();
    setupAboveFoldReveal();
    setupAnchorRevealOverride();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
