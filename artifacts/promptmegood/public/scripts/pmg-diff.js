/* pmg-diff.js — show what changed (diff-1, 2026-05-17)
 *
 * Watches #goal, #resultBox, #aiResponseOutput and, when their text
 * changes PROGRAMMATICALLY (Auto-Boost, Rewrite, Quick Modes, ECC,
 * Edit, Run Again, etc. — NOT user keystrokes), renders a small
 * "what changed" bar above the element with:
 *
 *   ✨ <summary>     [Show changes ▾]
 *
 * Expanding the bar reveals a read-only word-diff view BELOW the
 * element: additions in green, deletions in dim red strike-through.
 *
 * The element itself is never mutated visually, so editing /
 * contenteditable / streaming are untouched.
 *
 * Detection heuristic:
 *   - On every 'input' / 'keydown' on the element, record now() as the
 *     last-keystroke timestamp.
 *   - On every observed value change (MutationObserver for
 *     contenteditable/streamed nodes, polling for textarea), if the
 *     change happened > KEYSTROKE_QUIET_MS after the last keystroke,
 *     treat it as programmatic.
 *   - For #aiResponseOutput (streamed): debounce with STREAM_QUIET_MS
 *     so we only fire diff once streaming stops.
 *
 * Kill switches:
 *   - ?nodiff
 *   - localStorage.pmg_diff_disable = '1'
 */
