/**
 * Pushes the current project to GitHub via the Replit GitHub connector.
 * Resilient: retries on transient errors, processes blobs in parallel batches.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";
import { readFileSync, statSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const OWNER      = "DeShaunJ78";
const REPO       = "Prompt-Me-Good";
const BRANCH     = "main";
const COMMIT_MSG = "Phase 1-5 complete — full CodeMeGood build";
const ROOT       = process.cwd();
const BATCH_SIZE = 4;          // parallel blob requests per batch
const RETRY_MAX  = 3;          // retries per blob on 5xx
const RETRY_DELAY_MS = 1200;   // delay between retries

const connectors = new ReplitConnectors();

// ---------------------------------------------------------------------------
// GitHub API via proxy — with retry on transient errors
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(endpoint, options = {}, attempt = 1) {
  const response = await connectors.proxy("github", endpoint, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();

  // Retry on 5xx
  if (response.status >= 500 && attempt <= RETRY_MAX) {
    await sleep(RETRY_DELAY_MS * attempt);
    return gh(endpoint, options, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`GitHub ${options.method ?? "GET"} ${endpoint} → ${response.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------
const EXCLUDED_DIRS = new Set([
  "attached_assets", "node_modules", ".cache", ".local", "dist", "tmp",
]);

function getFiles() {
  const out = execSync("git ls-files --others --cached --exclude-standard", {
    cwd: ROOT, encoding: "utf8",
  });
  return out.trim().split("\n").filter(Boolean).filter((f) => {
    const top = f.split("/")[0];
    return !EXCLUDED_DIRS.has(top);
  });
}

const BINARY_EXTS = new Set([
  ".png",".jpg",".jpeg",".gif",".webp",".ico",
  ".woff",".woff2",".ttf",".eot",".otf",
  ".mp3",".mp4",".wav",".ogg",".zip",".tar",".gz",".pdf",
]);
const isBinary = (f) => BINARY_EXTS.has(path.extname(f).toLowerCase());
const MAX_BINARY = 400 * 1024; // skip binaries > 400 KB

// ---------------------------------------------------------------------------
// Create a single blob, returns { path, sha } or null if skipped
// ---------------------------------------------------------------------------
async function createBlob(relPath) {
  const absPath = path.join(ROOT, relPath);
  let stat;
  try { stat = statSync(absPath); } catch { return null; }
  if (!stat.isFile()) return null;

  if (isBinary(relPath)) {
    if (stat.size > MAX_BINARY) {
      process.stdout.write(`  ⊘ ${relPath} (binary >400 KB — skipped)\n`);
      return null;
    }
    const content = readFileSync(absPath).toString("base64");
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST", body: { content, encoding: "base64" },
    });
    process.stdout.write(`  ✓ ${relPath}\n`);
    return { path: relPath, mode: "100644", type: "blob", sha: blob.sha };
  } else {
    const content = readFileSync(absPath, "utf8");
    const blob = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST", body: { content, encoding: "utf-8" },
    });
    process.stdout.write(`  ✓ ${relPath}\n`);
    return { path: relPath, mode: "100644", type: "blob", sha: blob.sha };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🔍 Collecting files…");
  const files = getFiles();
  console.log(`   → ${files.length} candidate files\n`);

  // 1. Get base commit
  let baseSha = null, baseTreeSha = null;
  try {
    const ref    = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    baseSha      = ref.object.sha;
    const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
    baseTreeSha  = commit.tree.sha;
    console.log(`📌 Base commit: ${baseSha.slice(0, 7)}\n`);
  } catch (e) {
    if (e.message.includes("404")) {
      console.log("📌 No existing branch — will create initial commit\n");
    } else throw e;
  }

  // 2. Create blobs in parallel batches
  console.log("📦 Uploading blobs…");
  const treeItems = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch   = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(createBlob));
    treeItems.push(...results.filter(Boolean));
    // Small pause between batches to avoid hammering the proxy
    if (i + BATCH_SIZE < files.length) await sleep(300);
  }
  console.log(`\n   → ${treeItems.length} blobs created\n`);

  // 3. Create tree
  console.log("🌲 Creating tree…");
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST", body: treePayload,
  });
  console.log(`   → ${newTree.sha.slice(0, 7)}\n`);

  // 4. Create commit
  console.log("📝 Creating commit…");
  const newCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: {
      message: COMMIT_MSG,
      tree:    newTree.sha,
      ...(baseSha ? { parents: [baseSha] } : { parents: [] }),
    },
  });
  console.log(`   → ${newCommit.sha.slice(0, 7)}\n`);

  // 5. Update / create branch ref
  console.log("🚀 Pushing to GitHub…");
  if (baseSha) {
    await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH", body: { sha: newCommit.sha, force: true },
    });
  } else {
    await gh(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: "POST", body: { ref: `refs/heads/${BRANCH}`, sha: newCommit.sha },
    });
  }

  console.log(`\n✅ Done!`);
  console.log(`   Repo:    https://github.com/${OWNER}/${REPO}`);
  console.log(`   Branch:  ${BRANCH}`);
  console.log(`   Commit:  ${newCommit.sha}`);
  console.log(`   Message: "${COMMIT_MSG}"`);
  console.log(`   Files:   ${treeItems.length} pushed`);
}

main().catch((err) => {
  console.error("\n❌ Push failed:", err.message);
  process.exit(1);
});
