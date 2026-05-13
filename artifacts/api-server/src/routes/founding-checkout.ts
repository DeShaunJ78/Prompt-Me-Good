/* ============================================================================
 * Founding Member — anonymous checkout + live seat count.
 * ----------------------------------------------------------------------------
 * Purchase-first / account-after flow:
 *   1. Buyer clicks "Buy Founding Member" on /pricing.html (no signup).
 *   2. POST /api/founding-checkout creates a Stripe Checkout Session in
 *      mode='payment' (one-time $79). Stripe collects the buyer's email.
 *   3. Stripe redirects to /founding-success.html on success.
 *   4. Webhook (stripe-webhook.ts) records the purchase in
 *      `founding_purchases` and triggers a Supabase magic-link / invite
 *      email to the address Stripe collected. Buyer clicks the link, lands
 *      back in PromptMeGood already provisioned with plan='founding'.
 *
 * Server-side seat enforcement:
 *   - GET  /api/founding-checkout/status returns { sold, remaining, soldOut }.
 *   - POST /api/founding-checkout pre-checks SELECT count(*) < FOUNDING_LIMIT
 *     before creating the Stripe session. (A small race is possible — see
 *     the comment block in the handler — but caps overshoot to single-digit
 *     edge cases on a 500-seat product, which the operator can refund
 *     manually if it ever happens.)
 *   - The webhook ALSO defends in depth by recording every paid session
 *     into a UNIQUE-indexed table; a Stripe-side over-purchase still gets
 *     recorded and surfaces in operator queries.
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { count } from "drizzle-orm";
import { db, foundingPurchasesTable } from "@workspace/db";
import { stripe } from "../lib/stripe-client";
import { PMG_PRICING } from "../lib/pricing-config";
import { makeRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

/* ----------------------------------------------------------------- */
/* Return-URL allowlist (mirrors billing.ts pickOrigin)              */
/* ----------------------------------------------------------------- */
function buildAllowedOrigins(): string[] {
  const list: string[] = [];
  const domains = (process.env["REPLIT_DOMAINS"] || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const d of domains) list.push(`https://${d}`);
  list.push("https://www.promptmegood.com");
  list.push("https://promptmegood.com");
  if ((process.env["NODE_ENV"] || "development") !== "production") {
    list.push("http://localhost:80");
    list.push("http://localhost");
  }
  return Array.from(new Set(list));
}

function pickOrigin(requestOrigin: string | undefined): string {
  const allowed = buildAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || "https://www.promptmegood.com";
}

/* ----------------------------------------------------------------- */
/* Seat counter                                                       */
/* ----------------------------------------------------------------- */
async function getFoundingSold(): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(foundingPurchasesTable);
  return Number(rows[0]?.n ?? 0);
}

/* ----------------------------------------------------------------- */
/* Rate limit — 5 anonymous-checkout attempts / 10 min / IP.          */
/* Generous for legit retries, clamps abuse.                          */
/* ----------------------------------------------------------------- */
const checkoutLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  label: "general",
});

/* =========================================================================
 * GET /api/founding-checkout/status
 * Public, unauthenticated. Read-only. Used by pricing.html to render the
 * live "X of 500 claimed" badge and to hide the Buy button when sold out.
 * ===================================================================== */
router.get("/founding-checkout/status", async (req, res) => {
  try {
    const sold = await getFoundingSold();
    const limit = PMG_PRICING.FOUNDING_LIMIT;
    const remaining = Math.max(0, limit - sold);
    // audit-2 M3: previously `public, max-age=15` — that 15-second window let
    // a stale "X left" badge sit in the browser long enough for a buyer to
    // click Buy on a sold-out tier and get a 409 from POST /founding-checkout.
    // The server-side 409 still catches it, but the UX is jarring. Switching
    // to no-store guarantees the badge always reflects current seat count.
    // Cost is one extra DB COUNT per page load — negligible at our scale.
    res.set("Cache-Control", "no-store");
    // audit-2 M4 (build pass): formal deprecation signal for the legacy alias.
    // The canonical route is GET /api/founding/seats (added in audit-2 H-A,
    // see L108-128 below). Both routes return identical payloads today and
    // delegate to the same getFoundingSold() — but two endpoints means two
    // chances to drift. Sunset = 2026-07-01T05:00:00Z (BETA_END). Per
    // RFC 8594 Sunset is HTTP-date, RFC 9745 Deprecation is structured field
    // (?1 = true). Operators / smart clients can now route around this
    // endpoint before the cutover.
    res.set("Deprecation", "true");
    res.set("Sunset", "Tue, 01 Jul 2026 05:00:00 GMT");
    res.set("Link", '</api/founding/seats>; rel="successor-version"');
    res.json({
      sold,
      limit,
      remaining,
      soldOut: sold >= limit,
    });
  } catch (err) {
    req.log?.error({ err }, "founding-checkout/status failed");
    res.status(500).json({ error: "status_unavailable" });
  }
});

