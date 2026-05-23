/* ============================================================================
 * Developer API keys.
 *
 * One row per generated key. The full key is only ever returned to the user
 * once at creation time; only the SHA-256 hash is persisted, so a database
 * leak does not expose live credentials. `keyPrefix` (first 12 chars of the
 * key + ellipsis) is what we show in the management UI so users can identify
 * which key is which without seeing the secret.
 *
 * Revocation is soft (is_active=false) so the audit trail is preserved.
 * ============================================================================ */
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    label: text("label").notNull().default("Default"),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdx: index("api_keys_user_idx").on(table.userId),
    hashUnique: index("api_keys_hash_idx").on(table.keyHash),
  }),
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type InsertApiKey = typeof apiKeysTable.$inferInsert;
