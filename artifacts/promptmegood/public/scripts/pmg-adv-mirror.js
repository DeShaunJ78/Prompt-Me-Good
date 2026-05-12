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
        '<div class="pmg-adv-mirror-body" id="pmg-adv-mirror-body">',
          '<p class="pmg-adv-mirror-intro">These options shape how strong, natural, and clear your prompt becomes. Synced with the same controls above the Build button.</p>',
          rows,
          '<div class="pmg-adv-mirror-ecc-row">',
            '<button type="button" class="pmg-adv-mirror-ecc-btn" id="pmg-adv-mirror-ecc-open">',
              '<span aria-hidden="true">⚙</span> Open Expert Command Center',
            '</button>',
            '<span class="pmg-adv-mirror-ecc-hint">Pro deep-tuning &mdash; reasoning, persona, format, constraints, success criteria.</span>',
          '</div>',
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

  /* adv-mirror-4: The Money Mode Pro panel (#pmg-mmpro-panel from
     pmg-money-mode-pro.js) mounts as a sibling of the original #moneyMode
     toggle row inside the legacy #settingsPanel. We CLONE that panel
     beneath the mirror's Growth Mode row (id #pmg-mmpro-panel-mirror) and
     keep the two in two-way sync, the same way we mirror the three
     toggles. The original is left in place; the clone is wired to forward
     user actions (preset clicks, select changes, boost checkboxes,
     upgrade CTA, tooltip) to the original, and a MutationObserver on the
     original mirrors UI updates (locked state, is-active rows, feedback
     line) back to the clone. */
  var mmproWired = false;
  var mmproObserver = null;

  function ensureOriginalRestored(panel) {
    /* Undo the adv-mirror-3 move if it's still in effect from a stale
       cached script. */
    if (panel.getAttribute('data-pmg-relocated-by') !== 'adv-mirror') return;
    var moneyToggle = document.getElementById('moneyMode');
    var origRow = moneyToggle && moneyToggle.closest('.toggle-row');
    if (origRow && origRow.parentNode) {
      origRow.parentNode.insertBefore(panel, origRow.nextSibling);
    }
    panel.removeAttribute('data-pmg-relocated-by');
  }

  /* adv-mirror-7: also wrap the ORIGINAL #pmg-mmpro-panel in a collapsed
     <details> with the same "Show Pro options" summary, so the legacy
     Advanced Output Settings panel inside #settingsPanel matches the
     calm format we use in the mirror. The original panel stays in the
     same position in the DOM (just gets a wrapper around it), so the
     existing pmg-money-mode-pro.js logic continues to work unchanged. */
  function wrapOriginalIfNeeded(orig) {
    if (!orig || !orig.parentNode) return;
    if (orig.parentNode.id === 'pmg-mmpro-orig-collapse') return;
    var wrap = document.createElement('details');
    wrap.className = 'pmg-mmpro-mirror-collapse';
    wrap.id = 'pmg-mmpro-orig-collapse';
    var sum = document.createElement('summary');
    sum.className = 'pmg-mmpro-mirror-collapse-summary';
    sum.innerHTML =
      '<span class="pmg-mmpro-mirror-collapse-icon" aria-hidden="true">💰</span>' +
      '<span class="pmg-mmpro-mirror-collapse-title-wrap">' +
        '<span class="pmg-mmpro-mirror-collapse-title">Show Pro options</span>' +
        '<span class="pmg-mmpro-mirror-collapse-sub">Money Mode Pro &mdash; presets, focus, intensity, boosts</span>' +
      '</span>' +
      '<span class="pmg-mmpro-mirror-collapse-chev" aria-hidden="true">▾</span>';
    try {
      var stored = localStorage.getItem('pmg:advmirror:mmpro:orig:open');
      if (stored === '1') wrap.open = true;
    } catch (_) {}
    wrap.addEventListener('toggle', function () {
      try { localStorage.setItem('pmg:advmirror:mmpro:orig:open', wrap.open ? '1' : '0'); } catch (_) {}
    });
    orig.parentNode.insertBefore(wrap, orig);
    wrap.appendChild(sum);
    wrap.appendChild(orig);
    /* Auto-open when the user enables Money Mode so the panel is visible
       the moment it becomes relevant; user can collapse again afterwards. */
    var moneyToggle = document.getElementById('moneyMode');
    if (moneyToggle) {
      moneyToggle.addEventListener('change', function () {
        if (moneyToggle.checked && !wrap.open) wrap.open = true;
      });
      if (moneyToggle.checked) wrap.open = true;
    }
  }

  function mirrorMoneyModeProPanel() {
    var orig = document.getElementById('pmg-mmpro-panel');
    if (!orig) return false;
    var mirrorRow = document.querySelector(
      '#' + MOUNT_ID + ' .pmg-adv-mirror-row[data-mirror-row="moneyMode"]'
    );
    if (!mirrorRow || !mirrorRow.parentNode) return false;
    ensureOriginalRestored(orig);
    wrapOriginalIfNeeded(orig);
    if (document.getElementById('pmg-mmpro-panel-mirror')) return true;
    var clone = orig.cloneNode(true);
    clone.id = 'pmg-mmpro-panel-mirror';
    clone.setAttribute('data-pmg-mmpro-clone', '1');
    /* Suffix all child IDs and update <label for=> targets so the clone
       has no duplicate IDs in the document. */
    clone.querySelectorAll('[id]').forEach(function (el) {
      el.id = el.id + '-mirror';
    });
    clone.querySelectorAll('label[for]').forEach(function (l) {
      l.setAttribute('for', l.getAttribute('for') + '-mirror');
    });
    clone.querySelectorAll('[aria-controls]').forEach(function (el) {
      el.setAttribute('aria-controls', el.getAttribute('aria-controls') + '-mirror');
    });
    /* adv-mirror-6: wrap the cloned MMPro panel in a collapsed sub-<details>
       so the default Advanced Output Settings view stays short and matches
       the calm layout in the user's reference screenshot. The clone is
       still mounted (so sync wiring stays live) but the user opts in to
       see the dense Pro controls. */
    var sub = document.createElement('details');
    sub.className = 'pmg-mmpro-mirror-collapse';
    sub.id = 'pmg-mmpro-mirror-collapse';
    var sum = document.createElement('summary');
    sum.className = 'pmg-mmpro-mirror-collapse-summary';
    sum.innerHTML =
      '<span class="pmg-mmpro-mirror-collapse-icon" aria-hidden="true">💰</span>' +
      '<span class="pmg-mmpro-mirror-collapse-title-wrap">' +
        '<span class="pmg-mmpro-mirror-collapse-title">Show Pro options</span>' +
        '<span class="pmg-mmpro-mirror-collapse-sub">Money Mode Pro &mdash; presets, focus, intensity, boosts</span>' +
      '</span>' +
      '<span class="pmg-mmpro-mirror-collapse-chev" aria-hidden="true">▾</span>';
    sub.appendChild(sum);
    sub.appendChild(clone);
    /* Persist open state separately from the parent advmirror state. */
    try {
      var subStored = localStorage.getItem('pmg:advmirror:mmpro:open');
      if (subStored === '1') sub.open = true;
    } catch (_) {}
    sub.addEventListener('toggle', function () {
      try { localStorage.setItem('pmg:advmirror:mmpro:open', sub.open ? '1' : '0'); } catch (_) {}
    });
    mirrorRow.parentNode.insertBefore(sub, mirrorRow.nextSibling);
    wireMmproClone(orig, clone);
    return true;
  }

  function wireMmproClone(orig, clone) {
    /* Selects: forward value changes to the original. */
    clone.querySelectorAll('select[data-mmpro-field]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var origSel = orig.querySelector('select[data-mmpro-field="' + sel.dataset.mmproField + '"]');
        if (origSel && origSel.value !== sel.value) {
          origSel.value = sel.value;
          try { origSel.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        }
      });
    });
    /* Boost checkboxes: forward checked state. */
    clone.querySelectorAll('input[data-mmpro-boost]').forEach(function (input) {
      input.addEventListener('change', function () {
        var origInput = orig.querySelector('input[data-mmpro-boost="' + input.dataset.mmproBoost + '"]');
        if (origInput && origInput.checked !== input.checked) {
          origInput.checked = input.checked;
          try { origInput.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
        }
      });
    });
    /* Preset buttons: forward clicks to original presets. */
    clone.querySelectorAll('.pmg-mmpro-preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var origBtn = orig.querySelector('.pmg-mmpro-preset-btn[data-preset-id="' + btn.dataset.presetId + '"]');
        if (origBtn) origBtn.click();
      });
    });
    /* Tooltip toggle (clone-local — no need to forward). */
    var tipBtn = clone.querySelector('.pmg-mmpro-tooltip-toggle');
    var tipBody = clone.querySelector('.pmg-mmpro-tooltip-body');
    if (tipBtn && tipBody) {
      tipBtn.addEventListener('click', function () {
        var open = tipBody.hidden;
        tipBody.hidden = !open;
        tipBtn.setAttribute('aria-expanded', String(open));
        tipBtn.textContent = open ? 'Hide explanation' : 'What does this do?';
      });
    }
    /* Upgrade CTA in the locked overlay. */
    var lockCta = clone.querySelector('.pmg-mmpro-locked-cta');
    if (lockCta) {
      lockCta.addEventListener('click', function (e) {
        e.preventDefault();
        var origCta = orig.querySelector('.pmg-mmpro-locked-cta');
        if (origCta) origCta.click();
      });
    }

    function reflectToClone() {
      clone.classList.toggle('is-locked', orig.classList.contains('is-locked'));
      clone.querySelectorAll('select[data-mmpro-field]').forEach(function (sel) {
        var origSel = orig.querySelector('select[data-mmpro-field="' + sel.dataset.mmproField + '"]');
        if (origSel && origSel.value !== sel.value) sel.value = origSel.value;
      });
      clone.querySelectorAll('input[data-mmpro-boost]').forEach(function (input) {
        var id = input.dataset.mmproBoost;
        var origInput = orig.querySelector('input[data-mmpro-boost="' + id + '"]');
        if (origInput && origInput.checked !== input.checked) input.checked = origInput.checked;
        var origRow = orig.querySelector('[data-boost-id="' + id + '"]');
        var cloneRow = clone.querySelector('[data-boost-id="' + id + '"]');
        if (origRow && cloneRow) {
          cloneRow.classList.toggle('is-active', origRow.classList.contains('is-active'));
        }
      });
      var origFb = orig.querySelector('#pmg-mmpro-feedback');
      var cloneFb = clone.querySelector('#pmg-mmpro-feedback-mirror');
      if (origFb && cloneFb) {
        if (cloneFb.innerHTML !== origFb.innerHTML) cloneFb.innerHTML = origFb.innerHTML;
        if (cloneFb.className !== origFb.className) cloneFb.className = origFb.className;
      }
    }
    reflectToClone();
    try {
      mmproObserver = new MutationObserver(reflectToClone);
      mmproObserver.observe(orig, {
        subtree: true, attributes: true, childList: true, characterData: true,
        attributeFilter: ['class', 'checked', 'value']
      });
    } catch (_) {}
    /* Selects don't mutate attributes when their value changes, so also
       listen on the original for change events to push back to the clone. */
    orig.addEventListener('change', reflectToClone, true);
    mmproWired = true;
  }

  function watchMoneyModeProPanel() {
    if (mirrorMoneyModeProPanel()) return;
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (ticks > 60) { clearInterval(iv); return; }
      if (mirrorMoneyModeProPanel()) clearInterval(iv);
    }, 250);
  }

  function disconnectAllObservers() {
    /* Disconnect any observers from a previous mount so they don't
       accumulate on the originals across self-heals. */
    try {
      origObservers.forEach(function (mo) { try { mo.disconnect(); } catch (_) {} });
    } catch (_) {}
    origObservers = [];
    if (mmproObserver) {
      try { mmproObserver.disconnect(); } catch (_) {}
      mmproObserver = null;
    }
    mmproWired = false;
  }

  function tryMount() {
    if (mounted) {
      var existing = document.getElementById(MOUNT_ID);
      var epicNow = document.getElementById('pmgv3-epic-tuning');
      if (existing && epicNow && !epicNow.contains(existing)) {
        try { existing.parentNode.removeChild(existing); } catch (_) {}
        var staleSub = document.getElementById('pmg-mmpro-mirror-collapse');
        if (staleSub && staleSub.parentNode) {
          try { staleSub.parentNode.removeChild(staleSub); } catch (_) {}
        }
        var staleClone = document.getElementById('pmg-mmpro-panel-mirror');
        if (staleClone && staleClone.parentNode) {
          try { staleClone.parentNode.removeChild(staleClone); } catch (_) {}
        }
        disconnectAllObservers();
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
    wireEccOpen(wrap);
    var details = wrap.querySelector('#' + MOUNT_ID + '-details');
    if (details) persistOpenState(details);
    mounted = true;
    watchMoneyModeProPanel();
    return true;
  }

  /* adv-mirror-5: small entry-point button into the Expert Command Center.
     ECC is a separate paywalled panel that lives in pmg-expert-center.js.
     Per user request we just expose its open API here rather than cloning
     the whole panel inline. window.PMGExpertCenter.requestOpen() handles
     warning + paywall gating internally. */
  function wireEccOpen(wrap) {
    var btn = wrap.querySelector('#pmg-adv-mirror-ecc-open');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var api = window.PMGExpertCenter;
      if (api && typeof api.requestOpen === 'function') {
        try { api.requestOpen(); } catch (_) {}
      }
    });
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
