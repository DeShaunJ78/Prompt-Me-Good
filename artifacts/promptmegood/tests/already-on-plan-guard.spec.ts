import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* already-on-plan-guard — Task #194
 *
 * Contract under test:
 *   When a paid user (pro or founding) visits /app?checkout=<tier>, the
 *   `runAutoCheckout()` guard must:
 *     (a) show "You're already on this plan — nothing to upgrade!" toast
 *     (b) NOT navigate to Stripe — no POST to /api/create-checkout-session
 *
 * Two guard code-paths in runAutoCheckout():
 *   1. Cache fast-path — getCachedPlan() returns 'pro'/'founding' (no network needed)
 *   2. Network path   — fetchProfile() returns a paid plan (cache absent/null)
 *
 * Both are tested for `plan: 'pro'` + `?checkout=pro_monthly` and
 * `plan: 'founding'` + `?checkout=founding`.
 *
 * Stub strategy:
 *   - page.addInitScript installs window.supabase before any page script runs.
 *   - getSession() returns a valid session immediately (signed-in path) so
 *     resolveSession() succeeds and runAutoCheckout() doesn't bail early.
 *   - CDN is blocked; window.supabase is provided by addInitScript.
 *   - /api/create-checkout-session is intercepted and a flag records any hit.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const PLAN_CACHE_KEY = "promptmegood:plan:v1";
const TOAST_TEXT = "You\u2019re already on this plan \u2014 nothing to upgrade!";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

/** Install a Supabase stub that returns an immediate signed-in session.
 *  Optionally pre-seeds the plan cache in localStorage. */
async function injectSignedInStub(
  page: Page,
  opts: { stalePlan?: string } = {},
): Promise<void> {
  await page.addInitScript(
    ({ stalePlan, planCacheKey }) => {
      if (stalePlan) {
        localStorage.setItem(planCacheKey, stalePlan);
      }

      const fakeSession = {
        user: { id: "paid-user-id", email: "paid@example.com" },
        access_token: "tok_paid_user",
        accessToken: "tok_paid_user",
      };

      (window as any).supabase = {
        createClient: () => ({
          auth: {
            /* Return the session immediately — triggers the boot() path in
               T41 rather than the auth-change path. */
            getSession: () =>
              Promise.resolve({ data: { session: fakeSession }, error: null }),
            onAuthStateChange: (
              _cb: (event: string, session: unknown) => void,
            ) => ({
              data: { subscription: { unsubscribe: () => {} } },
            }),
            signOut: () => Promise.resolve({ error: null }),
            signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
          },
        }),
      };
    },
    { stalePlan: opts.stalePlan ?? null, planCacheKey: PLAN_CACHE_KEY },
  );
}

/** Standard API mocks used by every test. */
async function installCommonMocks(
  page: Page,
  opts: { profilePlan: string },
): Promise<void> {
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

  await page.route("**/api/me/profile", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: true,
        user: { id: "paid-user-id", email: "paid@example.com" },
        plan: opts.profilePlan,
        entitlements: { pro: true, beta: true },
      }),
    }),
  );

  /* Block CDN — supabase is injected by addInitScript. */
  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* cdn stub */",
    }),
  );
}

/** Returns { called } flag.  Intercept /api/create-checkout-session so a
 *  stray POST does not cause a network error AND we can assert it never fired. */
async function armCheckoutGuard(
  page: Page,
): Promise<{ called: () => boolean }> {
  let hit = false;
  await page.route("**/api/create-checkout-session", (route) => {
    hit = true;
    /* Fulfill with a stub URL so the page doesn't error out if it somehow
       fires — we still assert it didn't. */
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
    });
  });
  await page.route("https://stub.stripe.test/**", (route) => route.abort());
  return { called: () => hit };
}

/** Wait for the "already on this plan" toast to appear in the DOM. */
async function waitForAlreadyOnPlanToast(page: Page): Promise<void> {
  /* The toast is appended to <body> with id='pmg-t41-toast' and has a 5 s TTL.
     We poll for either the id or class as a belt-and-suspenders selector. */
  await page.waitForFunction(
    (text) => {
      const el =
        document.getElementById("pmg-t41-toast") ||
        document.querySelector(".pmg-t41-toast");
      return el ? el.textContent === text : false;
    },
    TOAST_TEXT,
    { timeout: 12_000 },
  );
}

