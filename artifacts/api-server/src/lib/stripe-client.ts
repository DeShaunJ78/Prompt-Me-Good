/* ============================================================================
 * Stripe SDK singleton.
 *
 * Reads STRIPE_SECRET_KEY from Replit Secrets at module load. Throws a clear,
 * actionable error if the secret is missing — better to crash on boot than
 * to fail mysteriously inside a checkout request.
 * ============================================================================ */
import Stripe from "stripe";

const SECRET = process.env["STRIPE_SECRET_KEY"];

if (!SECRET) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Add it as a Replit Secret before starting the api-server.",
  );
}

// Pin a stable API version so Stripe's behavior doesn't shift under us. The
// SDK's TypeScript types narrow `apiVersion` to the exact literal that ships
// with this SDK release. We deliberately pin an older, well-tested version
// and cast through `any` to opt out of that literal check — the Stripe HTTP
// API accepts any valid version string at runtime. Bump intentionally when
// upgrading the SDK so we don't get surprise behavior changes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PINNED_API_VERSION = "2024-06-20" as any;

export const stripe = new Stripe(SECRET, {
  apiVersion: PINNED_API_VERSION,
  typescript: true,
});
