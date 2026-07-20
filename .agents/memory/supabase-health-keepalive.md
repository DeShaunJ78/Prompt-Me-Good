---
name: Supabase health probe and keep-alive
description: How Supabase reachability is monitored and auto-pause prevented; key DNS/auth quirks.
---

## The rule
- `/auth/v1/health` requires the `apikey: <anon_key>` header — plain GET returns 401, NOT a sign the project is down.
- `supabase-health.ts` sends the anon key header (read from `SUPABASE_ANON_KEY` env). Without this the probe always reports "degraded".
- Google public DNS (dns.google) can return NXDOMAIN for the Supabase project host even when Replit's container resolves it fine. NXDOMAIN from a public resolver is NOT conclusive evidence the project is paused — confirm by curling from inside the container.

## Keep-alive
- `supabase-keepalive.ts` pings every 3 days in production (`NODE_ENV=production`). First ping is 60s after boot.
- Opt-in for local testing: `PMG_SUPABASE_KEEPALIVE=1`.
- Timers are `unref()`'d — they never block process exit.

## Health endpoint
- `/api/health` (routes/ai.ts) returns `{status:"ok", supabase:{status, latencyMs, checkedAt}}`.
- Result cached 30s, single-inflight dedup to avoid thundering herd.
- Always HTTP 200 — Supabase down doesn't fail the endpoint (Replit keep-alive must not error).
- The bare `/health` in app.ts was a dead route: the artifact proxy only forwards `/api/*` to the API server.

**Why:** Free-tier Supabase pauses after ~7 days of inactivity. The 3-day ping prevents that. The health sub-field lets UptimeRobot / any HTTP monitor detect auth outages without waiting for user complaints.

**How to apply:** When adding new Supabase-dependent features, use `checkSupabaseHealth()` for status surfacing. When debugging "sign-in broken" reports, check `/api/health → supabase.status` before assuming code issues.
