import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

export const waitlistSignupsTable = pgTable(
  "waitlist_signups",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source").notNull().default("pricing"),
    /* M-4 (audit-2 triage): which tier did the user click "Notify Me" on?
       Captured from the data-pmg-upgrade attribute on the four pricing-card
       Notify-Me buttons (pro_monthly | pro_yearly | pro_studio_monthly |
       pro_studio_yearly). Nullable because the bare email-form submit
       (without going through a tier card) won't have one. */
    tier: text("tier"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("waitlist_signups_email_unique").on(table.email),
  }),
);

const ALLOWED_TIERS = [
  "pro_monthly",
  "pro_yearly",
  "pro_studio_monthly",
  "pro_studio_yearly",
] as const;

export const insertWaitlistSignupSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().max(64).optional().default("pricing"),
  tier: z.enum(ALLOWED_TIERS).optional(),
  userAgent: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
});

export type InsertWaitlistSignup = z.infer<typeof insertWaitlistSignupSchema>;
export type WaitlistSignup = typeof waitlistSignupsTable.$inferSelect;
