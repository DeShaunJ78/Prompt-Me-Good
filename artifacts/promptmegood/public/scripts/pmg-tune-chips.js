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

  // ─── tc-9n: Desktop-only right-column relocation ────────────────────
  // On desktop (≥769px), when the user opens Tune Your Prompt the
  // section physically moves into the right column (replacing the
  // empty-state placeholder / inspiration cards / current result while
  // open) so it sits side-by-side with the textarea + Build button —
  // no scrolling, no orphan bar at the bottom of the left column.
  // CSS does the visual reorder so the priority fields ("How Should
  // AI Think?" + "Who is this for?") surface BEFORE the dense pill
  // grid via flex `order`. Mobile (<769px) keeps the original inline
  // accordion flow — relocation is no-op below the breakpoint.
  var DESKTOP_TUNE_MQ = (window.matchMedia && window.matchMedia('(min-width: 769px)')) || null;
  var _tuneOriginalParent = null;
  var _tuneOriginalNext = null;
  function isDesktopTune() {
    return DESKTOP_TUNE_MQ ? DESKTOP_TUNE_MQ.matches : (window.innerWidth >= 769);
  }
  function findTextRightColumn() {
    return document.querySelector('.pmgv3-body[data-active-panel="text"] .pmgv3-right')
        || document.querySelector('#pmgv3-panel-text .pmgv3-right')
        || document.querySelector('.pmgv3-right');
  }
  function relocateTuningToRight() {
    if (!isDesktopTune()) return;
    var panel = document.getElementById('tuning-panel');
    if (!panel) return;
    var rightCol = findTextRightColumn();
    if (!rightCol) return;
    if (!_tuneOriginalParent && panel.parentNode && panel.parentNode !== rightCol) {
      _tuneOriginalParent = panel.parentNode;
      _tuneOriginalNext = panel.nextSibling;
    }
    if (panel.parentNode !== rightCol) {
      try { rightCol.insertBefore(panel, rightCol.firstChild); } catch (_) {}
    }
    document.body.classList.add('pmg-tune-desktop-right');
    armBuildSafetyNet();
  }

  // tc-9o: safety net for the "right column became a huge mess" bug.
  // The relocation hides EVERYTHING in .pmgv3-right except #tuning-panel
  // via `body.pmg-tune-desktop-right .pmgv3-right > *:not(#tuning-panel)
  // { display:none !important }`. If the user fires Build from anywhere
  // OTHER than our Done button (e.g. the legacy #generateBtn that still
  // lives in the left column), `closeFullTuningAndBuild()` never runs,
  // the body class never clears, and when the result arrives in
  // #resultBox the chassis tries to reveal it — but our hide rule is
  // still active. Some chassis paths bypass the rule with their own
  // `display:` overrides, leaking placeholder + result + tuning into
  // the same column at once. Two-layer defense:
  //   (a) Capture-phase click on any path to #generateBtn → restore
  //       BEFORE the click handler runs, so the result lands clean.
  //   (b) Body-class observer → if `pmg-has-result` ever flips on while
  //       we're still in `pmg-tune-desktop-right`, restore immediately.
  function armBuildSafetyNet() {
    if (armBuildSafetyNet._armed) return;
    armBuildSafetyNet._armed = true;
    var teardown = function () {
      if (!document.body.classList.contains('pmg-tune-desktop-right')) return;
      document.body.classList.remove('pmg-tune-section-shown');
      restoreTuningToLeft();
      var panel = document.getElementById('tuning-panel');
      if (panel) {
        panel.classList.remove('is-mobile-open');
        var toggle = $('tuning-mobile-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    };
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('pmg-tune-desktop-right')) return;
      var t = e.target;
      if (!t || !t.closest) return;
      // Only react to a real Build click — NOT our own Done button (it
      // already handles teardown via closeFullTuningAndBuild).
      var hit = t.closest('#generateBtn, #image-generate-btn, .btn-run-primary');
      if (!hit) return;
      if (t.closest('#pmg-tune-done, #pmg-tune-done-top')) return;
      teardown();
    }, true);
    try {
      var bodyObs = new MutationObserver(function () {
        if (!document.body.classList.contains('pmg-tune-desktop-right')) return;
        if (!document.body.classList.contains('pmg-has-result')) return;
        teardown();
      });
      bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {}
  }
  function restoreTuningToLeft() {
    document.body.classList.remove('pmg-tune-desktop-right');
    var panel = document.getElementById('tuning-panel');
    if (!panel || !_tuneOriginalParent) return;
    if (panel.parentNode !== _tuneOriginalParent) {
      try { _tuneOriginalParent.insertBefore(panel, _tuneOriginalNext || null); } catch (_) {}
    }
  }
  // Resize across the breakpoint while the panel is open: snap to the
  // correct home so the layout stays consistent.
  if (DESKTOP_TUNE_MQ) {
    var _onTuneMQChange = function () {
      if (!document.body.classList.contains('pmg-tune-section-shown')) return;
      if (DESKTOP_TUNE_MQ.matches) relocateTuningToRight();
      else restoreTuningToLeft();
    };
    try {
      if (DESKTOP_TUNE_MQ.addEventListener) DESKTOP_TUNE_MQ.addEventListener('change', _onTuneMQChange);
      else if (DESKTOP_TUNE_MQ.addListener) DESKTOP_TUNE_MQ.addListener(_onTuneMQChange);
    } catch (_) {}
  }

  function openFullTuning() {
    document.body.classList.add('pmg-tune-section-shown');
    // tc-9k: chassis-v3 boot runs a 4-second hideTick poller (every
    // 200ms × 20 ticks) that re-applies `display:none !important` to
    // #tuning-panel and #settingsPanel UNLESS body.pmgv3-analyzed is
    // set. Pre-Build that class is absent, so any reveal we do gets
    // overwritten ~200ms later. The Analyze handler sets the same
    // class — by setting it here we tell the chassis "user is past
    // intake, stop hiding the tuning surface." Without this, the pill
    // only worked reliably AFTER pressing Build (when Analyze had
    // already set the class). See pmg-chassis-v3.js L70-84.
    document.body.classList.add('pmgv3-analyzed');
    var panel = document.getElementById('tuning-panel');
    if (panel) {
      // Force visibility via INLINE style immediately. tc-9h: relying
      // on a CSS body-class rule alone meant the first click's scroll
      // could fire before the browser had committed the new computed
      // style — landing on a still-hidden panel — and the user had to
      // click twice. Inline display:block applies synchronously.
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
    injectDoneButton();
    // tc-9n: desktop only — move the section into the right column so
    // it sits side-by-side with the textarea + Build. No-op on mobile.
    relocateTuningToRight();
    var oldBackdrop = document.getElementById('pmg-tune-backdrop');
    if (oldBackdrop && oldBackdrop.parentNode) oldBackdrop.parentNode.removeChild(oldBackdrop);
    // tc-9j: explicitly blur the goal textarea — if it had focus, iOS
    // Safari kept the virtual keyboard up which (a) shrinks the visual
    // viewport (~400px) and (b) animates back to full height (~700px)
    // ~300-500ms after the textarea loses focus. If we scrolled during
    // that animation, the target position was wrong relative to the
    // post-keyboard viewport. This was the "only works after Build"
    // bug — post-Build the keyboard is already down.
    try {
      var goalEl = document.getElementById('goal');
      if (goalEl && goalEl.blur) goalEl.blur();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {}
    if (panel) {
      // eslint-disable-next-line no-unused-expressions
      panel.offsetHeight;
    }
    // tc-9l: unified scroll math with adv-mirror-8. Earlier per-container
    // scrollTop math worked on mobile (where window scroll is the right
    // axis) but landed wrong on desktop where the chassis has its own
    // inner scroller AND the topbar is sticky. Now we mirror the proven
    // adv-mirror logic: pick the right scroller by walking ancestors for
    // a real overflow:auto/scroll AND scrollHeight > clientHeight, then
    // shift by the delta needed to put the target 14px below the sticky
    // topbar's bottom edge. Same code path on desktop and mobile.
    var pickTuneScroller = function (el) {
      var node = el && el.parentNode;
      while (node && node !== document.body && node.nodeType === 1) {
        var cs;
        try { cs = window.getComputedStyle(node); } catch (_) { node = node.parentNode; continue; }
        var oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
          return node;
        }
        node = node.parentNode;
      }
      return window;
    };
    var doScroll = function () {
      var t = document.getElementById('tuning-panel') || document.getElementById('settingsPanel');
      if (!t) return;
      var topbar = document.querySelector('.pmgv3-topbar');
      var stickyBottom = 0;
      if (topbar) {
        var tbRect = topbar.getBoundingClientRect();
        if (tbRect.top <= 4 && tbRect.bottom > 0) stickyBottom = tbRect.bottom;
      }
      var desiredTop = stickyBottom + 14;
      var rect = t.getBoundingClientRect();
      var delta = rect.top - desiredTop;
      if (Math.abs(delta) < 12) return;
      var scroller = pickTuneScroller(t);
      var nextTop = (scroller === window
        ? (window.scrollY || window.pageYOffset || 0)
        : scroller.scrollTop) + delta;
      try {
        if (scroller === window) {
          window.scrollTo({ top: nextTop, behavior: 'smooth' });
        } else {
          scroller.scrollTo({ top: nextTop, behavior: 'smooth' });
        }
      } catch (_) {
        if (scroller === window) window.scrollTo(0, nextTop);
        else scroller.scrollTop = nextTop;
      }
    };
    // tc-9j: schedule three scrolls — one immediate (post-rAF, in case
    // the keyboard wasn't up), one at 550ms (after iOS keyboard
    // dismissal finishes), and one at 900ms (catches late field mounts
    // and any remaining viewport adjustment). Also re-aim on the next
    // visualViewport resize so we react to the keyboard going away
    // even if its timing differs from our schedule.
    requestAnimationFrame(function () { doScroll(); });
    setTimeout(doScroll, 550);
    setTimeout(doScroll, 900);
    try {
      if (window.visualViewport && !openFullTuning._vvBound) {
        openFullTuning._vvBound = true;
        var vv = window.visualViewport;
        var onResize = function () {
          if (document.body.classList.contains('pmg-tune-section-shown')) {
            doScroll();
          }
        };
        // One-shot per open: detach after first resize so we don't
        // hijack normal scroll once the panel is settled.
        var detach = function () {
          try { vv.removeEventListener('resize', wrapped); } catch (_) {}
          openFullTuning._vvBound = false;
        };
        var wrapped = function () { onResize(); setTimeout(detach, 100); };
        vv.addEventListener('resize', wrapped);
        // Safety: detach after 2s even if no resize fires.
        setTimeout(detach, 2000);
      }
    } catch (_) {}
  }

  function closeFullTuningAndBuild() {
    document.body.classList.remove('pmg-tune-section-shown');
    // tc-9n: put the section back in its original left-column home
    // BEFORE Build fires so the result has the right column to itself.
    restoreTuningToLeft();
    var panel = document.getElementById('tuning-panel');
    if (panel) {
      panel.classList.remove('is-mobile-open');
      var toggle = $('tuning-mobile-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    // Auto-fire Build My Prompt — the user has finished tuning, no
    // reason to make them click again.
    var gen = $('generateBtn');
    if (gen) {
      try { gen.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (_) { gen.scrollIntoView(); }
      gen.classList.add('pmg-cta-pulse');
      setTimeout(function () { gen.classList.remove('pmg-cta-pulse'); }, 1600);
      // Defer one tick so any pending change events on the selects
      // settle before submit.
      setTimeout(function () {
        try { gen.click(); } catch (_) {}
      }, 60);
    }
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
    // tc-9o: also inject a header-level "✓ Done — Build My Prompt"
    // button right inside `.tuning-header` so the user has an obvious
    // next-step CTA at the TOP of the relocated section. Hidden by
    // default; CSS in pmg-tune-chips.css shows it only when
    // `body.pmg-tune-desktop-right` is active. Without this, the only
    // CTA was the sticky bottom bar — which can sit below the fold
    // when the right column scrolls, leaving the user unsure what to
    // do next. Idempotent: early-out if both injections already exist.
    var section = (function () {
      var anySelect = $('personality') || $('tone') || $('outputFormat');
      return anySelect && anySelect.closest('.tuning-section');
    })();
    if (!section) return;

    if (!document.getElementById('pmg-tune-done-top')) {
      var hdr = section.querySelector('.tuning-header');
      if (hdr) {
        var topBtn = document.createElement('button');
        topBtn.type = 'button';
        topBtn.id = 'pmg-tune-done-top';
        topBtn.className = 'pmg-tune-done pmg-tune-done--top';
        topBtn.innerHTML = '<span aria-hidden="true">✓</span> Done — Build My Prompt';
        topBtn.addEventListener('click', closeFullTuningAndBuild);
        hdr.appendChild(topBtn);
      }
    }

    if (document.getElementById('pmg-tune-done')) return;

    var bar = document.createElement('div');
    bar.className = 'pmg-tune-done-bar';

    var ecc = document.createElement('button');
    ecc.type = 'button';
    ecc.id = 'pmg-tune-ecc-link';
    ecc.className = 'pmg-tune-ecc-link';
    ecc.innerHTML = '<span aria-hidden="true">⚙</span> Open Expert Command Center';
    ecc.title = 'Power-user controls (Founding / Pro)';
    ecc.addEventListener('click', openExpertCenter);

    var done = document.createElement('button');
    done.type = 'button';
    done.id = 'pmg-tune-done';
    done.className = 'pmg-tune-done';
    done.innerHTML = '<span aria-hidden="true">✓</span> Done — Build My Prompt';
    done.addEventListener('click', closeFullTuningAndBuild);

    bar.appendChild(ecc);
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
      if (!document.body.classList.contains('pmg-tune-section-shown')) return;
      document.body.classList.remove('pmg-tune-section-shown');
      // tc-9n: switching panels cleans up the desktop relocation too.
      restoreTuningToLeft();
      var panel = document.getElementById('tuning-panel');
      if (panel) {
        panel.classList.remove('is-mobile-open');
        var toggle = $('tuning-mobile-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