/* ------------------------------------------------------------------ */
/* Tests: cache fast-path                                              */
/* ------------------------------------------------------------------ */

test.describe("already-on-plan guard — cache fast-path (task-194)", () => {
  test("pro user with cached plan visiting ?checkout=pro_monthly sees toast and no Stripe call", async ({
    page,
  }) => {
    /* Pre-seed stale pro plan in localStorage so getCachedPlan() → 'pro'. */
    await injectSignedInStub(page, { stalePlan: "pro" });
    await installCommonMocks(page, { profilePlan: "pro" });
    const guard = await armCheckoutGuard(page);

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* Toast must appear. */
    await waitForAlreadyOnPlanToast(page);

    /* Give the network a moment to fire any errant checkout call. */
    await page.waitForTimeout(500);

    /* Assert: no call to Stripe checkout session endpoint. */
    expect(guard.called()).toBe(false);
  });

  test("founding user with cached plan visiting ?checkout=founding sees toast and no Stripe call", async ({
    page,
  }) => {
    await injectSignedInStub(page, { stalePlan: "founding" });
    await installCommonMocks(page, { profilePlan: "founding" });
    const guard = await armCheckoutGuard(page);

    await page.goto(`${BASE_URL}/app?checkout=founding`);

    await waitForAlreadyOnPlanToast(page);
    await page.waitForTimeout(500);
    expect(guard.called()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Tests: network fetch path (no cache)                                */
/* ------------------------------------------------------------------ */

test.describe("already-on-plan guard — network fetch path (task-194)", () => {
  test("pro user (no cache) visiting ?checkout=pro_monthly sees toast and no Stripe call", async ({
    page,
  }) => {
    /* No stalePlan — cache is empty, guard falls through to fetchProfile(). */
    await injectSignedInStub(page);
    await installCommonMocks(page, { profilePlan: "pro" });
    const guard = await armCheckoutGuard(page);

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* Toast must appear (after network fetch resolves). */
    await waitForAlreadyOnPlanToast(page);
    await page.waitForTimeout(500);
    expect(guard.called()).toBe(false);
  });

  test("founding user (no cache) visiting ?checkout=founding sees toast and no Stripe call", async ({
    page,
  }) => {
    await injectSignedInStub(page);
    await installCommonMocks(page, { profilePlan: "founding" });
    const guard = await armCheckoutGuard(page);

    await page.goto(`${BASE_URL}/app?checkout=founding`);

    await waitForAlreadyOnPlanToast(page);
    await page.waitForTimeout(500);
    expect(guard.called()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Tests: startCheckout() button path                                  */
/* ------------------------------------------------------------------ */

test.describe("already-on-plan guard — startCheckout button path (task-194)", () => {
  test("pro user clicking upgrade button (startCheckout) sees toast and no Stripe call", async ({
    page,
  }) => {
    /* No ?checkout= param — auto-checkout won't fire.
       startCheckout() is exposed on __pmgT41 so we can call it directly
       without needing a real DOM button wired via querySelectorAll. */
    await injectSignedInStub(page, { stalePlan: "pro" });
    await installCommonMocks(page, { profilePlan: "pro" });
    const guard = await armCheckoutGuard(page);

    await page.goto(`${BASE_URL}/app.html`);

    /* Wait for T41 to expose startCheckout (set at end of T41 IIFE). */
    await page.waitForFunction(
      () => typeof (window as any).__pmgT41?.startCheckout === "function",
      { timeout: 15_000 },
    );

    /* Invoke startCheckout() with a synthetic button element. */
    await page.evaluate(() => {
      const btn = document.createElement("button");
      btn.setAttribute("data-pmg-upgrade", "pro_monthly");
      (window as any).__pmgT41.startCheckout(btn);
    });

    await waitForAlreadyOnPlanToast(page);
    await page.waitForTimeout(400);
    expect(guard.called()).toBe(false);
  });
});
