/* Records a short screen capture of the real /app workstation for the
 * landing-page hero preview (Task #164). Uses the same API-mock approach as
 * the Playwright suite (tests/_mock-api.ts) so no OpenAI credits are spent —
 * the UI, typing, and generate flow are the real app.
 *
 * Run:  node scripts/record-hero-demo.mjs
 * Output: /tmp/hero-demo/  (webm video; convert with ffmpeg afterwards)
 */
import { chromium } from "@playwright/test";

const APP_URL = process.env.APP_URL || "http://localhost:80/app";
const OUT_DIR = "/tmp/hero-demo";

const GOAL = "Write a warm launch email for my candle shop's new fall collection";

const DEMO_PROMPT = [
  "You are an experienced e-commerce copywriter who specializes in small artisan brands.",
  "",
  "Write a warm, inviting launch email announcing my handmade candle shop's new fall collection.",
  "",
  "Context: The shop is small-batch and family-run. The fall line features scents like spiced pear, cedar + amber, and pumpkin chai. The audience is past customers who love cozy, seasonal products.",
  "",
  "Requirements:",
  "- Subject line + preview text (give 3 options)",
  "- Friendly, personal tone - like a note from the maker, not a corporation",
  "- Highlight 2-3 scents with sensory descriptions",
  "- One clear call to action to shop the collection",
  "- Keep it under 200 words",
].join("\n");

function sseBody(text) {
  // Same data: {text}\n\n + data: [DONE] format as /api/generate-stream.
  const words = text.split(/(?<=\s)/);
  const chunks = [];
  for (let i = 0; i < words.length; i += 4) {
    chunks.push(`data: ${JSON.stringify({ text: words.slice(i, i + 4).join("") })}\n\n`);
  }
  chunks.push("data: [DONE]\n\n");
  return chunks.join("");
}

async function installMocks(page) {
  await page.route("**/api/**", async (route, request) => {
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({ status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (path.endsWith("/api/public-config")) {
      return json({
        supabaseUrl: "https://stub.supabase.co",
        supabasePublishableKey: "sb_publishable_stub_key",
        stripePublishableKey: "pk_test_stub",
        paywallActive: false,
        openBetaMode: true,
        paywallActivatesAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      });
    }
    if (path.endsWith("/api/me") || path.endsWith("/api/me/profile")) {
      return json({ authenticated: false, user: null, plan: "free", entitlements: { pro: false, beta: true } });
    }
    if (path.endsWith("/api/generate-stream")) {
      await new Promise((r) => setTimeout(r, 1400)); // visible "Generating…" beat
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody(DEMO_PROMPT),
      });
    }
    if (path.endsWith("/api/generate") || path.endsWith("/api/generate-prompt")) {
      return json({ success: true, output: DEMO_PROMPT, prompt: DEMO_PROMPT, result: DEMO_PROMPT });
    }
    if (path.endsWith("/api/auto-tune")) {
      return json({
        ok: true,
        picks: {
          category: "business",
          skillLevel: "intermediate",
          tone: "friendly",
          outputFormat: "paragraphs",
          maxLength: "medium",
          outputLanguage: "english",
          personality: "balanced",
        },
      });
    }
    if (path.endsWith("/api/clarify")) return json({ questions: [] });
    if (path.endsWith("/api/usage/check")) return json({ ok: true, allowed: true, remaining: 99 });
    if (request.method() === "GET") return route.continue();
    return json({ ok: true, success: true });
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

await page.addInitScript(() => {
  try {
    localStorage.setItem("promptmegood:tour:v1:done", "1");
  } catch (_) {}
});
await installMocks(page);

await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#goal", { state: "visible", timeout: 20000 });
await page.waitForTimeout(1500); // let the workstation settle on screen

const goal = page.locator("#goal");
await goal.click();
await page.waitForTimeout(400);
await goal.pressSequentially(GOAL, { delay: 45 });
await page.waitForTimeout(700);

// The visible primary control in chassis v3 is #analyze-btn ("Build My Prompt").
const buildBtn = page.locator("#analyze-btn");
if (await buildBtn.isVisible().catch(() => false)) {
  await buildBtn.click();
} else {
  await page.locator("#generateBtn").click();
}

// Wait for the demo prompt to land in the result box, then hold on it.
await page.waitForFunction(
  () => {
    const el = document.getElementById("resultBox");
    return !!el && (el.textContent || "").includes("e-commerce copywriter");
  },
  { timeout: 20000 }
);
await page.waitForTimeout(600);
const result = page.locator("#resultBox");
await result.scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);

await context.close();
await browser.close();
console.log("Recorded to", OUT_DIR);
