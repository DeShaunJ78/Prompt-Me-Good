# Magic-Link Auto-Checkout Smoke Test Results

**Task:** #197 — Confirm magic-link sign-in flow end-to-end  
**Date tested:** 2026-07-21  
**Production domain:** https://www.promptmegood.com

---

## Automated verification (completed)

### Production endpoints — reachable ✅

| Endpoint | Expected | Actual |
|---|---|---|
| `GET https://www.promptmegood.com/app` | HTTP 200 text/html | ✅ 200 (1.4 s) |
| `GET https://www.promptmegood.com/api/health` | HTTP 200 | ✅ 200 |

### Playwright tests (stubbed Supabase/Stripe) — 21/21 pass ✅

Run: `cd artifacts/promptmegood && npx playwright test tests/magic-link*.spec.ts tests/checkout-nudge*.spec.ts tests/already-on-plan*.spec.ts tests/plan-cache*.spec.ts`

| Test file | Tests | Result |
|---|---|---|
| `magic-link-auto-checkout.spec.ts` | 2 | ✅ pass |
| `magic-link-race-condition.spec.ts` | 3 | ✅ pass |
| `checkout-nudge-dismiss.spec.ts` | 4 | ✅ pass |
| `checkout-nudge-stall.spec.ts` | 3 | ✅ pass |
| `already-on-plan-guard.spec.ts` | 5 | ✅ pass |
| `plan-cache-revocation.spec.ts` | 4 | ✅ pass |

**Race condition invariant confirmed (exactly-once):**
- Standard timing (SIGNED_IN at 400 ms, boot-path at 2500 ms): `checkoutCallCount = 1` ✅
- Slow session timing (SIGNED_IN at 3000 ms, after boot-path reset): `checkoutCallCount = 1` ✅

---

## Manual verification required (human action needed)

The following steps require a live email inbox and cannot be automated:

| Step | Status | Notes |
|---|---|---|
| Sign out from `/app` | — | Clear localStorage + cookies first |
| Navigate to `/app?checkout=pro_monthly&ref=pricing` | — | Page should load without firing checkout |
| Submit email → request magic link | — | Requires inbox access |
| Click link from email | — | Link format: `/app?checkout=pro_monthly&ref=pricing#access_token=...` |
| Confirm nudge banner appears ("Completing your sign‑up…") | — | Banner must appear within ~2 s of SIGNED_IN |
| Confirm Stripe opens for `pro_monthly` | — | |
| Press Back → confirm no double-checkout | — | `?checkout=` must be stripped from URL |
| Check DevTools console for `[pmg-t41] auto-checkout redirect → Stripe` | — | No error lines |

See full runbook: `docs/smoke-test-magic-link.md`

**To complete this step:** see follow-up task #208.

---

## Why the email-click step cannot be automated

`detectSessionInUrl: true` in Supabase exchanges the `#access_token=` hash via
a real PKCE code exchange with the Supabase production project. This requires:
1. A live Supabase project with a real user account
2. Delivery of a real OTP email from Supabase's email provider
3. Access to the recipient's inbox to click the link

These constraints are external to the test environment. The Playwright suite
stubs the Supabase SDK entirely and validates all JavaScript logic, timing, and
URL handling without requiring a real email exchange.
