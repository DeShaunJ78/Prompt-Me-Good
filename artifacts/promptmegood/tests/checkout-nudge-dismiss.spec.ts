import { test, expect } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* checkout-nudge-dismiss — Task #195
 *
 * Contract under test:
 *   When a guest user visits /app?checkout=<tier> and then signs in,
 *   runAutoCheckout(fromAuthChange=true) fires and:
 *     (a) shows the #pmg-t41-checkout-nudge banner immediately
 *     (b) clicking the × dismiss button removes the element cleanly
 *     (c) the auto-checkout POST still fires after the nudge is dismissed
 *         (dismiss removes the visual, it does NOT cancel the checkout flow)
 *     (d) manually invoking startCheckout() after auto-checkout completes
 *         still works (no side-effects from the dismiss)
 *
 * Stub strategy:
 *   - page.addInitScript injects window.supabase before any page script.
 *   - getSession() starts as null (unauthenticated guest), then a delayed
 *     setTimeout fires SIGNED_IN via onAuthStateChange to simulate a magic-
 *     link sign-in.
 *   - The /api/me/profile route is intentionally delayed by 400 ms so the
 *     nudge remains in the DOM long enough to assert its presence and click
 *     the dismiss button before hideCheckoutNudge() runs internally.
 *   - /api/create-checkout-session is intercepted so the Stripe redirect
 *     never fires, allowing post-checkout assertions.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const NUDGE_ID = "pmg-t41-checkout-nudge";
const DISMISS_CLASS = ".pmg-t41-nudge-dismiss";

/* ------------------------------------------------------------------ */
/* Shared setup                                                        */
/* ------------------------------------------------------------------ */

