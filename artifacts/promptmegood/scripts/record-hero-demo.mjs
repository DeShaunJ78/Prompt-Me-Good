/* Records a real /app flow (type sentence → Generate → structured prompt)
   as a webm via Playwright, for the landing-page hero preview clip.
   Usage: node scripts/record-hero-demo.mjs
   Output: /tmp/pmg-hero-demo/<video>.webm
   Hits the REAL /api/generate endpoint (one cheap gpt-4.1 call). */
import { chromium } from "playwright";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const OUT_DIR = "/tmp/pmg-hero-demo";
const SENTENCE =
  "Write a friendly welcome email for new customers of my coffee shop";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    // clean slate: kill any hydrated draft/session so no stale text or
    // "First version" chips appear at the start of the recording
    localStorage.removeItem("pmgv3:draft");
    sessionStorage.removeItem("pmgv3:session");
    localStorage.setItem("promptmegood:tour:v1:done", "1");
    sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
  } catch {}
});

// ?nofirstrun: disable the first-visit example prefill (pmg-first-run.js)
// so the textarea starts empty and typing isn't appended to stale text
await page.goto(BASE_URL + "/app?nofirstrun", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#goal", { timeout: 20_000 });
await page.waitForTimeout(2500); // let mounters settle, hide any toasts

// hide cookie/consent style banners or sticky CTAs if present
await page.evaluate(() => {
  const s = document.createElement("style");
  s.textContent =
    "#pmg-photo-suite-sticky-cta{display:none!important}" +
    ".pmg-toast,[class*='toast']{display:none!important}";
  document.head.appendChild(s);
});

const goal = page.locator("#goal");
await goal.click();
await page.waitForTimeout(600);
// human-ish typing (~35ms/char → ~2.3s for the sentence)
await goal.pressSequentially(SENTENCE, { delay: 35 });
await page.waitForTimeout(700);

// real flow: Analyze first, which reveals the Generate button
const analyzeBtn = page.locator("#analyze-btn");
if (await analyzeBtn.isVisible().catch(() => false)) {
  await analyzeBtn.hover();
  await page.waitForTimeout(400);
  await analyzeBtn.click();
}

/* Magic Flow takeover auto-fires Generate ~3.5s after Analyze. If the
   takeover is present, just wait; otherwise click Generate manually. */
const takeover = page.locator("#pmg-magic-takeover.is-visible");
const takeoverShown = await takeover
  .waitFor({ state: "visible", timeout: 4000 })
  .then(() => true)
  .catch(() => false);
if (!takeoverShown) {
  const genBtn = page.locator("#generateBtn");
  await genBtn.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
  await genBtn.hover();
  await page.waitForTimeout(400);
  await genBtn.click();
}

// wait for real structured output to appear in the result box
await page.waitForFunction(
  () => {
    const el = document.querySelector("#resultBox");
    return !!el && (el.textContent || "").trim().length > 80;
  },
  undefined,
  { timeout: 45_000 },
);
// scroll result into view and hold so viewers can read it
await page
  .locator("#resultBox")
  .scrollIntoViewIfNeeded()
  .catch(() => {});
await page.waitForTimeout(4000);

await ctx.close();
await browser.close();
console.log("done → " + OUT_DIR);
