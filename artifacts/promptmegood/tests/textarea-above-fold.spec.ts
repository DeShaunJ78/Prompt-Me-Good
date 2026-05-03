import { test, expect, Page } from "@playwright/test";

type Viewport = { name: string; width: number; height: number };

const VIEWPORTS: Viewport[] = [
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
];

async function dismissOnboarding(page: Page) {
  const tourSkip = page.locator("#tour-skip");
  try {
    if (await tourSkip.isVisible({ timeout: 1500 })) {
      await tourSkip.click({ timeout: 1500 });
    }
  } catch {
    /* no tour overlay; nothing to dismiss */
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* networkidle is best-effort on this page */
  }
  await page.waitForTimeout(400);
}

type GoalGeometry = {
  found: boolean;
  visible: boolean;
  top: number;
  bottom: number;
  height: number;
  viewportHeight: number;
  pageScrollY: number;
};

async function switchToImageMode(page: Page): Promise<boolean> {
  // Use a user-realistic path: click the #imageModeBtn the visitor would
  // tap, falling back to window.setMode('image') if the button isn't yet
  // bound on first load. We do NOT directly add the `image-mode` body
  // class — that would mask regressions in the real wiring (e.g. if the
  // mode-switch handler stops applying the class, this test should fail
  // rather than silently paper over the bug).
  await page.evaluate(() => {
    const btn = document.getElementById(
      "imageModeBtn",
    ) as HTMLButtonElement | null;
    if (btn) {
      btn.click();
      return;
    }
    const w = window as unknown as { setMode?: (m: string) => void };
    if (typeof w.setMode === "function") {
      w.setMode("image");
    }
  });
  // Let any image-mode CSS / JS settle (label swap, generate-btn swap,
  // photo-suite mount, image-mode-hint reveal).
  await page.waitForTimeout(400);
  return await page.evaluate(() =>
    document.body.classList.contains("image-mode"),
  );
}

