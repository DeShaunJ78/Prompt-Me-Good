-- ============================================================================
-- PromptMeGood — Per-user daily usage table
-- ----------------------------------------------------------------------------
-- Apply this once in the Supabase SQL Editor. The api-server (`userCaps.ts`)
-- will automatically use it for per-user daily cap tracking. Until the table
-- exists the server falls back to a local JSON file (counters then live only
-- on a single server instance and are lost across restarts).
--
-- Why this exists: the trial start and per-feature daily counters used to
-- live in the browser via localStorage, so a user could clear browser data
-- (or open an incognito window) and reset their trial / daily caps. This
-- table moves both pieces of state to Supabase so they are anchored to the
-- authenticated user and cannot be reset client-side.
-- ============================================================================

create table if not exists public.user_usage_daily (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  usage_date     date        not null,
  run_count      integer     not null default 0,
  img_count      integer     not null default 0,
  analyze_count  integer     not null default 0,
  -- pricing-rebalance-1 (2026-05-12): per-tier video caps require a
  -- first-class video counter. Existing rows get 0 via the column default,
  -- so no backfill is required when this is applied to a database that
  -- already had the table.
  vid_count      integer     not null default 0,
  first_seen_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- Idempotent column add for databases that applied the original migration
-- before the vid_count column was introduced.
alter table public.user_usage_daily
  add column if not exists vid_count integer not null default 0;

-- Service-role writes only. RLS on, no public policies → no direct access
-- from the browser; all reads/writes go through the api-server using the
-- service-role key (same pattern as `profiles`).
alter table public.user_usage_daily enable row level security;

create index if not exists user_usage_daily_user_date_idx
  on public.user_usage_daily (user_id, usage_date desc);
