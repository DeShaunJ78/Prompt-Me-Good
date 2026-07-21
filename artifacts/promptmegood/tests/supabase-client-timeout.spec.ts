import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* supabase-client-timeout — Task #198
 *
 * Contract under test:
 *   If waitForSupabaseClient() times out (Supabase CDN slow / blocked),
 *   runAutoCheckout must NOT silently vanish. Instead it must:
 *     1. Show a user-visible toast with "unavailable" + "Pricing" direction.
 *     2. Leave _autoCheckoutFired = false so the user can retry.
 *     3. Hide the checkout nudge (replaced by the toast — not silent).
 *
 *   The test harness sets window.__pmgT41TestSupabaseTimeout = 200 so
 *   waitForSupabaseClient times out in 200 ms instead of 5000 ms.
 *
 *   Two paths exercise this:
 *     A. Auth-change path  (fromAuthChange=true): SIGNED_IN fires but
 *        resolveSession throws because T40 client is never available.
 *     B. Boot path (already-signed-in timeout): setTimeout(runAutoCheckout, 2500)
 *        fires but client is still unavailable at that point.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

async function sharedSetup(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
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
  /* Block the Supabase CDN so T40 never gets a client. */
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
  await page.route("**/api/create-checkout-session", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
    }),
  );
}

test.describe("Supabase client timeout → visible toast (task-198)", () => {
  test("auth-change path: toast appears when T40 client never becomes available", async ({
    page,
  }) => {
    /* Short timeout + SIGNED_IN fires immediately (auth-change path). */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      /* Shorten waitForSupabaseClient poll to 200 ms so the test is fast. */
      (window as any).__pmgT41TestSupabaseTimeout = 200;

      /* Stub the Supabase SDK so onAuthStateChange fires SIGNED_IN right
         away — simulating a magic-link landing. T40 calls getClient() which
         would normally be the real Supabase client; here we return null so
         waitForSupabaseClient times out. */
      (window as any).supabase = {
        createClient: () => ({
          auth: {
            getSession: () =>
              Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: (
              cb: (event: string, session: unknown) => void,
            ) => {
              /* Fire SIGNED_IN immediately — the client is still unavailable
                 (waitForSupabaseClient will return null → throw). */
              setTimeout(() => cb("SIGNED_IN", null), 50);
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };

      /* Prevent T40 from setting __pmgT40 — this keeps getT40() returning null,
         which is what waitForSupabaseClient polls for. */
      Object.defineProperty(window, "__pmgT40", {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    });

    await sharedSetup(page);

    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    /* Wait for the toast — timeout path takes ~200 ms poll + 50 ms SIGNED_IN. */
    const toast = page.locator("#pmg-t41-toast");
    await expect(toast).toBeVisible({ timeout: 5_000 });

    const toastText = await toast.textContent();
    /* Must mention unavailability (not silent) and direct to Pricing. */
    expect(toastText).toMatch(/unavailable/i);
    expect(toastText).toMatch(/pricing/i);

    /* No Stripe redirect must have fired. */
    const checkoutCalled = await page
      .waitForRequest(
        (req) => req.url().includes("/api/create-checkout-session"),
        { timeout: 500 },
      )
      .then(() => true)
      .catch(() => false);
    expect(checkoutCalled).toBe(false);
  });

  test("boot path: toast appears when T40 client is unavailable at the 2500 ms mark", async ({
    page,
  }) => {
    /* No SIGNED_IN is fired — user is already signed in (boot path). */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).__pmgT41TestSupabaseTimeout = 200;

      (window as any).supabase = {
        createClient: () => ({
          auth: {
            getSession: () =>
              Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: (
              _cb: (event: string, session: unknown) => void,
            ) => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };

      Object.defineProperty(window, "__pmgT40", {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    });

    await sharedSetup(page);

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly&ref=pricing`);

    /* Boot path fires runAutoCheckout at 2500 ms; waitForSupabaseClient
       times out at +200 ms → toast at ~2700 ms total. */
    const toast = page.locator("#pmg-t41-toast");
    await expect(toast).toBeVisible({ timeout: 5_000 });

    const toastText = await toast.textContent();
    expect(toastText).toMatch(/unavailable/i);
    expect(toastText).toMatch(/pricing/i);
  });

  test("nudge does not disappear silently — toast replaces it visibly", async ({
    page,
  }) => {
    /* This test specifically validates the 'not silent' requirement:
       the nudge is shown (auth-change path) and then replaced by the toast
       (not just removed with no feedback).
       SIGNED_IN must carry a real session object so T40's
       `if (session && session.user)` guard passes and it calls
       runAutoCheckout(true), which shows the nudge before resolveSession
       times out. */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).__pmgT41TestSupabaseTimeout = 200;

      const fakeSession = {
        user: { id: "u-timeout", email: "timeout@example.com" },
        access_token: "tok-timeout",
      };

      (window as any).supabase = {
        createClient: () => ({
          auth: {
            /* getSession returns null — the real Supabase client is unavailable,
               which is what waitForSupabaseClient simulates. */
            getSession: () =>
              Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: (
              cb: (event: string, session: unknown) => void,
            ) => {
              /* Delay enough for T41 to mount and expose runAutoCheckout. */
              setTimeout(() => cb("SIGNED_IN", fakeSession), 300);
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };

      /* Prevent T40 from setting __pmgT40 so waitForSupabaseClient always
         sees null and times out after the 200 ms test window. */
      Object.defineProperty(window, "__pmgT40", {
        get: () => null,
        set: () => {},
        configurable: true,
      });
    });

    await sharedSetup(page);

    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    /* Nudge should appear briefly (SIGNED_IN → fromAuthChange=true → showCheckoutNudge). */
    const nudge = page.locator("#pmg-t41-checkout-nudge");
    await expect(nudge).toBeVisible({ timeout: 3_000 });

    /* Then waitForSupabaseClient times out (200 ms) → throw → catch shows toast. */
    const toast = page.locator("#pmg-t41-toast");
    await expect(toast).toBeVisible({ timeout: 3_000 });

    /* Nudge must be hidden now — replaced by the toast, not a silent removal. */
    await expect(nudge).not.toBeVisible();
  });
});
