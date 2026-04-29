# Supabase Setup For PromptMeGood

The PromptMeGood account panel ("Save Your Best Prompts") is wired to a
Supabase project via T40 in `public/scripts/pmg-ux.js`. Two one-time
steps in your Supabase dashboard are required before sign-in works.

## 1. Create The `prompts` Table + Row-Level Security Policies

In the Supabase dashboard, open **SQL Editor → New Query** and run:

```sql
-- Create the table that stores every saved prompt.
create table if not exists public.prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  input       text,
  output      text,
  created_at  timestamptz not null default now()
);

-- Index for fast "my prompts, newest first" queries.
create index if not exists prompts_user_id_created_at_idx
  on public.prompts (user_id, created_at desc);

-- Lock the table down: only the owner of each row can read or write it.
alter table public.prompts enable row level security;

-- Read-own policy.
drop policy if exists "Users Can Read Own Prompts" on public.prompts;
create policy "Users Can Read Own Prompts"
  on public.prompts
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert-own policy.
drop policy if exists "Users Can Insert Own Prompts" on public.prompts;
create policy "Users Can Insert Own Prompts"
  on public.prompts
  for insert
  to authenticated
  with check (auth.uid() = user_id);
```

Hit **Run**. You should see `Success. No rows returned.`

## 2. Allowlist Your Site URL For Magic-Link Redirects

PromptMeGood signs users in with a magic link emailed by Supabase.
Supabase will only redirect back to URLs you have explicitly allowlisted.

In the Supabase dashboard, open **Authentication → URL Configuration**
and add the following entries under **Redirect URLs**:

- `https://www.promptmegood.com/`
- `https://promptmegood.com/`
- `http://localhost:5173/` *(or whatever your local dev URL is)*
- The Replit dev preview URL shown in your workspace, e.g.
  `https://<repl>-00-<id>.<region>.replit.dev/`

Set the **Site URL** to your production root, e.g.
`https://www.promptmegood.com`.

Save. Magic-link sign-in is now live.

## How It Works

- The Supabase URL and **publishable** (anon) key live in Replit Secrets
  as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- The API server exposes them at `GET /api/public-config` (it never
  returns service-role keys or any other private credential).
- The browser fetches that config at page load and initializes the
  Supabase client. All sign-in, save, and load happens directly between
  the browser and Supabase — the PromptMeGood backend is not in the
  loop, so no extra rate limiting or cost guarding applies.
- Row-Level Security guarantees a signed-in user can only ever see and
  insert their own rows, even though the publishable key is in the
  browser.

## Where The Code Lives

- API endpoint: `artifacts/api-server/src/routes/public-config.ts`
- Browser SDK loaded via `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">`
  in `artifacts/promptmegood/index.html`
- Account UI + auth + save/load logic: T40 IIFE at the bottom of
  `artifacts/promptmegood/public/scripts/pmg-ux.js`
