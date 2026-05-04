import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type WhatNextApi = {
  version: string;
  mountText: () => void;
  mountImage: () => void;
  runAction: (key: string) => void;
  detectIntent?: (goal: string, body: string) => string;
};

type AnalyticsEvent = {
  name: string;
  payload: Record<string, unknown>;
};

type Win = Window & {
  __pmgWhatNext?: WhatNextApi;
  __pmgAnalytics?: {
    recent: AnalyticsEvent[];
    flushQueue?: () => void;
  };
  __pmgHandoff?: { textToImage: () => void; imageToText: () => void };
  clarity?: (...args: unknown[]) => void;
};

async function gotoApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
      localStorage.removeItem("pmg.photo.recentPresets");
      localStorage.removeItem("pmg.surprise.dial.v1");
      localStorage.removeItem("pmg_whatnext_disable");
      localStorage.removeItem("pmg_disable");
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as Win).__pmgWhatNext,
    undefined,
    { timeout: 10_000 },
  );
  /* The homepage gates the result sections behind app state; for a
     pure unit test of the What Next panel we force them visible so
     Playwright's visibility checks don't trip on unrelated chrome. */
  await page.addStyleTag({
    content: `
      html body #aiResponseSection,
      html body #imageResultSection,
      html body .ai-response-section,
      html body .image-result-section {
        display: block !important;
        visibility: visible !important;
      }
      html body .pmg-wn-panel,
      html body .pmg-wn-panel * {
        display: revert !important;
        visibility: visible !important;
      }
      html body .pmg-wn-panel { display: block !important; }
      html body .pmg-wn-panel .pmg-wn-primary,
      html body .pmg-wn-panel .pmg-wn-secondary {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      html body.pmg-pre-gen .pmg-post-gen,
      html body .pmg-post-gen {
        display: block !important;
        visibility: visible !important;
      }
    `,
  });
  /* The homepage applies a `pmg-pre-gen` body class that hides
     everything tagged `.pmg-post-gen` (incl. our panel) until a
     real generation completes. For an isolated unit test of the
     panel itself, flip the body into post-gen mode so visibility
     checks succeed. */
  await page.evaluate(() => {
    document.body.classList.remove("pmg-pre-gen");
    document.body.classList.add("pmg-post-gen-active");
  });
}

async function seedTextResult(
  page: Page,
  goal: string,
  body: string,
): Promise<void> {
  await page.evaluate(
    ({ g, b }) => {
      const goalInput = document.getElementById("goal") as HTMLInputElement | null;
      if (goalInput) goalInput.value = g;
      const sec = document.getElementById("aiResponseSection") as HTMLElement | null;
      const out = document.getElementById("aiResponseOutput") as HTMLElement | null;
      if (sec) {
        sec.hidden = false;
        sec.removeAttribute("hidden");
        sec.style.setProperty("display", "block", "important");
        sec.style.setProperty("visibility", "visible", "important");
      }
      const tour = document.getElementById("tour-final-actions");
      if (tour) tour.style.setProperty("display", "block", "important");
      if (out) out.textContent = b;
      (window as unknown as Win).__pmgWhatNext!.mountText();
    },
    { g: goal, b: body },
  );
}

async function seedImageResult(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const sec = document.getElementById("imageResultSection") as HTMLElement | null;
    const wrap = document.getElementById("imageResultWrap") as HTMLElement | null;
    if (!sec || !wrap) return false;
    sec.hidden = false;
    wrap.innerHTML =
      '<img alt="t" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVQI12NgAAAAAgABc3UBGAAAAABJRU5ErkJggg=="/>';
    (window as unknown as Win).__pmgWhatNext!.mountImage();
    return true;
  });
}

async function installAnalyticsCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Win & { __pmgCalls?: unknown[][] };
    w.__pmgCalls = [];
    w.clarity = function (...args: unknown[]) {
      w.__pmgCalls!.push(args);
    };
    if (w.__pmgAnalytics && w.__pmgAnalytics.flushQueue) {
      w.__pmgAnalytics.flushQueue();
    }
  });
}

