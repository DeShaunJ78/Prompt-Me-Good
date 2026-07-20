import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* pmg-return-visit.js (rv-1) — return-visit purchase prompt.
 *
 * Contract under test:
 *   - Never shows on the very first visit.
 *   - Shows from the 2nd distinct visit (one count per browser session).
 *   - Dismissal is permanent (localStorage flag).
 *   - Suppressed for paid users (window.__pmgServerProfile.plan).
 *   - Kill-switches: ?noreturnvisit URL param, pmg_return_visit_disable='1'.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const BANNER = "#pmg-return-visit-banner";
const COUNT_KEY = "pmg.return_visit.count.v2";
const DISMISS_KEY = "pmg.return_visit.dismissed.v2";

async function gotoApp(
  page: Page,
  opts: {
    visitCount?: number;
    dismissed?: boolean;
    killLocal?: boolean;
    query?: string;
    paidPlan?: string;
  } = {},
) {
  await installApiMocks(page);
  if (opts.paidPlan) {
    const plan = opts.paidPlan;
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plan, trial: null, caps: {}, used: {} }),
      }),
    );
  }
  await page.addInitScript(
    (args: {
      count: number | null;
      dismissed: boolean;
      killLocal: boolean;
      countKey: string;
      dismissKey: string;
      plan: string | null;
    }) => {
      if (args.count !== null) localStorage.setItem(args.countKey, String(args.count));
      if (args.dismissed) localStorage.setItem(args.dismissKey, "1");
      if (args.killLocal) localStorage.setItem("pmg_return_visit_disable", "1");
      /* Simulate the profile landing (pmg-ux normally sets this after
         /api/me/profile) so the banner's paid-suppression is exercised
         without a real auth session. */
      if (args.plan) {
        (window as unknown as { __pmgServerProfile?: { plan: string } }).__pmgServerProfile = {
          plan: args.plan,
        };
      }
    },
    {
      count: opts.visitCount ?? null,
      dismissed: opts.dismissed ?? false,
      killLocal: opts.killLocal ?? false,
      countKey: COUNT_KEY,
      dismissKey: DISMISS_KEY,
      plan: opts.paidPlan ?? null,
    },
  );
  await page.goto(BASE_URL + "/app" + (opts.query ?? ""));
  await page.waitForLoadState("domcontentloaded");
}

/* The script waits up to 5s for __pmgServerProfile before showing; when the
   profile is pre-seeded (or absent + timeout) the banner decision settles
   within ~6s. */
const SETTLE_MS = 6500;

test.describe("pmg-return-visit (rv-1)", () => {
  test("first visit: banner never shows", async ({ page }) => {
    await gotoApp(page); // no prior count → this session becomes visit #1
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(BANNER)).toHaveCount(0);
    const count = await page.evaluate(
      (k) => localStorage.getItem(k),
      COUNT_KEY,
    );
    expect(count).toBe("1");
  });

  test("second visit: banner shows with pricing link and is visible", async ({ page }) => {
    await gotoApp(page, { visitCount: 1, paidPlan: "free" }); // this session → visit #2
    await page.waitForSelector(BANNER, { timeout: SETTLE_MS + 4000 });
    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible();
    const href = await banner.locator("a.pmg-rv-cta").getAttribute("href");
    expect(href).toContain("/pricing.html");
  });

  test("dismiss is permanent across reloads", async ({ page }) => {
    await gotoApp(page, { visitCount: 1, paidPlan: "free" });
    await page.waitForSelector(BANNER, { timeout: SETTLE_MS + 4000 });
    await page.locator(`${BANNER} button.pmg-rv-close`).click();
    await expect(page.locator(BANNER)).toHaveCount(0);
    const flag = await page.evaluate((k) => localStorage.getItem(k), DISMISS_KEY);
    expect(flag).toBe("1");

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("paid user (founding) never sees the banner", async ({ page }) => {
    await gotoApp(page, { visitCount: 5, paidPlan: "founding" });
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("URL kill-switch ?noreturnvisit suppresses banner", async ({ page }) => {
    await gotoApp(page, { visitCount: 5, query: "?noreturnvisit", paidPlan: "free" });
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("localStorage kill-switch suppresses banner", async ({ page }) => {
    await gotoApp(page, { visitCount: 5, killLocal: true, paidPlan: "free" });
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("marker reset migration runs once and bumps first-run key", async ({ page }) => {
    await installApiMocks(page);
    await page.addInitScript(() => {
      localStorage.setItem("pmg.first_run.done.v1", "1");
      localStorage.setItem("pmg.workstationTourSeen", "1");
      localStorage.setItem("pmg.quickWinSeen", "1");
    });
    await page.goto(BASE_URL + "/app");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
      resetDone: localStorage.getItem("pmg.marker_reset.2026-07.done"),
      oldFirstRun: localStorage.getItem("pmg.first_run.done.v1"),
      tourSeen: localStorage.getItem("pmg.workstationTourSeen"),
      quickWin: localStorage.getItem("pmg.quickWinSeen"),
    }));
    expect(state.resetDone).toBe("1");
    expect(state.oldFirstRun).toBeNull();
    expect(state.tourSeen).toBeNull();
    expect(state.quickWin).toBeNull();
  });
});
