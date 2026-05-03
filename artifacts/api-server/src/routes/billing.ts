/* ============================================================================
 * Billing routes
 * ----------------------------------------------------------------------------
 * POST /api/create-checkout-session
 *   - Requires a valid Supabase access token in Authorization header.
 *   - Looks up (or creates) the user's profile row in Supabase `profiles`.
 *   - Reuses the existing Stripe customer if there is one; otherwise creates
 *     a new one (with idempotency key keyed on user_id) and stores the id on
 *     the profile.
 *   - Creates a Stripe Checkout Session in subscription mode using
 *     STRIPE_PRO_MONTHLY_PRICE_ID (with STRIPE_PRICE_ID kept as a fallback
 *     for backward compat) for Pro Monthly, STRIPE_PRO_YEARLY_PRICE_ID for
 *     Pro Yearly, or STRIPE_FOUNDING_PRICE_ID for the one-time Founding
 *     lifetime tier. The user_id is stamped onto BOTH session.metadata and
 *     subscription_data.metadata so the webhook can map any later event back
 *     to the right user.
 *   - Returns { url } — the frontend redirects the browser to it.
 *
 * GET /api/me/profile
 *   - Requires auth. Returns the caller's profile row (so the UI can read
 *     subscription_status without trusting the client to know who it is).
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { stripe } from "../lib/stripe-client";
import { supabaseAdmin } from "../lib/supabase-admin";
import { requireSupabaseUser, type AuthedRequest } from "../lib/auth";
import { isPaywallActive } from "../lib/paywall";
import {
  PMG_PRICING,
  effectiveCaps,
  isInTrial,
  trialDaysLeft,
  type PmgPlan,
} from "../lib/pricing-config";
import { getUserUsageSnapshot } from "../middlewares/userCaps";

const router: IRouter = Router();

/* ----------------------------------------------------------------- */
/* Return-URL allowlist                                              */
/* ----------------------------------------------------------------- */
/* SECURITY: NEVER use the request's Origin header to build success/cancel
   URLs — an authenticated caller could redirect post-checkout traffic to
   any origin they like (open-redirect / phishing vector). Build the list
   from REPLIT_DOMAINS plus a hard-coded production domain, and require
   the caller's Origin (if present) to match. */
