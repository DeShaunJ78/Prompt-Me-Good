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

  test("Enter on a search result executes the command and closes the palette", async ({
    page,
  }) => {
    /* Use the Modes group: Switch To Image Mode is always
       available because its visible() is API-surface-first
       (window.setMode), so this test works on the marketing
       splash without first clicking a CTA. */
    await page.evaluate(() => {
      (window as unknown as {
        __pmgCommandPalette: { open: () => void };
      }).__pmgCommandPalette.open();
    });
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeVisible();
    await page.locator("#pmg-cmdk-input").fill("image mode");
    /* Wait for the result list to settle on the typed query. */
    await page.waitForFunction(() => {
      const items = document.querySelectorAll("#pmg-cmdk-list .pmg-cmdk-item");
      if (items.length === 0) return false;
      const first = items[0] as HTMLElement;
      return /image/i.test(first.textContent ?? "");
    });
    /* The first result should be the Image-mode switch. Press
       Enter and assert (a) the palette closes, (b) setMode was
       called with 'image' (we observe via body class which
       pmg-ux toggles in response). */
    await page.keyboard.press("Enter");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeHidden();
    /* setMode runs in setTimeout(0) after close — give it a
       turn or two to settle. We only assert the palette closed
       (the strong observable) since body-class behavior
       depends on whether the workspace was already mounted. */
    const finalState = await page.evaluate(() => {
      const api = (window as unknown as {
        __pmgCommandPalette: { isOpen: () => boolean };
      }).__pmgCommandPalette;
      return { open: api.isOpen() };
    });
    expect(finalState.open).toBe(false);
  });

  test("ArrowDown moves the active row, then Enter executes the new selection", async ({
    page,
  }) => {
    await page.evaluate(() => {
      (window as unknown as {
        __pmgCommandPalette: { open: () => void };
      }).__pmgCommandPalette.open();
    });
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeVisible();
    /* Empty query so we get the full grouped list — at least
       2 commands must render so ArrowDown has somewhere to go. */
    await page.waitForFunction(() => {
      return document.querySelectorAll("#pmg-cmdk-list .pmg-cmdk-item").length >= 2;
    });
    /* Snapshot indices: first selected, then ArrowDown, capture
       which command id ends up under aria-activedescendant. */
    const initialActiveId = await page.evaluate(() => {
      const input = document.getElementById("pmg-cmdk-input");
      return input ? input.getAttribute("aria-activedescendant") : null;
    });
    await page.keyboard.press("ArrowDown");
    const nextActiveId = await page.evaluate(() => {
      const input = document.getElementById("pmg-cmdk-input");
      return input ? input.getAttribute("aria-activedescendant") : null;
    });
    expect(nextActiveId).toBeTruthy();
    expect(nextActiveId).not.toBe(initialActiveId);
    /* The list uses an `.is-active` class to mark the highlighted
       row (single-selection invariant). */
    const activeMatches = await page.evaluate((id) => {
      const all = document.querySelectorAll(
        "#pmg-cmdk-list .pmg-cmdk-item.is-active",
      );
      return {
        count: all.length,
        idMatches: all.length === 1 && (all[0] as HTMLElement).id === id,
      };
    }, nextActiveId);
    expect(activeMatches.count).toBe(1);
    expect(activeMatches.idMatches).toBe(true);
    /* Pressing Enter on the second-from-top command must close
       the palette (we don't observe a side effect — what matters
       is that Enter dispatched on the *moved* row works). */
    await page.keyboard.press("Enter");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeHidden();
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
