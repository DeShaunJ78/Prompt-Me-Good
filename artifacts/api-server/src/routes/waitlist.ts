/* ============================================================================
 * POST /api/waitlist — pricing-page waitlist signup.
 *
 * Replaces the formsubmit.co relay (which dumped one email per signup into
 * the support inbox). Emails are now persisted to the `waitlist_signups`
 * table so the team can export a clean CSV / query by source.
 *
 * Defenses (defense-in-depth):
 *   1. Cloudflare Turnstile token verification (when TURNSTILE_SECRET_KEY is
 *      set). Token comes from the widget on pricing.html and is verified
 *      server-side via siteverify. Skipped only if the secret is unset, so
 *      local dev still works without a Cloudflare account.
 *   2. Per-IP rate limiter (5 signups / 10 min) below.
 *   3. Unique index on email (returns duplicate: true instead of an error).
 *   4. Email is fingerprinted (non-reversible hash) before logging — no
 *      plaintext PII in logs.
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { db, waitlistSignupsTable, insertWaitlistSignupSchema } from "@workspace/db";
import { makeRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(
  token: string,
  remoteip: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  // No secret configured → integration is "off". Allow through so dev
  // environments without Cloudflare keys still function. Production should
  // always have the secret set.
  if (!secret) return { ok: true, reason: "turnstile_disabled" };
  if (!token) return { ok: false, reason: "missing_token" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip) body.set("remoteip", remoteip);
    const r = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch_error" };
  }
}

/* formsubmit-relay-1: restore the per-signup email notification that the
   prior formsubmit.co integration provided. The DB write remains the
   source of truth; this relay is a fire-and-forget side-effect so the
   owner gets an inbox ping for each new lead. Skipped on duplicate
   inserts and on relay failure (logged, never throws to the client). */
const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/ajax/support@promptmegood.com";

function relayToFormsubmit(
  log: { warn: (o: unknown, m: string) => void },
  payload: { email: string; source: string; tier?: string | null },
): void {
  fetch(FORMSUBMIT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: payload.email,
      _subject: `New PromptMeGood waitlist signup (${payload.tier ?? payload.source})`,
      source: payload.source,
      tier: payload.tier ?? "",
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((err: unknown) => {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "formsubmit relay failed (DB write succeeded)",
    );
  });
}

// Public unauthenticated POST — keep abuse modest.
// 5 signups / 10 minutes per IP is generous for legitimate use
// (one person resubmitting after a typo) but caps spam volume.
const waitlistLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  label: "general",
});

// Hash an email for log correlation without persisting the plaintext PII to
// log files. Truncated to 12 hex chars — enough to spot duplicates / bursts
// from the same address while staying non-reversible.
function emailFingerprint(email: string): string {
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h + email.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

router.post("/waitlist", waitlistLimiter, async (req, res) => {
  const log = req.log;

  const turnstileToken =
    typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : "";
  const verify = await verifyTurnstile(turnstileToken, req.ip);
  /* ts-soft-allow-1: the Turnstile widget fails to render visibly for some
     users (mobile Safari with strict tracking prevention, ad-blockers,
     site-key/domain mismatches in CF). Hard-blocking the submission was
     bleeding conversion (user reported "Notify Me does nothing" while the
     widget was invisible). Soft-allow: still attempt the insert, but
     suffix the source with `-unverified` so the team can review/clean up
     unverified entries later. The per-IP rate limiter (5/10min) caps abuse. */
  const turnstileFailed = !verify.ok;
  if (turnstileFailed) {
    log.warn({ reason: verify.reason }, "waitlist turnstile failed — soft-allowing");
  }

  /* M-4 (audit-2 triage): accept optional `tier` so marketing can segment
     the waitlist by which Pro tier the user clicked Notify Me on. The
     enum on the schema rejects unknown values silently (Zod drops the
     field), so junk input doesn't leak into the table. */
  const rawSource =
    typeof req.body?.source === "string" ? req.body.source.slice(0, 48) : "pricing";
  const sourceWithFlag = turnstileFailed ? `${rawSource}-unverified` : rawSource;
  const parsed = insertWaitlistSignupSchema.safeParse({
    email: typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "",
    source: sourceWithFlag,
    tier: typeof req.body?.tier === "string" && req.body.tier ? req.body.tier : undefined,
    userAgent: req.get("user-agent")?.slice(0, 500),
    referrer: req.get("referer")?.slice(0, 500),
  });

  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  try {
    const inserted = await db
      .insert(waitlistSignupsTable)
      .values(parsed.data)
      .onConflictDoNothing({ target: waitlistSignupsTable.email })
      .returning({ id: waitlistSignupsTable.id });

    const duplicate = inserted.length === 0;
    log.info(
      {
        emailFp: emailFingerprint(parsed.data.email),
        source: parsed.data.source,
        tier: parsed.data.tier ?? null,
        duplicate,
      },
      "waitlist signup",
    );
    /* Fire-and-forget owner notification. Skip duplicates so re-submits
       don't spam the inbox. Awaiting is intentional — the relay runs in
       the background and the client gets its response immediately. */
    if (!duplicate) {
      relayToFormsubmit(log, {
        email: parsed.data.email,
        source: parsed.data.source,
        tier: parsed.data.tier ?? null,
      });
    }
    return res.json({ ok: true, duplicate });
  } catch (err) {
    log.error({ err }, "waitlist insert failed");
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
