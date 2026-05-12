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

  // 4 main chips + 3 in the "More" popover.
  var MAIN = [
    { id: 'personality',   label: 'Personality' },
    { id: 'tone',          label: 'Tone' },
    { id: 'outputFormat',  label: 'Format' },
    { id: 'maxLength',     label: 'Length' }
  ];
  var MORE = [
    { id: 'category',       label: 'Category' },
    { id: 'skillLevel',     label: 'Experience' },
    { id: 'outputLanguage', label: 'Language' }
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

    MORE.forEach(function (def) {
      var sel = $(def.id);
      if (!sel) return;
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

  function openFullTuning() {
    document.body.classList.add('pmg-tune-section-shown');
    var toggle = $('tuning-mobile-toggle');
    if (toggle) {
      var section = toggle.closest('.tuning-section');
      if (section && !section.classList.contains('is-mobile-open')) {
        try { toggle.click(); } catch (_) {}
      }
    }
    injectDoneButton();
    var settings = $('settingsPanel');
    if (settings) {
      try {
        settings.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {
        settings.scrollIntoView();
      }
    }
  }

  function closeFullTuning() {
    document.body.classList.remove('pmg-tune-section-shown');
    var toggle = $('tuning-mobile-toggle');
    if (toggle) {
      var section = toggle.closest('.tuning-section');
      if (section && section.classList.contains('is-mobile-open')) {
        try { toggle.click(); } catch (_) {}
      }
    }
    var gen = $('generateBtn');
    if (gen) {
      try { gen.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (_) { gen.scrollIntoView(); }
      try { gen.focus({ preventScroll: true }); } catch (_) {}
      // Brief attention pulse on the primary CTA.
      gen.classList.add('pmg-cta-pulse');
      setTimeout(function () { gen.classList.remove('pmg-cta-pulse'); }, 1600);
    }
  }

  function injectDoneButton() {
    if (document.getElementById('pmg-tune-done')) return;
    // Find the .tuning-section that holds the live selects.
    var anySelect = $('personality') || $('tone') || $('outputFormat');
    var section = anySelect && anySelect.closest('.tuning-section');
    if (!section) return;
    var bar = document.createElement('div');
    bar.className = 'pmg-tune-done-bar';
    var done = document.createElement('button');
    done.type = 'button';
    done.id = 'pmg-tune-done';
    done.className = 'pmg-tune-done';
    done.innerHTML = '<span aria-hidden="true">✓</span> Done — back to Build';
    done.addEventListener('click', closeFullTuning);
    bar.appendChild(done);
    section.appendChild(bar);
  }

  // ─── Mount the chip row ─────────────────────────────────────────────────

  function mountRow() {
    if (rowEl && rowEl.isConnected) return true;
    var goal = $('goal');
    if (!goal) return false;
    // Make sure all selects exist before we render — some may be in the
    // process of being reparented by chassis-v3.
    for (var i = 0; i < MAIN.length; i++) {
      if (!$(MAIN[i].id)) return false;
    }

    rowEl = document.createElement('div');
    rowEl.className = 'pmg-chip-row';
    rowEl.setAttribute('role', 'group');
    rowEl.setAttribute('aria-label', 'Quick prompt tuning');
    rowEl.id = 'pmg-tune-chip-row';

    MAIN.forEach(function (def) {
      var c = makeChip(def);
      if (c) rowEl.appendChild(c);
    });

    // Only show "More" if at least one MORE select exists.
    var hasMore = MORE.some(function (def) { return !!$(def.id); });
    if (hasMore) {
      moreChipEl = makeMoreChip();
      rowEl.appendChild(moreChipEl);
    }

    // Tune & Build sits at the end of the chip row as a quiet ghost link.
    rowEl.appendChild(makeTuneAndBuildChip());

    // Mount as the immediate next sibling of the textarea, so the chips
    // sit directly under the input regardless of how chassis-v3 reparents
    // #goal. closest('.field') is unreliable here because the chassis can
    // hoist the textarea out of its original wrapper.
    if (goal.parentNode) {
      goal.parentNode.insertBefore(rowEl, goal.nextSibling);
    }

    document.body.classList.add('pmg-tune-chips-on');
    return true;
  }

  // ─── Boot ───────────────────────────────────────────────────────────────

  function tryBoot() {
    var ok = mountRow();
    return ok;
  }

  function boot() {
    if (tryBoot()) return;
    // Chassis v3 reparents and may build after DOMContentLoaded — poll
    // briefly. Same pattern as Photo Suite relocation.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (tryBoot() || tries >= 40) clearInterval(iv);
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
