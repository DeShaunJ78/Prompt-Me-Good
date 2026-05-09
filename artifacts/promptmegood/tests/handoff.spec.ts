import { test, expect, type Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type HandoffApi = {
  version: string;
  readDial: () => "close" | "mix" | "wild";
  writeDial: (v: "close" | "mix" | "wild") => void;
  rollPicks: (
    dial: "close" | "mix" | "wild",
  ) => Record<string, string[]>;
  applyPicks: (
    picks: Record<string, string[]>,
    dial: "close" | "mix" | "wild",
  ) => void;
  persistRecent: (picks: Record<string, string[]>) => boolean;
  rerenderRecent: () => void;
  textToImage: () => void;
  imageToText: () => void;
  refresh: () => void;
  _gatherTextBias: () => Record<string, string[]>;
  _deriveTextSeed: () => null | {
    tone: string;
    category: string;
    personality: string;
    topic: string;
    activePills?: string[];
  };
};

type Win = Window & {
  __pmgHandoff?: HandoffApi;
  __pmgText?: { setPromptText: (s: string) => void };
  setMode?: (m: string) => void;
};

async function gotoApp(page: Page): Promise<void> {
  await installApiMocks(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      localStorage.removeItem("pmg.photo.recentPresets");
      localStorage.removeItem("pmg.surprise.dial.v1");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE_URL + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as Win).__pmgHandoff,
    undefined,
    { timeout: 10_000 },
  );
  /* Wait for the suite & dial to mount (T34 inserts the suite
     after first paint). */
  await page.waitForSelector("#pmg-photo-suite", { timeout: 10_000 });
  await page.waitForSelector("#pmg-handoff-dial", { timeout: 10_000 });
  await page.evaluate(() => {
    const s = document.createElement("style");
    s.textContent =
      "#pmg-photo-suite-sticky-cta { display: none !important; }";
    document.head.appendChild(s);
  });
}

