/* ============================================================================
 * Pricing-config sync assertion (audit-2 M1 + M2)
 * ----------------------------------------------------------------------------
 * Boot-time check that the three things that MUST agree about beta state and
 * pricing actually do agree:
 *
 *   M1 — BETA_END (pricing-config.ts) === PAYWALL_ACTIVATES_AT (env var)
 *        Frontend client-side gating reads BETA_END (via PMG_PRICING in
 *        pmg-pricing-config.js). Backend server-side gating reads
 *        PAYWALL_ACTIVATES_AT (via paywall.ts). If they drift, the client
 *        can stay in `pmg-beta-mode` (UI unlocked) while the server returns
 *        402/403 paywall errors — bad UX and bad trust signal. Conversely
 *        the server can flip to enforced while the client still shows
 *        "free during beta" copy. This check makes drift loud at boot.
 *
 *   M2 — pricing-config.ts ↔ pmg-pricing-config.js mirror equality
 *        The two files are hand-mirrored. If someone bumps a price on the
 *        server side and forgets the JS file, the price card on
 *        /pricing.html shows the old number while checkout charges the new
 *        one. This check parses the JS file's PMG_PRICING object literal
 *        and compares every value to the TS export.
 *
 * Behaviour:
 *   - Development: throws on any mismatch so the dev sees it immediately.
 *   - Production: logs a prominent ERROR but does NOT crash the service —
 *     a config mismatch should not take prod down, but it MUST be loud
 *     enough that an operator spots it in the workflow log.
 * ============================================================================ */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { logger } from "./logger";
import { PMG_PRICING } from "./pricing-config";

const IS_PROD = (process.env["NODE_ENV"] ?? "development") === "production";

/** Parse the literal value of `PMG_PRICING.<KEY>` from the JS mirror file
 *  source. Cheap regex parser — the JS file is hand-maintained with a stable
 *  shape (one property per line, primitive or object literal values). We
 *  intentionally avoid `eval` and a real JS parser to keep this dependency-free.
 */
function readJsMirror(jsSource: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Match `KEY: value,` lines where value is a number, single-quoted string,
  // double-quoted string, object literal `{ ... }`, or array literal `[ ... ]`.
  // The JS file has a stable indented format from pmg-pricing-config.js.
  const lineRe = /^\s{2,}([A-Z_][A-Z0-9_]*)\s*:\s*(.+?),?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(jsSource)) !== null) {
    const key = match[1];
    const rawValue = match[2];
    if (!key || rawValue === undefined) continue;
    out[key] = parseJsLiteral(rawValue);
  }
  return out;
}

function parseJsLiteral(raw: string): unknown {
  const trimmed = raw.trim().replace(/,\s*$/, "");

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  // Quoted string (single or double)
  const strMatch = /^['"](.*)['"]$/.exec(trimmed);
  if (strMatch && strMatch[1] !== undefined) return strMatch[1];

  // Object literal `{ run: 6, img: 3, analyze: 2 }`
  const objMatch = /^\{\s*(.*?)\s*\}$/.exec(trimmed);
  if (objMatch && objMatch[1] !== undefined) {
    const obj: Record<string, number | string> = {};
    const parts = objMatch[1].split(",");
    for (const part of parts) {
      const kv = part.split(":");
      if (kv.length !== 2) continue;
      const k = kv[0]?.trim();
      const v = kv[1]?.trim();
      if (!k || v === undefined) continue;
      const parsed = parseJsLiteral(v);
      if (typeof parsed === "number" || typeof parsed === "string") {
        obj[k] = parsed;
      }
    }
    return obj;
  }

  // Array literal `['founding', 'pro_monthly', ...]`
  const arrMatch = /^\[\s*(.*?)\s*\]$/.exec(trimmed);
  if (arrMatch && arrMatch[1] !== undefined) {
    return arrMatch[1]
      .split(",")
      .map((p) => parseJsLiteral(p.trim()))
      .filter((v) => v !== "");
  }

  return trimmed;
}

/** Keys we require to match exactly between the TS and JS sources.
 *  audit-2 H2 (2026-05-13): `vid` is now mirrored into pmg-pricing-config.js
 *  for shape parity, so the cap comparison covers all four fields. */
const SCALAR_KEYS = [
  "FOUNDING_PRICE_USD",
  "PRO_MONTHLY_USD",
  "PRO_YEARLY_USD",
  "PRO_STUDIO_MONTHLY_USD",
  "PRO_STUDIO_YEARLY_USD",
  "FOUNDING_LIMIT",
  "FOUNDING_DEADLINE_COPY",
  "TRIAL_DAYS",
  "PRICE_LOCK_TAGLINE",
  "BETA_END",
] as const;

/** Array keys that must agree as order-independent sets between TS and JS.
 *  EXPERT_CENTER_PAID_TIERS controls who the Expert Command Center paywall
 *  treats as "paid" once BETA_END passes — drift here means a tier could be
 *  unlocked on the client and locked on the server, or vice versa. */
const ARRAY_SET_KEYS = ["EXPERT_CENTER_PAID_TIERS"] as const;

const CAP_KEYS = [
  "TRIAL_DAILY_CAPS",
  "FREE_DAILY_CAPS",
  "FOUNDING_DAILY_CAPS",
  "PRO_DAILY_CAPS",
  "PRO_STUDIO_DAILY_CAPS",
] as const;

const CAP_FIELDS_TO_COMPARE = ["run", "img", "analyze", "vid"] as const;

/** Locate the pmg-pricing-config.js mirror file by walking up from this
 *  module's directory until we find the workspace root (the directory that
 *  contains pnpm-workspace.yaml), then resolving the known frontend path.
 *  This is robust to both `dist/index.mjs` (production) and `src/lib/...`
 *  (dev via tsx) layouts without hard-coding the number of `..` segments. */
function resolveJsMirrorPath(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  let cursor = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(cursor, "pnpm-workspace.yaml"))) {
      return resolve(
        cursor,
        "artifacts/promptmegood/public/scripts/pmg-pricing-config.js",
      );
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  // Fallback: best-effort path relative to the build output. If this also
  // fails the read will surface a clear file-error in the issue list.
  return resolve(
    start,
    "../../artifacts/promptmegood/public/scripts/pmg-pricing-config.js",
  );
}

