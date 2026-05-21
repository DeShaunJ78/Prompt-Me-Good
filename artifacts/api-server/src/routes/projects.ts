import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, projects as projectsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request, Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/projects — list all projects for the current user
// ---------------------------------------------------------------------------
router.get("/projects", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  try {
    const rows = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.userId, userId))
      .orderBy(desc(projectsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    console.error("[projects/list]", err);
    res.status(500).json({ error: "Failed to fetch projects." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id — get a single project (must own it)
// ---------------------------------------------------------------------------
router.get("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { id } = req.params;
  try {
    const [row] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
    if (!row) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[projects/get]", err);
    res.status(500).json({ error: "Failed to fetch project." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/projects — create a project
// ---------------------------------------------------------------------------
router.post("/projects", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { name, mode, ideaText, specPack, flightLog, launchScore } = req.body as {
    name?: string;
    mode?: string;
    ideaText?: string;
    specPack?: unknown;
    flightLog?: unknown[];
    launchScore?: number;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required." });
    return;
  }

  try {
    const [row] = await db
      .insert(projectsTable)
      .values({
        userId,
        name: name.trim(),
        mode: mode ?? "spec",
        ideaText: ideaText ?? null,
        specPack: specPack ?? null,
        flightLog: flightLog ?? [],
        launchScore: launchScore ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[projects/create]", err);
    res.status(500).json({ error: "Failed to create project." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/projects/:id — update a project (must own it)
// ---------------------------------------------------------------------------
router.put("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { id } = req.params;
  const { name, specPack, flightLog, launchScore } = req.body as {
    name?: string;
    specPack?: unknown;
    flightLog?: unknown[];
    launchScore?: number;
  };

  try {
    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined)        updates.name        = name.trim();
    if (specPack !== undefined)    updates.specPack    = specPack;
    if (flightLog !== undefined)   updates.flightLog   = flightLog;
    if (launchScore !== undefined) updates.launchScore = launchScore;

    const [updated] = await db
      .update(projectsTable)
      .set(updates)
      .where(eq(projectsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[projects/update]", err);
    res.status(500).json({ error: "Failed to update project." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id — delete a project (must own it)
// ---------------------------------------------------------------------------
router.delete("/projects/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const { id } = req.params;

  try {
    const deleted = await db
      .delete(projectsTable)
      .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)))
      .returning({ id: projectsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    res.json({ deleted: deleted[0].id });
  } catch (err) {
    console.error("[projects/delete]", err);
    res.status(500).json({ error: "Failed to delete project." });
  }
});

export default router;
