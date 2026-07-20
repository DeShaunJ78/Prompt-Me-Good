/* ============================================================================
 * supabase-health.ts
 *
 * Lightweight Supabase reachability probe. Used by two consumers:
 *   1. GET /health — returns {supabase: "ok"|"degraded"|"down"} alongside
 *      the API's own status so operators and monitors can tell when auth is
 *      broken without waiting for a user complaint.
 *   2. supabase-keepalive.ts — ping-on-schedule to prevent free-tier
 *      auto-pause (Supabase pauses projects after ~1 week of inactivity).
 *
 * The probe hits `${SUPABASE_URL}/auth/v1/health` — Supabase's documented
 * public health endpoint that does NOT require an API key and responds
 * ~200ms from a warm project. NXDOMAIN / connection refused / 5xx → "down".
 *
 * Caches the last result for CACHE_MS so /health under load never fans out
 * dozens of upstream calls. A single in-flight dedup prevents thundering-herd
 * on simultaneous /health checks.
 * ============================================================================ */

import { logger } from "./logger";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
/* The anon key is the public key already shipped to browsers via
   /api/public-config. Safe to use in a server-side probe header. */
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? "";
const PROBE_TIMEOUT_MS = 5_000;
const CACHE_MS = 30_000; /* 30 s — fresh enough for monitors, cheap enough */

type SupabaseHealthStatus = "ok" | "degraded" | "down" | "unconfigured";

interface CachedResult {
  status: SupabaseHealthStatus;
  latencyMs: number | null;
  checkedAt: number;
}

let _cache: CachedResult | null = null;
let _inflight: Promise<CachedResult> | null = null;

async function _probe(): Promise<CachedResult> {
  const checkedAt = Date.now();

  if (!SUPABASE_URL) {
    return { status: "unconfigured", latencyMs: null, checkedAt };
  }

  const url = `${SUPABASE_URL}/auth/v1/health`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  const t0 = Date.now();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (SUPABASE_ANON_KEY) headers["apikey"] = SUPABASE_ANON_KEY;
    const resp = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers,
    });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;

    if (resp.ok) {
      const result: CachedResult = { status: "ok", latencyMs, checkedAt };
      _cache = result;
      return result;
    }

    // 5xx from Supabase infra itself = degraded
    const result: CachedResult = { status: "degraded", latencyMs, checkedAt };
    _cache = result;
    logger.warn({ statusCode: resp.status, latencyMs }, "Supabase health probe: degraded");
    return result;
  } catch (err: unknown) {
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    const result: CachedResult = { status: "down", latencyMs: null, checkedAt };
    _cache = result;
    logger.error({ err: msg, latencyMs }, "Supabase health probe: down");
    return result;
  }
}

/**
 * Probe Supabase health. Returns cached result if fresh enough, otherwise
 * deduplicates concurrent callers into a single upstream fetch.
 */
export async function checkSupabaseHealth(): Promise<CachedResult> {
  const now = Date.now();
  if (_cache && now - _cache.checkedAt < CACHE_MS) return _cache;
  if (_inflight) return _inflight;
  _inflight = _probe().finally(() => { _inflight = null; });
  return _inflight;
}

/**
 * Fire-and-forget keep-alive ping. Logs result but does not throw.
 * Used by the keep-alive scheduler so a transient error never crashes the
 * server; the scheduler will retry on the next interval.
 */
export async function pingSupabase(): Promise<void> {
  try {
    /* Bypass cache for the keep-alive — we want a real ping each time. */
    _cache = null;
    const result = await checkSupabaseHealth();
    if (result.status === "ok") {
      logger.info({ latencyMs: result.latencyMs }, "Supabase keep-alive ping: ok");
    } else {
      logger.warn({ status: result.status }, "Supabase keep-alive ping: unhealthy");
    }
  } catch (err) {
    logger.error({ err }, "Supabase keep-alive ping threw");
  }
}
