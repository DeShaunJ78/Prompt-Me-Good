/* ============================================================================
 * POST /api/contact — public contact form on /contact.html.
 *
 * Replaces sitewide mailto:support@promptmegood.com links. Visitors fill out
 * Name + Email + Subject + Message; we send via the same Zoho SMTP transporter
 * used by the waitlist relay, so the message lands in the support inbox.
 *
 * Defenses (defense-in-depth):
 *   1. Cloudflare Turnstile token verification (when TURNSTILE_SECRET_KEY is
 *      set). Soft-allow on failure (matches waitlist ts-soft-allow-1) so a
 *      misbehaving widget doesn't bleed legitimate contact form submissions.
 *   2. Per-IP rate limiter: 3 submissions / 15 min. Lower than waitlist
 *      because each submission costs an actual email send.
 *   3. Honeypot field (`website`): if filled, silently 200 and drop. Bots
 *      tend to fill every input; humans never see this field.
 *   4. Zod validation: email format, length caps, required fields.
 *   5. Length caps on every field to keep payloads small and inboxes sane.
 * ============================================================================ */
import { Router, type IRouter } from "express";
import { z } from "zod";
import nodemailer, { type Transporter } from "nodemailer";
import { makeRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(
  token: string,
  remoteip: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
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

/* zoho-smtp-1: shared transporter pattern (mirrors waitlist.ts). Cached
   module-level singleton, env-validated on first send, no-op + warn if
   misconfigured. */
const NOTIFY_TO = "support@promptmegood.com";
let cachedTransporter: Transporter | null = null;
let smtpConfigWarned = false;

function getTransporter(
  log: { warn: (o: unknown, m: string) => void },
): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env["ZOHO_SMTP_HOST"];
  const portStr = process.env["ZOHO_SMTP_PORT"];
  const user = process.env["ZOHO_SMTP_USER"];
  const pass = process.env["ZOHO_SMTP_PASS"];
  if (!host || !portStr || !user || !pass) {
    if (!smtpConfigWarned) {
      smtpConfigWarned = true;
      log.warn(
        { hasHost: !!host, hasPort: !!portStr, hasUser: !!user, hasPass: !!pass },
        "zoho smtp not fully configured — contact form disabled",
      );
    }
    return null;
  }
  const port = Number(portStr);
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

const SUBJECT_OPTIONS = [
  "General",
  "Billing",
  "Bug report",
  "Feature request",
  "Privacy request",
  "Press",
  "Other",
] as const;

const contactBodySchema = z.object({
  name: z.string().trim().min(1, "name_required").max(100, "name_too_long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("invalid_email")
    .max(254, "email_too_long"),
  subject: z.enum(SUBJECT_OPTIONS).default("General"),
  message: z
    .string()
    .trim()
    .min(10, "message_too_short")
    .max(5000, "message_too_long"),
  // Honeypot: legitimate browsers leave this empty (it's hidden via CSS).
  website: z.string().max(200).optional(),
  turnstileToken: z.string().optional(),
});

// Lower than waitlist because each submission triggers a real email send.
const contactLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  label: "contact",
});

router.post("/contact", contactLimiter, async (req, res) => {
  const log = req.log;

  const parsed = contactBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    });
  }
  const { name, email, subject, message, website, turnstileToken } = parsed.data;

  // Honeypot: silently succeed on bot fills so they don't retry.
  if (website && website.length > 0) {
    log.warn({ ip: req.ip }, "contact form honeypot tripped — silently dropping");
    return res.json({ ok: true });
  }

  const verify = await verifyTurnstile(turnstileToken ?? "", req.ip);
  const turnstileFailed = !verify.ok;
  if (turnstileFailed) {
    log.warn(
      { reason: verify.reason },
      "contact turnstile failed — soft-allowing",
    );
  }

  const transporter = getTransporter(log);
  if (!transporter) {
    return res.status(503).json({ ok: false, error: "email_unavailable" });
  }

  const from = process.env["ZOHO_SMTP_USER"]!;
  const ts = new Date().toISOString();
  const verificationLine = turnstileFailed
    ? `(turnstile: failed — ${verify.reason ?? "unknown"})`
    : "(turnstile: ok)";
  const text =
    `New contact form submission\n\n` +
    `Name:    ${name}\n` +
    `Email:   ${email}\n` +
    `Subject: ${subject}\n` +
    `When:    ${ts}\n` +
    `${verificationLine}\n\n` +
    `--- Message ---\n${message}\n`;

  try {
    await transporter.sendMail({
      from: `"PromptMeGood Contact Form" <${from}>`,
      to: NOTIFY_TO,
      replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
      subject: `[Contact: ${subject}] ${name}`,
      text,
    });
    log.info({ subject }, "contact form sent");
    return res.json({ ok: true });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "contact form send failed",
    );
    return res.status(502).json({ ok: false, error: "send_failed" });
  }
});

export default router;
