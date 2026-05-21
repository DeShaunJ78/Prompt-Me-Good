import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userTiers } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/stripe/checkout — stubbed checkout session creation
// To activate: set STRIPE_SECRET_KEY env var and replace body with:
//   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//   const session = await stripe.checkout.sessions.create({ ... });
//   res.json({ url: session.url });
// ---------------------------------------------------------------------------
router.post("/stripe/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { tier, billing, email, name } = req.body as {
    tier?:    string;
    billing?: string;
    email?:   string;
    name?:    string;
  };

  const VALID_TIERS = ["builder", "pro"] as const;
  if (!tier || !VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
    res.status(400).json({ error: "tier must be 'builder' or 'pro'." });
    return;
  }

  console.log("[stripe/checkout] Stub session:", {
    userId,
    tier,
    billing: billing ?? "monthly",
    email: email ? `${email.slice(0, 3)}***` : undefined,
    name,
  });

  // TODO: Replace with real Stripe Checkout Session:
  // const priceId = billing === "annual"
  //   ? ANNUAL_PRICE_IDS[tier]
  //   : MONTHLY_PRICE_IDS[tier];
  // const session = await stripe.checkout.sessions.create({
  //   mode: "subscription",
  //   line_items: [{ price: priceId, quantity: 1 }],
  //   customer_email: email,
  //   metadata: { userId },
  //   success_url: `${process.env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  //   cancel_url: `${process.env.APP_URL}/pricing`,
  // });
  // res.json({ url: session.url });

  // Stub: upgrade tier in DB immediately (real flow would wait for webhook)
  try {
    const [existing] = await db
      .select({ userId: userTiers.userId })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    if (existing) {
      await db
        .update(userTiers)
        .set({ tier, updatedAt: new Date() })
        .where(eq(userTiers.userId, userId));
    } else {
      await db
        .insert(userTiers)
        .values({ userId, tier, specPacksThisMonth: 0, monthResetAt: new Date() });
    }
  } catch (err) {
    console.error("[stripe/checkout] DB update failed:", err);
  }

  res.json({
    success:   true,
    sessionId: `stub_${Date.now()}`,
    tier,
    message:   `Checkout session created for ${tier} (stub — keys not yet configured)`,
  });
});

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook — stubbed Stripe webhook handler
// To activate:
//   1. Set STRIPE_WEBHOOK_SECRET env var
//   2. Change body parser for this route to express.raw({ type: "application/json" })
//   3. Uncomment signature verification below
// ---------------------------------------------------------------------------
router.post("/stripe/webhook", (req: Request, res: Response) => {
  // TODO: Verify Stripe signature before processing any events
  // const sig = req.headers["stripe-signature"] as string;
  // try {
  //   const event = stripe.webhooks.constructEvent(
  //     req.body,                              // must be raw Buffer — needs express.raw() middleware
  //     sig,
  //     process.env.STRIPE_WEBHOOK_SECRET!,
  //   );
  // } catch (err) {
  //   res.status(400).send(`Webhook signature verification failed: ${err}`);
  //   return;
  // }

  const event     = req.body as { type?: string; data?: { object?: Record<string, unknown> } };
  const eventType = event?.type ?? "unknown";

  console.log("[stripe/webhook] Event received:", eventType);

  if (eventType === "payment_intent.succeeded") {
    // TODO: Extract userId from payment intent metadata, upgrade tier
    // const userId  = (event.data?.object as { metadata?: { userId?: string } })?.metadata?.userId;
    // const newTier = (event.data?.object as { metadata?: { tier?: string } })?.metadata?.tier;
    // if (userId && newTier) {
    //   await db.update(userTiers).set({ tier: newTier, updatedAt: new Date() })
    //     .where(eq(userTiers.userId, userId));
    // }
    console.log("[stripe/webhook] payment_intent.succeeded — TODO: upgrade user tier in DB");
  }

  if (eventType === "customer.subscription.updated") {
    // TODO: Map Stripe price ID → tier, update userTiers for the customer's userId
    // const subscription = event.data?.object as { customer?: string; items?: { data?: { price?: { id?: string } }[] } };
    // const customerId   = subscription?.customer;
    // const priceId      = subscription?.items?.data?.[0]?.price?.id;
    // Map priceId → tier using MONTHLY_PRICE_IDS / ANNUAL_PRICE_IDS lookup
    // Then update DB row for the userId associated with this customerId
    console.log("[stripe/webhook] customer.subscription.updated — TODO: sync tier from price ID");
  }

  if (eventType === "customer.subscription.deleted") {
    // TODO: Downgrade the user to "free" when their subscription is cancelled
    // const subscription = event.data?.object as { customer?: string };
    // const customerId   = subscription?.customer;
    // Look up userId from Stripe customer metadata, set tier = "free"
    console.log("[stripe/webhook] customer.subscription.deleted — TODO: downgrade user to free");
  }

  if (eventType === "invoice.payment_failed") {
    // TODO: Notify user of failed payment, optionally pause access
    console.log("[stripe/webhook] invoice.payment_failed — TODO: handle dunning");
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// GET /api/stripe/portal — stubbed billing portal session
// To activate: set STRIPE_SECRET_KEY and uncomment Stripe portal session creation
// ---------------------------------------------------------------------------
router.get("/stripe/portal", requireAuth, async (req: Request, res: Response) => {
  // TODO: Retrieve Stripe customer ID from DB, create real portal session:
  // const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const session = await stripe.billingPortal.sessions.create({
  //   customer:   storedCustomerId,
  //   return_url: `${process.env.APP_URL}/`,
  // });
  // res.json({ url: session.url });

  res.json({
    url:  "https://billing.stripe.com/p/placeholder",
    stub: true,
  });
});

export default router;
