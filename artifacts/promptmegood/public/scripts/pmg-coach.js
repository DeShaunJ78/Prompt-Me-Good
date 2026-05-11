/* =============================================================
 * pmg-coach.js  (coach-1)
 *
 * Photo + Video Coach meter — additive companion to pmg-text-
 * feedback.js. Mounts a small calm card under the goal textarea
 * of each visual panel showing:
 *
 *   1. Quality meter   (Too vague / Getting there / Specific
 *                       enough — based on length + checklist
 *                       coverage)
 *   2. Clarity tooltip (hover/tap the ⓘ to reveal a 4-item
 *                       checklist with ✓ / ○ marks driven by
 *                       keyword detection in the goal text)
 *
 * Photo checklist: Subject · Lighting · Lens / Camera · Background
 * Video checklist: Subject · Action · Camera Direction · Visual Style
 *
 * Strict additive: never reads or writes anything from the
 * backend. Mounts via 30s MutationObserver since visual-studio
 * builds the panels asynchronously.
 *
 * Disable: ?nocoach OR localStorage.pmg_coach_disable = "1".
 *
 * Public API: window.pmgCoach.{ refresh, getState, dismiss }.
 * ============================================================= */
(function () {
  'use strict';

  if (window.__pmgCoachInit) return;
  window.__pmgCoachInit = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('nocoach') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_coach_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-coach-styles';

  var PANELS = {
    image: {
      goalId: 'pmg-vs-image-goal',
      previewId: 'pmg-vs-image-live-preview',
      rootId: 'pmg-coach-image',
      checklist: [
        { key: 'subject',   label: 'Subject — what is being shown',          test: function (t) { return t.replace(/\s+/g, ' ').trim().length >= 12; } },
        { key: 'lighting',  label: 'Lighting — sun, golden hour, studio…',   test: function (t) { return /\b(light(ing)?|sun|sunset|sunrise|golden hour|blue hour|backlit|silhouette|harsh|soft|moody|neon|candle|studio|overcast|shadows?|bright|dim|dusk|dawn)\b/i.test(t); } },
        { key: 'lens',      label: 'Lens or camera — focal length, body',    test: function (t) { return /\b(\d{1,3}\s?mm|wide|macro|telephoto|portrait lens|leica|canon|nikon|sony|fuji|hasselblad|iphone|drone|aerial|fish.?eye|gopro|polaroid|kodak|portra|film stock|raw|hdr)\b/i.test(t); } },
        { key: 'background',label: 'Background — setting, place, backdrop',  test: function (t) { return /\b(background|backdrop|behind|setting|scene|environment|landscape|cityscape|interior|exterior|on (a|an|the) \w+|in (a|an|the) \w+|forest|street|studio|beach|desert|mountain|room|kitchen|office|alley|rooftop|sky)\b/i.test(t); } }
      ]
    },
    video: {
      goalId: 'pmg-vs-video-goal',
      previewId: 'pmg-vs-video-live-preview',
      rootId: 'pmg-coach-video',
      checklist: [
        { key: 'subject', label: 'Subject — who or what is on screen',          test: function (t) { return t.replace(/\s+/g, ' ').trim().length >= 12; } },
        { key: 'action',  label: 'Action — what is happening / motion',         test: function (t) { return /\b(walk(s|ing)?|run(s|ning)?|driv(es?|ing)|mov(es?|ing)|danc(es?|ing)|talk(s|ing)?|sit(s|ting)?|stand(s|ing)?|reach(es|ing)?|jump(s|ing)?|spin(s|ning)?|fly(ing)?|fall(s|ing)?|fight(s|ing)?|swim(s|ming)?|climb(s|ing)?|leans?|turns?|enters?|exits?|opens?|closes?)\b/i.test(t); } },
        { key: 'camera',  label: 'Camera direction — shot, movement, angle',   test: function (t) { return /\b(tracking|pan(ning)?|zoom(s|ing)?|dolly|crane|handheld|push.?in|pull.?out|wide shot|close.?up|cu|extreme close|medium shot|aerial|drone|pov|over[- ]?the[- ]?shoulder|low angle|high angle|bird['’]s eye|whip pan|steady ?cam|gimbal)\b/i.test(t); } },
        { key: 'style',   label: 'Visual style — look, mood, era',             test: function (t) { return /\b(cinematic|realistic|animated|documentary|dreamy|vhs|16mm|35mm|noir|retro|neon|moody|hyperreal|surreal|stylized|anim(é|e)|claymation|stop motion|3d render|pixar|wes anderson)\b/i.test(t); } }
      ]
    }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#pmg-coach-image, #pmg-coach-video { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;' +
      '  margin: 6px 0 4px; padding: 6px 10px; border: 1px solid var(--color-border, color-mix(in srgb, var(--color-text, #ece9e2) 14%, transparent));' +
      '  border-radius: 8px; background: color-mix(in srgb, var(--color-primary, #3ee0a0) 4%, transparent);' +
      '  font-size: 12px; line-height: 1.4; position: relative; }' +

      '.pmg-coach-meter { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px;' +
      '  background: color-mix(in srgb, var(--color-text, #ece9e2) 8%, transparent); color: var(--color-text, #ece9e2);' +
      '  font-weight: 600; }' +
      '.pmg-coach-meter-dot { width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, var(--color-text, #ece9e2) 30%, transparent); }' +
      '.pmg-coach-meter[data-tone="warn"] .pmg-coach-meter-dot { background: #d68f3a; }' +
      '.pmg-coach-meter[data-tone="mid"]  .pmg-coach-meter-dot { background: #d8c14b; }' +
      '.pmg-coach-meter[data-tone="good"] .pmg-coach-meter-dot { background: var(--color-primary, #3ee0a0); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #3ee0a0) 25%, transparent); }' +

      '.pmg-coach-clarity-btn { background: transparent; border: 1px solid color-mix(in srgb, var(--color-text, #ece9e2) 22%, transparent);' +
      '  color: var(--color-text, #ece9e2); border-radius: 999px; width: 22px; height: 22px; padding: 0; cursor: pointer;' +
      '  display: inline-flex; align-items: center; justify-content: center; font-size: 12px; line-height: 1; opacity: .8; }' +
      '.pmg-coach-clarity-btn:hover, .pmg-coach-clarity-btn:focus-visible { opacity: 1; border-color: var(--color-primary, #3ee0a0); color: var(--color-primary, #3ee0a0); outline: none; }' +
      '.pmg-coach-clarity-btn[aria-expanded="true"] { background: color-mix(in srgb, var(--color-primary, #3ee0a0) 12%, transparent); border-color: var(--color-primary, #3ee0a0); color: var(--color-primary, #3ee0a0); opacity: 1; }' +

      '.pmg-coach-clarity-label { color: color-mix(in srgb, var(--color-text, #ece9e2) 70%, transparent); }' +

      '.pmg-coach-clarity-pop { position: absolute; top: calc(100% + 6px); left: 8px; right: 8px; max-width: 360px; z-index: 50;' +
      '  background: var(--color-surface, #1c1b18); border: 1px solid var(--color-border, color-mix(in srgb, var(--color-text, #ece9e2) 18%, transparent));' +
      '  border-radius: 10px; padding: 10px 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.35); }' +
      '.pmg-coach-clarity-pop[hidden] { display: none; }' +
      '.pmg-coach-clarity-title { font-weight: 700; font-size: 12px; margin: 0 0 6px; color: var(--color-text, #ece9e2); }' +
      '.pmg-coach-clarity-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }' +
      '.pmg-coach-clarity-list li { display: grid; grid-template-columns: 18px 1fr; gap: 8px; align-items: start;' +
      '  font-size: 12px; line-height: 1.4; color: color-mix(in srgb, var(--color-text, #ece9e2) 80%, transparent); }' +
      '.pmg-coach-clarity-mark { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;' +
      '  border-radius: 50%; font-size: 11px; line-height: 1;' +
      '  background: color-mix(in srgb, var(--color-text, #ece9e2) 8%, transparent); color: color-mix(in srgb, var(--color-text, #ece9e2) 50%, transparent); }' +
      '.pmg-coach-clarity-list li[data-met="1"] .pmg-coach-clarity-mark {' +
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 22%, transparent);' +
      '  color: var(--color-primary, #3ee0a0); }' +
      '.pmg-coach-clarity-list li[data-met="1"] .pmg-coach-clarity-label-text { color: var(--color-text, #ece9e2); }' +

      '@media (max-width: 480px) {' +
      '  #pmg-coach-image, #pmg-coach-video { font-size: 11px; padding: 5px 8px; }' +
      '  .pmg-coach-clarity-pop { left: 4px; right: 4px; }' +
      '}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function scoreQuality(text, metCount, totalChecklist) {
    var len = (text || '').trim().length;
    if (len === 0) return { tier: 'empty', label: 'Describe your shot', tone: 'idle' };
    if (len < 25 || metCount <= 1) return { tier: 'low', label: 'Too vague', tone: 'warn' };
    if (len < 80 || metCount < totalChecklist) return { tier: 'mid', label: 'Getting there', tone: 'mid' };
    return { tier: 'high', label: 'Specific enough', tone: 'good' };
  }

  function buildCoach(panel, cfg) {
    var el = document.createElement('div');
    el.id = cfg.rootId;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', (panel === 'image' ? 'Image' : 'Video') + ' prompt clarity');
    el.innerHTML = [
      '<div class="pmg-coach-meter" data-tone="idle" aria-live="polite">',
        '<span class="pmg-coach-meter-dot" aria-hidden="true"></span>',
        '<span class="pmg-coach-meter-label">Describe your shot</span>',
      '</div>',
      '<button type="button" class="pmg-coach-clarity-btn" aria-expanded="false" aria-controls="' + cfg.rootId + '-pop" aria-label="Show clarity checklist">ⓘ</button>',
      '<span class="pmg-coach-clarity-label">Clarity checklist</span>',
      '<div id="' + cfg.rootId + '-pop" class="pmg-coach-clarity-pop" hidden role="tooltip">',
        '<div class="pmg-coach-clarity-title">' + (panel === 'image' ? 'Photo clarity checklist' : 'Video clarity checklist') + '</div>',
        '<ul class="pmg-coach-clarity-list">',
        cfg.checklist.map(function (item) {
          return '<li data-key="' + item.key + '" data-met="0">' +
                   '<span class="pmg-coach-clarity-mark" aria-hidden="true">○</span>' +
                   '<span class="pmg-coach-clarity-label-text">' + item.label + '</span>' +
                 '</li>';
        }).join(''),
        '</ul>',
      '</div>'
    ].join('');
    return el;
  }

  function ensureMounted(panel) {
    var cfg = PANELS[panel];
    var existing = document.getElementById(cfg.rootId);
    if (existing) return existing;
    var preview = document.getElementById(cfg.previewId);
    var goal = document.getElementById(cfg.goalId);
    var anchor = preview || goal;
    if (!anchor || !anchor.parentNode) return null;
    var coach = buildCoach(panel, cfg);
    /* Insert after the live preview (or after the goal textarea if preview not yet built). */
    anchor.parentNode.insertBefore(coach, anchor.nextSibling);
    wireCoach(coach, panel);
    return coach;
  }

  function wireCoach(root, panel) {
    if (!root || root.__pmgCoachWired) return;
    root.__pmgCoachWired = true;
    var btn = root.querySelector('.pmg-coach-clarity-btn');
    var pop = root.querySelector('.pmg-coach-clarity-pop');
    if (!btn || !pop) return;
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      pop.hidden = open;
    });
    document.addEventListener('click', function (ev) {
      if (btn.getAttribute('aria-expanded') !== 'true') return;
      if (root.contains(ev.target)) return;
      btn.setAttribute('aria-expanded', 'false');
      pop.hidden = true;
    });
    /* Close on Esc when popover is open. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        btn.setAttribute('aria-expanded', 'false');
        pop.hidden = true;
      }
    });
  }

  function renderPanel(panel) {
    var cfg = PANELS[panel];
    var root = ensureMounted(panel);
    if (!root) return;
    var goal = document.getElementById(cfg.goalId);
    var text = goal ? (goal.value || '') : '';
    var metCount = 0;
    cfg.checklist.forEach(function (item) {
      var met = false;
      try { met = !!item.test(text); } catch (_) {}
      if (met) metCount++;
      var li = root.querySelector('li[data-key="' + item.key + '"]');
      if (li) {
        li.setAttribute('data-met', met ? '1' : '0');
        var mark = li.querySelector('.pmg-coach-clarity-mark');
        if (mark) mark.textContent = met ? '✓' : '○';
      }
    });
    var meter = root.querySelector('.pmg-coach-meter');
    var label = root.querySelector('.pmg-coach-meter-label');
    if (meter && label) {
      var q = scoreQuality(text, metCount, cfg.checklist.length);
      meter.setAttribute('data-tone', q.tone);
      label.textContent = q.label;
    }
  }

  function renderAll() {
    Object.keys(PANELS).forEach(renderPanel);
  }

  function wireGoals() {
    Object.keys(PANELS).forEach(function (panel) {
      var cfg = PANELS[panel];
      var goal = document.getElementById(cfg.goalId);
      if (!goal || goal.__pmgCoachBound) return;
      goal.__pmgCoachBound = true;
      var debounce = null;
      goal.addEventListener('input', function () {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(function () { renderPanel(panel); }, 80);
      });
      goal.addEventListener('change', function () { renderPanel(panel); });
    });
  }

  function observeReady() {
    function tick() {
      Object.keys(PANELS).forEach(function (panel) { ensureMounted(panel); });
      wireGoals();
      renderAll();
    }
    if (window.pmgMountBus && window.pmgMountBus.isActive()) {
      window.pmgMountBus.subscribe(tick);
      return;
    }
    var observer = new MutationObserver(tick);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { try { observer.disconnect(); } catch (_) {} }, 30000);
  }

  function boot() {
    injectStyles();
    Object.keys(PANELS).forEach(function (panel) { ensureMounted(panel); });
    wireGoals();
    renderAll();
    observeReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.pmgCoach = {
    refresh: renderAll,
    getState: function () {
      var out = {};
      Object.keys(PANELS).forEach(function (panel) {
        var cfg = PANELS[panel];
        var goal = document.getElementById(cfg.goalId);
        var text = goal ? goal.value : '';
        var met = cfg.checklist.map(function (item) {
          var ok = false;
          try { ok = !!item.test(text); } catch (_) {}
          return { key: item.key, met: ok };
        });
        out[panel] = { text: text, checklist: met };
      });
      return out;
    },
    dismiss: function () {
      Object.keys(PANELS).forEach(function (panel) {
        var el = document.getElementById(PANELS[panel].rootId);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
  };
})();
