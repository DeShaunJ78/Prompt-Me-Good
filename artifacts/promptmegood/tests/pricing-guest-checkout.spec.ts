import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* pricing-guest-checkout — Task #186
 *
 * Contract under test:
 *   - Guest (no session) clicking any [data-pmg-upgrade] Subscribe button on
 *     pricing.html is redirected to /app?checkout=<tier>&ref=pricing instead
 *     of showing the old dead-end "Sign In To Upgrade." toast.
 *   - The `tier` value in the URL matches the button's data-pmg-upgrade attribute
 *     (no forced normalization to 'founding').
 *   - No "Sign In To Upgrade" text ever appears on the page.
 *   - The Founding Member #founding-buy-btn is unaffected (separate anonymous flow).
 *
 * Setup:
 *   - API mocks via installApiMocks, then overriding /api/public-config to
 *     return paywallActive:true — matching the real production state (BETA_END
 *     is July 1, 2026, which is in the past).  With paywallActive:true:
 *       • pmg-launch-swap.js hides [data-pmg-beta-only] elements and removes
 *         [hidden] from [data-pmg-post-launch] — the real Subscribe buttons appear.
 *       • wireButtons in pmg-ux.js wires those buttons to startCheckout (betaActive
 *         is false because the mock pricing-config.js returns no BETA_END).
 *   - Supabase CDN blocked → window.supabase undefined → resolveSession() returns
 *     null immediately (no client) → guest path fires → redirect to /app?checkout=…
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

async function gotoPricing(page: Page): Promise<void> {
  await installApiMocks(page);

  /* Override public-config: paywallActive:true matches real production state.
     Registered after installApiMocks so it takes precedence (Playwright matches
     most-recently-registered handlers first). */
  await page.route("**/api/public-config", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supabaseUrl: "https://stub.supabase.co",
        supabasePublishableKey: "sb_publishable_stub_key",
        stripePublishableKey: "pk_test_stub",
        paywallActive: true,
        openBetaMode: false,
        paywallActivatesAt: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    }),
  );

  /* Block Supabase CDN → window.supabase undefined → T40 client stays null
     → resolveSession() short-circuits to null → guest redirect fires. */
  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* cdn stub */",
    }),
  );

  await page.goto(`${BASE_URL}/pricing.html`);

  /* Wait for launch-swap to complete: a [data-pmg-post-launch] element must
     have its [hidden] attribute removed (Subscribe button is visible). */
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-pmg-post-launch]");
      return el !== null && !el.hasAttribute("hidden");
    },
    { timeout: 15_000 },
  );

  /* Also wait for wireButtons to mark the Subscribe buttons. */
  await page.waitForFunction(
    () =>
      document.querySelector(
        '[data-pmg-upgrade][data-pmg-t41-injected="1"]',
      ) !== null,
    { timeout: 15_000 },
  );
}

/* ------------------------------------------------------------------ */

test.describe("pricing.html — guest checkout gate (no dead-end toast)", () => {
  test("guest click on pro_monthly Subscribe redirects to /app?checkout=pro_monthly&ref=pricing", async ({
    page,
  }) => {
    await gotoPricing(page);

    /* Post-launch Subscribe button: visible after pmg-launch-swap removes [hidden]. */
    const btn = page
      .locator(
        '[data-pmg-post-launch] [data-pmg-upgrade="pro_monthly"][data-pmg-t41-injected="1"]',
      )
      .first();
    await expect(btn).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/app/, { timeout: 15_000 }),
      btn.click(),
    ]);

    const url = new URL(page.url());
    expect(url.pathname).toBe("/app");
    expect(url.searchParams.get("checkout")).toBe("pro_monthly");
    expect(url.searchParams.get("ref")).toBe("pricing");
  });

  test("no 'Sign In To Upgrade' text appears after guest clicks Subscribe", async ({
    page,
  }) => {
    await gotoPricing(page);

    const btn = page
      .locator(
        '[data-pmg-post-launch] [data-pmg-upgrade="pro_monthly"][data-pmg-t41-injected="1"]',
      )
      .first();
    await expect(btn).toBeVisible();

    let didNavigate = false;
    page.once("framenavigated", () => {
      didNavigate = true;
    });

    await btn.click();

    /* Allow 300 ms for any toast to render before redirect completes. */
    if (!didNavigate) {
      await page.waitForTimeout(300);
    }

    const signInText = await page
      .getByText("Sign In To Upgrade", { exact: false })
      .isVisible()
      .catch(() => false);

    expect(signInText).toBe(false);
  });

  test("pro_yearly tier preserves its own tier — not forced to 'founding'", async ({
    page,
  }) => {
    await gotoPricing(page);

    const btn = page
      .locator(
        '[data-pmg-post-launch] [data-pmg-upgrade="pro_yearly"][data-pmg-t41-injected="1"]',
      )
      .first();
    await expect(btn).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/app/, { timeout: 15_000 }),
      btn.click(),
    ]);

    const url = new URL(page.url());
    expect(url.searchParams.get("checkout")).toBe("pro_yearly");
    expect(url.searchParams.get("checkout")).not.toBe("founding");
  });

  test("Founding Member #founding-buy-btn is present and uses its own anonymous flow", async ({
    page,
  }) => {
    await gotoPricing(page);

    /* The Founding Member button is wired by its own inline script (anonymous
       checkout, no auth required) — completely independent from startCheckout(). */
    const foundingBtn = page.locator("#founding-buy-btn");
    await expect(foundingBtn).toBeVisible();
    await expect(foundingBtn).toBeEnabled();

    /* It must NOT have data-pmg-t41-injected — it is not a [data-pmg-upgrade]
       element and must not be intercepted by T41's wireButtons. */
    const injected = await foundingBtn.getAttribute("data-pmg-t41-injected");
    expect(injected).toBeNull();
  });
});
