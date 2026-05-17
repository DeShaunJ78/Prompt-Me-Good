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
  // pricing-rebalance-1 (2026-05-12): added when "vid" became a first-class
  // PmgFeature alongside the per-tier video caps. Existing JSON-fallback
  // rows and Supabase rows from before this column existed will read back
  // as undefined → applyDelta() / reserveUserDay() coerce to 0 via the
  // `(updated[feature] || 0)` guard, so older rows are forward-compatible
  // without a backfill. Optional to avoid breaking the JSON-fallback shape.
  vid?: number;
  // cap-compare-1 (2026-05-13): per-user daily counter for the gpt-4.1
  // teaser preview returned in the /api/run 429 body when a free user
  // hits their Run cap. Capped at TEASER_DAILY_CAP (1/day). Optional
  // for the same forward-compat reason as `vid?` above.
  teaser?: number;
  // premium-model-sub-cap-1 (2026-05-17): per-user daily counter for
  // GPT-5 calls (Pro Studio only, across Run With AI + Expert Command
  // Center). Capped at PRO_STUDIO_GPT5_DAILY_CAP (25/day). Optional
  // for the same forward-compat reason as `vid?` / `teaser?` above.
  gpt5?: number;
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
      .select("usage_date, run_count, img_count, analyze_count, vid_count, gpt5_count")
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
      return { date, run: 0, img: 0, analyze: 0, vid: 0, gpt5: 0 };
    }
    const row = data as {
      usage_date: string;
      run_count: number | null;
      img_count: number | null;
      analyze_count: number | null;
      vid_count: number | null;
      // premium-model-sub-cap-1 (2026-05-17): nullable to remain
      // forward-compatible with databases that have not yet applied
      // migration 002_user_usage_gpt5.sql.
      gpt5_count: number | null;
    };
    return {
      date: row.usage_date,
      run: row.run_count ?? 0,
      img: row.img_count ?? 0,
      analyze: row.analyze_count ?? 0,
      vid: row.vid_count ?? 0,
      gpt5: row.gpt5_count ?? 0,
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
            vid_count: row.vid ?? 0,
            // premium-model-sub-cap-1 (2026-05-17): persisted alongside
            // the other counters. If migration 002_user_usage_gpt5.sql
            // has not been applied yet, Supabase will reject the column
            // with PGRST204 / 42703 — caught generically below and
            // logged; the JSON fallback still records the value.
            gpt5_count: row.gpt5 ?? 0,
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
        ? { ...fallback, vid: fallback.vid ?? 0, gpt5: fallback.gpt5 ?? 0 }
        : { date, run: 0, img: 0, analyze: 0, vid: 0, gpt5: 0 };
  }
  cache.set(key, { expires: now + CACHE_TTL_MS, row });
  return row;
}

/** Per-key serialization queue. All read-modify-write operations for the
 *  same `${userId}:${date}` are chained on a single Promise so checks and
 *  increments are atomic within this server process — no increments are
 *  lost and no concurrent request can squeeze past the cap. */
const keyLocks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  keyLocks.set(key, next);
  void next.finally(() => {
    if (keyLocks.get(key) === next) keyLocks.delete(key);
  });
  return next;
}

function applyDelta(
  key: string,
  date: string,
  current: UserDay,
  feature: PmgFeature,
  n: number,
): UserDay {
  const updated: UserDay = { ...current, date };
  updated[feature] = (updated[feature] || 0) + n;
  pendingWrites.set(key, updated);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, row: updated });
  scheduleFlush();
  return updated;
}

/** Increment the per-user, per-day counter for `feature` by `n` (default 1).
 *  Serialized per (userId, date) so concurrent calls cannot lose increments. */
export async function bumpUserDay(
  userId: string,
  feature: PmgFeature,
  n = 1,
): Promise<UserDay> {
  const date = todayKey();
  const key = cacheKey(userId, date);
  return withLock(key, async () => {
    const current = await getUserDay(userId);
    return applyDelta(key, date, current, feature, n);
  });
}

/** Reserve `n` units of `feature` for `userId` if doing so would not
 *  exceed `cap`. Atomic per (userId, date): the check and the increment
 *  happen inside the same per-key mutex, so under concurrent requests no
 *  caller can squeeze past the cap. Returns the new row on success or
 *  null when the reservation would exceed the cap. */
export async function reserveUserDay(
  userId: string,
  feature: PmgFeature,
  n: number,
  cap: number,
): Promise<UserDay | null> {
  const date = todayKey();
  const key = cacheKey(userId, date);
  return withLock(key, async () => {
    const current = await getUserDay(userId);
    if ((current[feature] || 0) + n > cap) return null;
    return applyDelta(key, date, current, feature, n);
  });
}

/** Refund a previously reserved `n` units of `feature` (e.g. when the
 *  underlying request failed and the work wasn't actually performed).
 *  Clamped at zero so a refund can never produce a negative counter. */
export async function refundUserDay(
  userId: string,
  feature: PmgFeature,
  n: number,
): Promise<UserDay> {
  const date = todayKey();
  const key = cacheKey(userId, date);
  return withLock(key, async () => {
    const current = await getUserDay(userId);
    const updated: UserDay = { ...current, date };
    updated[feature] = Math.max(0, (updated[feature] || 0) - n);
    pendingWrites.set(key, updated);
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, row: updated });
    scheduleFlush();
    return updated;
  });
}
