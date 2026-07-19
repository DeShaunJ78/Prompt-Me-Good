import { test, expect, Page } from "@playwright/test";

/* Task #167: guard the hero demo clip's lazy-loading contract on
 * index.html.
 *
 * The contract (see the hero-demo section + inline loader script in
 * index.html):
 *  1. The shipped markup must never carry src= on the <source> tags —
 *     they carry data-src only, and the video has preload="none". A
 *     regression (someone adds src= directly, or the inline IIFE breaks)
 *     silently adds ~330KB to first paint.
 *  2. The swap-in is driven by an IntersectionObserver with a 400px
 *     rootMargin: nothing is fetched while the section is far from the
 *     viewport; once it nears, the sources are swapped in and the clip
 *     autoplays muted + looping.
 *  3. Under prefers-reduced-motion: reduce, the clip must NOT autoplay;
 *     loop is removed and native controls are exposed so playback is
 *     strictly opt-in.
 *
 * NOTE on viewports: at real phone/desktop sizes the hero-demo section
 * sits ~550-720px from the top of the page, i.e. already inside the
 * 400px rootMargin on load — so the clip (correctly) starts loading
 * immediately there. To observe the "no request until near viewport"
 * half of the contract we use a deliberately short viewport
 * (360x200) that keeps the section out of observer range on load.
 * If the page layout ever shrinks so much that the section lands
 * within 600px of the top, the before-scroll assertion will start
 * failing — that would itself be a signal the lazy load has become
 * moot and the test needs revisiting.
 */

const HERO_ASSET_RE = /\/assets\/hero-demo\.(webm|mp4)/i;
const SHORT_VIEWPORT = { width: 360, height: 200 };

function trackHeroRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (req) => {
    if (HERO_ASSET_RE.test(req.url())) urls.push(req.url());
  });
  return urls;
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* networkidle is best-effort */
  }
  await page.waitForTimeout(400);
}

type VideoState = {
  found: boolean;
  paused: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  currentSrc: string;
  sourcesWithSrc: number;
  sourcesWithDataSrcOnly: number;
  preload: string;
};

async function readVideoState(page: Page): Promise<VideoState> {
  return await page.evaluate(() => {
    const v = document.getElementById(
      "hero-demo-video",
    ) as HTMLVideoElement | null;
    if (!v) {
      return {
        found: false,
        paused: true,
        muted: false,
        loop: false,
        controls: false,
        currentSrc: "",
        sourcesWithSrc: 0,
        sourcesWithDataSrcOnly: 0,
        preload: "",
      };
    }
    const sources = Array.from(v.querySelectorAll("source"));
    return {
      found: true,
      paused: v.paused,
      muted: v.muted,
      loop: v.loop,
      controls: v.controls,
      currentSrc: v.currentSrc || "",
      sourcesWithSrc: sources.filter((s) => s.getAttribute("src")).length,
      sourcesWithDataSrcOnly: sources.filter(
        (s) => s.getAttribute("data-src") && !s.getAttribute("src"),
      ).length,
      preload: v.getAttribute("preload") || "",
    };
  });
}

async function scrollHeroDemoIntoView(page: Page) {
  await page.evaluate(() => {
    document
      .getElementById("hero-demo-video")
      ?.scrollIntoView({ block: "center" });
  });
}

