---
name: Playwright suite quirks
description: How to reliably run the frontend Playwright suite in this workspace
---

Rule: run the Playwright suite per-file in the foreground (each file ~15–90s); never as one big background run.

**Why:** Full-suite background runs (128 tests, 1 worker) died silently twice with the log stuck at the header (line reporter buffers until process exit). Also, polling with `pgrep -f "playwright test"` matches the polling shell's own command line, producing false "still running" results for an hour.

**How to apply:** `cd artifacts/promptmegood && npx playwright test tests/<file>.spec.ts --reporter=line` one file per bash call (<120s timeout). For slow files (suggestions, workstation-tour-mobile), split by test line numbers (`file.spec.ts:126 file.spec.ts:140 …`). Verify liveness via `ps -eo pid,etime,cmd`, not pgrep on the pattern you typed.
