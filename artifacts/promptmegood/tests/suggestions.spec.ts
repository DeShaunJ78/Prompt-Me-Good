import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type SuggestionsApi = {
  version: string;
  compute: () => Array<{ value: string; group: string }>;
  getNegatives: () => Array<{ value: string; group: string }>;
  setAvoiding: (groupId: string, on: boolean) => void;
  isAvoiding: (groupId: string) => boolean;
  clearNegatives: () => void;
  refresh: () => void;
};

type Win = Window & {
  __pmgSuggestions?: SuggestionsApi;
  generateImage?: () => unknown;
  runImageGeneration?: () => unknown;
};

async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      localStorage.removeItem("pmg.photo.recentPresets");
      localStorage.removeItem("pmg.surprise.dial.v1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as Win).__pmgSuggestions,
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForSelector("#pmg-photo-suite", { timeout: 10_000 });
  await page.waitForSelector("#pmg-photo-suggest-row", {
    state: "attached",
    timeout: 10_000,
  });
  await page.waitForSelector("#pmg-photo-neg-row", {
    state: "attached",
    timeout: 10_000,
  });
  await page.waitForSelector(".pmg-avoid-toggle", {
    state: "attached",
    timeout: 10_000,
  });
}

/* The pill grid lives inside collapsible groups that may be off-
   viewport on a 360px-wide phone. Toggling the .is-active /
   .is-negative class programmatically is the same effect a real
   click has — no scroll quirks, no hit-test races. */
async function activatePill(page: Page, value: string): Promise<void> {
  const ok = await page.evaluate((v) => {
    const sel =
      `#pmg-photo-suite .pmg-photo-pill[data-value="${v.replace(/"/g, '\\"')}"]`;
    const el = document.querySelector<HTMLButtonElement>(sel);
    if (!el) return false;
    el.click();
    return true;
  }, value);
  expect(ok).toBe(true);
}

async function setAvoid(
  page: Page,
  groupId: string,
  on: boolean,
): Promise<void> {
  await page.evaluate(
    ({ g, v }) => {
      (window as unknown as Win).__pmgSuggestions!.setAvoiding(g, v);
    },
    { g: groupId, v: on },
  );
}

