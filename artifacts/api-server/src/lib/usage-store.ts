/* ============================================================================
 * Per-user daily usage store.
 * ----------------------------------------------------------------------------
 * Persists per-user, per-day, per-feature counters in Supabase
 * (`public.user_usage_daily`) so the trial and daily caps cannot be reset by
 * clearing browser localStorage.
 *
 * Layered design:
 *   1. In-memory cache (Map keyed by `${userId}:${YYYY-MM-DD}`) — short TTL,
 *      avoids hitting Supabase on every request.
 *   2. Supabase table — primary durable store. Writes are debounced so a
 *      burst of requests doesn't fan out to N round trips.
 *   3. Local JSON file (`data/pmg_user_usage.json`) — fallback when Supabase
 *      is unreachable or the table doesn't exist yet (see migration
 *      `001_user_usage_daily.sql`).
 * ============================================================================ */
import * as fs from "node:fs";
import * as path from "node:path";
import { supabaseAdmin } from "./supabase-admin";
import { logger } from "./logger";
import type { PmgFeature } from "./pricing-config";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "pmg_user_usage.json");
const FLUSH_MS = 1000;
const CACHE_TTL_MS = 30_000;

interface UserDay {
  date: string;
  run: number;
  img: number;
  analyze: number;
}

interface CacheEntry {
  expires: number;
  row: UserDay;
}

const cache = new Map<string, CacheEntry>();
const pendingWrites = new Map<string, UserDay>();
let flushTimer: NodeJS.Timeout | null = null;
let supabaseDisabled = false;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function cacheKey(userId: string, date: string): string {
  return `${userId}:${date}`;
}

/* ---------- Local JSON fallback ---------- */

function readJsonFallback(): Record<string, UserDay> {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, UserDay>;
    }
  } catch {
    /* file missing or unparseable */
  }
  return {};
}

let jsonStore: Record<string, UserDay> = readJsonFallback();

function writeJsonFallback(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(jsonStore));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "usage-store: json fallback write failed",
    );
  }
}

/* ---------- Supabase persistence ---------- */

async function fetchFromSupabase(userId: string, date: string): Promise<UserDay | null> {
  if (supabaseDisabled) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_usage_daily")
      .select("usage_date, run_count, img_count, analyze_count")
      .eq("user_id", userId)
      .eq("usage_date", date)
      .maybeSingle();
    if (error) {
      // PGRST205 = "Could not find the table" → migration not applied yet.
      if (error.code === "PGRST205" || error.code === "42P01") {
        if (!supabaseDisabled) {
          logger.warn(
            "usage-store: user_usage_daily table not found — falling back to JSON file. Apply artifacts/api-server/migrations/001_user_usage_daily.sql.",
          );
        }
        supabaseDisabled = true;
        return null;
      }
      logger.warn({ err: error.message }, "usage-store: supabase fetch failed");
      return null;
    }
    if (!data) {
      return { date, run: 0, img: 0, analyze: 0 };
    }
    const row = data as {
      usage_date: string;
      run_count: number | null;
      img_count: number | null;
      analyze_count: number | null;
    };
    return {
      date: row.usage_date,
      run: row.run_count ?? 0,
      img: row.img_count ?? 0,
      analyze: row.analyze_count ?? 0,
    };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "usage-store: supabase fetch threw",
    );
    return null;
  }
}

async function flushPending(): Promise<void> {
  flushTimer = null;
  if (pendingWrites.size === 0) return;
  const batch = Array.from(pendingWrites.entries());
  pendingWrites.clear();

  // Always persist to JSON as a defense-in-depth fallback.
  for (const [key, row] of batch) {
    const userId = key.split(":")[0]!;
    jsonStore[userId] = row;
  }
  writeJsonFallback();

  if (supabaseDisabled) return;

  for (const [key, row] of batch) {
    const userId = key.split(":")[0]!;
    try {
      const { error } = await supabaseAdmin
        .from("user_usage_daily")
        .upsert(
          {
            user_id: userId,
            usage_date: row.date,
            run_count: row.run,
            img_count: row.img,
            analyze_count: row.analyze,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,usage_date" },
        );
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") {
          if (!supabaseDisabled) {
            logger.warn(
              "usage-store: user_usage_daily table missing on write — falling back to JSON only.",
            );
          }
          supabaseDisabled = true;
          return;
        }
        logger.warn({ err: error.message }, "usage-store: supabase upsert failed");
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : "unknown" },
        "usage-store: supabase upsert threw",
      );
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    void flushPending();
  }, FLUSH_MS);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

/* ---------- Public API ---------- */

/** Get today's counters for `userId`. Reads through cache → Supabase → JSON
 *  fallback. Always returns a finite row (zeros if no entry exists). */
export async function getUserDay(userId: string): Promise<UserDay> {
  const date = todayKey();
  const key = cacheKey(userId, date);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.row;

  // Prefer pending in-memory write (most up-to-date).
  const pending = pendingWrites.get(key);
  if (pending) {
    cache.set(key, { expires: now + CACHE_TTL_MS, row: pending });
    return pending;
  }

  let row = await fetchFromSupabase(userId, date);
  if (!row) {
    const fallback = jsonStore[userId];
    row =
      fallback && fallback.date === date
        ? { ...fallback }
        : { date, run: 0, img: 0, analyze: 0 };
  }
  cache.set(key, { expires: now + CACHE_TTL_MS, row });
  return row;
}

/** Increment the per-user, per-day counter for `feature` by `n` (default 1).
 *  Coalesces writes via a short timer so a burst of requests results in a
 *  single Supabase upsert. Returns the new row. */
export async function bumpUserDay(
  userId: string,
  feature: PmgFeature,
  n = 1,
): Promise<UserDay> {
  const date = todayKey();
  const key = cacheKey(userId, date);
  const current = await getUserDay(userId);
  const next: UserDay = { ...current, date };
  next[feature] = (next[feature] || 0) + n;
  pendingWrites.set(key, next);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, row: next });
  scheduleFlush();
  return next;
}