function buildAllowedOrigins(): string[] {
  const list: string[] = [];
  const domains = (process.env["REPLIT_DOMAINS"] || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const d of domains) list.push(`https://${d}`);
  // Production canonical hosts.
  list.push("https://www.promptmegood.com");
  list.push("https://promptmegood.com");
  // Local dev fallback (only matters when developing without REPLIT_DOMAINS).
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

interface ProfileRow {
  user_id: string;
  email: string | null;
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

async function getOrCreateProfile(
  userId: string,
  email: string,
): Promise<ProfileRow> {
  // Try to read first. If the row doesn't exist, insert a barebones row.
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("profiles")
    .select(
      "user_id, email, plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(`profiles read failed: ${readErr.message}`);
  if (existing) return existing as ProfileRow;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("profiles")
    .insert({ user_id: userId, email, plan: "free" })
    .select(
      "user_id, email, plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end",
    )
    .single();
  if (insertErr) throw new Error(`profiles insert failed: ${insertErr.message}`);
  return inserted as ProfileRow;
}

router.post(
  "/create-checkout-session",
  requireSupabaseUser,
  async (req: AuthedRequest, res) => {
    const user = req.user!;

    // Pick the tier — defaults to 'pro' (monthly) for backward compat with
    // the original T41 button. Frontend sends
    // { tier: 'pro' | 'pro_yearly' | 'founding' }.
    const rawTier =
      typeof req.body === "object" && req.body && typeof req.body.tier === "string"
        ? req.body.tier.toLowerCase().replace("-", "_")
        : "pro";
    const tier: "pro" | "founding" | "pro_yearly" =
      rawTier === "founding"
        ? "founding"
        : rawTier === "pro_yearly"
        ? "pro_yearly"
        : "pro";

    /* T43: During open beta both Pro recurring subscriptions (monthly and
       yearly) are NOT yet for sale — only the lifetime Founding tier
       ($79, price locked for life) is. Block any Pro checkout request
       until the paywall flips on. The frontend already hides Pro CTAs in
       beta mode, but we enforce here too so the API cannot be used to
       purchase Pro early via direct calls or stale clients. Founding
       always passes through. */
    if ((tier === "pro" || tier === "pro_yearly") && !isPaywallActive()) {
      req.log?.info(
        { userId: user.id, tier },
        "blocked pro checkout during open beta",
      );
      res.status(403).json({
        error: `Pro launches soon. Founding Member access ($${PMG_PRICING.FOUNDING_PRICE_USD} lifetime, ${PMG_PRICING.PRICE_LOCK_TAGLINE}) is available now.`,
      });
      return;
    }

    /* Map tier → Stripe Price ID env var. STRIPE_PRO_MONTHLY_PRICE_ID is
       the canonical name; STRIPE_PRICE_ID is kept as a fallback so any
       existing deploys with the old secret name continue to work
       unchanged. STRIPE_FOUNDING_PRICE_ID and STRIPE_PRO_YEARLY_PRICE_ID
       are required for their respective tiers and have no fallback. */
    const priceId =
      tier === "founding"
        ? process.env["STRIPE_FOUNDING_PRICE_ID"]
        : tier === "pro_yearly"
        ? process.env["STRIPE_PRO_YEARLY_PRICE_ID"]
        : process.env["STRIPE_PRO_MONTHLY_PRICE_ID"] ??
          process.env["STRIPE_PRICE_ID"];
    if (!priceId) {
      const which =
        tier === "founding"
          ? "STRIPE_FOUNDING_PRICE_ID"
          : tier === "pro_yearly"
          ? "STRIPE_PRO_YEARLY_PRICE_ID"
          : "STRIPE_PRO_MONTHLY_PRICE_ID";
      req.log?.error({ tier, which }, "price id not configured");
      res
        .status(500)
        .json({ error: `Billing is not configured (${which} missing).` });
      return;
    }

    try {
      const profile = await getOrCreateProfile(user.id, user.email);

      // Reuse the customer if we already have one; otherwise create + persist.
      // The idempotency key is keyed on user_id so two concurrent checkout
      // requests from the same user CANNOT create two separate Stripe
      // customers — Stripe will return the same customer for both calls.
      let customerId = profile.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create(
          {
            email: user.email || undefined,
            metadata: { user_id: user.id },
          },
          { idempotencyKey: `pmg-customer-${user.id}` },
        );
        customerId = customer.id;
        const { error: updErr } = await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
        if (updErr) {
          // Non-fatal: checkout will still work, but log the inconsistency so
          // we can backfill if needed. (The webhook also writes this field.)
          req.log?.warn(
            { err: updErr },
            "could not persist stripe_customer_id on profile",
          );
        }
      }

      // Build return URLs from a strict allowlist (NOT the raw Origin header).
      const origin = pickOrigin(req.headers.origin as string | undefined);

      // Three distinct checkout shapes:
      //   - 'pro'        → recurring monthly subscription (mode: 'subscription')
      //   - 'pro_yearly' → recurring yearly subscription  (mode: 'subscription')
      //   - 'founding'   → one-time $79 lifetime, price locked (mode: 'payment')
      // The webhook reads `metadata.tier` to know which side handled it.
      const baseParams = {
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: user.id,
        metadata: { user_id: user.id, tier },
        allow_promotion_codes: true,
        success_url: `${origin}/?upgrade=success&tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing.html?upgrade=cancel&tier=${tier}`,
      };

      const session =
        tier === "founding"
          ? await stripe.checkout.sessions.create({
              ...baseParams,
              mode: "payment",
              // Founding is a one-time purchase. No subscription_data here.
            })
          : await stripe.checkout.sessions.create({
              ...baseParams,
              mode: "subscription",
              // Stamp user_id on the subscription too — webhook uses it for
              // future customer.subscription.* events.
              subscription_data: { metadata: { user_id: user.id, tier } },
            });

      if (!session.url) {
        req.log?.error("Stripe returned a session without a url");
        res.status(502).json({ error: "Checkout session has no URL." });
        return;
      }

      res.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      req.log?.error({ err }, "create-checkout-session failed");
      res.status(500).json({ error: message });
    }
  },
);

router.get(
  "/me/profile",
  requireSupabaseUser,
  async (req: AuthedRequest, res) => {
    const user = req.user!;
    try {
      const profile = await getOrCreateProfile(user.id, user.email);
      const planRaw = (profile.plan || "free").toLowerCase();
      const plan: PmgPlan =
        planRaw === "pro" || planRaw === "founding" ? planRaw : "free";
      // Trial is anchored to the Supabase auth.users.created_at timestamp
      // (delivered via requireSupabaseUser) so it can't be reset by
      // clearing browser data. Founding/Pro users are unlimited and have
      // no trial state.
      const caps = effectiveCaps(plan, user.createdAtMs);
      const used = getUserUsageSnapshot(user.id);
      res.json({
        plan,
        subscription_status: profile.subscription_status,
        current_period_end: profile.current_period_end,
        created_at: new Date(user.createdAtMs).toISOString(),
        trial: {
          active: plan === "free" && isInTrial(user.createdAtMs),
          days_left: plan === "free" ? trialDaysLeft(user.createdAtMs) : 0,
        },
        caps, // every plan has finite caps; founding/pro just have higher ones
        used,
        pricing: {
          founding_usd: PMG_PRICING.FOUNDING_PRICE_USD,
          pro_monthly_usd: PMG_PRICING.PRO_MONTHLY_USD,
          pro_yearly_usd: PMG_PRICING.PRO_YEARLY_USD,
          founding_deadline: PMG_PRICING.FOUNDING_DEADLINE_COPY,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      req.log?.error({ err }, "/me/profile failed");
      res.status(500).json({ error: message });
    }
  },
);

export default router;
