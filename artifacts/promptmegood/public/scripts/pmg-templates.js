/* tpl-1 — Browse Templates trigger + overlay.

   Adds a small ghost link "Need inspiration? Browse templates"
   directly under the #goal textarea (inside .field.field-primary,
   so it travels with the field when chassis-v3 reparents into the
   v3 idea host). Click lifts the existing #templates section out
   of the chassis-hidden <main> and into <body data-pmg-overlay-root>
   so it renders as a centered overlay with a close button. The
   inline click handler in app.html (search "tpl-1") handles the
   actual "set #goal, scroll, focus" behaviour for builtin cards;
   this module just owns the trigger + overlay shell, and dismisses
   the overlay when a template is picked. */
(function () {
  'use strict';

  var LINK_ID = 'pmg-templates-trigger';
  var OVERLAY_ID = 'pmg-templates-overlay';
  var STYLE_ID = 'pmg-templates-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.pmg-templates-trigger {',
      '  display: inline-block;',
      '  margin: 6px 0 0;',
      '  padding: 4px 0;',
      '  background: transparent;',
      '  border: 0;',
      '  font: inherit;',
      '  font-size: 0.78rem;',
      '  color: #8a9a8a;',
      '  opacity: 0.75;',
      '  font-style: italic;',
      '  text-decoration: underline;',
      '  text-underline-offset: 2px;',
      '  cursor: pointer;',
      '  text-align: left;',
      '}',
      '.pmg-templates-trigger:hover { opacity: 1; color: #00c896; }',
      '.pmg-templates-trigger:focus { outline: 2px solid #00c896; outline-offset: 2px; border-radius: 3px; }',
      '#' + OVERLAY_ID + ' {',
      '  position: fixed; inset: 0; z-index: 10050;',
      '  background: rgba(6, 18, 14, 0.78);',
      '  display: none; align-items: flex-start; justify-content: center;',
      '  padding: 5vh 16px 16px;',
      '  overflow-y: auto;',
      '  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);',
      '}',
      '#' + OVERLAY_ID + '[data-open="1"] { display: flex; }',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal {',
      '  background: #0d2b1e; color: #e6f4ee;',
      '  border: 1px solid rgba(0, 200, 150, 0.25);',
      '  border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.5);',
      '  width: min(960px, 100%); max-width: 100%;',
      '  padding: 18px 18px 22px; position: relative;',
      '}',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal-head {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 12px; margin-bottom: 10px;',
      '}',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal-title { font-size: 1.05rem; font-weight: 700; margin: 0; }',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal-sub { margin: 0 0 14px; font-size: 0.82rem; opacity: 0.7; }',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal-close {',
      '  background: transparent; color: #e6f4ee; border: 1px solid rgba(255,255,255,0.18);',
      '  border-radius: 8px; width: 36px; height: 36px; font-size: 18px; cursor: pointer;',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '}',
      '#' + OVERLAY_ID + ' .pmg-tpl-modal-close:hover { background: rgba(255,255,255,0.06); }',
      '#' + OVERLAY_ID + ' #templates .panel-head { display: none; }',
      '#' + OVERLAY_ID + ' #templates { display: block !important; visibility: visible !important; }',
      '#' + OVERLAY_ID + ' #templates .panel { background: transparent; border: 0; padding: 0; box-shadow: none; }',
      '#' + OVERLAY_ID + ' #templates .container { padding: 0; max-width: none; }',
      '#' + OVERLAY_ID + ' #templates .templates-grid {',
      '  display: grid; gap: 10px;',
      '  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));',
      '}',
      '#' + OVERLAY_ID + ' .template-card {',
      '  background: rgba(255,255,255,0.03);',
      '  border: 1px solid rgba(0, 200, 150, 0.22);',
      '  color: inherit;',
      '}',
      '#' + OVERLAY_ID + ' .template-card:hover {',
      '  border-color: #00c896; transform: translateY(-2px);',
      '  background: rgba(0,200,150,0.08);',
      '}',
      '@media (max-width: 480px) {',
      '  #' + OVERLAY_ID + ' { padding: 2vh 8px 8px; }',
      '  #' + OVERLAY_ID + ' .pmg-tpl-modal { padding: 14px; border-radius: 10px; }',
      '  #' + OVERLAY_ID + ' #templates .templates-grid { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function injectTrigger() {
    if (document.getElementById(LINK_ID)) return true;
    var goal = document.getElementById('goal');
    if (!goal) return false;
    var field = goal.closest('.field') || goal.parentNode;
    if (!field) return false;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = LINK_ID;
    btn.className = 'pmg-templates-trigger';
    btn.textContent = 'Need inspiration? Browse templates';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-controls', OVERLAY_ID);
    var helper = field.querySelector('.helper');
    if (helper && helper.parentNode === field) {
      helper.parentNode.insertBefore(btn, helper.nextSibling);
    } else {
      field.appendChild(btn);
    }
    btn.addEventListener('click', openOverlay);
    return true;
  }

  function ensureOverlayShell() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.setAttribute('data-pmg-overlay-root', '1');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'pmg-tpl-modal-title');
    ov.innerHTML = [
      '<div class="pmg-tpl-modal" role="document">',
      '  <div class="pmg-tpl-modal-head">',
      '    <h2 class="pmg-tpl-modal-title" id="pmg-tpl-modal-title">Browse templates</h2>',
      '    <button type="button" class="pmg-tpl-modal-close" aria-label="Close templates" data-pmg-tpl-close>×</button>',
      '  </div>',
      '  <p class="pmg-tpl-modal-sub">Tap a card to drop a starter prompt into your goal box. You can edit it before generating.</p>',
      '  <div class="pmg-tpl-modal-body" id="pmg-tpl-modal-body"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-pmg-tpl-close]')) closeOverlay();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.getAttribute('data-open') === '1') closeOverlay();
    });
    return ov;
  }

  function openOverlay() {
    injectStyles();
    var ov = ensureOverlayShell();
    var body = ov.querySelector('#pmg-tpl-modal-body');
    var section = document.getElementById('templates');
    if (section && body && section.parentNode !== body) {
      // Lift the existing #templates section into the overlay body.
      // Since #templates lives inside <main> (which the chassis hide
      // rule covers), this is the only way to surface it. The overlay
      // root carries data-pmg-overlay-root so the chassis universal
      // hide rule lets it through.
      body.appendChild(section);
    }
    ov.setAttribute('data-open', '1');
    document.body.style.overflow = 'hidden';
    var first = ov.querySelector('.template-card');
    if (first && typeof first.focus === 'function') {
      try { first.focus(); } catch (_) {}
    }
  }

  function closeOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (!ov) return;
    ov.removeAttribute('data-open');
    document.body.style.overflow = '';
    var trigger = document.getElementById(LINK_ID);
    if (trigger) { try { trigger.focus(); } catch (_) {} }
  }

  // Close on builtin template pick (handler dispatched from app.html).
  document.addEventListener('pmg:templates-pick', function () {
    closeOverlay();
  });

  function boot() {
    injectStyles();
    if (injectTrigger()) return;
    // The chassis builds + reparents over a few hundred ms. Poll for
    // up to 30s to land the trigger after #goal moves into the v3 slot.
    var ticks = 0;
    var t = setInterval(function () {
      ticks++;
      if (injectTrigger() || ticks > 150) clearInterval(t);
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
