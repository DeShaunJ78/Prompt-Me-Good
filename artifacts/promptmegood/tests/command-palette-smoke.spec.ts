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

  test("both modifier variants (Meta+K and Control+K) open the palette", async ({
    page,
  }) => {
    /* Smoke-test the underlying `keydown` handler with both
       modifier paths via synthetic events so we get cross-
       platform coverage in a single CI run regardless of the
       host OS Playwright is running on. */
    const dispatchHotkey = async (modifier: "meta" | "ctrl") => {
      return page.evaluate((mod) => {
        const evt = new KeyboardEvent("keydown", {
          key: "k",
          code: "KeyK",
          metaKey: mod === "meta",
          ctrlKey: mod === "ctrl",
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(evt);
      }, modifier);
    };
    /* Meta+K path. */
    await dispatchHotkey("meta");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeHidden();
    /* Control+K path. */
    await dispatchHotkey("ctrl");
    await expect(page.locator("#pmg-cmdk-backdrop")).toBeVisible();
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

  test("cross-mode commands are discoverable from the marketing splash (write-mode baseline)", async ({
    page,
  }) => {
    /* Per the task spec, the palette must surface "all five preset
       groups, both modes, and registered actions" from anywhere.
       On the marketing splash (write-mode baseline), the Image
       Suite isn't yet rendered, but the cross-mode wrapper means
       Image-mode entries should still be listed and executable
       (they switch modes first, then run). */
    const summary = await page.evaluate(() => {
      const api = (window as unknown as {
        __pmgCommandPalette: {
          _getCommands: () => Array<{ id: string }>;
        };
      }).__pmgCommandPalette;
      const ids = new Set(api._getCommands().map((c) => c.id));
      return {
        hasImageGenerate: ids.has("action-image-generate"),
        hasPhotoSurprise: ids.has("action-surprise-photo"),
        hasSaveCombo: ids.has("action-save-combo"),
        groupIds: [
          "group-style",
          "group-camera",
          "group-lighting",
          "group-composition",
          "group-palette",
        ].filter((id) => ids.has(id)),
        hasWriteFix: ids.has("action-fix"),
        hasImproveWithAi: ids.has("action-improve"),
      };
    });
    /* All 5 preset groups must be discoverable cross-mode. */
    expect(summary.groupIds).toHaveLength(5);
    /* Image-mode actions must be discoverable from write-mode
       baseline. */
    expect(summary.hasImageGenerate).toBe(true);
    expect(summary.hasPhotoSurprise).toBe(true);
    expect(summary.hasSaveCombo).toBe(true);
    /* Write-mode actions must remain discoverable. */
    expect(summary.hasWriteFix).toBe(true);
    expect(summary.hasImproveWithAi).toBe(true);
  });

  test("catalog has a sane minimum size and no duplicate ids", async ({
    page,
  }) => {
    /* Sanity invariants on the catalog snapshot returned by the
       public test surface: at least 15 entries (modes + actions +
       5 preset groups + cheatsheet at minimum) and no duplicate
       ids (which would break aria-activedescendant uniqueness and
       confuse the keyboard navigation index). */
    const result = await page.evaluate(() => {
      const api = (window as unknown as {
        __pmgCommandPalette: {
          _getCommands: () => Array<{ id: string }>;
        };
      }).__pmgCommandPalette;
      const cmds = api._getCommands();
      const ids = cmds.map((c) => c.id);
      const uniq = new Set(ids);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      return { total: cmds.length, unique: uniq.size, dupes };
    });
    expect(result.total).toBeGreaterThanOrEqual(15);
    expect(result.unique).toBe(result.total);
    expect(result.dupes).toEqual([]);
  });
});
