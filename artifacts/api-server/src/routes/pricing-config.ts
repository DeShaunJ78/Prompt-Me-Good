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

router.get("/pricing-config.js", (_req, res) => {
  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cache-Control", "public, max-age=60");
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
