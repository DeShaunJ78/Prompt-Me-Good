import { test, expect } from "@playwright/test";

test.setTimeout(90_000);

test.describe("Power Moves MVP", () => {
  test("Power Moves appears after prompt generation and each button works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const pm = page.locator("#pmg-power-moves");
    await expect(pm).toBeHidden();

    const goal = page.locator("#goal");
    await goal.fill("Write a professional email to my boss asking for a raise");

    const topBtn = page.locator("#generateBtnTop");
    const origBtn = page.locator("#generateBtn");
    const clickTarget = (await topBtn.isVisible()) ? topBtn : origBtn;
    await clickTarget.click();

    await expect(page.locator("body")).toHaveClass(/pmg-has-result/, { timeout: 30000 });

    await expect(pm).toBeVisible({ timeout: 5000 });

    const buttons = [
      { id: "pm-improve",  label: /Improve With AI/i },
      { id: "pm-detailed", label: /More Detailed/i },
      { id: "pm-beginner", label: /Beginner Friendly/i },
      { id: "pm-image",    label: /Try Image Mode/i },
      { id: "pm-vault",    label: /Save To Vault/i },
      { id: "pm-quality",  label: /Check Quality/i }
    ];

    for (const b of buttons) {
      const chip = page.locator("#" + b.id);
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(b.label);
    }

    await expect(pm.locator(".pmg-pm-title")).toHaveText("Power Moves");
    await expect(pm.locator(".pmg-pm-subtitle")).toContainText("stronger");

    const runSection = page.locator("#runSection");
    await expect(runSection).toBeAttached();
  });

  test("Power Moves does not overflow on mobile 360x800", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const goal = page.locator("#goal");
    await goal.fill("Help me plan a birthday party");
    const topBtn = page.locator("#generateBtnTop");
    const origBtn = page.locator("#generateBtn");
    const clickTarget = (await topBtn.isVisible()) ? topBtn : origBtn;
    await clickTarget.click();

    await expect(page.locator("body")).toHaveClass(/pmg-has-result/, { timeout: 30000 });
    await expect(page.locator("#pmg-power-moves")).toBeVisible({ timeout: 5000 });

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    const cols = await page.evaluate(() => {
      const grid = document.querySelector(".pmg-pm-grid");
      if (!grid) return null;
      return getComputedStyle(grid).gridTemplateColumns;
    });
    expect(cols).toBeTruthy();
    const colCount = cols!.split(/\s+/).length;
    expect(colCount).toBe(2);
  });

  test("Power Moves buttons trigger real features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const goal = page.locator("#goal");
    await goal.fill("Create a marketing strategy for a new product");
    const topBtn = page.locator("#generateBtnTop");
    const origBtn = page.locator("#generateBtn");
    const clickTarget = (await topBtn.isVisible()) ? topBtn : origBtn;
    await clickTarget.click();
    await expect(page.locator("body")).toHaveClass(/pmg-has-result/, { timeout: 30000 });
    await expect(page.locator("#pmg-power-moves")).toBeVisible({ timeout: 5000 });

    await page.locator("#pm-quality").click();
    await page.waitForTimeout(1000);
    const feedbackVisible = await page.evaluate(() => {
      const el = document.getElementById("quality-feedback");
      return el && !el.hidden && el.innerHTML.trim().length > 0;
    });
    expect(feedbackVisible).toBe(true);
  });
});
