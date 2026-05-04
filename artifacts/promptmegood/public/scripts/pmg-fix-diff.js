/* =============================================================
 * pmg-fix-diff.js  (Task #49)
 *
 * Google-Docs-style side-by-side diff for the "Fix My Prompt"
 * action. After a successful submit, renders:
 *
 *   • Side-by-side panels: "Original (Your Input)" on the left,
 *     "Suggested (Your Fixed Prompt)" on the right.
 *   • A list of structured edits — each edit is one optional
 *     line/block the prompt builder added, labeled with a short
 *     reason (e.g. "added a tone", "removed filler", "clarified
 *     audience"). Each edit has an Accept/Reject toggle.
 *   • An "Accept All" / "Reject All" pair that flips every
 *     toggle in one click.
 *   • A bottom summary recap that lists what got accepted and
 *     what got rejected.
 *
 * The result box (#resultBox) is rewritten from the diff state
 * whenever a toggle changes, so Copy / Run / Save / Strength
 * Score all read the user's accepted version automatically.
 *
 * Strict additive: never replaces the existing #resultBox, never
 * reroutes copy/run/save, never blocks form submit. If anything
 * inside the module throws, the page keeps working.
 *
 * Disable hatch: ?nofixdiff query param OR
 *                localStorage.pmg_fixdiff_disable = '1'.
 * ============================================================= */
