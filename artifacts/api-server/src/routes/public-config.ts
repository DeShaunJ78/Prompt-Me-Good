import { Router, type IRouter } from "express";
import { getPaywallStatus } from "../lib/paywall";

/* ============================================================================
 * /api/public-config — exposes browser-safe public configuration
 * ----------------------------------------------------------------------------
 * Returns the Supabase project URL and the **publishable** (anon) key, both
 * of which are designed to ship to the browser. They live in Replit Secrets
 * (env vars) so they are not hardcoded into the client bundle.
 *
 * Also returns the current paywall status (T42 open beta) so the browser
 * can match the backend's gating decision: which features are unlocked,
 * whether to show the "Free Beta Access" banner, and when paid mode kicks
 * in. The frontend MUST NOT trust its own clock for this — the backend is
 * the only authority.
 *
 * This endpoint MUST NOT expose service-role keys or any other private
 * credential. If the env vars are missing, the endpoint returns empty strings
 * so the client can degrade gracefully (auth UI shows a "not configured"
 * message) rather than crash the whole page.
 * ============================================================================ */
const router: IRouter = Router();

router.get("/public-config", (_req, res) => {
  const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
  const supabasePublishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  // Cloudflare Turnstile site key is browser-safe by design (the secret
  // key stays server-only and is used to verify tokens). Empty string when
  // not configured so the pricing-page waitlist can degrade gracefully
  // (skip the widget rather than break the whole form).
  const turnstileSiteKey = process.env["TURNSTILE_SITE_KEY"] ?? "";
  // Short cache: paywall flips at a known instant configured via env var
  // (PMG_PAYWALL_FLIP_AT_ISO), so we keep staleness tight. The browser
  // polls /api/public-config on every page load anyway, so 30s is plenty.
  res.set("Cache-Control", "public, max-age=30");
  res.json({
    supabaseUrl,
    supabasePublishableKey,
    turnstileSiteKey,
    ...getPaywallStatus(),
  });
});

export default router;
