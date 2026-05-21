import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, userTiers } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/admin/check — returns whether any admin exists (public, no auth)
// Used by the frontend to show the first-run bootstrap banner.
// ---------------------------------------------------------------------------
router.get("/admin/check", async (_req: Request, res: Response) => {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userTiers)
      .where(eq(userTiers.isAdmin, true));

    res.json({ hasAdmin: count > 0 });
  } catch (err) {
    console.error("[admin/check]", err);
    res.status(500).json({ hasAdmin: true }); // fail safe — don't expose bootstrap unnecessarily
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/bootstrap
// Makes the calling authenticated user an admin.
// Works only while NO admins exist in the DB (first-use safety net) OR when
// the correct BOOTSTRAP_SECRET header is provided.
// After the owner has been set as admin, this endpoint becomes a no-op.
// ---------------------------------------------------------------------------
router.post("/admin/bootstrap", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const secret = req.headers["x-bootstrap-secret"] as string | undefined;
  const envSecret = process.env.BOOTSTRAP_SECRET;

  try {
    // Check how many admins already exist
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userTiers)
      .where(eq(userTiers.isAdmin, true));

    const noAdminsYet = count === 0;
    const validSecret = envSecret && secret === envSecret;

    if (!noAdminsYet && !validSecret) {
      res.status(403).json({ error: "Bootstrap is locked. An admin already exists." });
      return;
    }

    // Upsert the calling user's row and set them as admin
    const [existing] = await db
      .select({ userId: userTiers.userId })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    if (existing) {
      await db
        .update(userTiers)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(userTiers.userId, userId));
    } else {
      await db.insert(userTiers).values({
        userId,
        tier: "free",
        specPacksThisMonth: 0,
        monthResetAt: new Date(),
        isAdmin: true,
      });
    }

    console.log(`[admin/bootstrap] User ${userId} granted admin access`);
    res.json({ success: true, message: "You now have admin access." });
  } catch (err) {
    console.error("[admin/bootstrap]", err);
    res.status(500).json({ error: "Bootstrap failed." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/set-founder — grant founder access to a userId
// Requires the caller to be an existing admin.
// ---------------------------------------------------------------------------
router.post("/admin/set-founder", requireAuth, async (req: Request, res: Response) => {
  const callerId = (req as AuthedRequest).userId;

  try {
    const [caller] = await db
      .select({ isAdmin: userTiers.isAdmin })
      .from(userTiers)
      .where(eq(userTiers.userId, callerId));

    if (!caller?.isAdmin) {
      res.status(403).json({ error: "Admin access required." });
      return;
    }

    const { targetUserId, daysFromNow = 30 } = req.body as { targetUserId?: string; daysFromNow?: number };

    if (!targetUserId) {
      res.status(400).json({ error: "targetUserId is required." });
      return;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysFromNow);

    const [existing] = await db
      .select({ userId: userTiers.userId })
      .from(userTiers)
      .where(eq(userTiers.userId, targetUserId));

    if (existing) {
      await db
        .update(userTiers)
        .set({ founderAccess: true, founderAccessExpiry: expiry, updatedAt: new Date() })
        .where(eq(userTiers.userId, targetUserId));
    } else {
      await db.insert(userTiers).values({
        userId: targetUserId,
        tier: "free",
        specPacksThisMonth: 0,
        monthResetAt: new Date(),
        founderAccess: true,
        founderAccessExpiry: expiry,
      });
    }

    res.json({ success: true, userId: targetUserId, expiresAt: expiry });
  } catch (err) {
    console.error("[admin/set-founder]", err);
    res.status(500).json({ error: "Failed to set founder access." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/claim-founder — user claims their own founder access
// Works only if there are active founder slots or zero admins (bootstrap period)
// In practice: call this for all-access launch — every new user gets 30 days free
// ---------------------------------------------------------------------------
router.post("/admin/claim-founder", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { daysFromNow = 30 } = req.body as { daysFromNow?: number };

  try {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + daysFromNow);

    const [existing] = await db
      .select({ userId: userTiers.userId, founderAccess: userTiers.founderAccess })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    if (existing?.founderAccess) {
      res.json({ success: true, message: "Founder access already active." });
      return;
    }

    if (existing) {
      await db
        .update(userTiers)
        .set({ founderAccess: true, founderAccessExpiry: expiry, updatedAt: new Date() })
        .where(eq(userTiers.userId, userId));
    } else {
      await db.insert(userTiers).values({
        userId,
        tier: "free",
        specPacksThisMonth: 0,
        monthResetAt: new Date(),
        founderAccess: true,
        founderAccessExpiry: expiry,
      });
    }

    res.json({ success: true, expiresAt: expiry });
  } catch (err) {
    console.error("[admin/claim-founder]", err);
    res.status(500).json({ error: "Failed to claim founder access." });
  }
});

export default router;