/* =========================================================================
 * GET /api/founding/seats
 * audit-2 H-A alias: cleaner public route name for the same {sold, limit,
 * remaining, soldOut} payload that pricing.html (and any future surface)
 * needs to render the live "X of 500 claimed" badge. Delegates to the same
 * getFoundingSold() helper so there is exactly one source of truth for the
 * count. /api/founding-checkout/status stays in place as a deprecated
 * alias — both routes return identical responses.
 * ===================================================================== */
router.get("/founding/seats", async (req, res) => {
  try {
    const sold = await getFoundingSold();
    const limit = PMG_PRICING.FOUNDING_LIMIT;
    const remaining = Math.max(0, limit - sold);
    res.set("Cache-Control", "no-store");
    res.json({
      sold,
      limit,
      remaining,
      soldOut: sold >= limit,
    });
  } catch (err) {
    req.log?.error({ err }, "founding/seats failed");
    res.status(500).json({ error: "status_unavailable" });
  }
});

/* =========================================================================
 * POST /api/founding-checkout
 * Public, unauthenticated, rate-limited. Creates a one-time-payment Stripe
 * Checkout Session for the Founding tier and returns { url } for the
 * browser to redirect to. Stripe collects the email on its side.
 * ===================================================================== */
router.post("/founding-checkout", checkoutLimiter, async (req, res) => {
  try {
    const priceId = process.env["STRIPE_FOUNDING_PRICE_ID"];
    if (!priceId) {
      req.log?.error(
        "STRIPE_FOUNDING_PRICE_ID missing — anonymous founding checkout cannot run",
      );
      res
        .status(500)
        .json({ error: "Founding checkout is not configured." });
      return;
    }

    /* Seat-count pre-check. Race window: between this SELECT and the eventual
       webhook-side INSERT, another buyer can squeeze in. Acceptable for a
       500-seat product — operator can refund the rare overshoot. A stronger
       fix would reserve seats at session creation with TTL expiry, which is
       overkill for current scale. */
    const sold = await getFoundingSold();
    if (sold >= PMG_PRICING.FOUNDING_LIMIT) {
      req.log?.info({ sold }, "founding checkout blocked — sold out");
      res.status(409).json({
        error: "sold_out",
        message:
          "All 500 Founding Member seats are claimed. Join the waitlist for general availability.",
      });
      return;
    }

    const origin = pickOrigin(req.headers.origin as string | undefined);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe collects the email field — required for post-purchase magic
      // link send. customer_creation=always means we get a Stripe Customer
      // we can attach to the Supabase profile later.
      customer_creation: "always",
      // billing_address_collection: 'auto' keeps the form short for buyers
      // in jurisdictions where Stripe doesn't require it.
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      metadata: {
        tier: "founding",
        flow: "anonymous",
      },
      payment_intent_data: {
        metadata: {
          tier: "founding",
          flow: "anonymous",
        },
      },
      success_url: `${origin}/founding-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing.html?upgrade=cancel&tier=founding`,
    });

    if (!session.url) {
      req.log?.error("Stripe returned a session without a url");
      res.status(502).json({ error: "Checkout session has no URL." });
      return;
    }

    res.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log?.error({ err }, "founding-checkout failed");
    res.status(500).json({ error: message });
  }
});

export default router;
