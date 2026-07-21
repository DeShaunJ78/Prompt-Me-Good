import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* checkout-nudge-stall — Task #196
 *
 * Contract under test:
 *   When a guest user signs in on /app?checkout=<tier> and the
 *   /api/create-checkout-session call is slow, the checkout nudge banner
 *   (#pmg-t41-checkout-nudge) stays visible the entire time — first with
 *   the sign-up message, then with "Opening checkout…" once the profile
 *   confirms the user is free. The nudge is only removed just before
 *   window.location.assign fires to redirect to Stripe.
 *
 *   This prevents the blank-workstation gap that occurred when
 *   hideCheckoutNudge() + showToast('Opening Checkout…') ran before the
 *   fetch and the toast expired before the API responded.
 *
 * Implementation (pmg-ux.js ~line 13000):
 *   - Old: hideCheckoutNudge(); showToast('Opening Checkout…', 3000); fetch(...)
 *   - New: updateNudgeMessage('Opening checkout…'); fetch(...) → hideCheckoutNudge()
 *          just before window.location.assign(url)
 *
 * Stub strategy: same sessionReady pattern as checkout-nudge-dismiss.spec.ts.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const NUDGE_ID = "pmg-t41-checkout-nudge";
const NUDGE_MSG_CLASS = ".pmg-t41-nudge-msg";

async function setupGuestAuthFlow(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  opts: { tier: string; profileDelay?: number },
): Promise<void> {
  const profileDelay = opts.profileDelay ?? 200;

  await page.addInitScript(({ tier }) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let authCallback: ((event: string, session: unknown) => void) | null =
      null;
    let sessionReady = false;

    const fakeSession = {
      user: { id: "stall-test-user", email: "stall@example.com" },
      access_token: "tok_stall_test",
      accessToken: "tok_stall_test",
    };

    (window as any).supabase = {
      createClient: () => ({
        auth: {
          getSession: () =>
            Promise.resolve({
              data: { session: sessionReady ? fakeSession : null },
              error: null,
            }),
          onAuthStateChange: (
            cb: (event: string, session: unknown) => void,
          ) => {
            authCallback = cb;
            setTimeout(() => {
              sessionReady = true;
              if (authCallback) authCallback("SIGNED_IN", fakeSession);
            }, 400);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signOut: () => Promise.resolve({ error: null }),
          signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
        },
      }),
    };
  }, { tier: opts.tier });

  await installApiMocks(page);

  await page.route("**/api/public-config", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supabaseUrl: "https://stub.supabase.co",
        supabasePublishableKey: "sb_stub",
        stripePublishableKey: "pk_test_stub",
        paywallActive: true,
        openBetaMode: false,
        paywallActivatesAt: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    }),
  );

  await page.route("**/api/me/profile", (route) => {
    setTimeout(() => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          user: { id: "stall-test-user", email: "stall@example.com" },
          plan: "free",
          entitlements: { pro: false, beta: true },
        }),
      });
    }, profileDelay);
  });

  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* cdn stub */",
    }),
  );
}

test.describe("checkout nudge stall resilience (task-196)", () => {
  test("nudge stays visible while /api/create-checkout-session is slow (2 s)", async ({
    page,
  }) => {
    /* Profile resolves fast (200 ms) so the nudge message update fires
       quickly. The checkout POST is held for 2 000 ms to simulate a slow
       API. The nudge must still be visible 1.5 s into the wait. */
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 200 });

    /* Hold the checkout POST for 2 000 ms before fulfilling. */
    await page.route("**/api/create-checkout-session", (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
        });
      }, 2_000);
    });
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    const nudge = page.locator(`#${NUDGE_ID}`);

    /* Nudge must appear when SIGNED_IN fires (~400 ms). */
    await expect(nudge).toBeVisible({ timeout: 8_000 });

    /* Wait 1 500 ms — well into the 2 s checkout stall.
       The nudge must STILL be visible (not hidden mid-flight). */
    await page.waitForTimeout(1_500);
    await expect(nudge).toBeVisible();
  });

  test("nudge message updates to 'Opening checkout' after profile resolves", async ({
    page,
  }) => {
    /* Profile resolves in 200 ms; checkout POST is held indefinitely so we
       can inspect the nudge message before the page navigates. */
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 200 });

    /* Keep the checkout POST pending — never fulfill it.
       This lets us check the nudge message before any navigation. */
    await page.route("**/api/create-checkout-session", (_route) => {
      /* intentionally held — test inspects the message before redirect */
    });

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    const nudge = page.locator(`#${NUDGE_ID}`);
    await expect(nudge).toBeVisible({ timeout: 8_000 });

    /* Wait for profile to resolve and the message to update (profile delay
       is 200 ms; add 800 ms of headroom for async chain). */
    await expect(nudge.locator(NUDGE_MSG_CLASS)).toHaveText(
      /Opening checkout/i,
      { timeout: 3_000 },
    );

    /* Nudge must still be visible — it should NOT have been removed. */
    await expect(nudge).toBeVisible();
  });

  test("nudge is removed just before the Stripe redirect fires", async ({
    page,
  }) => {
    /* Profile resolves fast; checkout POST responds immediately so
       window.location.assign fires right after hideCheckoutNudge(). */
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 200 });

    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    const nudge = page.locator(`#${NUDGE_ID}`);
    await expect(nudge).toBeVisible({ timeout: 8_000 });

    /* After the checkout response arrives and hideCheckoutNudge() fires,
       the nudge must be removed from the DOM. Playwright aborts the Stripe
       redirect, so the page stays alive long enough to assert. */
    await expect(nudge).not.toBeAttached({ timeout: 6_000 });
  });
});
