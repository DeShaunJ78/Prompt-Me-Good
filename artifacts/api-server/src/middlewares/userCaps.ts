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
 *   - Signed-in Founding / Pro: pass through. Fair-use caps stay in the
 *     existing rateLimit + costGuard layer (untouched).
 *   - Signed-in Free user, in 7-day trial: enforce trial caps (10/5/3).
 *   - Signed-in Free user, after trial: enforce standard caps (3/1/1).
 *   - Counter increments only on a successful (status < 400) response.
 *
 * Storage: in-memory `Map` flushed to `data/pmg_user_usage.json` (mirrors
 * the cost-guard pattern). Per-user, per-day, per-feature counters. No
 * Supabase schema changes — this lives entirely server-side.
 * ============================================================================ */
import * as fs from "node:fs";
import * as path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase-admin";
import { logger } from "../lib/logger";
import {
  effectiveCaps,
  type PmgFeature,
  type PmgPlan,
} from "../lib/pricing-config";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "pmg_user_usage.json");
const FLUSH_MS = 1000;
const JWT_CACHE_TTL_MS = 60_000;

interface UserDay {
  date: string;
  run: number;
  img: number;
  analyze: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFromDisk(): Record<string, UserDay> {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, UserDay>;
    }
  } catch {
    /* file missing or unparseable — start fresh */
  }
  return {};
}

let usage: Record<string, UserDay> = readFromDisk();
let flushTimer: NodeJS.Timeout | null = null;

function flushToDisk(): void {
  flushTimer = null;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(usage));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "user usage write failed",
    );
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flushToDisk, FLUSH_MS);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

function getOrInitDay(userId: string): UserDay {
  const today = todayKey();
  let row = usage[userId];
  if (!row || row.date !== today) {
    row = { date: today, run: 0, img: 0, analyze: 0 };
    usage[userId] = row;
  }
  return row;
}

export function userBump(userId: string, feature: PmgFeature, n = 1): void {
  const row = getOrInitDay(userId);
  row[feature] += n;
  scheduleFlush();
}

export function getUserUsageSnapshot(userId: string): {
  run: number;
  img: number;
  analyze: number;
} {
  const row = getOrInitDay(userId);
  return { run: row.run, img: row.img, analyze: row.analyze };
}

interface CachedUser {
  expires: number;
  userId: string;
  email: string;
  plan: PmgPlan;
  createdAtMs: number;
}

const jwtCache = new Map<string, CachedUser>();

async function resolveUserFromJwt(jwt: string): Promise<CachedUser | null> {
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
      if (p === "founding" || p === "pro") plan = p;
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
 *  the given feature. Anonymous and Founding/Pro users pass through. */
export function userCapEnforce(feature: PmgFeature, n = 1) {
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
    // Every plan has finite daily caps now (founding/pro use higher
    // fair-use limits); enforce against the appropriate cap matrix.
    const caps = effectiveCaps(ctx.plan, ctx.createdAtMs);
    const used = getOrInitDay(ctx.userId)[feature];
    if (used + n > caps[feature]) {
      res.status(429).json({
        success: false,
        ok: false,
        error: "Daily limit reached for your plan. Resets at midnight UTC.",
      });
      return;
    }
    res.on("finish", () => {
      if (res.statusCode < 400) {
        userBump(ctx.userId, feature, n);
      }
    });
    next();
  };
}
