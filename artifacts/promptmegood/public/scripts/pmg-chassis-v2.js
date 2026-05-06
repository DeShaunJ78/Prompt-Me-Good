/* PromptMeGood — Chassis v2 bootstrap (Phase 0 + Phase 1)
   Feature-flagged 3-column shell. Activates only when:
     - URL has ?chassis=v2  (also accepts &chassis=v2)
     - or localStorage.pmgChassisV2 === "true"
   Disable with ?chassis=off or by clearing localStorage.pmgChassisV2.

   Phase 1 scope: render empty shell, hide existing content while flag on.
   Phase 2 will move real DOM nodes into the slots; until then existing
   site continues to work at the unflagged URL. */
(function () {
  'use strict';

  var KEY = 'pmgChassisV2';
  var CLASS = 'pmg-chassis-v2';

  function readFlag() {
    try {
      var url = new URL(window.location.href);
      var q = url.searchParams.get('chassis');
      if (q === 'v2') {
        try { localStorage.setItem(KEY, 'true'); } catch (e) {}
        return true;
      }
      if (q === 'off' || q === '0' || q === 'v1') {
        try { localStorage.removeItem(KEY); } catch (e) {}
        return false;
      }
      try { return localStorage.getItem(KEY) === 'true'; } catch (e) { return false; }
    } catch (e) { return false; }
  }

  if (!readFlag()) return;

  // Add class as early as possible so CSS can hide existing body.
  document.documentElement.classList.add(CLASS);

  function buildShell() {
    if (document.getElementById('pmg-chassis-v2-root')) return;
    var root = document.createElement('div');
    root.id = 'pmg-chassis-v2-root';
    root.innerHTML = [
      '<div class="pmgv2-tb">',
        '<div class="pmgv2-tb-l">',
          '<div class="pmgv2-brand"><span class="pmgv2-brand-dot"></span><span>PromptMeGood</span></div>',
          '<div class="pmgv2-vbar"></div>',
          '<div class="pmgv2-crumb">/<span>app</span> · workstation · chassis v2 preview</div>',
        '</div>',
        '<div class="pmgv2-tb-r">',
          '<span class="pmgv2-kbd">⌘K Search</span>',
          '<button class="pmgv2-ico" type="button" title="Help">?</button>',
          '<button class="pmgv2-expert" type="button">⚙ Expert Mode</button>',
          '<div class="pmgv2-av">U</div>',
        '</div>',
      '</div>',
      '<div class="pmgv2-body">',
        '<aside class="pmgv2-rail" data-slot="vault">',
          '<button class="pmgv2-new-btn" type="button">+ New Prompt</button>',
          '<div class="pmgv2-rail-h">Local Vault</div>',
          '<div class="pmgv2-slot-empty">Vault loads here · Phase 2</div>',
          '<div class="pmgv2-rail-h">Templates</div>',
          '<div class="pmgv2-slot-empty">Template grid · Phase 2</div>',
          '<div class="pmgv2-rail-h">Vault Tools</div>',
          '<div class="pmgv2-slot-empty">Import · Backup · Compare · Phase 2</div>',
        '</aside>',
        '<section class="pmgv2-main" data-slot="thread">',
          '<div class="pmgv2-mode-bar">',
            '<button class="pmgv2-tpl-picker" type="button">',
              '<span><span class="pmgv2-tp-lab">Template</span><span class="pmgv2-tp-name">Choose a starting template…</span></span>',
              '<span class="pmgv2-tp-meta">28 templates</span>',
              '<span class="pmgv2-car">▾</span>',
            '</button>',
            '<div class="pmgv2-session-meta"><span class="pmgv2-pill pmgv2-pill-live">Session</span><span class="pmgv2-pill">Local-first</span></div>',
          '</div>',
          '<div class="pmgv2-thread">',
            '<div class="pmgv2-slot-empty pmgv2-slot-thread">Thread (User msg → Generated Prompt → AI Result) loads here · Phase 2</div>',
          '</div>',
          '<div class="pmgv2-composer-wrap">',
            '<div class="pmgv2-slot-empty pmgv2-slot-composer">Composer · Fix My Prompt loads here · Phase 2</div>',
            '<div class="pmgv2-composer-hint">Press ⌘K for commands · ⌘↵ to send · Local-first, no login required</div>',
          '</div>',
        '</section>',
        '<div class="pmgv2-chain-gutter" aria-hidden="true">',
          '<div class="pmgv2-chain-spine"></div>',
          '<div class="pmgv2-chain-label pmgv2-chain-top">SOUL</div>',
          '<div class="pmgv2-chain-stack"><div class="pmgv2-chain-link"></div><div class="pmgv2-chain-link"></div><div class="pmgv2-chain-link"></div></div>',
          '<div class="pmgv2-chain-label pmgv2-chain-bot">BODY</div>',
        '</div>',
        '<aside class="pmgv2-tools" data-slot="suite">',
          '<div class="pmgv2-tools-h"><div><div class="pmgv2-tools-t">📷 Visual Asset Engine</div><div class="pmgv2-tools-sub">Photography Suite · Phase 2</div></div></div>',
          '<div class="pmgv2-ml-card">',
            '<div class="pmgv2-ml-row">',
              '<div><div class="pmgv2-ml-lab">⛓ Master Link · OFF</div><div class="pmgv2-ml-desc">Soul + Body → one Master Plan</div></div>',
              '<button class="pmgv2-switch" type="button" aria-label="Toggle Master Link"></button>',
            '</div>',
          '</div>',
          '<div class="pmgv2-slot-empty">Photography Suite (Style · Camera · Lighting · Composition · Color · Knobs) loads here · Phase 2</div>',
          '<div class="pmgv2-slot-empty">✦ Master Actionable Plan loads here · Phase 2</div>',
        '</aside>',
      '</div>',
      '<div class="pmgv2-statusbar">',
        '<div class="pmgv2-statusbar-l"><span>● Saved locally</span><span>v2 chassis preview</span><span>Phase 1 of 5</span></div>',
        '<div>Append ?chassis=off to revert to the original site</div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildShell, { once: true });
  } else {
    buildShell();
  }

  // Expose toggle helper for the console / future UI affordances.
  window.pmgChassisV2 = {
    enable: function () { try { localStorage.setItem(KEY, 'true'); } catch (e) {} location.reload(); },
    disable: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.search = '?chassis=off'; }
  };
})();
