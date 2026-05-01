import { test } from "@playwright/test";
const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
test("debug8", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("promptmegood:tour:v1:done", "1"); } catch {} });
  page.on("console", msg => console.log("BROWSER:", msg.text()));
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!(window as any).__pmgSuggestions, undefined, { timeout: 10_000 });
  await page.waitForSelector(".pmg-avoid-toggle", { state: "attached" });
  await page.evaluate(() => {
    /* Wrap setAvoiding to trace it */
    const api = (window as any).__pmgSuggestions;
    const orig = api.setAvoiding;
    api.setAvoiding = (g: string, on: boolean) => {
      console.log("setAvoiding called:", g, on);
      return orig(g, on);
    };
  });
  await page.evaluate(() => {
    /* Click the toggle */
    const t = document.querySelector('#pmg-photo-suite .pmg-avoid-toggle[data-group="style"]') as HTMLElement;
    console.log("about to click, isConnected:", t.isConnected);
    t.click();
    console.log("after click, mode:", (window as any).__pmgSuggestions.isAvoiding('style'));
  });
});
