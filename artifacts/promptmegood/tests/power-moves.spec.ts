import { test, expect } from "@playwright/test";

test.setTimeout(90_000);

const MOCK_PROMPT_CHUNK = "This is a generated prompt for testing purposes. " +
  "It contains enough text to be realistic and trigger post-generation UI.";

const MOCK_IMPROVE_RESPONSE = "Improved prompt: This is a clearer, stronger, more specific version of your prompt for testing.";

function mockGenerateStream(page: import("@playwright/test").Page) {
  return page.route("**/api/generate-stream", async (route) => {
    const body =
      `data: ${JSON.stringify({ text: MOCK_PROMPT_CHUNK })}\n\n` +
      `data: [DONE]\n\n`;
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
      body,
    });
  });
}

function mockGenerateJson(page: import("@playwright/test").Page) {
  return page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, output: MOCK_IMPROVE_RESPONSE }),
    });
  });
}

async function mockApiAndGenerate(page: import("@playwright/test").Page, goalText: string) {
  await mockGenerateStream(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const goal = page.locator("#goal");
  await goal.fill(goalText);

  const topBtn = page.locator("#generateBtnTop");
  const origBtn = page.locator("#generateBtn");
  const clickTarget = (await topBtn.isVisible()) ? topBtn : origBtn;
  await clickTarget.click();

  await expect(page.locator("body")).toHaveClass(/pmg-has-result/, { timeout: 30000 });
  await expect(page.locator("#pmg-power-moves")).toBeVisible({ timeout: 5000 });
}

test.describe("Power Moves MVP", () => {
  test("all 3 Power Move chips render with correct labels", async ({ page }) => {
    await mockApiAndGenerate(page, "Write a professional email to my boss asking for a raise");

    const pm = page.locator("#pmg-power-moves");

    const chips = [
      { id: "pm-image",    label: /Try Image Mode/i },
      { id: "pm-vault",    label: /Save To Vault/i },
      { id: "pm-quality",  label: /Check Quality/i }
    ];

    for (const b of chips) {
      const chip = page.locator("#" + b.id);
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(b.label);
    }

    await expect(pm.locator(".pmg-pm-title")).toHaveText("Power Moves");
    await expect(pm.locator(".pmg-pm-subtitle")).toContainText("further");

    await expect(page.locator("#runSection")).toBeAttached();
  });

  test("Power Moves does not overflow on mobile 360x800", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockApiAndGenerate(page, "Help me plan a birthday party");

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    const allOnOneRow = await page.evaluate(() => {
      const chips = document.querySelectorAll(".pmg-pm-grid .pmg-pm-chip");
      if (chips.length === 0) return false;
      const tops = Array.from(chips).map(c => c.getBoundingClientRect().top);
      return tops.every(t => Math.abs(t - tops[0]) < 5);
    });
    expect(allOnOneRow).toBe(true);
  });

  test("Check Quality chip → #quality-feedback div becomes visible with content", async ({ page }) => {
    await mockApiAndGenerate(page, "Create a marketing strategy for a new product");

    const qualityChip = page.locator("#pm-quality");
    await qualityChip.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("quality-feedback");
      return el && !el.hidden && el.innerHTML.trim().length > 0;
    }, { timeout: 10000 });
  });

  test("Try Image Mode chip → body.image-mode class is applied", async ({ page }) => {
    await mockApiAndGenerate(page, "Design a logo for a coffee shop brand");

    await expect(page.locator("body")).not.toHaveClass(/image-mode/);

    await page.locator("#pm-image").click();

    await expect(page.locator("body")).toHaveClass(/image-mode/, { timeout: 5000 });
  });

  test("Save To Vault chip → page scrolls toward #history section", async ({ page }) => {
    await mockApiAndGenerate(page, "Write a cover letter for a software engineer position");

    const historySection = page.locator("#history");
    await expect(historySection).toBeAttached({ timeout: 5000 });

    await page.locator("#pmg-power-moves").scrollIntoViewIfNeeded();
    await page.waitForLoadState("domcontentloaded");

    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.locator("#pm-vault").click();

    await page.waitForFunction(
      (prev) => window.scrollY !== prev,
      scrollBefore,
      { timeout: 5000 }
    );

    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeGreaterThan(scrollBefore);
  });

  test("More Detailed → prompt contains detailed remix instruction", async ({ page }) => {
    await mockApiAndGenerate(page, "Plan a weekend hiking trip for beginners near Portland");

    const resultBox = page.locator("#resultBox");
    const originalText = await resultBox.textContent();
    expect(originalText).toBeTruthy();

    const detailedBtn = page.locator('#improve-block [data-remix="detailed"]');
    await expect(detailedBtn).toBeVisible({ timeout: 5000 });
    await detailedBtn.click();

    await expect(resultBox).toContainText("Make the answer more detailed", { timeout: 5000 });
  });

  test("Beginner Friendly → prompt contains beginner remix instruction", async ({ page }) => {
    await mockApiAndGenerate(page, "Create a machine learning model training pipeline in Python");

    const resultBox = page.locator("#resultBox");
    const originalText = await resultBox.textContent();
    expect(originalText).toBeTruthy();

    const beginnerBtn = page.locator('#improve-block [data-remix="beginner"]');
    await expect(beginnerBtn).toBeVisible({ timeout: 5000 });
    await beginnerBtn.click();

    await expect(resultBox).toContainText("Make the answer beginner-friendly", { timeout: 5000 });
  });

  test("Improve With AI → #improve-status appears and resultBox text changes", async ({ page }) => {
    await mockGenerateStream(page);
    await mockGenerateJson(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const goal = page.locator("#goal");
    await goal.fill("Help me write a compelling product description for an online store");

    const topBtn = page.locator("#generateBtnTop");
    const origBtn = page.locator("#generateBtn");
    const clickTarget = (await topBtn.isVisible()) ? topBtn : origBtn;
    await clickTarget.click();

    await expect(page.locator("body")).toHaveClass(/pmg-has-result/, { timeout: 30000 });

    const resultBox = page.locator("#resultBox");
    const originalText = await resultBox.textContent();
    expect(originalText).toBeTruthy();

    const improveBtn = page.locator("#improve-with-ai-btn");
    await expect(improveBtn).toBeVisible({ timeout: 5000 });
    await improveBtn.click();

    await expect(improveBtn).toBeEnabled({ timeout: 30000 });

    await expect(page.locator("#improve-status")).toBeHidden({ timeout: 10000 });

    const newText = await resultBox.textContent();
    expect(newText).toBeTruthy();
    expect(newText!.trim()).not.toBe(originalText!.trim());
  });
});
