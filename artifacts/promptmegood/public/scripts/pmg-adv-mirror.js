(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) return;

  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.has('noadvmirror')) return;
    if (localStorage.getItem('pmg_adv_mirror_disable') === '1') return;
  } catch (_) {}

  var FIELDS = [
    {
      mirrorId: 'pmg-adv-mirror-money',
      origId: 'moneyMode',
      title: 'Growth Mode',
      hint: 'Biases output toward sales, marketing, and conversion-focused phrasing. Turn off for neutral prompts.'
    },
    {
      mirrorId: 'pmg-adv-mirror-human',
      origId: 'humanTone',
      title: 'Human Voice Mode',
      hint: 'Adds natural phrasing and reduces obvious robotic patterns.'
    },
    {
      mirrorId: 'pmg-adv-mirror-clarity',
      origId: 'clarityBoost',
      title: 'Clarity Boost Mode',
      hint: 'Improves structure and makes the response easier to act on.'
    }
  ];

  var MOUNT_ID = 'pmg-adv-mirror';
  var STORAGE_KEY = 'pmg:advmirror:open';

  function buildMirrorHtml() {
    var rows = FIELDS.map(function (f) {
      return [
        '<div class="pmg-adv-mirror-row" data-mirror-row="', f.origId, '">',
          '<div class="pmg-adv-mirror-text">',
            '<strong>', f.title, '</strong>',
            '<span>', f.hint, '</span>',
          '</div>',
          '<label class="pmg-adv-mirror-switch" aria-label="Toggle ', f.title, '">',
            '<input type="checkbox" id="', f.mirrorId, '" data-mirror-of="', f.origId, '" />',
            '<span class="pmg-adv-mirror-slider"></span>',
          '</label>',
        '</div>'
      ].join('');
    }).join('');

    return [
      '<details class="pmg-adv-mirror-details" id="', MOUNT_ID, '-details">',
        '<summary class="pmg-adv-mirror-summary">',
          '<span class="pmg-adv-mirror-icon" aria-hidden="true">⚙️</span>',
          '<span class="pmg-adv-mirror-title-wrap">',
            '<span class="pmg-adv-mirror-title">Advanced Output Settings</span>',
            '<span class="pmg-adv-mirror-sub">Growth Mode, Human Voice, Clarity Boost</span>',
          '</span>',
          '<span class="pmg-adv-mirror-chev" aria-hidden="true">▾</span>',
        '</summary>',
        '<div class="pmg-adv-mirror-body">',
          '<p class="pmg-adv-mirror-intro">These options shape how strong, natural, and clear your prompt becomes. Synced with the same controls above the Build button.</p>',
          rows,
        '</div>',
      '</details>'
    ].join('');
  }

  /* adv-mirror-2: mount as a CHILD of #pmgv3-epic-tuning rather than as a
     sibling. Earlier sibling-insert ended up orphaned inside #prompt-form
     after pmg-ux.js's reorderForm() moved #settingsPanel around. Putting
     the mirror INSIDE epic-tuning means it travels with epic-tuning's
     life cycle no matter what reparents around it, and it still renders
     right after the "Who is this for?" field (the last child of
     epic-tuning). */
  function findMountTarget() {
    return document.getElementById('pmgv3-epic-tuning') || null;
  }

  var mounted = false;
  var origObservers = [];

  function syncMirrorFromOriginals() {
    FIELDS.forEach(function (f) {
      var orig = document.getElementById(f.origId);
      var mir = document.getElementById(f.mirrorId);
      if (orig && mir) mir.checked = !!orig.checked;
    });
  }

  function wireSync(wrap) {
    FIELDS.forEach(function (f) {
      var mir = wrap.querySelector('#' + f.mirrorId);
      if (!mir) return;
      mir.addEventListener('change', function () {
        var orig = document.getElementById(f.origId);
        if (!orig) return;
        if (orig.checked !== mir.checked) {
          orig.checked = mir.checked;
          try {
            orig.dispatchEvent(new Event('change', { bubbles: true }));
            orig.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (_) {}
        }
      });
      var orig = document.getElementById(f.origId);
      if (!orig) return;
      mir.checked = !!orig.checked;
      var listener = function () {
        if (mir.checked !== orig.checked) mir.checked = !!orig.checked;
      };
      orig.addEventListener('change', listener);
      orig.addEventListener('input', listener);
      try {
        var mo = new MutationObserver(function () {
          if (mir.checked !== orig.checked) mir.checked = !!orig.checked;
        });
        mo.observe(orig, { attributes: true, attributeFilter: ['checked'] });
        origObservers.push(mo);
      } catch (_) {}
    });
  }

  function persistOpenState(detailsEl) {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '1') detailsEl.open = true;
    } catch (_) {}
    detailsEl.addEventListener('toggle', function () {
      try { localStorage.setItem(STORAGE_KEY, detailsEl.open ? '1' : '0'); } catch (_) {}
    });
  }

  /* adv-mirror-3: The Money Mode Pro panel (id #pmg-mmpro-panel from
     pmg-money-mode-pro.js) mounts as a sibling of the ORIGINAL #moneyMode
     toggle row inside the legacy (hidden) #settingsPanel. Since the user
     now interacts with the mirror inside #pmgv3-epic-tuning, we relocate
     that single panel beneath the mirror's Growth Mode row so it surfaces
     where users can actually see it. We move (not clone) — there is only
     one panel and only one source of truth for its state. */
  function relocateMoneyModeProPanel() {
    var panel = document.getElementById('pmg-mmpro-panel');
    if (!panel) return false;
    var mirrorRow = document.querySelector(
      '#' + MOUNT_ID + ' .pmg-adv-mirror-row[data-mirror-row="moneyMode"]'
    );
    if (!mirrorRow || !mirrorRow.parentNode) return false;
    if (panel.previousElementSibling === mirrorRow) return true;
    mirrorRow.parentNode.insertBefore(panel, mirrorRow.nextSibling);
    panel.setAttribute('data-pmg-relocated-by', 'adv-mirror');
    return true;
  }

  function watchMoneyModeProPanel() {
    if (relocateMoneyModeProPanel()) return;
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (ticks > 60) { clearInterval(iv); return; }
      if (relocateMoneyModeProPanel()) clearInterval(iv);
    }, 250);
  }

  function tryMount() {
    if (mounted) {
      var existing = document.getElementById(MOUNT_ID);
      var epicNow = document.getElementById('pmgv3-epic-tuning');
      if (existing && epicNow && !epicNow.contains(existing)) {
        try { existing.parentNode.removeChild(existing); } catch (_) {}
        mounted = false;
      } else {
        return true;
      }
    }
    var existingNode = document.getElementById(MOUNT_ID);
    var target = findMountTarget();
    if (!target) return false;
    if (existingNode && target.contains(existingNode)) { mounted = true; return true; }
    if (existingNode && existingNode.parentNode) {
      try { existingNode.parentNode.removeChild(existingNode); } catch (_) {}
    }
    var wrap = document.createElement('div');
    wrap.id = MOUNT_ID;
    wrap.className = 'pmg-adv-mirror-wrap';
    wrap.innerHTML = buildMirrorHtml();
    target.appendChild(wrap);
    wireSync(wrap);
    var details = wrap.querySelector('#' + MOUNT_ID + '-details');
    if (details) persistOpenState(details);
    mounted = true;
    watchMoneyModeProPanel();
    return true;
  }

  function boot() {
    if (tryMount()) return;
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (tryMount() || ticks > 80) clearInterval(iv);
    }, 200);
    try {
      var mo = new MutationObserver(function () {
        if (tryMount()) {
          try { mo.disconnect(); } catch (_) {}
          clearInterval(iv);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (_) {} }, 20000);
    } catch (_) {}
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') syncMirrorFromOriginals();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
