import { Router, type IRouter } from "express";

/* ============================================================================
 * /api/public-config — exposes browser-safe public configuration
 * ----------------------------------------------------------------------------
 * Returns the Supabase project URL and the **publishable** (anon) key, both
 * of which are designed to ship to the browser. They live in Replit Secrets
 * (env vars) so they are not hardcoded into the client bundle.
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
  // Cache briefly: config rarely changes during a session, but we don't want
  // stale values surviving a deploy that rotates keys.
  res.set("Cache-Control", "public, max-age=60");
  res.json({ supabaseUrl, supabasePublishableKey });
});

export default router;
