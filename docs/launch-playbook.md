# PromptMeGood — Launch & Maintenance Playbook

Tracking notes for items surfaced by Audit #2 (May 13, 2026). No action items here are blocking; each is filed by when it should be touched.

## Launch-Day Playbook (run on July 1, 2026 when flipping `BETA_END` / `paywallActive`)

- **M1 · Pro Studio "COMING SOON" badge cleanup.** When flipping `paywallActive` to `true`, also remove the "COMING SOON" badge and the "Launches July 1, 2026" subhead from the Pro Monthly, Pro Yearly, and Pro Studio cards in `artifacts/promptmegood/pricing.html`. The Stripe IDs and `billing.ts` routing are already wired — only the card chrome needs updating. Make this part of the same PR that flips the env var so the page never shows "Coming Soon" while checkout is live.

## Pre-Launch Polish Batch (do before July 1)

- **M2 · Cache-Control on HTML pages.** Verify (and tighten if needed) `Cache-Control` on `pricing.html` and `index.html` so a price/copy deploy invalidates within seconds, not minutes. Audit-2 caught a Firecrawl/CDN-cached old render serving $9 Pro pricing during the discovery pass — the live page was already correct, but the window for stale price exposure during a real deploy is the risk. Recommended: short max-age + stale-while-revalidate, or no-cache for these two HTML routes specifically.

## Janitor List (do whenever)

- **L1 · Stale comment in `artifacts/api-server/src/lib/pricing-config.ts`** header. Claims Pro Studio "no Stripe IDs exist yet (pricing.html marks it Coming Soon)" — both `STRIPE_PRO_STUDIO_MONTHLY_PRICE_ID` and `STRIPE_PRO_STUDIO_YEARLY_PRICE_ID` are present in the env. Update the comment so future you isn't misled.
- **L3 · Dead `pro_studio_monthly` key in cancel banner.** `artifacts/promptmegood/pricing.html` `TIER_COPY` table has both `pro_studio` and `pro_studio_monthly` mapping to identical copy. `billing.ts` only ever emits `pro_studio` (not `_monthly`), so the `_monthly` row is dead. Remove or leave — purely cosmetic.

## Hard-coded Price Literal Locations (manual sweep before any price change)

Audit-2 M1 bound the pricing-page hero literals to `data-pmg-price` so the runtime renderer in `pmg-ux.js` keeps them in sync with `PMG_PRICING`. The literals below are NOT bound — they live in marketing copy, JSON-LD, OG tags, and the comparison table where the renderer either can't reach (SEO/social previews crawled before JS runs) or where the chrome around the price (e.g. " / month, billed annually") is too custom to template safely. **When you change a price, grep for the old number and update each of these by hand.**

- `artifacts/promptmegood/index.html`
  - Line ~22: `<meta property="og:description">` mentions Founding $79.
  - Line ~30: Twitter card description, same string.
  - Line ~649: marketing-page Founding pitch block.
  - Line ~682: marketing-page Pro pricing teaser.
- `artifacts/promptmegood/pricing.html`
  - Lines ~281–283: hero-card founding-deadline copy (above the tier grid; `data-pmg-deadline` covers the headline only).
  - Lines ~453, ~492, ~496, ~512, ~516, ~527: comparison-table cells citing dollar amounts inline with feature copy.
- `artifacts/promptmegood/app.html`
  - JSON-LD FAQ block ~L186 (also tracked under L2 Watch List for caps).

Verification: after editing, grep `\$79\|\$14\|\$29\|\$129\|\$290` across these files to confirm no stale numbers remain. Boot-time sync check (`pricing-config-sync-check.ts`) covers the JS mirror but does NOT scan HTML — that's left to this manual sweep because grep across marketing copy produces too many false positives to gate at boot.

## Watch List (passive monitoring; don't fix unless drift appears)

- **L2 · JSON-LD FAQ caps in `app.html`.** The big FAQ-answer string around L186 hand-encodes every cap (`2 / 1 / 1`, `15 / 8 / 5 / 3`, `25 / 12 / 8 / 5`, `75 / 30 / 20 / 10`). It's currently correct but is **not** driven by the `data-pmg-cap` hooks (JSON-LD can't be DOM-hydrated by `pricing-config.js` at runtime, since crawlers don't execute it). Any future caps change must be hand-mirrored here. Long-term fix: server-render JSON-LD from `pricing-config.ts` so it can never drift. Until then, add this file to the checklist whenever caps change.

## SEO copy / pricing-literal coupling (added May 13, 2026)

The keyword-optimized SEO surfaces shipped this session reference specific tier prices and free-tier framing in the page metadata. Any future pricing PR — Stripe price-id swap, tier rename, free-tier policy change, "no signup required" reversal — **must manually update these four lines** or the SEO copy will go stale and search snippets will misrepresent the product:

- `artifacts/promptmegood/index.html` L21 — `<title>` (currently mentions "Free ChatGPT Prompt Builder & AI Prompt Optimizer")
- `artifacts/promptmegood/index.html` L22 — `<meta name="description">` (currently mentions "free AI prompt generator", "no signup required")
- `artifacts/promptmegood/pricing.html` L12 — `<title>` (currently mentions "AI Prompt Generator Tool")
- `artifacts/promptmegood/pricing.html` L13 — `<meta name="description">` (currently mentions "Founding Member for lifetime access")

