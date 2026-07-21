# Magic-Link Auto-Checkout — Production Smoke Test

**Task #197** | Run this manually on `https://www.promptmegood.com` after every deploy that touches `pmg-ux.js` T40/T41 sections.

## Prerequisites

- A test account that is NOT currently a paid subscriber (free plan).
- Access to the test account's email inbox.
- A browser with DevTools available.

---

## Steps

### 1. Start signed out

```
Open DevTools → Application → Storage → Clear site data (cookies + localStorage)
```

Or: Sign out from the account panel in `/app`, then confirm the sign-in panel shows "Sign In" state.

---

### 2. Navigate to the checkout URL

```
https://www.promptmegood.com/app?checkout=pro_monthly&ref=pricing
```

**Expected:**
- Page loads normally.
- The sign-in panel (account section) is visible and open.
- No checkout fires yet — user is a guest.

---

### 3. Request a magic link

- Enter the test account email in the sign-in panel.
- Click **"Send Magic Link"** (or equivalent).
- **Expected:** success message in the panel ("Check your inbox").

---

### 4. Click the magic link from email

- Open the email and click the link.
- The link lands on `/app?checkout=pro_monthly&ref=pricing#access_token=...`

**Expected (within ~2 s of clicking the link):**
- A top-of-page nudge banner appears: *"Completing your sign‑up… Opening Pro Monthly checkout."*
- The banner stays visible while the session is established and profile is fetched.
- The banner message updates to *"Opening checkout…"* just before the Stripe redirect.
- Stripe's checkout page opens for the **pro_monthly** plan.
- The URL bar is clean: no `#access_token=` hash, `?checkout=` and `?ref=` are stripped.

---

### 5. Verify no double-fire

- After Stripe opens, press **Back** in the browser.
- **Expected:** `/app` loads without triggering another auto-checkout (`?checkout=` was stripped from the URL on first fire).

---

### 6. Verify already-on-plan guard (if using a paid account)

- Sign in with an account that already has `pro_monthly`.
- Navigate to `https://www.promptmegood.com/app?checkout=pro_monthly&ref=pricing`.
- Click magic link.
- **Expected:** A toast appears: *"You're already on this plan — nothing to upgrade!"* No Stripe redirect.

---

## Console checks (DevTools)

Open **Console** during the flow and look for:

| Log line | Meaning |
|---|---|
| `[pmg-t41] auto-checkout tier=pro_monthly (auth-change path)` | T41 correctly picked up the tier on SIGNED_IN |
| `[pmg-t41] auto-checkout redirect → Stripe` | Redirect fired |
| `[pmg-t41] auto-checkout: user already on plan=…` | Already-paid guard fired |

**Red flags to look for:**
- `[pmg-t41] auto-checkout: no session yet` — SIGNED_IN fired before session was ready (should auto-retry)
- Any `[pmg-t41]` error line
- Multiple `auto-checkout redirect → Stripe` log lines (double-fire)

---

## Automated coverage (Playwright, runs in CI)

These tests cover the logic in a stubbed environment and must all pass before deploy:

| File | What it proves |
|---|---|
| `tests/magic-link-auto-checkout.spec.ts` | `?checkout=founding` survives `#access_token=` hash; hash is stripped correctly |
| `tests/magic-link-race-condition.spec.ts` | Checkout fires exactly once; late SIGNED_IN (>2500 ms) still fires checkout |
| `tests/checkout-nudge-dismiss.spec.ts` | Nudge appears, dismiss works, checkout still fires after dismiss |
| `tests/checkout-nudge-stall.spec.ts` | Nudge stays visible during slow API; message updates; removed on redirect |

Run with:
```bash
cd artifacts/promptmegood
npx playwright test tests/magic-link-*.spec.ts tests/checkout-nudge-*.spec.ts --reporter=list
```
