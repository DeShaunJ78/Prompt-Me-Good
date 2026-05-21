import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userTiers } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { USAGE_LIMITS } from "../lib/usage";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

const VALID_TIERS = ["free", "builder", "pro"] as const;
type Tier = (typeof VALID_TIERS)[number];

const SPEC_PACK_LIMITS: Record<Tier, number> = {
  free:    USAGE_LIMITS.free.spec_pack,
  builder: USAGE_LIMITS.builder.spec_pack,
  pro:     USAGE_LIMITS.pro.spec_pack,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isFounderActiveNow(row: { founderAccess: boolean; founderAccessExpiry: Date | null }): boolean {
  return row.founderAccess && !!row.founderAccessExpiry && new Date() < new Date(row.founderAccessExpiry);
}

function founderDaysRemaining(row: { founderAccessExpiry: Date | null }): number {
  if (!row.founderAccessExpiry) return 0;
  return Math.max(0, Math.ceil((new Date(row.founderAccessExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function hasFullAccess(row: { isAdmin: boolean; founderAccess: boolean; founderAccessExpiry: Date | null }): boolean {
  return row.isAdmin || isFounderActiveNow(row);
}

// ---------------------------------------------------------------------------
// Upsert a tier row (creates with defaults if missing)
// ---------------------------------------------------------------------------
async function getOrCreateTier(userId: string) {
  const [existing] = await db
    .select()
    .from(userTiers)
    .where(eq(userTiers.userId, userId));

  if (existing) {
    const lastReset = new Date(existing.monthResetAt);
    const now       = new Date();
    if (
      lastReset.getMonth()    !== now.getMonth() ||
      lastReset.getFullYear() !== now.getFullYear()
    ) {
      const [reset] = await db
        .update(userTiers)
        .set({ specPacksThisMonth: 0, monthResetAt: now, updatedAt: now })
        .where(eq(userTiers.userId, userId))
        .returning();
      return reset;
    }
    return existing;
  }

  const [created] = await db
    .insert(userTiers)
    .values({ userId, tier: "free", specPacksThisMonth: 0, monthResetAt: new Date() })
    .returning();
  return created;
}

// ---------------------------------------------------------------------------
// Shared response builder
// ---------------------------------------------------------------------------
function buildTierResponse(row: Awaited<ReturnType<typeof getOrCreateTier>>) {
  const fullAccess     = hasFullAccess(row);
  const founderActive  = isFounderActiveNow(row);
  const effectiveTier  = (fullAccess ? "pro" : row.tier) as Tier;
  const limit          = fullAccess ? Infinity : (SPEC_PACK_LIMITS[effectiveTier] ?? 3);

  return {
    tier:                 effectiveTier,
    rawTier:              row.tier,
    isAdmin:              row.isAdmin,
    founderAccess:        row.founderAccess,
    founderAccessExpiry:  row.founderAccessExpiry,
    isFounderActive:      founderActive,
    founderDaysLeft:      founderActive ? founderDaysRemaining(row) : 0,
    hasFullAccess:        fullAccess,
    specPacksThisMonth:   row.specPacksThisMonth,
    specPacksLimit:       limit === Infinity ? null : limit,
    canGenerateSpec:      fullAccess || limit === Infinity || row.specPacksThisMonth < limit,
  };
}

// ---------------------------------------------------------------------------
// GET /api/tier
// ---------------------------------------------------------------------------
router.get("/tier", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  try {
    const row = await getOrCreateTier(userId);
    res.json(buildTierResponse(row));
  } catch (err) {
    console.error("[tier/get]", err);
    res.status(500).json({ error: "Failed to fetch tier." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/tier — set tier
// ---------------------------------------------------------------------------
router.put("/tier", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { tier } = req.body as { tier?: string };

  if (!tier || !VALID_TIERS.includes(tier as Tier)) {
    res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` });
    return;
  }

  try {
    const [existing] = await db
      .select({ userId: userTiers.userId })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    let row;
    if (existing) {
      [row] = await db
        .update(userTiers)
        .set({ tier, updatedAt: new Date() })
        .where(eq(userTiers.userId, userId))
        .returning();
    } else {
      [row] = await db
        .insert(userTiers)
        .values({ userId, tier, specPacksThisMonth: 0, monthResetAt: new Date() })
        .returning();
    }

    res.json(buildTierResponse(row));
  } catch (err) {
    console.error("[tier/set]", err);
    res.status(500).json({ error: "Failed to update tier." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tier/increment-usage
// ---------------------------------------------------------------------------
router.post("/tier/increment-usage", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  try {
    const row = await getOrCreateTier(userId);

    // Admins and active founders have unlimited access — always allow
    if (hasFullAccess(row)) {
      res.json(buildTierResponse(row));
      return;
    }

    const effectiveTier = row.tier as Tier;
    const limit = SPEC_PACK_LIMITS[effectiveTier] ?? 3;

    if (limit !== Infinity && row.specPacksThisMonth >= limit) {
      res.status(403).json({
        error: "Monthly spec pack limit reached. Upgrade to Builder for more packs.",
        tier:  row.tier,
        limit,
        used:  row.specPacksThisMonth,
      });
      return;
    }

    const [updated] = await db
      .update(userTiers)
      .set({ specPacksThisMonth: row.specPacksThisMonth + 1, updatedAt: new Date() })
      .where(eq(userTiers.userId, userId))
      .returning();

    res.json(buildTierResponse(updated));
  } catch (err) {
    console.error("[tier/increment]", err);
    res.status(500).json({ error: "Failed to record usage." });
  }
});

export default router;
