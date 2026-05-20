/* =============================================================================
 * pmg-entry-row.js (er-1, 2026-05-19) — v4 Master Spec §2.1
 * -----------------------------------------------------------------------------
 * Inserts a two-button "feature entry row" immediately above the chassis-v3
 * `#analyze-btn` (.btn-analyze) "✨ Build My Prompt" button. The two buttons
 * dispatch synthetic clicks on the existing topbar icons:
 *   • 💼 Growth Mode   → #pmgv3-business
 *   • ✦ Expert Center  → #pmgv3-expert
 *
 * All paywall logic is delegated to the underlying topbar handlers. Buttons
 * are ALWAYS visible — no lock icon. During the open beta the topbar icons
 * open normally; post-July-1 they fire the existing paywall card for free
 * users. We do not duplicate that logic here.
 *
 * Layout: side-by-side on ALL viewports (no stacking). Secondary outlined
 * style so it does NOT compete visually with the primary Build button.
 *
 * Kill switches:
 *   ?noentryrow   |   localStorage.pmg_entry_row_disable = '1'
 * ========================================================================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  try {
    var qs = (location && location.search) || '';
    if (/[?&]noentryrow(?:=|&|$)/.test(qs)) return;
    if (window.localStorage && localStorage.getItem('pmg_entry_row_disable') === '1') return;
  } catch (_) {}

  var MOUNTED = false;

  function ensureStyles() {
    if (document.getElementById('pmg-entry-row-styles')) return;
    var s = document.createElement('style');
    s.id = 'pmg-entry-row-styles';
    s.textContent =
      '.pmg-entry-row{' +
        'display:flex;flex-direction:row;align-items:stretch;gap:8px;' +
        'margin:0 0 16px 0;width:100%;' +
      '}' +
      '.pmg-entry-row__btn{' +
        'flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;' +
        'gap:6px;padding:10px 12px;min-height:44px;' +
        'border:1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);' +
        'border-radius:10px;' +
        'background:color-mix(in srgb, var(--color-primary) 8%, transparent);' +
        'color:var(--color-text);' +
        'font-size:14px;font-weight:600;line-height:1.2;' +
        'cursor:pointer;transition:background 160ms ease, border-color 160ms ease;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
      '}' +
      '.pmg-entry-row__btn:hover{' +
        'background:color-mix(in srgb, var(--color-primary) 14%, transparent);' +
        'border-color:color-mix(in srgb, var(--color-primary) 70%, transparent);' +
      '}' +
      '.pmg-entry-row__btn:focus-visible{' +
        'outline:none;box-shadow:0 0 0 2px color-mix(in srgb, var(--color-primary) 60%, transparent);' +
      '}' +
      '.pmg-entry-row__glyph{font-size:16px;line-height:1;}' +
      '@media (max-width: 430px){' +
        '.pmg-entry-row__btn{font-size:13px;padding:9px 8px;}' +
        '.pmg-entry-row__glyph{font-size:14px;}' +
      '}';
    document.head.appendChild(s);
  }

  function clickHidden(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    try { el.click(); return true; } catch (_) { return false; }
  }

  function wireExistingRow(row) {
    var growth = row.querySelector('[data-pmg-entry="growth"]');
    var expert = row.querySelector('[data-pmg-entry="expert"]');
    if (growth && !growth.__pmgEntryWired) {
      growth.__pmgEntryWired = true;
      growth.addEventListener('click', function (e) {
        e.preventDefault();
        clickHidden('pmgv3-business');
      });
    }
    if (expert && !expert.__pmgEntryWired) {
      expert.__pmgEntryWired = true;
      expert.addEventListener('click', function (e) {
        e.preventDefault();
        clickHidden('pmgv3-expert');
      });
    }
  }

  function build() {
    if (MOUNTED) return true;
    /* entry-row-inline-1 (2026-05-20): chassis-v3 now hard-codes
       #pmg-entry-row into its initial template (CLS fix). If the row
       is already in the DOM, just wire up the click handlers and
       skip the construction path entirely. */
    var existing = document.getElementById('pmg-entry-row');
    if (existing) {
      ensureStyles();
      wireExistingRow(existing);
      MOUNTED = true;
      return true;
    }
    var anchor = document.querySelector('#analyze-btn, .btn-analyze');
    if (!anchor || !anchor.parentNode) return false;

    ensureStyles();

    var row = document.createElement('div');
    row.id = 'pmg-entry-row';
    row.className = 'pmg-entry-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Open Growth Mode or Expert Center');

    var growth = document.createElement('button');
    growth.type = 'button';
    growth.className = 'pmg-entry-row__btn';
    growth.setAttribute('data-pmg-entry', 'growth');
    growth.setAttribute('aria-label', 'Open Growth Mode — full marketing suite');
    growth.innerHTML = '<span class="pmg-entry-row__glyph" aria-hidden="true">💼</span><span>Growth Mode</span>';
    growth.addEventListener('click', function (e) {
      e.preventDefault();
      clickHidden('pmgv3-business');
    });

    var expert = document.createElement('button');
    expert.type = 'button';
    expert.className = 'pmg-entry-row__btn';
    expert.setAttribute('data-pmg-entry', 'expert');
    expert.setAttribute('aria-label', 'Open Expert Command Center');
    expert.innerHTML = '<span class="pmg-entry-row__glyph" aria-hidden="true">✦</span><span>Expert Center</span>';
    expert.addEventListener('click', function (e) {
      e.preventDefault();
      clickHidden('pmgv3-expert');
    });

    row.appendChild(growth);
    row.appendChild(expert);
    anchor.parentNode.insertBefore(row, anchor);
    MOUNTED = true;
    return true;
  }

  function start() {
    if (build()) return;
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (build() || attempts > 60) clearInterval(iv);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
