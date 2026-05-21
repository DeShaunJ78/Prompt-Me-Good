import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const topupPurchases = pgTable("topup_purchases", {
  id:           serial("id").primaryKey(),
  userId:       text("user_id").notNull(),
  pack:         text("pack").notNull(),
  feature:      text("feature"),
  creditAdded:  integer("credit_added").notNull().default(0),
  priceCents:   integer("price_cents").notNull(),
  periodStart:  timestamp("period_start", { withTimezone: true }).notNull(),
  purchasedAt:  timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TopupPurchase = typeof topupPurchases.$inferSelect;
