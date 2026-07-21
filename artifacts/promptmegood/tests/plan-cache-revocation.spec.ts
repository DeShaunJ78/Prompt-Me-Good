import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* plan-cache-revocation — Task #199
 *
 * Contract under test:
 *   - localStorage['promptmegood:plan:v1'] is cleared on SIGNED_OUT so a
 *     stale 'pro'/'founding' value from a previous session cannot silently
 *     block checkout for a free user or a different user on the same device.
 *   - applyProfileToCache() correctly overwrites a stale paid cache with
 *     'free' when the server returns a downgraded plan.
 *   - After the cache is cleared, getCachedPlan() returns null so startCheckout
 *     / runAutoCheckout proceeds to the network fetch instead of the
 *     "already on this plan" fast-path.
 *
 * Stub strategy:
 *   - page.addInitScript injects window.supabase before any page script runs
 *     so T40's IIFE finds and uses our stub client.
 *   - The stub stores every onAuthStateChange listener in
 *     window.__pmgAuthListeners so tests can fire synthetic events.
 *   - Supabase CDN is blocked so the real SDK never loads.
 *   - localStorage['promptmegood:plan:v1'] is pre-seeded in addInitScript.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const PLAN_CACHE_KEY = "promptmegood:plan:v1";

/* ------------------------------------------------------------------ */
/* Shared setup                                                         */
/* ------------------------------------------------------------------ */

