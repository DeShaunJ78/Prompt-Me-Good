import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

export const waitlistSignupsTable = pgTable(
  "waitlist_signups",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    source: text("source").notNull().default("pricing"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("waitlist_signups_email_unique").on(table.email),
  }),
);

export const insertWaitlistSignupSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().max(64).optional().default("pricing"),
  userAgent: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
});

export type InsertWaitlistSignup = z.infer<typeof insertWaitlistSignupSchema>;
export type WaitlistSignup = typeof waitlistSignupsTable.$inferSelect;
