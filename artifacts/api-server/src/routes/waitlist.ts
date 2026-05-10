/* ============================================================================
 * POST /api/waitlist — pricing-page waitlist signup.
 *
 * Replaces the formsubmit.co relay (which dumped one email per signup into
 * the support inbox). Emails are now persisted to the `waitlist_signups`
 * table so the team can export a clean CSV / query by source.
 *
 * - Idempotent on email (unique index): a second submit for the same address
 *   returns 200 with `duplicate: true` so the UI doesn't show a scary error.
 * - No auth: this is a public form. We rely on the unique index + a simple
 *   length cap to keep abuse manageable. Add a Cloudflare Turnstile or
 *   per-IP rate limit if abuse appears.
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { db, waitlistSignupsTable, insertWaitlistSignupSchema } from "@workspace/db";
import { makeRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

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
  const parsed = insertWaitlistSignupSchema.safeParse({
    email: typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "",
    source: typeof req.body?.source === "string" ? req.body.source.slice(0, 64) : "pricing",
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
        duplicate,
      },
      "waitlist signup",
    );
    return res.json({ ok: true, duplicate });
  } catch (err) {
    log.error({ err }, "waitlist insert failed");
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
