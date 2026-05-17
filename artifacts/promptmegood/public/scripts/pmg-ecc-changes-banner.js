/*
 * pmg-ecc-changes-banner.js  (eccb-1, 2026-05-17)
 *
 * Inline "what just changed and why" banner for the Expert Command Center.
 * Surfaces a plain-language summary right under #goal whenever ECC writes
 * a new prompt, with an Undo button that restores the prior goal text.
 *
 * Why this exists: the user said "I can see when things change but the
 * user has no idea what was changed and why." The pre-existing tiny
 * "Expert Settings Applied" pill + toast told the user SOMETHING happened
 * but not WHAT.
 *
 * Public API (window.pmgEccChanges):
 *   .showSettings({ source, previousGoal, engineer, tune })
 *       Banner for Diagnose/Engineer/Tune Apply (bullet list of every
 *       Engineer section now active + every Tune toggle/slider that's
 *       contributing).
 *   .showRewrite({ source, previousGoal, newGoal })
 *       Banner for "Fix Like Architect" — single-bullet "AI rewrote
 *       your prompt (+N words of structure)" + Undo.
 *   .hide()
 *
 * Disable: ?noeccbanner OR localStorage.pmg_ecc_banner_disable='1'
 */
(function () {
  if (window.__pmgEccBannerLoaded) return;
  window.__pmgEccBannerLoaded = true;
  try {
    if (/[?&]noeccbanner\b/.test(location.search || '')) return;
    if (localStorage.getItem('pmg_ecc_banner_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-ecc-banner-style';
  var BANNER_ID = 'pmg-ecc-changes-banner';
  var AUTO_DISMISS_MS = 18000;

  /* ---------- Label maps (mirror pmg-expert-center.js ENGINEER_SECTIONS / TUNE_*) ---------- */
  var ENGINEER_LABELS = {
    role: 'Role', objective: 'Objective', audience: 'Audience',
    context: 'Context', constraints: 'Constraints', tone: 'Tone',
    format: 'Output Format', examples: 'Examples', avoid: 'Avoid Rules',
    next: 'Next Steps', success: 'Success Criteria', questions: 'Clarifying Questions First'
  };
  var TOGGLE_LABELS = {
    askFirst: 'Ask Questions First',
    defaults: 'Assume Reasonable Defaults',
    challenge: 'Challenge My Assumptions',
    directFirst: 'Give Direct Answer First',
    reasoning: 'Show Reasoning Summary',
    examples: 'Use Examples',
    noGeneric: 'Avoid Generic Advice',
    execution: 'Prioritize Execution',
    human: 'Make It More Human',
    lessRobotic: 'Make It Less Robotic'
  };
  var SLIDER_LABELS = {
    warmth:     { left: 'Direct',  right: 'Warm' },
    depth:      { left: 'Simple',  right: 'Detailed' },
    formality:  { left: 'Casual',  right: 'Professional' },
    risk:       { left: 'Safe',    right: 'Bold' },
    creativity: { left: 'Plain',   right: 'Creative' },
    length:     { left: 'Short',   right: 'Deep' }
  };

  /* ---------- Styles ---------- */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + BANNER_ID + ' {',
      '  margin: 14px 0 12px;',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 8%, var(--color-surface, #0d2429));',
      '  border: 1px solid color-mix(in srgb, var(--color-primary, #3ee0a0) 35%, transparent);',
      '  border-radius: 12px;',
      '  padding: 14px 16px 12px;',
      '  box-shadow: 0 4px 16px rgba(0,0,0,0.18),',
      '              0 0 0 1px color-mix(in srgb, var(--color-primary, #3ee0a0) 10%, transparent);',
      '  color: var(--color-text, #e6fffb);',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  animation: pmgEccBannerIn 240ms cubic-bezier(0.34, 1.56, 0.64, 1) both;',
      '  position: relative;',
      '}',
      '@keyframes pmgEccBannerIn {',
      '  0% { opacity: 0; transform: translateY(-6px) scale(0.985); }',
      '  100% { opacity: 1; transform: translateY(0) scale(1); }',
      '}',
      '#' + BANNER_ID + '.is-out {',
      '  animation: pmgEccBannerOut 200ms ease-in both;',
      '}',
      '@keyframes pmgEccBannerOut {',
      '  0% { opacity: 1; transform: translateY(0); }',
      '  100% { opacity: 0; transform: translateY(-4px); }',
      '}',
      '.pmg-eccb-head {',
      '  display: flex; align-items: center; gap: 8px;',
      '  margin: 0 0 6px;',
      '}',
      '.pmg-eccb-tick {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  width: 20px; height: 20px; border-radius: 50%;',
      '  background: var(--color-primary, #3ee0a0); color: var(--color-bg, #07171c);',
      '  font-size: 13px; font-weight: 700; line-height: 1; flex-shrink: 0;',
      '}',
      '.pmg-eccb-title {',
      '  font-size: 14px; font-weight: 700; letter-spacing: 0.01em;',
      '  color: var(--color-text, #e6fffb); flex: 1;',
      '}',
      '.pmg-eccb-close {',
      '  appearance: none; background: transparent; border: 0;',
      '  width: 26px; height: 26px; border-radius: 6px;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 55%, transparent);',
      '  font-size: 18px; line-height: 1; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  flex-shrink: 0;',
      '}',
      '.pmg-eccb-close:hover {',
      '  background: color-mix(in srgb, var(--color-text, #e6fffb) 8%, transparent);',
      '  color: var(--color-text, #e6fffb);',
      '}',
      '.pmg-eccb-why {',
      '  font-size: 12.5px; line-height: 1.5;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 65%, transparent);',
      '  margin: 0 0 10px;',
      '}',
      '.pmg-eccb-list {',
      '  list-style: none; padding: 0; margin: 0 0 12px;',
      '  display: flex; flex-direction: column; gap: 5px;',
      '  max-height: 240px; overflow-y: auto;',
      '}',
      '.pmg-eccb-list li {',
      '  font-size: 13px; line-height: 1.5;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 88%, transparent);',
      '  padding-left: 22px; position: relative;',
      '}',
      '.pmg-eccb-list li::before {',
      '  content: "+"; position: absolute; left: 0; top: 0;',
      '  color: var(--color-primary, #3ee0a0);',
      '  font-weight: 700; font-size: 15px;',
      '}',
      '.pmg-eccb-list li strong {',
      '  color: var(--color-text, #e6fffb); font-weight: 600;',
      '}',
      '.pmg-eccb-actions {',
      '  display: flex; gap: 8px; flex-wrap: wrap;',
      '  padding-top: 8px;',
      '  border-top: 1px solid color-mix(in srgb, var(--color-text, #e6fffb) 12%, transparent);',
      '}',
      '.pmg-eccb-btn {',
      '  appearance: none; cursor: pointer;',
      '  padding: 7px 14px; border-radius: 8px;',
      '  font-size: 13px; font-weight: 600; line-height: 1.2;',
      '  border: 1px solid color-mix(in srgb, var(--color-text, #e6fffb) 22%, transparent);',
      '  background: transparent;',
      '  color: color-mix(in srgb, var(--color-text, #e6fffb) 80%, transparent);',
      '  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;',
      '}',
      '.pmg-eccb-btn:hover {',
      '  background: color-mix(in srgb, var(--color-text, #e6fffb) 8%, transparent);',
      '  color: var(--color-text, #e6fffb);',
      '  border-color: color-mix(in srgb, var(--color-text, #e6fffb) 40%, transparent);',
      '}',
      '.pmg-eccb-btn.is-undo {',
      '  border-color: color-mix(in srgb, var(--color-primary, #3ee0a0) 50%, transparent);',
      '  color: var(--color-primary, #3ee0a0);',
      '}',
      '.pmg-eccb-btn.is-undo:hover {',
      '  background: color-mix(in srgb, var(--color-primary, #3ee0a0) 12%, transparent);',
      '  border-color: var(--color-primary, #3ee0a0);',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + BANNER_ID + ', #' + BANNER_ID + '.is-out { animation: none; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- Helpers ---------- */
  function truncate(t, max) {
    if (!t) return '';
    t = String(t).replace(/\s+/g, ' ').trim();
    return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
  }
  function wordCount(t) {
    return (t || '').trim().split(/\s+/).filter(Boolean).length;
  }

  /* Build a plain-language change list from the current ECC settings state.
     Returns an array of segment-arrays. Each segment is {bold?:string, text?:string}
     and is rendered via textContent (NOT innerHTML) to prevent XSS via custom
     Architect text values. */
  function buildSettingsChanges(engineer, tune) {
    var items = [];
    /* Engineer sections (skip 'off'). */
    if (engineer) {
      Object.keys(ENGINEER_LABELS).forEach(function (key) {
        var s = engineer[key];
        if (!s || s.mode === 'off') return;
        var label = ENGINEER_LABELS[key];
        if (s.mode === 'auto') {
          items.push([
            { bold: label + ':' },
            { text: ' Auto-added a sensible default so AI knows what to do here.' }
          ]);
        } else if (s.mode === 'custom') {
          var v = (s.value || '').trim();
          if (!v) return;
          items.push([
            { bold: label + ':' },
            { text: ' "' + truncate(v, 90) + '"' }
          ]);
        }
      });
    }
    /* Tune toggles. */
    if (tune && tune.toggles) {
      Object.keys(TOGGLE_LABELS).forEach(function (key) {
        if (!tune.toggles[key]) return;
        items.push([
          { bold: TOGGLE_LABELS[key] },
          { text: ' — added as a behavior instruction.' }
        ]);
      });
    }
    /* Tune sliders (only if pushed far from neutral). */
    if (tune && tune.sliders) {
      Object.keys(SLIDER_LABELS).forEach(function (key) {
        var v = tune.sliders[key];
        if (typeof v !== 'number') return;
        var labels = SLIDER_LABELS[key];
        if (v < 33) {
          items.push([
            { text: 'Style pushed toward ' },
            { bold: labels.left },
            { text: '.' }
          ]);
        } else if (v > 66) {
          items.push([
            { text: 'Style pushed toward ' },
            { bold: labels.right },
            { text: '.' }
          ]);
        }
      });
    }
    return items;
  }

  function sourceTitle(source, mode) {
    if (mode === 'rewrite') return 'AI rewrote your prompt';
    if (source === 'diagnose') return 'Expert settings + tuning applied';
    if (source === 'engineer') return 'Architect structure applied';
    if (source === 'tune')     return 'Tuning instructions applied';
    return 'Expert Command Center applied';
  }
  function sourceWhy(source, mode, originalLen, newLen) {
    if (mode === 'rewrite') {
      var delta = newLen - originalLen;
      var pct = originalLen > 0 ? Math.round((delta / originalLen) * 100) : 0;
      var bits = ['Your original intent is preserved.'];
      if (delta > 0) {
        var addText = '+' + delta + ' words of structure (role, format, constraints, success criteria)';
        if (pct > 0 && originalLen >= 4) addText += ' — about ' + pct + '% richer';
        bits.unshift(addText + '.');
      } else if (delta < 0) {
        bits.unshift('Trimmed ' + Math.abs(delta) + ' words while tightening structure.');
      }
      return bits.join(' ');
    }
    return 'These instructions are added to your prompt so AI follows them when answering.';
  }

  /* ---------- Banner DOM ---------- */
  function ensureAnchor() {
    var goal = document.getElementById('goal');
    if (!goal || !goal.parentNode) return null;
    return goal;
  }

  function hide() {
    var el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.classList.add('is-out');
    setTimeout(function () {
      try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (_) {}
    }, 220);
  }

  function render(opts) {
    ensureStyles();
    var goal = ensureAnchor();
    if (!goal) return;

    /* Remove any existing banner first. */
    var existing = document.getElementById(BANNER_ID);
    if (existing) { try { existing.remove(); } catch (_) {} }

    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('data-pmg-overlay-root', '1');

    /* Head row: tick + title + close. */
    var head = document.createElement('div');
    head.className = 'pmg-eccb-head';
    var tick = document.createElement('span');
    tick.className = 'pmg-eccb-tick';
    tick.textContent = '✓';
    var title = document.createElement('div');
    title.className = 'pmg-eccb-title';
    title.textContent = opts.title;
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmg-eccb-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '&times;';
    close.addEventListener('click', hide);
    head.appendChild(tick);
    head.appendChild(title);
    head.appendChild(close);
    el.appendChild(head);

    /* Why line (small italic explainer). */
    if (opts.why) {
      var why = document.createElement('p');
      why.className = 'pmg-eccb-why';
      why.textContent = opts.why;
      el.appendChild(why);
    }

    /* Change list. Items are segment arrays; we build each li via DOM
       nodes (textContent) so user-supplied "custom" Architect text can
       never inject HTML. */
    if (opts.items && opts.items.length) {
      var ul = document.createElement('ul');
      ul.className = 'pmg-eccb-list';
      opts.items.forEach(function (segs) {
        var li = document.createElement('li');
        if (Array.isArray(segs)) {
          segs.forEach(function (seg) {
            if (!seg) return;
            if (seg.bold) {
              var b = document.createElement('strong');
              b.textContent = seg.bold;
              li.appendChild(b);
            } else if (seg.text) {
              li.appendChild(document.createTextNode(seg.text));
            }
          });
        } else {
          li.textContent = String(segs);
        }
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }

    /* Action row: Undo + Dismiss. */
    var actions = document.createElement('div');
    actions.className = 'pmg-eccb-actions';
    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'pmg-eccb-btn is-undo';
    undoBtn.textContent = '↶ Undo changes';
    undoBtn.addEventListener('click', function () {
      try {
        var ta = document.getElementById('goal');
        if (ta) {
          ta.value = opts.previousGoal || '';
          /* Fire input + change so any listeners (strength meter, drafts) sync. */
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (_) {}
      hide();
    });
    var okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'pmg-eccb-btn';
    okBtn.textContent = 'Got it';
    okBtn.addEventListener('click', hide);
    actions.appendChild(undoBtn);
    actions.appendChild(okBtn);
    el.appendChild(actions);

    /* Insert AFTER the goal textarea (so it sits between the prompt
       and whatever comes below — strength meter, action row, etc). */
    if (goal.nextSibling) {
      goal.parentNode.insertBefore(el, goal.nextSibling);
    } else {
      goal.parentNode.appendChild(el);
    }

    /* Auto-dismiss after a while so it doesn't linger forever. */
    setTimeout(function () {
      if (document.getElementById(BANNER_ID) === el) hide();
    }, AUTO_DISMISS_MS);
  }

  /* ---------- Public API ---------- */
  function showSettings(opts) {
    opts = opts || {};
    var items = buildSettingsChanges(opts.engineer, opts.tune);
    if (!items.length) return; /* Nothing meaningful changed — don't bother the user. */
    render({
      title: sourceTitle(opts.source, 'settings'),
      why: sourceWhy(opts.source, 'settings'),
      items: items,
      previousGoal: opts.previousGoal || ''
    });
  }

  function showRewrite(opts) {
    opts = opts || {};
    var oldLen = wordCount(opts.previousGoal);
    var newLen = wordCount(opts.newGoal);
    var items = [
      [
        { bold: 'Role, audience, format, tone, constraints, and a success criterion' },
        { text: ' added.' }
      ],
      [
        { bold: 'Original meaning preserved' },
        { text: ' — only the scaffolding changed.' }
      ]
    ];
    render({
      title: sourceTitle(opts.source, 'rewrite'),
      why: sourceWhy(opts.source, 'rewrite', oldLen, newLen),
      items: items,
      previousGoal: opts.previousGoal || ''
    });
  }

  window.pmgEccChanges = {
    showSettings: showSettings,
    showRewrite: showRewrite,
    hide: hide
  };
})();
