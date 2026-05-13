/* ============================================================================
 * Boot-time assertion that every Stripe Price ID env var the billing routes
 * read is (a) present and (b) shaped like a Stripe Price ID (prefix `price_`).
 *
 * Why crash at boot instead of 500ing at click time?
 *   The first paying Pro customer should NOT be the canary that discovers a
 *   missing env var. Stripe price-ID misconfig is silent until checkout —
 *   `routes/billing.ts` reads them lazily inside the handler. By failing the
 *   process at startup, Replit's deploy health check refuses to flip prod
 *   traffic onto a broken release, and the operator sees a clear error in
 *   the workflow log instead of a 500 in production.
 *
 * Triage decisions (audit-2 H-2):
 *   - Option (b): Pro Monthly is satisfied by EITHER `STRIPE_PRO_MONTHLY_PRICE_ID`
 *     (canonical) OR the legacy `STRIPE_PRICE_ID` fallback that
 *     `routes/billing.ts:213` still honors. Forcing migration off the legacy
 *     name is a separate decision; this PR keeps backward compat intact.
 *   - Crash on failure in BOTH dev and prod (per triage: "Log clearly and crash
 *     if any are missing"). This is stricter than `assertPricingConfigsInSync`,
 *     which only soft-fails in prod, because a bad price ID = lost revenue,
 *     not just drift between two source-of-truth files.
 *   - Skip the entire check when `STRIPE_SECRET_KEY` is unset (dev / preview /
 *     CI environments without billing wired up). Same defense-in-depth pattern
 *     as `verifyTurnstile` in `routes/waitlist.ts`.
 * ============================================================================ */
import { logger } from "./logger";

interface PriceIdRequirement {
  /** Human-readable label for log output. */
  label: string;
  /** Env var(s) that satisfy this requirement. First non-empty wins. */
  envVars: readonly string[];
}

const REQUIREMENTS: readonly PriceIdRequirement[] = [
  { label: "Founding Member", envVars: ["STRIPE_FOUNDING_PRICE_ID"] },
  // audit-2 H-2 Option (b): legacy STRIPE_PRICE_ID still honored as a fallback
  // for Pro Monthly by routes/billing.ts L213. Don't force the migration here.
  {
    label: "Pro Monthly",
    envVars: ["STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRICE_ID"],
  },
  { label: "Pro Yearly", envVars: ["STRIPE_PRO_YEARLY_PRICE_ID"] },
  { label: "Pro Studio Monthly", envVars: ["STRIPE_PRO_STUDIO_MONTHLY_PRICE_ID"] },
  { label: "Pro Studio Yearly", envVars: ["STRIPE_PRO_STUDIO_YEARLY_PRICE_ID"] },
];

interface PriceIdIssue {
  label: string;
  reason: "missing" | "malformed";
  detail: string;
}

function checkRequirement(req: PriceIdRequirement): PriceIdIssue | null {
  for (const name of req.envVars) {
    const raw = process.env[name];
    // Mirror routes/billing.ts L213's `??` semantics EXACTLY: nullish
    // coalescing consumes any defined value (including "" or "   ") rather
    // than falling through to the next fallback. If we used "first non-empty
    // after trim wins" here, a whitespace canonical could PASS boot-check (we
    // skip to legacy) but FAIL at click time (`??` would select the
    // whitespace, hand it to Stripe, and 500). So: a defined-but-blank
    // canonical is reported as a fix-this issue, not silently bypassed.
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return {
        label: req.label,
        reason: "missing",
        detail: `${name} is set but empty/whitespace. Runtime billing uses \`??\` (nullish coalescing) which consumes this defined-but-blank value instead of falling back to ${req.envVars.slice(1).join(", ") || "anything"}. Set a real Stripe Price ID or unset the env var entirely.`,
      };
    }
    if (!trimmed.startsWith("price_")) {
      return {
        label: req.label,
        reason: "malformed",
        // Don't echo the full value — could leak a `prod_*` ID into logs.
        // Length + prefix is enough to diagnose without leaking.
        detail: `${name} does not start with "price_" (got prefix "${trimmed.slice(0, 8)}…", length ${trimmed.length}). Stripe Price IDs always start with "price_"; "prod_*" is a Product ID, not a Price ID.`,
      };
    }
    return null;
  }
  return {
    label: req.label,
    reason: "missing",
    detail: `none of [${req.envVars.join(", ")}] is set`,
  };
}

export function assertStripePriceIdsConfigured(): void {
  // Dev / preview / CI without Stripe wired up: skip silently. Same gate
  // as verifyTurnstile() in routes/waitlist.ts.
  const secret = process.env["STRIPE_SECRET_KEY"];
  if (!secret || secret.trim().length === 0) {
    logger.info(
      "Stripe price-ID check: SKIPPED (no STRIPE_SECRET_KEY — billing not wired up)",
    );
    return;
  }

  const issues: PriceIdIssue[] = [];
  for (const req of REQUIREMENTS) {
    const issue = checkRequirement(req);
    if (issue) issues.push(issue);
  }

  if (issues.length === 0) {
    logger.info(
      { tiers: REQUIREMENTS.map((r) => r.label) },
      "Stripe price-ID check: PASS",
    );
    return;
  }

  const summary = issues
    .map((i) => `  - [${i.reason}] ${i.label}: ${i.detail}`)
    .join("\n");
  logger.error(
    { issueCount: issues.length, issues },
    "Stripe price-ID check: FAIL — refusing to start. Fix the env vars below and redeploy.",
  );
  throw new Error(
    `Stripe price-ID check failed (${issues.length} issue(s)):\n${summary}`,
  );
}
