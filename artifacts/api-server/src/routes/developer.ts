/* ============================================================================
 * /api/developer — developer API key management.
 * ----------------------------------------------------------------------------
 *   GET    /api/developer/keys         list caller's keys (no secrets)
 *   POST   /api/developer/keys         generate a new key (returned ONCE)
 *   DELETE /api/developer/keys/:id     soft-revoke a key (is_active=false)
 *
 * All routes require a Supabase JWT — users manage only their own keys.
 * The full key string is only ever returned in the POST response; the
 * database stores only the SHA-256 hash.
 * ============================================================================ */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { resolveUserFromJwt } from "../middlewares/userCaps";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CreateKeyInput = z.object({
  label: z.string().min(1).max(64),
});

async function requireUser(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const token = m[1]!.trim();
  // Browser-issued Supabase JWTs only — never accept pmg_live_* keys for
  // self-service key management (would let one key spawn more keys).
  if (token.startsWith("pmg_live_")) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const ctx = await resolveUserFromJwt(token);
  if (!ctx) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return ctx.userId;
}

router.get("/developer/keys", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  try {
    const rows = await db
      .select({
        id: apiKeysTable.id,
        keyPrefix: apiKeysTable.keyPrefix,
        label: apiKeysTable.label,
        isActive: apiKeysTable.isActive,
        lastUsedAt: apiKeysTable.lastUsedAt,
        createdAt: apiKeysTable.createdAt,
      })
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.isActive, true)))
      .orderBy(desc(apiKeysTable.createdAt));
    res.json({ keys: rows });
  } catch (err) {
    logger.error({ err, userId }, "developer.keys: list failed");
    res.status(500).json({ error: "Failed to list API keys" });
  }
});

router.post("/developer/keys", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const parsed = CreateKeyInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Label must be a string 1-64 characters" });
    return;
  }
  const label = parsed.data.label.trim();
  if (!label) {
    res.status(400).json({ error: "Label is required" });
    return;
  }

  const fullKey = "pmg_live_" + randomBytes(16).toString("hex");
  const keyHash = createHash("sha256").update(fullKey, "utf8").digest("hex");
  const keyPrefix = fullKey.slice(0, 12) + "...";

  try {
    const inserted = await db
      .insert(apiKeysTable)
      .values({ userId, keyHash, keyPrefix, label })
      .returning({ id: apiKeysTable.id });
    const row = inserted[0];
    if (!row) {
      res.status(500).json({ error: "Failed to create API key" });
      return;
    }
    res.json({
      key: fullKey,
      id: row.id,
      keyPrefix,
      label,
    });
  } catch (err) {
    logger.error({ err, userId }, "developer.keys: create failed");
    res.status(500).json({ error: "Failed to create API key" });
  }
});

router.delete("/developer/keys/:id", async (req, res) => {
  const userId = await requireUser(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid key id" });
    return;
  }
  try {
    const updated = await db
      .update(apiKeysTable)
      .set({ isActive: false })
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
      .returning({ id: apiKeysTable.id });
    if (!updated.length) {
      res.status(404).json({ error: "API key not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, id }, "developer.keys: revoke failed");
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});

export default router;