test.describe("Smart pill suggestions + negative pills @ mobile-360", () => {
  test("public API surface is exposed", async ({ page }) => {
    await gotoApp(page);
    const surface = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      return {
        version: api.version,
        hasCompute: typeof api.compute === "function",
        hasGetNegatives: typeof api.getNegatives === "function",
        hasSetAvoiding: typeof api.setAvoiding === "function",
        hasClear: typeof api.clearNegatives === "function",
      };
    });
    expect(surface).toEqual({
      version: "task58-5",
      hasCompute: true,
      hasGetNegatives: true,
      hasSetAvoiding: true,
      hasClear: true,
    });
  });

  test("suggestion row is hidden when no pills are picked", async ({
    page,
  }) => {
    await gotoApp(page);
    const visible = await page.evaluate(() => {
      const row = document.getElementById("pmg-photo-suggest-row");
      return !!row && !row.hasAttribute("hidden");
    });
    expect(visible).toBe(false);
  });

  test("picking a pill surfaces 1-5 suggestions", async ({ page }) => {
    await gotoApp(page);
    await activatePill(page, "Cinematic");
    await page.waitForFunction(() => {
      const row = document.getElementById("pmg-photo-suggest-row");
      return !!row && !row.hasAttribute("hidden");
    });
    const result = await page.evaluate(() => {
      const row = document.getElementById("pmg-photo-suggest-row")!;
      const pills = row.querySelectorAll(".pmg-suggest-pill");
      const values = Array.from(pills).map((p) =>
        (p as HTMLElement).getAttribute("data-suggest-value"),
      );
      return { count: pills.length, values, hidden: row.hasAttribute("hidden") };
    });
    expect(result.hidden).toBe(false);
    expect(result.count).toBeGreaterThan(0);
    expect(result.count).toBeLessThanOrEqual(5);
    /* Cinematic's hand-picked suggestion list includes Dramatic
       Shadows, Cinematic Low-Key, Teal & Orange. At least one must
       come back. */
    expect(
      result.values.some((v) =>
        ["Dramatic Shadows", "Cinematic Low-Key", "Teal & Orange"].includes(
          v ?? "",
        ),
      ),
    ).toBe(true);
  });

  test("clicking a suggestion activates the underlying pill and updates the row", async ({
    page,
  }) => {
    await gotoApp(page);
    await activatePill(page, "Cinematic");
    await page.waitForSelector(
      "#pmg-photo-suggest-row .pmg-suggest-pill",
      { timeout: 5000 },
    );
    /* Pull the first suggestion's value and click it. */
    const first = await page.evaluate(() => {
      const el = document.querySelector(
        "#pmg-photo-suggest-row .pmg-suggest-pill",
      ) as HTMLElement | null;
      return el ? el.getAttribute("data-suggest-value") : null;
    });
    expect(first).toBeTruthy();
    await page.evaluate((v) => {
      const el = document.querySelector(
        `#pmg-photo-suggest-row .pmg-suggest-pill[data-suggest-value="${v}"]`,
      ) as HTMLElement | null;
      if (el) el.click();
    }, first);
    /* The clicked suggestion should now be active and removed from
       the row. */
    const after = await page.evaluate((v) => {
      const pill = document.querySelector(
        `#pmg-photo-suite .pmg-photo-pill[data-value="${v}"]`,
      );
      const stillSuggested = !!document.querySelector(
        `#pmg-photo-suggest-row .pmg-suggest-pill[data-suggest-value="${v}"]`,
      );
      return {
        pillIsActive: pill?.classList.contains("is-active") ?? false,
        stillSuggested,
      };
    }, first);
    expect(after.pillIsActive).toBe(true);
    expect(after.stillSuggested).toBe(false);
  });

  test("suggestions can be dismissed and reappear on the next pick change", async ({
    page,
  }) => {
    await gotoApp(page);
    await activatePill(page, "Portrait");
    await page.waitForSelector(
      "#pmg-photo-suggest-row .pmg-suggest-dismiss",
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#pmg-photo-suggest-row .pmg-suggest-dismiss",
      ) as HTMLElement | null;
      if (btn) btn.click();
    });
    const hiddenAfterDismiss = await page.evaluate(() => {
      const row = document.getElementById("pmg-photo-suggest-row")!;
      return row.hasAttribute("hidden");
    });
    expect(hiddenAfterDismiss).toBe(true);
    /* Picking another pill should re-arm the row. */
    await activatePill(page, "Landscape");
    await page.waitForFunction(() => {
      const row = document.getElementById("pmg-photo-suggest-row");
      return !!row && !row.hasAttribute("hidden");
    });
    const afterPick = await page.evaluate(() => {
      const row = document.getElementById("pmg-photo-suggest-row")!;
      return {
        hidden: row.hasAttribute("hidden"),
        count: row.querySelectorAll(".pmg-suggest-pill").length,
      };
    });
    expect(afterPick.hidden).toBe(false);
    expect(afterPick.count).toBeGreaterThan(0);
  });

  test("avoid toggle exists for every group head", async ({ page }) => {
    await gotoApp(page);
    const counts = await page.evaluate(() => {
      const groups = document.querySelectorAll(
        "#pmg-photo-suite .pmg-photo-group",
      );
      const toggles = document.querySelectorAll(
        "#pmg-photo-suite .pmg-avoid-toggle",
      );
      return { groups: groups.length, toggles: toggles.length };
    });
    expect(counts.groups).toBeGreaterThan(0);
    expect(counts.toggles).toBe(counts.groups);
  });

  test("clicking avoid toggle enters avoid mode for that group only", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const t = document.querySelector(
        '#pmg-photo-suite .pmg-avoid-toggle[data-group="style"]',
      ) as HTMLElement | null;
      if (t) t.click();
    });
    const state = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      const grp = document.querySelector(
        '#pmg-photo-suite .pmg-photo-group[data-group="style"]',
      );
      return {
        styleAvoiding: api.isAvoiding("style"),
        cameraAvoiding: api.isAvoiding("camera"),
        groupHasClass: grp?.classList.contains("is-avoiding") ?? false,
      };
    });
    expect(state.styleAvoiding).toBe(true);
    expect(state.cameraAvoiding).toBe(false);
    expect(state.groupHasClass).toBe(true);
  });

  test("clicking a pill while avoid is on adds it as a negative", async ({
    page,
  }) => {
    await gotoApp(page);
    await setAvoid(page, "style", true);
    await activatePill(page, "Surreal");
    const result = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      const pill = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Surreal"]',
      );
      return {
        negatives: api.getNegatives().map((n) => n.value),
        isNegative: pill?.classList.contains("is-negative") ?? false,
        isActive: pill?.classList.contains("is-active") ?? false,
      };
    });
    expect(result.negatives).toContain("Surreal");
    expect(result.isNegative).toBe(true);
    expect(result.isActive).toBe(false);
  });

  test("a pill cannot be both active and negative at once", async ({
    page,
  }) => {
    await gotoApp(page);
    /* First make it positive, then turn on avoid and click again. */
    await activatePill(page, "Vintage");
    await setAvoid(page, "style", true);
    await activatePill(page, "Vintage");
    const result = await page.evaluate(() => {
      const pill = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Vintage"]',
      );
      return {
        active: pill?.classList.contains("is-active") ?? false,
        negative: pill?.classList.contains("is-negative") ?? false,
      };
    });
    expect(result.negative).toBe(true);
    expect(result.active).toBe(false);
  });

  test("clicking a negative pill in normal mode just clears the negative", async ({
    page,
  }) => {
    await gotoApp(page);
    await setAvoid(page, "lighting", true);
    await activatePill(page, "Neon Glow");
    await setAvoid(page, "lighting", false);
    /* Now click it normally — should clear, NOT promote to active. */
    await activatePill(page, "Neon Glow");
    const result = await page.evaluate(() => {
      const pill = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Neon Glow"]',
      );
      return {
        active: pill?.classList.contains("is-active") ?? false,
        negative: pill?.classList.contains("is-negative") ?? false,
      };
    });
    expect(result.negative).toBe(false);
    expect(result.active).toBe(false);
  });

  test("'Avoid:' chip line shows the comma-joined negatives", async ({
    page,
  }) => {
    await gotoApp(page);
    await setAvoid(page, "style", true);
    await activatePill(page, "Surreal");
    await activatePill(page, "Vintage");
    await page.waitForFunction(() => {
      const row = document.getElementById("pmg-photo-neg-row");
      return !!row && !row.hasAttribute("hidden");
    });
    const text = await page.evaluate(() => {
      const row = document.getElementById("pmg-photo-neg-row")!;
      return row.textContent ?? "";
    });
    expect(text).toContain("Avoid:");
    expect(text).toContain("Surreal");
    expect(text).toContain("Vintage");
  });

  test("'Clear Avoids' button removes all negatives", async ({ page }) => {
    await gotoApp(page);
    await setAvoid(page, "style", true);
    await activatePill(page, "Surreal");
    await activatePill(page, "Polaroid");
    await page.waitForFunction(() => {
      const row = document.getElementById("pmg-photo-neg-row");
      return !!row && !row.hasAttribute("hidden");
    });
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#pmg-photo-neg-row .pmg-neg-clear",
      ) as HTMLElement | null;
      if (btn) btn.click();
    });
    const after = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      return {
        negatives: api.getNegatives(),
        rowHidden: document
          .getElementById("pmg-photo-neg-row")!
          .hasAttribute("hidden"),
      };
    });
    expect(after.negatives).toHaveLength(0);
    expect(after.rowHidden).toBe(true);
  });

  test("generateImage wrapper appends 'Avoid: ...' to goal value", async ({
    page,
  }) => {
    await gotoApp(page);
    await setAvoid(page, "lighting", true);
    await activatePill(page, "Harsh Noon");
    await activatePill(page, "Neon Glow");
    /* Stub the network call so generateImage doesn't actually fetch. */
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement;
      goal.value = "A serene mountain landscape";
      /* Replace generateImage's fetch with a no-op so the stub
         test doesn't blow up on the /api/image POST. */
      const realFetch = window.fetch;
      window.fetch = ((input: RequestInfo | URL) => {
        if (typeof input === "string" && input.indexOf("/api/image") !== -1) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: "data:," }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return realFetch(input);
      }) as typeof fetch;
    });
    await page.evaluate(async () => {
      const w = window as unknown as Win;
      if (typeof w.generateImage === "function") {
        try {
          await w.generateImage();
        } catch {
          /* ignore */
        }
      }
    });
    const goalAfter = await page.evaluate(() => {
      return (document.getElementById("goal") as HTMLTextAreaElement).value;
    });
    expect(goalAfter).toMatch(/Avoid:\s/);
    expect(goalAfter).toContain("Harsh Noon");
    expect(goalAfter).toContain("Neon Glow");
  });

  test("generateImage wrapper is a no-op when no negatives exist", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement;
      goal.value = "A serene mountain landscape";
      const realFetch = window.fetch;
      window.fetch = ((input: RequestInfo | URL) => {
        if (typeof input === "string" && input.indexOf("/api/image") !== -1) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: "data:," }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return realFetch(input);
      }) as typeof fetch;
    });
    await page.evaluate(async () => {
      const w = window as unknown as Win;
      if (typeof w.generateImage === "function") {
        try {
          await w.generateImage();
        } catch {
          /* ignore */
        }
      }
    });
    const goalAfter = await page.evaluate(() => {
      return (document.getElementById("goal") as HTMLTextAreaElement).value;
    });
    expect(goalAfter).toBe("A serene mountain landscape");
  });

  test("'Clear Picks' wipes negatives too", async ({ page }) => {
    await gotoApp(page);
    await setAvoid(page, "style", true);
    await activatePill(page, "Surreal");
    /* Trigger pmg-ux's existing Clear button. */
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#pmg-photo-suite .pmg-photo-clear",
      ) as HTMLElement | null;
      if (btn) btn.click();
    });
    const negs = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      return api.getNegatives();
    });
    expect(negs).toHaveLength(0);
  });

  test("suggestions exclude pills already active or negative", async ({
    page,
  }) => {
    await gotoApp(page);
    await activatePill(page, "Cinematic");
    await activatePill(page, "Dramatic Shadows");
    await setAvoid(page, "lighting", true);
    await activatePill(page, "Cinematic Low-Key");
    const out = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      return api.compute().map((s) => s.value);
    });
    expect(out).not.toContain("Dramatic Shadows");
    expect(out).not.toContain("Cinematic Low-Key");
    expect(out).not.toContain("Cinematic");
  });

  /* Regression: the primary `#image-generate-btn` calls
     `runImageGeneration()` directly via inline onclick (see
     index.html:3363). Wrapping only `window.generateImage` would
     let users skip the "Avoid:" suffix on the main button path —
     the wrapper must also patch `runImageGeneration`. */
  test("runImageGeneration also receives the Avoid suffix", async ({
    page,
  }) => {
    await gotoApp(page);
    await setAvoid(page, "lighting", true);
    await activatePill(page, "Harsh Noon");
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLTextAreaElement;
      goal.value = "A cosy reading nook";
      const realFetch = window.fetch;
      window.fetch = ((input: RequestInfo | URL) => {
        if (typeof input === "string" && input.indexOf("/api/image") !== -1) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: "data:," }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return realFetch(input);
      }) as typeof fetch;
    });
    await page.evaluate(async () => {
      const w = window as unknown as Win;
      if (typeof w.runImageGeneration === "function") {
        try {
          await w.runImageGeneration();
        } catch {
          /* ignore */
        }
      }
    });
    const goalAfter = await page.evaluate(() => {
      return (document.getElementById("goal") as HTMLTextAreaElement).value;
    });
    expect(goalAfter).toMatch(/Avoid:\s/);
    expect(goalAfter).toContain("Harsh Noon");
  });

  /* Regression: the original wrapper guarded with
     `if (!/Avoid:/.test(goal.value)) append`, which made the
     "Avoid: …" clause sticky — once added, subsequent
     generations would never refresh it even if the user changed
     or cleared their negatives between runs. The fix strips any
     trailing Avoid clause first so each call recomputes from the
     CURRENT negative pill state. */
  test("Avoid clause refreshes between generations (no stale leak)", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Stub network so generation never actually fires. */
    await page.evaluate(() => {
      const realFetch = window.fetch;
      window.fetch = ((input: RequestInfo | URL) => {
        if (typeof input === "string" && input.indexOf("/api/image") !== -1) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: "data:," }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return realFetch(input);
      }) as typeof fetch;
    });
    /* Run 1: negatives = Harsh Noon. */
    await setAvoid(page, "lighting", true);
    await activatePill(page, "Harsh Noon");
    await page.evaluate(() => {
      (document.getElementById("goal") as HTMLTextAreaElement).value =
        "A cosy reading nook";
    });
    await page.evaluate(async () => {
      await ((window as unknown as Win).generateImage as () => Promise<void>)();
    });
    let goalAfter = await page.evaluate(
      () => (document.getElementById("goal") as HTMLTextAreaElement).value,
    );
    expect(goalAfter).toContain("Harsh Noon");
    expect(goalAfter).not.toContain("Neon Glow");
    /* Run 2: swap negatives — clear Harsh Noon, add Neon Glow. */
    await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgSuggestions!;
      api.clearNegatives();
    });
    await activatePill(page, "Neon Glow");
    await page.evaluate(async () => {
      await ((window as unknown as Win).generateImage as () => Promise<void>)();
    });
    goalAfter = await page.evaluate(
      () => (document.getElementById("goal") as HTMLTextAreaElement).value,
    );
    expect(goalAfter).toContain("Neon Glow");
    expect(goalAfter).not.toContain("Harsh Noon");
    /* The prompt itself must survive both rewrites. */
    expect(goalAfter).toContain("A cosy reading nook");
    /* Exactly one Avoid clause — never two. */
    const avoidCount = (goalAfter.match(/Avoid:/g) ?? []).length;
    expect(avoidCount).toBe(1);
    /* Run 3: clear all negatives — stale clause must be removed. */
    await page.evaluate(() => {
      (window as unknown as Win).__pmgSuggestions!.clearNegatives();
    });
    await page.evaluate(async () => {
      await ((window as unknown as Win).generateImage as () => Promise<void>)();
    });
    goalAfter = await page.evaluate(
      () => (document.getElementById("goal") as HTMLTextAreaElement).value,
    );
    expect(goalAfter).not.toContain("Avoid:");
    expect(goalAfter).toContain("A cosy reading nook");
  });

  /* Regression: programmatic .is-active adds (preset / surprise /
     combo / handoff seeding) bypass our click interceptor. The
     MutationObserver in pmg-suggestions.js must enforce the
     "active XOR negative" invariant by stripping .is-negative
     when .is-active appears on the same pill. */
  test("a pill cannot be both active AND negative", async ({ page }) => {
    await gotoApp(page);
    await setAvoid(page, "style", true);
    await activatePill(page, "Surreal");
    /* Confirm it's negative now, not active. */
    let state = await page.evaluate(() => {
      const el = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Surreal"]',
      );
      return {
        active: !!el?.classList.contains("is-active"),
        negative: !!el?.classList.contains("is-negative"),
      };
    });
    expect(state).toEqual({ active: false, negative: true });
    /* Now simulate a programmatic activation (the kind preset /
       surprise / combo apply does) by adding .is-active directly. */
    await page.evaluate(() => {
      const el = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Surreal"]',
      ) as HTMLElement | null;
      if (el) el.classList.add("is-active");
    });
    /* Allow the MutationObserver microtask to fix it. */
    await page.waitForFunction(() => {
      const el = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Surreal"]',
      );
      return (
        !!el &&
        el.classList.contains("is-active") &&
        !el.classList.contains("is-negative")
      );
    }, undefined, { timeout: 2_000 });
    state = await page.evaluate(() => {
      const el = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-value="Surreal"]',
      );
      return {
        active: !!el?.classList.contains("is-active"),
        negative: !!el?.classList.contains("is-negative"),
      };
    });
    expect(state).toEqual({ active: true, negative: false });
  });
});
