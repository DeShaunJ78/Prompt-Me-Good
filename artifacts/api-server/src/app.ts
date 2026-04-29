import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripe-webhook";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());

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