The JSON-LD `SoftwareApplication` block at `index.html` L26-41 also hardcodes `"price": "0", "priceCurrency": "USD"` for the free-tier offer — flip that if free-tier ever becomes paid.

No automated guard exists today. Suggested future hardening: CODEOWNERS check, or a CI grep that fails any PR touching `pricing-config.ts` without also touching these four lines (analogous to the `\$79\|\$14\|\$29\|\$129\|\$290` sweep documented above).

### Extended scope (added Audit #2, build pass) — `app.html` price literals

Audit #2 prod sweep found **22 hard-coded $ literals across `app.html`** (workstation footer, post-prompt-footer-pricing block, site-footer pricing strip, and the JSON-LD FAQ at L186) that are NOT wrapped in `data-pmg-price` spans. Decision: **do not span-wrap them** — the surrounding chrome ("$79 charge", "$129/year billed annually", "$79 one-time, first 500 buyers, price-locked") is too custom to template safely without churn, and the page is internal (auth-walled workstation) so SEO drift risk is low. Instead, treat this as a manual-sweep file:

- `artifacts/promptmegood/app.html` — grep `\$79\|\$14\|\$29\|\$129\|\$290` and update each match by hand on any pricing PR. Distinct strings to scan for: `$79 charge`, `$79 payment`, `$79 one-time`, `($79`, `$79,`, `$14/month`, `($14/month`, `$29`, `($29/month`, `($129/year`, `$290/year` (≈11 distinct fragments, 22 total occurrences as of May 13, 2026).
- The JSON-LD FAQ block at app.html ~L186 is also tracked under L2 (caps) above; the price half of that block lands here.

**Combined pre-PR grep recipe** for any pricing change:
```
rg -n '\$(79|14|29|129|290)' artifacts/promptmegood/{index,pricing,app}.html
```
Every result must be reviewed before merge.

## Pre-Launch Checklist (run before flipping `OPEN_BETA_MODE` / `PAYWALL_ACTIVATES_AT`)

Run these in order on July 1, 2026 (or whenever launch is). All steps are manual — no automation today.

1. **M2 · Authenticated paywall smoke test (do this first, BEFORE flipping the env var).**
   - Sign in as a free-tier user (any test account that is NOT in `EXPERT_CENTER_PAID_TIERS`).
   - With `OPEN_BETA_MODE=true` still set, capture a Supabase access token from the browser devtools (Application → Cookies, or `localStorage.getItem('sb-…')`).
   - From a shell, hit a paywalled endpoint:
     ```
     curl -i -X POST https://www.promptmegood.com/api/create-checkout-session \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <token>" \
       -d '{"tier":"pro_monthly"}'
     ```
   - **Expected during beta:** the call should reach `isPaywallActive()` and return either `200` (paywall not active, free during beta — pro_monthly creates a Stripe session) OR `403 paywall_inactive` (depending on which side of the flag the operator sits). The point is to **confirm the auth path works end-to-end** so that on launch day the `403` becomes a `200` (or vice versa) for the right reasons.
   - **After flipping `OPEN_BETA_MODE=false`:** repeat. Now `tier:"pro_monthly"` should succeed (200 + Stripe URL) and `tier:"founding"` should `409 sold_out` (because Founding stops selling at launch — verify in `billing.ts` L147-162 logic).
   - Why this matters: the paywall 403 path is unreachable from anonymous curl (defense-in-depth — `requireSupabaseUser` 401s first), so the only way to validate it is with a real token.

2. **M3 · Sticky banner auto-hide verification.**
   - The "Free Beta Access Until July 1, 2026 — Founding Member Checkout Now Open · First 500 Buyers" banner is wired to auto-hide when `paywallActive: true` is returned by `/api/public-config` (primary gate: `pmg-ux.js` L13337-13362, the IIFE that decides whether to call `renderBanner()`). Defense-in-depth: the banner element itself carries `data-pmg-beta-only`, so even if the primary gate misfires (cached JS, race condition with the config fetch) `pmg-launch-swap.js` will hide it on any page that loads launch-swap.
   - **Verify:** after flipping `OPEN_BETA_MODE=false` (or moving `PAYWALL_ACTIVATES_AT` into the past), hard-refresh `https://www.promptmegood.com/`, `/pricing.html`, and `/app.html`. The banner must NOT be visible on any of the three. If it IS, check `/api/public-config` is returning `paywallActive: true` (curl it directly), then check browser console for `[pmg-launch-swap]` log line.
   - **Failure mode:** if the banner persists, set `localStorage.pmg_t42_disable = '1'` on the affected device as a manual override while you debug — do NOT roll the env var back unless the rest of the launch surface is also broken.

3. **M1 · Pro Studio "COMING SOON" badge cleanup** (re-listed from above, do AFTER M2/M3 pass).
   - Same PR that flips `OPEN_BETA_MODE` must also remove "COMING SOON" / "Launches July 1, 2026" badges from Pro Monthly, Pro Yearly, Pro Studio Monthly, Pro Studio Yearly cards in `pricing.html`. The `data-pmg-beta-only` / `data-pmg-post-launch` swap handles most of it; verify by visual diff of pricing.html after the swap runs.

4. **Sweep all hard-coded literals** (see "Hard-coded Price Literal Locations" section above) one more time — the launch PR is the highest-stakes pricing PR there will ever be.
