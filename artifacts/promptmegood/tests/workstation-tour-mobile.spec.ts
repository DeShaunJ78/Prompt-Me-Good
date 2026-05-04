import { test, expect, Page } from "@playwright/test";

type PmgWindow = Window & { pmgStartWorkstationTour?: () => void };

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const MOBILE_W = 400;
const MOBILE_H = 720;
const HIGHLIGHT_PAD = 6;

async function gotoApp(page: Page) {
  await page.setViewportSize({ width: MOBILE_W, height: MOBILE_H });
  await page.addInitScript(() => {
    localStorage.setItem("promptmegood:tour:v1:done", "1");
    sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    localStorage.removeItem("pmg.workstationTourSeen");
  });
  await page.goto(BASE_URL + "/");
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
  await page.waitForTimeout(600);
}

async function isOverlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const ov = document.getElementById("pmg-ws-tour-overlay");
    return ov?.classList.contains("is-open") ?? false;
  });
}

type BoundsResult = {
  visible: boolean;
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

async function getTooltipBounds(page: Page): Promise<BoundsResult> {
  return page.evaluate(() => {
    const el = document.getElementById("pmg-ws-tooltip");
    if (!el) return { visible: false, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const r = el.getBoundingClientRect();
    return {
      visible: r.width > 0 && r.height > 0,
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
}

async function getHighlightBounds(page: Page): Promise<BoundsResult> {
  return page.evaluate(() => {
    const el = document.getElementById("pmg-ws-highlight");
    if (!el) return { visible: false, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const r = el.getBoundingClientRect();
    return {
      visible: r.width > 0 && r.height > 0,
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  });
}

async function getStepInfo(page: Page) {
  return page.evaluate(() => {
    const label = document.getElementById("pmg-ws-step-label");
    const title = document.getElementById("pmg-ws-title");
    const text = document.getElementById("pmg-ws-text");
    const next = document.getElementById("pmg-ws-next");
    return {
      label: label?.textContent ?? "",
      title: title?.textContent ?? "",
      text: text?.textContent ?? "",
      nextText: next?.textContent ?? "",
    };
  });
}

async function clickNextAndWait(page: Page) {
  await page.evaluate(() => {
    const btn = document.getElementById("pmg-ws-next");
    if (btn) btn.click();
  });
  await page.waitForTimeout(900);
}

async function navigateToEnd(page: Page): Promise<string[]> {
  const titles: string[] = [];
  const maxSteps = 10;
  for (let i = 0; i < maxSteps; i++) {
    if (!(await isOverlayOpen(page))) break;
    const info = await getStepInfo(page);
    titles.push(info.title);
    if (info.nextText === "Done") break;
    await clickNextAndWait(page);
  }
  return titles;
}

test.describe("Workstation tour compact overlay @ mobile-400x720", () => {
  test("tour overlay opens and shows first step", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const overlay = page.locator("#pmg-ws-tour-overlay");
    await expect(overlay).toHaveClass(/is-open/);
    await expect(overlay).toHaveAttribute("aria-hidden", "false");

    const info = await getStepInfo(page);
    expect(info.title).toBe("Your Workstation");
    expect(info.label).toMatch(/Stop 1 of/);
    expect(info.nextText).toBe("Next");
  });

  test("tooltip fits within mobile viewport width on every step", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const maxSteps = 10;
    let stepsChecked = 0;

    for (let i = 0; i < maxSteps; i++) {
      if (!(await isOverlayOpen(page))) break;

      const bounds = await getTooltipBounds(page);
      expect(bounds.visible).toBe(true);
      expect(bounds.left).toBeGreaterThanOrEqual(-1);
      expect(bounds.right).toBeLessThanOrEqual(MOBILE_W + 1);
      expect(bounds.width).toBeLessThanOrEqual(MOBILE_W);
      stepsChecked++;

      const info = await getStepInfo(page);
      if (info.nextText === "Done") break;
      await clickNextAndWait(page);
    }

    expect(stepsChecked).toBeGreaterThanOrEqual(3);
  });

  test("highlight box does not overflow right edge on any step", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const maxSteps = 10;

    for (let i = 0; i < maxSteps; i++) {
      if (!(await isOverlayOpen(page))) break;

      const hl = await getHighlightBounds(page);
      if (hl.visible) {
        expect(hl.right).toBeLessThanOrEqual(MOBILE_W + HIGHLIGHT_PAD + 1);
      }

      const info = await getStepInfo(page);
      if (info.nextText === "Done") break;
      await clickNextAndWait(page);
    }
  });

  test("tour steps are navigable with Next button on mobile", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const titles = await navigateToEnd(page);

    expect(titles.length).toBeGreaterThanOrEqual(3);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);

    const info = await getStepInfo(page);
    expect(info.nextText).toBe("Done");
  });

  test("Done button closes the overlay", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    await navigateToEnd(page);

    await page.evaluate(() => {
      const btn = document.getElementById("pmg-ws-next");
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    expect(await isOverlayOpen(page)).toBe(false);
  });

  test("Skip Tour closes the overlay", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    expect(await isOverlayOpen(page)).toBe(true);

    await page.evaluate(() => {
      const btn = document.getElementById("pmg-ws-skip");
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);

    expect(await isOverlayOpen(page)).toBe(false);
  });

  test("Escape key closes the overlay", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    expect(await isOverlayOpen(page)).toBe(false);
  });

  test("invite banner fits within mobile viewport when shown", async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_W, height: MOBILE_H });
    await page.addInitScript(() => {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      localStorage.removeItem("pmg.workstationTourSeen");
    });
    await page.goto(BASE_URL + "/");
    await page.waitForLoadState("domcontentloaded");
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {}
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const existing = document.getElementById("pmg-ws-tour-invite");
      if (existing) return;
      const el = document.createElement("div");
      el.id = "pmg-ws-tour-invite";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-label", "Workstation tour invite");
      el.innerHTML =
        '<p class="ws-tour-title">Want To See The Full Workstation?</p>' +
        '<p class="ws-tour-sub">You just ran your first prompt.</p>' +
        '<div class="ws-tour-actions">' +
        '<button class="btn btn-primary" type="button">Show Me</button>' +
        '<button class="ws-tour-dismiss" type="button">Not Now</button>' +
        "</div>";
      document.body.appendChild(el);
    });

    const invite = page.locator("#pmg-ws-tour-invite");
    await expect(invite).toBeVisible({ timeout: 3000 });

    const bounds = await page.evaluate(() => {
      const el = document.getElementById("pmg-ws-tour-invite")!;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(MOBILE_W + 1);
    expect(bounds.width).toBeGreaterThan(0);
  });

  test("no horizontal overflow while tour is open", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const overflow = await page.evaluate(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(overflow.docScrollWidth).toBeLessThanOrEqual(MOBILE_W + 1);
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(MOBILE_W + 1);
  });

  test("mobile CSS rules are applied (compact tooltip)", async ({ page }) => {
    await gotoApp(page);
    await launchTour(page);

    const styles = await page.evaluate(() => {
      const tooltip = document.getElementById("pmg-ws-tooltip");
      if (!tooltip) return null;
      const cs = getComputedStyle(tooltip);
      return {
        maxWidth: cs.maxWidth,
      };
    });

    expect(styles).not.toBeNull();
    if (styles!.maxWidth.includes("calc")) {
      expect(styles!.maxWidth).toContain("100vw");
    }
  });
});
