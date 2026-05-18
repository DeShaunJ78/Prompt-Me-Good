import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "dist", "public");

const rawPort = process.env.PORT;
if (!rawPort) {
  console.error("PORT environment variable is required");
  process.exit(1);
}
const PORT = Number(rawPort);
if (!Number.isFinite(PORT) || PORT <= 0) {
  console.error(`Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function cacheHeaderFor(pathname, ext) {
  if (ext === ".html" || pathname === "/" || pathname.endsWith("/")) {
    // ns-1: HTML must NEVER be served from disk cache. `no-store` forbids the
    // browser (and any intermediary that honors it) from holding a copy at
    // all, so a redeploy is visible on the very next request — even when an
    // old tab has been backgrounded for days. Tradeoff: each visit re-fetches
    // the HTML shell (small), assets stay long-cached and unaffected.
    return "no-store, no-cache, must-revalidate, max-age=0";
  }
  if (pathname.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  if (pathname.startsWith("/scripts/")) {
    return "public, max-age=86400, must-revalidate";
  }
  if (pathname.startsWith("/images/") || pathname.startsWith("/fonts/")) {
    return "public, max-age=86400";
  }
  return "public, max-age=3600";
}

async function tryServe(req, res, fsPath, urlPath) {
  let s;
  try {
    s = await stat(fsPath);
  } catch {
    return false;
  }
  if (!s.isFile()) return false;

  const ext = extname(fsPath).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": cacheHeaderFor(urlPath, ext),
    "X-Content-Type-Options": "nosniff",
  };

  // audit-3 §15: clickjacking defense on the workstation. /app.html is the
  // only page where a framed clone could trick a signed-in user into
  // executing actions (Run With AI, Vault writes, settings). The marketing
  // pages don't carry that risk so we keep this scoped — embedding them in
  // legitimate previews (mockup-sandbox, partner widgets) stays possible.
  //
  // Check the resolved file path (not urlPath) so we catch every route that
  // serves app.html — the /app and /app/index.html rewrites at L115, the
  // extensionless .html fallback at L128, and any future alias. Bypass-proof.
  if (fsPath.endsWith("/app.html") || fsPath.endsWith("\\app.html")) {
    headers["X-Frame-Options"] = "DENY";
    headers["Content-Security-Policy"] = "frame-ancestors 'none'";
  }

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return true;
  }

  const body = await readFile(fsPath);
  res.writeHead(200, headers);
  res.end(body);
  return true;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (urlPath.includes("\0") || urlPath.includes("..")) {
    res.writeHead(400).end();
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";

  // Route split: /app and /app/ both serve the workstation (app.html).
  // Anything deeper under /app/* is a real asset request and falls through
  // to the normal static handler.
  if (urlPath === "/app" || urlPath === "/app/index.html") {
    urlPath = "/app.html";
  }

  const fsPath = normalize(join(ROOT, urlPath));
  if (!fsPath.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }

  if (await tryServe(req, res, fsPath, urlPath)) return;

  if (!extname(urlPath)) {
    if (await tryServe(req, res, fsPath + ".html", urlPath + ".html")) return;
  }

  // Branded 404 — serve dist/public/404.html with the 404 status code so
  // SEO crawlers see the right signal but humans see a useful page.
  try {
    const body = await readFile(join(ROOT, "404.html"));
    res.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
    return;
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.on("error", (err) => {
  console.error("[promptmegood] server error:", err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[promptmegood] listening on :${PORT}, serving ${ROOT}`);
});
