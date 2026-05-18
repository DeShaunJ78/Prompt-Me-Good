/* ============================================================================
 * Allowed-origin allowlist — shared by CORS middleware and any handler that
 * needs to validate a request Origin (e.g. founding-checkout return URLs).
 *
 * Sources, in order:
 *   1. REPLIT_DOMAINS env var (comma-separated) — production + preview hosts.
 *   2. The canonical apex + www variants of the production domain.
 *   3. localhost on port 80 (dev only) — added when NODE_ENV !== 'production'.
 *
 * audit-3 §15: hoisted out of founding-checkout.ts so CORS can use the same
 * source of truth. Wide-open `app.use(cors())` previously allowed any origin
 * on the internet to drive POST /api/* from a victim browser — bounded by
 * rate limits + Turnstile, but still a free abuse vector.
 * ============================================================================ */

export function buildAllowedOrigins(): string[] {
  const list: string[] = [];
  const domains = (process.env["REPLIT_DOMAINS"] || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const d of domains) list.push(`https://${d}`);
  list.push("https://www.promptmegood.com");
  list.push("https://promptmegood.com");
  if ((process.env["NODE_ENV"] || "development") !== "production") {
    list.push("http://localhost:80");
    list.push("http://localhost");
  }
  return Array.from(new Set(list));
}

/**
 * Pick a safe origin for redirect URLs. Returns the request origin if it is
 * on the allowlist; otherwise falls back to the first allowed origin (the
 * canonical Replit domain or production domain).
 */
export function pickOrigin(requestOrigin: string | undefined): string {
  const allowed = buildAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || "https://www.promptmegood.com";
}
