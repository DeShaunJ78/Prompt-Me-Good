# Threat Model

## Project Overview

PromptMeGood is a production web application with a static frontend in `artifacts/promptmegood/` and an Express API in `artifacts/api-server/`. The backend brokers AI requests to OpenAI, authenticates users with Supabase JWTs, stores commercial and waitlist data in Supabase/PostgreSQL, and manages paid access through Stripe Checkout and Stripe webhooks.

The production-relevant code paths are the static site server (`artifacts/promptmegood/server.mjs`) and the API server (`artifacts/api-server/src/**`). The `artifacts/mockup-sandbox/` app is a development/mockup surface and should be treated as out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — Supabase identities, access tokens, and account-linked plan state. Compromise would allow account takeover or unauthorized paid-feature access.
- **Payment and entitlement state** — Stripe customer IDs, subscription status, Founding Member purchase records, and profile plan fields. Integrity matters because it controls paid access and customer lifecycle state.
- **Prompt and uploaded AI inputs** — user prompts, uploaded files/images, generated outputs, and premium-model access. These may contain sensitive business or personal content.
- **Application secrets** — Supabase service-role key, Stripe secret/webhook secret, OpenAI credentials, SMTP credentials, and database connection strings. Exposure would allow direct compromise of backend-integrated systems.
- **Operational/business data** — waitlist emails, contact-form submissions, usage counters, and founding purchase inventory. This is valuable for both privacy and abuse-prevention reasons.

## Trust Boundaries

- **Browser to API** — all frontend calls into `artifacts/api-server/src/routes/*` cross from untrusted clients into privileged server code. Request bodies, headers, origins, and uploaded files must all be treated as attacker-controlled.
- **API to Supabase/PostgreSQL** — the API holds service-level database privileges and writes commercial/account state. Injection or broken authorization here can expose or alter protected data across users.
- **API to Stripe** — the backend creates checkout sessions and consumes Stripe-signed webhooks. Any failure to validate redirect targets, metadata linkage, or webhook authenticity can corrupt paid entitlement state.
- **API to OpenAI and other external services** — prompt content and uploaded files cross to third parties. Expensive or privileged model calls must be rate-limited and plan-gated server-side.
- **Public to authenticated boundary** — some routes are intentionally anonymous (`/health`, public config, waitlist/contact/founding checkout), while account/profile/billing surfaces require a valid Supabase JWT. This boundary must be enforced server-side, not inferred from client UI.
- **Production to dev-only boundary** — `artifacts/mockup-sandbox/`, historical checkpoints, generated `dist/`, and local tooling are not production attack surface unless explicitly served in production.

## Scan Anchors

- **Production entry points** — `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/promptmegood/server.mjs`.
- **Highest-risk code areas** — `artifacts/api-server/src/routes/ai.ts`, `routes/billing.ts`, `routes/founding-checkout.ts`, `routes/stripe-webhook.ts`, `lib/auth.ts`, `lib/supabase-admin.ts`, `lib/usage-store.ts`.
- **Public surfaces** — `/health`, `/api/public-config`, `/api/pricing-config.js`, `/api/waitlist`, `/api/contact`, `/api/founding-checkout`, static HTML/JS under `artifacts/promptmegood/`.
- **Authenticated surfaces** — `/api/create-checkout-session`, `/api/me/profile`, `/api/usage/check`, and authenticated AI routes that accept Bearer Supabase JWTs.
- **Usually dev-only / ignore unless reachable** — `artifacts/mockup-sandbox/**`, `.pmg-checkpoints/**`, generated `dist/**`, local helper scripts, and review route paths gated behind `NODE_ENV !== 'production'`.

## Threat Categories

### Spoofing

The application trusts Supabase JWTs for authenticated API access and Stripe signatures for webhook state changes. Protected endpoints must require a valid bearer token and bind any returned or mutated data to the authenticated user. Webhook processing must only accept Stripe-signed payloads and must not trust user-controllable metadata without additional integrity checks.

### Tampering

Attackers can tamper with request bodies for pricing tiers, AI options, uploaded files, checkout flows, and plan-related state transitions. The backend must compute entitlements, caps, pricing decisions, and redirect targets server-side, and must treat client-provided fields as hints rather than authority.

### Information Disclosure

The backend handles prompts, uploaded content, waitlist/contact data, payment metadata, and service-role-backed database access. Responses, logs, and public configuration endpoints must not expose secrets, cross-user data, or privileged internal state. Any browser-shipped configuration must be explicitly publishable.

### Denial of Service / Economic Abuse

Public AI-adjacent endpoints, checkout/session creation, contact/waitlist forms, and external-provider calls are all abuse targets. The application must enforce server-side rate limits, per-user caps, and bounded input sizes so anonymous or low-tier users cannot trigger unbounded model spend, email spam, or expensive external calls.

### Elevation of Privilege

Because the backend carries Supabase service-role privileges and controls payment entitlements, broken authorization, IDOR-style lookups, or trust in client-side plan state can give a user access to other users’ data or paid features. All account, billing, and usage operations must be scoped to the authenticated principal and all privilege changes must originate from trusted server-side workflows.