test.describe("hero demo clip lazy-loading (index.html)", () => {
  test("shipped markup keeps the lazy contract: data-src only, preload=none", async ({
    request,
  }) => {
    // Layout-independent guard against the most likely regression:
    // someone editing index.html and putting src= directly on the
    // <source> tags (or dropping preload="none"), which would make the
    // browser fetch ~330KB of video on every first paint regardless of
    // any script.
    const res = await request.get("/");
    expect(res.ok(), "GET / must succeed").toBe(true);
    const html = await res.text();

    // Guard against the stale-duplicate regression: an old copy of the
    // hero figure with the same id once shipped alongside the new one and
    // silently hijacked the lazy-load script (getElementById returns the
    // first match), so visitors saw an outdated recording. Exactly ONE
    // #hero-demo-video may ever exist in the shipped HTML.
    const idOccurrences =
      html.match(/id="hero-demo-video"/gi) ?? [];
    expect(
      idOccurrences.length,
      'exactly one id="hero-demo-video" must exist — a duplicate silently serves a stale clip',
    ).toBe(1);

    const videoBlock = html.match(
      /<video[^>]*id="hero-demo-video"[\s\S]*?<\/video>/i,
    )?.[0];
    expect(
      videoBlock,
      "#hero-demo-video block must exist in the shipped HTML",
    ).toBeTruthy();

    expect(
      videoBlock,
      'video must ship with preload="none" so nothing is fetched eagerly',
    ).toMatch(/preload="none"/);

    const sourceTags = videoBlock!.match(/<source[^>]*>/gi) ?? [];
    expect(
      sourceTags.length,
      "expected 2 <source> tags (webm + mp4)",
    ).toBe(2);
    for (const tag of sourceTags) {
      expect(
        tag,
        `<source> must carry data-src only — a literal src= defeats lazy loading: ${tag}`,
      ).not.toMatch(/\ssrc=/i);
      expect(
        tag,
        `<source> must carry data-src for the lazy swap: ${tag}`,
      ).toMatch(/\sdata-src=/i);
    }
  });

  test("no hero-demo request while the section is far from the viewport", async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    const heroRequests = trackHeroRequests(page);
    await page.goto("/");
    await settle(page);

    const state = await readVideoState(page);
    expect(state.found, "#hero-demo-video must exist on index.html").toBe(
      true,
    );
    expect(
      state.preload,
      'video must keep preload="none" so the poster is the only cost',
    ).toBe("none");
    expect(
      state.sourcesWithSrc,
      "no <source> may carry src= while the section is far from the viewport",
    ).toBe(0);
    expect(
      state.sourcesWithDataSrcOnly,
      "sources must carry data-src (lazy contract) — 2 expected (webm + mp4)",
    ).toBe(2);
    expect(
      heroRequests,
      `no network request for /assets/hero-demo.* before scroll (saw: ${heroRequests.join(", ")})`,
    ).toHaveLength(0);
  });

  test("clip loads and plays muted + looping after scrolling to the section", async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    const heroRequests = trackHeroRequests(page);
    await page.goto("/");
    await settle(page);
    expect(
      heroRequests,
      "sanity: still zero hero-demo requests before scroll",
    ).toHaveLength(0);

    await scrollHeroDemoIntoView(page);

    // Wait for the source swap + playback to start.
    await expect
      .poll(
        async () => {
          const s = await readVideoState(page);
          return s.currentSrc !== "" && !s.paused;
        },
        {
          message:
            "video must pick up a source and start playing after scroll",
          timeout: 15_000,
        },
      )
      .toBe(true);

    const state = await readVideoState(page);
    expect(
      state.currentSrc,
      "currentSrc must resolve to a hero-demo asset",
    ).toMatch(HERO_ASSET_RE);
    expect(state.paused, "video must be playing after scroll").toBe(false);
    expect(state.muted, "autoplaying video must be muted").toBe(true);
    expect(state.loop, "autoplaying video must loop").toBe(true);
    expect(
      heroRequests.length,
      "hero-demo asset must actually be requested over the network after scroll",
    ).toBeGreaterThan(0);
  });

  test("prefers-reduced-motion: no autoplay, controls exposed for opt-in playback", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settle(page);

    await scrollHeroDemoIntoView(page);
    // Give the IntersectionObserver + loader time to run; playback must
    // NOT start in this window.
    await page.waitForTimeout(2500);

    const state = await readVideoState(page);
    expect(state.found, "#hero-demo-video must exist").toBe(true);
    expect(
      state.paused,
      "video must NOT autoplay under prefers-reduced-motion",
    ).toBe(true);
    expect(
      state.controls,
      "native controls must be exposed so playback is opt-in",
    ).toBe(true);
    expect(
      state.loop,
      "loop must be removed under prefers-reduced-motion",
    ).toBe(false);
  });
});
