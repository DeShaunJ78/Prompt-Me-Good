/* =====================================================================
 * Send to PromptMeGood — background service worker (Manifest V3)
 *
 * Registers two context menu items:
 *   - "Send to PromptMeGood"  on text selections      → opens the web
 *                                                       app in TEXT mode
 *                                                       with the selection
 *                                                       prefilled in #goal.
 *   - "Send image to PromptMeGood" on images          → opens the web
 *                                                       app in IMAGE mode
 *                                                       with the image URL
 *                                                       captured as a
 *                                                       starting point.
 *
 * Handoff format
 *   The extension uses the same "#pmgshare=<base64url(JSON v=2)>" hash
 *   format that the web app's unified Share button (Task #56,
 *   pmg-share.js) already understands. JSON shape:
 *
 *     { v: 2, m: 'text' | 'image', g: <goal-text> }
 *
 *   The web app's existing parser (applyShareHash in pmg-share.js)
 *   reads "v", "m", and "g", switches mode if needed, and calls
 *   setFieldValue('goal', g) to prefill the textarea. No web-app
 *   changes are required.
 *
 * Settings
 *   The base URL is configurable via the popup and stored in
 *   chrome.storage.sync under key "pmg_base_url". Default is
 *   https://www.promptmegood.com/ — change it to your dev preview
 *   URL when testing locally.
 *
 * Cross-browser
 *   Uses the chrome.* API surface only. Firefox 121+ accepts the
 *   same MV3 service_worker entry; older Firefox builds will need
 *   the polyfilled WebExtensions browser.* alias.
 * ===================================================================== */

'use strict';

const DEFAULT_BASE_URL = 'https://www.promptmegood.com/';
const STORAGE_KEY      = 'pmg_base_url';

/* The web app already strips #builder/#goal on a fresh load (see
   index.html lines 24–42), but it whitelists #pmgshare so our
   handoff URL survives. We also pass the "extension" referrer flag
   in the JSON payload so the web app could (future) attribute the
   handoff source if it wants to. */

/* ------------------------------ helpers ------------------------------ */

/* Trim, normalise newlines, and cap to a reasonable size so we
   never produce a URL the browser will refuse. URL length limits
   vary (Chrome ~32k, Firefox ~64k); 8000 chars of post-base64
   payload is comfortably within everyone's tolerance and well
   beyond what someone would right-click as a prompt seed. */
const MAX_GOAL_CHARS = 8000;

function normaliseText(s) {
  if (s == null) return '';
  let v = String(s).replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
  /* Collapse runs of 3+ blank lines to 2 — keeps poetry/code-ish
     selections readable without bloating the URL. */
  v = v.replace(/\n{3,}/g, '\n\n');
  v = v.trim();
  if (v.length > MAX_GOAL_CHARS) {
    v = v.slice(0, MAX_GOAL_CHARS).trimEnd() + '\u2026';
  }
  return v;
}

/* Unicode-safe base64url encoder. Mirrors the toBase64Url() helper
   in pmg-share.js so the encoder and decoder stay in sync — if you
   change one, change the other. Service workers have TextEncoder
   available; the legacy escape() fallback is kept defensively in
   case of an exotic runtime. */
