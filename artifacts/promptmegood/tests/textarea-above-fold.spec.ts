import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

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

/* Guided intake (pmg-guided-intake.js) replaces the freeform
   #pmg-vs-image-goal textarea with a 4-field guided form by default,
   hiding the textarea (display:none). These geometry tests assert the
   freeform surface, so pin the persisted intake-mode preference to
   'freeform' before the app boots. */
async function pinFreeformIntake(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pmgv3:vs:intake-mode:image", "freeform");
      localStorage.setItem("pmgv3:vs:intake-mode:video", "freeform");
    } catch {
      /* ignore */
    }
  });
}

async function switchToImageMode(page: Page): Promise<boolean> {
  // The canonical "create an image" entry point is the Photography tab in
  // chassis-v3 (the legacy #imageModeBtn / .mode-switch / setMode flow was
  // fully removed in Task #140). Use a user-realistic path: click the
  // chassis tab, falling back to the public setActivePanel API if tabs
  // aren't bound yet. We do NOT directly toggle body.image-mode or
  // data-active-panel — that would mask regressions in the real wiring.
  await page.evaluate(() => {
    const tab = document.querySelector<HTMLButtonElement>(
      '.pmgv3-tab[data-module="photography"]',
    );
    if (tab) {
      tab.click();
      return;
    }
    const w = window as unknown as {
      pmgChassisV3?: { setActivePanel?: (n: string) => void };
    };
    if (typeof w.pmgChassisV3?.setActivePanel === "function") {
      w.pmgChassisV3.setActivePanel("photography");
    }
  });
  // Let chassis swap the active panel + Visual Studio settle (suite
  // relocation, refined-output reset, tab aria-selected flip).
  await page.waitForTimeout(500);
  return await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".pmgv3-body");
    return body?.getAttribute("data-active-panel") === "photography";
  });
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
      await installApiMocks(page);
      await page.goto("/app");
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
      await installApiMocks(page);
      await page.goto("/app");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      // cv3-47 analyze-first flow: #generateBtn is intentionally collapsed
      // (data-pmgv3-collapsed) on first load; the primary CTA is the
      // "Analyze My Idea" button (#analyze-btn). The Generate button is
      // revealed only after analysis. Verify the CURRENT wiring: the
      // analyze CTA is usable on first load, and clicking it reveals an
      // enabled Generate button without any scrolling.
      const generateBtn = page.locator("#generateBtn");
      await expect(
        generateBtn,
        "#generateBtn (Fix My Prompt) must be present on first load",
      ).toHaveCount(1);

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

      const analyzeBtn = page.locator("#analyze-btn");
      await expect(
        analyzeBtn,
        "#analyze-btn (Analyze My Idea) must be visible on first load",
      ).toBeVisible();
      await expect(
        analyzeBtn,
        "#analyze-btn must be enabled on first load",
      ).toBeEnabled();
      await analyzeBtn.click();
      await expect(
        generateBtn,
        "#generateBtn must be revealed after Analyze",
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        generateBtn,
        "#generateBtn must be enabled after Analyze",
      ).toBeEnabled();

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

  });

  // Image mode (Photography v3 panel) — Task #120 brought this in line with
  // text mode's "real input above the fold" guarantee. The canonical entry
  // point is the chassis-v3 Photography tab, which mounts an inline panel
  // built by pmg-visual-studio with its own image-prompt textarea
  // (#pmg-vs-image-goal) and Generate button (#pmg-vs-image-generate-btn)
  // at the top of the panel — no scroll required, no extra clicks.
  test.describe(`image mode (Photography panel) above the fold @ ${vp.name}`, () => {
    test(`image-prompt textarea is visible and above the fold (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await installApiMocks(page);
      await pinFreeformIntake(page);
      await page.goto("/app");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      const beforeScrollY = await page.evaluate(() => window.scrollY);

      const switched = await switchToImageMode(page);
      expect(
        switched,
        "Photography tab must activate the photography panel (data-active-panel='photography')",
      ).toBe(true);

      // Switching tabs must not auto-scroll — a regression that fires
      // scrollIntoView on mount could push the textarea below the fold
      // even if it lives at the top of the panel in source.
      const afterScrollY = await page.evaluate(() => window.scrollY);
      expect(
        afterScrollY,
        `page must not auto-scroll when switching to the Photography panel (before=${beforeScrollY}px, after=${afterScrollY}px)`,
      ).toBeLessThanOrEqual(Math.max(1, beforeScrollY));

      // The image-prompt textarea must be present, visible, enabled, and
      // sit fully within the first viewport so a visitor can start typing
      // immediately after switching to the Photography tab.
      const geom = await page.evaluate(() => {
        const el = document.getElementById(
          "pmg-vs-image-goal",
        ) as HTMLTextAreaElement | null;
        if (!el) {
          return {
            found: false,
            visible: false,
            enabled: false,
            top: 0,
            bottom: 0,
            viewportHeight: window.innerHeight,
          };
        }
        const cs = getComputedStyle(el);
        const visible =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          parseFloat(cs.opacity || "1") > 0;
        const r = el.getBoundingClientRect();
        return {
          found: true,
          visible,
          enabled: !el.disabled && !el.readOnly,
          top: r.top,
          bottom: r.bottom,
          viewportHeight: window.innerHeight,
        };
      });
      expect(geom.found, "#pmg-vs-image-goal must exist in the DOM").toBe(true);
      expect(
        geom.visible,
        "#pmg-vs-image-goal must be visible (display/visibility/opacity)",
      ).toBe(true);
      expect(
        geom.enabled,
        "#pmg-vs-image-goal must be enabled and editable",
      ).toBe(true);
      expect(
        geom.top,
        `#pmg-vs-image-goal must start within the first viewport (top=${geom.top}px)`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        geom.bottom,
        `#pmg-vs-image-goal must end within the first viewport (bottom=${geom.bottom}px, viewport=${geom.viewportHeight}px)`,
      ).toBeLessThanOrEqual(geom.viewportHeight);
    });

    test(`image-mode primary CTA is visible above the fold (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await installApiMocks(page);
      await pinFreeformIntake(page);
      await page.goto("/app");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      const switched = await switchToImageMode(page);
      expect(
        switched,
        "Photography tab must activate the photography panel",
      ).toBe(true);

      // The visible primary CTA on the Photography panel is "✨ Build My
      // Image Prompt" (#pmg-vs-build-image-prompt-btn) — it sits directly
      // under the textarea (ps-2-build-above-fold). The downstream
      // "✨ Generate Image" button (#pmg-vs-image-generate-btn) lives
      // inside the hidden #pmg-vs-image-refined-section and is only
      // revealed after the user clicks Build, so we don't assert its
      // geometry here. We DO assert it still exists in the DOM so the
      // wiring contract isn't accidentally dropped.
      const m = await page.evaluate(() => {
        const build = document.getElementById(
          "pmg-vs-build-image-prompt-btn",
        ) as HTMLButtonElement | null;
        const gen = document.getElementById("pmg-vs-image-generate-btn");
        if (!build) {
          return {
            buildExists: false,
            visible: false,
            enabled: false,
            top: 0,
            bottom: 0,
            viewportHeight: window.innerHeight,
            genExists: !!gen,
          };
        }
        const cs = getComputedStyle(build);
        const visible =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          parseFloat(cs.opacity || "1") > 0;
        const r = build.getBoundingClientRect();
        return {
          buildExists: true,
          visible,
          enabled: !build.disabled,
          top: r.top,
          bottom: r.bottom,
          viewportHeight: window.innerHeight,
          genExists: !!gen,
        };
      });
      expect(
        m.buildExists,
        "#pmg-vs-build-image-prompt-btn must exist in the Photography panel",
      ).toBe(true);
      expect(
        m.visible,
        "#pmg-vs-build-image-prompt-btn must be visible (display/visibility/opacity)",
      ).toBe(true);
      expect(
        m.enabled,
        "#pmg-vs-build-image-prompt-btn must be enabled",
      ).toBe(true);
      expect(
        m.top,
        `#pmg-vs-build-image-prompt-btn must start within the first viewport (top=${m.top}px)`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        m.bottom,
        `#pmg-vs-build-image-prompt-btn must end within the first viewport (bottom=${m.bottom}px, viewport=${m.viewportHeight}px)`,
      ).toBeLessThanOrEqual(m.viewportHeight);
      expect(
        m.genExists,
        "#pmg-vs-image-generate-btn (revealed after Build) must still exist in the DOM",
      ).toBe(true);
    });

    test(`image-mode Generate button is reachable above the fold after Build (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await installApiMocks(page);
      await pinFreeformIntake(page);
      await page.goto("/app");
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(300);

      const switched = await switchToImageMode(page);
      expect(switched).toBe(true);

      // Type a goal and click the visible Build CTA — this is the real user
      // path to image generation. After Build, #pmg-vs-image-refined-section
      // unhides and #pmg-vs-image-generate-btn becomes the actionable
      // generate control. We assert that control lands within the first
      // viewport without any scroll, so generation is reachable above the
      // fold in the same first-impression frame.
      await page.evaluate(() => {
        const ta = document.getElementById(
          "pmg-vs-image-goal",
        ) as HTMLTextAreaElement | null;
        if (!ta) return;
        ta.value = "a cat on a roof at sunset";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.click("#pmg-vs-build-image-prompt-btn");
      // Build is synchronous (composes string locally + reveals section); a
      // short settle covers any rAF / strength-mirror tick.
      await page.waitForTimeout(800);

      const m = await page.evaluate(() => {
        const sec = document.getElementById("pmg-vs-image-refined-section");
        const gen = document.getElementById(
          "pmg-vs-image-generate-btn",
        ) as HTMLButtonElement | null;
        const ref = document.getElementById(
          "pmg-vs-image-refined",
        ) as HTMLTextAreaElement | null;
        if (!sec || !gen) {
          return {
            ok: false,
            sectionRevealed: false,
            visible: false,
            enabled: false,
            top: 0,
            bottom: 0,
            viewportHeight: window.innerHeight,
            scrollY: window.scrollY,
            refinedFilled: false,
          };
        }
        const cs = getComputedStyle(gen);
        const visible =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          parseFloat(cs.opacity || "1") > 0;
        const r = gen.getBoundingClientRect();
        return {
          ok: true,
          sectionRevealed: !sec.hasAttribute("hidden"),
          visible,
          enabled: !gen.disabled,
          top: r.top,
          bottom: r.bottom,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          refinedFilled: !!(ref && ref.value && ref.value.length > 0),
        };
      });
      expect(m.ok, "refined section + generate button must exist").toBe(true);
      expect(
        m.sectionRevealed,
        "#pmg-vs-image-refined-section must unhide after Build",
      ).toBe(true);
      expect(
        m.refinedFilled,
        "#pmg-vs-image-refined must be populated after Build",
      ).toBe(true);
      expect(
        m.visible,
        "#pmg-vs-image-generate-btn must be visible after Build",
      ).toBe(true);
      expect(
        m.enabled,
        "#pmg-vs-image-generate-btn must be enabled after Build",
      ).toBe(true);
      // Build should not auto-scroll the page — Generate must land above the
      // fold in the original viewport frame.
      expect(
        m.scrollY,
        `Build click must not scroll the page (scrollY=${m.scrollY}px)`,
      ).toBeLessThanOrEqual(8);
      expect(
        m.top,
        `#pmg-vs-image-generate-btn must start within the first viewport (top=${m.top}px)`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        m.bottom,
        `#pmg-vs-image-generate-btn must end within the first viewport (bottom=${m.bottom}px, viewport=${m.viewportHeight}px)`,
      ).toBeLessThanOrEqual(m.viewportHeight);
    });
  });
}
