import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* Task #157 — the /app top bar collapses several icons (Expert, Templates,
 * API Keys) into the ⋮ More menu at phone widths (≤480px). Task #156 added
 * Templates + API Keys entries to that menu; they proxy a synthetic click to
 * the (CSS-hidden) underlying elements injected asynchronously by
 * pmg-template-browser.js (#pmg-template-browser-btn) and pmg-api-keys.js
 * (#pmg-ak-entry-link). This spec is the regression guard that both menu
 * items actually reach their surfaces — if either injector is renamed,
 * disabled, or slow to mount, the proxied click would silently no-op and
 * this test fails.
 *
 * Runs under the mobile-360 project (viewport 360×800) where the ⋮ button
 * is the only way to reach these two surfaces.
 */

async function openApp(page: import("@playwright/test").Page) {
  await installApiMocks(page);
  await page.goto("/app", { waitUntil: "networkidle", timeout: 30000 });
  // Chassis v3 topbar mounts, then the two injectors poll for
  // #pmgv3-vault/#pmgv3-expert before inserting their (hidden) anchors.
  await page.waitForSelector("#pmgv3-more", { state: "attached", timeout: 15000 });
  await page.waitForSelector("#pmg-template-browser-btn", { state: "attached", timeout: 15000 });
  await page.waitForSelector("#pmg-ak-entry-link", { state: "attached", timeout: 15000 });
}

async function openMoreMenu(page: import("@playwright/test").Page) {
  // The ⋮ button toggles, so make sure the menu is freshly open.
  const menu = page.locator("#pmgv3-more-menu");
  if (await menu.count()) {
    await page.locator("#pmgv3-more").click();
    await expect(menu).toHaveCount(0);
  }
  await page.locator("#pmgv3-more").click();
  await expect(menu).toBeVisible();
}

test("More menu Templates item opens the template browser", async ({ page }) => {
  await openApp(page);
  await openMoreMenu(page);

  await page.locator('#pmgv3-more-menu [data-pmg-more-target="pmg-template-browser-btn"]').click();

  // Clicking a menu item closes the menu, then proxies the click to the
  // hidden #pmg-template-browser-btn which calls window.pmgTemplateBrowser.open().
  await expect(page.locator("#pmgv3-more-menu")).toHaveCount(0);
  await expect(page.locator("#pmg-tb-backdrop")).toHaveAttribute("data-open", "true");
  await expect(page.locator("#pmg-tb-modal")).toBeVisible();

  const isOpen = await page.evaluate(
    () => !!(window as unknown as { pmgTemplateBrowser?: { isOpen?: boolean } }).pmgTemplateBrowser,
  );
  expect(isOpen).toBe(true);
});

test("More menu API Keys item reaches the API keys surface", async ({ page }) => {
  await openApp(page);
  await openMoreMenu(page);

  // #pmg-ak-entry-link is an <a target="_blank" href="/api.html">, so the
  // proxied .click() opens a new tab. Assert that popup navigates to api.html.
  const popupPromise = page.context().waitForEvent("page", { timeout: 10000 });
  await page.locator('#pmgv3-more-menu [data-pmg-more-target="pmg-ak-entry-link"]').click();

  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded").catch(() => {});
  expect(popup.url()).toContain("/api.html");
  await popup.close();
});
