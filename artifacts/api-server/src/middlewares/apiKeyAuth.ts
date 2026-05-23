/* ============================================================================
 * API key authentication middleware.
 * ----------------------------------------------------------------------------
 * Mounted globally before route handlers. Resolves Authorization: Bearer
 * pmg_live_* tokens to a user + plan and attaches to req.pmgApiKeyUser.
 *
 *   - No Authorization header, or non pmg_live_* token: pass through. JWT
 *     auth in userCapEnforce / etc. still runs unchanged for browser traffic.
 *   - pmg_live_* token that doesn't match an active row: 401 immediately.
 *   - Valid token: req.pmgApiKeyUser populated, last_used_at updated
 *     fire-and-forget, request proceeds.
 *
 * Storage: lib/db/src/schema/api-keys.ts. Only the SHA-256 hash is queried;
 * the raw key never touches the database.
 * ============================================================================ */
import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabase-admin";
import { logger } from "../lib/logger";
import type { PmgPlan } from "../lib/pricing-config";

export interface ApiKeyUser {
  userId: string;
  plan: PmgPlan;
  createdAtMs: number;
  apiKeyId: number;
}

export interface ApiKeyAuthRequest extends Request {
  pmgApiKeyUser?: ApiKeyUser;
}

const KEY_PREFIX = "pmg_live_";

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export async function apiKeyAuth(
  req: ApiKeyAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return next();
  const token = m[1]!.trim();
  if (!token.startsWith(KEY_PREFIX)) return next();

  try {
    const hash = hashKey(token);
    const rows = await db
      .select({
        id: apiKeysTable.id,
        userId: apiKeysTable.userId,
        isActive: apiKeysTable.isActive,
      })
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.isActive, true)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Look up the user's plan by mirroring resolveUserFromJwt's profile
    // query. createdAtMs comes from Supabase auth.users so trial windowing
    // continues to work for API-key traffic.
    let plan: PmgPlan = "free";
    let createdAtMs = Date.now();
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(row.userId);
      if (authData?.user?.created_at) {
        const t = new Date(authData.user.created_at).getTime();
        if (Number.isFinite(t)) createdAtMs = t;
      }
    } catch (err) {
      logger.warn({ err, userId: row.userId }, "apiKeyAuth: getUserById failed");
    }
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("user_id", row.userId)
        .maybeSingle();
      const p = (prof as { plan?: string } | null)?.plan;
      if (p === "founding" || p === "pro" || p === "pro_studio") plan = p;
    } catch {
      /* profile lookup is best-effort; default "free" */
    }

    req.pmgApiKeyUser = {
      userId: row.userId,
      plan,
      createdAtMs,
      apiKeyId: row.id,
    };

    // Fire-and-forget last_used_at update — do not block the request.
    void db
      .update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id))
      .catch((err) => {
        logger.warn({ err, apiKeyId: row.id }, "apiKeyAuth: lastUsedAt update failed");
      });

    return next();
  } catch (err) {
    logger.error({ err }, "apiKeyAuth: unexpected failure");
    res.status(500).json({ error: "Internal error validating API key" });
    return;
  }
}
