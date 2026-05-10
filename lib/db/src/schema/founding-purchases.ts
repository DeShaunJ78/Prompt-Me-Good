/* ============================================================================
 * Founding Member purchases — confirmed one-time $79 lifetime sales.
 *
 * One row per `checkout.session.completed` event for tier=founding,
 * payment_status=paid. The unique index on stripeSessionId keeps Stripe
 * webhook retries idempotent (every redelivery of the same event resolves
 * to a no-op via onConflictDoNothing).
 *
 * The COUNT() of this table is the source of truth for seat enforcement —
 * NOT `profiles.plan='founding'`. Profiles can be back-filled later (e.g.
 * an existing Supabase user buys Founding) but a row here means money
 * actually changed hands.
 * ============================================================================ */
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const foundingPurchasesTable = pgTable(
  "founding_purchases",
  {
    id: serial("id").primaryKey(),
    stripeSessionId: text("stripe_session_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    email: text("email").notNull(),
    /** "anonymous" (purchased without an account; magic link sent post-purchase)
     *  or "authenticated" (purchased while logged in to a Supabase session). */
    flow: text("flow").notNull().default("anonymous"),
    /** Filled in when we successfully linked the purchase to a Supabase user
     *  (either by inviteUserByEmail at webhook time, or later by
     *  getOrCreateProfile elevating an existing email match). Nullable so the
     *  purchase row can persist even if Supabase user creation transiently
     *  fails — operator can replay later. */
    supabaseUserId: text("supabase_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sessionUnique: uniqueIndex("founding_purchases_session_unique").on(
      table.stripeSessionId,
    ),
    // NON-unique on email: a buyer might legitimately complete a second
    // paid session (e.g. accidental double purchase, or an authenticated
    // buyer who already bought anonymously). The webhook MUST still
    // record both rows so the seat count stays honest — operator handles
    // the refund manually. Idempotency is anchored on stripe_session_id,
    // not email.
    emailIdx: index("founding_purchases_email_idx").on(table.email),
  }),
);

export type FoundingPurchase = typeof foundingPurchasesTable.$inferSelect;
export type InsertFoundingPurchase =
  typeof foundingPurchasesTable.$inferInsert;
