/* ============================================================================
 * Per-user daily cap middleware.
 * ----------------------------------------------------------------------------
 * Enforces plan-aware (Free / Trial / Founding / Pro) per-user daily caps on
 * gated AI endpoints (Run With AI, image generation). Trial start is derived
 * from the authoritative `auth.users.created_at` timestamp on the user's
 * Supabase account — NOT the browser's localStorage — so the trial cannot be
 * reset by clearing browser data.
 *
 * Behavior:
 *   - Anonymous request (no `Authorization` header): pass through. Existing
 *     IP rate limit + global cost guard handle anonymous abuse.
 *   - Signed-in Founding / Pro: enforced against fair-use caps.
 *   - Signed-in Free user, in 7-day trial: enforce trial caps (10/5/3).
 *   - Signed-in Free user, after trial: enforce standard caps (3/1/1).
 *   - Counter increments only on a successful (status < 400) response.
 *
 * Storage: counters live in Supabase `public.user_usage_daily` keyed by
 * `(user_id, usage_date)` — see `lib/usage-store.ts`. A local JSON file
 * is used as a graceful fallback if the table doesn't exist yet.
 * ============================================================================ */
import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase-admin";
import { logger } from "../lib/logger";
import { isOwnerUserId } from "../lib/paywall";
import {
  effectiveCaps,
  type PmgCapFeature,
  type PmgPlan,
} from "../lib/pricing-config";
import { refundUserDay, reserveUserDay } from "../lib/usage-store";

const JWT_CACHE_TTL_MS = 60_000;

interface CachedUser {
  expires: number;
  userId: string;
  email: string;
  plan: PmgPlan;
  createdAtMs: number;
}

const jwtCache = new Map<string, CachedUser>();

export async function resolveUserFromJwt(jwt: string): Promise<CachedUser | null> {
  const now = Date.now();
  const cached = jwtCache.get(jwt);
  if (cached && cached.expires > now) return cached;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !data?.user) return null;
    const u = data.user;
    const createdAtMs = u.created_at ? new Date(u.created_at).getTime() : Date.now();
    let plan: PmgPlan = "free";
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("user_id", u.id)
        .maybeSingle();
      const p = (prof as { plan?: string } | null)?.plan;
      if (p === "founding" || p === "pro" || p === "pro_studio") plan = p;
    } catch {
      /* profile lookup is best-effort; default to "free" */
    }
    const entry: CachedUser = {
      expires: now + JWT_CACHE_TTL_MS,
      userId: u.id,
      email: u.email || "",
      plan,
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
    };
    jwtCache.set(jwt, entry);
    if (jwtCache.size > 5000) {
      for (const [k, v] of jwtCache) {
        if (v.expires <= now) jwtCache.delete(k);
      }
    }
    return entry;
  } catch (err) {
    logger.warn({ err }, "userCaps: resolve user failed");
    return null;
  }
}

export interface UserCapsRequest extends Request {
  pmgUser?: CachedUser;
}

/** Express middleware factory: enforces per-user, per-plan daily caps for
 *  the given feature. Anonymous and unauthenticated requests pass through
 *  (existing IP rate limits still apply). The cost can be a fixed number
 *  or a function of the request body — used by /image where one HTTP
 *  request may produce 1–4 images and must charge the cap accordingly. */
export function userCapEnforce(
  feature: PmgCapFeature,
  cost: number | ((req: Request) => number) = 1,
) {
  return async function userCapEnforceMiddleware(
    req: UserCapsRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = req.headers.authorization || "";
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) {
      next();
      return;
    }
    const ctx = await resolveUserFromJwt(m[1]!.trim());
    if (!ctx) {
      next();
      return;
    }
    req.pmgUser = ctx;

    /* owner-bypass-1: the configured OWNER_USER_ID always passes through
       every per-user daily cap. No reservation, no refund, no counter
       increment — owner activity simply does not consume the cap. */
    if (isOwnerUserId(ctx.userId)) {
      next();
      return;
    }

    let n = 1;
    try {
      const raw = typeof cost === "function" ? cost(req) : cost;
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
        n = Math.floor(raw);
      }
    } catch (_) {
      n = 1;
    }

    const caps = effectiveCaps(ctx.plan, ctx.createdAtMs);
    // Atomic reserve: under concurrent requests, only enough callers to fill
    // the cap pass through; the rest get 429 immediately. The reservation is
    // refunded if the downstream handler ends up failing (status >= 400) so
    // failed work doesn't burn the user's daily quota.
    const reserved = await reserveUserDay(ctx.userId, feature, n, caps[feature]);
    if (!reserved) {
      // audit-3 §6: enrich the 429 response so the frontend can render an
      // actionable cap-hit UX without hard-coded business logic.
      //   - Retry-After header: seconds until next UTC midnight. Standard
      //     HTTP signal; CDNs, fetch wrappers, and curl all understand it.
      //   - feature / limit / reset_at: lets the upgrade modal say
      //     "you've used N of N today" + "resets at HH:MM your time".
      //   - upgrade_url: the global fetch interceptor (pmg-cap-intercept.js)
      //     uses this so the CTA target is owned by the server, not the
      //     client — one place to change when checkout URLs move.
      const resetAt = new Date();
      resetAt.setUTCHours(24, 0, 0, 0);
      const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        success: false,
        ok: false,
        error: "Daily limit reached for your plan. Resets at midnight UTC.",
        feature,
        limit: caps[feature],
        plan: ctx.plan,
        reset_at: resetAt.toISOString(),
        upgrade_url: "/pricing.html#early-access",
      });
      return;
    }
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        void refundUserDay(ctx.userId, feature, n);
      }
    });
    next();
  };
}
