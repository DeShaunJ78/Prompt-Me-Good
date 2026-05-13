import app from "./app";
import { logger } from "./lib/logger";
import { logPaywallStatusOnce } from "./lib/paywall";
import { assertPricingConfigsInSync } from "./lib/pricing-config-sync-check";

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
