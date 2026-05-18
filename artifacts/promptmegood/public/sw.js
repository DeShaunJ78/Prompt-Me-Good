/* PromptMeGood service worker
 * pwa-sw-1 (2026-05-18): Added so the PWA / "Add to Home Screen" shortcut
 * launches instantly on repeat opens. Without this, every launch was a
 * cold fetch of ~1MB of JS (pmg-ux.js alone is ~800KB).
 *
 * Strategy:
 *   - HTML  → network-first with cache fallback. Always try fresh first so
 *             a redeploy is visible immediately. Falls back to cache if
 *             offline / on a slow network.
 *   - /scripts/, /styles/, /assets/, /images/, /fonts/, /brand/
 *           → stale-while-revalidate. Serve cached copy INSTANTLY, fetch
 *             a fresh copy in the background to update the cache for next
 *             time. Repeat opens render with zero network wait on assets.
 *   - /api/, cross-origin, non-GET → never intercept. The server owns those.
 *
 * Versioning: bump CACHE_VERSION to invalidate every cached asset and
 * force fresh downloads on next visit. Old caches are deleted on activate.
 */
const CACHE_VERSION = 'pmg-v1-2026-05-18';
const HTML_CACHE = `${CACHE_VERSION}-html`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const ASSET_PREFIXES = [
  '/scripts/', '/styles/', '/assets/',
  '/images/', '/fonts/', '/brand/',
];

self.addEventListener('install', (event) => {
  // Activate immediately on first install so the next page load is covered.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Sweep old versions so cache doesn't grow unbounded across deploys.
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(CACHE_VERSION))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function isAssetRequest(url) {
  return ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isHtmlRequest(req, url) {
  if (req.mode === 'navigate') return true;
  if (url.pathname.endsWith('.html')) return true;
  // /app and /app/ are HTML routes too (server rewrites to app.html).
  if (url.pathname === '/app' || url.pathname === '/app/') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only intercept GET. POST/PUT/etc. (API mutations) pass through untouched.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Same-origin only. Don't touch Stripe, Supabase, Cloudflare, OpenAI proxies.
  if (url.origin !== self.location.origin) return;
  // API responses are dynamic — never cache. Pass through to network.
  if (url.pathname.startsWith('/api/')) return;
  // The SW file itself must always come from network so updates apply.
  if (url.pathname === '/sw.js') return;

  if (isHtmlRequest(req, url)) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }
  if (isAssetRequest(url)) {
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }
  // Everything else (favicon, manifest, sitemap, robots): try cache first
  // with a network fallback. Lightweight and rarely changes.
  event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      // Only cache successful full responses (skip 206 / opaque / errors).
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Last resort: a minimal offline stub so the page doesn't crash hard.
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font:16px system-ui;padding:24px;background:#0a2420;color:#e8f3ec">' +
        "You're offline. Reconnect and reload.</body>",
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  // Serve cache instantly if we have it; otherwise wait for network.
  return cached || network || new Response('', { status: 504 });
}
