/* ============================================================================
 * GET /api/usage/check
 * ----------------------------------------------------------------------------
 * Returns the current authenticated user's daily usage, effective per-plan
 * caps, and trial state. Counters and trial start are server-authoritative
 * (Supabase `user_usage_daily` + `auth.users.created_at`) so the response
 * cannot be manipulated by clearing browser localStorage.
 *
 * Auth: requires `Authorization: Bearer <supabase_jwt>`.
 *   - Anonymous → 401 (the frontend keeps its localStorage logic for
 *     anonymous visitors as a soft UI gate).
 *
 * Response shape:
 *   {
 *     ok: true,
 *     plan: "free" | "founding" | "pro",
 *     trial: { active: boolean, days_left: number, total_days: number },
 *     caps:  { run: number, img: number, analyze: number },
 *     used:  { run: number, img: number, analyze: number },
 *     remaining: { run: number, img: number, analyze: number },
 *     resets_at: ISO-8601 string (next UTC midnight)
 *   }
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { resolveUserFromJwt } from "../middlewares/userCaps";
import { getUserDay } from "../lib/usage-store";
import {
  effectiveCaps,
  isInTrial,
  trialDaysLeft,
  PMG_PRICING,
} from "../lib/pricing-config";

const router: IRouter = Router();

router.get("/usage/check", async (req, res) => {
  const header = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    res.status(401).json({ ok: false, error: "Missing Authorization header." });
    return;
  }
  const ctx = await resolveUserFromJwt(m[1]!.trim());
  if (!ctx) {
    res.status(401).json({ ok: false, error: "Invalid or expired token." });
    return;
  }

  const caps = effectiveCaps(ctx.plan, ctx.createdAtMs);
  const used = await getUserDay(ctx.userId);
  const remaining = {
    run: Math.max(0, caps.run - used.run),
    img: Math.max(0, caps.img - used.img),
    analyze: Math.max(0, caps.analyze - used.analyze),
  };

  const now = new Date();
  const tomorrowUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    plan: ctx.plan,
    trial: {
      active: ctx.plan === "free" && isInTrial(ctx.createdAtMs),
      days_left: ctx.plan === "free" ? trialDaysLeft(ctx.createdAtMs) : 0,
      total_days: PMG_PRICING.TRIAL_DAYS,
    },
    caps,
    used: { run: used.run, img: used.img, analyze: used.analyze },
    remaining,
    resets_at: tomorrowUtc.toISOString(),
  });
});

export default router;