function toBase64Url(str) {
  let bytes;
  try {
    bytes = new TextEncoder().encode(str);
  } catch (_) {
    bytes = new Uint8Array(
      unescape(encodeURIComponent(str)).split('').map(function (c) {
        return c.charCodeAt(0);
      })
    );
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  /* btoa is available in Chrome MV3 service workers and Firefox
     event pages alike. */
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Build the final handoff URL. mode is 'text' or 'image'; goal is
   the seed text (the selection in text mode, or a short description
   referencing the image URL + source page in image mode). */
function buildHandoffUrl(baseUrl, mode, goal) {
  const payload = { v: 2, m: mode, g: normaliseText(goal), src: 'extension' };
  const hash = '#pmgshare=' + toBase64Url(JSON.stringify(payload));
  /* Strip any trailing #fragment from the configured base, then
     re-attach our own. Path/query are preserved so people can
     point at "https://example.com/promptmegood/?demo=1" if they
     want to. */
  let url;
  try {
    url = new URL(baseUrl);
    url.hash = '';
  } catch (_) {
    /* Fall back to a string concatenation if URL() refuses the
       configured value (older WebExtension runtimes can be picky
       about file:// or chrome-extension:// origins). */
    return String(baseUrl).replace(/#.*$/, '') + hash;
  }
  return url.toString().replace(/#.*$/, '') + hash;
}

/* Chrome.storage is callback-based on Chrome <100 and Firefox; the
   newer Promise form works on Chrome >=100. Wrap once so the rest
   of the file can `await getBaseUrl()` without caring. */
function getBaseUrl() {
  return new Promise(function (resolve) {
    try {
      chrome.storage.sync.get([STORAGE_KEY], function (items) {
        const v = items && items[STORAGE_KEY];
        if (typeof v === 'string' && v.trim()) resolve(v.trim());
        else resolve(DEFAULT_BASE_URL);
      });
    } catch (_) {
      resolve(DEFAULT_BASE_URL);
    }
  });
}

/* For image right-clicks we don't have a way to attach the binary
   file to the web app from a URL alone — and re-uploading bytes
   through the URL is not realistic given length limits. Instead,
   we hand off a clearly-formatted reference: the image URL and the
   page it came from. The user lands in Image mode with a sensible
   starting brief they can edit. This matches the task's "image as
   a starting point" spec without requiring backend changes. */
function buildImageGoal(imageUrl, pageUrl) {
  const lines = ['Recreate or build on this image:'];
  if (imageUrl) lines.push(imageUrl);
  if (pageUrl)  lines.push('Source: ' + pageUrl);
  return lines.join('\n');
}

/* ------------------------------ menus ------------------------------- */

/* IDs are exported so click-handler can dispatch on them. Using a
   single onClicked listener (rather than per-item) is the MV3
   pattern — service workers spin down between events and per-item
   listeners would not survive re-wakeup. */
const MENU_ID_TEXT  = 'pmg-send-text';
const MENU_ID_IMAGE = 'pmg-send-image';

function registerMenus() {
  /* removeAll → create avoids "duplicate id" errors on extension
     reload during development. */
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: MENU_ID_TEXT,
      title: 'Send to PromptMeGood',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: MENU_ID_IMAGE,
      title: 'Send image to PromptMeGood',
      contexts: ['image']
    });
  });
}

/* Both onInstalled and onStartup re-register so the menus survive
   a browser restart even if the service worker was unloaded. */
chrome.runtime.onInstalled.addListener(registerMenus);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(registerMenus);

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  try {
    const baseUrl = await getBaseUrl();
    let url = null;
    if (info.menuItemId === MENU_ID_TEXT) {
      const sel = (info.selectionText || '').trim();
      if (!sel) return;
      url = buildHandoffUrl(baseUrl, 'text', sel);
    } else if (info.menuItemId === MENU_ID_IMAGE) {
      const imageUrl = info.srcUrl || '';
      const pageUrl  = info.pageUrl || (tab && tab.url) || '';
      if (!imageUrl) return;
      url = buildHandoffUrl(baseUrl, 'image', buildImageGoal(imageUrl, pageUrl));
    }
    if (!url) return;
    /* Open the web app in a new tab next to the source page so the
       user can keep the inspiration on screen while they refine the
       prompt. openerTabId keeps Chrome's tab grouping intact. */
    const createOpts = { url: url, active: true };
    if (tab && typeof tab.id === 'number') createOpts.openerTabId = tab.id;
    chrome.tabs.create(createOpts);
  } catch (err) {
    /* A failure here would otherwise be invisible — log so a
       user/installer can see what happened in the service-worker
       console. The extension does NOT have host permissions on the
       source page, so we cannot show a page-level toast. */
    try { console.warn('[pmg-extension] handoff failed:', err); } catch (_) {}
  }
});

/* Expose a tiny API so the popup can read/write the base URL
   without duplicating the storage helpers. Popup messages use
   chrome.runtime.sendMessage / onMessage which works in both
   Chrome and Firefox MV3. */
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg || typeof msg.type !== 'string') return false;
  if (msg.type === 'pmg.getBaseUrl') {
    getBaseUrl().then(function (v) { sendResponse({ baseUrl: v }); });
    return true; /* keep message channel open for async sendResponse */
  }
  if (msg.type === 'pmg.setBaseUrl') {
    const next = (msg.baseUrl || '').trim() || DEFAULT_BASE_URL;
    /* Validate before persisting so a typo can't permanently
       break the menu. URL() throws on invalid; we additionally
       restrict the scheme to http/https so the menu can never
       open something exotic like javascript:, file:, or
       chrome-extension: into a new tab. */
    try {
      var parsed = new URL(next);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendResponse({ ok: false, error: 'URL must start with http:// or https://' });
        return true;
      }
    } catch (_) {
      sendResponse({ ok: false, error: 'Please enter a full URL, including https://' });
      return true;
    }
    chrome.storage.sync.set({ [STORAGE_KEY]: next }, function () {
      sendResponse({ ok: true, baseUrl: next });
    });
    return true;
  }
  return false;
});
