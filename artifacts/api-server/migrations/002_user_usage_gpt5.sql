-- ============================================================================
-- PromptMeGood — Per-user daily GPT-5 (premium model) counter
-- ----------------------------------------------------------------------------
-- Apply this once in the Supabase SQL Editor after 001_user_usage_daily.sql.
-- Adds gpt5_count to the existing per-user, per-day usage table so the
-- PRO_STUDIO_GPT5_DAILY_CAP daily quota (premium-model-sub-cap-1) is durable
-- across server restarts, cache TTL expirations, and multi-instance deploys.
--
-- Until this migration is applied the api-server keeps tracking gpt5 usage
-- in the in-memory cache + local JSON fallback only — the cap still works
-- on a single instance, but a server restart or 30s cache miss can reset
-- it. Apply this to lock in durable enforcement.
-- ============================================================================

alter table public.user_usage_daily
  add column if not exists gpt5_count integer not null default 0;
