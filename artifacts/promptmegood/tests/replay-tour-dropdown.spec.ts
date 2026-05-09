import { test, expect, Page } from "@playwright/test";

/* Task #130 — Replay Tour dropdown coverage.
 *
 * The Replay Tour dropdown ships in three locations inside app.html
 * (header / builder / footer). Each instance is wired by the same
 * initReplayDropdown(triggerId, menuId) factory at app.html ~L10037
 * which:
 *   - toggles `[hidden]` on the menu and `aria-expanded` on the trigger
 *   - delegates [data-tour="intro"] -> ob-overlay flow (startReplayTour)
 *   - delegates [data-tour="workstation"] -> pmgStartWorkstationTour
 *     (defined in pmg-ux.js) -> #pmg-ws-tour-overlay.is-open
 *   - listens on document for any click outside .replay-tour-dropdown
 *     and closes all open menus
 *
 * In the canonical chassis-v3 layout the footer/header/builder DOM is
 * hidden by the universal-hide rule (pmg-chassis-v3.css L51). To exercise
 * the dropdown wiring directly we opt out of chassis-v3 with the
 * documented `?chassis=off` escape hatch (pmg-chassis-v3.js L13–17).
 * The dropdown handlers run on DOMContentLoaded regardless of chassis
 * state, so this is a faithful test of the production wiring — only
 * the visual chrome differs.
 *
 * We target the footer dropdown (#replay-tour-btn / #replay-tour-menu-footer)
 * because its trigger label is literally "Replay Tour" matching the
 * task description, and it is the always-on instance (the builder
 * dropdown is force-hidden by pmg-fixes-v3.js L800 even with chassis=off).
 */

const VIEWPORT = { width: 1280, height: 800 };

const FOOTER_BTN = "#replay-tour-btn";
const FOOTER_MENU = "#replay-tour-menu-footer";
const INTRO_ITEM = `${FOOTER_MENU} [data-tour="intro"]`;
const WS_ITEM = `${FOOTER_MENU} [data-tour="workstation"]`;
const OB_OVERLAY = "#ob-overlay";
const WS_OVERLAY = "#pmg-ws-tour-overlay";

async function gotoApp(page: Page) {
  await page.setViewportSize(VIEWPORT);
  // Pre-mark first-run flags so onboarding doesn't fight us, and clear
  // the workstation-tour-seen flag so the Workstation option is allowed
  // to launch its overlay.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      localStorage.removeItem("pmg.workstationTourSeen");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    } catch {}
  });
  await page.goto("/app.html?chassis=off");
  await page.waitForLoadState("domcontentloaded");
  // Wait for the dropdown wiring to attach (initReplayDropdown runs
  // on DOMContentLoaded inside app.html).
  await page.waitForSelector(FOOTER_BTN, { state: "attached", timeout: 10_000 });
  // Scroll the footer dropdown into view so a user-initiated click
  // dispatches at the right coordinates and our outside-click target
  // is also reachable.
  await page.locator(FOOTER_BTN).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
}

async function openMenu(page: Page) {
  await page.click(FOOTER_BTN);
  // The dropdown toggles `[hidden]`; wait for the menu to be visible.
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return !!el && !el.hasAttribute("hidden");
    },
    FOOTER_MENU,
    { timeout: 2000 },
  );
}

test.describe("Replay Tour dropdown", () => {
  test("opens and shows both Intro Tour + Workstation Tour items", async ({
    page,
  }) => {
    await gotoApp(page);

    // Initial state: trigger collapsed, menu hidden.
    await expect(page.locator(FOOTER_BTN)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator(FOOTER_MENU)).toHaveAttribute("hidden", "");

    await openMenu(page);

    await expect(page.locator(FOOTER_BTN)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator(FOOTER_MENU)).not.toHaveAttribute("hidden", "");

    const intro = page.locator(INTRO_ITEM);
    const ws = page.locator(WS_ITEM);
    await expect(intro).toBeVisible();
    await expect(ws).toBeVisible();
    await expect(intro).toHaveText(/Intro Tour/);
    await expect(ws).toHaveText(/Workstation Tour/);
  });

  test("clicking Intro Tour launches the ob-overlay tour", async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);
    await page.click(INTRO_ITEM);

    // startReplayTour() resets obIndex and calls obStart(); the overlay
    // gains class `is-open`. Allow up to 3s for any rAF/transition tick.
    await page.waitForFunction(
      (sel) => {
        const ov = document.querySelector(sel) as HTMLElement | null;
        return !!ov && ov.classList.contains("is-open");
      },
      OB_OVERLAY,
      { timeout: 3000 },
    );
    await expect(page.locator(OB_OVERLAY)).toHaveClass(/is-open/);

    // The menu should close after picking an item (closeAllReplayMenus()
    // fires before launching the tour at app.html ~L10019).
    await expect(page.locator(FOOTER_MENU)).toHaveAttribute("hidden", "");
    await expect(page.locator(FOOTER_BTN)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("clicking Workstation Tour launches the ws-tour overlay", async ({
    page,
  }) => {
    await gotoApp(page);
    await openMenu(page);

    // Sanity: the global function the handler delegates to must exist
    // (pmg-ux.js ~L17720). Without this guard a dropped script would
    // make the test silently no-op.
    await expect
      .poll(() =>
        page.evaluate(
          () => typeof (window as unknown as { pmgStartWorkstationTour?: unknown }).pmgStartWorkstationTour,
        ),
        { timeout: 5000 },
      )
      .toBe("function");

    await page.click(WS_ITEM);

    await page.waitForFunction(
      (sel) => {
        const ov = document.querySelector(sel) as HTMLElement | null;
        return !!ov && ov.classList.contains("is-open");
      },
      WS_OVERLAY,
      { timeout: 5000 },
    );
    await expect(page.locator(WS_OVERLAY)).toHaveClass(/is-open/);

    await expect(page.locator(FOOTER_MENU)).toHaveAttribute("hidden", "");
    await expect(page.locator(FOOTER_BTN)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("clicking outside the dropdown closes it", async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);

    // Click on the page <body> at a coordinate that is provably outside
    // any .replay-tour-dropdown container. We dispatch via page.mouse
    // at (5, 5) which is the very top-left of the viewport — well clear
    // of the bottom-right footer dropdown.
    await page.mouse.click(5, 5);

    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return !!el && el.hasAttribute("hidden");
      },
      FOOTER_MENU,
      { timeout: 2000 },
    );
    await expect(page.locator(FOOTER_MENU)).toHaveAttribute("hidden", "");
    await expect(page.locator(FOOTER_BTN)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
