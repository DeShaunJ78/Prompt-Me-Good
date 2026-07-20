import app from "./app";
import { logger } from "./lib/logger";
import { logPaywallStatusOnce } from "./lib/paywall";
import { assertPricingConfigsInSync } from "./lib/pricing-config-sync-check";
import { assertStripePriceIdsConfigured } from "./lib/stripe-env-check";
import { startSupabaseKeepalive } from "./lib/supabase-keepalive";

// audit-2 H-2: validate every Stripe Price ID env var BEFORE binding the port.
// If any are missing or malformed (e.g. a `prod_*` Product ID pasted into a
// `STRIPE_*_PRICE_ID` slot), throw now so Replit's deploy health check refuses
// to flip prod traffic onto a broken release. The first paying Pro customer
// should not be the canary that discovers a misconfigured env var.
// Skipped automatically when STRIPE_SECRET_KEY is unset (dev / preview / CI).
assertStripePriceIdsConfigured();

// task-153: TURNSTILE_SECRET_KEY must be set in production so contact and
// waitlist routes hard-block bots. Without it both public intake endpoints
// fall back to fail-open (verifyTurnstile returns {ok:true} when the secret
// is absent), recreating the abuse path this fix closed. Skip in dev/preview
// where STRIPE_SECRET_KEY is also absent (same convention as Stripe guard above).
if (process.env["STRIPE_SECRET_KEY"] && !process.env["TURNSTILE_SECRET_KEY"]) {
  throw new Error(
    "TURNSTILE_SECRET_KEY must be set in production. " +
    "Without it, POST /api/contact and POST /api/waitlist fail open to bots.",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Surface "Paywall: OFF (Beta Mode)" or "Paywall: ON (Enforced)" once at
  // boot so the operator can tell from the workflow log which mode the
  // service is running in. Only logs in development.
  logPaywallStatusOnce();
  // task-184: prevent Supabase free-tier auto-pause by pinging the auth health
  // endpoint every 3 days. No-ops in dev (opt-in via PMG_SUPABASE_KEEPALIVE=1).
  startSupabaseKeepalive();
  // audit-2 M1+M2: assert BETA_END (TS) === PAYWALL_ACTIVATES_AT (env) and
  // that pmg-pricing-config.js mirror matches pricing-config.ts. In dev this
  // throws; in prod it logs ERROR but does not crash.
  try {
    assertPricingConfigsInSync();
  } catch (err) {
    logger.error({ err }, "Pricing config sync check threw at boot");
    if ((process.env["NODE_ENV"] ?? "development") !== "production") {
      throw err;
    }
  }
});
