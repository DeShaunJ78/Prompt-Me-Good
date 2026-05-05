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
    return "no-cache, must-revalidate";
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

  const fsPath = normalize(join(ROOT, urlPath));
  if (!fsPath.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }

  if (await tryServe(req, res, fsPath, urlPath)) return;

  if (!extname(urlPath)) {
    if (await tryServe(req, res, fsPath + ".html", urlPath + ".html")) return;
    if (await tryServe(req, res, join(ROOT, "index.html"), "/index.html"))
      return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.on("error", (err) => {
  console.error("[promptmegood] server error:", err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[promptmegood] listening on :${PORT}, serving ${ROOT}`);
});
