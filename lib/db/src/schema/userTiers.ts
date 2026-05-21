import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userTiers = pgTable("user_tiers", {
  userId:             text("user_id").primaryKey(),
  tier:               text("tier").notNull().default("free"),
  specPacksThisMonth: integer("spec_packs_this_month").notNull().default(0),
  monthResetAt:       timestamp("month_reset_at", { withTimezone: true }).defaultNow().notNull(),
  credits:            text("credits").notNull().default("{}"),
  onboardingComplete:   boolean("onboarding_complete").notNull().default(false),
  builderType:          text("builder_type"),
  experienceLevel:      text("experience_level"),
  isAdmin:              boolean("is_admin").notNull().default(false),
  founderAccess:        boolean("founder_access").notNull().default(false),
  founderAccessExpiry:  timestamp("founder_access_expiry", { withTimezone: true }),
  createdAt:            timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserTierSchema = createInsertSchema(userTiers).omit({
  createdAt: true,
  updatedAt: true,
});

export type UserTier = typeof userTiers.$inferSelect;
export type InsertUserTier = z.infer<typeof insertUserTierSchema>;
