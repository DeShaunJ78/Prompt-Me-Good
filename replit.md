# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### PromptMeGood (`artifacts/promptmegood`)

Single-file static HTML AI prompt builder (`index.html`, ~6.2k lines, vanilla JS, vite preview). Live at https://prompt-me-good.replit.app.

Key features:
- **Builder**: goal, category, skill level, tone, output format, output language, personality, extra details, **guardrails** (things AI should avoid), **max response length** (presets 100/200/300/500 + custom), boost toggles (Money / Human Voice / Clarity / Photo).
- **Guide Me**: 4-question modal (`#guided-mode-dialog`, opened by `#guided-mode-btn`) that fills `#goal`, `#details`, `#guardrails` for users who don't know how to phrase a goal. Fields are REPLACED on each run (not appended).
- **Refinement**: refine buttons (More Detailed / More Aggressive / Beginner Friendly), Fine-Tune Your Prompt, Undo Last Change, manual editing.
- **Quality Checker**: `#check-quality-btn` runs heuristics over the form state (short goal, missing details/guardrails/max length, vague-word regex) and shows up to 3 suggestions in `#quality-feedback`.
- **Use**: Copy + ChatGPT/Claude/Perplexity launch buttons, Print/PDF, prompt history.
- **Tour**: in-app onboarding tour (`OB_STEPS`) and demo walkthrough (`DEMO_STEPS`) launched by "Use Demo Values" button. Replay from footer.
- **Manual**: full in-page user manual (`#manual-*` sections) covering all features.

Workflow: `pnpm --filter @workspace/promptmegood run dev`. Iteration cadence is "polish round → architect review → runTest → republish via suggest_deploy".