async function setupPage(
  page: Page,
  opts: { stalePlan?: string; profilePlan?: string } = {},
): Promise<void> {
  /* addInitScript runs before ALL page scripts — install stale cache and
     Supabase stub here so T40 finds our stub, not the CDN library. */
  await page.addInitScript(
    ({ stalePlan, planCacheKey }) => {
      /* Pre-seed the stale plan cache to simulate a prior paid session. */
      if (stalePlan) {
        localStorage.setItem(planCacheKey, stalePlan);
      }

      /* Minimal Supabase stub — stores listeners so tests can fire events. */
      const listeners: Array<(event: string, session: unknown) => void> = [];
      (window as any).__pmgAuthListeners = listeners;
      (window as any).__testFireAuthEvent = function (
        event: string,
        session: unknown,
      ) {
        listeners.forEach((cb) => {
          try {
            cb(event, session);
          } catch (_) {}
        });
      };

      (window as any).supabase = {
        createClient: () => ({
          auth: {
            getSession: () =>
              Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: (
              cb: (event: string, session: unknown) => void,
            ) => {
              listeners.push(cb);
              return {
                data: { subscription: { unsubscribe: () => {} } },
              };
            },
            signOut: () => {
              /* Signal listeners synchronously so the test can assert
                 the cache state right after the promise resolves. */
              listeners.forEach((cb) => {
                try {
                  cb("SIGNED_OUT", null);
                } catch (_) {}
              });
              return Promise.resolve({ error: null });
            },
            signInWithOtp: () =>
              Promise.resolve({ data: {}, error: null }),
          },
        }),
      };
    },
    { stalePlan: opts.stalePlan ?? null, planCacheKey: PLAN_CACHE_KEY },
  );

  await installApiMocks(page);

  /* Override /api/me/profile to return the specified plan (defaults: free). */
  const profilePlan = opts.profilePlan ?? "free";
  await page.route("**/api/me/profile", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: false,
        plan: profilePlan,
        entitlements: { pro: profilePlan !== "free", beta: true },
      }),
    }),
  );

  /* paywallActive:true — real production state. */
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

  /* Block CDN — our addInitScript already installed window.supabase. */
  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* cdn stub */",
    }),
  );

  await page.goto(`${BASE_URL}/app.html`);

  /* Wait for T40 to register its onAuthStateChange listener. */
  await page.waitForFunction(
    () =>
      Array.isArray((window as any).__pmgAuthListeners) &&
      (window as any).__pmgAuthListeners.length > 0,
    { timeout: 15_000 },
  );
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test.describe("plan cache revocation (task-199)", () => {
  test("SIGNED_OUT clears promptmegood:plan:v1 from localStorage", async ({
    page,
  }) => {
    /* Stale cache from a prior pro session. */
    await setupPage(page, { stalePlan: "pro" });

    /* Confirm the stale value is present before sign-out. */
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(before).toBe("pro");

    /* Fire SIGNED_OUT via the auth state change listener
       (same path as real Supabase sign-out). */
    await page.evaluate(() => {
      (window as any).__testFireAuthEvent("SIGNED_OUT", null);
    });

    /* Give the handler a tick to run. */
    await page.waitForTimeout(100);

    /* Cache must be cleared — getCachedPlan() now returns null. */
    const after = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(after).toBeNull();
  });

  test("SIGNED_OUT also clears a stale founding cache", async ({ page }) => {
    await setupPage(page, { stalePlan: "founding" });

    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(before).toBe("founding");

    await page.evaluate(() =>
      (window as any).__testFireAuthEvent("SIGNED_OUT", null),
    );
    await page.waitForTimeout(100);

    const after = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(after).toBeNull();
  });

  test("applyProfileToCache overwrites stale pro cache when server returns free plan", async ({
    page,
  }) => {
    /* Server returns 'free' — simulates a downgraded or refunded user.
       We need a session so syncOnce() actually fires fetchProfile(). */
    await page.addInitScript(() => {
      /* Session present so syncOnce / fetchProfile runs. */
      const fakeSession = {
        user: { id: "uid-downgraded", email: "downgraded@example.com" },
        access_token: "tok_downgraded",
        accessToken: "tok_downgraded",
      };
      const listeners: Array<(e: string, s: unknown) => void> = [];
      (window as any).__pmgAuthListeners = listeners;
      (window as any).__testFireAuthEvent = (e: string, s: unknown) =>
        listeners.forEach((cb) => { try { cb(e, s); } catch (_) {} });

      (window as any).supabase = {
        createClient: () => ({
          auth: {
            getSession: () =>
              Promise.resolve({ data: { session: fakeSession }, error: null }),
            onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
              listeners.push(cb);
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };
    });

    await installApiMocks(page);

    /* Server returns 'free' plan for a downgraded user. */
    await page.route("**/api/me/profile", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          plan: "free",
          entitlements: { pro: false, beta: true },
        }),
      }),
    );

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

    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* cdn stub */",
      }),
    );

    /* Pre-seed stale paid plan. */
    await page.addInitScript(() => {
      localStorage.setItem("promptmegood:plan:v1", "pro");
    });

    await page.goto(`${BASE_URL}/app.html`);

    /* Wait for T40 to register. */
    await page.waitForFunction(
      () =>
        Array.isArray((window as any).__pmgAuthListeners) &&
        (window as any).__pmgAuthListeners.length > 0,
      { timeout: 15_000 },
    );

    /* Wait for syncOnce / applyProfileToCache to run and update the cache.
       applyProfileToCache writes 'free' when the server returns free plan. */
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === "free",
      PLAN_CACHE_KEY,
      { timeout: 10_000 },
    );

    const cached = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(cached).toBe("free");
  });

  test("after SIGNED_OUT cache is cleared, no 'already on plan' toast fires for a free user", async ({
    page,
  }) => {
    /* Stale pro cache from previous session. */
    await setupPage(page, { stalePlan: "pro", profilePlan: "free" });

    /* Confirm stale cache before sign-out. */
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(before).toBe("pro");

    /* Fire SIGNED_OUT — this is the path the fix adds the removeItem to. */
    await page.evaluate(() =>
      (window as any).__testFireAuthEvent("SIGNED_OUT", null),
    );
    await page.waitForTimeout(150);

    /* Cache must be cleared. */
    const afterSignOut = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    expect(afterSignOut).toBeNull();

    /* Now fire SIGNED_IN as a free user — this triggers syncOnce which
       fetches /api/me/profile (returning 'free' per our mock). */
    const freeUserSession = {
      user: { id: "free-user-id", email: "free@example.com" },
      access_token: "tok_free",
      accessToken: "tok_free",
    };
    await page.evaluate(
      (session) => (window as any).__testFireAuthEvent("SIGNED_IN", session),
      freeUserSession,
    );

    /* Wait for the profile fetch to settle. */
    await page.waitForTimeout(500);

    /* The "already on this plan" toast must NOT appear: getCachedPlan()
       now returns null (or 'free' once applyProfileToCache runs) and
       planCoversCheckoutTier('free') is false, so the fast-path guard
       does not fire. */
    const toast = page
      .locator('[id*="pmg-toast"], .pmg-toast')
      .filter({ hasText: /already on this plan/i });
    const toastVisible = await toast.isVisible().catch(() => false);
    expect(toastVisible).toBe(false);

    /* Plan cache must be null or 'free' — never a stale paid plan. */
    const cacheAfter = await page.evaluate(
      (key) => localStorage.getItem(key),
      PLAN_CACHE_KEY,
    );
    const planValue = cacheAfter ?? "free";
    expect(["free", null]).toContain(cacheAfter);
    expect(planValue).not.toBe("pro");
    expect(planValue).not.toBe("founding");
  });
});
