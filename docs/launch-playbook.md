# PromptMeGood — Launch & Maintenance Playbook

Tracking notes for items surfaced by Audit #2 (May 13, 2026). No action items here are blocking; each is filed by when it should be touched.

## Launch-Day Playbook (run on July 1, 2026 when flipping `BETA_END` / `paywallActive`)

- **M1 · Pro Studio "COMING SOON" badge cleanup.** When flipping `paywallActive` to `true`, also remove the "COMING SOON" badge and the "Launches July 1, 2026" subhead from the Pro Monthly, Pro Yearly, and Pro Studio cards in `artifacts/promptmegood/pricing.html`. The Stripe IDs and `billing.ts` routing are already wired — only the card chrome needs updating. Make this part of the same PR that flips the env var so the page never shows "Coming Soon" while checkout is live.

## Pre-Launch Polish Batch (do before July 1)

- **M2 · Cache-Control on HTML pages.** Verify (and tighten if needed) `Cache-Control` on `pricing.html` and `index.html` so a price/copy deploy invalidates within seconds, not minutes. Audit-2 caught a Firecrawl/CDN-cached old render serving $9 Pro pricing during the discovery pass — the live page was already correct, but the window for stale price exposure during a real deploy is the risk. Recommended: short max-age + stale-while-revalidate, or no-cache for these two HTML routes specifically.

## Janitor List (do whenever)

- **L1 · Stale comment in `artifacts/api-server/src/lib/pricing-config.ts`** header. Claims Pro Studio "no Stripe IDs exist yet (pricing.html marks it Coming Soon)" — both `STRIPE_PRO_STUDIO_MONTHLY_PRICE_ID` and `STRIPE_PRO_STUDIO_YEARLY_PRICE_ID` are present in the env. Update the comment so future you isn't misled.
- **L3 · Dead `pro_studio_monthly` key in cancel banner.** `artifacts/promptmegood/pricing.html` `TIER_COPY` table has both `pro_studio` and `pro_studio_monthly` mapping to identical copy. `billing.ts` only ever emits `pro_studio` (not `_monthly`), so the `_monthly` row is dead. Remove or leave — purely cosmetic.

## Watch List (passive monitoring; don't fix unless drift appears)

- **L2 · JSON-LD FAQ caps in `app.html`.** The big FAQ-answer string around L186 hand-encodes every cap (`2 / 1 / 1`, `15 / 8 / 5 / 3`, `25 / 12 / 8 / 5`, `75 / 30 / 20 / 10`). It's currently correct but is **not** driven by the `data-pmg-cap` hooks (JSON-LD can't be DOM-hydrated by `pricing-config.js` at runtime, since crawlers don't execute it). Any future caps change must be hand-mirrored here. Long-term fix: server-render JSON-LD from `pricing-config.ts` so it can never drift. Until then, add this file to the checklist whenever caps change.