test.describe("What Next? panel @ mobile-360", () => {
  test("public API surface is exposed with current version", async ({ page }) => {
    await gotoApp(page);
    const surface = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgWhatNext!;
      return {
        version: api.version,
        hasMountText: typeof api.mountText === "function",
        hasMountImage: typeof api.mountImage === "function",
        hasRunAction: typeof api.runAction === "function",
      };
    });
    expect(surface.hasMountText).toBe(true);
    expect(surface.hasMountImage).toBe(true);
    expect(surface.hasRunAction).toBe(true);
    expect(surface.version).toBe("task94-1");
  });

  test("panel is absent before any text result is rendered", async ({ page }) => {
    await gotoApp(page);
    const present = await page.evaluate(() => {
      const sec = document.getElementById("aiResponseSection") as HTMLElement | null;
      const visible = !!sec && sec.hidden === false;
      const panel = document.getElementById("pmg-wn-text");
      return { resultVisible: visible, panelExists: !!panel };
    });
    expect(present.resultVisible).toBe(false);
    expect(present.panelExists).toBe(false);
  });

  test("creative-visual bucket: dominant primary + correct subtext + max 1 primary / 2 secondaries", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Design a hero image for my product launch",
      "A polished hero concept for your launch with negative space and a single accent color.",
    );

    const panel = page.locator("#pmg-wn-text");
    await expect(panel).toHaveCount(1);

    await expect(panel.locator(".pmg-wn-eyebrow")).toHaveText("Suggested Next Step");

    const primaries = panel.locator(".pmg-wn-primary");
    const secondaries = panel.locator(".pmg-wn-secondary");
    await expect(primaries).toHaveCount(1);
    await expect(secondaries).toHaveCount(2);

    const primary = primaries.first();
    await expect(primary).toHaveAttribute("data-wn-action", "hero-image");
    await expect(primary.locator(".pmg-wn-btn-title")).toHaveText("Make A Hero Image");
    await expect(primary.locator(".pmg-wn-btn-sub")).toHaveText("Turn This Into A Visual");

    /* Move the panel into a known-visible host so we can measure
       computed layout without fighting the page's pre-gen gating. */
    const dim = await page.evaluate(() => {
      const panel = document.getElementById("pmg-wn-text") as HTMLElement | null;
      if (!panel) return null;
      const host = document.createElement("div");
      host.id = "__pmg_test_host";
      host.style.cssText =
        "position:fixed;left:0;top:0;width:360px;z-index:99999;background:#fff;display:block;visibility:visible;";
      document.body.appendChild(host);
      host.appendChild(panel);
      /* The panel carries `pmg-post-gen` which the host page hides
         until generation completes — strip it locally for measurement. */
      panel.classList.remove("pmg-post-gen");
      panel.style.setProperty("display", "block", "important");
      const p = panel.querySelector(".pmg-wn-primary") as HTMLElement | null;
      const s = panel.querySelector(".pmg-wn-secondary") as HTMLElement | null;
      if (!p || !s) return null;
      const pr = p.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      const cs = getComputedStyle(p);
      return {
        primaryHeight: Math.round(pr.height),
        primaryWidth: Math.round(pr.width),
        secondaryHeight: Math.round(sr.height),
        bg: cs.backgroundColor,
      };
    });
    expect(dim).not.toBeNull();
    expect(dim!.primaryHeight).toBeGreaterThanOrEqual(56);
    expect(dim!.primaryWidth).toBeGreaterThan(280);
    expect(dim!.bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(dim!.bg).not.toBe("rgb(255, 255, 255)");
    expect(dim!.secondaryHeight).toBeLessThan(dim!.primaryHeight);
  });

  test("sensitive bucket: action-plan primary, safety line present, no image CTA, ask-for-help kept", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "I am homeless and want to kill myself please help",
      "Detailed urgent reply that should trigger the sensitive practical bucket with no image CTA.",
    );

    const panel = page.locator("#pmg-wn-text");
    await expect(panel).toHaveCount(1);

    const primaries = panel.locator(".pmg-wn-primary");
    const secondaries = panel.locator(".pmg-wn-secondary");
    await expect(primaries).toHaveCount(1);
    await expect(secondaries).toHaveCount(2);

    await expect(primaries.first()).toHaveAttribute("data-wn-action", "action-plan");
    await expect(primaries.first().locator(".pmg-wn-btn-sub")).toHaveText(
      "Turn This Into Concrete Steps For Today",
    );

    await expect(panel.locator(".pmg-wn-safety")).toHaveCount(1);

    const heroPrimary = panel.locator('.pmg-wn-primary[data-wn-action="hero-image"]');
    await expect(heroPrimary).toHaveCount(0);
    const heroAny = panel.locator('[data-wn-action="hero-image"]');
    await expect(heroAny).toHaveCount(0);

    const labels = await secondaries.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-wn-label") ?? ""),
    );
    expect(labels).toContain("Make This Step-By-Step");
    expect(labels).toContain("Write Message Asking For Help");
  });

  test("business-marketing bucket: hero-image primary + caption/improve secondaries", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Cold email pitch for a B2B SaaS product launch to investors",
      "A concise pitch focused on revenue traction and a clear roadmap that should map to the business-marketing bucket.",
    );
    const panel = page.locator("#pmg-wn-text");
    await expect(panel).toHaveCount(1);
    const primaries = panel.locator(".pmg-wn-primary");
    const secondaries = panel.locator(".pmg-wn-secondary");
    await expect(primaries).toHaveCount(1);
    await expect(secondaries).toHaveCount(2);
    await expect(primaries.first()).toHaveAttribute("data-wn-action", "hero-image");
    const labels = await secondaries.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-wn-label") ?? ""),
    );
    expect(labels).toContain("Create Caption");
    expect(labels).toContain("Improve Prompt");
    const bucket = await page.evaluate(() => {
      const w = window as unknown as Win;
      const events = (w.__pmgAnalytics?.recent ?? []) as AnalyticsEvent[];
      const last = events.filter((e) => e.name === "pmg_what_next_shown").pop();
      return last?.payload.bucket;
    });
    expect(bucket).toBe("business-marketing");
  });

  test("writing-social bucket: hero-image primary + caption/improve secondaries", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Write a LinkedIn post announcing my new newsletter",
      "A short LinkedIn announcement with a hook and a call-to-action — should map to the writing-social bucket.",
    );
    const panel = page.locator("#pmg-wn-text");
    const primaries = panel.locator(".pmg-wn-primary");
    const secondaries = panel.locator(".pmg-wn-secondary");
    await expect(primaries).toHaveCount(1);
    await expect(secondaries).toHaveCount(2);
    await expect(primaries.first()).toHaveAttribute("data-wn-action", "hero-image");
    const bucket = await page.evaluate(() => {
      const w = window as unknown as Win;
      const events = (w.__pmgAnalytics?.recent ?? []) as AnalyticsEvent[];
      const last = events.filter((e) => e.name === "pmg_what_next_shown").pop();
      return last?.payload.bucket;
    });
    expect(bucket).toBe("writing-social");
  });

  test("general bucket fallback: improve-prompt primary with bridge subtext", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Tell me about quartz",
      "Quartz is a hard crystalline mineral. This neutral content should fall through every keyword bucket and land on the general fallback.",
    );
    const panel = page.locator("#pmg-wn-text");
    const primaries = panel.locator(".pmg-wn-primary");
    const secondaries = panel.locator(".pmg-wn-secondary");
    await expect(primaries).toHaveCount(1);
    await expect(secondaries).toHaveCount(2);
    await expect(primaries.first()).toHaveAttribute("data-wn-action", "improve-prompt");
    await expect(primaries.first().locator(".pmg-wn-btn-sub")).toHaveText(
      "Make This Clearer And More Effective",
    );
    const bucket = await page.evaluate(() => {
      const w = window as unknown as Win;
      const events = (w.__pmgAnalytics?.recent ?? []) as AnalyticsEvent[];
      const last = events.filter((e) => e.name === "pmg_what_next_shown").pop();
      return last?.payload.bucket;
    });
    expect(bucket).toBe("general");
  });

  test("image panel is absent before any image result is rendered", async ({
    page,
  }) => {
    await gotoApp(page);
    const state = await page.evaluate(() => {
      const sec = document.getElementById("imageResultSection") as HTMLElement | null;
      const wrap = document.getElementById("imageResultWrap") as HTMLElement | null;
      const panel = document.getElementById("pmg-wn-image");
      return {
        sectionExists: !!sec,
        sectionHidden: sec ? sec.hidden : true,
        hasImg: !!(wrap && wrap.querySelector("img")),
        panelExists: !!panel,
      };
    });
    expect(state.panelExists).toBe(false);

    /* Negative path: even after revealing the section, if no <img>
       has rendered the panel must not mount. */
    if (state.sectionExists) {
      const stillAbsent = await page.evaluate(() => {
        const sec = document.getElementById("imageResultSection") as HTMLElement;
        sec.hidden = false;
        sec.style.setProperty("display", "block", "important");
        const wrap = document.getElementById("imageResultWrap") as HTMLElement | null;
        if (wrap) wrap.innerHTML =
          '<div class="image-placeholder">Your Image Will Appear Here</div>';
        (window as unknown as Win).__pmgWhatNext!.mountImage();
        return !document.getElementById("pmg-wn-image");
      });
      expect(stillAbsent).toBe(true);
    }
  });

  test("image result mounts the image panel with write-text-for-image primary", async ({
    page,
  }) => {
    await gotoApp(page);
    const seeded = await seedImageResult(page);
    test.skip(!seeded, "imageResultSection is not present on the homepage build");

    const panel = page.locator("#pmg-wn-image");
    await expect(panel).toHaveCount(1);
    await expect(panel.locator(".pmg-wn-eyebrow")).toHaveText("Suggested Next Step");
    await expect(panel.locator(".pmg-wn-primary")).toHaveCount(1);
    await expect(panel.locator(".pmg-wn-secondary")).toHaveCount(2);
    await expect(panel.locator(".pmg-wn-primary").first()).toHaveAttribute(
      "data-wn-action",
      "write-text-for-image",
    );
  });

  test("analytics: shown + clicked events fire with clean labels", async ({ page }) => {
    await gotoApp(page);
    await installAnalyticsCapture(page);
    await seedTextResult(
      page,
      "Design a hero image for my product launch",
      "Polished hero concept with warm gradient and generous negative space.",
    );

    const shown = await page.evaluate(() => {
      const w = window as unknown as Win;
      const events = (w.__pmgAnalytics?.recent ?? []) as AnalyticsEvent[];
      return events
        .filter((e) => e.name === "pmg_what_next_shown")
        .map((e) => e.payload);
    });
    expect(shown.length).toBeGreaterThanOrEqual(1);
    const lastShown = shown[shown.length - 1];
    expect(lastShown.bucket).toBe("creative-visual");
    expect(lastShown.source).toBe("text_result");
    expect(typeof lastShown.action_count).toBe("number");

    /* Click via DOM dispatch — the page's pre-gen gating keeps the
       ancestor chain hidden in this isolated test harness, but the
       click handler is bound directly on the panel and fires the
       same analytics event regardless of layout. */
    await page.evaluate(() => {
      const btn = document.querySelector(
        "#pmg-wn-text .pmg-wn-primary",
      ) as HTMLElement | null;
      btn?.click();
    });

    const clicks = await page.evaluate(() => {
      const w = window as unknown as Win;
      const events = (w.__pmgAnalytics?.recent ?? []) as AnalyticsEvent[];
      return events
        .filter((e) => e.name === "pmg_what_next_clicked")
        .map((e) => e.payload);
    });
    expect(clicks.length).toBeGreaterThanOrEqual(1);
    const lastClick = clicks[clicks.length - 1];
    expect(lastClick.action).toBe("hero-image");
    expect(lastClick.bucket).toBe("creative-visual");
    expect(lastClick.label).toBe("Make A Hero Image");
  });

  test("loop guard: repeated mountText calls reuse the same panel node", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Design a hero image for my product launch",
      "First body content for signature stability.",
    );
    const stable = await page.evaluate(() => {
      const before = document.getElementById("pmg-wn-text");
      for (let i = 0; i < 10; i++) {
        (window as unknown as Win).__pmgWhatNext!.mountText();
      }
      const after = document.getElementById("pmg-wn-text");
      return before === after && !!after;
    });
    expect(stable).toBe(true);
  });

  test("no horizontal overflow at 360 width when panel is mounted", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Design a hero image for my product launch",
      "Polished hero concept that should never push the document past 360 px wide on mobile.",
    );

    const widths = await page.evaluate(() => {
      const doc = document.documentElement;
      const panel = document.getElementById("pmg-wn-text")!;
      return {
        docScroll: doc.scrollWidth,
        docClient: doc.clientWidth,
        panelScroll: panel.scrollWidth,
        panelClient: panel.clientWidth,
      };
    });
    expect(widths.docScroll).toBeLessThanOrEqual(widths.docClient + 1);
    expect(widths.panelScroll).toBeLessThanOrEqual(widths.panelClient + 1);
  });

  test("existing portability actions remain present after panel mount", async ({
    page,
  }) => {
    await gotoApp(page);
    await seedTextResult(
      page,
      "Design a hero image for my product launch",
      "Body content so the text result section is fully populated.",
    );

    const copyBtn = page.locator("#copyResponseBtn");
    await expect(copyBtn).toHaveCount(1);

    const externalTools = await page.evaluate(() => {
      const tools = Array.from(
        document.querySelectorAll<HTMLElement>(".open-in-btn[data-tool]"),
      ).map((el) => el.getAttribute("data-tool") ?? "");
      return tools;
    });
    expect(externalTools.length).toBeGreaterThan(0);

    const seeded = await seedImageResult(page);
    if (seeded) {
      const imageStillExposesPortability = await page.evaluate(() => {
        return !!document.getElementById("copyImagePromptBtn");
      });
      expect(imageStillExposesPortability).toBe(true);
    }

    const midjourneyKnownToSendTo = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      return html.includes("midjourney");
    });
    expect(midjourneyKnownToSendTo).toBe(true);
  });

  /* ---------------------------------------------------------------
   * Integration-style: do NOT strip the pre-gen gating overrides.
   * Verifies the panel honours the host page's `.pmg-post-gen` /
   * `body.pmg-pre-gen` contract — a regression that breaks the
   * tagging would mean the panel either flashes pre-gen or never
   * shows post-gen, even if all other unit tests pass.
   * ------------------------------------------------------------- */
  test("integration: panel honours pmg-post-gen gating contract", async ({
    page,
  }) => {
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
      () => !!(window as unknown as Win).__pmgWhatNext,
      undefined,
      { timeout: 10_000 },
    );

    /* Sanity: the host page is in pre-gen mode by default. */
    const preGen = await page.evaluate(() =>
      document.body.classList.contains("pmg-pre-gen"),
    );
    expect(preGen).toBe(true);

    /* Seed a result without forcing visibility. */
    await page.evaluate(() => {
      const goal = document.getElementById("goal") as HTMLInputElement | null;
      if (goal) goal.value = "Design a hero image for my product launch";
      const sec = document.getElementById("aiResponseSection") as HTMLElement | null;
      const out = document.getElementById("aiResponseOutput") as HTMLElement | null;
      if (sec) sec.hidden = false;
      if (out) out.textContent = "Polished hero concept.";
      (window as unknown as Win).__pmgWhatNext!.mountText();
    });

    const contract = await page.evaluate(() => {
      const panel = document.getElementById("pmg-wn-text");
      return {
        mounted: !!panel,
        carriesPostGen: !!(panel && panel.classList.contains("pmg-post-gen")),
      };
    });
    expect(contract.mounted).toBe(true);
    expect(contract.carriesPostGen).toBe(true);

    /* Isolate the panel from its parent so we can read the body-class
       gating effect directly on the panel without inheriting unrelated
       parent visibility rules. The contract under test is:
       `body.pmg-pre-gen .pmg-post-gen { display: none !important; }`. */
    const hiddenUnderPreGen = await page.evaluate(() => {
      const panel = document.getElementById("pmg-wn-text") as HTMLElement;
      panel.removeAttribute("hidden");
      document.body.appendChild(panel);
      return getComputedStyle(panel).display;
    });
    expect(hiddenUnderPreGen).toBe("none");
  });
});
