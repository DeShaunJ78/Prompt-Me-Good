import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* Task #132 — Visual regression snapshots for the workstation tour
 * tooltip + highlight on mobile.
 *
 * What this catches that the numeric bounds tests miss:
 * - Misaligned arrow / tail rendering
 * - Clipped or overlapping text inside the tooltip card
 * - Backdrop transparency or blur regressions
 * - Highlight cutout misalignment relative to the target element
 *
 * Strategy: take element-scoped screenshots of #pmg-ws-tooltip and
 * #pmg-ws-tour-overlay at the first two stops of the workstation
 * tour. Element-scoped shots are far more stable than full-page shots
 * because they ignore unrelated UI churn (and the overlay element
 * already covers the full viewport for the backdrop-only assertion).
 *
 * Running locally: pnpm --filter @workspace/promptmegood exec playwright
 *   test tests/tour-tooltip-visual.spec.ts --update-snapshots
 *
 * Snapshot tolerances are deliberately mid-range
 * (maxDiffPixelRatio: 0.02) so subpixel font-rendering differences
 * across runs/machines don't flake, but real layout drift still trips
 * the assertion.
 */

type PmgWindow = Window & { pmgStartWorkstationTour?: () => void };

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const MOBILE_W = 400;
const MOBILE_H = 720;

const SNAPSHOT_OPTS = {
  maxDiffPixelRatio: 0.02,
  animations: "disabled" as const,
  caret: "hide" as const,
};

async function gotoApp(page: Page) {
  await page.setViewportSize({ width: MOBILE_W, height: MOBILE_H });
  await installApiMocks(page);
  await page.addInitScript(() => {
    localStorage.setItem("promptmegood:tour:v1:done", "1");
    sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    localStorage.removeItem("pmg.workstationTourSeen");
  });
  // chassis-v3's universal-hide rule (pmg-chassis-v3.css L51) hides
  // #pmg-ws-tour-overlay because the tour overlay is appended to body
  // without `data-pmg-overlay-root`. We opt out of chassis-v3 with the
  // documented `?chassis=off` escape hatch (pmg-chassis-v3.js L13–17)
  // so the tour DOM remains visible. The tour mount + step logic is
  // identical regardless of chassis mode, so the visual baseline is
  // a faithful regression target.
  await page.goto(BASE_URL + "/app?chassis=off");
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {}
  await page.waitForTimeout(400);
}

async function launchTour(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as PmgWindow;
    if (typeof w.pmgStartWorkstationTour === "function") {
      w.pmgStartWorkstationTour();
    }
  });
  await page.waitForSelector("#pmg-ws-tour-overlay.is-open", { timeout: 5000 });
  // Wait for the open transition + position calc to settle.
  await page.waitForTimeout(800);
}

async function clickNext(page: Page) {
  await page.evaluate(() => {
    const btn = document.getElementById("pmg-ws-next");
    if (btn) btn.click();
  });
  // Allow re-position + transition to settle on the next step.
  await page.waitForTimeout(900);
}

test.describe("Workstation tour visual regression @ mobile-400x720", () => {
  test("tooltip — Stop 1 (Your Workstation)", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    // Sanity: confirm we're on stop 1 so the snapshot baseline is
    // meaningful (avoids accidentally re-baselining a different step
    // if step ordering ever changes).
    const label = await page
      .locator("#pmg-ws-step-label")
      .textContent();
    expect(label ?? "").toMatch(/Stop 1 of/);

    const tooltip = page.locator("#pmg-ws-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveScreenshot(
      "tour-tooltip-step-1.png",
      SNAPSHOT_OPTS,
    );
  });

  test("overlay (highlight + backdrop + tooltip) — Stop 1", async ({
    page,
  }) => {
    await gotoApp(page);
    await launchTour(page);

    const overlay = page.locator("#pmg-ws-tour-overlay");
    await expect(overlay).toHaveClass(/is-open/);
    await expect(overlay).toHaveScreenshot(
      "tour-overlay-step-1.png",
      SNAPSHOT_OPTS,
    );
  });

  test("tooltip — Stop 2", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);
    await clickNext(page);

    const label = await page
      .locator("#pmg-ws-step-label")
      .textContent();
    expect(label ?? "").toMatch(/Stop 2 of/);

    const tooltip = page.locator("#pmg-ws-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveScreenshot(
      "tour-tooltip-step-2.png",
      SNAPSHOT_OPTS,
    );
  });

  test("overlay (highlight + backdrop + tooltip) — Stop 2", async ({
    page,
  }) => {
    await gotoApp(page);
    await launchTour(page);
    await clickNext(page);

    const overlay = page.locator("#pmg-ws-tour-overlay");
    await expect(overlay).toHaveClass(/is-open/);
    await expect(overlay).toHaveScreenshot(
      "tour-overlay-step-2.png",
      SNAPSHOT_OPTS,
    );
  });
});
