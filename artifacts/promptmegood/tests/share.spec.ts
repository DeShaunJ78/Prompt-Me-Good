import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type ShareApi = {
  open: () => void;
  close: () => void;
  capture: () => {
    v: 2;
    m: "text" | "image";
    g: string;
    p: string;
    pl: Array<{ k: string; g?: string; v?: string; i?: string }>;
    s: Record<string, string | number>;
  };
  buildLink: () => string;
  apply: () => boolean;
  copyLink: () => void;
  exportImage: () => void;
  _decode: (b64u: string) => unknown;
};

type Win = Window & {
  __pmgShare?: ShareApi;
  __pmgShareLastLink?: string;
  __pmgShareLastCardSize?: { w: number; h: number };
  __pmgText?: { setPromptText: (s: string) => void };
  setMode?: (m: string) => void;
};

async function gotoApp(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as Win).__pmgShare,
    undefined,
    { timeout: 10_000 },
  );
  /* Skip any inactivity assist if it surfaces. */
  const skip = page.locator("#tour-skip");
  try {
    if (await skip.isVisible({ timeout: 500 })) await skip.click({ timeout: 500 });
  } catch {
    /* nothing to dismiss */
  }
}

test.describe("Unified Share button @ mobile-360", () => {
  test("public API surface is exposed", async ({ page }) => {
    await gotoApp(page);
    const surface = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgShare!;
      return {
        hasOpen: typeof api.open === "function",
        hasClose: typeof api.close === "function",
        hasCapture: typeof api.capture === "function",
        hasBuild: typeof api.buildLink === "function",
        hasApply: typeof api.apply === "function",
        hasCopy: typeof api.copyLink === "function",
        hasExport: typeof api.exportImage === "function",
      };
    });
    expect(surface).toEqual({
      hasOpen: true,
      hasClose: true,
      hasCapture: true,
      hasBuild: true,
      hasApply: true,
      hasCopy: true,
      hasExport: true,
    });
  });

  test("captureShareState reflects goal + builder fields", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "Help me write a great cover letter";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const tone = document.getElementById("tone") as HTMLSelectElement | null;
      if (tone && tone.options.length > 1) {
        tone.value = tone.options[1].value;
        tone.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const state = await page.evaluate(() =>
      (window as unknown as Win).__pmgShare!.capture(),
    );
    expect(state.v).toBe(2);
    expect(["text", "image"]).toContain(state.m);
    expect(state.g).toBe("Help me write a great cover letter");
    expect(typeof state.s).toBe("object");
  });

  test("buildLink encodes state as #pmgshare= and round-trips through _decode", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "Generate a unicorn 🦄 in space";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const result = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgShare!;
      const link = api.buildLink();
      const m = link.match(/#pmgshare=(.+)$/);
      const decoded = m ? api._decode(m[1]) : null;
      return { link, decoded };
    });
    expect(result.link).toContain("#pmgshare=");
    expect(result.decoded).toMatchObject({
      v: 2,
      g: "Generate a unicorn 🦄 in space",
    });
  });

  test("opening the sheet shows both share options and Escape closes it", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as Win).__pmgShare!.open());
    await expect(page.locator("#pmg-share-sheet")).toBeVisible();
    await expect(page.locator("#pmg-share-sheet-link")).toBeVisible();
    await expect(page.locator("#pmg-share-sheet-image")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#pmg-share-sheet-backdrop")).not.toHaveClass(/is-open/);
  });

  test("Copy link option closes the sheet and exposes the last link", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "Plan a 3-day trip to Tokyo";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
      (window as unknown as Win).__pmgShare!.open();
    });
    await expect(page.locator("#pmg-share-sheet")).toBeVisible();
    await page.locator("#pmg-share-sheet-link").click();
    await expect(page.locator("#pmg-share-sheet-backdrop")).not.toHaveClass(/is-open/);
    const link = await page.evaluate(
      () => (window as unknown as Win).__pmgShareLastLink ?? null,
    );
    expect(link).toBeTruthy();
    expect(link).toContain("#pmgshare=");
  });

  test("loading the page with a #pmgshare hash restores goal + builder fields", async ({ page }) => {
    /* Build a synthetic hash by visiting once, capturing a state, then
       returning to a fresh page with that hash applied. */
    await gotoApp(page);
    const link = await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "Restore me on reload";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const tone = document.getElementById("tone") as HTMLSelectElement | null;
      if (tone && tone.options.length > 1) {
        tone.value = tone.options[1].value;
        tone.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return (window as unknown as Win).__pmgShare!.buildLink();
    });
    const hashIndex = link.indexOf("#pmgshare=");
    expect(hashIndex).toBeGreaterThan(-1);
    const hash = link.slice(hashIndex);

    /* Navigate to a clean page first so localStorage is the only carry-over. */
    await page.goto(BASE_URL + "/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
    await page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
    /* Wait for the share module to be ready on the fresh page. */
    await page.waitForFunction(
      () => !!(window as unknown as Win).__pmgShare,
      undefined,
      { timeout: 10_000 },
    );
    /* Apply the hash explicitly (covers the case where the hash was set
       AFTER the script's first applyShareHash() call). */
    await page.evaluate(() => (window as unknown as Win).__pmgShare!.apply());
    /* Goal restoration is synchronous; prompt restoration is deferred. */
    await page.waitForFunction(
      () => {
        const g = document.getElementById("goal") as HTMLTextAreaElement | null;
        return !!g && g.value === "Restore me on reload";
      },
      undefined,
      { timeout: 5_000 },
    );
    /* Hash is stripped after a successful restore. */
    const finalHash = await page.evaluate(() => window.location.hash);
    expect(finalHash).toBe("");
  });

  test("rewired #share-btn opens the unified sheet (no legacy direct copy)", async ({ page }) => {
    await gotoApp(page);
    /* Force the result-row visible so #share-btn is interactable, and reveal
       the button by removing the gating class. */
    await page.evaluate(() => {
      document.body.classList.add("pmg-has-result");
      const btn = document.getElementById("share-btn") as HTMLButtonElement | null;
      if (btn) btn.hidden = false;
    });
    const btn = page.locator("#share-btn");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    await btn.click();
    await expect(page.locator("#pmg-share-sheet")).toBeVisible();
  });

  test("restoring a payload authoritatively clears stale builder fields not in the snapshot", async ({ page }) => {
    /* Capture a minimal payload that ONLY contains a goal — no other builder
       fields. Restoring it should explicitly clear any pre-existing values
       the recipient had set (otherwise leftover state leaks into the
       'shared' setup, which violates the link-as-snapshot contract). */
    await gotoApp(page);
    const payloadHash = await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "Snapshot goal only";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return (window as unknown as Win).__pmgShare!.buildLink();
    });
    const hash = payloadHash.slice(payloadHash.indexOf("#pmgshare="));

    /* Now contaminate the recipient with extra builder state, then apply. */
    await page.goto(BASE_URL + "/?t=" + Date.now(), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !!(window as unknown as Win).__pmgShare,
      undefined,
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      const details = document.getElementById("details") as HTMLTextAreaElement | null;
      if (details) {
        details.value = "stale recipient details that should be wiped";
        details.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.evaluate((h) => { window.location.hash = h; }, hash);
    await page.evaluate(() => (window as unknown as Win).__pmgShare!.apply());
    await page.waitForFunction(
      () => {
        const g = document.getElementById("goal") as HTMLTextAreaElement | null;
        return !!g && g.value === "Snapshot goal only";
      },
      undefined,
      { timeout: 5_000 },
    );
    /* The stale `details` value MUST be cleared by the authoritative restore. */
    const detailsAfter = await page.evaluate(() => {
      const d = document.getElementById("details") as HTMLTextAreaElement | null;
      return d ? d.value : null;
    });
    expect(detailsAfter).toBe("");
  });

  test("share sheet traps Tab focus inside the dialog", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as Win).__pmgShare!.open());
    await expect(page.locator("#pmg-share-sheet")).toBeVisible();
    /* The first focusable on open is the Copy link option. Pressing
       Shift+Tab from there should wrap to the LAST visible focusable
       inside the sheet (Export image card), not escape to the page. */
    await page.evaluate(() => {
      const first = document.getElementById("pmg-share-sheet-link");
      if (first) (first as HTMLButtonElement).focus();
    });
    await page.keyboard.press("Shift+Tab");
    const trapped = await page.evaluate(() => {
      const sheet = document.getElementById("pmg-share-sheet");
      const active = document.activeElement;
      return !!sheet && !!active && sheet.contains(active);
    });
    expect(trapped).toBe(true);
  });

  test("Export as image card draws a canvas and triggers a PNG download", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) {
        goal.value = "A cinematic portrait of a fox in golden hour";
        goal.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.evaluate(() => (window as unknown as Win).__pmgShare!.exportImage());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^promptmegood-(text|image)-\d{4}-\d{2}-\d{2}\.png$/);
    const size = await page.evaluate(
      () => (window as unknown as Win).__pmgShareLastCardSize ?? null,
    );
    expect(size).toEqual({ w: 1200, h: 1500 });
  });
});
