---
name: Launch-swap system & where pre-launch rhetoric hides
description: How PromptMeGood swaps beta→post-launch copy, and every surface stale launch/beta rhetoric can hide in when doing a site-wide cleanup.
---

# Launch-swap system & pre-launch rhetoric sweeps

**The swap mechanism:** `pmg-launch-swap.js` fetches `/api/public-config`; when
`paywallActive: true` it sets `hidden` on every `[data-pmg-beta-only]` element and
removes `hidden` from every `[data-pmg-post-launch]` element. Default DOM state =
beta visible / post-launch hidden. So any beta copy **wrapped** in
`data-pmg-beta-only` (or whose parent has it) is correctly handled and should be
left alone — it disappears live. Only **untagged** stale copy needs editing.

**Why this matters:** if the API is down / workflows stopped, the swap never runs
and the page falls back to beta copy (502 → beta rhetoric visible). "Rhetoric
showing in production" is often just a stopped workflow, not missing edits.

**Where untagged stale launch/beta rhetoric hides** (found the hard way — a
marketing-pages-only sweep misses most of it):
- **JSON-LD `<script type="application/ld+json">`** — offer `availability`
  (`PreOrder` must be `InStock` post-launch), offer `description` ("Launching
  after Pro"), and FAQ answer text ("...at launch").
- **JS toast/error strings** — e.g. Founding sold-out handlers telling users to
  "join the Pro waitlist" (a section that's now hidden).
- **Legal + reference pages**, not just marketing: `terms.html`, `privacy.html`,
  `manual.html`, `changelog.html` all carried "open beta through July 1, 2026"
  copy.

**How to apply:**
- The authoritative list of user-facing/built pages is
  `artifacts/promptmegood/vite.config.ts` `rollupOptions.input` — sweep every one,
  not just index/pricing/app.
- Grep must include bare `waitlist`, `launch after`, `launching after`, `founding
  period`, `coming soon`, `not yet for sale` — dated phrases ("July 1, 2026")
  alone miss a lot.
- Exclude from results: lines with `data-pmg-beta-only`/`data-pmg-post-launch`
  (inline or parent), code comments (`//`, `/* */`, `<!-- -->`), HTML `id=`
  anchors, `/api/waitlist` route/table infra, and privacy-policy references to the
  email/newsletter endpoint (those are legit, not launch marketing).
- Never edit `pmg-chassis-v3.js` or `pmg-ux.js` without explicit permission; their
  CSS counterparts (e.g. `pmg-chassis-v3.css`) ARE editable — that's how the
  persistent BETA badge was hidden (`display:none` on `.pmgv3-brand-beta`, plus a
  `?v=` cache-string bump on the CSS `<link>`).
- Authoritative caps/entitlements live in
  `artifacts/api-server/src/lib/pricing-config.ts`; copy must match it.
