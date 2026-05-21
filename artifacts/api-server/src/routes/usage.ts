import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userTiers } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getAllFeatureUsage,
  addCredits,
  getPackPurchaseCount,
  recordTopupPurchase,
  USAGE_LIMITS,
  VALID_FEATURES,
  FEATURE_LABELS,
  TOP_UP_PACKS,
} from "../lib/usage";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/usage — full usage summary for the authenticated user
// ---------------------------------------------------------------------------
router.get("/usage", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;

  try {
    const [tierRow] = await db.select().from(userTiers).where(eq(userTiers.userId, userId));
    const tier      = (tierRow?.tier ?? "free") as "free" | "builder" | "pro";
    const limits    = USAGE_LIMITS[tier] ?? USAGE_LIMITS.free;
    const credits   = tierRow?.credits
      ? (() => { try { return JSON.parse(tierRow.credits); } catch { return {}; } })()
      : {};

    const used = await getAllFeatureUsage(userId);

    const features = VALID_FEATURES.map((feature) => ({
      feature,
      label:    FEATURE_LABELS[feature],
      used:     used[feature] ?? 0,
      limit:    limits[feature] ?? 0,
      credits:  credits[feature] ?? 0,
      remaining: Math.max(0, (limits[feature] ?? 0) - (used[feature] ?? 0)) + (credits[feature] ?? 0),
    }));

    res.json({ tier, features });
  } catch (err) {
    console.error("[usage/get]", err);
    res.status(500).json({ error: "Failed to fetch usage." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/topup — purchase top-up credits (stubbed)
// To activate: set STRIPE_SECRET_KEY and create a one-time payment intent
// ---------------------------------------------------------------------------
router.post("/stripe/topup", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { pack } = req.body as { pack?: string };

  if (!pack || !TOP_UP_PACKS[pack]) {
    res.status(400).json({ error: `pack must be one of: ${Object.keys(TOP_UP_PACKS).join(", ")}` });
    return;
  }

  const packInfo = TOP_UP_PACKS[pack];

  console.log("[stripe/topup] Stub purchase:", { userId, pack, packInfo });

  // TODO: Real Stripe one-time payment:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount:   packInfo.priceCents,
  //   currency: "usd",
  //   metadata: { userId, pack },
  // });
  // res.json({ clientSecret: paymentIntent.client_secret });
  // Then confirm via webhook and call addCredits() there.

  try {
    const priorCount = await getPackPurchaseCount(userId, pack);

    if (pack === "builder_boost_bundle") {
      await addCredits(userId, {
        spec_pack:         10,
        companion_message: 50,
        live_render:       10,
        repo_doctor:       3,
      });
      await recordTopupPurchase(userId, pack, null, 0, packInfo.priceCents);
    } else if (packInfo.feature) {
      await addCredits(userId, { [packInfo.feature]: packInfo.amount });
      await recordTopupPurchase(userId, pack, packInfo.feature, packInfo.amount, packInfo.priceCents);
    }

    const newCount = priorCount + 1;
    const nudge    = newCount >= 2;

    res.json({
      success:     true,
      pack,
      label:       packInfo.label,
      description: packInfo.description,
      stub:        true,
      nudge:       nudge ? {
        show:    true,
        message: `You've bought ${packInfo.label} twice this month. Upgrading to the next plan would cost less and give you more every month.`,
      } : null,
    });
  } catch (err) {
    console.error("[stripe/topup]", err);
    res.status(500).json({ error: "Top-up purchase failed." });
  }
});

export default router;
