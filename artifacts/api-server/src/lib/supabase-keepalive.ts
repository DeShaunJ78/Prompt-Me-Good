/* ============================================================================
 * supabase-keepalive.ts
 *
 * Prevents Supabase free-tier auto-pause by pinging the project's auth health
 * endpoint on a schedule shorter than the 7-day inactivity window.
 *
 * Schedule: every 3 days (259,200,000 ms). First ping fires 60 s after boot
 * so it doesn't slow the server startup critical path, then repeats on the
 * interval. The interval is unref()'d so it never prevents clean process exit.
 *
 * Only active when:
 *   - SUPABASE_URL is set (no-ops in test/CI environments that don't have it)
 *   - NODE_ENV is "production" OR PMG_SUPABASE_KEEPALIVE=1 is explicitly set
 *     (opt-in for local testing without spamming Supabase in dev)
 *
 * To disable: set PMG_SUPABASE_KEEPALIVE=0 in Replit Secrets.
 * ============================================================================ */

import { pingSupabase } from "./supabase-health";
import { logger } from "./logger";

const PING_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; /* 3 days */
const INITIAL_DELAY_MS = 60_000; /* 60 s after boot */

export function startSupabaseKeepalive(): void {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const explicit = process.env["PMG_SUPABASE_KEEPALIVE"];
  const isProd = (process.env["NODE_ENV"] ?? "development") === "production";

  if (!supabaseUrl) return; /* nothing to keep alive */
  if (explicit === "0") return; /* explicitly disabled */
  if (!isProd && explicit !== "1") return; /* dev/preview: opt-in only */

  logger.info(
    { intervalDays: PING_INTERVAL_MS / 86_400_000, initialDelayS: INITIAL_DELAY_MS / 1000 },
    "Supabase keep-alive scheduler started",
  );

  /* First ping after a short delay so boot isn't blocked. */
  const initialTimer = setTimeout(async () => {
    await pingSupabase();

    /* Then repeat every PING_INTERVAL_MS. */
    const interval = setInterval(pingSupabase, PING_INTERVAL_MS);
    /* unref: the interval must not prevent process.exit() during clean shutdown. */
    if (typeof interval.unref === "function") interval.unref();
  }, INITIAL_DELAY_MS);

  if (typeof initialTimer.unref === "function") initialTimer.unref();
}
