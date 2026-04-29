import app from "./app";
import { logger } from "./lib/logger";
import { logPaywallStatusOnce } from "./lib/paywall";

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
});
