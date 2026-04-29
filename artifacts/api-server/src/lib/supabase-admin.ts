/* ============================================================================
 * Supabase admin client (service-role).
 *
 * The SERVICE-ROLE key BYPASSES Row-Level Security. NEVER expose it to the
 * browser or include it in any response body. It is only used on the server
 * to:
 *   1. Validate a user's JWT via supabaseAdmin.auth.getUser(jwt).
 *   2. Upsert the `profiles` table from the Stripe webhook handler.
 *
 * Auth.getUser() with a JWT does NOT require service-role — but the same
 * client also has to write subscription state with RLS bypassed, so we keep a
 * single admin-scoped instance.
 * ============================================================================ */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env["SUPABASE_URL"];
const KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!URL || !KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required Replit Secrets but at least one is missing.",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(URL, KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