async function setupGuestAuthFlow(
  page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  opts: { tier: string; profileDelay?: number },
): Promise<void> {
  const profileDelay = opts.profileDelay ?? 400;

  /* Inject Supabase stub that starts as guest and fires SIGNED_IN after
     a short delay, matching the real magic-link sign-in flow.
     Critical: sessionReady must be set to true BEFORE firing SIGNED_IN so
     that resolveSession() → getSession() returns a valid session. Without
     this, runAutoCheckout sees sess=null and hides the nudge immediately. */
  await page.addInitScript(({ tier }) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let authCallback: ((event: string, session: unknown) => void) | null =
      null;
    let sessionReady = false;

    const fakeSession = {
      user: { id: "guest-signing-in", email: "guest@example.com" },
      access_token: "tok_guest_signin",
      accessToken: "tok_guest_signin",
    };

    (window as any).__pmgFakeSession = fakeSession;
    (window as any).__pmgFireSignedIn = () => {
      sessionReady = true;
      if (authCallback) authCallback("SIGNED_IN", fakeSession);
    };

    (window as any).supabase = {
      createClient: () => ({
        auth: {
          /* Returns null while guest, returns fakeSession once signed in.
             resolveSession() calls getSession() after SIGNED_IN fires, so
             sessionReady must be true by then — set it in the setTimeout
             before calling the authCallback. */
          getSession: () =>
            Promise.resolve({
              data: { session: sessionReady ? fakeSession : null },
              error: null,
            }),
          onAuthStateChange: (
            cb: (event: string, session: unknown) => void,
          ) => {
            authCallback = cb;
            /* Fire SIGNED_IN after 400 ms — same timing as magic-link test.
               Set sessionReady first so getSession() returns the session
               when resolveSession() is called inside runAutoCheckout. */
            setTimeout(() => {
              sessionReady = true;
              if (authCallback) authCallback("SIGNED_IN", fakeSession);
            }, 400);
            return {
              data: { subscription: { unsubscribe: () => {} } },
            };
          },
          signOut: () => Promise.resolve({ error: null }),
          signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
        },
      }),
    };
  }, { tier: opts.tier });

  await installApiMocks(page);

  /* /api/public-config — paywallActive so T41 boots properly. */
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

  /* /api/me/profile — delayed so the nudge stays visible while profile
     is in-flight. Returns free plan so the checkout guard doesn't block. */
  await page.route("**/api/me/profile", (route) => {
    setTimeout(() => {
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          user: { id: "guest-signing-in", email: "guest@example.com" },
          plan: "free",
          entitlements: { pro: false, beta: true },
        }),
      });
    }, profileDelay);
  });

  /* Block CDN — supabase injected by addInitScript. */
  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* cdn stub */",
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test.describe("checkout nudge dismiss lifecycle (task-195)", () => {
  test("nudge appears when guest signs in on ?checkout=pro_monthly", async ({
    page,
  }) => {
    await setupGuestAuthFlow(page, { tier: "pro_monthly" });

    /* Intercept checkout session so the page does not navigate away. */
    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* The nudge appears immediately when SIGNED_IN fires (before profile
       fetch completes — it is shown at the top of runAutoCheckout before
       the async resolveSession chain). */
    await expect(page.locator(`#${NUDGE_ID}`)).toBeVisible({ timeout: 8_000 });
  });

  test("nudge is removed cleanly when the × dismiss button is clicked", async ({
    page,
  }) => {
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 600 });

    /* Intercept checkout so page stays loaded after the flow. */
    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    /* Capture console errors. */
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* Wait for the nudge to appear. */
    const nudge = page.locator(`#${NUDGE_ID}`);
    await expect(nudge).toBeVisible({ timeout: 8_000 });

    /* Click the dismiss (×) button inside the nudge. */
    const dismissBtn = nudge.locator(DISMISS_CLASS);
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    /* Nudge must be removed from the DOM. */
    await expect(nudge).not.toBeAttached({ timeout: 3_000 });

    /* No console errors from the dismiss action. */
    /* Allow up to 200 ms for any synchronous side-effects to surface. */
    await page.waitForTimeout(200);
    const relevantErrors = consoleErrors.filter(
      (e) => !/favicon|ERR_BLOCKED|stub\.stripe|cdn\.jsdelivr/i.test(e),
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test("auto-checkout POST still fires after the nudge is dismissed mid-flight", async ({
    page,
  }) => {
    /* Longer profile delay so the nudge is visible long enough to dismiss
       before the profile fetch completes (which triggers hideCheckoutNudge
       internally and then the checkout POST). */
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 800 });

    /* Arm the checkout interceptor BEFORE navigating. */
    let checkoutBody: Record<string, unknown> | null = null;
    await page.route("**/api/create-checkout-session", async (route) => {
      try {
        checkoutBody = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
      } catch (_) {}
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      });
    });
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    const checkoutFired = page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      { timeout: 15_000 },
    );

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* Wait for nudge, then dismiss it while profile fetch is still in-flight. */
    const nudge = page.locator(`#${NUDGE_ID}`);
    await expect(nudge).toBeVisible({ timeout: 8_000 });
    await nudge.locator(DISMISS_CLASS).click();

    /* Nudge must be gone (either from dismiss click or from the internal
       hideCheckoutNudge() call that fires just before the POST). */
    await expect(nudge).not.toBeAttached({ timeout: 3_000 });

    /* The checkout POST must still fire — dismiss only removes the visual. */
    const req = await checkoutFired;
    const body = req.postDataJSON() as Record<string, unknown>;
    expect(body).not.toBeNull();
    expect(body.tier).toBe("pro_monthly");
  });

  test("manually invoking startCheckout after a dismissed nudge does not error", async ({
    page,
  }) => {
    /* This confirms there are no side-effects (stale state, locked mutex)
       from a dismissed nudge that would break a subsequent button-initiated
       checkout flow.

       Strategy:
       1. Give the profile route a LONG delay (1 500 ms) so the nudge stays
          visible long enough to dismiss before hideCheckoutNudge() fires.
       2. Abort the subsequent auto-checkout POST so the page does NOT navigate.
       3. Verify __pmgT41.startCheckout still fires a clean POST with the
          correct tier — proving no permanent lock was left behind. */
    await setupGuestAuthFlow(page, { tier: "pro_monthly", profileDelay: 1500 });

    /* Abort the auto-checkout POST — no navigation, page stays alive. */
    await page.route("**/api/create-checkout-session", (route) =>
      route.abort(),
    );

    await page.goto(`${BASE_URL}/app?checkout=pro_monthly`);

    /* Wait for nudge to appear (fires immediately when SIGNED_IN arrives). */
    const nudge = page.locator(`#${NUDGE_ID}`);
    await expect(nudge).toBeVisible({ timeout: 8_000 });

    /* Dismiss the nudge while profile fetch is still in-flight. The long
       profileDelay above ensures we beat hideCheckoutNudge(). */
    await nudge.locator(DISMISS_CLASS).click();

    /* Nudge must be gone immediately after dismiss. */
    await expect(nudge).not.toBeVisible({ timeout: 3_000 });

    /* Wait for the auto-checkout POST to fire (and be aborted by the route
       handler above). This ensures we're past the auto-checkout flow before
       arming the manual interceptor — prevents the auto-checkout POST from
       being mistaken for the manual one. */
    await page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      { timeout: 6_000 },
    );

    /* Wait for __pmgT41.startCheckout to be exposed (boot completes). */
    await page.waitForFunction(
      () => typeof (window as any).__pmgT41?.startCheckout === "function",
      { timeout: 10_000 },
    );

    /* Arm a fresh interceptor that fulfills with a stub URL for the manual
       call. Stacks on top of the existing abort handler; since Playwright
       uses the last-matching route, this takes precedence. */
    await page.route("**/api/create-checkout-session", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://stub.stripe.test/checkout" }),
      }),
    );
    await page.route("https://stub.stripe.test/**", (route) => route.abort());

    const manualCheckout = page.waitForRequest(
      (req) =>
        req.url().includes("/api/create-checkout-session") &&
        req.method() === "POST",
      { timeout: 12_000 },
    );

    /* Invoke startCheckout() directly via __pmgT41 with a synthetic button. */
    await page.evaluate(() => {
      const btn = document.createElement("button");
      btn.setAttribute("data-pmg-upgrade", "founding");
      (window as any).__pmgT41.startCheckout(btn);
    });

    /* The request body is available directly from the captured request;
       waitForRequest resolves when the browser sends it. */
    const manualReq = await manualCheckout;
    const body = manualReq.postDataJSON() as Record<string, unknown>;
    expect(body).not.toBeNull();
    expect(body.tier).toBe("founding");
  });
});
