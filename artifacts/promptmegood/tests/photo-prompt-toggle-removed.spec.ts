import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* Task #112 — Photo Prompt Mode toggle removed.
 * Task #140 — Legacy image-mode nudge + window.setMode also removed; the
 * canonical "go to image mode" path is now the chassis-v3 Photography tab.
 *
 * Confirms:
 *   1. The "Photo Prompt Mode" toggle (#photoMode) is gone from the
 *      "Customize Output (Optional)" advanced-options panel.
 *   2. The "Customize Output" sub-summary copy no longer mentions
 *      "Photo Prompt".
 *   3. The legacy image-mode nudge (#pmg-image-mode-nudge) and the
 *      legacy mode-switch DOM (#modeSwitch / #imageModeBtn /
 *      #image-generate-btn / .image-mode-hint) are gone.
 *   4. Clicking the chassis-v3 Photography tab puts the body in
 *      image-mode and activates the photo panel.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

test.describe("Photo Prompt Mode removal @ mobile-360", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
    await page.addInitScript(() => {
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    });
    await page.goto(BASE_URL + "/app", { waitUntil: "domcontentloaded" });
  });

  test("the Photo Prompt Mode toggle is gone and copy is updated", async ({
    page,
  }) => {
    await expect(page.locator("#photoMode")).toHaveCount(0);
    await expect(page.locator(".advanced-options-summary .adv-sub")).toHaveText(
      /Growth Mode, Human Voice, Clarity Boost$/,
    );
    await expect(
      page.locator(".advanced-options-summary .adv-sub"),
    ).not.toContainText(/Photo Prompt/i);
  });

  test("legacy image-mode nudge and mode-switch DOM are gone", async ({
    page,
  }) => {
    // Task #140 deleted the nudge + the entire mode-switch surface.
    await expect(page.locator("#pmg-image-mode-nudge")).toHaveCount(0);
    await expect(page.locator("#pmg-image-mode-nudge-btn")).toHaveCount(0);
    await expect(page.locator("#modeSwitch")).toHaveCount(0);
    await expect(page.locator("#imageModeBtn")).toHaveCount(0);
    await expect(page.locator("#writeModeBtn")).toHaveCount(0);
    await expect(page.locator("#image-generate-btn")).toHaveCount(0);
    await expect(page.locator(".image-mode-hint")).toHaveCount(0);

    // window.setMode + window.runImageGeneration are gone too.
    const globals = await page.evaluate(() => ({
      setMode: typeof (window as unknown as Record<string, unknown>).setMode,
      runImageGeneration: typeof (window as unknown as Record<string, unknown>)
        .runImageGeneration,
    }));
    expect(globals.setMode).toBe("undefined");
    expect(globals.runImageGeneration).toBe("undefined");
  });

  test("Photography tab is the canonical route into image mode", async ({
    page,
  }) => {
    // Wait for the chassis-v3 tabs to mount.
    const photoTab = page.locator('.pmgv3-tab[data-module="photography"]');
    await expect(photoTab).toBeVisible({ timeout: 10_000 });

    await photoTab.click();

    // Chassis-v3 sets data-active-panel on the inner .pmgv3-body and
    // toggles body.image-mode so the relocated Photo Suite renders.
    await expect(page.locator(".pmgv3-body")).toHaveAttribute(
      "data-active-panel",
      "photography",
      { timeout: 5_000 },
    );
    await expect(page.locator("body")).toHaveClass(/image-mode/);
  });
});