(function () {
  'use strict';

  if (window.__pmgFixDiffInit) return;
  window.__pmgFixDiffInit = true;

  try {
    var qs = (window.location && window.location.search) || '';
    if (qs.indexOf('nofixdiff') !== -1) return;
    if (localStorage && localStorage.getItem('pmg_fixdiff_disable') === '1') return;
  } catch (_) {}

  var STYLE_ID = 'pmg-fix-diff-css';
  var ROOT_ID  = 'pmg-fix-diff';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#pmg-fix-diff { margin-top: var(--space-4, 16px); border: 1px solid var(--color-border); border-radius: var(--radius-lg, 14px); background: var(--color-surface); padding: var(--space-4, 16px); }',
      '#pmg-fix-diff[hidden] { display: none; }',
      '#pmg-fix-diff .pfd-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: var(--space-3, 12px); }',
      '#pmg-fix-diff .pfd-title { font-size: var(--text-sm, 14px); font-weight: 800; letter-spacing: 0.02em; color: var(--color-text); margin: 0; }',
      '#pmg-fix-diff .pfd-sub { font-size: 12px; color: var(--color-text-muted); margin: 2px 0 0; }',
      '#pmg-fix-diff .pfd-quick { display: inline-flex; gap: 6px; flex-wrap: wrap; }',
      '#pmg-fix-diff .pfd-quick button { font-size: 12px; font-weight: 700; padding: 8px 14px; min-height: 36px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text); cursor: pointer; transition: background 180ms ease, border-color 180ms ease, transform 180ms ease; }',
      '#pmg-fix-diff .pfd-quick button:hover, #pmg-fix-diff .pfd-quick button:focus-visible { background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)); border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border)); transform: translateY(-1px); outline: none; }',
      '#pmg-fix-diff .pfd-quick button.is-primary { background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); }',
      '#pmg-fix-diff .pfd-quick button.is-primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }',

      '#pmg-fix-diff .pfd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3, 12px); margin-bottom: var(--space-4, 16px); }',
      '@media (max-width: 720px) { #pmg-fix-diff .pfd-grid { grid-template-columns: 1fr; } }',
      '#pmg-fix-diff .pfd-col { display: flex; flex-direction: column; min-width: 0; }',
      '#pmg-fix-diff .pfd-col-head { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px; }',
      '#pmg-fix-diff .pfd-col-head .pfd-col-pip { width: 8px; height: 8px; border-radius: 999px; background: var(--color-text-faint); }',
      '#pmg-fix-diff .pfd-col.is-original .pfd-col-pip { background: color-mix(in srgb, var(--color-text-muted) 70%, transparent); }',
      '#pmg-fix-diff .pfd-col.is-suggested .pfd-col-pip { background: var(--color-primary); }',
      '#pmg-fix-diff .pfd-pane { background: color-mix(in srgb, var(--color-surface-2) 80%, transparent); border: 1px solid var(--color-divider); border-radius: var(--radius-md, 10px); padding: var(--space-3, 12px); font-size: 13px; line-height: 1.55; color: var(--color-text); white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; min-height: 80px; max-height: 260px; overflow: auto; font-family: var(--font-body); }',
      '#pmg-fix-diff .pfd-col.is-original .pfd-pane { color: var(--color-text-muted); }',
      '#pmg-fix-diff .pfd-pane mark.pfd-add { background: color-mix(in srgb, var(--color-primary) 18%, transparent); color: var(--color-text); border-radius: 4px; padding: 1px 4px; font-weight: 600; box-decoration-break: clone; -webkit-box-decoration-break: clone; }',
      '#pmg-fix-diff .pfd-pane .pfd-empty { color: var(--color-text-faint); font-style: italic; }',

      '#pmg-fix-diff .pfd-edits-title { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 8px; }',
      '#pmg-fix-diff .pfd-edits { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-3, 12px); }',
      '#pmg-fix-diff .pfd-edit { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start; padding: 10px 12px; border: 1px solid var(--color-divider); border-radius: var(--radius-md, 10px); background: var(--color-surface); transition: background 180ms ease, border-color 180ms ease; }',
      '#pmg-fix-diff .pfd-edit:hover { background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)); }',
      '#pmg-fix-diff .pfd-edit.is-rejected { background: color-mix(in srgb, var(--color-text-faint) 8%, var(--color-surface)); border-style: dashed; }',
      '#pmg-fix-diff .pfd-edit.is-rejected .pfd-edit-snippet { text-decoration: line-through; opacity: 0.55; }',
      '#pmg-fix-diff .pfd-edit-toggle { appearance: none; -webkit-appearance: none; width: 22px; height: 22px; border-radius: 5px; border: 1.5px solid var(--color-border); background: var(--color-surface); cursor: pointer; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; transition: background 150ms ease, border-color 150ms ease; flex: 0 0 auto; }',
      '#pmg-fix-diff .pfd-edit-toggle:checked { background: var(--color-primary); border-color: var(--color-primary); }',
      '#pmg-fix-diff .pfd-edit-toggle:checked::after { content: "✓"; color: var(--color-text-inverse); font-size: 14px; font-weight: 800; line-height: 1; }',
      '#pmg-fix-diff .pfd-edit-toggle:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }',
      '#pmg-fix-diff .pfd-edit-body { min-width: 0; }',
      '#pmg-fix-diff .pfd-edit-reason { font-size: 13px; font-weight: 700; color: var(--color-text); line-height: 1.35; }',
      '#pmg-fix-diff .pfd-edit-snippet { font-size: 12px; color: var(--color-text-muted); margin-top: 3px; line-height: 1.45; word-wrap: break-word; overflow-wrap: anywhere; }',
      '#pmg-fix-diff .pfd-edit-actions { display: inline-flex; gap: 6px; align-self: center; }',
      /* Inactive button is solid (not muted) so it never reads as
         disabled; it just sits opposite the highlighted active state. */
      '#pmg-fix-diff .pfd-edit-action { font-size: 12px; font-weight: 700; padding: 7px 14px; min-height: 36px; border-radius: 999px; border: 1.5px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text); cursor: pointer; transition: background 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease; }',
      '#pmg-fix-diff .pfd-edit-action:hover, #pmg-fix-diff .pfd-edit-action:focus-visible { background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-2)); border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); color: var(--color-text); outline: none; transform: translateY(-1px); }',
      '#pmg-fix-diff .pfd-edit.is-rejected .pfd-edit-action[data-act="reject"], #pmg-fix-diff .pfd-edit:not(.is-rejected) .pfd-edit-action[data-act="accept"] { background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }',

      '#pmg-fix-diff .pfd-summary { padding: 10px 12px; border-top: 1px dashed var(--color-divider); font-size: 12px; color: var(--color-text); line-height: 1.55; }',
      '#pmg-fix-diff .pfd-summary strong { color: var(--color-primary); font-weight: 800; }',
      '#pmg-fix-diff .pfd-summary .pfd-summary-list { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 6px; }',
      '#pmg-fix-diff .pfd-summary .pfd-summary-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: color-mix(in srgb, var(--color-primary) 14%, transparent); color: var(--color-primary); border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); }',
      '#pmg-fix-diff .pfd-summary .pfd-summary-pill.is-rejected { background: color-mix(in srgb, var(--color-text-faint) 14%, transparent); color: var(--color-text-muted); border-color: color-mix(in srgb, var(--color-text-faint) 25%, transparent); text-decoration: line-through; }',

      '#pmg-fix-diff .pfd-stale { display: none; padding: 8px 10px; margin-bottom: 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-text); border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); font-size: 12px; }',
      '#pmg-fix-diff.is-stale .pfd-stale { display: block; }',
      /* When stale, draw extra attention to the Re-apply button instead
         of dimming everything. Toggles must NEVER look disabled — they
         still work, and dimming them is the single biggest source of
         user friction here. */
      '#pmg-fix-diff.is-stale .pfd-quick button[data-act="apply"] { background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); animation: pfd-pulse 1.6s ease-in-out 0s 2; }',
      '@keyframes pfd-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 30%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-primary) 0%, transparent); } }',

      /* "Done Reviewing" footer — gives the user an explicit way to
         move on after they've toggled what they want. */
      '#pmg-fix-diff .pfd-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: var(--space-3, 12px); padding-top: var(--space-3, 12px); border-top: 1px solid var(--color-divider); }',
      '#pmg-fix-diff .pfd-footer-hint { font-size: 12px; color: var(--color-text-muted); margin: 0; }',
      '#pmg-fix-diff .pfd-done { font-size: 13px; font-weight: 800; padding: 10px 18px; min-height: 40px; border-radius: 999px; border: 1.5px solid var(--color-primary); background: var(--color-primary); color: var(--color-text-inverse); cursor: pointer; transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease; box-shadow: 0 1px 3px rgba(0,0,0,0.10); }',
      '#pmg-fix-diff .pfd-done:hover, #pmg-fix-diff .pfd-done:focus-visible { background: var(--color-primary-hover); transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.12); outline: none; }',
      '#pmg-fix-diff .pfd-done .pfd-done-arrow { display: inline-block; margin-left: 6px; transition: transform 180ms ease; }',
      '#pmg-fix-diff .pfd-done:hover .pfd-done-arrow { transform: translateX(3px); }',

      /* Mobile compaction (<=640px): the screenshot showed each
         Suggested Change card stretching to 8-10 lines because the
         3-column grid (checkbox + body + actions) squeezed the body
         column to ~50% of a 390px viewport, forcing the reason and
         snippet to wrap aggressively. The fix:
           1) Re-flow the card into 2 rows: row 1 = checkbox + body
              (body now spans the full remaining width), row 2 =
              Accept/Reject right-aligned. Body gets ~310px instead
              of ~150px, so reasons fit on 1-2 lines instead of 4-6.
           2) Clamp the snippet to 2 lines with line-clamp so a
              verbose snippet can't run on for 5+ lines.
           3) Cap the entire .pfd-edits list at 60vh with
              overflow-y so a 10-edit response can't dominate the
              page; users still see the count + Accept All / Reject
              All shortcuts above the scroll region.
           4) Tighten paddings and the Accept/Reject button height
              so each card is visually denser without losing the
              44px tap target on the underlying card hit-area. */
      '@media (max-width: 640px) {',
      '  #pmg-fix-diff .pfd-edits { max-height: 60vh; overflow-y: auto; padding-right: 4px; -webkit-overflow-scrolling: touch; }',
      '  #pmg-fix-diff .pfd-edit { grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 6px 8px; padding: 8px 10px; }',
      '  #pmg-fix-diff .pfd-edit-toggle { grid-row: 1; grid-column: 1; width: 20px; height: 20px; }',
      '  #pmg-fix-diff .pfd-edit-body { grid-row: 1; grid-column: 2; }',
      '  #pmg-fix-diff .pfd-edit-actions { grid-row: 2; grid-column: 1 / -1; justify-content: flex-end; align-self: stretch; }',
      '  #pmg-fix-diff .pfd-edit-reason { font-size: 13px; line-height: 1.3; }',
      '  #pmg-fix-diff .pfd-edit-snippet { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; }',
      '  #pmg-fix-diff .pfd-edit-action { font-size: 12px; padding: 6px 12px; min-height: 32px; }',
      '}',

      '@media (prefers-reduced-motion: reduce) { #pmg-fix-diff *, #pmg-fix-diff *::before, #pmg-fix-diff *::after { transition: none !important; animation: none !important; } }'
    ].join('\n');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* Highlight the lines in the suggested pane that came from edits.
     We do a line-by-line walk because the assembled prompt is multi-line
     plain text. Each accepted edit's `line` (with its bullet "- " when
     applicable) gets wrapped in <mark>. Header line is wrapped too. */
  function buildSuggestedHTML(state) {
    var prompt = state.assemble(state.accepted);
    if (!prompt) return '<span class="pfd-empty">No prompt yet — accept some changes above.</span>';
    var lines = prompt.split('\n');
    var addLines = {};
    state.diff.edits.forEach(function (e) {
      if (!state.accepted.has(e.id)) return;
      if (e.kind === 'directive') addLines['- ' + e.line] = true;
      else if (e.kind === 'context') addLines['- ' + e.line] = true;
      else if (e.kind === 'header') {
        // header line is the first line of the assembled prompt
        addLines[lines[0]] = true;
      }
      // 'block' kind covers multi-line trailing blocks; we mark each
      // line of the block individually.
      else if (e.kind === 'block') {
        e.line.split('\n').forEach(function (ln) { addLines[ln] = true; });
      }
    });
    return lines.map(function (ln) {
      if (addLines[ln]) return '<mark class="pfd-add">' + escHtml(ln) + '</mark>';
      return escHtml(ln) || '&nbsp;';
    }).join('<br>');
  }

  function buildOriginalHTML(original) {
    if (!original) return '<span class="pfd-empty">Nothing typed yet.</span>';
    return escHtml(original).replace(/\n/g, '<br>');
  }

  function buildEditsHTML(state) {
    return state.diff.edits.map(function (e) {
      var accepted = state.accepted.has(e.id);
      var snippet = e.line.split('\n')[0];
      if (e.line.indexOf('\n') !== -1) snippet += ' …';
      return (
        '<div class="pfd-edit' + (accepted ? '' : ' is-rejected') + '" data-edit-id="' + escHtml(e.id) + '">' +
          '<input type="checkbox" class="pfd-edit-toggle" ' +
            'aria-label="' + escHtml(accepted ? 'Reject change: ' : 'Accept change: ') + escHtml(e.reason) + '" ' +
            (accepted ? 'checked' : '') + ' />' +
          '<div class="pfd-edit-body">' +
            '<div class="pfd-edit-reason">' + escHtml(e.reason) + '</div>' +
            '<div class="pfd-edit-snippet">' + escHtml(snippet) + '</div>' +
          '</div>' +
          '<div class="pfd-edit-actions" role="group" aria-label="Accept or reject this change">' +
            '<button type="button" class="pfd-edit-action" data-act="accept">Accept</button>' +
            '<button type="button" class="pfd-edit-action" data-act="reject">Reject</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function buildSummaryHTML(state) {
    var accepted = [];
    var rejected = [];
    state.diff.edits.forEach(function (e) {
      if (state.accepted.has(e.id)) accepted.push(e);
      else rejected.push(e);
    });
    var total = state.diff.edits.length;
    var html = '<strong>' + accepted.length + ' of ' + total + ' changes accepted</strong>';
    if (accepted.length) {
      html += '<ul class="pfd-summary-list" aria-label="Accepted changes">';
      accepted.forEach(function (e) {
        html += '<li><span class="pfd-summary-pill">✓ ' + escHtml(e.label) + '</span></li>';
      });
      html += '</ul>';
    }
    if (rejected.length) {
      html += '<ul class="pfd-summary-list" aria-label="Rejected changes" style="margin-top:6px;">';
      rejected.forEach(function (e) {
        html += '<li><span class="pfd-summary-pill is-rejected">✗ ' + escHtml(e.label) + '</span></li>';
      });
      html += '</ul>';
    }
    return html;
  }

  function rebuildPane(state) {
    var root = state.root;
    if (!root) return;
    var sug = root.querySelector('.pfd-suggested-pane');
    var sum = root.querySelector('.pfd-summary');
    if (sug) sug.innerHTML = buildSuggestedHTML(state);
    if (sum) sum.innerHTML = buildSummaryHTML(state);
  }

  function rebuildAll(state) {
    var root = state.root;
    if (!root) return;
    var orig = root.querySelector('.pfd-original-pane');
    var ed = root.querySelector('.pfd-edits');
    if (orig) orig.innerHTML = buildOriginalHTML(state.diff.original);
    if (ed) ed.innerHTML = buildEditsHTML(state);
    rebuildPane(state);
  }

  function writeResultBox(state) {
    if (state.suppressOwnWrite) return;
    var box = document.getElementById('resultBox');
    if (!box) return;
    var newText = state.assemble(state.accepted);
    state.lastWritten = newText;
    state.suppressOwnWrite = true;
    try {
      // setPromptText is the canonical writer; if exposed, prefer it so
      // listeners that hook setPromptText (counters, indicators) fire.
      if (window.__pmgText && typeof window.__pmgText.setPromptText === 'function') {
        window.__pmgText.setPromptText(newText);
      } else {
        box.textContent = newText;
      }
    } finally {
      window.setTimeout(function () { state.suppressOwnWrite = false; }, 50);
    }
  }

  function setEditAccepted(state, id, accepted) {
    if (accepted) state.accepted.add(id);
    else state.accepted.delete(id);
    var row = state.root && state.root.querySelector('.pfd-edit[data-edit-id="' + cssEscape(id) + '"]');
    if (row) {
      row.classList.toggle('is-rejected', !accepted);
      var cb = row.querySelector('.pfd-edit-toggle');
      if (cb) cb.checked = accepted;
    }
    rebuildPane(state);
    writeResultBox(state);
    if (state.live) {
      state.live.textContent = (accepted ? 'Accepted: ' : 'Rejected: ') + (
        state.diff.edits.find(function (e) { return e.id === id; }) || { label: '' }
      ).label;
    }
  }

  function setAll(state, accepted) {
    state.diff.edits.forEach(function (e) {
      if (accepted) state.accepted.add(e.id);
      else state.accepted.delete(e.id);
    });
    rebuildAll(state);
    writeResultBox(state);
    if (state.live) {
      state.live.textContent = accepted ? 'Accepted all suggested changes.' : 'Rejected all suggested changes.';
    }
  }

  // CSS.escape shim — IDs come from a controlled set so this is mostly
  // defensive, but covers any ids with hyphens/underscores robustly.
  function cssEscape(s) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* Handlers read state from `root.__pmgState` on every event so a fresh
     submit (which replaces __pmgState) doesn't leave us mutating the
     previous render's diff. Closing over `state` would create a stale-
     closure bug: clicks after a 2nd Fix My Prompt would update the old
     edit set and write a stale prompt. */
  function attachHandlers(root) {
    function s() { return root.__pmgState; }
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('pfd-edit-toggle')) return;
      var row = t.closest('.pfd-edit');
      if (!row) return;
      var st = s(); if (!st) return;
      var id = row.getAttribute('data-edit-id');
      setEditAccepted(st, id, !!t.checked);
      st.markFresh();
    });
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      var st = s(); if (!st) return;
      /* Use closest() so clicks on inline children (icons, spans inside
         buttons — e.g. the arrow inside "Done Reviewing →") still
         register as the surrounding button. e.target.matches() alone
         would drop those clicks silently. */
      var rowAccept = t.closest && t.closest('.pfd-edit-action[data-act="accept"]');
      if (rowAccept) {
        var row = rowAccept.closest('.pfd-edit');
        if (row) {
          setEditAccepted(st, row.getAttribute('data-edit-id'), true);
          st.markFresh();
        }
        return;
      }
      var rowReject = t.closest && t.closest('.pfd-edit-action[data-act="reject"]');
      if (rowReject) {
        var row2 = rowReject.closest('.pfd-edit');
        if (row2) {
          setEditAccepted(st, row2.getAttribute('data-edit-id'), false);
          st.markFresh();
        }
        return;
      }
      if (t.closest && t.closest('button[data-act="accept-all"]')) {
        setAll(st, true);
        st.markFresh();
        return;
      }
      if (t.closest && t.closest('button[data-act="reject-all"]')) {
        setAll(st, false);
        st.markFresh();
        return;
      }
      if (t.closest && t.closest('button[data-act="apply"]')) {
        // Re-write the result box from the current state (useful after a
        // refine, AI rewrite, or manual edit invalidates it).
        writeResultBox(st);
        st.markFresh();
        return;
      }
      if (t.closest && t.closest('button[data-act="done"]')) {
        // Advance the user past the diff to the next meaningful section.
        // Prefer the "Run This Prompt" panel (added by pmg-postgen-actions),
        // then fall back to the Refine block, then "what next" / improve.
        var target = document.querySelector('.pmg-run-panel')
          || document.getElementById('improve-block')
          || document.getElementById('what-next')
          || document.getElementById('tour-step-finalize');
        if (target && typeof target.scrollIntoView === 'function') {
          var beh = (window.PMG_A11Y && window.PMG_A11Y.scrollBehavior && window.PMG_A11Y.scrollBehavior()) || 'smooth';
          try { target.scrollIntoView({ behavior: beh, block: 'start' }); } catch (_) {
            try { target.scrollIntoView(); } catch (__) {}
          }
        }
        if (st && st.live) st.live.textContent = 'Moved to the next step.';
        return;
      }
    });
  }

  function ensureRoot() {
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;
    var anchor = document.querySelector('#result-panel .result-wrap');
    if (!anchor) return null;
    var box = document.getElementById('resultBox');
    var root = document.createElement('section');
    root.id = ROOT_ID;
    root.setAttribute('aria-labelledby', 'pmg-fix-diff-title');
    root.hidden = true;
    root.innerHTML =
      '<div class="pfd-stale" role="status">The prompt above has changed since this review started. Your toggles below still work — tap <strong>Re-apply</strong> to update the prompt with only your accepted changes.</div>' +
      '<div class="pfd-head">' +
        '<div>' +
          '<h3 id="pmg-fix-diff-title" class="pfd-title">Review Changes</h3>' +
          '<p class="pfd-sub">Each change is one thing the prompt builder added. Accept or reject individually, or use the shortcuts.</p>' +
        '</div>' +
        '<div class="pfd-quick">' +
          '<button type="button" class="is-primary" data-act="accept-all">Accept All</button>' +
          '<button type="button" data-act="reject-all">Reject All</button>' +
          '<button type="button" data-act="apply" title="Re-write the prompt above using the current toggle state">Re-apply</button>' +
        '</div>' +
      '</div>' +
      '<div class="pfd-grid">' +
        '<div class="pfd-col is-original">' +
          '<div class="pfd-col-head"><span class="pfd-col-pip" aria-hidden="true"></span> Original (Your Input)</div>' +
          '<div class="pfd-pane pfd-original-pane"></div>' +
        '</div>' +
        '<div class="pfd-col is-suggested">' +
          '<div class="pfd-col-head"><span class="pfd-col-pip" aria-hidden="true"></span> Suggested (Fixed Prompt)</div>' +
          '<div class="pfd-pane pfd-suggested-pane"></div>' +
        '</div>' +
      '</div>' +
      '<p class="pfd-edits-title">Suggested Changes</p>' +
      '<div class="pfd-edits"></div>' +
      '<div class="pfd-summary" aria-live="polite"></div>' +
      '<div class="pfd-footer">' +
        '<p class="pfd-footer-hint">Toggle anything you want to keep or skip, then continue.</p>' +
        '<button type="button" class="pfd-done" data-act="done">Done Reviewing<span class="pfd-done-arrow" aria-hidden="true">→</span></button>' +
      '</div>' +
      '<span class="sr-only" data-live="diff" aria-live="polite"></span>';
    // Insert directly after the result box so it sits between the prompt
    // text and the existing "Refine Your Prompt" / "What Next" blocks.
    if (box && box.parentNode === anchor) {
      var nextSibling = box.nextSibling;
      // Skip the .result-edit-row that follows the box.
      while (nextSibling && nextSibling.nodeType === 1 && nextSibling.classList && nextSibling.classList.contains('result-edit-row')) {
        nextSibling = nextSibling.nextSibling;
      }
      anchor.insertBefore(root, nextSibling);
    } else {
      anchor.appendChild(root);
    }
    return root;
  }

  /* State + render entry point */
  function render(detail) {
    if (!window.__pmgText || typeof window.__pmgText.buildEdits !== 'function') return;
    var data = detail && detail.data;
    if (!data || typeof data !== 'object') return;
    var diff = window.__pmgText.buildEdits(data);
    if (!diff || !Array.isArray(diff.edits) || !diff.edits.length) return;

    injectStyles();
    var root = ensureRoot();
    if (!root) return;

    // Default: every edit accepted, matching what was just generated.
    var accepted = new Set(diff.edits.map(function (e) { return e.id; }));

    var state = {
      root: root,
      diff: diff,
      accepted: accepted,
      assemble: function (set) { return diff.assemble(set); },
      lastWritten: '',
      suppressOwnWrite: false,
      live: root.querySelector('[data-live="diff"]'),
      markFresh: function () { root.classList.remove('is-stale'); }
    };
    if (root.__pmgState && root.__pmgState.observer) {
      try { root.__pmgState.observer.disconnect(); } catch (_) {}
    }
    root.__pmgState = state;
    root.hidden = false;

    rebuildAll(state);
    state.lastWritten = state.assemble(state.accepted);

    if (!root.__pmgHandlersAttached) {
      attachHandlers(root);
      root.__pmgHandlersAttached = true;
    }

    /* AI-divergence guard: if the result box already shows a different
       prompt than what our diff would assemble (because the AI streaming
       path overwrote the local builder output before this event fired),
       mark the diff stale immediately so users know the toggles don't
       match what's currently in the box. They can hit "Re-apply" to
       overwrite with the structured version. */
    var box = document.getElementById('resultBox');
    if (box) {
      var current = (box.textContent || '').trim();
      if (current && current !== state.lastWritten.trim()) {
        root.classList.add('is-stale');
      }
    }

    /* Watch the result box for LATER external rewrites (refine, manual
       edit) and mark the diff stale. */
    if (box && 'MutationObserver' in window) {
      var observer = new MutationObserver(function () {
        var st = root.__pmgState;
        if (!st || st.suppressOwnWrite) return;
        var now = (box.textContent || '');
        if (now.trim() !== st.lastWritten.trim()) {
          root.classList.add('is-stale');
        }
      });
      observer.observe(box, { childList: true, subtree: true, characterData: true });
      state.observer = observer;
    }

    /* Anchor the user at the diff panel AFTER any other post-generate
       scrolls have settled. Other modules (improve-history, suggestion
       chips, etc.) scroll the page in the same tick. We retry twice to
       beat any late timer-based scrolls from other modules, but bail if
       the user has touched the page (wheel/touch/keydown) in the
       meantime — their intent always wins. */
    try {
      var userScrolled = false;
      var cancelers = ['wheel', 'touchstart', 'keydown', 'mousedown'];
      var onUserInput = function () { userScrolled = true; };
      cancelers.forEach(function (ev) {
        window.addEventListener(ev, onUserInput, { passive: true, once: true });
      });
      var detach = function () {
        cancelers.forEach(function (ev) {
          try { window.removeEventListener(ev, onUserInput); } catch (_) {}
        });
      };
      var landOnDiff = function () {
        if (root.hidden) { detach(); return; }
        if (userScrolled) { detach(); return; }
        try {
          var beh = (window.PMG_A11Y && window.PMG_A11Y.scrollBehavior && window.PMG_A11Y.scrollBehavior()) || 'smooth';
          root.scrollIntoView({ behavior: beh, block: 'start' });
        } catch (_) {
          try { root.scrollIntoView(); } catch (__) {}
        }
      };
      window.setTimeout(landOnDiff, 350);
      // Second attempt to beat late module scrolls; cleans up listeners.
      window.setTimeout(function () { landOnDiff(); detach(); }, 900);
    } catch (_) {}
  }

  document.addEventListener('pmg:builder-finalized', function (e) {
    try { render(e && e.detail); } catch (err) {
      try { console && console.warn && console.warn('[pmg-fix-diff] render failed', err); } catch (_) {}
    }
  });
})();
