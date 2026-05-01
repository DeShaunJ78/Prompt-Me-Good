import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

test.describe("Command palette (⌘K) smoke @ mobile-360", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !!(window as unknown as { __pmgCommandPalette?: unknown }).__pmgCommandPalette,
      undefined,
      { timeout: 10_000 },
    );
  });

  test("global ⌘K hotkey opens the palette overlay", async ({ page }) => {
    const isMac = await page.evaluate(() =>
      /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    );
    const modifier = isMac ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+KeyK`);
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeVisible();
    await expect(page.locator("#pmg-cmdk-input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeHidden();
  });

  test("public test surface exposes a sane command catalog", async ({ page }) => {
    const summary = await page.evaluate(() => {
      const api = (window as unknown as {
        __pmgCommandPalette: {
          _getCommands: () => Array<{ id: string; group: string; title: string }>;
          _query: (q: string) => Array<{ id: string; title: string }>;
        };
      }).__pmgCommandPalette;
      const all = api._getCommands();
      const groups = Array.from(new Set(all.map((c) => c.group)));
      const imageHits = api._query("image").map((c) => c.id);
      const fixHits = api._query("fix").map((c) => c.id);
      const writeHits = api._query("write").map((c) => c.id);
      return { total: all.length, groups, imageHits, fixHits, writeHits };
    });
    expect(summary.total).toBeGreaterThanOrEqual(2);
    expect(summary.groups).toEqual(expect.arrayContaining(["Modes"]));
    expect(summary.writeHits).toEqual(expect.arrayContaining(["mode-write"]));
    expect(summary.imageHits.length).toBeGreaterThan(0);
    expect(summary.fixHits.length).toBeGreaterThan(0);
  });

  test("_query never lists a command whose target isn't rendered", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const api = (window as unknown as {
        __pmgCommandPalette: {
          _getCommands: () => Array<{ id: string }>;
        };
      }).__pmgCommandPalette;
      const cmds = api._getCommands();
      const offenders: string[] = [];
      const probe: Record<string, string> = {
        "action-fix": "#generateBtn",
        "action-image-generate": "#image-generate-btn",
        "action-improve": "#improve-with-ai-btn",
        "action-surprise-photo": ".pmg-photo-surprise",
        "action-surprise-text": "#random-prompt",
        "group-style": '#pmg-photo-suite .pmg-photo-group[data-group="style"]',
      };
      for (const c of cmds) {
        const sel = probe[c.id];
        if (!sel) continue;
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) {
          offenders.push(c.id + " (no node)");
          continue;
        }
        const cs = window.getComputedStyle(el);
        const hidden =
          !!el.hidden ||
          cs.display === "none" ||
          cs.visibility === "hidden" ||
          (el.getBoundingClientRect().width === 0 &&
            el.getBoundingClientRect().height === 0);
        if (hidden) offenders.push(c.id + " (hidden but listed)");
      }
      return { offenders };
    });
    expect(result.offenders).toEqual([]);
  });
});
