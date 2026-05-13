/* ====================================================================
   pmg-dna-card.js (dna-v2-1)
   --------------------------------------------------------------------
   v2 of the 1080×1350 Prompt DNA Card. Adds:
     - Quality score badge (0–100, grade label, progress bar)
     - 3–5 detected-technique chips
     - "Built with PromptMeGood · promptmegood.com" watermark footer

   Pure client-side. Uses an offscreen <canvas>, no network calls,
   no new deps. The score + technique detection are heuristic so
   sharing the card stays instant + free. Helpers are split out
   (scorePrompt, detectTechniques) so a future backend route can
   replace them without touching the layout code.

   API exposed on window.pmgDnaCardV2:
     - composeDnaCardV2(imgSrc, promptText) → Promise<dataUrl|null>
     - scorePrompt(text) → { score, grade, label, color }
     - detectTechniques(text) → string[]   (top 5)

   Consumed by pmg-visual-studio.js which delegates composeDnaCard /
   composeFallbackDnaCard to this module when present.

   Kill switches (consistent with replit.md per-script convention):
     - URL:   ?nodnacard
     - Local: localStorage.pmg_dna_card_disable = '1'
   When disabled the global is not installed, so visual-studio falls
   back to its built-in v1 composer.
   ================================================================== */
(function () {
  'use strict';

  try {
    var qs = new URLSearchParams(location.search);
    if (qs.has('nodnacard')) return;
    if (localStorage.getItem('pmg_dna_card_disable') === '1') return;
  } catch (_) {}

  /* ---------------- score heuristic ----------------
     Aims to feel calibrated against the kind of prompts the
     workstation actually emits — short / vague gets penalized,
     specific photography vocabulary + comma-separated descriptor
     stacks get rewarded, vague words get docked. Capped 0–100. */
  var SPECIFICITY_TOKENS = [
    'camera', 'lens', 'mm', 'aperture', 'shutter', 'iso',
    'lighting', 'light', 'shadow', 'highlight', 'rim', 'backlit',
    'golden hour', 'blue hour', 'magic hour', 'cinematic',
    'composition', 'framing', 'depth', 'focus', 'bokeh',
    'color', 'palette', 'mood', 'atmosphere', 'texture',
    'contrast', 'shot', 'angle', 'perspective', 'grain'
  ];
  var STYLE_MARKERS = [
    'cinematic', 'documentary', 'minimalist', 'editorial',
    'fashion', 'portrait', 'landscape', 'street', 'architectural',
    'product', 'macro', 'noir', 'vintage'
  ];
  var VAGUE_WORDS = ['thing', 'stuff', 'nice', 'good', 'cool', 'pretty', 'awesome'];
  var ANCHORS = [' of ', ' with ', ' wearing ', ' holding ', ' in ', ' at '];

  function scorePrompt(text) {
    var t = (text || '').toLowerCase();
    var len = t.trim().length;
    if (!len) return { score: 0, grade: 'F', label: 'Empty', color: '#7a8a86' };

    var s = 0;

    /* Length sweet spot: 60–400 chars peaks; ramp in below 60,
       gentle drop-off above 400 (long isn't bad, just diminishing). */
    if (len <= 60) s += Math.round((len / 60) * 30);
    else if (len <= 400) s += 30;
    else s += Math.max(0, 30 - Math.floor((len - 400) / 20));

    /* Specificity vocabulary — +3 per unique hit, cap +30. */
    var specHits = 0;
    for (var i = 0; i < SPECIFICITY_TOKENS.length; i++) {
      if (t.indexOf(SPECIFICITY_TOKENS[i]) !== -1) specHits++;
    }
    s += Math.min(30, specHits * 3);

    /* Subject-anchoring prepositions — +2 per, cap +10. */
    var anchorHits = 0;
    for (var j = 0; j < ANCHORS.length; j++) {
      if (t.indexOf(ANCHORS[j]) !== -1) anchorHits++;
    }
    s += Math.min(10, anchorHits * 2);

    /* Numeric specifics (focal length, f-stop, time, etc.). */
    if (/\d/.test(t)) s += 5;

    /* Comma-separated descriptor stacks signal effort. */
    var commas = (t.match(/,/g) || []).length;
    if (commas >= 3) s += 10;
    else if (commas >= 1) s += 4;

    /* Any style marker present → +10 (one-time bonus). */
    for (var k = 0; k < STYLE_MARKERS.length; k++) {
      if (t.indexOf(STYLE_MARKERS[k]) !== -1) { s += 10; break; }
    }

    /* Vague-word penalty: −5 per occurrence. */
    for (var v = 0; v < VAGUE_WORDS.length; v++) {
      var re = new RegExp('\\b' + VAGUE_WORDS[v] + '\\b', 'g');
      var hits = (t.match(re) || []).length;
      s -= hits * 5;
    }

    s = Math.max(0, Math.min(100, Math.round(s)));

    /* Grade band → human label + accent color. Greens stay on-brand
       (theme accent #3ee0a0); warm/red used only for low scores so
       the card almost always looks celebratory in practice. */
    var grade, label, color;
    if (s >= 90)      { grade = 'A'; label = 'Excellent'; color = '#3ee0a0'; }
    else if (s >= 75) { grade = 'B'; label = 'Strong';    color = '#3ee0a0'; }
    else if (s >= 60) { grade = 'C'; label = 'Solid';     color = '#9ad6c0'; }
    else if (s >= 40) { grade = 'D'; label = 'Developing';color = '#e0c46a'; }
    else              { grade = 'F'; label = 'Needs work';color = '#e08a6a'; }

    return { score: s, grade: grade, label: label, color: color };
  }

  /* ---------------- technique detection ----------------
     Insertion-ordered keyword buckets; first hit wins per bucket,
     return the top 5 matched bucket labels. Order matters for
     visual hierarchy: stronger / rarer techniques first. */
  var TECHNIQUE_BUCKETS = [
    ['Cinematic framing',     /cinematic|widescreen|anamorphic|2\.35|2\.39/i],
    ['Golden hour',           /golden hour|sunset|sunrise|magic hour|blue hour/i],
    ['Shallow depth of field',/shallow|bokeh|f\/1|f\/2|depth of field|\bdof\b/i],
    ['Hard light',            /hard light|harsh light|noon sun|direct sun/i],
    ['Soft light',            /soft light|diffused|window light|overcast/i],
    ['Studio lighting',       /studio|softbox|key light|rim light|three.point/i],
    ['Film grain',            /film grain|kodak|portra|fuji(?:film)?|ilford|35mm film|medium format/i],
    ['Color grade',           /color grad(?:e|ing)|warm tone|cool tone|teal.{0,8}orange|desaturat/i],
    ['Macro detail',          /\bmacro\b|close.?up|extreme detail/i],
    ['Wide angle',            /wide angle|14mm|24mm|fisheye/i],
    ['Telephoto',             /telephoto|85mm|105mm|135mm|200mm/i],
    ['Documentary style',     /documentary|photojournal|candid|reportage/i],
    ['Long exposure',         /long exposure|motion blur|light trail/i],
    ['High contrast',         /high contrast|chiaroscuro|noir|silhouette/i],
    ['Symmetry',              /symmetr|centered composition|axial/i],
    ['Negative space',        /negative space|minimal(?:ist)?\b|empty space/i],
    ['Rule of thirds',        /rule of thirds|off.?cent/i]
  ];

  function detectTechniques(text) {
    var t = (text || '').toString();
    var hits = [];
    for (var i = 0; i < TECHNIQUE_BUCKETS.length && hits.length < 5; i++) {
      if (TECHNIQUE_BUCKETS[i][1].test(t)) hits.push(TECHNIQUE_BUCKETS[i][0]);
    }
    return hits;
  }

  /* ---------------- canvas helpers ---------------- */

  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    var words = (text || '').split(/\s+/);
    var line = '';
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines) {
      /* Truncate last line with ellipsis if more text remained. */
      var consumedWords = lines.join(' ').split(/\s+/).length;
      if (consumedWords < words.length) {
        var last = lines[maxLines - 1];
        while (last.length && ctx.measureText(last + '…').width > maxW) {
          last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '…';
      }
    }
    for (var li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], x, y + li * lineH);
    }
    return lines.length * lineH;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* ---------------- panel renderers ---------------- */

  /* Score band (110px). Score badge on the left, label + bar on right. */
  function renderScoreBand(ctx, x, y, w, h, scoreObj) {
    var pad = 32;
    var badgeSize = h - 24;
    var badgeX = x + pad;
    var badgeY = y + 12;

    /* Badge: rounded rect with the score number + "/100". */
    roundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 18);
    ctx.fillStyle = 'rgba(62,224,160,0.10)';
    ctx.fill();
    ctx.strokeStyle = scoreObj.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = scoreObj.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(String(scoreObj.score), badgeX + badgeSize / 2, badgeY + badgeSize / 2 - 6);
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,245,240,0.6)';
    ctx.fillText('/ 100', badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 24);

    /* Right side: title + bar + label. */
    var rightX = badgeX + badgeSize + 24;
    var rightW = (x + w) - rightX - pad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(232,245,240,0.55)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('PROMPT QUALITY', rightX, y + 30);

    /* Progress bar. */
    var barY = y + 48;
    var barH = 12;
    roundedRect(ctx, rightX, barY, rightW, barH, 6);
    ctx.fillStyle = 'rgba(62,224,160,0.15)';
    ctx.fill();
    var fillW = Math.max(barH, (rightW * scoreObj.score) / 100);
    roundedRect(ctx, rightX, barY, fillW, barH, 6);
    ctx.fillStyle = scoreObj.color;
    ctx.fill();

    /* Label + grade. */
    ctx.fillStyle = '#e8f5f0';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(scoreObj.label, rightX, y + 92);
    ctx.fillStyle = scoreObj.color;
    ctx.font = 'bold 22px system-ui, sans-serif';
    var labelW = ctx.measureText(scoreObj.label).width;
    ctx.fillText('· ' + scoreObj.grade, rightX + labelW + 10, y + 92);
  }

  /* Technique chip row (80px). Renders up to 5; collapses to "+N more"
     if the row would overflow the available width. */
  function renderTechniques(ctx, x, y, w, h, techs) {
    var pad = 32;
    var titleY = y + 24;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(232,245,240,0.55)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('TECHNIQUES DETECTED', x + pad, titleY);

    var chipY = y + 38;
    var chipH = 32;
    var gap = 10;
    var cursorX = x + pad;
    var maxX = x + w - pad;

    if (!techs.length) {
      ctx.fillStyle = 'rgba(232,245,240,0.45)';
      ctx.font = 'italic 16px system-ui, sans-serif';
      ctx.fillText('—', cursorX, chipY + 22);
      return;
    }

    ctx.font = '500 14px system-ui, sans-serif';
    for (var i = 0; i < techs.length; i++) {
      var label = techs[i];
      var textW = ctx.measureText(label).width;
      var chipW = textW + 24;
      var remaining = techs.length - i;
      var moreLabel = '+' + remaining + ' more';
      var moreW = ctx.measureText(moreLabel).width + 24;

      /* If this chip plus a "+N more" tail won't fit, render the tail. */
      var needsTail = (cursorX + chipW + (i < techs.length - 1 ? gap + moreW : 0)) > maxX;
      if (needsTail && i > 0) {
        roundedRect(ctx, cursorX, chipY, moreW, chipH, chipH / 2);
        ctx.fillStyle = 'rgba(62,224,160,0.10)';
        ctx.fill();
        ctx.fillStyle = '#9ad6c0';
        ctx.fillText(moreLabel, cursorX + 12, chipY + 21);
        return;
      }
      if (cursorX + chipW > maxX) return;

      roundedRect(ctx, cursorX, chipY, chipW, chipH, chipH / 2);
      ctx.fillStyle = 'rgba(62,224,160,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(62,224,160,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#3ee0a0';
      ctx.fillText(label, cursorX + 12, chipY + 21);

      cursorX += chipW + gap;
    }
  }

  function renderPromptBlock(ctx, x, y, w, h, promptText) {
    var pad = 32;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(232,245,240,0.55)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('THE PROMPT', x + pad, y + 24);

    ctx.fillStyle = '#e8f5f0';
    ctx.font = '18px ui-monospace, "SF Mono", Menlo, monospace';
    var bodyText = (promptText || '').trim() || '(no prompt)';
    wrap(ctx, bodyText, x + pad, y + 56, w - pad * 2, 26, 6);
  }

  function renderWatermark(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,36,32,0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(62,224,160,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + w, y + 0.5);
    ctx.stroke();

    var single = '🧬 Built with PromptMeGood · promptmegood.com';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ad6c0';
    ctx.font = '600 16px system-ui, sans-serif';
    var singleW = ctx.measureText(single).width;
    if (singleW <= w - 32) {
      ctx.fillText(single, x + w / 2, y + h / 2);
    } else {
      /* Two-line fallback. */
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText('🧬 Built with PromptMeGood', x + w / 2, y + h / 2 - 9);
      ctx.fillStyle = 'rgba(154,214,192,0.7)';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText('promptmegood.com', x + w / 2, y + h / 2 + 11);
    }
  }

  /* ---------------- compositor ---------------- */

  /* Layout (1080×1350):
       0–900     IMAGE         (900px)
       900–1010  SCORE BAND    (110px)
       1010–1090 TECHNIQUES    (80px)
       1090–1310 PROMPT        (220px)
       1310–1350 WATERMARK     (40px) */
  var W = 1080, H = 1350;
  var IMG_H = 900, SCORE_H = 110, TECH_H = 80, PROMPT_H = 220, FOOT_H = 40;

  function paintBackground(ctx) {
    ctx.fillStyle = '#0a2420';
    ctx.fillRect(0, 0, W, H);
  }

  function paintImage(ctx, im) {
    var iw = im.naturalWidth, ih = im.naturalHeight;
    if (!iw || !ih) throw new Error('no-image');
    var scale = Math.max(W / iw, IMG_H / ih);
    var dw = iw * scale, dh = ih * scale;
    var dx = (W - dw) / 2, dy = (IMG_H - dh) / 2;
    ctx.drawImage(im, dx, dy, dw, dh);
  }

  function paintImageFallback(ctx) {
    var grad = ctx.createLinearGradient(0, 0, 0, IMG_H);
    grad.addColorStop(0, '#11342f');
    grad.addColorStop(1, '#0a2420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, IMG_H);
    ctx.fillStyle = '#3ee0a0';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧬 PromptMeGood', W / 2, IMG_H / 2 - 30);
    ctx.fillStyle = 'rgba(232,245,240,0.65)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('(Image preview unavailable for export)', W / 2, IMG_H / 2 + 24);
  }

  function paintFooterPanels(ctx, promptText) {
    var scoreObj = scorePrompt(promptText);
    var techs = detectTechniques(promptText);

    /* Subtle divider above the score band. */
    ctx.strokeStyle = 'rgba(62,224,160,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, IMG_H + 0.5);
    ctx.lineTo(W, IMG_H + 0.5);
    ctx.stroke();

    renderScoreBand(ctx, 0, IMG_H, W, SCORE_H, scoreObj);
    renderTechniques(ctx, 0, IMG_H + SCORE_H, W, TECH_H, techs);
    renderPromptBlock(ctx, 0, IMG_H + SCORE_H + TECH_H, W, PROMPT_H, promptText);
    renderWatermark(ctx, 0, IMG_H + SCORE_H + TECH_H + PROMPT_H, W, FOOT_H);
  }

  function composeDnaCardV2(imgSrc, promptText) {
    return new Promise(function (resolve) {
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      function finish() {
        try { resolve(canvas.toDataURL('image/png')); }
        catch (_) { resolve(null); }
      }

      function fallback() {
        paintBackground(ctx);
        paintImageFallback(ctx);
        paintFooterPanels(ctx, promptText);
        finish();
      }

      if (!imgSrc) { fallback(); return; }

      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        paintBackground(ctx);
        try { paintImage(ctx, im); }
        catch (_) { paintImageFallback(ctx); }
        try {
          paintFooterPanels(ctx, promptText);
          finish();
        } catch (_) { fallback(); }
      };
      im.onerror = fallback;
      im.src = imgSrc;
    });
  }

  window.pmgDnaCardV2 = {
    composeDnaCardV2: composeDnaCardV2,
    scorePrompt: scorePrompt,
    detectTechniques: detectTechniques
  };

  try { console.log('[pmg-dna-card] v2 ready (dna-v2-1)'); } catch (_) {}
})();