interface SyncIssue {
  kind: "beta-mismatch" | "scalar-mismatch" | "cap-mismatch" | "missing-key" | "file-error";
  message: string;
}

function checkBetaEndAlignment(): SyncIssue[] {
  const issues: SyncIssue[] = [];
  const rawActivatesAt = (process.env["PAYWALL_ACTIVATES_AT"] ?? "").trim();
  if (!rawActivatesAt) {
    // paywall.ts treats this as "open beta indefinitely" and already warns.
    // Not a hard mismatch — flag but don't escalate.
    return issues;
  }
  const envMs = Date.parse(rawActivatesAt);
  const tsMs = Date.parse(PMG_PRICING.BETA_END);
  if (!Number.isFinite(envMs) || !Number.isFinite(tsMs)) {
    issues.push({
      kind: "beta-mismatch",
      message: `Could not parse one of BETA_END="${PMG_PRICING.BETA_END}" or PAYWALL_ACTIVATES_AT="${rawActivatesAt}".`,
    });
    return issues;
  }
  if (envMs !== tsMs) {
    issues.push({
      kind: "beta-mismatch",
      message:
        `BETA_END (${PMG_PRICING.BETA_END}) does not match PAYWALL_ACTIVATES_AT ` +
        `(${new Date(envMs).toISOString()}). Frontend client-side gating and ` +
        `backend server-side gating will disagree about when paid mode begins.`,
    });
  }
  return issues;
}

function checkJsMirror(): SyncIssue[] {
  const issues: SyncIssue[] = [];
  const path = resolveJsMirrorPath();
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (err) {
    issues.push({
      kind: "file-error",
      message: `Could not read pmg-pricing-config.js mirror at ${path}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    return issues;
  }

  const js = readJsMirror(source);

  for (const key of SCALAR_KEYS) {
    const tsValue = (PMG_PRICING as unknown as Record<string, unknown>)[key];
    const jsValue = js[key];
    if (jsValue === undefined) {
      issues.push({
        kind: "missing-key",
        message: `pmg-pricing-config.js is missing scalar key "${key}" (TS has ${JSON.stringify(tsValue)}).`,
      });
      continue;
    }
    if (tsValue !== jsValue) {
      issues.push({
        kind: "scalar-mismatch",
        message: `Scalar drift on "${key}": TS=${JSON.stringify(tsValue)} vs JS=${JSON.stringify(jsValue)}.`,
      });
    }
  }

  for (const key of ARRAY_SET_KEYS) {
    const tsArr = (PMG_PRICING as unknown as Record<string, unknown>)[key];
    const jsArr = js[key];
    if (!Array.isArray(tsArr)) continue;
    if (!Array.isArray(jsArr)) {
      issues.push({
        kind: "missing-key",
        message: `pmg-pricing-config.js is missing array key "${key}" (TS has ${JSON.stringify(tsArr)}).`,
      });
      continue;
    }
    const tsSet = new Set(tsArr.map((v) => String(v)));
    const jsSet = new Set(jsArr.map((v) => String(v)));
    const sameSize = tsSet.size === jsSet.size;
    const sameMembers = sameSize && [...tsSet].every((v) => jsSet.has(v));
    if (!sameMembers) {
      issues.push({
        kind: "scalar-mismatch",
        message: `Array set drift on "${key}": TS=${JSON.stringify([...tsSet].sort())} vs JS=${JSON.stringify([...jsSet].sort())}.`,
      });
    }
  }

  for (const key of CAP_KEYS) {
    const tsCaps = (PMG_PRICING as unknown as Record<string, Record<string, number>>)[key];
    const jsCaps = js[key] as Record<string, number> | undefined;
    if (!jsCaps || typeof jsCaps !== "object") {
      issues.push({
        kind: "missing-key",
        message: `pmg-pricing-config.js is missing caps object "${key}".`,
      });
      continue;
    }
    for (const field of CAP_FIELDS_TO_COMPARE) {
      const t = tsCaps?.[field];
      const j = jsCaps[field];
      if (t !== j) {
        issues.push({
          kind: "cap-mismatch",
          message: `Cap drift on "${key}.${field}": TS=${t} vs JS=${j}.`,
        });
      }
    }
  }

  return issues;
}

/** Run all sync checks. In dev, throws on the first issue. In prod, logs an
 *  ERROR with every issue so an operator can fix them without downtime. */
export function assertPricingConfigsInSync(): void {
  const issues: SyncIssue[] = [
    ...checkBetaEndAlignment(),
    ...checkJsMirror(),
  ];

  if (issues.length === 0) {
    logger.info(
      { betaEnd: PMG_PRICING.BETA_END },
      "Pricing config sync check: PASS",
    );
    return;
  }

  if (IS_PROD) {
    logger.error(
      { issueCount: issues.length, issues: issues.map((i) => i.message) },
      "Pricing config sync check: FAIL — drift detected, see issues. Service continues running but client/server may disagree about pricing or beta state.",
    );
    return;
  }

  // Development: surface loudly so the dev fixes it before pushing.
  const summary = issues.map((i) => `  - [${i.kind}] ${i.message}`).join("\n");
  throw new Error(
    `Pricing config sync check failed (${issues.length} issue(s)):\n${summary}`,
  );
}
