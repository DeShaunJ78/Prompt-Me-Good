#!/usr/bin/env tsx
/**
 * check-prices: scans built deployables for stale / banned price tokens
 * and verifies canonical price tokens are present.
 *
 * Scans:
 *   - artifacts/promptmegood/**\/*.{html,js}    (excluding .bak* and node_modules)
 *   - artifacts/api-server/dist/**\/*.mjs
 *
 * Fails on any banned legacy price tokens ($59, $19, $49).
 * Also fails if no canonical tokens ($79, $9) are found across the
 * scanned surface — this catches accidental wholesale removal or a
 * missing build output that would otherwise produce a false-green CI run.
 * Required scan targets that are missing or contain zero matching files
 * also fail the check, for the same reason.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(new URL("../..", import.meta.url).pathname);

const BANNED_PRICES = ["$59", "$19", "$49"] as const;
const CANONICAL_PRICES = ["$79", "$9"] as const;

interface ScanTarget {
  root: string;
  extensions: ReadonlySet<string>;
  skipDirs: ReadonlySet<string>;
  skipFile?: (relPath: string) => boolean;
  required: boolean;
}

const TARGETS: ScanTarget[] = [
  {
    root: join(REPO_ROOT, "artifacts/promptmegood"),
    extensions: new Set([".html", ".js"]),
    // Only skip dirs that aren't part of the deployable surface. We
    // deliberately do NOT skip `dist` — compiled output is exactly where
    // stale prices have shipped from in the past.
    skipDirs: new Set([
      "node_modules",
      "test-results",
      "playwright-report",
      "tests",
    ]),
    skipFile: (rel) => /\.bak(\.|$)/.test(rel) || /\.current-/.test(rel),
    required: true,
  },
  {
    root: join(REPO_ROOT, "artifacts/api-server/dist"),
    extensions: new Set([".mjs"]),
    skipDirs: new Set([]),
    required: true,
  },
];

function* walk(dir: string, target: ScanTarget): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (target.skipDirs.has(entry.name)) continue;
      yield* walk(full, target);
      continue;
    }
    if (!entry.isFile()) continue;
    const dot = entry.name.lastIndexOf(".");
    const ext = dot === -1 ? "" : entry.name.slice(dot);
    if (!target.extensions.has(ext)) continue;
    const rel = relative(target.root, full);
    if (target.skipFile && target.skipFile(rel)) continue;
    yield full;
  }
}

interface Hit {
  file: string;
  line: number;
  token: string;
  excerpt: string;
}

function findTokens(content: string, tokens: readonly string[]): Hit[] {
  const hits: Hit[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const token of tokens) {
      let idx = 0;
      while ((idx = line.indexOf(token, idx)) !== -1) {
        // Word-boundary on the right: next char must not be a digit, otherwise
        // "$199" would match "$19".
        const next = line.charAt(idx + token.length);
        if (!/[0-9]/.test(next)) {
          hits.push({
            file: "",
            line: i + 1,
            token,
            excerpt: line.trim().slice(0, 200),
          });
          break;
        }
        idx += token.length;
      }
    }
  }
  return hits;
}

function main(): void {
  const allBannedHits: Hit[] = [];
  let canonicalHitCount = 0;
  let scannedCount = 0;

  const missingRequired: string[] = [];
  for (const target of TARGETS) {
    let exists = true;
    try {
      statSync(target.root);
    } catch {
      exists = false;
    }
    if (!exists) {
      if (target.required) {
        missingRequired.push(relative(REPO_ROOT, target.root));
      } else {
        console.warn(
          `[check-prices] optional target not found, skipping: ${target.root}`,
        );
      }
      continue;
    }
    let targetFileCount = 0;
    for (const file of walk(target.root, target)) {
      scannedCount++;
      targetFileCount++;
      const content = readFileSync(file, "utf8");
      const banned = findTokens(content, BANNED_PRICES);
      for (const hit of banned) {
        allBannedHits.push({ ...hit, file: relative(REPO_ROOT, file) });
      }
      canonicalHitCount += findTokens(content, CANONICAL_PRICES).length;
    }
    if (target.required && targetFileCount === 0) {
      missingRequired.push(
        `${relative(REPO_ROOT, target.root)} (no matching files)`,
      );
    }
  }

  if (missingRequired.length > 0) {
    console.error(
      `\n[check-prices] FAIL: required scan target(s) missing or empty:\n`,
    );
    for (const t of missingRequired) console.error(`  - ${t}`);
    console.error(
      `\nBuild the affected artifact(s) before running this check ` +
        `(e.g. \`pnpm run build\`).`,
    );
    process.exit(1);
  }

  console.log(
    `[check-prices] scanned ${scannedCount} file(s); ` +
      `${allBannedHits.length} banned hit(s), ` +
      `${canonicalHitCount} canonical hit(s).`,
  );

  if (allBannedHits.length > 0) {
    console.error(
      `\n[check-prices] FAIL: found ${allBannedHits.length} banned legacy ` +
        `price token(s) (${BANNED_PRICES.join(", ")}):\n`,
    );
    for (const hit of allBannedHits) {
      console.error(`  ${hit.file}:${hit.line}  [${hit.token}]  ${hit.excerpt}`);
    }
    console.error(
      `\nUpdate these to the canonical prices (${CANONICAL_PRICES.join(", ")}) ` +
        `or rebuild the affected artifact.`,
    );
    process.exit(1);
  }

  if (canonicalHitCount === 0) {
    console.error(
      `\n[check-prices] FAIL: no canonical price tokens ` +
        `(${CANONICAL_PRICES.join(", ")}) found in scanned files. ` +
        `This usually means the build output is missing or pricing was ` +
        `accidentally removed.`,
    );
    process.exit(1);
  }

  console.log(`[check-prices] OK`);
}

main();
