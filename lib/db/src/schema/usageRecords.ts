import { pgTable, text, integer, timestamp, serial, unique } from "drizzle-orm/pg-core";

export const usageRecords = pgTable(
  "usage_records",
  {
    id:          serial("id").primaryKey(),
    userId:      text("user_id").notNull(),
    feature:     text("feature").notNull(),
    count:       integer("count").notNull().default(0),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd:   timestamp("period_end",   { withTimezone: true }).notNull(),
    updatedAt:   timestamp("updated_at",   { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.feature, t.periodStart)],
);

export type UsageRecord = typeof usageRecords.$inferSelect;
