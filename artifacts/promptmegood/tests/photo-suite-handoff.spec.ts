import { test, expect } from "@playwright/test";

/* Task #111 — Image-mode → Photography Suite handoff smoke
 *
 * Verifies the handoff card contract:
 *   1. The card mounts under .image-result-actions in image mode.
 *   2. With no image rendered, the card is in the disabled state
 *      and clicking the CTA does NOT route or hydrate.
 *   3. With a rendered image, the card is enabled, the CTA meets
 *      the 44px tap target floor, clicking it routes to the Suite,
 *      expands the first group, mounts the hydration reference
 *      chip, and exposes the hydration payload.
 *   4. The inline entry-point cue is present near #imageModeBtn.
 *
 * Uses the mobile-360 project (360x800) to also catch the
 * mobile-first full-width layout on ≤640px.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type SuiteHandoff = {
  cardState: () => {
    mounted: boolean;
    ctaMounted: boolean;
    disabled: boolean;
    cueMounted: boolean;
    refMounted: boolean;
  };
  hydration: () => { prompt: string; imageUrl: string; at: number } | null;
};

test.describe("Photography Suite handoff @ mobile-360", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        !!(window as unknown as { __pmgSuiteHandoff?: unknown })
          .__pmgSuiteHandoff,
      undefined,
      { timeout: 10_000 },
    );
    /* Enter image mode so the suite + result section are exposed. */
    await page.evaluate(() => {
      const w = window as unknown as { setMode?: (m: string) => void };
      if (typeof w.setMode === "function") {
        w.setMode("image");
      } else {
        document.body.classList.add("image-mode");
      }
      /* Reveal the result section so the card has a host. */
      const sec = document.getElementById("imageResultSection");
      if (sec) sec.removeAttribute("hidden");
    });
    await page.waitForSelector("#pmg-suite-handoff-card", {
      state: "attached",
      timeout: 5_000,
    });
  });

  test("card mounts and entry-point cue is present", async ({ page }) => {
    const state = await page.evaluate(
      () =>
        (window as unknown as { __pmgSuiteHandoff: SuiteHandoff })
          .__pmgSuiteHandoff.cardState(),
    );
    expect(state.mounted).toBe(true);
    expect(state.ctaMounted).toBe(true);
    expect(state.cueMounted).toBe(true);
  });

  test("card is disabled when no image has been generated", async ({
    page,
  }) => {
    /* Make sure no <img> exists in the result wrap. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (!wrap) return;
      wrap.querySelectorAll("img").forEach((n) => n.remove());
    });
    /* Refresh so the card observes the empty wrap. */
    await page.evaluate(() => {
      (
        window as unknown as { __pmgSuiteHandoff: { refresh: () => void } }
      ).__pmgSuiteHandoff.refresh();
    });
    const ariaDisabled = await page
      .locator("#pmg-suite-handoff-cta")
      .getAttribute("aria-disabled");
    expect(ariaDisabled).toBe("true");
    /* Click the disabled CTA — must NOT hydrate. Force the click
       past Playwright's auto-disabled-button guard since the
       button is intentionally aria-disabled (still focusable). */
    await page.locator("#pmg-suite-handoff-cta").click({ force: true });
    await page.waitForTimeout(150);
    const hydration = await page.evaluate(
      () =>
        (window as unknown as { __pmgSuiteHandoff: SuiteHandoff })
          .__pmgSuiteHandoff.hydration(),
    );
    expect(hydration).toBeNull();
  });

  test("with image + prompt, CTA routes, hydrates, and meets 44px target", async ({
    page,
  }) => {
    /* Stage a fake generated image and a prompt in #goal. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        /* 1x1 transparent PNG. */
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        img.alt = "test";
        wrap.appendChild(img);
      }
      const goal = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goal) goal.value = "A neon-lit Tokyo street at night, 35mm film look";
      (
        window as unknown as { __pmgSuiteHandoff: { refresh: () => void } }
      ).__pmgSuiteHandoff.refresh();
    });

    const ariaDisabled = await page
      .locator("#pmg-suite-handoff-cta")
      .getAttribute("aria-disabled");
    expect(ariaDisabled).toBe("false");

    /* Tap target floor. */
    const ctaHeight = await page
      .locator("#pmg-suite-handoff-cta")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(ctaHeight).toBeGreaterThanOrEqual(44);

    /* Click the CTA. */
    await page.locator("#pmg-suite-handoff-cta").click();
    /* Wait for the deferred expand+pulse step. */
    await page.waitForTimeout(200);

    /* Hydration payload populated. */
    const hydration = await page.evaluate(
      () =>
        (window as unknown as { __pmgSuiteHandoff: SuiteHandoff })
          .__pmgSuiteHandoff.hydration(),
    );
    expect(hydration).not.toBeNull();
    expect(hydration?.prompt).toContain("Tokyo");
    expect(hydration?.imageUrl.length).toBeGreaterThan(0);

    /* Reference chip mounted in the Suite. */
    await expect(page.locator("#pmg-suite-hydration-ref")).toHaveCount(1);
    await expect(
      page.locator("#pmg-suite-hydration-ref .pmg-suite-hydration-snippet"),
    ).toContainText("Tokyo");

    /* First group expanded. */
    const firstGroupCollapsed = await page
      .locator("#pmg-photo-suite .pmg-photo-group")
      .first()
      .evaluate((el) => el.classList.contains("is-collapsed"));
    expect(firstGroupCollapsed).toBe(false);
  });
});
