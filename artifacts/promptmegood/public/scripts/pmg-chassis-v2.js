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
     Phase 5 — polish: Export Plan button on the Master Plan card
               (Soul + Body weave to clipboard, gated on Master Link),
               mobile bottom dock with Vault / Workstation / Visual
               tabs so phones don't revert to a long-scroll page
   Legacy site is bit-identical when the flag is off. */
(function () {
  'use strict';

  var KEY = 'pmgChassisV2';
  var CLASS = 'pmg-chassis-v2';

  // Chassis v2 is the only experience. The legacy single-page view has
  // been retired — there is no opt-out. Any stale localStorage entry from
  // the old preview era is cleaned up on first run so nothing lingers.
  try { localStorage.removeItem(KEY); } catch (e) {}

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
        '</div>',
        '<div class="pmgv2-tb-r">',
          '<button class="pmgv2-ico" type="button" title="Help" aria-label="Help">?</button>',
          '<div class="pmgv2-av" aria-label="Account">U</div>',
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
          '<div class="pmgv2-hero" data-pmgv2-hero-slot></div>',
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
          '<div class="pmgv2-tools-h"><div><div class="pmgv2-tools-t">🎨 Image Prompt Builder</div></div></div>',
          '<div class="pmgv2-ml-card" id="pmgv2-ml-card">',
            '<div class="pmgv2-ml-row">',
              '<div><div class="pmgv2-ml-lab" id="pmgv2-ml-lab">⛓ Sync with Text Prompt · OFF</div><div class="pmgv2-ml-desc">Weave your text prompt + image picks into one plan</div></div>',
              '<button class="pmgv2-switch" type="button" id="pmgv2-ml-switch" aria-label="Toggle Master Link" aria-pressed="false"></button>',
            '</div>',
          '</div>',
          '<div class="pmgv2-slot-empty" data-pmgv2-target="suite">Loading Photography Suite…</div>',
          '<div class="pmgv2-plan-card" id="pmgv2-plan-card" data-state="idle">',
            '<div class="pmgv2-plan-h">✦ Master Actionable Plan</div>',
            '<div class="pmgv2-plan-body">Turn on <strong>Master Link</strong> to weave your written prompt (Soul) and your photo picks (Body) into one plan you can copy or run.</div>',
            '<div class="pmgv2-plan-actions">',
              '<button type="button" class="pmgv2-plan-btn" id="pmgv2-plan-export" disabled>📋 Copy Plan</button>',
              '<span class="pmgv2-plan-toast" id="pmgv2-plan-toast" hidden>Copied to clipboard</span>',
            '</div>',
          '</div>',
        '</aside>',
      '</div>',
      '<div class="pmgv2-statusbar">',
        '<div class="pmgv2-statusbar-l">',
          '<span>● Saved locally</span>',
          '<span>Workstation</span>',
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
          '<span class="pmgv2-statusbar-hint">Local-first · auto-saved</span>',
          '<nav class="pmgv2-foot-links" aria-label="Site links">',
            '<a href="./pricing.html">Pricing</a>',
            '<a href="./guide.html">Guide</a>',
            '<a href="./privacy.html">Privacy</a>',
            '<a href="./terms.html">Terms</a>',
            '<a href="./contact.html">Contact</a>',
          '</nav>',
        '</div>',
      '</div>'
    ].join('');
    // Mobile dock for ≤900px viewports — keeps single-column from
    // becoming a long-scroll page by tabbing between vault/main/tools.
    var dock = document.createElement('nav');
    dock.className = 'pmgv2-dock';
    dock.setAttribute('aria-label', 'Workspace columns');
    dock.innerHTML = [
      '<button type="button" class="pmgv2-dock-btn" data-pmgv2-tab="vault">Vault</button>',
      '<button type="button" class="pmgv2-dock-btn" data-pmgv2-tab="thread" aria-pressed="true">Workstation</button>',
      '<button type="button" class="pmgv2-dock-btn" data-pmgv2-tab="suite">Visual</button>'
    ].join('');
    root.appendChild(dock);

    document.body.appendChild(root);
    wireSwatches(root);
    wireMasterLink(root);
    wireBetaPill(root);
    wireExportPlan(root);
    wireMobileDock(root);
    wireTopBarActions(root);
    wireTemplatePicker(root);
    initCollapsibleComposer(root);
  }

  // ---- Collapsible composer (cv2-21, mobile only) ----
  // The composer was permanently pinned at the viewport bottom even though
  // it's only useful during the *construct a prompt* activity. On mobile
  // its slim form (~165px) still ate ~20% of an 844px viewport while the
  // user was reading a result, browsing templates, etc. — pure dead
  // weight. This module reduces it to a 44px "✏️ What do you want to
  // build?" pill until the user signals construction intent, then expands
  // back to the full composer; collapses again when construction ends.
  //
  // Hard rules:
  //   - Mobile only. matchMedia('(max-width: 900px)') gate at entry AND
  //     a `resize` listener that fully removes the collapsed state on
  //     transition to desktop (so a phone -> tablet rotation can't leave
  //     desktop users with a weird pill).
  //   - Single source of truth: html.pmg-composer-collapsed class. CSS
  //     toggles all visual state from this one class.
  //   - Never destroy/remount #goal or #prompt-form — observers in
  //     pmg-text-feedback.js, pmg-linear-flow.js, pmg-ux.js depend on
  //     them existing in DOM. We only swap visibility on the wrap.
  //   - Sticky-open guard: if #goal has any non-whitespace content, we
  //     refuse to auto-collapse (user is mid-thought). Manual taps on
  //     the pill while expanded still toggle.
  function initCollapsibleComposer(root) {
    var mq = window.matchMedia('(max-width: 900px)');
    if (!mq.matches) return;

    var main = root.querySelector('.pmgv2-main');
    if (!main || root.querySelector('.pmgv2-composer-tab')) return;

    var html = document.documentElement;
    var COLLAPSED = 'pmg-composer-collapsed';

    // Inject the collapsed-state pill. Position is fixed in CSS so it
    // sits above the dock just like the composer-wrap does — same visual
    // anchor, same z-index, just slimmer.
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'pmgv2-composer-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', 'prompt-form');
    tab.setAttribute('aria-label', 'Open prompt composer');
    tab.innerHTML =
      '<span class="pmgv2-composer-tab-ico" aria-hidden="true">✏️</span>' +
      '<span class="pmgv2-composer-tab-lab">What do you want to build?</span>' +
      '<span class="pmgv2-composer-tab-car" aria-hidden="true">▲</span>';
    main.appendChild(tab);

    function goalHasContent() {
      try {
        var g = document.getElementById('goal');
        return !!(g && g.value && g.value.trim().length > 0);
      } catch (e) { return false; }
    }

    function expand(opts) {
      html.classList.remove(COLLAPSED);
      tab.setAttribute('aria-expanded', 'true');
      if (opts && opts.focus) {
        // Defer focus a tick so the wrap's display:none -> flex transition
        // settles before iOS opens the keyboard (otherwise iOS sometimes
        // refuses focus on a just-revealed element).
        setTimeout(function () {
          try {
            var g = document.getElementById('goal');
            if (g) g.focus();
          } catch (e) {}
        }, 60);
      }
    }

    function collapse(opts) {
      // Sticky-open guard. Manual collapse (opts.force) bypasses.
      if (!(opts && opts.force) && goalHasContent()) return;
      html.classList.add(COLLAPSED);
      tab.setAttribute('aria-expanded', 'false');
    }

    // Default state on first paint: collapsed. Discoverable via the pill.
    collapse({ force: true });

    // ---- Expand triggers ----

    // 1) Tap the pill. Toggle: tap-while-collapsed = expand+focus.
    tab.addEventListener('click', function () {
      if (html.classList.contains(COLLAPSED)) {
        expand({ focus: true });
      } else {
        // Pill stays in DOM but hidden via CSS while expanded — the only
        // way to reach this branch is keyboard nav, which we treat as
        // an explicit toggle-to-collapse signal.
        collapse({ force: true });
      }
    });

    // 2) Focus on #goal (e.g., user tabs into it from a lifted aux
    //    control). If the wrap was hidden, focus would fail — so this
    //    listener only fires from non-hidden focus paths or after a
    //    programmatic .focus() from inside expand(). Either way, we
    //    keep the state in sync.
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.id === 'goal') {
        expand({ focus: false });
      }
    });

    // 3) "+ New Prompt" in the rail = "I want to construct now."
    var newBtn = root.querySelector('.pmgv2-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', function () { expand({ focus: true }); });
    }

    // 4) Template picker tap = "I'm constructing from a template."
    //    The existing wireTemplatePicker handler scrolls the rail panel
    //    into view; we add an expand so the goal/preview becomes visible
    //    too once the user picks a tile.
    var tplBtn = root.querySelector('.pmgv2-tpl-picker');
    if (tplBtn) {
      tplBtn.addEventListener('click', function () { expand({ focus: false }); });
    }

    // 5) Vault history + template card clicks (delegated, since both are
    //    rendered dynamically by legacy scripts). Resuming/applying any
    //    of these is unambiguously construction intent — surface the
    //    composer so the user sees what got loaded into #goal.
    document.addEventListener('click', function (e) {
      if (!mq.matches) return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.history-item') || t.closest('.template-card')) {
        // Defer so the legacy click handler runs first and populates #goal.
        setTimeout(function () { expand({ focus: false }); }, 0);
      }
    }, true);

    // ---- Collapse triggers ----

    // 7) Successful generation — body.pmg-has-result is the signal.
    //    Only collapse on the transition (absent → present), not on any
    //    body[class] mutation while the class happens to be present.
    //    Other scripts mutate body classes constantly (theme, tab state,
    //    image-mode, etc.); a naive contains() check would re-collapse
    //    every time the user manually re-expands during result review.
    try {
      var hadResult = document.body.classList.contains('pmg-has-result');
      var resultObs = new MutationObserver(function () {
        var nowHas = document.body.classList.contains('pmg-has-result');
        if (nowHas && !hadResult) {
          // Transition: just generated. Force-collapse so result gets focus.
          collapse({ force: true });
        }
        hadResult = nowHas;
      });
      resultObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}

    // 8) Blur from #goal with empty value — a 300ms grace prevents a
    //    spurious collapse during iOS keyboard dismiss (which fires blur
    //    transiently before refocus).
    document.addEventListener('focusout', function (e) {
      if (e.target && e.target.id === 'goal') {
        setTimeout(function () {
          if (document.activeElement && document.activeElement.id === 'goal') return;
          if (!goalHasContent()) collapse();
        }, 300);
      }
    });

    // 9) Switching to a non-Workstation dock tab = "I'm not constructing
    //    right now." Note: dock data-pmgv2-tab values are 'vault' |
    //    'thread' | 'suite' (NOT 'workstation' — 'thread' IS the
    //    workstation tab; see buildShell ~line 140). Collapse on the
    //    leave-Workstation tabs only.
    var dockBtns = root.querySelectorAll('.pmgv2-dock-btn');
    var LEAVE_TABS = { vault: 1, suite: 1 };
    for (var i = 0; i < dockBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-pmgv2-tab');
          if (tab && LEAVE_TABS[tab]) collapse({ force: true });
        });
      })(dockBtns[i]);
    }

    // ---- Viewport guard ----
    // If user rotates phone -> tablet (or resizes browser past 900px),
    // remove the collapsed state entirely so desktop users never inherit
    // a weird hidden composer.
    function onMqChange() {
      if (!mq.matches) {
        html.classList.remove(COLLAPSED);
        tab.setAttribute('aria-expanded', 'true');
      }
    }
    if (mq.addEventListener) mq.addEventListener('change', onMqChange);
    else if (mq.addListener) mq.addListener(onMqChange);
  }

  // ---- Top-bar action wiring ----
  // Help (?) jumps to the in-app guide. Avatar is a no-op placeholder
  // (auth lives on the legacy account flow). + New Prompt clears #goal
  // and #prompt-form. Without these handlers the chassis chrome looks
  // alive but does nothing on tap, which feels broken on mobile.
  function wireTopBarActions(root) {
    var help = root.querySelector('.pmgv2-ico');
    if (help) help.addEventListener('click', function () {
      try { window.location.href = './guide.html'; } catch (e) {}
    });
    // Accessibility: the mobile composer hides .field-label-row (which
    // contains the visible <label for="goal">Your Goal</label>) so the
    // textarea would otherwise rely on placeholder text only — weak for
    // screen readers and disappears on input. We patch the textarea with
    // an explicit aria-label so AT still announces the field correctly
    // regardless of the label element's visibility. Idempotent: only
    // sets aria-label if not already present so legacy non-chassis users
    // are unaffected.
    try {
      var goalEl = document.getElementById('goal');
      if (goalEl && !goalEl.getAttribute('aria-label')) {
        goalEl.setAttribute('aria-label', 'Your goal — describe what you want');
      }
    } catch (e) {}

    var newBtn = root.querySelector('.pmgv2-new-btn');
    if (newBtn) newBtn.addEventListener('click', function () {
      try {
        var goal = document.getElementById('goal');
        if (goal) { goal.value = ''; goal.focus(); }
        var resultBox = document.getElementById('resultBox');
        if (resultBox) resultBox.textContent = '';
        var rp = document.getElementById('result-panel');
        if (rp) rp.classList.remove('has-result');
        // Resets the global "✓ Your prompt is ready…" confirm banner
        // and the post-result button cluster gated on this body class.
        document.body.classList.remove('pmg-has-result');
      } catch (e) {}
    });
  }

  // ---- Template picker ----
  // The chassis mode-bar surfaces a "Choose a starting template…"
  // button so the relocated #templates panel is reachable without
  // hunting in the rail. Clicking it scrolls the relocated panel
  // into view and focuses its first tile. On mobile we also flip
  // the dock to the vault tab so the rail (which contains
  // #templates) becomes visible.
  function wireTemplatePicker(root) {
    var btn = root.querySelector('.pmgv2-tpl-picker');
    if (!btn) return;
    var nameEl = btn.querySelector('.pmgv2-tp-name');

    // Inject the pulse keyframes once so clicking the picker gives an
    // unmistakable visual ack — without this the click felt "frozen"
    // because the templates panel lives in the rail (off-screen on
    // mobile, in peripheral vision on desktop) so the scroll alone
    // wasn't perceptible.
    if (!document.getElementById('pmgv2-tpl-pulse-css')) {
      var s = document.createElement('style');
      s.id = 'pmgv2-tpl-pulse-css';
      s.textContent =
        '@keyframes pmgv2TplPulse {' +
        '  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary, #3ee0a0) 55%, transparent); }' +
        '  70%  { box-shadow: 0 0 0 12px color-mix(in srgb, var(--color-primary, #3ee0a0) 0%, transparent); }' +
        '  100% { box-shadow: 0 0 0 0 transparent; }' +
        '}' +
        'html.pmg-chassis-v2 .pmgv2-tpl-picker.is-pulse {' +
        '  animation: pmgv2TplPulse 700ms ease-out;' +
        '  border-color: var(--color-primary, #3ee0a0) !important;' +
        '}';
      document.head.appendChild(s);
    }

    var prefersReducedMotion = function () {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { return false; }
    };

    btn.addEventListener('click', function () {
      // 1) Always pulse so user knows the click registered.
      //    Skipped under prefers-reduced-motion — the border-color
      //    swap on .is-pulse still gives a non-animated visual ack.
      if (!prefersReducedMotion()) {
        btn.classList.remove('is-pulse');
        // Force reflow so the animation can replay on rapid clicks.
        void btn.offsetWidth;
        btn.classList.add('is-pulse');
        setTimeout(function () { btn.classList.remove('is-pulse'); }, 750);
      }

      // 2) On mobile flip the dock to the vault tab so the rail
      //    (which contains #templates) becomes visible.
      var isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile) {
        try {
          document.documentElement.setAttribute('data-pmgv2-mobile-tab', 'vault');
          localStorage.setItem('pmgChassisV2:mobileTab', 'vault');
          var dockBtns = root.querySelectorAll('.pmgv2-dock-btn');
          for (var i = 0; i < dockBtns.length; i++) {
            dockBtns[i].setAttribute('aria-pressed', dockBtns[i].getAttribute('data-pmgv2-tab') === 'vault' ? 'true' : 'false');
          }
        } catch (e) {}
      }
      // 3) Scroll the relocated panel into view and focus its first tile.
      //    Use block:'nearest' so we never yank the whole page upward
      //    when the rail's #templates is already onscreen (desktop) — the
      //    rail is its own scroll container, the picker pulse + focus is
      //    the actual signal. On mobile the dock flip above already
      //    swapped the visible column so 'nearest' still lands correctly.
      var tpl = document.getElementById('templates');
      if (tpl) {
        var scrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
        try { tpl.scrollIntoView({ behavior: scrollBehavior, block: 'nearest' }); } catch (e) {}
        var first = tpl.querySelector('.template-card, .template-tile, button, [role="button"]');
        if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
      }
    });

    // Sync the picker label when a template is actually applied so the
    // box stops looking "frozen" on the same default text forever.
    // Delegated listener scoped to #templates only — prevents future
    // .template-card uses elsewhere from accidentally writing into
    // the chassis picker label.
    if (nameEl) {
      document.addEventListener('click', function (ev) {
        var card = ev.target && ev.target.closest && ev.target.closest('.template-card');
        if (!card) return;
        var scope = document.getElementById('templates');
        if (!scope || !scope.contains(card)) return;
        // Only respond to template-card clicks inside the templates panel
        // (avoid the delete-card sub-button etc).
        if (ev.target.closest('.template-card-delete')) return;
        var titleEl = card.querySelector('.template-card-title');
        var label = titleEl ? (titleEl.textContent || '').trim() : '';
        if (label) {
          // Truncate long titles so the picker chrome stays tidy.
          nameEl.textContent = label.length > 38 ? label.slice(0, 36) + '…' : label;
          nameEl.setAttribute('title', label);
        }
      }, true);
    }
  }

  // ---- Phase 5: Export Plan ----
  // Weaves the user's goal (Soul) and the latest generated prompt (Body)
  // into a markdown plan and copies it to clipboard. Gated on Master Link
  // because the whole point of the bridge is the unified plan. Reads from
  // the live DOM so it stays in sync with whatever the user has typed or
  // generated — no shadow state.
  function wireExportPlan(root) {
    var btn = root.querySelector('#pmgv2-plan-export');
    var toast = root.querySelector('#pmgv2-plan-toast');
    if (!btn || !toast) return;

    function syncEnabled() {
      var on = document.documentElement.getAttribute('data-pmgv2-master-link') === 'on';
      btn.disabled = !on;
      btn.title = on
        ? 'Copy a markdown plan combining your goal and generated prompt'
        : 'Turn on Master Link to enable Copy Plan';
    }
    // Re-check whenever Master Link state changes.
    var mo = new MutationObserver(syncEnabled);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-pmgv2-master-link'] });
    syncEnabled();

    function readGoal() {
      var g = document.getElementById('goal');
      return (g && g.value || '').trim();
    }
    function readResult() {
      // Prefer the visible generated prompt copy area; fall back to the
      // result panel's text content if the legacy markup changes.
      var pre = document.querySelector('#result-panel pre, #result-panel .result-text, #result-panel textarea, #generatedPrompt');
      if (pre) return (pre.value || pre.textContent || '').trim();
      var rp = document.getElementById('result-panel');
      return rp ? (rp.textContent || '').trim() : '';
    }
    function buildPlan() {
      var goal = readGoal() || '_(empty — type a goal in the composer)_';
      var prompt = readResult() || '_(empty — generate a prompt first)_';
      var stamp = new Date().toISOString();
      return [
        '# PromptMeGood — Master Actionable Plan',
        '',
        '_Generated ' + stamp + '_',
        '',
        '## Soul (your goal)',
        '',
        goal,
        '',
        '## Body (generated prompt)',
        '',
        '```',
        prompt,
        '```',
        '',
        '## Next steps',
        '',
        '1. Paste the Body block into your AI tool of choice (ChatGPT, Claude, Gemini, Midjourney).',
        '2. Iterate by editing the Soul and re-running.',
        '3. Save winning variants to your Vault.',
        ''
      ].join('\n');
    }
    function flashToast(msg, ok) {
      toast.textContent = msg;
      toast.removeAttribute('hidden');
      toast.setAttribute('data-ok', ok ? '1' : '0');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toast.setAttribute('hidden', ''); }, 2200);
    }
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var plan = buildPlan();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plan).then(
          function () { flashToast('Copied to clipboard', true); },
          function () { fallbackCopy(plan); }
        );
      } else {
        fallbackCopy(plan);
      }
    });
    function fallbackCopy(text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        flashToast(ok ? 'Copied to clipboard' : 'Copy failed — select and ⌘C', ok);
      } catch (e) {
        flashToast('Copy failed — select and ⌘C', false);
      }
    }
  }

  // ---- Phase 5: Mobile dock ----
  // On ≤900px the body grid collapses to single column. Without a
  // switcher all three columns stack into one long page (the exact
  // legacy problem we're fixing). The dock pins to the bottom of the
  // viewport on mobile and toggles which column is visible by writing
  // `<html data-pmgv2-mobile-tab>`. Hidden on ≥901px via CSS.
  function wireMobileDock(root) {
    var TAB_KEY = 'pmgChassisV2:mobileTab';
    var dock = root.querySelector('.pmgv2-dock');
    if (!dock) return;
    var btns = dock.querySelectorAll('.pmgv2-dock-btn');
    function setTab(tab) {
      document.documentElement.setAttribute('data-pmgv2-mobile-tab', tab);
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-pressed',
          btns[i].getAttribute('data-pmgv2-tab') === tab ? 'true' : 'false');
      }
      try { localStorage.setItem(TAB_KEY, tab); } catch (e) {}
    }
    var initial;
    try { initial = localStorage.getItem(TAB_KEY); } catch (e) {}
    setTab(initial || 'thread');
    dock.addEventListener('click', function (e) {
      var b = e.target.closest('.pmgv2-dock-btn');
      if (b) setTab(b.getAttribute('data-pmgv2-tab'));
    });
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
      lab.textContent = on ? '⛓ Sync with Text Prompt · ON' : '⛓ Sync with Text Prompt · OFF';
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

  // Move the real hero headline + subtext from the legacy <main> into
  // the chassis hero slot. Same node = preserved SEO value, no duplicate
  // text in the DOM.
  function relocateHero() {
    var slot = document.querySelector('[data-pmgv2-hero-slot]');
    if (!slot || slot.getAttribute('data-pmgv2-hero-filled') === '1') return;
    var heading = document.querySelector('.hero-heading');
    var sub = document.querySelector('.hero-subtext-box');
    if (!heading) return;
    slot.appendChild(heading);
    if (sub) slot.appendChild(sub);
    slot.setAttribute('data-pmgv2-hero-filled', '1');
  }

  function relocateLegacy() {
    relocateHero();
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
    liftFormAuxIntoThread();
    return { moved: moved, pending: pending };
  }

  // ChatGPT-style composer: keep ONLY [Help Me Start + Goal field + Fix My
  // Prompt actions row] inside the composer-wrap so it stays a slim sticky
  // bar at the viewport bottom. Everything else in #prompt-form (Auto
  // Optimize toggle, Upload field, post-uc-guidance, tip-block, Prompt
  // Tuning Step 1, etc.) gets lifted into the thread above so it scrolls
  // naturally and never pushes the goal box off-screen.
  //
  // Safe because nothing in the codebase uses FormData(form) or
  // form.elements — every handler queries by ID. Verified May 2026.
  function liftFormAuxIntoThread() {
    var form = document.getElementById('prompt-form');
    if (!form) return;
    if (form.getAttribute('data-pmgv2-lifted') === '1') return;
    var thread = document.querySelector('.pmgv2-thread');
    if (!thread) return;

    // Build (or reuse) the lifted-aux container at the top of the thread.
    var aux = document.getElementById('pmgv2-form-aux');
    if (!aux) {
      aux = document.createElement('div');
      aux.id = 'pmgv2-form-aux';
      aux.className = 'pmgv2-form-aux';
      // Insert at the very top of the thread so the result-panel still
      // appears below it (post-generation flow stays intact).
      thread.insertBefore(aux, thread.firstChild);
    }

    // Anything that is NOT the goal field, the Fix My Prompt actions row,
    // or the Help Me Start callout (when injected) gets lifted up.
    var KEEP_IN_COMPOSER = function (el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.id === 'pmg-help-me-start-btn') return true;
      if (el.id === 'tour-step-generate') return true;
      if (el.classList && el.classList.contains('field-primary')) return true;
      // Goal field's parent .field.field-primary is the keep target. If
      // someone inlines the goal directly under the form, also keep it.
      if (el.id === 'goal') return true;
      return false;
    };

    var children = Array.prototype.slice.call(form.children);
    children.forEach(function (child) {
      if (KEEP_IN_COMPOSER(child)) return;
      // Move into aux; preserve original DOM order (append).
      aux.appendChild(child);
    });

    form.setAttribute('data-pmgv2-lifted', '1');
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
