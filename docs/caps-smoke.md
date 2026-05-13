# Backend caps & paywall smoke recipes

Manual verification for the gates added by `caps-enforcement-1`. Run after
any change to `routes/ai.ts`, `middlewares/userCaps.ts`, `lib/paywall.ts`,
or `lib/pricing-config.ts`.

All examples assume the dev preview at `$REPLIT_DEV_DOMAIN`. Replace
`$JWT` with a real Supabase access token (DevTools → Application →
Local Storage → `sb-…-auth-token` → `access_token`).

## Pre-launch (default — `OPEN_BETA_MODE=true`, before `PAYWALL_ACTIVATES_AT`)

`isPaywallActive()` returns `false`. Every new gate must short-circuit
to pass-through. Existing per-user caps still apply.

### 1 — Free-user `/run` cap (3rd call returns 429)

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$REPLIT_DEV_DOMAIN/api/run" \
    -H "Authorization: Bearer $JWT_FREE" \
    -H "Content-Type: application/json" \
    -d '{"goal":"smoke test"}'
done
# Expect: 200, 200, 429
```

### 2 — Expert-tagged `/generate` passes through during beta

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello","feature":"expert"}'
# Expect: 200 (anonymous + Expert tag is fine pre-launch)
```

### 3 — Anonymous `/storyboard` passes through during beta

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/storyboard" \
  -H "Content-Type: application/json" \
  -d '{"goal":"a cat in space"}'
# Expect: 200
```

## Post-launch (set `OPEN_BETA_MODE=false` in a test env)

`isPaywallActive()` returns `true`. The three new gates engage; existing
cap behaviour is unchanged.

### 4 — Anonymous Expert call → 403

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello","feature":"expert"}'
# Expect: 403 with body { error: "upgrade_required", feature: "expert" }
```

### 5 — Free-tier Expert call → 403

```bash
curl -s -X POST "$REPLIT_DEV_DOMAIN/api/generate" \
  -H "Authorization: Bearer $JWT_FREE" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello","feature":"expert"}'
# Expect: 403, body.error === "upgrade_required", body.feature === "expert"
```

### 6 — Generic `/generate` (no `feature` field) still passes through

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello"}'
# Expect: 200 — Auto-Boost / Tuning / generic helpers stay open.
```

### 7 — Free-tier `/storyboard` → 403

```bash
curl -s -X POST "$REPLIT_DEV_DOMAIN/api/storyboard" \
  -H "Authorization: Bearer $JWT_FREE" \
  -H "Content-Type: application/json" \
  -d '{"goal":"a cat in space"}'
# Expect: 403, body.error === "upgrade_required", body.feature === "storyboard"
```

### 8 — Founding/Pro `/storyboard` and `/generate (feature:expert)` → 200

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/storyboard" \
  -H "Authorization: Bearer $JWT_FOUNDING" \
  -H "Content-Type: application/json" \
  -d '{"goal":"a cat in space"}'
# Expect: 200

curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$REPLIT_DEV_DOMAIN/api/generate" \
  -H "Authorization: Bearer $JWT_FOUNDING" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"hello","feature":"expert"}'
# Expect: 200
```

### 9 — Founding daily caps end-to-end (15/8/5/3)

```bash
# Run 16 times → 16th returns 429.
for i in $(seq 1 16); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$REPLIT_DEV_DOMAIN/api/run" \
    -H "Authorization: Bearer $JWT_FOUNDING" \
    -H "Content-Type: application/json" \
    -d '{"goal":"founding cap test"}'
done
# Expect: 200 × 15, then 429.
```

## Reset usage between runs

```bash
# JSON fallback (when Supabase unreachable / dev):
rm -f data/pmg_user_usage.json

# Supabase:
psql "$DATABASE_URL" -c "delete from public.user_usage_daily where user_id='<uuid>';"
```

## Known false-pass

- `/run` includes a free-tier teaser preview in its 429 body (cap-compare-1).
  That's a separate code path from these gates and is not covered here.
- The non-Expert `/generate` family (`/boost`, `/clarify`, `/auto-tune`,
  `/refine-prompt`, `/image-prompt`, `/generate-prompt`) intentionally
  has no per-user cap — IP rate limit only. Don't smoke test cap behavior
  on those endpoints.
