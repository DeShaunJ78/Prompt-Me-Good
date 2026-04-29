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

## 3. Create The `profiles` Table For Stripe Subscriptions

The Stripe webhook handler writes subscription state to a `profiles` table.
In **SQL Editor → New Query**, run:

```sql
-- One row per authenticated user. Created lazily by the API server on the
-- first checkout request, then kept in sync by the Stripe webhook.
create table if not exists public.profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  email                text,
  plan                 text not null default 'free',
  stripe_customer_id   text unique,
  stripe_subscription_id text,
  subscription_status  text,
  current_period_end   timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);

-- Lock the table down: only the row owner may read it from the browser. The
-- API server uses the SERVICE-ROLE key (bypasses RLS) to write subscription
-- state from the webhook.
alter table public.profiles enable row level security;

drop policy if exists "Users Can Read Own Profile" on public.profiles;
create policy "Users Can Read Own Profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);
```

**Important:** the browser does NOT need write access to `profiles`. The
api-server is the only writer, via the Stripe webhook + the
`/api/create-checkout-session` route. Do not add an INSERT or UPDATE policy
for the authenticated role.

## 4. Configure The Stripe Webhook Endpoint

In your Stripe dashboard, **Developers → Webhooks → Add endpoint**:

- **Endpoint URL:** `https://www.promptmegood.com/api/stripe-webhook`
  (Use your Replit dev URL `https://<your-dev-domain>/api/stripe-webhook` while testing.)
- **Listen to:** select these four events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

After saving, click **Reveal signing secret** and copy the `whsec_…` value
into the Replit Secret named `STRIPE_WEBHOOK_SECRET`.

For local testing, run `stripe listen --forward-to https://<your-dev-domain>/api/stripe-webhook`
and use the temporary signing secret it prints.

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
