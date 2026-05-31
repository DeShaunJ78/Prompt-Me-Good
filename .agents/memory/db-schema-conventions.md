---
name: DB schema conventions
description: Where the Drizzle schema lives and migration/push mechanics for PromptMeGood
---

## Location & commands
- Schema is in `lib/db/src/schema/*` (NOT `packages/db/` — replit.md is stale on this path). Barrel: `lib/db/src/schema/index.ts`.
- Push schema to **dev** DB: `pnpm --filter @workspace/db run push` (drizzle-kit push). The root `pnpm db:push` alias does NOT exist.
- **Why:** prod schema is applied automatically by Replit's Publish flow (diffs dev→prod). Never hand-write prod migration scripts.

## Index-promotion safety rule
Before promoting a plain `index()` to `uniqueIndex()` on an existing table, first run a duplicate-count assertion against BOTH dev and prod (`GROUP BY col HAVING COUNT(*)>1`). A unique-index push fails if duplicates already exist.
**How to apply:** use `executeSql` with `environment:"development"` and `environment:"production"` (prod is read-only replica) before editing the schema.
