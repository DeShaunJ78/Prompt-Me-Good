/* ============================================================================
 * POST /api/stripe-webhook
 * ----------------------------------------------------------------------------
 * Source of truth for subscription state. The frontend NEVER unlocks Pro on
 * its own — it polls /api/me/profile after a successful checkout and waits
 * for this handler to flip the row to plan='pro'.
 *
 * Critical wiring: this route is mounted in app.ts BEFORE express.json() and
 * uses express.raw({type: 'application/json'}) so req.body is the exact bytes
 * Stripe signed. Without that, signature verification fails.
 *
 * Events handled:
 *   - checkout.session.completed       — record customer + subscription
 *   - customer.subscription.created    — initial subscription state
 *   - customer.subscription.updated    — status, period, plan changes
 *   - customer.subscription.deleted    — downgrade to free
 *
 * Mapping back to a Supabase user:
 *   - checkout.session.completed: session.metadata.user_id
 *   - customer.subscription.*:    subscription.metadata.user_id (set during
 *                                 checkout via subscription_data.metadata),
 *                                 with a fallback lookup by stripe_customer_id.
 *
 * Reliability rule: every Supabase response is error-checked. ANY DB error
 * throws so the route returns 500 and Stripe automatically retries — without
 * this we can lose subscription state forever after a transient outage.
 * ============================================================================ */
import express, { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe-client";
import { supabaseAdmin } from "../lib/supabase-admin";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"];
if (!WEBHOOK_SECRET) {
  // Crash on boot rather than at first webhook delivery — a missing secret
  // here means we'd start 500-ing real Stripe events and silently miss state
  // changes until we noticed.
  throw new Error(
    "STRIPE_WEBHOOK_SECRET is not set. Add it as a Replit Secret before starting the api-server.",
  );
}
const SIGNING_SECRET: string = WEBHOOK_SECRET;

router.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || (Array.isArray(sig) && sig.length === 0)) {
      res.status(400).send("Missing stripe-signature header.");
      return;
    }
    const sigStr = Array.isArray(sig) ? sig[0]! : sig;

    let event: Stripe.Event;
    try {
      // req.body is a Buffer because we used express.raw above.
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sigStr,
        SIGNING_SECRET,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      req.log?.warn({ err }, "stripe webhook signature verification failed");
      res.status(400).send(`Webhook signature error: ${message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpsert(
            event.data.object as Stripe.Subscription,
          );
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;
        default:
          // Unhandled event types are not errors — Stripe sends many. Log at
          // debug so we can trace if needed without polluting production logs.
          req.log?.debug({ type: event.type }, "stripe webhook: unhandled");
      }
      res.json({ received: true });
    } catch (err) {
      req.log?.error({ err, type: event.type }, "stripe webhook handler error");
      // 500 tells Stripe to retry. Non-recoverable bugs should be caught and
      // turned into 200s deliberately so they don't loop forever.
      res.status(500).send("Webhook handler error.");
    }
  },
);

/* ---------- helpers ---------- */

function isoFromUnix(unix: number | null | undefined): string | null {
  if (!unix && unix !== 0) return null;
  return new Date(unix * 1000).toISOString();
}

async function findProfileByCustomerId(
  customerId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) {
    // Throw so the outer handler returns 500 → Stripe retries.
    throw new Error(`profiles lookup by customer_id failed: ${error.message}`);
  }
  return data ? (data.user_id as string) : null;
}

function planFromSubscription(sub: Stripe.Subscription): string {
  // Active or trialing → pro. Anything else (past_due, unpaid, canceled,
  // incomplete, incomplete_expired) → free, so a failed payment immediately
  // removes Pro features.
  return sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    (session.metadata && session.metadata["user_id"]) ||
    (session.client_reference_id as string | null) ||
    null;
  if (!userId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  // Founding member is a one-time $49 payment with mode='payment' AND
  // payment_status='paid'. We flip plan immediately because there's no
  // subscription event coming after this one. For mode='subscription' we
  // wait for the subscription.updated event so we can verify status='active'.
  const tier = (session.metadata && session.metadata["tier"]) || null;
  const isFoundingPaid =
    session.mode === "payment" &&
    tier === "founding" &&
    session.payment_status === "paid";

  const upsertRow: Record<string, unknown> = {
    user_id: userId,
    email: session.customer_details?.email || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  };
  if (isFoundingPaid) {
    upsertRow["plan"] = "founding";
    upsertRow["subscription_status"] = "lifetime";
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(upsertRow, { onConflict: "user_id" });
  if (error) {
    throw new Error(`checkout.session.completed upsert failed: ${error.message}`);
  }
}

// Founding members hold a lifetime plan that subscription webhooks must NOT
// overwrite. (Edge case: a founding member also opens a Pro sub later. We
// keep them as 'founding' — it's strictly more privileged.)
async function isFoundingMember(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`profiles plan check failed: ${error.message}`);
  }
  return data?.plan === "founding";
}

async function handleSubscriptionUpsert(
  sub: Stripe.Subscription,
): Promise<void> {
  let userId =
    (sub.metadata && sub.metadata["user_id"]) ||
    null;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!userId) {
    userId = await findProfileByCustomerId(customerId);
  }
  if (!userId) return;

  const plan = planFromSubscription(sub);
  // Stripe's Subscription type historically had `current_period_end` at the
  // root, but newer API versions can place it on the items. Read both safely.
  const periodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null;

  // Founding members hold a lifetime plan — never let a subscription event
  // overwrite it (even if they later subscribe to Pro on top).
  const founding = await isFoundingMember(userId);

  const row: Record<string, unknown> = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: isoFromUnix(periodEndUnix),
  };
  if (!founding) row["plan"] = plan;

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    throw new Error(`subscription upsert failed: ${error.message}`);
  }
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  let userId = (sub.metadata && sub.metadata["user_id"]) || null;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (!userId) {
    userId = await findProfileByCustomerId(customerId);
  }
  if (!userId) return;

  // Founding members hold a lifetime plan — never downgrade them when a
  // separate subscription is canceled.
  const founding = await isFoundingMember(userId);

  const row: Record<string, unknown> = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
  };
  if (!founding) row["plan"] = "free";

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    throw new Error(`subscription delete upsert failed: ${error.message}`);
  }
}

export default router;
