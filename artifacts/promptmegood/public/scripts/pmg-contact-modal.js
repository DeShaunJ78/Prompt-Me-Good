/* pmg-contact-modal.js (cm-1)
 * Sitewide contact form delivered as a popup modal — no separate page nav.
 *
 * What it does:
 *   - Intercepts clicks on any <a href> that points at /contact.html
 *     (relative or absolute) and opens a modal containing the contact form.
 *   - Form posts to POST /api/contact (Zoho SMTP relay).
 *   - Plain-text support@promptmegood.com is shown inside the modal so
 *     visitors who prefer their own mail client can copy it.
 *   - /contact.html still works as a no-JS fallback page (direct visit only;
 *     not linked from any nav).
 *
 * Mirrors the visible structure of the standalone /contact.html page so
 * users see the same heading, lede, form, fineprint, and "Before you write"
 * pointers regardless of which surface they hit.
 *
 * Kill switches:
 *   - URL: ?contactModalKey=off
 *   - localStorage.pmg_contact_modal_disable = '1'
 */
(function () {
  'use strict';

  try {
    var u = new URL(window.location.href);
    if (u.searchParams.get('contactModalKey') === 'off') return;
    if (localStorage.getItem('pmg_contact_modal_disable') === '1') return;
  } catch (_) { /* ignore */ }

  var STYLE_ID = 'pmg-cm-style';
  var ROOT_ID = 'pmg-cm-root';
  var injected = false;
  var lastFocusedEl = null;

  var CSS = [
    '#' + ROOT_ID + ' { position:fixed; inset:0; z-index:2147483646; display:none; }',
    '#' + ROOT_ID + '[data-open="1"] { display:block; }',
    '#' + ROOT_ID + ' .pmg-cm-backdrop { position:absolute; inset:0; background:rgba(8,12,11,.72); backdrop-filter:blur(4px); }',
    '#' + ROOT_ID + ' .pmg-cm-dialog {',
    '  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);',
    '  width:min(560px, 92vw); max-height:88vh; overflow:auto;',
    '  background:#1c1b18; color:#ece9e2; border:1px solid #34312d;',
    '  border-radius:14px; padding:24px 22px 22px;',
    '  box-shadow:0 24px 60px rgba(0,0,0,.55); font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
    '}',
    '#' + ROOT_ID + ' .pmg-cm-close {',
    '  position:absolute; top:10px; right:12px; width:34px; height:34px;',
    '  border:none; background:transparent; color:#b9b4ab; font-size:24px; line-height:1;',
    '  cursor:pointer; border-radius:8px;',
    '}',
    '#' + ROOT_ID + ' .pmg-cm-close:hover { background:#2a2925; color:#ece9e2; }',
    '#' + ROOT_ID + ' h2.pmg-cm-title { margin:0 0 6px; font-size:1.5rem; color:#ece9e2; }',
    '#' + ROOT_ID + ' .pmg-cm-lede { color:#b9b4ab; margin:0 0 14px; font-size:0.95rem; }',
    '#' + ROOT_ID + ' .pmg-cm-form { display:grid; gap:12px; }',
    '#' + ROOT_ID + ' .pmg-cm-row { display:grid; gap:5px; }',
    '#' + ROOT_ID + ' .pmg-cm-row label { font-weight:600; font-size:0.9rem; color:#ece9e2; }',
    '#' + ROOT_ID + ' .pmg-cm-row input,',
    '#' + ROOT_ID + ' .pmg-cm-row select,',
    '#' + ROOT_ID + ' .pmg-cm-row textarea {',
    '  width:100%; padding:9px 11px; border:1px solid #34312d;',
    '  border-radius:9px; background:#151412; color:#ece9e2;',
    '  font:inherit; font-size:0.95rem; line-height:1.4;',
    '}',
    '#' + ROOT_ID + ' .pmg-cm-row input:focus,',
    '#' + ROOT_ID + ' .pmg-cm-row select:focus,',
    '#' + ROOT_ID + ' .pmg-cm-row textarea:focus {',
    '  outline:none; border-color:#5ba8b0; box-shadow:0 0 0 3px rgba(91,168,176,.25);',
    '}',
    '#' + ROOT_ID + ' .pmg-cm-row textarea { min-height:130px; resize:vertical; font-family:inherit; }',
    '#' + ROOT_ID + ' .pmg-cm-row small { color:#b9b4ab; font-size:0.82rem; }',
    '#' + ROOT_ID + ' .pmg-cm-honey { position:absolute; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none; }',
    '#' + ROOT_ID + ' .pmg-cm-submit {',
    '  padding:11px 20px; background:#5ba8b0; color:#0a1a1c; border:none;',
    '  border-radius:9px; font:inherit; font-weight:700; font-size:0.95rem;',
    '  cursor:pointer; transition:background .15s ease; justify-self:start; margin-top:4px;',
    '}',
    '#' + ROOT_ID + ' .pmg-cm-submit:hover:not(:disabled) { background:#73b8bf; }',
    '#' + ROOT_ID + ' .pmg-cm-submit:disabled { opacity:0.6; cursor:not-allowed; }',
    '#' + ROOT_ID + ' .pmg-cm-status { padding:10px 12px; border-radius:9px; font-size:0.92rem; display:none; margin:6px 0 0; }',
    '#' + ROOT_ID + ' .pmg-cm-status[data-state="ok"] { display:block; background:rgba(91,168,176,.15); border:1px solid #5ba8b0; color:#ece9e2; }',
    '#' + ROOT_ID + ' .pmg-cm-status[data-state="err"] { display:block; background:#5a1f1f; border:1px solid #9b3030; color:#ffe9e9; }',
    '#' + ROOT_ID + ' .pmg-cm-fineprint { color:#b9b4ab; font-size:0.85rem; margin:14px 0 4px; }',
    '#' + ROOT_ID + ' .pmg-cm-fineprint code { background:rgba(91,168,176,.12); padding:2px 6px; border-radius:4px; font-size:0.95em; color:#ece9e2; }',
    '#' + ROOT_ID + ' .pmg-cm-aside { margin:12px 0 0; padding-top:12px; border-top:1px solid #34312d; color:#b9b4ab; font-size:0.85rem; }',
    '#' + ROOT_ID + ' .pmg-cm-aside h3 { margin:0 0 4px; font-size:0.95rem; color:#ece9e2; font-weight:600; }',
    '#' + ROOT_ID + ' .pmg-cm-aside a { color:#5ba8b0; text-decoration:none; }',
    '#' + ROOT_ID + ' .pmg-cm-aside a:hover { text-decoration:underline; color:#73b8bf; }',
    '#' + ROOT_ID + ' details.pmg-cm-help { margin:14px 0 0; border:1px solid #34312d; border-radius:9px; background:rgba(91,168,176,.06); }',
    '#' + ROOT_ID + ' details.pmg-cm-help > summary { cursor:pointer; padding:10px 14px; font-weight:600; color:#5ba8b0; list-style:none; user-select:none; font-size:0.92rem; }',
    '#' + ROOT_ID + ' details.pmg-cm-help > summary::-webkit-details-marker { display:none; }',
    '#' + ROOT_ID + ' details.pmg-cm-help > summary::before { content:"\\25B8 "; display:inline-block; transition:transform .15s ease; margin-right:4px; }',
    '#' + ROOT_ID + ' details.pmg-cm-help[open] > summary::before { transform:rotate(90deg); }',
    '#' + ROOT_ID + ' details.pmg-cm-help > summary:hover { color:#73b8bf; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body { padding:4px 14px 14px; color:#b9b4ab; font-size:0.88rem; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body h4 { margin:10px 0 4px; font-size:0.9rem; color:#ece9e2; font-weight:600; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body ul { margin:0 0 6px; padding-left:18px; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body li { margin:0 0 4px; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body a { color:#5ba8b0; text-decoration:none; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body a:hover { text-decoration:underline; color:#73b8bf; }',
    '#' + ROOT_ID + ' .pmg-cm-help-body code { background:rgba(91,168,176,.12); padding:1px 5px; border-radius:4px; font-size:0.92em; color:#ece9e2; }',
    '@media (max-width:480px) {',
    '  #' + ROOT_ID + ' .pmg-cm-dialog { padding:20px 16px 18px; width:94vw; }',
    '}',
  ].join('\n');

  var HTML =
    '<div class="pmg-cm-backdrop" data-pmg-cm-dismiss="1"></div>' +
    '<div class="pmg-cm-dialog" role="dialog" aria-modal="true" aria-labelledby="pmg-cm-title">' +
      '<button type="button" class="pmg-cm-close" aria-label="Close" data-pmg-cm-dismiss="1">&times;</button>' +
      '<h2 id="pmg-cm-title" class="pmg-cm-title">Contact</h2>' +
      '<p class="pmg-cm-lede">We are a small team and we read every message. Most replies go out within 1\u20132 business days.</p>' +
      '<form class="pmg-cm-form" id="pmg-cm-form" novalidate>' +
        '<div class="pmg-cm-row">' +
          '<label for="pmg-cm-name">Your name</label>' +
          '<input id="pmg-cm-name" name="name" type="text" autocomplete="name" required maxlength="100" />' +
        '</div>' +
        '<div class="pmg-cm-row">' +
          '<label for="pmg-cm-email">Your email</label>' +
          '<input id="pmg-cm-email" name="email" type="email" autocomplete="email" required maxlength="254" />' +
          "<small>We'll only use this to reply to you.</small>" +
        '</div>' +
        '<div class="pmg-cm-row">' +
          '<label for="pmg-cm-subject">What\u2019s it about?</label>' +
          '<select id="pmg-cm-subject" name="subject">' +
            '<option value="General">General question</option>' +
            '<option value="Billing">Billing &amp; refunds</option>' +
            '<option value="Bug report">Bug report</option>' +
            '<option value="Feature request">Feature request</option>' +
            '<option value="Privacy request">Privacy / data request</option>' +
            '<option value="Press">Press / partnerships</option>' +
            '<option value="Other">Other</option>' +
          '</select>' +
        '</div>' +
        '<div class="pmg-cm-row">' +
          '<label for="pmg-cm-message">Your message</label>' +
          '<textarea id="pmg-cm-message" name="message" required minlength="10" maxlength="5000" placeholder="Tell us what\u2019s going on. The more detail, the better."></textarea>' +
        '</div>' +
        '<div class="pmg-cm-honey" aria-hidden="true">' +
          '<label for="pmg-cm-website">Website (leave empty)</label>' +
          '<input id="pmg-cm-website" name="website" type="text" tabindex="-1" autocomplete="off" />' +
        '</div>' +
        '<div id="pmg-cm-status" class="pmg-cm-status" role="status" aria-live="polite"></div>' +
        '<button type="submit" class="pmg-cm-submit" id="pmg-cm-submit-btn">Send message</button>' +
      '</form>' +
      '<p class="pmg-cm-fineprint">Prefer your own mail app? You can also write to us at <code>support@promptmegood.com</code>.</p>' +
      '<details class="pmg-cm-help">' +
        '<summary>Having issues? Try these fixes first</summary>' +
        '<div class="pmg-cm-help-body">' +
          '<h4>Tips that help us help you faster</h4>' +
          '<ul>' +
            '<li><strong>For bugs:</strong> include your browser, device, and the exact steps you took right before the issue. A screenshot or short screen recording is gold.</li>' +
            '<li><strong>For billing questions:</strong> include the email used at checkout and the date of purchase. We never ask for card details over email.</li>' +
            '<li><strong>For privacy / data deletion requests:</strong> send the email tied to your account so we can verify and act on it.</li>' +
            '<li><strong>App acting strange?</strong> Hard-refresh the page (<code>Ctrl/Cmd + Shift + R</code>). The workstation rebuilds itself on every reload, so this clears most stuck states.</li>' +
            '<li><strong>Generation stuck or empty?</strong> Check that your prompt has actual content in the goal box, then try Auto-Boost or switch panels (Text / Photography / Video) and back.</li>' +
          '</ul>' +
          '<h4>Pick the right subject above</h4>' +
          '<ul>' +
            '<li><strong>General:</strong> anything that does not fit the others.</li>' +
            '<li><strong>Billing &amp; refunds:</strong> charges, plan changes, cancellations.</li>' +
            '<li><strong>Bug report:</strong> something broken or behaving unexpectedly.</li>' +
            '<li><strong>Feature request:</strong> something you wish PromptMeGood did.</li>' +
            '<li><strong>Privacy / data request:</strong> account deletion, data export.</li>' +
            '<li><strong>Press / partnerships:</strong> media, integrations, collaborations.</li>' +
          '</ul>' +
          '<h4>Self-serve resources</h4>' +
          '<p>Many answers live in the <a href="/guide.html">Quick Start Guide</a> or the full <a href="/manual.html">User Manual</a>. Plan and pricing details are on the <a href="/pricing.html">Pricing page</a>; our policies are in <a href="/privacy.html">Privacy</a> and <a href="/terms.html">Terms</a>.</p>' +
        '</div>' +
      '</details>' +
    '</div>';

  function inject() {
    if (injected) return;
    injected = true;
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = HTML;
    document.body.appendChild(root);

    // Dismiss handlers (backdrop, close button)
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.getAttribute && t.getAttribute('data-pmg-cm-dismiss') === '1') {
        close();
      }
    });

    // Submit handler
    var form = root.querySelector('#pmg-cm-form');
    var statusEl = root.querySelector('#pmg-cm-status');
    var btn = root.querySelector('#pmg-cm-submit-btn');

    function setStatus(state, msg) {
      statusEl.setAttribute('data-state', state);
      statusEl.textContent = msg;
    }
    function clearStatus() {
      statusEl.removeAttribute('data-state');
      statusEl.textContent = '';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearStatus();
      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        subject: form.subject.value,
        message: form.message.value.trim(),
        website: form.website.value,
      };
      if (!data.name || !data.email || !data.message) {
        setStatus('err', 'Please fill in your name, email, and message.');
        return;
      }
      if (data.message.length < 10) {
        setStatus('err', 'Message is too short \u2014 please add a bit more detail.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.status === 200 && res.body && res.body.ok) {
            setStatus('ok', "Thanks \u2014 your message is on its way. We'll get back to you within 1\u20132 business days.");
            form.reset();
          } else if (res.status === 429) {
            setStatus('err', 'You have sent a few messages already. Please wait a few minutes and try again.');
          } else if (res.status === 503) {
            setStatus('err', 'Our email system is temporarily unavailable. Please try again in a few minutes, or write to support@promptmegood.com from your own mail app.');
          } else {
            var reason = (res.body && res.body.error) ? String(res.body.error).replace(/_/g, ' ') : 'something went wrong';
            setStatus('err', 'Could not send: ' + reason + '. Please try again, or write to support@promptmegood.com from your own mail app.');
          }
        })
        .catch(function () {
          setStatus('err', 'Network error \u2014 please check your connection and try again.');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Send message';
        });
    });
  }

  function isContactHref(href) {
    if (!href) return false;
    var s = href.trim();
    if (!s || s.charAt(0) === '#') return false;
    // Match: /contact.html, ./contact.html, contact.html, https://.../contact.html(?...|#...)
    return /(^|\/)contact\.html(?:[?#].*)?$/i.test(s);
  }

  function open() {
    inject();
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    lastFocusedEl = document.activeElement;
    root.setAttribute('data-open', '1');
    document.body.style.overflow = 'hidden';
    var firstField = root.querySelector('#pmg-cm-name');
    if (firstField) setTimeout(function () { firstField.focus(); }, 50);
    document.addEventListener('keydown', onKey);
  }

  function close() {
    var root = document.getElementById(ROOT_ID);
    if (root) root.removeAttribute('data-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      try { lastFocusedEl.focus(); } catch (_) {}
    }
  }

  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }

  // Click interception (capture phase so we beat any other handler).
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    if (!isContactHref(a.getAttribute('href'))) return;
    // Respect modifier-clicks (open in new tab) and explicit target=_blank.
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (a.target && a.target !== '' && a.target !== '_self') return;
    ev.preventDefault();
    open();
  }, true);

  // Expose for ad-hoc opens (e.g. inline buttons elsewhere) and tests.
  window.pmgContactModal = { open: open, close: close };
})();