(function () {
  'use strict';

  // Kill switches.
  try {
    var url = new URL(window.location.href);
    if (url.searchParams.has('nodiff')) return;
    if (localStorage.getItem('pmg_diff_disable') === '1') return;
  } catch (_) {}

  var KEYSTROKE_QUIET_MS = 350; // change is programmatic if no keystroke in this window
  var POLL_MS            = 250;
  var STREAM_QUIET_MS    = 1500; // wait this long after last stream mutation to consider it "done"
  var MIN_DELTA_CHARS    = 3;   // ignore one-keystroke flickers
  var SUMMARY_MAX_CHARS  = 80;
  var WATCH = [
    { id: 'goal',             label: 'prompt',      mode: 'textarea' },
    { id: 'resultBox',        label: 'prompt',      mode: 'editable' },
    { id: 'aiResponseOutput', label: 'response',    mode: 'stream'   }
  ];

  // ---------- word-level LCS diff ----------
  function tokenize(s) {
    // Split keeping whitespace as tokens, so we can re-emit with original
    // spacing. Each token is either whitespace or a word/punctuation run.
    if (!s) return [];
    return s.match(/\s+|[^\s]+/g) || [];
  }
  function lcsDiff(a, b) {
    // Compact LCS to produce a list of ops: {type: 'eq'|'add'|'del', text}.
    // For very long inputs we bail to a coarser line-diff to keep this
    // O(n) instead of O(n^2).
    if (a.length * b.length > 250000) return coarseDiff(a, b);
    var n = a.length, m = b.length;
    var dp = new Array(n + 1);
    for (var i = 0; i <= n; i++) dp[i] = new Uint16Array(m + 1);
    for (i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        if (a[i] === b[j])      dp[i][j] = dp[i + 1][j + 1] + 1;
        else                    dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var ops = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j])                              { ops.push({ t: 'eq',  v: a[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1])          { ops.push({ t: 'del', v: a[i] }); i++; }
      else                                            { ops.push({ t: 'add', v: b[j] }); j++; }
    }
    while (i < n) { ops.push({ t: 'del', v: a[i++] }); }
    while (j < m) { ops.push({ t: 'add', v: b[j++] }); }
    return ops;
  }
  function coarseDiff(a, b) {
    // Fallback: collapse into a single del+add for very long content.
    return [
      { t: 'del', v: a.join('') },
      { t: 'add', v: b.join('') }
    ];
  }
  function renderDiffHtml(beforeText, afterText) {
    var ops = lcsDiff(tokenize(beforeText), tokenize(afterText));
    // Coalesce adjacent same-type ops to reduce DOM noise.
    var out = '';
    var buf = null;
    function flush() {
      if (!buf) return;
      var txt = escapeHtml(buf.v);
      if (buf.t === 'eq')       out += txt;
      else if (buf.t === 'add') out += '<ins class="pmg-diff__add">' + txt + '</ins>';
      else                      out += '<del class="pmg-diff__del">' + txt + '</del>';
      buf = null;
    }
    ops.forEach(function (op) {
      if (buf && buf.t === op.t) buf.v += op.v;
      else { flush(); buf = { t: op.t, v: op.v }; }
    });
    flush();
    return out;
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }

  // ---------- summary heuristics ----------
  function classify(before, after) {
    var bWords = (before.match(/\S+/g) || []).length;
    var aWords = (after.match(/\S+/g) || []).length;
    var dW     = aWords - bWords;
    var parts  = [];

    if (!before.trim()) {
      parts.push('First version (' + aWords + ' words)');
      return parts.join(', ').slice(0, SUMMARY_MAX_CHARS);
    }

    // Length direction.
    var pctDelta = bWords > 0 ? (aWords - bWords) / bWords : 0;
    if      (pctDelta <= -0.25) parts.push('tightened');
    else if (pctDelta >=  0.40) parts.push('expanded');

    // Named structural adds.
    var addedAudience = !/\bfor\s+(?:a |an |my |our |the )?\w+/i.test(before) &&
                         /\bfor\s+(?:a |an |my |our |the )?\w+/i.test(after);
    var addedFormat   = !/\bas\s+(?:a |an )\w+/i.test(before) &&
                         /\bas\s+(?:a |an )\w+/i.test(after);
    var addedList     = !/^\s*[-*•]|^\s*\d+\./m.test(before) &&
                         /^\s*[-*•]|^\s*\d+\./m.test(after);
    if (addedAudience) parts.push('added audience');
    if (addedFormat)   parts.push('added format');
    if (addedList)     parts.push('added structure');

    // Verb change at start.
    var bVerb = (before.trim().split(/\s+/)[0] || '').toLowerCase();
    var aVerb = (after.trim().split(/\s+/)[0]  || '').toLowerCase();
    if (bVerb && aVerb && bVerb !== aVerb && aVerb.length > 1) {
      parts.push('changed verb (' + aVerb + ')');
    }

    // Word count delta as fallback / supplement.
    if (parts.length === 0) {
      var sign = dW > 0 ? '+' : '';
      parts.push(sign + dW + ' words');
    } else if (Math.abs(dW) >= 5) {
      parts.push((dW > 0 ? '+' : '') + dW + 'w');
    }

    return parts.join(', ').slice(0, SUMMARY_MAX_CHARS);
  }

  // ---------- UI ----------
  function getCurrentText(el, mode) {
    if (!el) return '';
    if (mode === 'textarea') return el.value || '';
    return el.textContent || '';
  }
  function diffBarFor(targetId) {
    return document.getElementById('pmg-diff-bar-' + targetId);
  }
  function diffViewFor(targetId) {
    return document.getElementById('pmg-diff-view-' + targetId);
  }

  function ensureWidgets(el, cfg) {
    var existingBar = diffBarFor(cfg.id);
    if (existingBar && existingBar.isConnected) return { bar: existingBar, view: diffViewFor(cfg.id) };

    // (Re)build. Insert bar BEFORE el, view AFTER el.
    var bar = document.createElement('div');
    bar.id = 'pmg-diff-bar-' + cfg.id;
    bar.className = 'pmg-diff__bar';
    bar.hidden = true;
    bar.innerHTML =
      '<span class="pmg-diff__icon" aria-hidden="true">\u2728</span>' +
      '<span class="pmg-diff__summary" id="pmg-diff-summary-' + cfg.id + '"></span>' +
      '<button type="button" class="pmg-diff__toggle" id="pmg-diff-toggle-' + cfg.id +
        '" aria-expanded="false" aria-controls="pmg-diff-view-' + cfg.id + '">Show changes \u25BE</button>' +
      '<button type="button" class="pmg-diff__dismiss" id="pmg-diff-dismiss-' + cfg.id +
        '" aria-label="Dismiss change indicator" title="Dismiss">\u00D7</button>';

    var view = document.createElement('div');
    view.id = 'pmg-diff-view-' + cfg.id;
    view.className = 'pmg-diff__view';
    view.hidden = true;
    view.setAttribute('aria-live', 'polite');

    var parent = el.parentNode;
    if (!parent) return null;
    parent.insertBefore(bar, el);
    if (el.nextSibling) parent.insertBefore(view, el.nextSibling);
    else parent.appendChild(view);

    var toggle = bar.querySelector('.pmg-diff__toggle');
    toggle.addEventListener('click', function () {
      var open = !view.hidden;
      if (open) {
        view.hidden = true;
        toggle.textContent = 'Show changes \u25BE';
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        view.hidden = false;
        toggle.textContent = 'Hide changes \u25B4';
        toggle.setAttribute('aria-expanded', 'true');
        view.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    bar.querySelector('.pmg-diff__dismiss').addEventListener('click', function () {
      bar.hidden = true;
      view.hidden = true;
    });
    return { bar: bar, view: view };
  }

  function showDiff(el, cfg, beforeText, afterText) {
    if (!beforeText && !afterText) return;
    if (beforeText === afterText) return;
    var w = ensureWidgets(el, cfg);
    if (!w) return;
    var summary = classify(beforeText, afterText);
    var sumEl = document.getElementById('pmg-diff-summary-' + cfg.id);
    if (sumEl) sumEl.textContent = summary;
    w.view.innerHTML = renderDiffHtml(beforeText, afterText);
    w.bar.hidden = false;
    // Collapse the diff view on each new change so the bar isn't intrusive.
    w.view.hidden = true;
    var toggle = w.bar.querySelector('.pmg-diff__toggle');
    if (toggle) {
      toggle.textContent = 'Show changes \u25BE';
      toggle.setAttribute('aria-expanded', 'false');
    }
    // Brief pulse so the user notices.
    w.bar.classList.remove('pmg-diff__bar--pulse');
    /* force reflow then re-add */
    void w.bar.offsetWidth;
    w.bar.classList.add('pmg-diff__bar--pulse');
  }

  // ---------- watchers ----------
  function watchOne(cfg) {
    var el = document.getElementById(cfg.id);
    if (!el || el.__pmgDiffWired) return false;
    el.__pmgDiffWired = true;

    var lastValue       = getCurrentText(el, cfg.mode);
    var lastKeystrokeTs = 0;
    var streamTimer     = null;
    var streamSnapshot  = null; // for stream mode: the value at "stream start"

    // CRITICAL: only mark keystroke for REAL user events (event.isTrusted).
    // Many existing mutators (pmg-prompt-coach.js, pmg-auto-boost.js, the
    // ECC, Rewrite, Quick Modes) dispatch a synthetic 'input' event after
    // they set .value/.textContent so downstream listeners (chassis
    // session-save, char counter, strength bar, etc.) re-run. Those
    // synthetic events have isTrusted=false. Without this guard the diff
    // would be silently suppressed for nearly every programmatic rewrite.
    function markKeystroke(e) {
      if (e && e.isTrusted === false) return;
      lastKeystrokeTs = Date.now();
    }
    el.addEventListener('input',     markKeystroke, true);
    el.addEventListener('keydown',   markKeystroke, true);
    el.addEventListener('paste',     markKeystroke, true);
    el.addEventListener('cut',       markKeystroke, true);

    function check() {
      var current = getCurrentText(el, cfg.mode);
      if (current === lastValue) return;

      var now = Date.now();
      var recentlyTyped = (now - lastKeystrokeTs) < KEYSTROKE_QUIET_MS;
      var delta = Math.abs(current.length - lastValue.length);

      if (cfg.mode === 'stream') {
        // Streamed responses: track until the stream goes quiet.
        if (streamSnapshot == null) {
          // We're inside a new stream — the previous lastValue is our "before".
          streamSnapshot = lastValue;
        }
        if (streamTimer) clearTimeout(streamTimer);
        streamTimer = setTimeout(function () {
          var after = getCurrentText(el, cfg.mode);
          if (streamSnapshot != null && after && after !== streamSnapshot) {
            showDiff(el, cfg, streamSnapshot, after);
          }
          streamSnapshot = null;
          lastValue = after;
        }, STREAM_QUIET_MS);
        lastValue = current;
        return;
      }

      // Textarea / contenteditable: programmatic change?
      if (!recentlyTyped && delta >= MIN_DELTA_CHARS) {
        showDiff(el, cfg, lastValue, current);
      }
      lastValue = current;
    }

    if (cfg.mode === 'textarea') {
      setInterval(check, POLL_MS);
    } else {
      // contenteditable + streamed share a MutationObserver-based path.
      if ('MutationObserver' in window) {
        var mo = new MutationObserver(check);
        mo.observe(el, { childList: true, characterData: true, subtree: true });
      }
      setInterval(check, POLL_MS); // belt-and-suspenders for edge cases
    }
    return true;
  }

  function tryWatchAll() {
    WATCH.forEach(watchOne);
  }

  function boot() {
    tryWatchAll();
    // Re-attempt as chassis-v3 reparents and async panels mount.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tryWatchAll();
      if (tries > 60) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Public API for any mutator that wants to explicitly mark a change
  // (overrides the heuristic — useful if a future mutator types into the
  // textarea character-by-character and would otherwise look like typing).
  window.pmgDiff = {
    snapshot: function (id) {
      var el = document.getElementById(id);
      if (!el) return '';
      var cfg = WATCH.find(function (w) { return w.id === id; });
      return cfg ? getCurrentText(el, cfg.mode) : '';
    },
    show: function (id, beforeText, afterText) {
      var el = document.getElementById(id);
      var cfg = WATCH.find(function (w) { return w.id === id; });
      if (el && cfg) showDiff(el, cfg, beforeText, afterText);
    },
    dismiss: function (id) {
      var bar = diffBarFor(id);
      var view = diffViewFor(id);
      if (bar) bar.hidden = true;
      if (view) view.hidden = true;
    }
  };
})();