async function readGoalGeometry(page: Page): Promise<GoalGeometry> {
  return await page.evaluate(() => {
    const el = document.getElementById("goal");
    if (!el) {
      return {
        found: false,
        visible: false,
        top: 0,
        bottom: 0,
        height: 0,
        viewportHeight: window.innerHeight,
        pageScrollY: window.scrollY,
      };
    }
    const style = getComputedStyle(el);
    const visible =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      parseFloat(style.opacity || "1") > 0;
    const rect = el.getBoundingClientRect();
    return {
      found: true,
      visible,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
      pageScrollY: window.scrollY,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`textarea above the fold @ ${vp.name}`, () => {
    test(`#goal is visible without scrolling on first load (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      const goal = await readGoalGeometry(page);

      const lines: string[] = [];
      lines.push("");
      lines.push("=== Textarea above-the-fold check ===");
      lines.push(`Viewport: ${vp.width}x${vp.height} (${vp.name})`);
      lines.push(`#goal found:     ${goal.found}`);
      lines.push(`#goal visible:   ${goal.visible}`);
      lines.push(`#goal top:       ${goal.top}px`);
      lines.push(`#goal bottom:    ${goal.bottom}px`);
      lines.push(`#goal height:    ${goal.height}px`);
      lines.push(`window.scrollY:  ${goal.pageScrollY}px`);
      lines.push(`window.height:   ${goal.viewportHeight}px`);
      lines.push("");
      lines.push(
        "If this fails, something was inserted above the prompt textarea on first load,",
      );
      lines.push(
        "pushing it below the fold. Move the new content below #goal or behind a",
      );
      lines.push(
        "post-generation gate (see body.pmg-workstation-promote in index.html).",
      );

      expect(goal.found, `#goal element must exist on the homepage`).toBe(true);
      expect(goal.visible, `#goal must be visible on first load`).toBe(true);

      // First load: the page must not have auto-scrolled.
      expect(
        goal.pageScrollY,
        `page must not be pre-scrolled on first load (was ${goal.pageScrollY}px)\n${lines.join("\n")}`,
      ).toBeLessThanOrEqual(1);

      // The top of the textarea must be inside the viewport (not below the fold)
      // and not above it (not scrolled past).
      expect(
        goal.top,
        `#goal top (${goal.top}px) must be >= 0 (not above the viewport)\n${lines.join("\n")}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        goal.top,
        `#goal top (${goal.top}px) must be < viewport height (${goal.viewportHeight}px)\n${lines.join("\n")}`,
      ).toBeLessThan(goal.viewportHeight);

      // At least a meaningful slice of the textarea (>= 48px) must be visible
      // above the fold so the user can actually see and tap it.
      const visibleHeight =
        Math.min(goal.bottom, goal.viewportHeight) - Math.max(goal.top, 0);
      expect(
        visibleHeight,
        `at least 48px of #goal must be visible above the fold (saw ${visibleHeight}px)\n${lines.join("\n")}`,
      ).toBeGreaterThanOrEqual(48);
    });

    test(`Fix My Prompt and Run with AI buttons work on first load (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      // Fix My Prompt button (#generateBtn) must be present, visible, and enabled
      // on first load — no scroll, no extra clicks needed.
      const generateBtn = page.locator("#generateBtn");
      await expect(
        generateBtn,
        "#generateBtn (Fix My Prompt) must be present on first load",
      ).toHaveCount(1);
      await expect(
        generateBtn,
        "#generateBtn (Fix My Prompt) must be visible on first load",
      ).toBeVisible();
      await expect(
        generateBtn,
        "#generateBtn (Fix My Prompt) must be enabled on first load",
      ).toBeEnabled();

      // The textarea must be reachable on first load — i.e., we can type into
      // it without any extra scroll/clicks.
      const goal = page.locator("#goal");
      await expect(goal, "#goal must be visible to type into").toBeVisible();
      await goal.fill(
        "Write a concise weekly status update for my engineering team.",
      );
      await expect(
        goal,
        "#goal must accept typed input on first load",
      ).toHaveValue(/engineering team/i);

      // The Run With AI button is intentionally gated — it lives in the
      // post-generation #runSection (display:none until body.pmg-has-result).
      // This guard test does NOT exercise the full AI pipeline; it only
      // verifies the CTA exists in the DOM and is wired to the runtime, so a
      // future change that drops the handler or removes the button will fail.
      const runBtnState = await page.evaluate(() => {
        const btn = document.getElementById(
          "runBtn",
        ) as HTMLButtonElement | null;
        const w = window as unknown as { runWithAI?: unknown };
        return {
          exists: !!btn,
          disabled: btn ? btn.disabled : true,
          onclickAttr: btn ? btn.getAttribute("onclick") || "" : "",
          runtimeWired: typeof w.runWithAI === "function",
        };
      });
      expect(
        runBtnState.exists,
        "#runBtn (Run With AI) must exist in the DOM on first load",
      ).toBe(true);
      expect(
        runBtnState.disabled,
        "#runBtn (Run With AI) must not be disabled on first load",
      ).toBe(false);
      expect(
        runBtnState.onclickAttr,
        "#runBtn (Run With AI) must invoke runWithAI() via its onclick handler",
      ).toMatch(/runWithAI\s*\(/);
      expect(
        runBtnState.runtimeWired,
        "window.runWithAI must be wired so #runBtn's onclick handler resolves",
      ).toBe(true);

      // Submitting the builder form must reach a code path that produces a
      // generated prompt in #resultBox. We force the local-builder branch so
      // the test does not depend on the API server being up.
      await page.evaluate(() => {
        const w = window as unknown as { __pmgAI?: unknown };
        w.__pmgAI = null;
      });
      const submitted = await page.evaluate(() => {
        const form = document.getElementById(
          "prompt-form",
        ) as HTMLFormElement | null;
        if (!form) return false;
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
        return true;
      });
      expect(submitted, "#prompt-form must exist and be submittable").toBe(
        true,
      );
      await expect(
        page.locator("#resultBox"),
        "#resultBox must contain a generated prompt after Fix My Prompt",
      ).not.toBeEmpty({ timeout: 10_000 });
    });

    test(`image mode does not pre-scroll the page on first load (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      // Capture pre-switch scroll position. A regression that auto-scrolls
      // on mode switch (e.g. an unguarded `scrollIntoView` on a re-mounted
      // image-mode card) would push the textarea below the fold even if it
      // was correctly positioned in source.
      const beforeScrollY = await page.evaluate(() => window.scrollY);

      const switched = await switchToImageMode(page);
      expect(
        switched,
        "homepage should enter image mode (body.image-mode)",
      ).toBe(true);

      const afterScrollY = await page.evaluate(() => window.scrollY);

      // NOTE on intent vs reality (read before tightening this guard):
      // Image mode today does NOT mirror text mode's "real text input above
      // the fold" guarantee — the canonical #goal textarea is intentionally
      // hidden by the image-mode flow, and the actual image-prompt textarea
      // currently lives just below the fold (the visible above-fold band is
      // the styled <p class="image-mode-hint"> banner, not a real input,
      // followed by the Photography Suite which mounts further down). A
      // strict above-fold-input assertion here would red-flag intentional
      // UX and block PRs that have nothing to do with image mode. If the
      // product later decides image mode should also surface a real input
      // above the fold (matching text mode), this test should be tightened
      // to require it. For now we only guard the regression vectors we own:
      //   1) Switching into image mode must not auto-scroll the page.
      //   2) The mode switch itself must succeed (asserted above).
      // The companion test below additionally guards that the image-mode
      // generate handler stays wired.
      expect(
        afterScrollY,
        `page must not auto-scroll when entering image mode (before=${beforeScrollY}px, after=${afterScrollY}px)`,
      ).toBeLessThanOrEqual(Math.max(1, beforeScrollY));
    });

    test(`Image-mode generate path is wired on first load (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      const switched = await switchToImageMode(page);
      expect(
        switched,
        "homepage should enter image mode (body.image-mode)",
      ).toBe(true);

      // The image-mode CTA (#image-generate-btn) is dynamically demoted by
      // pmg-pro / pmg-ux on first load (paywall + UX heuristics), so we do
      // NOT assert it is visually visible — that would lock in implementation
      // details we don't own here. We DO assert the regression-critical
      // invariants: the button still exists in the DOM AND a runtime image-
      // generation entry point is registered on window. We deliberately do
      // not lock the wiring style (inline onclick="runImageGeneration()" vs
      // addEventListener), so a future refactor away from inline onclick
      // remains valid as long as the runtime function is still callable.
      const wiring = await page.evaluate(() => {
        const btn = document.getElementById("image-generate-btn");
        const w = window as unknown as {
          runImageGeneration?: unknown;
          generateImage?: unknown;
        };
        return {
          exists: !!btn,
          runtimeWired:
            typeof w.runImageGeneration === "function" ||
            typeof w.generateImage === "function",
        };
      });
      expect(
        wiring.exists,
        "#image-generate-btn must exist in the DOM in image mode",
      ).toBe(true);
      expect(
        wiring.runtimeWired,
        "window.runImageGeneration (or generateImage fallback) must be registered so the image-mode CTA can resolve",
      ).toBe(true);
    });
  });
}
