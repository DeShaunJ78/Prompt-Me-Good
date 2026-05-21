import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userTiers } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

const VALID_BUILDER_TYPES    = ["web_app", "website", "mobile", "game", "ai", "unsure"] as const;
const VALID_EXPERIENCE_LEVELS = ["beginner", "some", "comfortable", "experienced"] as const;

// ---------------------------------------------------------------------------
// GET /api/onboarding — fetch onboarding status for the signed-in user
// ---------------------------------------------------------------------------
router.get("/onboarding", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  try {
    const [row] = await db
      .select({
        onboardingComplete: userTiers.onboardingComplete,
        builderType:        userTiers.builderType,
        experienceLevel:    userTiers.experienceLevel,
      })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    res.json({
      onboardingComplete: row?.onboardingComplete ?? false,
      builderType:        row?.builderType        ?? null,
      experienceLevel:    row?.experienceLevel    ?? null,
    });
  } catch (err) {
    console.error("[onboarding/get]", err);
    res.status(500).json({ error: "Failed to fetch onboarding status." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/onboarding — save builder type + experience level, mark complete
// ---------------------------------------------------------------------------
router.post("/onboarding", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { builderType, experienceLevel } = req.body as {
    builderType?:     string;
    experienceLevel?: string;
  };

  if (!builderType || !(VALID_BUILDER_TYPES as readonly string[]).includes(builderType)) {
    res.status(400).json({ error: `builderType must be one of: ${VALID_BUILDER_TYPES.join(", ")}` });
    return;
  }
  if (!experienceLevel || !(VALID_EXPERIENCE_LEVELS as readonly string[]).includes(experienceLevel)) {
    res.status(400).json({ error: `experienceLevel must be one of: ${VALID_EXPERIENCE_LEVELS.join(", ")}` });
    return;
  }

  try {
    const [existing] = await db
      .select({ userId: userTiers.userId })
      .from(userTiers)
      .where(eq(userTiers.userId, userId));

    if (existing) {
      await db.update(userTiers)
        .set({ onboardingComplete: true, builderType, experienceLevel, updatedAt: new Date() })
        .where(eq(userTiers.userId, userId));
    } else {
      await db.insert(userTiers)
        .values({
          userId,
          tier:               "free",
          specPacksThisMonth: 0,
          monthResetAt:       new Date(),
          credits:            "{}",
          onboardingComplete: true,
          builderType,
          experienceLevel,
        });
    }

    res.json({ success: true, builderType, experienceLevel });
  } catch (err) {
    console.error("[onboarding/post]", err);
    res.status(500).json({ error: "Failed to save onboarding." });
  }
});

export default router;
