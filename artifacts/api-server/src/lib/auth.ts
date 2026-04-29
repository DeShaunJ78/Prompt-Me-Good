/* ============================================================================
 * Express middleware: verify Supabase JWT in Authorization header.
 *
 * The frontend calls `supabase.auth.getSession()`, takes the access_token,
 * and sends it as `Authorization: Bearer <jwt>`. We hand that JWT to
 * supabaseAdmin.auth.getUser(jwt) which validates the signature against the
 * Supabase project's signing key.
 *
 * On success: req.user = { id, email } and the handler runs.
 * On failure: 401 + JSON error body. Never leaks internal validator messages.
 * ============================================================================ */
import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "./supabase-admin";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

export async function requireSupabaseUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }
  const jwt = match[1]!.trim();
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !data || !data.user) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    req.user = { id: data.user.id, email: data.user.email || "" };
    next();
  } catch (err) {
    req.log?.warn({ err }, "supabase auth.getUser threw");
    res.status(401).json({ error: "Could not validate session." });
  }
}
