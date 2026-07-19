import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* Task #110 — Photography Suite mobile polish smoke
 *
 * Verifies the three contract pillars added by Task #110:
 *   1. On mobile, every Photography Suite pill clears the 44px tap
 *      target floor (the prior !important cascade was forcing 36px).
 *   2. Group expand/collapse still works from the head button.
 *   3. The bottom-fixed sticky CTA appears only when (a) the suite
 *      is in the viewport AND (b) at least one pill is picked, and
 *      it delegates to the existing .pmg-photo-send build button.
 *
 * The mobile-360 project (360x800 viewport) exercises the ≤640px
 * branch of the new media queries.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

test.describe("Photography Suite mobile polish @ mobile-360", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await page.addInitScript(() => {
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    });
    await page.goto(BASE_URL + "/app", { waitUntil: "domcontentloaded" });
    /* Wait for the polish module to register its test surface. */
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __pmgSuiteMobilePolish?: unknown })
          .__pmgSuiteMobilePolish,
      undefined,
      { timeout: 10_000 },
    );
    /* Enter image mode by clicking the chassis-v3 Photography tab
       (Task #140 removed window.setMode), then expand the
       "Advanced tuning" accordion the suite now lives inside. */
    const photoTab = page.locator('.pmgv3-tab[data-module="photography"]');
    await photoTab.waitFor({ state: "visible", timeout: 10_000 });
    await photoTab.click();
    await expect(page.locator(".pmgv3-body")).toHaveAttribute(
      "data-active-panel",
      "photography",
      { timeout: 5_000 },
    );
    const advHeader = page.locator(
      "#pmg-vs-image-adv-tuning .pmg-vs-adv-tuning-header",
    );
    await advHeader.waitFor({ state: "visible", timeout: 10_000 });
    await advHeader.click();
    await page.waitForSelector("#pmg-photo-suite .pmg-photo-pill", {
      state: "attached",
      timeout: 10_000,
    });
  });

  /* Some default builds start with groups collapsed. Use the
     existing group-head toggle (Task #38 / pmg-ux.js) to open the
     first group so pills are laid out and hit-testable. */
  async function ensureFirstGroupOpen(page: import("@playwright/test").Page) {
    const head = page
      .locator("#pmg-photo-suite .pmg-photo-group-head")
      .first();
    await head.scrollIntoViewIfNeeded();
    const isCollapsed = await head.evaluate((el) =>
      el.parentElement?.classList.contains("is-collapsed"),
    );
    if (isCollapsed) {
      await head.click();
      await page.waitForTimeout(300);
    }
    await page.waitForFunction(
      () => {
        const grp = document.querySelector<HTMLElement>(
          "#pmg-photo-suite .pmg-photo-group",
        );
        if (!grp) return false;
        const pill = grp.querySelector<HTMLElement>(".pmg-photo-pill");
        return !!pill && pill.offsetParent !== null;
      },
      undefined,
      { timeout: 5_000 },
    );
  }

  test("every photo pill meets the 44px mobile tap target floor", async ({
    page,
  }) => {
    await ensureFirstGroupOpen(page);
    const tooSmall = await page.evaluate(() => {
      const pills = Array.from(
        document.querySelectorAll<HTMLElement>(
          "#pmg-photo-suite .pmg-photo-pill",
        ),
      ).filter((p) => p.offsetParent !== null);
      const offenders: { value: string | null; height: number }[] = [];
      for (const p of pills) {
        const r = p.getBoundingClientRect();
        if (r.height < 44) {
          offenders.push({
            value: p.getAttribute("data-value"),
            height: Math.round(r.height * 100) / 100,
          });
        }
      }
      return { count: pills.length, offenders };
    });
    expect(tooSmall.count).toBeGreaterThan(0);
    expect(tooSmall.offenders).toEqual([]);
  });

  test("group head toggles expand/collapse when clicked", async ({ page }) => {
    const head = page
      .locator("#pmg-photo-suite .pmg-photo-group-head")
      .first();
    await head.scrollIntoViewIfNeeded();
    /* Read the initial collapsed state so the test is robust to
       whatever the suite chooses as its default open state. */
    const wasCollapsed = await head.evaluate((el) =>
      el.parentElement?.classList.contains("is-collapsed"),
    );
    await head.click();
    await page.waitForTimeout(300);
    const afterFirst = await head.evaluate((el) =>
      el.parentElement?.classList.contains("is-collapsed"),
    );
    expect(afterFirst).toBe(!wasCollapsed);
    await head.click();
    await page.waitForTimeout(300);
    const afterSecond = await head.evaluate((el) =>
      el.parentElement?.classList.contains("is-collapsed"),
    );
    expect(afterSecond).toBe(wasCollapsed);
  });

  test("sticky CTA is hidden until a pill is picked while suite is in view", async ({
    page,
  }) => {
    /* CTA element is mounted once the polish module boots, but is
       not .is-visible until both conditions are true. */
    await expect(page.locator("#pmg-photo-suite-sticky-cta")).toHaveCount(1);
    await ensureFirstGroupOpen(page);
    /* No picks yet → CTA must be invisible. */
    let visible = await page.evaluate(() =>
      (
        window as unknown as { __pmgSuiteMobilePolish: { ctaVisible: () => boolean } }
      ).__pmgSuiteMobilePolish.ctaVisible(),
    );
    expect(visible).toBe(false);
    /* Pick the first visible pill. */
    const firstPill = page
      .locator("#pmg-photo-suite .pmg-photo-pill:visible")
      .first();
    await firstPill.click();
    await page.waitForTimeout(150);
    visible = await page.evaluate(() =>
      (
        window as unknown as { __pmgSuiteMobilePolish: { ctaVisible: () => boolean } }
      ).__pmgSuiteMobilePolish.ctaVisible(),
    );
    expect(visible).toBe(true);
    /* CTA must itself meet the 44px tap target. */
    const ctaHeight = await page
      .locator("#pmg-photo-suite-sticky-cta")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(ctaHeight).toBeGreaterThanOrEqual(44);
  });

  test("sticky CTA click delegates to .pmg-photo-send", async ({ page }) => {
    /* Pick a pill so both gating conditions pass. */
    await ensureFirstGroupOpen(page);
    await page
      .locator("#pmg-photo-suite .pmg-photo-pill:visible")
      .first()
      .click();
    await page.waitForTimeout(150);
    /* Instrument .pmg-photo-send so we can confirm the click was
       delegated rather than re-implemented. */
    await page.evaluate(() => {
      const send = document.querySelector<HTMLButtonElement>(
        "#pmg-photo-suite .pmg-photo-send",
      );
      if (!send) return;
      (
        window as unknown as { __sendClicks: number }
      ).__sendClicks = 0;
      send.addEventListener(
        "click",
        () => {
          (
            window as unknown as { __sendClicks: number }
          ).__sendClicks += 1;
        },
        true,
      );
    });
    await page.locator("#pmg-photo-suite-sticky-cta").click();
    await page.waitForTimeout(150);
    const clicks = await page.evaluate(
      () => (window as unknown as { __sendClicks: number }).__sendClicks,
    );
    expect(clicks).toBe(1);
  });
});
