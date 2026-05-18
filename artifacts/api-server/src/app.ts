import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripe-webhook";
import { logger } from "./lib/logger";
import { buildAllowedOrigins } from "./lib/allowed-origins";

const app: Express = express();

// audit-3 §15: don't advertise the framework. One-liner, no downside.
app.disable("x-powered-by");

// Replit terminates TLS at a single front proxy and forwards to us on loopback.
// Trust exactly one hop so req.ip reflects the real client IP from the proxy's
// X-Forwarded-For entry, while ignoring any user-supplied forwarded headers.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

/* audit-3 §15: security headers.
   - contentSecurityPolicy:false because the API serves JSON only; CSP belongs
     on the HTML server (artifacts/promptmegood/server.mjs).
   - crossOriginResourcePolicy:cross-origin so the web app at promptmegood.com
     (different host post-deploy, same host via the Replit proxy) can read
     responses without CORP getting in the way. CORS still gates this. */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

/* audit-3 §15: CORS lockdown. Previously `app.use(cors())` returned
   Access-Control-Allow-Origin: * for every API route — any website on the
   internet could drive POST /api/* from a victim browser. Now: explicit
   allowlist of production domains + Replit preview hosts. credentials:true
   because authenticated routes send the Supabase JWT in headers and may
   carry cookies for session features. */
const corsAllowlist = new Set(buildAllowedOrigins());
app.use(
  cors({
    origin(origin, cb) {
      // Same-origin requests (no Origin header — server-to-server, curl, etc.)
      // are allowed. CORS only protects browsers from cross-origin reads.
      if (!origin) return cb(null, true);
      if (corsAllowlist.has(origin)) return cb(null, true);
      // Don't throw — return false so the browser sees a clean CORS error
      // rather than a 500. Server-side log captures the rejected origin for
      // audit, but the response itself stays generic.
      logger.warn({ origin }, "CORS rejected: origin not on allowlist");
      return cb(null, false);
    },
    credentials: true,
  }),
);

// IMPORTANT: Stripe webhook MUST be registered BEFORE express.json() so the
// raw request body (a Buffer of the exact bytes Stripe signed) is available
// for signature verification. The webhook router applies its own
// express.raw({ type: 'application/json' }) middleware to its single route.
app.use("/api", stripeWebhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (intentionally outside /api so the keep-alive ping from the web
// client stays cheap and unauthenticated). Used by the frontend's 4-minute
// keep-alive to prevent Replit cold starts.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

export default app;
