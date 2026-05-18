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
import { count, eq as drizzleEq, sql } from "drizzle-orm";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "../lib/stripe-client";
import { supabaseAdmin } from "../lib/supabase-admin";
import { db, foundingPurchasesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { PMG_PRICING } from "../lib/pricing-config";

/* Anon-key client used ONLY for the existing-user magic-link fallback
   in inviteOrLinkFoundingUser. signInWithOtp({shouldCreateUser:false})
   always triggers Supabase's email send pathway when invoked through
   the anon (gotrue) client — admin.generateLink does not. Anon key is
   safe to hold server-side; it is the same key the browser uses. */
const SUPABASE_URL = process.env["SUPABASE_URL"] || "";
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] || "";
let supabaseAnonForOtp: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseAnonForOtp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
} else {
  logger.warn(
    "SUPABASE_ANON_KEY missing — existing-user magic-link fallback will use admin.generateLink (no guaranteed email send).",
  );
}

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
  // Active or trialing → paid plan. Anything else (past_due, unpaid,
  // canceled, incomplete, incomplete_expired) → free, so a failed
  // payment immediately removes paid features.
  const isActive = sub.status === "active" || sub.status === "trialing";
  if (!isActive) return "free";
  // Distinguish Pro Studio (higher caps) from regular Pro using the
  // tier we stamped onto subscription_data.metadata at checkout. Existing
  // Pro subs created before pro_studio existed have tier = "pro" or
  // "pro_yearly", which fall through to "pro" — preserving backward compat.
  const tier = (sub.metadata && sub.metadata["tier"]) || "";
  if (tier === "pro_studio" || tier === "pro_studio_yearly") {
    return "pro_studio";
  }
  return "pro";
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    (session.metadata && session.metadata["user_id"]) ||
    (session.client_reference_id as string | null) ||
    null;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // Founding member is a one-time $79 payment with mode='payment' AND
  // payment_status='paid'. Two flows reach this branch:
  //   - tier=founding, flow=authenticated:   buyer was logged in. userId
  //     is set; existing path below upserts profiles to plan='founding'.
  //   - tier=founding, flow=anonymous:       buyer purchased without an
  //     account (the new pricing-page flow). userId is null. We record
  //     the purchase, invite the buyer via Supabase magic link, and
  //     bootstrap their profile to plan='founding' linked to the new
  //     auth.users row.
  const tier = (session.metadata && session.metadata["tier"]) || null;
  const flow = (session.metadata && session.metadata["flow"]) || null;
  const isFoundingPaid =
    session.mode === "payment" &&
    tier === "founding" &&
    session.payment_status === "paid";

  /* ============================================================
   * Step 1: Record the Founding purchase in our own table FIRST,
   * inside a transaction that atomically checks the seat cap.
   *
   * WHY a transaction: the pre-checkout seat check in
   * founding-checkout.ts / billing.ts runs before the Stripe
   * session is created and does NOT reserve a seat. A bot (or
   * concurrent buyers) can mint many valid sessions while count
   * is still < FOUNDING_LIMIT and complete them later, bypassing
   * the advertised 500-seat cap. By re-checking the count inside
   * a DB transaction here at fulfillment time, we ensure that
   * provisioning never happens for sessions completed after the
   * cap is truly reached, regardless of how many sessions were
   * issued beforehand.
   *
   * Over-cap sessions: we return 200 to Stripe (so it does not
   * retry), log loudly for the operator to issue a manual refund,
   * and skip all provisioning side-effects. The payment IS real —
   * the operator must refund it via the Stripe dashboard.
   *
   * `inserted.length === 0` on a non-over-cap path means this
   * exact session_id was already recorded by an earlier delivery
   * (idempotent via UNIQUE(stripe_session_id)) — we skip every
   * downstream side effect so duplicate webhook calls don't spam
   * invite emails or churn profile rows.
   * ============================================================ */
  let isFreshPurchase = false;
  let overCap = false;
  if (isFoundingPaid) {
    const buyerEmail = session.customer_details?.email || null;
    if (!buyerEmail) {
      // Stripe always collects email on the modes we use; defensive log.
      throw new Error(
        "founding checkout completed without buyer email — refusing to record",
      );
    }
    await db.transaction(async (tx) => {
      /* Acquire a transaction-level advisory lock keyed on a stable integer
         derived from the string 'pmg_founding_seat_alloc'. This serializes
         ALL concurrent webhook handlers that reach this code — only one
         transaction can hold the lock at a time. Under Postgres READ
         COMMITTED (the default), two concurrent handlers can both read
         sold < 500 before either inserts, producing more than 500 fulfilled
         seats. The advisory lock closes that window: the second handler
         blocks on pg_advisory_xact_lock until the first transaction commits,
         at which point the committed row is visible and the count reflects
         reality. The lock is automatically released on transaction commit or
         rollback — no manual cleanup needed, no deadlock risk. */
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('pmg_founding_seat_alloc'))`,
      );

      /* Step 1a: Redelivery detection — check for existing stripe_session_id
         BEFORE the cap check. If this session is already recorded, mark it as
         a redelivery and exit early. Without this ordering, a Stripe retry
         arriving after the cap is reached would be misclassified as overCap
         and logged as "manual refund required" even though the seat was
         legitimately fulfilled on the first delivery. */
      const existing = await tx
        .select({ id: foundingPurchasesTable.id })
        .from(foundingPurchasesTable)
        .where(drizzleEq(foundingPurchasesTable.stripeSessionId, session.id))
        .limit(1);
      if (existing.length > 0) {
        // This exact stripe_session_id was already recorded — redelivery.
        isFreshPurchase = false;
        return;
      }

      /* Step 1b: Cap check — only reached for new (never-before-seen) sessions. */
      const rows = await tx
        .select({ n: count() })
        .from(foundingPurchasesTable);
      const sold = Number(rows[0]?.n ?? 0);

      if (sold >= PMG_PRICING.FOUNDING_LIMIT) {
        // Seat cap already reached at fulfillment time. The session was
        // issued before the cap was hit but completed after. Do NOT
        // provision the account. Flag for operator refund.
        overCap = true;
        return;
      }

      /* Step 1c: Insert the new purchase row. */
      await tx
        .insert(foundingPurchasesTable)
        .values({
          stripeSessionId: session.id,
          stripeCustomerId: customerId,
          stripePaymentIntentId: paymentIntentId,
          email: buyerEmail.toLowerCase(),
          flow: flow === "anonymous" ? "anonymous" : "authenticated",
          supabaseUserId: userId,
        });
      isFreshPurchase = true;
    });

    if (overCap) {
      // OPERATOR ACTION REQUIRED: refund this session via the Stripe dashboard.
      logger.error(
        { stripeSessionId: session.id, email: hashEmail(buyerEmail) },
        "FOUNDING SEAT CAP EXCEEDED — payment accepted by Stripe but seat NOT provisioned; manual refund required",
      );
      return; // Return 200 to Stripe; do not retry.
    }

    if (!isFreshPurchase) {
      logger.info(
        { stripeSessionId: session.id },
        "founding webhook redelivery — purchase already recorded, skipping side effects",
      );
    }
  }

  /* ============================================================
   * Step 2a: Authenticated flow — user already exists. Upsert
   * profiles row directly (existing behavior, preserved).
   * ============================================================ */
  if (userId) {
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
      throw new Error(
        `checkout.session.completed upsert failed: ${error.message}`,
      );
    }
    return;
  }

  /* ============================================================
   * Step 2b: Anonymous Founding flow — invite the buyer to
   * Supabase (which sends a magic-link email) and bootstrap
   * their profile linked to the new auth.users row.
   *
   * Email-send failures here are LOGGED LOUDLY but NOT thrown:
   * the purchase is already recorded in founding_purchases,
   * so the operator can manually re-invite without losing
   * provenance. Throwing would make Stripe retry, which would
   * spam invites if the underlying Supabase email config is
   * the actual problem.
   * ============================================================ */
  if (isFoundingPaid && flow === "anonymous" && isFreshPurchase) {
    const buyerEmail = (session.customer_details?.email || "").toLowerCase();
    if (!buyerEmail) return; // already validated above
    try {
      const supabaseUserId = await inviteOrLinkFoundingUser(
        buyerEmail,
        customerId,
      );
      if (supabaseUserId) {
        // Backfill the founding_purchases.supabase_user_id we couldn't
        // know at INSERT time.
        try {
          await db
            .update(foundingPurchasesTable)
            .set({ supabaseUserId })
            .where(eqEmail(buyerEmail));
        } catch (backfillErr) {
          logger.warn(
            { err: backfillErr },
            "founding_purchases backfill of supabase_user_id failed (non-fatal)",
          );
        }

        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              user_id: supabaseUserId,
              email: buyerEmail,
              plan: "founding",
              subscription_status: "lifetime",
              stripe_customer_id: customerId,
            },
            { onConflict: "user_id" },
          );
        if (profileErr) {
          logger.error(
            { err: profileErr, email: hashEmail(buyerEmail) },
            "founding profile upsert failed",
          );
        }
      }
    } catch (err) {
      // Record the failure but DO NOT throw — purchase is already saved.
      logger.error(
        { err, email: hashEmail(buyerEmail) },
        "founding magic-link send failed — purchase recorded, manual follow-up required",
      );
    }
  }
}

function eqEmail(email: string) {
  return drizzleEq(foundingPurchasesTable.email, email);
}

/* Non-reversible email fingerprint for log correlation. Mirrors the
 * pattern in waitlist.ts so log scraping stays consistent. */
function hashEmail(email: string): string {
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h + email.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* Build the magic-link redirect URL from REPLIT_DOMAINS or the
 * canonical production host. The link redirect_to MUST be an
 * allowed URL in the Supabase project's auth settings or Supabase
 * will substitute its default Site URL silently. */
function magicLinkRedirect(): string {
  const domains = (process.env["REPLIT_DOMAINS"] || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const first = domains[0];
  if (first) return `https://${first}/?welcome=founding`;
  return "https://www.promptmegood.com/?welcome=founding";
}

/**
 * Invite a buyer to Supabase or, if their email is already registered,
 * send them a magic link. Returns the Supabase user_id or null on
 * complete failure.
 *
 * Supabase email sending requires the project to have either the
 * built-in email service or a configured SMTP integration. If the
 * project has neither, generateLink/inviteUserByEmail will succeed
 * at creating the user but no email will reach the buyer. The
 * operator monitors this in production via the founding_purchases
 * table (any row missing supabase_user_id is a follow-up candidate).
 */
async function inviteOrLinkFoundingUser(
  email: string,
  stripeCustomerId: string | null,
): Promise<string | null> {
  const redirectTo = magicLinkRedirect();
  const userMetadata: Record<string, unknown> = {
    plan: "founding",
    source: "founding_purchase",
  };
  if (stripeCustomerId) userMetadata["stripe_customer_id"] = stripeCustomerId;

  // First try invite — works for brand-new emails. inviteUserByEmail
  // creates the auth.users row AND triggers Supabase's invite-email
  // send pathway in one call.
  const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { data: userMetadata, redirectTo },
  );
  if (!inviteResult.error && inviteResult.data?.user?.id) {
    return inviteResult.data.user.id;
  }

  // If the user already exists, fall back to a magic-link sign-in.
  // CRITICAL: admin.generateLink only RETURNS a link — it does not always
  // send the email (depends on Supabase project SMTP/auth-email config).
  // signInWithOtp on the anon client always invokes Supabase's email
  // dispatch pathway, so the buyer reliably receives the link.
  const errMsg = inviteResult.error?.message || "";
  const alreadyExists =
    /already.*registered|already exists|email[_ ]exists|user.*exists/i.test(
      errMsg,
    );
  if (!alreadyExists) {
    throw inviteResult.error || new Error("invite failed with unknown error");
  }

  if (supabaseAnonForOtp) {
    const otpResult = await supabaseAnonForOtp.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        // Buyer already exists — don't accidentally create a duplicate
        // shadow user; signInWithOtp would normally create-on-missing.
        shouldCreateUser: false,
      },
    });
    if (otpResult.error) {
      // Fall back to admin.generateLink so we at least HAVE the link to
      // surface manually if Supabase's OTP pathway is misconfigured.
      logger.warn(
        { err: otpResult.error, email: hashEmail(email) },
        "signInWithOtp failed; falling back to admin.generateLink (may not auto-send)",
      );
    } else {
      // signInWithOtp doesn't return the user_id directly — look it up
      // through admin.generateLink which does return user metadata. The
      // link is unused (we already triggered send via OTP), we only
      // need the user_id to write the profiles row.
      const idLookup = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      return idLookup.data?.user?.id ?? null;
    }
  }

  // Last-resort: admin.generateLink path (returns user_id; email send
  // depends on Supabase project email config). Operator can detect a
  // missing send by querying founding_purchases for missing supabase_user_id.
  const linkResult = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (linkResult.error) throw linkResult.error;
  return linkResult.data?.user?.id ?? null;
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
