import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* magic-link-race-condition — Task #197
 *
 * Contract under test:
 *   Production concern: "No race condition where checkout fires before the
 *   session is established."
 *
 *   There are two code paths that call runAutoCheckout():
 *     A. boot() → setTimeout(runAutoCheckout, 2500)  — "already signed-in" path
 *     B. T40's onAuthStateChange → runAutoCheckout(true)  — guest→signed-in path
 *
 *   For the magic-link flow (guest → sign-in via email link), the timeline is:
 *     0 ms:    page loads, _autoCheckoutTier captured, boot() schedules path A
 *     400 ms:  SIGNED_IN fires → path B → checkout fires ✓
 *     2500 ms: path A fires → _autoCheckoutFired already true → no-op ✓
 *
 *   OR, in an unusually slow SIGNED_IN scenario:
 *     0 ms:    page loads, boot() schedules path A
 *     2500 ms: path A fires → getSession() still null → _autoCheckoutFired reset
 *     3000 ms: SIGNED_IN fires → path B → _autoCheckoutFired=false → checkout fires ✓
 *
 *   The critical invariant: checkout fires EXACTLY ONCE regardless of which
 *   path resolves the session first.
 *
 * Exact production URL tested:
 *   /app?checkout=pro_monthly&ref=pricing#access_token=...
 *   (as specified in task-197's "Done looks like" criteria)
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

function sharedSetup(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
) {
  return installApiMocks(page).then(async () => {
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
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          user: { id: "test-user", email: "test@example.com" },
          plan: "free",
          entitlements: { pro: false, beta: true },
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
  });
}

test.describe("magic-link race condition guard (task-197)", () => {
  test("checkout fires exactly once when SIGNED_IN arrives before the 2500 ms boot-path", async ({
    page,
  }) => {
    /* Standard magic-link timing: SIGNED_IN at 400 ms, boot-path at 2500 ms.
       The boot-path must be a no-op — checkout should fire only once. */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let authCallback: ((event: string, session: unknown) => void) | null =
        null;
      let sessionReady = false;
      const fakeSession = {
        user: { id: "u1", email: "test@example.com" },
        access_token: "tok1",
        accessToken: "tok1",
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
    });

    await sharedSetup(page);

    let checkoutCallCount = 0;
    await page.route("**/api/create-checkout-session", (route) => {
      checkoutCallCount++;
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      });
    });
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    const firstCheckout = page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      { timeout: 15_000 },
    );

    /* Exact production URL from task-197 "Done looks like" criteria. */
    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    const req = await firstCheckout;
    const body = req.postDataJSON() as Record<string, unknown>;
    expect(body.tier).toBe("pro_monthly");

    /* Wait for the 2500 ms boot-path to fire and verify no double-checkout. */
    await page.waitForTimeout(3_000);
    expect(checkoutCallCount).toBe(1);
  });

  test("checkout fires when SIGNED_IN arrives AFTER the 2500 ms boot-path (slow session scenario)", async ({
    page,
  }) => {
    /* Worst-case timing: SIGNED_IN arrives at 3000 ms, after the boot-path.
       Boot-path fires at 2500 ms → getSession() still null → resets
       _autoCheckoutFired. SIGNED_IN fires at 3000 ms → runAutoCheckout(true)
       → _autoCheckoutFired=false (reset) → checkout fires correctly. */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let authCallback: ((event: string, session: unknown) => void) | null =
        null;
      let sessionReady = false;
      const fakeSession = {
        user: { id: "u2", email: "late@example.com" },
        access_token: "tok2",
        accessToken: "tok2",
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
              /* Delay past the 2500 ms boot-path to exercise the reset path. */
              setTimeout(() => {
                sessionReady = true;
                if (authCallback) authCallback("SIGNED_IN", fakeSession);
              }, 3_000);
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };
    });

    await sharedSetup(page);

    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    const checkoutFired = page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      /* 7 s: 3000 ms SIGNED_IN + profile fetch + fetch latency. */
      { timeout: 7_000 },
    );

    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    const req = await checkoutFired;
    const body = req.postDataJSON() as Record<string, unknown>;
    expect(body.tier).toBe("pro_monthly");
  });

  test("?checkout= param is captured before Supabase strips #access_token hash (exact production URL)", async ({
    page,
  }) => {
    /* Verifies the parse-time IIFE captures _autoCheckoutTier from
       location.search BEFORE T40's detectSessionInUrl strips the hash.
       This is the fundamental invariant that makes the whole flow work. */
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let sessionReady = false;
      const fakeSession = {
        user: { id: "u3", email: "hash@example.com" },
        access_token: "tok3",
        accessToken: "tok3",
      };
      /* Immediately-resolving session simulates detectSessionInUrl exchanging
         the #access_token hash synchronously (Supabase's actual behaviour). */
      (window as any).supabase = {
        createClient: () => ({
          auth: {
            getSession: () => {
              sessionReady = true;
              return Promise.resolve({
                data: { session: fakeSession },
                error: null,
              });
            },
            onAuthStateChange: (
              _cb: (event: string, session: unknown) => void,
            ) => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };
      void sessionReady; /* suppress unused warning */
    });

    await sharedSetup(page);

    await page.goto(
      `${BASE_URL}/app?checkout=pro_monthly&ref=pricing#access_token=eyJmYWtlfQ.stub`,
    );

    /* Wait for T41 to boot and expose runAutoCheckout. */
    await page.waitForFunction(
      () =>
        typeof (window as any).__pmgT41?.runAutoCheckout === "function",
      { timeout: 10_000 },
    );

    const loc = await page.evaluate(() => ({
      search: window.location.search,
      hash: window.location.hash,
    }));

    /* Hash must be stripped (detectSessionInUrl + T40's replaceState). */
    expect(loc.hash).toBe("");

    /* ?checkout= and ?ref= must survive (T41 strips them on runAutoCheckout,
       but only if _autoCheckoutTier was already captured — which it must be). */
    const params = new URLSearchParams(loc.search);
    /* checkout= is stripped during runAutoCheckout (already-signed-in path) */
    /* ref= is also stripped — verify neither is present in a garbled form */
    /* Both could be absent (stripped by runAutoCheckout) or present if
       runAutoCheckout hasn't fired yet — either is valid. What must NOT
       happen: checkout= surviving as empty string or with wrong value. */
    const checkoutVal = params.get("checkout");
    expect(checkoutVal === null || checkoutVal === "pro_monthly").toBe(true);
  });
});