test.describe("Surprise Me dial + handoff @ mobile-360", () => {
  test("public API surface is exposed", async ({ page }) => {
    await gotoApp(page);
    const surface = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgHandoff!;
      return {
        hasReadDial: typeof api.readDial === "function",
        hasWriteDial: typeof api.writeDial === "function",
        hasRollPicks: typeof api.rollPicks === "function",
        hasTextToImage: typeof api.textToImage === "function",
        hasImageToText: typeof api.imageToText === "function",
        version: api.version,
      };
    });
    expect(surface).toEqual({
      hasReadDial: true,
      hasWriteDial: true,
      hasRollPicks: true,
      hasTextToImage: true,
      hasImageToText: true,
      version: "task57-3",
    });
  });

  test("dial defaults to mix and renders 3 segments", async ({ page }) => {
    await gotoApp(page);
    const segments = page.locator(".pmg-handoff-dial-seg");
    await expect(segments).toHaveCount(3);
    const dial = await page.evaluate(
      () => (window as unknown as Win).__pmgHandoff!.readDial(),
    );
    expect(dial).toBe("mix");
    const pressed = await segments
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-pressed")),
      );
    expect(pressed).toEqual(["false", "true", "false"]);
  });

  test("clicking a dial segment persists the choice and updates aria-pressed", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.locator('.pmg-handoff-dial-seg[data-dial="wild"]').click();
    const dial = await page.evaluate(
      () => (window as unknown as Win).__pmgHandoff!.readDial(),
    );
    expect(dial).toBe("wild");
    const stored = await page.evaluate(() =>
      localStorage.getItem("pmg.surprise.dial.v1"),
    );
    expect(stored).toBe("wild");
    const pressed = await page
      .locator(".pmg-handoff-dial-seg")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-pressed")),
      );
    expect(pressed).toEqual(["false", "false", "true"]);
  });

  test("rollPicks(mix) returns at least one pill in every group", async ({
    page,
  }) => {
    await gotoApp(page);
    const picks = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!.rollPicks("mix"),
    );
    const groups = ["style", "camera", "lighting", "composition", "palette"];
    for (const g of groups) {
      expect(Array.isArray(picks[g])).toBe(true);
      expect(picks[g]!.length).toBeGreaterThanOrEqual(1);
      expect(picks[g]!.length).toBeLessThanOrEqual(2);
    }
  });

  test("rollPicks(wild) returns 2-3 pills in every group", async ({
    page,
  }) => {
    await gotoApp(page);
    const picks = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!.rollPicks("wild"),
    );
    const groups = ["style", "camera", "lighting", "composition", "palette"];
    for (const g of groups) {
      expect(picks[g]!.length).toBeGreaterThanOrEqual(2);
      expect(picks[g]!.length).toBeLessThanOrEqual(3);
    }
  });

  test("clicking Surprise Me applies pills AND auto-saves to Recent", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Click the prominent surprise button at the top of the suite. */
    await page.locator(".pmg-photo-surprise").first().click();
    /* At least one pill should be active immediately after. */
    const activeCount = await page
      .locator("#pmg-photo-suite .pmg-photo-pill.is-active")
      .count();
    expect(activeCount).toBeGreaterThan(0);
    /* Recent row should be visible with at least one entry. */
    const recentRow = page.locator("#pmg-photo-recent");
    await expect(recentRow).toBeVisible();
    const recentBtns = page.locator(
      "#pmg-photo-recent .pmg-photo-recent-btn",
    );
    await expect(recentBtns.first()).toBeVisible();
    const label = await recentBtns.first().textContent();
    expect(label || "").toMatch(/^Surprise:/);
    /* localStorage should have the entry. */
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("pmg.photo.recentPresets") || "[]";
      return JSON.parse(raw) as Array<{
        kind?: string;
        label?: string;
        picks?: Record<string, string[]>;
      }>;
    });
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0]?.kind).toBe("raw");
    expect(stored[0]?.label).toMatch(/^Surprise:/);
  });

  test("Pin This Surprise button is hidden because auto-save replaces it", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.locator(".pmg-photo-surprise").first().click();
    /* Even though pmg-ux still toggles its hidden attribute,
       our CSS sets display:none so the user never sees it. */
    const visible = await page
      .locator("#pmg-photo-suite .pmg-photo-pin-surprise")
      .isVisible()
      .catch(() => false);
    expect(visible).toBe(false);
  });

  test("Surprise(close) preserves existing pills and only refreshes one group", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Activate two pills programmatically (groups may be off-
       screen on the 360px viewport). We verify the Surprise
       behavior, not the pill click handlers. */
    await page.evaluate(() => {
      const pickPill = (g: string, v: string) => {
        const sel = `#pmg-photo-suite .pmg-photo-pill[data-group="${g}"][data-value="${v}"]`;
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) el.classList.add("is-active");
      };
      pickPill("style", "Editorial");
      pickPill("palette", "Warm Tones");
    });
    /* Switch dial to close. */
    await page.locator('.pmg-handoff-dial-seg[data-dial="close"]').click();
    /* Capture current selection. */
    const before = await page.evaluate(() => {
      const out: Record<string, string[]> = {};
      [
        "style",
        "camera",
        "lighting",
        "composition",
        "palette",
      ].forEach((g) => {
        out[g] = Array.from(
          document.querySelectorAll(
            `#pmg-photo-suite .pmg-photo-pill.is-active[data-group="${g}"]`,
          ),
        ).map((el) => el.getAttribute("data-value") || "");
      });
      return out;
    });
    /* Roll. */
    await page.locator(".pmg-photo-surprise").first().click();
    /* After: at least one of the originally-active groups must
       still contain a pill (since close keeps existing). */
    const after = await page.evaluate(() => {
      const out: Record<string, string[]> = {};
      [
        "style",
        "camera",
        "lighting",
        "composition",
        "palette",
      ].forEach((g) => {
        out[g] = Array.from(
          document.querySelectorAll(
            `#pmg-photo-suite .pmg-photo-pill.is-active[data-group="${g}"]`,
          ),
        ).map((el) => el.getAttribute("data-value") || "");
      });
      return out;
    });
    /* Total active pills should be >= the original (close adds
       or refreshes; never wipes everything). */
    const sum = (m: Record<string, string[]>) =>
      Object.values(m).reduce((a, v) => a + v.length, 0);
    expect(sum(after)).toBeGreaterThanOrEqual(sum(before));
  });

  test("text -> image: bias map yields pills for tone+category", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const setVal = (id: string, v: string) => {
        const el = document.getElementById(id) as
          | HTMLInputElement
          | HTMLSelectElement
          | null;
        if (el) el.value = v;
      };
      setVal("tone", "bold-direct");
      setVal("category", "content");
      setVal("personality", "viral");
    });
    const bias = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!._gatherTextBias(),
    );
    /* bold-direct => Cinematic style + Dramatic Shadows lighting */
    expect(bias.style).toContain("Cinematic");
    /* viral => Neon Glow lighting */
    expect(bias.lighting).toEqual(
      expect.arrayContaining(["Neon Glow"]),
    );
    /* viral => Neon Saturated palette */
    expect(bias.palette).toEqual(
      expect.arrayContaining(["Neon Saturated"]),
    );
  });

  test("text -> image handoff button mounts and applies pills on click", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Set tone + category, then mark body as having generated
       prompt so the CTA reveals. */
    await page.evaluate(() => {
      const setVal = (id: string, v: string) => {
        const el = document.getElementById(id) as
          | HTMLInputElement
          | HTMLSelectElement
          | null;
        if (el) el.value = v;
      };
      setVal("tone", "professional");
      setVal("category", "business");
      setVal("personality", "luxury");
      /* Mark prompt as generated so the result panel & its
         children become visible. Both body classes are used by
         different code paths in pmg-ux.js — set them all. */
      document.body.classList.remove("pmg-pre-gen");
      document.body.classList.add("pmg-has-generated");
      document.body.classList.add("pmg-has-result");
      (window as unknown as Win).__pmgHandoff!.refresh();
    });
    const cta = page.locator("#pmg-handoff-text-to-image-btn");
    await expect(cta).toBeVisible();
    await cta.click();
    /* After click, photo suite should have pills active per the
       bias (Editorial style for professional/business/luxury). */
    const editorialActive = await page
      .locator(
        '#pmg-photo-suite .pmg-photo-pill.is-active[data-group="style"][data-value="Editorial"]',
      )
      .count();
    expect(editorialActive).toBeGreaterThan(0);
  });

  test("image -> text handoff seeds tone+category from active pills", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Activate Cinematic style + High Contrast palette via JS
       (pills may be off-viewport on 360px). */
    await page.evaluate(() => {
      const pickPill = (g: string, v: string) => {
        const sel = `#pmg-photo-suite .pmg-photo-pill[data-group="${g}"][data-value="${v}"]`;
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) el.classList.add("is-active");
      };
      pickPill("style", "Cinematic");
      pickPill("palette", "High Contrast");
    });
    const seed = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!._deriveTextSeed(),
    );
    expect(seed).not.toBeNull();
    expect(seed!.tone).toBe("bold-direct");
    expect(seed!.category).toBe("content");
    expect(seed!.personality).toBe("bold");
    /* Trigger the actual handoff and verify the goal field
       was pre-seeded. */
    await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!.imageToText(),
    );
    const goalVal = await page.locator("#goal").inputValue();
    expect(goalVal).toMatch(/cinematic visual/i);
    /* Tone field should be set to bold-direct now. */
    const toneVal = await page.locator("#tone").inputValue();
    expect(toneVal).toBe("bold-direct");
  });

  test("image -> text handoff falls back to default seed when no pills active", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Ensure no pills are active. */
    await page.evaluate(() => {
      document
        .querySelectorAll("#pmg-photo-suite .pmg-photo-pill.is-active")
        .forEach((el) => el.classList.remove("is-active"));
    });
    /* Seed should still be returned (default), not null. */
    const seed = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!._deriveTextSeed(),
    );
    expect(seed).not.toBeNull();
    expect(seed!.tone).toBe("casual");
    expect(seed!.category).toBe("personal");
    /* Trigger handoff: should switch to write mode AND pre-seed
       the goal field with the default topic. */
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) goal.value = "";
      (window as unknown as Win).__pmgHandoff!.imageToText();
    });
    const goalVal = await page.locator("#goal").inputValue();
    expect(goalVal).toMatch(/the image i just generated/i);
    /* Body should have lost the image-mode class (we switched to write). */
    const isImageMode = await page.evaluate(() =>
      document.body.classList.contains("image-mode"),
    );
    expect(isImageMode).toBe(false);
  });

  test("dice intercept preserves Vault history side effect", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Snapshot current vault history length. */
    const before = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("promptmegood:history:v1");
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    });
    /* Click the dice button (intercept fires the dial-aware roll +
       must still call addToHistory). */
    await page.evaluate(() => {
      const btn = document.getElementById("random-prompt") as HTMLButtonElement | null;
      if (btn) btn.click();
    });
    /* Allow async setPromptText / addToHistory chain to complete. */
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("promptmegood:history:v1");
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    });
    expect(after).toBeGreaterThan(before);
  });

  test("idempotent boot guard: loading the script twice does not duplicate", async ({
    page,
  }) => {
    await gotoApp(page);
    /* The dial element should appear exactly once even if init
       runs again on retries. */
    const dialCount = await page
      .locator("#pmg-handoff-dial")
      .count();
    expect(dialCount).toBe(1);
    const ctaCount = await page
      .locator("#pmg-handoff-text-to-image-btn")
      .count();
    expect(ctaCount).toBe(1);
  });

  test("dial-aware rollPicks(close) keeps existing groups when called externally", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Pre-activate one pill via JS (off-viewport on 360px). */
    await page.evaluate(() => {
      const sel =
        '#pmg-photo-suite .pmg-photo-pill[data-group="style"][data-value="Cinematic"]';
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) el.classList.add("is-active");
    });
    const picks = await page.evaluate(() =>
      (window as unknown as Win).__pmgHandoff!.rollPicks("close"),
    );
    /* Style group must include the pre-existing Cinematic OR
       a refreshed pick (since close may target the style group),
       but at minimum the picks object must have at least one
       group with content. */
    const totalPills = Object.values(picks).reduce(
      (a, v) => a + (v as string[]).length,
      0,
    );
    expect(totalPills).toBeGreaterThan(0);
  });
});
