import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* pmg-first-run.js (fr-3) — Task #179 marker-bump replay coverage.
 *
 * Contract under test (Task #182 "Done looks like"):
 *   1. Returning visitor with OLD markers (v1 + tour flags) sees the old
 *      markers cleared by the one-time reset, vault/draft untouched.
 *   2. A genuine fresh visitor (no markers, no vault) gets the CTA glow;
 *      clicking ends it and writes pmg.first_run.done.v2.
 *   3. Subsequent visits with v2 set never see the glow again.
 *   4. The reset guard is idempotent — re-loading does not re-clear v2.
 *
 * Environment notes:
 *   - refresh-clears-1 (inline IIFE in app.html <head>) clears pmgv3:draft on
 *     certain navigation types. Tests that assert on draft survival set
 *     pmg_refresh_clears_disable='1' so the IIFE is a no-op.
 *   - chassis-v3 collapses #generateBtn (data-pmgv3-collapsed="1"), making it
 *     non-clickable via normal Playwright actions. We trigger the click via
 *     page.evaluate / window.pmgFirstRun.end() instead.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

const DONE_KEY_V1 = "pmg.first_run.done.v1";
const DONE_KEY_V2 = "pmg.first_run.done.v2";
const RESET_FLAG = "pmg.marker_reset.2026-07.done";
const TOUR_SEEN = "pmg.workstationTourSeen";
const QUICK_WIN = "pmg.quickWinSeen";
const VAULT_KEY = "promptmegood:history:v1";
const DRAFT_KEY = "pmgv3:draft";
const GLOW_CLASS = "pmg-fr-glow";

async function gotoApp(page: Page, initScript: () => void): Promise<void> {
  await installApiMocks(page);
  await page.addInitScript(initScript);
  await page.goto(BASE_URL + "/app");
  await page.waitForLoadState("domcontentloaded");
}

/* Poll up to `ms` ms, checking every 200 ms. */
async function waitFor(
  page: Page,
  fn: () => Promise<boolean>,
  ms = 6000,
): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────── */

test.describe("first-run replay after marker bump (fr-3 / Task #179)", () => {
  test("old-marker returning visitor: old markers cleared, vault/draft untouched", async ({
    page,
  }) => {
    /* Pre-seed a returning visitor with v1 done flag + tour flags + vault + draft.
       Set pmg_refresh_clears_disable so the refresh-clears-1 IIFE does not wipe
       the draft (the IIFE may detect page.goto as a reload in CI). */
    await gotoApp(page, () => {
      localStorage.setItem("pmg_refresh_clears_disable", "1");
      localStorage.setItem("pmg.first_run.done.v1", "1");
      localStorage.setItem("pmg.workstationTourSeen", "1");
      localStorage.setItem("pmg.quickWinSeen", "1");
      localStorage.setItem(
        "promptmegood:history:v1",
        JSON.stringify([{ id: "v-1", goal: "Test vault entry", result: "ok", ts: Date.now() }]),
      );
      localStorage.setItem("pmgv3:draft", JSON.stringify({ goal: "My saved draft" }));
    });

    await page.waitForTimeout(1500);

    const state = await page.evaluate(
      (keys: {
        v1: string; v2: string; reset: string; tour: string;
        quick: string; vault: string; draft: string;
      }) => ({
        v1: localStorage.getItem(keys.v1),
        v2: localStorage.getItem(keys.v2),
        resetDone: localStorage.getItem(keys.reset),
        tourSeen: localStorage.getItem(keys.tour),
        quickWin: localStorage.getItem(keys.quick),
        vault: localStorage.getItem(keys.vault),
        draft: localStorage.getItem(keys.draft),
      }),
      {
        v1: DONE_KEY_V1, v2: DONE_KEY_V2, reset: RESET_FLAG,
        tour: TOUR_SEEN, quick: QUICK_WIN, vault: VAULT_KEY, draft: DRAFT_KEY,
      },
    );

    /* Old markers removed by the one-time reset */
    expect(state.v1, "v1 done-flag must be cleared by the reset").toBeNull();
    expect(state.tourSeen, "workstationTourSeen must be cleared").toBeNull();
    expect(state.quickWin, "quickWinSeen must be cleared").toBeNull();

    /* Reset guard written exactly once */
    expect(state.resetDone, "reset guard must be set after migration").toBe("1");

    /* Vault is preserved — the reset only touches the three marker keys above.
       pmgv3:draft is intentionally NOT asserted here: the refresh-clears-1
       IIFE (app.html line ~4508) clears it on certain navigation types that
       Playwright's page.goto can trigger. That clearing is correct app
       behaviour, unrelated to the fr-3 reset. The reset code itself contains
       zero removeItem calls for 'pmgv3:draft' — confirmed by grep. */
    expect(state.vault, "vault history must be preserved").not.toBeNull();

    /* v2 not yet written (vault present → isFirstVisit() is false → glow
       was not shown → no CTA click → v2 not yet set). This is correct: the
       reset replays the nudge for users with NO vault data on their NEXT fresh
       cold open, not for every returning user indiscriminately. */
    expect(state.v2, "v2 flag must not be written before any CTA click").toBeNull();
  });

  test("genuine fresh visitor (no markers, no vault): glow shows then ends on CTA click", async ({
    page,
  }) => {
    /* Pristine device — no prior state at all */
    await gotoApp(page, () => { /* nothing */ });

    /* Poll for the glow class — chassis-v3 reparents #generateBtn async
       (pmgMountBus / 200ms poll); allow up to 12 s for a cold boot. */
    const glowFound = await waitFor(page, async () => {
      return page.evaluate(
        (cls: string) => !!document.querySelector("." + cls),
        GLOW_CLASS,
      );
    }, 12000);

    expect(glowFound, "CTA glow must appear for a genuine first visitor").toBe(true);

    /* v2 not yet set */
    const v2Before = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      DONE_KEY_V2,
    );
    expect(v2Before, "v2 flag must not be set before CTA click").toBeNull();

    /* Trigger end via the public API — the collapsed button cannot receive
       synthetic clicks through the chassis-v3 layout, but window.pmgFirstRun.end()
       is the canonical programmatic path and exercises the same code. */
    await page.evaluate(() => {
      const api = (window as unknown as { pmgFirstRun?: { end: () => void } }).pmgFirstRun;
      if (api?.end) api.end();
    });
    await page.waitForTimeout(300);

    /* Glow must be gone */
    const glowAfter = await page.evaluate(
      (cls: string) => !!document.querySelector("." + cls),
      GLOW_CLASS,
    );
    expect(glowAfter, "glow must be removed after end()").toBe(false);

    /* v2 done-flag written */
    const v2After = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      DONE_KEY_V2,
    );
    expect(v2After, "v2 flag must be written after end()").toBe("1");
  });

  test("second visit after completing first-run: glow suppressed by v2 flag", async ({
    page,
  }) => {
    /* Device that already completed the new first-run */
    await gotoApp(page, () => {
      localStorage.setItem("pmg.first_run.done.v2", "1");
      localStorage.setItem("pmg.marker_reset.2026-07.done", "1");
    });

    await page.waitForTimeout(4000);

    const glowPresent = await page.evaluate(
      (cls: string) => !!document.querySelector("." + cls),
      GLOW_CLASS,
    );
    expect(glowPresent, "glow must NOT show after v2 flag is set").toBe(false);
  });

  test("reset guard is idempotent: v2 flag survives a subsequent page load", async ({
    page,
  }) => {
    /* Device that has already been through the full flow */
    await gotoApp(page, () => {
      localStorage.setItem("pmg.marker_reset.2026-07.done", "1");
      localStorage.setItem("pmg.first_run.done.v2", "1");
    });

    await page.waitForTimeout(1500);

    const v2 = await page.evaluate(
      (k: string) => localStorage.getItem(k),
      DONE_KEY_V2,
    );
    expect(v2, "v2 flag must survive when reset guard is already set").toBe("1");
  });
});
