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
  handoff?: () => void;
  shouldUseHydration?: () => boolean;
  setUseHydratedSubject?: (v: boolean) => void;
  armOneShotClear?: () => boolean;
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
    /* Enter image mode so the suite + result section are exposed.
       Also drop `pmg-workstation-promote` so the entry-point cue (which
       opts out of the streamlined homepage above-the-fold mode) is
       allowed to mount — this test exercises the handoff feature in
       isolation, not the streamlined homepage layout. */
    await page.evaluate(() => {
      document.body.classList.remove("pmg-workstation-promote");
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
    /* Give the suite-handoff init retries a chance to mount the cue
       now that the streamlined-mode opt-out is gone. */
    await page.waitForFunction(
      () => !!document.getElementById("pmg-suite-handoff-cue"),
      undefined,
      { timeout: 5_000 },
    );
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

  /* Task #113 — Suite build pipeline reads the hydration payload. */
  test("hydrated prompt is used as subject when Build Image Prompt fires", async ({
    page,
  }) => {
    /* Stage a fake generated image + prompt and run the public
       handoff() to populate hydration + mount the reference chip. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        img.alt = "test";
        wrap.appendChild(img);
      }
      const goal = document.getElementById(
        "goal",
      ) as HTMLTextAreaElement | null;
      if (goal) goal.value = "A neon-lit Tokyo street at night";
      const api = (
        window as unknown as { __pmgSuiteHandoff: SuiteHandoff & { handoff: () => void } }
      ).__pmgSuiteHandoff;
      api.handoff();
      /* Stub the image pipeline so the test doesn't require an API
         key — we only care that the prompt was composed correctly. */
      (window as unknown as { generateImage?: () => void }).generateImage =
        () => {};
    });

    /* Wait for the reference chip + the build button to be live. */
    await page.waitForSelector("#pmg-suite-hydration-ref", { timeout: 5_000 });
    await page.waitForSelector("#pmg-photo-suite .pmg-photo-pill", {
      timeout: 5_000,
    });

    /* Pick two pills from different groups. We expand any
       collapsed groups first (some init flows collapse all but
       the first) and toggle is-active directly so collapsed
       bodies don't fail Playwright's visibility check. */
    await page.evaluate(() => {
      document
        .querySelectorAll("#pmg-photo-suite .pmg-photo-group.is-collapsed")
        .forEach((g) => g.classList.remove("is-collapsed"));
      const styleEl = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-group="style"]',
      ) as HTMLElement | null;
      const lightingEl = document.querySelector(
        '#pmg-photo-suite .pmg-photo-pill[data-group="lighting"]',
      ) as HTMLElement | null;
      if (styleEl) styleEl.click();
      if (lightingEl) lightingEl.click();
    });

    /* Capture the values we picked so the assertion is data-driven. */
    const picks = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll(
          "#pmg-photo-suite .pmg-photo-pill.is-active",
        ),
      ) as HTMLElement[];
      return els.map((el) => el.getAttribute("data-value") || "");
    });
    expect(picks.length).toBeGreaterThanOrEqual(2);

    /* Click Build / Send. */
    await page.locator("#pmg-photo-suite .pmg-photo-send").click();

    /* Goal is overwritten with the composed final prompt. */
    const finalPrompt = await page.evaluate(
      () =>
        (document.getElementById("goal") as HTMLTextAreaElement | null)
          ?.value ?? "",
    );

    /* Tokens from the hydrated subject. */
    expect(finalPrompt).toContain("Tokyo");
    /* Tokens from the picked pills. */
    for (const v of picks) {
      expect(finalPrompt).toContain(v);
    }
    /* Sanity: the photo-suite suffix joiner is present. */
    expect(finalPrompt).toMatch(/—/);
  });

  test("opt-out toggle disables hydration as the subject seed", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        wrap.appendChild(img);
      }
      const goal = document.getElementById(
        "goal",
      ) as HTMLTextAreaElement | null;
      if (goal) goal.value = "A neon-lit Tokyo street at night";
      const api = (
        window as unknown as { __pmgSuiteHandoff: SuiteHandoff & { handoff: () => void } }
      ).__pmgSuiteHandoff;
      api.handoff();
      (window as unknown as { generateImage?: () => void }).generateImage =
        () => {};
    });
    await page.waitForSelector("#pmg-suite-hydration-ref", { timeout: 5_000 });

    /* Untick the opt-out toggle. */
    await page
      .locator(
        "#pmg-suite-hydration-ref .pmg-suite-hydration-use-subject",
      )
      .uncheck();

    /* Replace the goal so we can verify it (not the hydration) drove
       the subject. */
    await page.evaluate(() => {
      const goal = document.getElementById(
        "goal",
      ) as HTMLTextAreaElement | null;
      if (goal) goal.value = "A quiet desert dune at dawn";
    });

    await page
      .locator('#pmg-photo-suite .pmg-photo-pill[data-group="style"]')
      .first()
      .click();
    await page.locator("#pmg-photo-suite .pmg-photo-send").click();

    const finalPrompt = await page.evaluate(
      () =>
        (document.getElementById("goal") as HTMLTextAreaElement | null)
          ?.value ?? "",
    );
    expect(finalPrompt).toContain("desert");
    expect(finalPrompt).not.toContain("Tokyo");

    /* Even when the user opted out of using hydration as the
       subject, the refinement cycle is still considered consumed
       once a new image arrives — the chip should clear.
       Note: after Send, pmg-image-fix.js replaces the wrap contents
       with an empty placeholder, so we must INSERT a new <img>
       (simulating generation completing) rather than modifying an
       existing one that was already removed. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
        wrap.appendChild(img);
      }
    });
    await expect(page.locator("#pmg-suite-hydration-ref")).toHaveCount(0, {
      timeout: 3_000,
    });
  });

  test("reference chip clears once a new image arrives", async ({ page }) => {
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        wrap.appendChild(img);
      }
      const goal = document.getElementById(
        "goal",
      ) as HTMLTextAreaElement | null;
      if (goal) goal.value = "A neon-lit Tokyo street at night";
      const api = (
        window as unknown as { __pmgSuiteHandoff: SuiteHandoff & { handoff: () => void } }
      ).__pmgSuiteHandoff;
      api.handoff();
      (window as unknown as { generateImage?: () => void }).generateImage =
        () => {};
    });
    await page.waitForSelector("#pmg-suite-hydration-ref", { timeout: 5_000 });
    await page
      .locator('#pmg-photo-suite .pmg-photo-pill[data-group="style"]')
      .first()
      .click();
    await page.locator("#pmg-photo-suite .pmg-photo-send").click();

    /* Simulate a new image arriving (different src).
       After Send, pmg-image-fix.js replaces the wrap contents with
       an empty placeholder, so we must INSERT a new <img> (simulating
       generation completing) rather than modifying a now-removed one. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      if (wrap) {
        wrap.innerHTML = "";
        const img = document.createElement("img");
        img.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
        wrap.appendChild(img);
      }
    });

    /* The chip should self-remove. */
    await expect(page.locator("#pmg-suite-hydration-ref")).toHaveCount(0, {
      timeout: 3_000,
    });
    const hydration = await page.evaluate(
      () =>
        (window as unknown as { __pmgSuiteHandoff: SuiteHandoff })
          .__pmgSuiteHandoff.hydration(),
    );
    expect(hydration).toBeNull();
  });
});
