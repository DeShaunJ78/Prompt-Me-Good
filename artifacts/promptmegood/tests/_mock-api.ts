import type { Page, Route, Request } from "@playwright/test";

/* Shared API mock layer for the Playwright suite.
 *
 * Intercepts every `/api/**` request and replies with a deterministic
 * sensible default so tests never depend on a running API server. Per-spec
 * `page.route(...)` calls registered AFTER `installApiMocks(page)` take
 * precedence (Playwright matches handlers most-recently-registered first),
 * so a spec can still override individual endpoints when it needs to assert
 * specific request/response behavior.
 *
 * Keep this list aligned with `openapi.yaml`. When a new `/api/...` endpoint
 * is added, add a matching default here so the suite stays deterministic.
 */

const MOCK_PROMPT =
  "This is a generated prompt for testing purposes. " +
  "It contains enough text to be realistic and trigger post-generation UI.";

const MOCK_IMPROVE =
  "Improved prompt: This is a clearer, stronger, more specific version of your prompt for testing.";

/* 1x1 transparent PNG (base64). */
const TRANSPARENT_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const TRANSPARENT_PNG_DATA_URL = `data:image/png;base64,${TRANSPARENT_PNG_B64}`;

type Json = Record<string, unknown>;

function json(route: Route, body: Json | unknown[], status = 200): Promise<void> {
  return route.fulfill({
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function handle(route: Route, request: Request): Promise<void> {
  const url = new URL(request.url());
  const path = url.pathname;

  /* --- Config + identity --- */
  if (path.endsWith("/api/pricing-config.js")) {
    // Served as a <script src> — must be valid JS, NOT JSON, or the
    // browser throws SyntaxError and Vite's runtime-error overlay
    // blankets the page, intercepting all pointer events.
    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.PMG_PRICING = window.PMG_PRICING || { founding: { price: 39, cap: 100, remaining: 100 } };",
    });
  }
  if (path.endsWith("/api/public-config")) {
    return json(route, {
      supabaseUrl: "https://stub.supabase.co",
      supabasePublishableKey: "sb_publishable_stub_key",
      stripePublishableKey: "pk_test_stub",
      paywallActive: false,
      openBetaMode: true,
      paywallActivatesAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    });
  }
  if (path.endsWith("/api/me") || path.endsWith("/api/me/profile")) {
    return json(route, {
      authenticated: false,
      user: null,
      plan: "free",
      entitlements: { pro: false, beta: true },
    });
  }
  if (path.endsWith("/api/create-checkout-session")) {
    return json(route, { url: "https://stub.stripe.test/checkout" });
  }

  /* --- Text generation --- */
  if (path.endsWith("/api/generate-stream")) {
    return route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
      body:
        `data: ${JSON.stringify({ text: MOCK_PROMPT })}\n\n` +
        `data: [DONE]\n\n`,
    });
  }
  if (path.endsWith("/api/generate")) {
    return json(route, { success: true, output: MOCK_IMPROVE, prompt: MOCK_IMPROVE });
  }
  if (path.endsWith("/api/analyze")) {
    return json(route, {
      success: true,
      strength: 92,
      score: 92,
      improvedPrompt: MOCK_IMPROVE,
      result: MOCK_IMPROVE,
      suggestions: [],
    });
  }
  if (path.endsWith("/api/auto-tune")) {
    return json(route, {
      picks: {
        category: "business",
        skillLevel: "intermediate",
        tone: "professional",
        outputFormat: "paragraphs",
        maxLength: "medium",
        outputLanguage: "english",
        personality: "balanced",
      },
    });
  }
  if (path.endsWith("/api/clarify")) {
    return json(route, { questions: [] });
  }
  if (path.endsWith("/api/boost")) {
    return json(route, { result: MOCK_IMPROVE });
  }

  /* --- Visual + storyboard --- */
  if (path.endsWith("/api/image") || path.endsWith("/api/image-edit")) {
    return json(route, {
      success: true,
      image: TRANSPARENT_PNG_DATA_URL,
      url: TRANSPARENT_PNG_DATA_URL,
      b64: TRANSPARENT_PNG_B64,
    });
  }
  if (path.endsWith("/api/vision-analyze")) {
    return json(route, {
      success: true,
      prompt: "A cinematic stub photo, soft natural light, shallow depth of field.",
      suite_settings: {},
    });
  }
  if (path.endsWith("/api/storyboard")) {
    return json(route, {
      panels: [
        "Shot 1 — wide establishing.",
        "Shot 2 — medium reveal.",
        "Shot 3 — close-up reaction.",
        "Shot 4 — push-in tension.",
        "Shot 5 — pull-back resolution.",
      ],
    });
  }
  if (path.endsWith("/api/video")) {
    return json(route, { success: true, url: "data:video/mp4;base64,AAAA" });
  }

  /* Default: empty 200 JSON for any other /api/ surface. */
  return json(route, { success: true });
}

export async function installApiMocks(page: Page): Promise<void> {
  await page.route("**/api/**", async (route, request) => {
    await handle(route, request);
  });
}
