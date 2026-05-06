/* PromptMeGood — Chassis v2 bootstrap
   Feature-flagged 3-column workstation shell. Activates only when:
     - URL has ?chassis=v2  (also accepts &chassis=v2)
     - or localStorage.pmgChassisV2 === "true"
   Disable with ?chassis=off or by clearing localStorage.pmgChassisV2.

   Phases shipped in this file:
     Phase 0 — feature flag + persistence + legacy "Try preview" pill
     Phase 1 — render empty 3-column shell, hide legacy content when on
     Phase 2 — relocate real legacy DOM nodes into chassis slots
               (move-not-clone preserves listeners and IDs)
     Phase 3 — Master Link toggle (Soul + Body bridge), chain animation
               responds to ON/OFF state, persisted across reloads
     Phase 4 — compress overlays: Quick Win suppressed in chassis (the
               chassis IS the workstation), legacy yellow beta banner
               hidden + mirrored into a compact status-bar pill
   Legacy site is bit-identical when the flag is off. */
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

  var FLAG_ON = readFlag();

  function injectLegacyToggle() {
    if (document.getElementById('pmg-chassis-v2-toggle')) return;
    var a = document.createElement('a');
    a.id = 'pmg-chassis-v2-toggle';
    a.href = '?chassis=v2';
    a.textContent = '✨ Try new chassis (preview)';
    a.title = 'Preview the new 3-column workstation chassis';
    // Hide on mobile widths so the pill doesn't overlap mobile sticky CTAs
    if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) return;
    a.style.cssText = [
      'position:fixed', 'bottom:14px', 'right:14px', 'z-index:2147483646',
      'padding:8px 14px', 'border-radius:999px',
      'background:linear-gradient(135deg,#3ee0a0,#5fe6b0)',
      'color:#0a2420', 'font:600 12px/1 Inter,system-ui,sans-serif',
      'letter-spacing:.02em', 'text-decoration:none',
      'box-shadow:0 6px 20px rgba(62,224,160,.35),0 0 0 1px rgba(95,230,176,.4)',
      'cursor:pointer', 'transition:transform .15s ease,box-shadow .15s ease'
    ].join(';');
    a.addEventListener('mouseenter', function () {
      a.style.transform = 'translateY(-1px)';
      a.style.boxShadow = '0 8px 24px rgba(62,224,160,.5),0 0 0 1px rgba(95,230,176,.6)';
    });
    a.addEventListener('mouseleave', function () {
      a.style.transform = '';
      a.style.boxShadow = '0 6px 20px rgba(62,224,160,.35),0 0 0 1px rgba(95,230,176,.4)';
    });
    document.body.appendChild(a);
  }

  if (!FLAG_ON) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectLegacyToggle, { once: true });
    } else {
      injectLegacyToggle();
    }
    window.pmgChassisV2 = {
      enable: function () { try { localStorage.setItem(KEY, 'true'); } catch (e) {} location.search = '?chassis=v2'; },
      disable: function () {}
    };
    return;
  }

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
          '<div class="pmgv2-slot-empty" data-pmgv2-target="vault">Loading vault…</div>',
          '<div class="pmgv2-rail-h">Templates</div>',
          '<div class="pmgv2-slot-empty" data-pmgv2-target="templates">Loading templates…</div>',
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
            '<div class="pmgv2-slot-empty pmgv2-slot-thread" data-pmgv2-target="thread">Loading thread…</div>',
          '</div>',
          '<div class="pmgv2-composer-wrap">',
            '<div class="pmgv2-slot-empty pmgv2-slot-composer" data-pmgv2-target="composer">Loading composer…</div>',
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
          '<div class="pmgv2-tools-h"><div><div class="pmgv2-tools-t">📷 Visual Asset Engine</div><div class="pmgv2-tools-sub">Photography Suite</div></div></div>',
          '<div class="pmgv2-ml-card" id="pmgv2-ml-card">',
            '<div class="pmgv2-ml-row">',
              '<div><div class="pmgv2-ml-lab" id="pmgv2-ml-lab">⛓ Master Link · OFF</div><div class="pmgv2-ml-desc">Soul + Body → one Master Plan</div></div>',
              '<button class="pmgv2-switch" type="button" id="pmgv2-ml-switch" aria-label="Toggle Master Link" aria-pressed="false"></button>',
            '</div>',
          '</div>',
          '<div class="pmgv2-slot-empty" data-pmgv2-target="suite">Loading Photography Suite…</div>',
          '<div class="pmgv2-plan-card" id="pmgv2-plan-card" data-state="idle">',
            '<div class="pmgv2-plan-h">✦ Master Actionable Plan</div>',
            '<div class="pmgv2-plan-body">Turn on <strong>Master Link</strong> to weave your written prompt (Soul) and your photo picks (Body) into one plan you can copy or run.</div>',
          '</div>',
        '</aside>',
      '</div>',
      '<div class="pmgv2-statusbar">',
        '<div class="pmgv2-statusbar-l">',
          '<span>● Saved locally</span>',
          '<span>v2 chassis preview</span>',
          '<span>Phase 4 of 5</span>',
          '<a class="pmgv2-beta-pill" id="pmgv2-beta-pill" href="./pricing.html" hidden>',
            '<span class="pmgv2-beta-dot"></span>',
            '<span class="pmgv2-beta-txt">BETA</span>',
          '</a>',
        '</div>',
        '<div class="pmgv2-statusbar-r">',
          '<span class="pmgv2-personalize-lab">Accent</span>',
          '<span class="pmgv2-swatches" role="group" aria-label="Theme accent color">',
            '<button type="button" class="pmgv2-sw" data-accent="green"  title="PromptMeGood Mint (default)" aria-label="PromptMeGood Mint"><span class="pmgv2-sw-d" style="background:#3ee0a0"></span></button>',
            '<button type="button" class="pmgv2-sw" data-accent="blue"   title="Deep Blue"   aria-label="Deep Blue"><span class="pmgv2-sw-d" style="background:#93c5fd"></span></button>',
            '<button type="button" class="pmgv2-sw" data-accent="purple" title="Royal Purple" aria-label="Royal Purple"><span class="pmgv2-sw-d" style="background:#c4b5fd"></span></button>',
            '<button type="button" class="pmgv2-sw" data-accent="gold"   title="Warm Gold"   aria-label="Warm Gold"><span class="pmgv2-sw-d" style="background:#fcd34d"></span></button>',
            '<button type="button" class="pmgv2-sw" data-accent="slate"  title="Slate"       aria-label="Slate"><span class="pmgv2-sw-d" style="background:#cbd5e1"></span></button>',
          '</span>',
          '<span class="pmgv2-statusbar-hint">?chassis=off to revert</span>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);
    wireSwatches(root);
    wireMasterLink(root);
    wireBetaPill(root);
  }

  // ---- Phase 4: Beta banner -> compact status-bar pill ----
  // The legacy yellow #pmg-t42-beta-banner takes ~78px at the very top of
  // the page and clashes with the calm teal palette. In chassis v2 we hide
  // it via CSS (see pmg-chassis-v2.css) and mirror its message into a tiny
  // pill in the status bar. Polls for the legacy banner because pmg-ux.js
  // mounts it asynchronously after fetching paywall config.
  function wireBetaPill(root) {
    var pill = root.querySelector('#pmgv2-beta-pill');
    var txt = root.querySelector('.pmgv2-beta-txt');
    if (!pill || !txt) return;
    var tries = 0;
    var max = 25; // 5s @ 200ms
    function tick() {
      var legacy = document.getElementById('pmg-t42-beta-banner');
      if (legacy) {
        var raw = (legacy.textContent || '').trim();
        // Extract date phrase: "Free Beta Access Until <date> — ..."
        var m = raw.match(/Until\s+([^—–\-]+?)(?:\s*[—–\-]|$)/i);
        var date = m ? m[1].trim() : '';
        txt.textContent = date
          ? 'BETA · free until ' + date
          : 'BETA · founding waitlist open';
        pill.removeAttribute('hidden');
        pill.title = raw;
        return;
      }
      if (++tries < max) setTimeout(tick, 200);
    }
    tick();
  }

  // ---- Phase 3: Master Link toggle ----
  // Persists ON/OFF in localStorage and reflects state via:
  //   <html data-pmgv2-master-link="on|off">  -> drives chain animation
  //   #pmgv2-ml-switch[aria-pressed]          -> drives switch visual
  //   #pmgv2-ml-lab text                       -> "ON" / "OFF"
  //   #pmgv2-ml-card[data-state]               -> idle | active card border
  //   #pmgv2-plan-card[data-state]             -> idle | active plan card
  // Phase 4 will populate the plan card with the actual woven plan;
  // for now the body stays as guidance copy and the card just lights up.
  function wireMasterLink(root) {
    var ML_KEY = 'pmgChassisV2:masterLink';
    var sw = root.querySelector('#pmgv2-ml-switch');
    var lab = root.querySelector('#pmgv2-ml-lab');
    var card = root.querySelector('#pmgv2-ml-card');
    var plan = root.querySelector('#pmgv2-plan-card');
    if (!sw || !lab || !card || !plan) return;

    function read() {
      try { return localStorage.getItem(ML_KEY) === 'on'; } catch (e) { return false; }
    }
    function apply(on) {
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
      lab.textContent = on ? '⛓ Master Link · ON' : '⛓ Master Link · OFF';
      card.setAttribute('data-state', on ? 'active' : 'idle');
      plan.setAttribute('data-state', on ? 'active' : 'idle');
      document.documentElement.setAttribute('data-pmgv2-master-link', on ? 'on' : 'off');
      try { localStorage.setItem(ML_KEY, on ? 'on' : 'off'); } catch (e) {}
    }
    apply(read());
    sw.addEventListener('click', function () {
      apply(sw.getAttribute('aria-pressed') !== 'true');
    });
  }

  // Accent swatches — drive the same data-accent + localStorage key
  // the legacy footer picker uses, so both stay in sync.
  function wireSwatches(root) {
    var ACCENT_KEY = 'promptmegood:themeAccent:v1';
    var VALID = ['green', 'blue', 'purple', 'gold', 'slate'];
    var swatches = root.querySelectorAll('.pmgv2-sw[data-accent]');
    if (!swatches.length) return;
    function current() {
      var saved = '';
      try { saved = localStorage.getItem(ACCENT_KEY) || ''; } catch (e) {}
      return VALID.indexOf(saved) === -1 ? 'green' : saved;
    }
    function apply(name) {
      if (VALID.indexOf(name) === -1) name = 'green';
      if (name === 'green') document.documentElement.removeAttribute('data-accent');
      else document.documentElement.setAttribute('data-accent', name);
      try { localStorage.setItem(ACCENT_KEY, name); } catch (e) {}
      swatches.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-accent') === name ? 'true' : 'false');
      });
    }
    apply(current());
    swatches.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-accent')); });
    });
  }

  // ---- Phase 2: relocate real DOM nodes into chassis slots ----
  // We MOVE (not clone) so every existing event listener, ref, and
  // dataset stays attached. Legacy code keeps querying #prompt-form,
  // #result-panel, #pmg-photo-suite by ID — all still work since the
  // node identity is preserved.
  // Each entry tries `srcs` in order — first match wins. We prefer the
  // wrapper (`photo-suite-section`) over the inner (`pmg-photo-suite`)
  // because legacy scripts (pmg-suite-handoff scrollToSuite/pulseSection,
  // pmg-ux navigation) call getElementById('photo-suite-section') first.
  // Moving only the inner would orphan the wrapper as a hidden body
  // child and the scroll/pulse logic would target the stale node.
  var RELOCATIONS = [
    { srcs: ['prompt-form'],                          target: 'composer'  },
    { srcs: ['result-panel'],                         target: 'thread'    },
    { srcs: ['history'],                              target: 'vault'     },
    { srcs: ['templates'],                            target: 'templates' },
    { srcs: ['photo-suite-section', 'pmg-photo-suite'], target: 'suite'   }
  ];

  function relocateLegacy() {
    var moved = 0;
    var pending = 0;
    RELOCATIONS.forEach(function (r) {
      var slot = document.querySelector('[data-pmgv2-target="' + r.target + '"]');
      if (!slot) return; // already filled
      var src = null;
      for (var i = 0; i < r.srcs.length; i++) {
        var n = document.getElementById(r.srcs[i]);
        if (n && n.getAttribute('data-pmgv2-relocated') !== '1') { src = n; break; }
      }
      if (!src) { pending++; return; }
      src.removeAttribute('hidden');
      slot.replaceWith(src);
      src.setAttribute('data-pmgv2-relocated', '1');
      src.classList.add('pmgv2-relocated');
      moved++;
    });
    return { moved: moved, pending: pending };
  }

  function bootChassis() {
    buildShell();
    // Some legacy nodes (notably the photo-suite wrapper, built by T23)
    // are created lazily, sometimes well after DOMContentLoaded.
    // Strategy: try now, on window.load, then poll a few more times so
    // late-mounted nodes still get relocated. Bounded retries (max ~3s)
    // so we don't spin forever if a node never appears.
    var attempts = 0;
    var MAX_ATTEMPTS = 15; // 15 × 200ms = 3s after load
    function tick() {
      var r = relocateLegacy();
      attempts++;
      if (r.pending > 0 && attempts < MAX_ATTEMPTS) {
        setTimeout(tick, 200);
      }
    }
    tick();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () {
        attempts = 0; // reset retry budget after load
        tick();
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootChassis, { once: true });
  } else {
    bootChassis();
  }

  // Expose toggle helper for the console / future UI affordances.
  window.pmgChassisV2 = {
    enable: function () { try { localStorage.setItem(KEY, 'true'); } catch (e) {} location.reload(); },
    disable: function () { try { localStorage.removeItem(KEY); } catch (e) {} location.search = '?chassis=off'; }
  };
})();
