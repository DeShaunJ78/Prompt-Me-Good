import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* magic-link-auto-checkout — Task #191
 *
 * Contract under test:
 *   - A guest navigates to /app?checkout=founding&ref=pricing.
 *   - Supabase attaches #access_token=... to the URL (magic-link redirect).
 *   - T40's getSession() callback strips the hash via history.replaceState,
 *     preserving ?checkout= in location.search.
 *   - Supabase fires onAuthStateChange('SIGNED_IN') shortly after.
 *   - T40 calls runAutoCheckout(true), which reads _autoCheckoutTier
 *     (captured at IIFE parse time — before any hash-strip).
 *   - /api/create-checkout-session is POSTed with { tier: 'founding' }.
 *
 * Stub strategy:
 *   - page.addInitScript injects window.supabase before any page script runs.
 *   - The stub client's getSession() starts returning null (guest), then
 *     returns a valid session once sessionReady is set.
 *   - onAuthStateChange fires 'SIGNED_IN' after 400 ms, setting sessionReady
 *     first so that resolveSession() inside runAutoCheckout() succeeds.
 *   - Supabase CDN is blocked so the real library never loads.
 *   - /api/create-checkout-session is intercepted; the request body is
 *     captured and asserted.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

test.describe("magic-link auto-checkout (task-191)", () => {
  test("?checkout=founding survives #access_token hash and calls create-checkout-session with tier=founding", async ({
    page,
  }) => {
    /* ------------------------------------------------------------------
     * 1. Inject stub window.supabase BEFORE any page script executes.
     * ------------------------------------------------------------------ */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let authCallback: ((event: string, session: any) => void) | null = null;
      let sessionReady = false;

      const fakeSession = {
        user: { id: "test-user-id", email: "test@example.com" },
        access_token: "fake_access_token_for_test",
      };

      const fakeClient = {
        auth: {
          getSession: () => {
            if (sessionReady) {
              return Promise.resolve({ data: { session: fakeSession } });
            }
            return Promise.resolve({ data: { session: null } });
          },
          onAuthStateChange: (
            cb: (event: string, session: any) => void,
          ) => {
            authCallback = cb;
            /* Simulate Supabase detecting #access_token in the URL and
               firing SIGNED_IN after the initial getSession() resolves
               as null (the guest path).  400 ms gives the T40 IIFE time
               to finish setup before the callback arrives. */
            setTimeout(() => {
              sessionReady = true;
              if (authCallback) authCallback("SIGNED_IN", fakeSession);
            }, 400);
            return {
              data: { subscription: { unsubscribe: () => {} } },
            };
          },
        },
      };

      (window as any).supabase = {
        createClient: () => fakeClient,
      };
    });

    /* ------------------------------------------------------------------
     * 2. Install shared API mocks, then override the endpoints we care
     *    about for this specific scenario.
     * ------------------------------------------------------------------ */
    await installApiMocks(page);

    /* paywallActive:true — real production state (BETA_END is in the past). */
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

    /* Return free plan so the planCoversCheckoutTier guard does NOT block
       checkout (a paid user would see "You're already on this plan"). */
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          user: { id: "test-user-id", email: "test@example.com" },
          plan: "free",
          entitlements: { pro: false, beta: false },
        }),
      }),
    );

    /* Block real Supabase CDN — window.supabase already installed by
       addInitScript above, so an empty stub body is sufficient. */
    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* cdn stub — supabase injected via initScript */",
      }),
    );

    /* ------------------------------------------------------------------
     * 3. Arm the request watcher BEFORE navigating so we don't miss a
     *    fast-firing checkout call.
     * ------------------------------------------------------------------ */
    const checkoutRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      { timeout: 15_000 },
    );

    /* Intercept checkout session: return a stub Stripe URL so runAutoCheckout
       completes cleanly without an actual network error. */
    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );

    /* Prevent the Stripe redirect from navigating away mid-test. */
    await page.route("https://stub.stripe.test/**", (route) =>
      route.abort(),
    );

    /* ------------------------------------------------------------------
     * 4. Navigate to the magic-link style URL.
     *    The #access_token= hash simulates what Supabase appends when
     *    the user clicks a magic link; T40's getSession callback strips
     *    it (history.replaceState — pathname + search, hash dropped),
     *    but _autoCheckoutTier was already captured at IIFE parse time.
     * ------------------------------------------------------------------ */
    await page.goto(
      `${BASE_URL}/app?checkout=founding&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    /* ------------------------------------------------------------------
     * 5. Await the checkout POST and assert the tier.
     * ------------------------------------------------------------------ */
    const checkoutRequest = await checkoutRequestPromise;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const body = checkoutRequest.postDataJSON() as Record<string, unknown>;

    expect(body).not.toBeNull();
    expect(body.tier).toBe("founding");
  });

  test("_autoCheckoutTier is captured before hash-strip: ?checkout= query param survives #access_token= URL", async ({
    page,
  }) => {
    /* This test verifies the parse-time IIFE invariant independently:
     * T40's getSession() detects the #access_token= hash, sets the
     * session, and strips the hash via history.replaceState — but
     * ?checkout= is preserved because replaceState uses pathname+search
     * (no hash).  _autoCheckoutTier was already captured at IIFE parse
     * time before any replaceState ran. */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const fakeSession = {
        user: { id: "test-user-id-2", email: "test2@example.com" },
        access_token: "fake_access_token_2",
      };

      const fakeClient = {
        auth: {
          /* Return the session immediately (Supabase detectSessionInUrl
             exchanges the hash for a session before getSession resolves).
             This is what causes T40 to enter the hash-strip branch. */
          getSession: () =>
            Promise.resolve({ data: { session: fakeSession } }),
          onAuthStateChange: (
            _cb: (event: string, session: any) => void,
          ) => {
            return {
              data: { subscription: { unsubscribe: () => {} } },
            };
          },
        },
      };

      (window as any).supabase = {
        createClient: () => fakeClient,
      };
    });

    await installApiMocks(page);

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

    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* cdn stub */",
      }),
    );

    /* Navigate with ?checkout=pro_monthly to test a different tier. */
    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    /* Wait for T41 to be initialised (runAutoCheckout is exposed on __pmgT41). */
    await page.waitForFunction(
      () =>
        typeof (window as any).__pmgT41?.runAutoCheckout === "function",
      { timeout: 15_000 },
    );

    /* Assert: hash is stripped but query param is preserved in location. */
    const locationAfterStrip = await page.evaluate(() => ({
      search: window.location.search,
      hash: window.location.hash,
    }));

    /* The hash should have been stripped by T40. */
    expect(locationAfterStrip.hash).toBe("");

    /* The ?checkout= query param must still be present — T40's replaceState
       only drops the hash, not the query string. */
    const params = new URLSearchParams(locationAfterStrip.search);
    expect(params.get("checkout")).toBe("pro_monthly");
  });
});
