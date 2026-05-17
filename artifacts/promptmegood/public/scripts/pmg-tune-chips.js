/* pmg-tune-chips.js — Quick-access tuning chips + "Tune & Build" sibling button.
 *
 * Two-way bound to the existing <select> elements at app.html L4580–L4659:
 *   #category, #skillLevel, #tone, #outputFormat, #maxLength,
 *   #outputLanguage, #personality.
 *
 * Source of truth = the underlying <select>. Chip click → opens popover
 * with a CLONE of the option list → user picks → set select.value + fire
 * a real `change` event so every existing listener (mux-1 mirror,
 * persistence, autoTuneFromIdea, etc.) reacts as if a native dropdown
 * had been used.
 *
 * The chip listens to `change` on its select, so when auto-tune (or any
 * other code) updates the select, the chip label updates too. Briefly
 * flashes is-just-updated so the user notices.
 *
 * Kill switches:
 *   - URL: ?nochips
 *   - localStorage.pmg_tune_chips_disable = '1'
 */
(function () {
  'use strict';

  // Kill switches
  try {
    var qs = (typeof location !== 'undefined' && location.search) || '';
    if (/[?&]nochips(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_tune_chips_disable') === '1') return;
  } catch (_) {}

  // IA-restructure-1: Personality renamed → "Voice" (the dropdown still
  // writes to the underlying #personality select). Tone moved into MORE
  // as a per-prompt knob users rarely tweak. Category/Experience/Language
  // are demoted into a "Your preferences (set once)" group inside MORE.
  var MAIN = [
    { id: 'personality',   label: 'Voice' },
    { id: 'outputFormat',  label: 'Format' },
    { id: 'maxLength',     label: 'Length' }
  ];
  var MORE = [
    { id: 'tone',           label: 'Tone',       group: 'prompt' },
    { id: 'category',       label: 'Category',   group: 'pref' },
    { id: 'skillLevel',     label: 'Experience', group: 'pref' },
    { id: 'outputLanguage', label: 'Language',   group: 'pref' }
  ];

  var openPopover = null;          // currently visible popover element
  var openPopoverChip = null;      // the chip that owns it
  var allChips = [];               // {id, chipEl, valueEl, select}
  var rowEl = null;
  var moreChipEl = null;

  // ─── Helpers ────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function selectLabelText(select) {
    if (!select) return '';
    var opt = select.options[select.selectedIndex];
    return opt ? opt.textContent.trim() : '';
  }

  function shortLabel(text, max) {
    if (!text) return '—';
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + '…';
  }

  function closePopover() {
    if (!openPopover) return;
    var pop = openPopover, chip = openPopoverChip;
    openPopover = null;
    openPopoverChip = null;
    pop.classList.remove('is-open');
    if (chip) chip.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    }, 150);
    document.removeEventListener('mousedown', onDocClickAway, true);
    document.removeEventListener('keydown', onDocKey, true);
    window.removeEventListener('resize', closePopover);
    window.removeEventListener('scroll', closePopover, true);
  }

  function onDocClickAway(e) {
    if (!openPopover) return;
    if (openPopover.contains(e.target)) return;
    if (openPopoverChip && openPopoverChip.contains(e.target)) return;
    closePopover();
  }

  function onDocKey(e) {
    if (e.key === 'Escape') {
      closePopover();
      if (openPopoverChip) try { openPopoverChip.focus(); } catch (_) {}
    }
  }

  function positionPopover(pop, anchor) {
    var r = anchor.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // First paint to measure
    pop.style.visibility = 'hidden';
    pop.style.left = '0px';
    pop.style.top = '0px';
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;
    var left = r.left;
    if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
    var top = r.bottom + 6;
    if (top + ph > vh - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
    pop.style.visibility = '';
  }

  function openChipPopover(chipEl, select, label) {
    if (openPopoverChip === chipEl) { closePopover(); return; }
    closePopover();

    var pop = document.createElement('div');
    pop.className = 'pmg-chip-pop';
    pop.setAttribute('role', 'listbox');
    pop.setAttribute('aria-label', label);
    pop.setAttribute('data-pmg-overlay-root', '');

    var title = document.createElement('span');
    title.className = 'pmg-chip-pop__title';
    title.textContent = label;
    pop.appendChild(title);

    var current = select.value;
    Array.prototype.forEach.call(select.options, function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-chip-pop__opt';
      b.setAttribute('role', 'option');
      b.textContent = opt.textContent;
      b.dataset.value = opt.value;
      if (opt.value === current) b.setAttribute('aria-selected', 'true');
      b.addEventListener('click', function () {
        if (select.value !== opt.value) {
          select.value = opt.value;
          // Fire real change event so every existing listener reacts.
          try {
            select.dispatchEvent(new Event('input',  { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {
            // Fallback for very old browsers — never reached in modern.
            var ev = document.createEvent('HTMLEvents');
            ev.initEvent('change', true, false);
            select.dispatchEvent(ev);
          }
        }
        closePopover();
      });
      pop.appendChild(b);
    });

    document.body.appendChild(pop);
    openPopover = pop;
    openPopoverChip = chipEl;
    chipEl.setAttribute('aria-expanded', 'true');

    positionPopover(pop, chipEl);
    // double-rAF so the transition fires
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { pop.classList.add('is-open'); });
    });

    // Focus the currently-selected option for keyboard nav.
    var selectedBtn = pop.querySelector('[aria-selected="true"]') ||
                      pop.querySelector('.pmg-chip-pop__opt');
    if (selectedBtn) try { selectedBtn.focus(); } catch (_) {}

    document.addEventListener('mousedown', onDocClickAway, true);
    document.addEventListener('keydown', onDocKey, true);
    window.addEventListener('resize', closePopover);
    window.addEventListener('scroll', closePopover, true);
  }

  function openMorePopover() {
    if (openPopoverChip === moreChipEl) { closePopover(); return; }
    closePopover();

    var pop = document.createElement('div');
    pop.className = 'pmg-chip-pop';
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', 'More tuning options');
    pop.setAttribute('data-pmg-overlay-root', '');

    var title = document.createElement('span');
    title.className = 'pmg-chip-pop__title';
    title.textContent = 'More tuning';
    pop.appendChild(title);

    // IA-restructure-1: render MORE in two zones — "Tune this prompt"
    // items first, then a quiet divider, then "Your preferences (set once)".
    var lastGroup = null;
    MORE.forEach(function (def) {
      var sel = $(def.id);
      if (!sel) return;
      var grp = def.group || 'prompt';
      if (grp !== lastGroup) {
        var hdr = document.createElement('div');
        hdr.className = 'pmg-chip-pop__group';
        hdr.textContent = (grp === 'pref')
          ? 'Your preferences · set once'
          : 'Tune this prompt';
        pop.appendChild(hdr);
        lastGroup = grp;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pmg-chip-pop__opt';
      b.setAttribute('role', 'menuitem');
      var labelText = selectLabelText(sel);
      b.innerHTML = '<span style="opacity:.7;font-weight:500;">' + def.label +
                    ': </span><span style="font-weight:700;">' +
                    shortLabel(labelText, 22) + '</span>';
      b.addEventListener('click', function () {
        closePopover();
        // small defer so popover unmount finishes before next opens
        setTimeout(function () {
          // Build a transient chip-anchor so positioning still works
          openChipPopover(moreChipEl, sel, def.label);
        }, 30);
      });
      pop.appendChild(b);
    });

    document.body.appendChild(pop);
    openPopover = pop;
    openPopoverChip = moreChipEl;
    moreChipEl.setAttribute('aria-expanded', 'true');

    positionPopover(pop, moreChipEl);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { pop.classList.add('is-open'); });
    });

    document.addEventListener('mousedown', onDocClickAway, true);
    document.addEventListener('keydown', onDocKey, true);
    window.addEventListener('resize', closePopover);
    window.addEventListener('scroll', closePopover, true);
  }

  // ─── Chip mount / sync ──────────────────────────────────────────────────

  function makeChip(def) {
    var sel = $(def.id);
    if (!sel) return null;
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pmg-chip';
    chip.setAttribute('aria-haspopup', 'listbox');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('data-pmg-chip', def.id);

    var labelEl = document.createElement('span');
    labelEl.className = 'pmg-chip__label';
    labelEl.textContent = def.label + ':';

    var valueEl = document.createElement('span');
    valueEl.className = 'pmg-chip__value';
    valueEl.textContent = shortLabel(selectLabelText(sel), 18);

    var caret = document.createElement('span');
    caret.className = 'pmg-chip__caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';

    chip.appendChild(labelEl);
    chip.appendChild(valueEl);
    chip.appendChild(caret);

    chip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openChipPopover(chip, sel, def.label);
    });

    // Two-way sync: when select changes (via auto-tune, persistence
    // restore, native UI inside the Tune section, etc.), update label
    // and flash to teach the user.
    sel.addEventListener('change', function () {
      var newLabel = shortLabel(selectLabelText(sel), 18);
      if (valueEl.textContent !== newLabel) {
        valueEl.textContent = newLabel;
        chip.classList.remove('is-just-updated');
        // force reflow so animation restarts
        void chip.offsetWidth;
        chip.classList.add('is-just-updated');
        setTimeout(function () { chip.classList.remove('is-just-updated'); }, 950);
      }
    });

    allChips.push({ id: def.id, chipEl: chip, valueEl: valueEl, select: sel });
    return chip;
  }

  function makeMoreChip() {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pmg-chip is-more';
    chip.setAttribute('aria-haspopup', 'menu');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-label', 'More tuning options');

    var label = document.createElement('span');
    label.className = 'pmg-chip__label';
    label.textContent = '+ ' + MORE.length + ' more';

    var caret = document.createElement('span');
    caret.className = 'pmg-chip__caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';

    chip.appendChild(label);
    chip.appendChild(caret);

    chip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openMorePopover();
    });
    return chip;
  }

  // ─── "Tune & Build" inline link + "Done" return button ──────────────────
  //
  // Tune & Build is intentionally NOT a sibling of #generateBtn. The only
  // big CTA is "Build My Prompt" — Tune & Build is a quiet ghost link
  // tucked into the chip row that opens the full tuning section. A "Done"
  // button lives at the bottom of the tuning section to send the user
  // back to the primary CTA once they've tweaked.

  function makeTuneAndBuildChip() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pmg-tune-and-build';
    btn.className = 'pmg-tune-and-build pmg-chip is-tune-build';
    btn.innerHTML = '<span aria-hidden="true">🎛️</span> Prompt Tuning';
    btn.title = 'Optional — open every tuning option';

    btn.addEventListener('click', function () {
      openFullTuning();
    });
    return btn;
  }

  // ─── tc-9p: Full-screen overlay for the Tune section ──────────────────
  // Replaces the tc-9n right-column relocation (which produced stacked
  // panels, missing Done buttons, and leaked CTAs into the result column
  // — see UX walkthrough notes in replit.md). Opening the Prompt Tuning
  // pill mounts a modal overlay (backdrop + panel) appended to <body>,
  // moves #tuning-panel into the overlay body, locks page scroll, and
  // gives the user ONE obvious "✓ Done — Build My Prompt" CTA in the
  // sticky footer. Closing puts #tuning-panel back where it came from.
  // Same flow on mobile and desktop — no layout fork, no relocation
  // safety nets, no top-vs-bottom button competition.
  var _overlayBackdrop = null;
  var _overlayPanel = null;
  var _overlayBody = null;
  var _tuneHomeParent = null;
  var _tuneHomeNext = null;
  var _bodyOverflowBefore = '';
  var _overlayKeydownArmed = false;

  function mountOverlay() {
    if (_overlayBackdrop) return;

    var backdrop = document.createElement('div');
    backdrop.id = 'pmg-tune-overlay';
    backdrop.className = 'pmg-tune-overlay';
    backdrop.setAttribute('data-pmg-overlay-root', '');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeOverlay(false);
    });

    var panel = document.createElement('div');
    panel.id = 'pmg-tune-overlay-panel';
    panel.className = 'pmg-tune-overlay-panel';
    panel.setAttribute('data-pmg-overlay-root', '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Tune Your Prompt');

    var hdr = document.createElement('div');
    hdr.className = 'pmg-tune-overlay-header';
    var title = document.createElement('div');
    title.className = 'pmg-tune-overlay-title';
    title.innerHTML = '<span aria-hidden="true">🎛️</span> Tune Your Prompt';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pmg-tune-overlay-close';
    closeBtn.setAttribute('aria-label', 'Close without building');
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', function () { closeOverlay(false); });
    hdr.appendChild(title);
    hdr.appendChild(closeBtn);

    var body = document.createElement('div');
    body.className = 'pmg-tune-overlay-body';

    var footer = document.createElement('div');
    footer.className = 'pmg-tune-overlay-footer';
    var ecc = document.createElement('button');
    ecc.type = 'button';
    ecc.id = 'pmg-tune-overlay-ecc';
    ecc.className = 'pmg-tune-ecc-link';
    ecc.innerHTML = '<span aria-hidden="true">⚙</span> Open Expert Command Center';
    ecc.addEventListener('click', openExpertCenter);
    var done = document.createElement('button');
    done.type = 'button';
    done.id = 'pmg-tune-overlay-done';
    done.className = 'pmg-tune-done pmg-tune-done--primary';
    done.innerHTML = '<span aria-hidden="true">✓</span> Done — Build My Prompt';
    done.addEventListener('click', function () { closeOverlay(true); });
    footer.appendChild(ecc);
    footer.appendChild(done);

    panel.appendChild(hdr);
    panel.appendChild(body);
    panel.appendChild(footer);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    _overlayBackdrop = backdrop;
    _overlayPanel = panel;
    _overlayBody = body;

    if (!_overlayKeydownArmed) {
      _overlayKeydownArmed = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!document.body.classList.contains('pmg-tune-overlay-open')) return;
        // Don't steal Esc from the chip popover — it owns its own handler.
        if (openPopover) return;
        e.preventDefault();
        closeOverlay(false);
      });
    }
  }

  function openOverlay() {
    mountOverlay();
    var panel = document.getElementById('tuning-panel');
    if (!panel || !_overlayBody) return;

    // Stash original DOM home — restored on close so the section returns
    // to its left-column slot for the next time the chassis renders it.
    if (!_tuneHomeParent && panel.parentNode && panel.parentNode !== _overlayBody) {
      _tuneHomeParent = panel.parentNode;
      _tuneHomeNext = panel.nextSibling;
    }

    if (panel.parentNode !== _overlayBody) {
      _overlayBody.appendChild(panel);
    }

    document.body.classList.add('pmg-tune-overlay-open');
    _bodyOverflowBefore = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    _overlayBackdrop.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (_overlayBackdrop) _overlayBackdrop.classList.add('is-open');
      });
    });
  }

  function closeOverlay(buildAfter) {
    document.body.classList.remove('pmg-tune-section-shown');
    document.body.classList.remove('pmg-tune-overlay-open');
    document.body.style.overflow = _bodyOverflowBefore || '';

    if (_overlayBackdrop) {
      _overlayBackdrop.classList.remove('is-open');
      _overlayBackdrop.setAttribute('aria-hidden', 'true');
    }

    var panel = document.getElementById('tuning-panel');
    if (panel && _tuneHomeParent && panel.parentNode !== _tuneHomeParent) {
      try {
        _tuneHomeParent.insertBefore(panel, _tuneHomeNext || null);
      } catch (_) {}
    }
    if (panel) {
      panel.classList.remove('is-mobile-open');
      // tc-9p: clear the inline display:block we set when opening, so
      // the hide-by-default CSS rule can take over once the panel is
      // back in its original spot. Otherwise the panel stays visible
      // in the left column after close (regression on stacked panels).
      panel.style.removeProperty('display');
      var toggle = $('tuning-mobile-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    if (buildAfter) {
      setTimeout(fireBuild, 60);
    }
  }

  function fireBuild() {
    var gen = $('generateBtn');
    if (!gen) return;
    gen.classList.add('pmg-cta-pulse');
    setTimeout(function () { gen.classList.remove('pmg-cta-pulse'); }, 1600);
    try { gen.click(); } catch (_) {}
  }

  function openFullTuning() {
    document.body.classList.add('pmg-tune-section-shown');
    // tc-9k: chassis-v3 boot runs a 4-second hideTick poller (every
    // 200ms × 20 ticks) that re-applies `display:none !important` to
    // #tuning-panel and #settingsPanel UNLESS body.pmgv3-analyzed is
    // set. We set the class so the chassis stops hiding the tuning
    // surface while the overlay owns it.
    document.body.classList.add('pmgv3-analyzed');
    var panel = document.getElementById('tuning-panel');
    if (panel) {
      // Force visibility via inline style — overlay's CSS will then
      // own layout once the panel is reparented into the overlay body.
      panel.style.setProperty('display', 'block', 'important');
      panel.removeAttribute('hidden');
      panel.classList.remove('is-collapsed');
      panel.classList.add('is-mobile-open');
      var toggle = $('tuning-mobile-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    var sp = document.getElementById('settingsPanel');
    if (sp) {
      sp.style.removeProperty('display');
      sp.removeAttribute('hidden');
      sp.removeAttribute('data-pmgv3-collapsed');
    }
    // tc-9p: still inject the bottom Done bar inside .tuning-section
    // so users who scroll all the way down inside the overlay see a
    // second Done CTA without having to scroll back up to the footer.
    injectDoneButton();
    // tc-9p: blur whatever has focus before opening so iOS doesn't
    // keep the virtual keyboard up over the modal.
    try {
      var goalEl = document.getElementById('goal');
      if (goalEl && goalEl.blur) goalEl.blur();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {}
    // tc-9p: open the modal overlay. Reparents #tuning-panel into the
    // overlay body and locks page scroll. Same code path on mobile and
    // desktop — no width-fork, no relocate-and-restore acrobatics.
    openOverlay();
  }

  function closeFullTuningAndBuild() {
    closeOverlay(true);
  }

  function openExpertCenter() {
    try {
      if (window.PMGExpertCenter && typeof window.PMGExpertCenter.requestOpen === 'function') {
        window.PMGExpertCenter.requestOpen();
        return;
      }
      if (window.PMGExpertCenter && typeof window.PMGExpertCenter.open === 'function') {
        window.PMGExpertCenter.open();
        return;
      }
    } catch (_) {}
    // Fallback: click any pre-existing entry point if the API isn't ready.
    var nav = document.getElementById('pmg-nav-expert-link') ||
              document.getElementById('expert-mode-link');
    if (nav) { try { nav.click(); } catch (_) {} }
  }

  function injectDoneButton() {
    // tc-9p: secondary Done bar appended INSIDE .tuning-section so
    // users who scroll the overlay body see a second exit without
    // having to scroll back up to the sticky footer. The overlay
    // footer is always-visible — this is just a polite belt-and-
    // suspenders for very tall tuning content. Idempotent.
    var section = (function () {
      var anySelect = $('personality') || $('tone') || $('outputFormat');
      return anySelect && anySelect.closest('.tuning-section');
    })();
    if (!section) return;
    if (document.getElementById('pmg-tune-done')) return;

    var bar = document.createElement('div');
    bar.className = 'pmg-tune-done-bar';

    // qm-15 follow-up (expert-dedupe-2): the orphan
    // "⚙ Open Expert Command Center" button that used to sit beside
    // Done was a fourth+ duplicate mention of Expert Command Center
    // inside the same overlay. The Expert section card already owns
    // the toggle switch — this bottom CTA is redundant. Removed.

    var done = document.createElement('button');
    done.type = 'button';
    done.id = 'pmg-tune-done';
    done.className = 'pmg-tune-done';
    done.innerHTML = '<span aria-hidden="true">✓</span> Done — Build My Prompt';
    done.addEventListener('click', closeFullTuningAndBuild);

    bar.appendChild(done);
    section.appendChild(bar);
  }

  // ─── Photo / Video panel ECC links ─────────────────────────────────────
  // Subtle "Open Expert Command Center" link appended to the bottom of
  // each panel's existing collapsed Advanced Tuning accordion. These
  // panels already have their own prompt-building flow — we just add a
  // way to escape into the power-user drawer without disrupting layout.

  function injectPanelEccLinks() {
    [
      'pmg-vs-image-adv-tuning-content',
      'pmg-vs-video-adv-tuning-content'
    ].forEach(function (hostId) {
      var host = document.getElementById(hostId);
      if (!host) return;
      var slotId = hostId + '-ecc';
      if (document.getElementById(slotId)) return;
      var slot = document.createElement('div');
      slot.id = slotId;
      slot.className = 'pmg-vs-ecc-slot';
      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'pmg-vs-ecc-link';
      link.innerHTML = '<span aria-hidden="true">⚙</span> Open Expert Command Center';
      link.title = 'Power-user controls (Founding / Pro)';
      link.addEventListener('click', openExpertCenter);
      slot.appendChild(link);
      host.appendChild(slot);
    });
  }

  // ─── Mount the chip row ─────────────────────────────────────────────────

  function mountRow() {
    if (document.getElementById('pmg-tune-and-build')) return true;
    var goal = $('goal');
    if (!goal) return false;
    // Make sure all selects exist before we render — some may be in the
    // process of being reparented by chassis-v3.
    for (var i = 0; i < MAIN.length; i++) {
      if (!$(MAIN[i].id)) return false;
    }

    var pill = makeTuneAndBuildChip();

    // Preferred mount: inside the existing voice/lang row so the pill
    // sits on the SAME line as Voice Input + en-US, right-aligned. This
    // avoids adding any new layout row and keeps the original "floor" of
    // the page intact.
    var voiceRow = document.querySelector('.pmg-voice-row[data-pmg-voice-for="goal"]');
    if (voiceRow) {
      pill.classList.add('is-in-voice-row');
      voiceRow.appendChild(pill);
      document.body.classList.add('pmg-tune-chips-on');
      return true;
    }

    // Fallback (voice script disabled / not yet mounted): drop a single
    // right-aligned wrapper directly after the textarea. Polling will
    // upgrade us into the voice row once it appears.
    rowEl = document.createElement('div');
    rowEl.className = 'pmg-chip-row pmg-chip-row--single';
    rowEl.setAttribute('role', 'group');
    rowEl.setAttribute('aria-label', 'Prompt tuning');
    rowEl.id = 'pmg-tune-chip-row';
    rowEl.appendChild(pill);
    if (goal.parentNode) {
      goal.parentNode.insertBefore(rowEl, goal.nextSibling);
    }

    document.body.classList.add('pmg-tune-chips-on');
    return true;
  }

  // After the voice row mounts later, migrate the pill into it and
  // discard the standalone fallback row.
  function relocateIntoVoiceRow() {
    var pill = document.getElementById('pmg-tune-and-build');
    if (!pill) return;
    if (pill.classList.contains('is-in-voice-row')) return;
    var voiceRow = document.querySelector('.pmg-voice-row[data-pmg-voice-for="goal"]');
    if (!voiceRow) return;
    pill.classList.add('is-in-voice-row');
    voiceRow.appendChild(pill);
    if (rowEl && rowEl.isConnected && !rowEl.children.length) {
      try { rowEl.remove(); } catch (_) {}
    }
  }

  // ─── Boot ───────────────────────────────────────────────────────────────

  function tryBoot() {
    var ok = mountRow();
    // Always attempt these — they're independent of the pill mount and
    // each has its own existence guard so they're safe to call repeatedly.
    relocateIntoVoiceRow();
    injectPanelEccLinks();
    armAutoOpenGuard();
    armPanelSwitchAutoClose();
    return ok;
  }

  // ─── Auto-open guard ────────────────────────────────────────────────────
  // The legacy chassis-v3 restoreSession() / Analyze flow can reveal
  // #tuning-panel by removing its inline display:none. Per latest UX,
  // the tuning panel must ONLY appear when the user explicitly clicks
  // the "Prompt Tuning" pill. This observer re-hides #tuning-panel any
  // time it gets revealed without our explicit opt-in flag.
  var _guardArmed = false;
  function armAutoOpenGuard() {
    if (_guardArmed) return;
    var panel = document.getElementById('tuning-panel');
    if (!panel) return;
    _guardArmed = true;
    // tc-9c: previously this guard set inline `display:none !important`
    // on #tuning-panel any time someone (chassis restoreSession,
    // Analyze flow, etc.) tried to show it without our opt-in flag.
    // The inline style then competed with openFullTuning() → the
    // panel sometimes appeared empty / scrolled past on mobile, and
    // the user landed on the empty-state placeholder.
    //
    // The CSS rule
    //   body.pmg-tune-chips-on:not(.pmg-tune-section-shown)
    //   .tuning-section { display:none !important }
    // already handles the "hide unless opted-in" job by itself. We
    // only need to keep the body class flag honest. So this guard is
    // reduced to a one-time cleanup: clear any stale inline display
    // that chassis init left behind, and let CSS do the rest.
    if (panel.style.getPropertyValue('display') === 'none') {
      panel.style.removeProperty('display');
    }
    panel.removeAttribute('hidden');
  }

  // Close the text tuning panel automatically whenever the user
  // switches away from the Text panel — keeps things tidy so coming
  // back to Text doesn't dump them straight into Tuning view.
  function armPanelSwitchAutoClose() {
    if (armPanelSwitchAutoClose._armed) return;
    // The active-panel attribute lives on `.pmgv3-body` inside the
    // chassis root, NOT on `document.body`. Guard against the chassis
    // not being built yet — the boot poller will retry.
    var pmgBody = document.querySelector('.pmgv3-body[data-active-panel]');
    if (!pmgBody) return;
    armPanelSwitchAutoClose._armed = true;
    var lastPanel = pmgBody.getAttribute('data-active-panel') || 'text';
    var closeIfNeeded = function () {
      if (!document.body.classList.contains('pmg-tune-section-shown') &&
          !document.body.classList.contains('pmg-tune-overlay-open')) return;
      // tc-9p: switching panels closes the overlay (no build).
      closeOverlay(false);
    };
    try {
      var mo = new MutationObserver(function () {
        var now = pmgBody.getAttribute('data-active-panel') || 'text';
        if (now === lastPanel) return;
        if (lastPanel === 'text' && now !== 'text') closeIfNeeded();
        lastPanel = now;
      });
      mo.observe(pmgBody, { attributes: true, attributeFilter: ['data-active-panel'] });
    } catch (_) {}
  }

  function boot() {
    tryBoot();
    // Chassis v3 reparents and pmg-voice mounts asynchronously — keep
    // polling so we can (a) finish the initial mount if it failed and
    // (b) UPGRADE the pill into the voice row once it appears, even if
    // we already mounted via the fallback row. Stops once everything is
    // settled or after ~10s.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tryBoot();
      var pill = document.getElementById('pmg-tune-and-build');
      var inVoice = pill && pill.classList.contains('is-in-voice-row');
      var imgEcc = document.getElementById('pmg-vs-image-adv-tuning-content-ecc');
      var vidEcc = document.getElementById('pmg-vs-video-adv-tuning-content-ecc');
      if ((inVoice && imgEcc && vidEcc) || tries >= 50) clearInterval(iv);
    }, 200);
  }

  /* ecc-apply-builds-1: expose minimal public API so ECC's Apply
     buttons can close the surrounding Tune overlay before firing
     Build. close(buildAfter) mirrors closeOverlay's signature. */
  window.pmgTuneChips = {
    close: function (buildAfter) {
      try { closeOverlay(!!buildAfter); } catch (_) {}
    },
    isOpen: function () {
      var ov = document.getElementById('pmg-tune-overlay');
      return !!(ov && ov.classList.contains('is-open'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
