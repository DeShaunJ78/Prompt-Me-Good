/* pmg-api-keys.js (ak-1, 2026-05-23)
 *
 * Spec 4 — Developer API. Manages the API-key UI on /api.html and also
 * injects a small "API Keys" entry link on /app.
 *
 * Kill switch: localStorage.pmg_api_keys_disable === '1'
 *
 * On /api.html (#pmg-ak-container present): renders sign-in prompt or the
 * key list + generate form. Talks to /api/developer/keys with the Supabase
 * JWT from window.supabaseClient.auth.getSession().
 *
 * Anywhere else (e.g. /app): silently injects a tiny "🔑 API Keys" link
 * into the chassis settings area pointing at /api.html (new tab). If the
 * settings anchor cannot be found, exits silently.
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('pmg_api_keys_disable') === '1') return;
  } catch (_) {}

  /* ---------- /app entry link ---------- */
  function mountAppEntryLink() {
    if (document.getElementById('pmg-ak-entry-link')) return;
    /* Prefer the Vault drawer header or the Expert / Vault buttons row.
       Fall back to any data-pmg-settings anchor. */
    var host =
      document.getElementById('pmgv3-vault') ||
      document.getElementById('pmgv3-expert') ||
      document.querySelector('[data-pmg-settings]');
    if (!host || !host.parentElement) {
      /* try again later — chassis may not be mounted yet */
      return false;
    }
    var a = document.createElement('a');
    a.id = 'pmg-ak-entry-link';
    a.href = '/api.html';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '🔑 API Keys';
    a.title = 'Manage Developer API keys';
    a.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;font-size:12px;' +
      'padding:6px 10px;margin-left:8px;border-radius:6px;' +
      'background:var(--color-surface-2);color:var(--color-primary);' +
      'border:1px solid var(--color-border);text-decoration:none;' +
      'font-weight:600;vertical-align:middle;';
    host.parentElement.insertBefore(a, host.nextSibling);
    return true;
  }

  function pollMountAppEntry() {
    if (mountAppEntryLink()) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (mountAppEntryLink() || tries > 30) clearInterval(t);
    }, 250);
  }

  /* ---------- /api.html UI ---------- */
  function relTime(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var diff = Date.now() - t;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
    if (diff < 30 * 86400000) return Math.floor(diff / 86400000) + ' days ago';
    try { return new Date(t).toLocaleDateString(); } catch (_) { return ''; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getSupabase() {
    return (typeof window !== 'undefined' && (window.supabaseClient || window.supabase)) || null;
  }

  async function getJwt() {
    var client = getSupabase();
    if (!client || !client.auth) return null;
    try {
      var r = await client.auth.getSession();
      var session = r && r.data && r.data.session;
      return (session && session.access_token) || null;
    } catch (_) { return null; }
  }

  async function api(path, opts) {
    var jwt = await getJwt();
    opts = opts || {};
    var headers = Object.assign(
      { 'Content-Type': 'application/json' },
      opts.headers || {},
      jwt ? { Authorization: 'Bearer ' + jwt } : {}
    );
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      var msg = (data && data.error) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function renderSignIn(container) {
    container.innerHTML =
      '<div class="pmg-ak-empty-sign-in">' +
        '<p>You must be signed in to manage API keys.</p>' +
        '<p><a href="/app" class="btn btn-primary">Sign in</a></p>' +
      '</div>';
  }

  function renderError(container, msg) {
    container.innerHTML =
      '<p class="pmg-ak-empty" role="alert">Couldn\'t load keys: ' +
      escapeHtml(msg) + '</p>';
  }

  function renderKeys(container, keys, newKeyBlock) {
    var listHtml;
    if (!keys.length) {
      listHtml =
        '<p class="pmg-ak-empty">No API keys yet. Generate one below.</p>';
    } else {
      listHtml = keys.map(function (k) {
        var lastUsed = k.lastUsedAt
          ? 'Last used ' + relTime(k.lastUsedAt)
          : 'Never used';
        return (
          '<div class="pmg-ak-row" data-id="' + escapeHtml(k.id) + '">' +
            '<div class="pmg-ak-row-info">' +
              '<span class="pmg-ak-label">' + escapeHtml(k.label) + '</span>' +
              '<code class="pmg-ak-prefix">' + escapeHtml(k.keyPrefix) + '</code>' +
              '<span class="pmg-ak-meta">Created ' + escapeHtml(relTime(k.createdAt)) +
                ' &middot; ' + escapeHtml(lastUsed) + '</span>' +
            '</div>' +
            '<button class="pmg-ak-revoke btn btn-secondary" type="button" ' +
              'data-id="' + escapeHtml(k.id) + '">Revoke</button>' +
          '</div>'
        );
      }).join('');
    }

    var formHtml =
      '<div class="pmg-ak-generate">' +
        '<input type="text" id="pmg-ak-label" placeholder="Key label (e.g. My App)" maxlength="64" />' +
        '<button id="pmg-ak-create" type="button" class="btn btn-primary">Generate Key</button>' +
      '</div>';

    container.innerHTML = listHtml + formHtml + (newKeyBlock || '');
  }

  async function loadAndRender(container) {
    container.innerHTML = '<p class="pmg-ak-empty">Loading…</p>';
    try {
      var data = await api('/api/developer/keys');
      renderKeys(container, (data && data.keys) || [], '');
    } catch (err) {
      renderError(container, err.message || 'unknown error');
    }
  }

  async function handleCreate(container) {
    var input = document.getElementById('pmg-ak-label');
    var label = (input && input.value || '').trim();
    if (!label) {
      if (input) input.focus();
      return;
    }
    var btn = document.getElementById('pmg-ak-create');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    try {
      var resp = await api('/api/developer/keys', { method: 'POST', body: { label: label } });
      var fullKey = resp && resp.key;
      var data = await api('/api/developer/keys');
      var newKeyBlock =
        '<div class="pmg-ak-new-key" role="alert">' +
          '<p class="pmg-ak-new-key-warning">⚠ Copy this key now. It won\'t be shown again.</p>' +
          '<code id="pmg-ak-key-display">' + escapeHtml(fullKey || '') + '</code>' +
          '<button id="pmg-ak-copy-key" type="button" class="btn btn-primary">Copy Key</button>' +
        '</div>';
      renderKeys(container, (data && data.keys) || [], newKeyBlock);
      var labelInput = document.getElementById('pmg-ak-label');
      if (labelInput) labelInput.value = '';
    } catch (err) {
      var b = document.getElementById('pmg-ak-create');
      if (b) { b.disabled = false; b.textContent = 'Generate Key'; }
      alert('Failed to generate key: ' + (err.message || 'unknown error'));
    }
  }

  async function handleRevoke(container, id) {
    if (!window.confirm('Revoke this key? It will stop working immediately.')) return;
    try {
      await api('/api/developer/keys/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadAndRender(container);
    } catch (err) {
      alert('Failed to revoke key: ' + (err.message || 'unknown error'));
    }
  }

  function handleCopyKey() {
    var el = document.getElementById('pmg-ak-key-display');
    var btn = document.getElementById('pmg-ak-copy-key');
    if (!el || !btn) return;
    var text = el.textContent || '';
    var done = function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = orig || 'Copy Key'; }, 2000);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          /* fallback below */
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    } catch (_) { fallbackCopy(text, done); }
  }

  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      cb && cb();
    } catch (_) { /* ignore */ }
  }

  function wireContainer(container) {
    container.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'pmg-ak-create') { e.preventDefault(); handleCreate(container); return; }
      if (t.id === 'pmg-ak-copy-key') { e.preventDefault(); handleCopyKey(); return; }
      if (t.classList && t.classList.contains('pmg-ak-revoke')) {
        e.preventDefault();
        var id = t.getAttribute('data-id');
        if (id) handleRevoke(container, id);
        return;
      }
    });
  }

  async function bootApiPage(container) {
    wireContainer(container);
    /* Supabase client may load slightly after this script; wait briefly. */
    var tries = 0;
    var waitForClient = function () {
      return new Promise(function (resolve) {
        var iv = setInterval(function () {
          tries++;
          if (getSupabase() || tries > 40) { clearInterval(iv); resolve(); }
        }, 100);
      });
    };
    await waitForClient();
    var jwt = await getJwt();
    if (!jwt) { renderSignIn(container); return; }
    await loadAndRender(container);
  }

  /* ---------- Boot ---------- */
  function boot() {
    var container = document.getElementById('pmg-ak-container');
    if (container) {
      bootApiPage(container);
    } else {
      pollMountAppEntry();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
