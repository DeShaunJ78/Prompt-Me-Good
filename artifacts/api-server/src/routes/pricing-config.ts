import { Router, type IRouter } from "express";
import { PMG_PRICING } from "../lib/pricing-config";

/* ============================================================================
 * /api/pricing-config.js — canonical, server-rendered pricing config
 * ----------------------------------------------------------------------------
 * Task #100 — Single source of truth for pricing.
 *
 * The static file artifacts/promptmegood/public/scripts/pmg-pricing-config.js
 * has been replaced by this endpoint so the BACKEND is the only authority for
 * prices, deadline copy, daily caps, and trial length. Both index.html and
 * pricing.html load this script BEFORE pmg-ux.js / pmg-pro.js, which then
 * read from window.PMG_PRICING. Updating PMG_PRICING in
 * api-server/src/lib/pricing-config.ts now flows automatically into:
 *   • backend cap enforcement (userCaps middleware)
 *   • backend /me/profile + /create-checkout-session error copy
 *   • frontend modal copy (pmg-pro.js)
 *   • frontend topbar trial pill + plan pill (pmg-ux.js)
 *   • frontend [data-pmg-price] / [data-pmg-deadline] DOM overlay
 *   • frontend JSON-LD price hydration (Offer.price)
 * No more mirroring drift between server and client config files.
 * ============================================================================ */
const router: IRouter = Router();

// audit-2 L1: only the `.js` variant is served. A bare GET /api/pricing-config
// (no extension) intentionally 404s — Express has no matching route and the
// fall-through 404 handler in routes/index.ts responds. Keep it that way:
// pricing-config is a script tag include, not a JSON API, and adding a JSON
// twin would split readers between two source-of-truth endpoints.
router.get("/pricing-config.js", (_req, res) => {
  res.set("Content-Type", "application/javascript; charset=utf-8");
  // audit-2 H-1 (triaged decision): no-cache + must-revalidate.
  // Browsers AND shared caches MAY store the response (no-cache permits
  // storage, no `no-store`/`private` directive forbids it), but every
  // subsequent request must revalidate with the origin via `If-None-Match`
  // and may only reuse the cached body on a 304. Express auto-generates an
  // ETag on `res.send(string)` (weak ETag by default), so unchanged config
  // returns a 304 instead of the full ~1.6KB payload — same correctness as
  // `no-store` (instant propagation after a deploy) with a fraction of the
  // bandwidth cost. Allowing shared-cache storage is fine here: the payload
  // is public pricing config with no user data. Previous header was
  // `public, max-age=300, stale-while-revalidate=86400`, which let pricing
  // drift be invisible to returning users for up to 24h via SWR — too
  // sticky for a launch surface that may need an emergency price correction.
  // The `?v=...` query-string bump on the <script> tag in pricing.html /
  // app.html remains as a belt-and-braces break-glass for forced invalidation.
  res.set("Cache-Control", "no-cache, must-revalidate");
  // Inlining JSON.stringify(PMG_PRICING) is safe because every value is a
  // number, string, or POJO of those types — no user data, no executable
  // tokens. Frozen so consumers can't accidentally mutate the shared config.
  const payload = JSON.stringify(PMG_PRICING);
  res.send(
    `/* Auto-generated from api-server/src/lib/pricing-config.ts. Do not edit by hand. */
(function () {
  if (typeof window === 'undefined') return;
  try { window.PMG_PRICING = Object.freeze(${payload}); } catch (_) { window.PMG_PRICING = ${payload}; }
})();
`,
  );
});

export default router;
