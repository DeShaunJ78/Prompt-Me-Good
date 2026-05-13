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
  // audit-2 H-B: 5-minute browser TTL with 24h stale-while-revalidate.
  // Returning users get an instant render from the SWR cache and the
  // browser revalidates in the background, so a price change propagates
  // within ~5 minutes for fresh sessions and ~one navigation for warm
  // sessions. Replaces the prior `max-age=60` (too aggressive a refetch
  // on a config that changes once a quarter) and `max-age=86400` (too
  // sticky for an emergency price correction). The `?v=...` query-string
  // bump on the <script> tag in pricing.html / app.html remains as a
  // break-glass for forced invalidation on a same-day pricing change.
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
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
