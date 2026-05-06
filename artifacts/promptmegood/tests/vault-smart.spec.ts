import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const HISTORY_KEY = "promptmegood:history:v1";
const VAULT_SORT_KEY = "promptmegood:vaultSort:v1";

type SeedItem = {
  id: string;
  savedAt: number;
  data: { goal?: string; category?: string; skillLevel?: string };
  prompt: string;
  favorite?: boolean;
  archived?: boolean;
  tags?: string[];
  nickname?: string;
  useCount?: number;
};

function seedItems(): SeedItem[] {
  const now = Date.now();
  return [
    {
      id: "p_seed_alpha",
      savedAt: now - 1000,
      data: { goal: "Alpha goal pizza", category: "business", skillLevel: "beginner" },
      prompt: "Alpha prompt body about pizza recipes",
      favorite: false,
      tags: ["food", "easy"],
      useCount: 7,
    },
    {
      id: "p_seed_bravo",
      savedAt: now - 2000,
      data: { goal: "Bravo goal sushi", category: "business", skillLevel: "beginner" },
      prompt: "Bravo prompt body sushi rolls",
      favorite: false,
      tags: ["food", "advanced"],
      useCount: 3,
    },
    {
      id: "p_seed_charlie",
      savedAt: now - 3000,
      data: { goal: "Charlie goal travel", category: "business", skillLevel: "beginner" },
      prompt: "Charlie prompt body about travel itineraries",
      favorite: false,
      tags: ["travel", "easy"],
      useCount: 1,
    },
    {
      id: "p_seed_delta",
      savedAt: now - 4000,
      data: { goal: "Delta goal music", category: "business", skillLevel: "beginner" },
      prompt: "Delta prompt body music lyrics ideas",
      favorite: false,
      tags: ["music"],
      useCount: 12,
    },
  ];
}

async function seedVault(page: Page, opts: { sort?: string } = {}) {
  const items = seedItems();
  /* addInitScript runs on EVERY navigation (including reloads), so it
     must not clobber values the app may have written between visits.
     We seed history (idempotent — same payload anyway) and only set
     sort when explicitly requested. */
  await page.addInitScript(
    ({ key, sortKey, payload, sort }) => {
      try {
        localStorage.setItem(key, JSON.stringify(payload));
        if (sort) localStorage.setItem(sortKey, sort);
        localStorage.setItem("promptmegood:tour:v1:done", "1");
        sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
      } catch {
        /* private mode: tests in such a context will surface a
           different failure; nothing actionable here. */
      }
    },
    { key: HISTORY_KEY, sortKey: VAULT_SORT_KEY, payload: items, sort: opts.sort ?? "" },
  );
}

async function dismissOnboarding(page: Page) {
  const skip = page.locator("#tour-skip");
  try {
    if (await skip.isVisible({ timeout: 1000 })) await skip.click({ timeout: 1000 });
  } catch {
    /* nothing to dismiss */
  }
}

async function gotoHistory(page: Page) {
  await page.goto(BASE_URL + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#history-list", { timeout: 10_000 });
  await dismissOnboarding(page);
  /* Give renderHistory a tick. */
  await page.waitForTimeout(150);
}

test.describe("Smart Vault @ mobile-360", () => {
  test("full-text search filters the history list", async ({ page }) => {
    await seedVault(page);
    await gotoHistory(page);

    const list = page.locator("#history-list");
    await expect(list.locator(".history-item")).toHaveCount(4);

    await page.locator("#history-search").fill("sushi");
    await page.waitForTimeout(120);
    const visible = list.locator(".history-item");
    await expect(visible).toHaveCount(1);
    await expect(visible.first()).toHaveAttribute("data-id", "p_seed_bravo");

    await page.locator("#history-search").fill("");
    await page.waitForTimeout(120);
    await expect(list.locator(".history-item")).toHaveCount(4);
  });

  test("multi-tag chips combine with AND", async ({ page }) => {
    await seedVault(page);
    await gotoHistory(page);

    const list = page.locator("#history-list");
    await expect(list.locator(".history-item")).toHaveCount(4);

    /* Click #food chip — 2 items (alpha + bravo). */
    await page.locator('#history-tag-bar [data-tag-filter="food"]').click();
    await page.waitForTimeout(120);
    await expect(list.locator(".history-item")).toHaveCount(2);

    /* Add #easy — AND should narrow to alpha only. */
    await page.locator('#history-tag-bar [data-tag-filter="easy"]').click();
    await page.waitForTimeout(120);
    const remaining = list.locator(".history-item");
    await expect(remaining).toHaveCount(1);
    await expect(remaining.first()).toHaveAttribute("data-id", "p_seed_alpha");

    /* Both chips should be aria-pressed=true. */
    await expect(
      page.locator('#history-tag-bar [data-tag-filter="food"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('#history-tag-bar [data-tag-filter="easy"]'),
    ).toHaveAttribute("aria-pressed", "true");

    /* Click "All" chip — clears all tag filters. */
    await page.locator('#history-tag-bar [data-tag-filter=""]').first().click();
    await page.waitForTimeout(120);
    await expect(list.locator(".history-item")).toHaveCount(4);
  });

  test("sort selection persists across reloads (most-used)", async ({ page }) => {
    await seedVault(page);
    await gotoHistory(page);

    /* Switch to Most Used and verify Delta (useCount 12) ranks first. */
    await page.locator("#history-sort").selectOption("most-used");
    await page.waitForTimeout(120);
    const firstId = await page
      .locator("#history-list .history-item")
      .first()
      .getAttribute("data-id");
    expect(firstId).toBe("p_seed_delta");

    /* Reload — the <select> should still read 'most-used' and the
       same item should remain first without re-selecting. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#history-list");
    await dismissOnboarding(page);
    await page.waitForTimeout(150);

    await expect(page.locator("#history-sort")).toHaveValue("most-used");
    const firstAfter = await page
      .locator("#history-list .history-item")
      .first()
      .getAttribute("data-id");
    expect(firstAfter).toBe("p_seed_delta");
  });

  test("oldest sort puts the earliest savedAt first", async ({ page }) => {
    await seedVault(page);
    await gotoHistory(page);

    await page.locator("#history-sort").selectOption("oldest");
    await page.waitForTimeout(120);
    const firstId = await page
      .locator("#history-list .history-item")
      .first()
      .getAttribute("data-id");
    /* Delta has savedAt = now-4000 → oldest. */
    expect(firstId).toBe("p_seed_delta");
  });

  test("Compare Now is disabled below 2 picks and opens N columns when launched", async ({
    page,
  }) => {
    await seedVault(page);
    await gotoHistory(page);

    /* Enter compare mode. */
    await page.locator("#compare-two").click();
    await expect(page.locator("#compare-banner")).toHaveClass(/is-active/);
    await expect(page.locator("#compare-launch")).toBeDisabled();

    /* History items render collapsed by default; the Pick For Compare
       button lives inside .history-item-actions which is display:none
       until the user expands. Expand the first 3 items. */
    const items = page.locator("#history-list .history-item");
    for (let i = 0; i < 3; i++) {
      await items.nth(i).locator('[data-history-action="toggle-expand"]').click();
    }

    /* Pick 3 prompts. */
    await items.nth(0).locator('[data-history-action="compare-pick"]').click();
    await expect(page.locator("#compare-launch")).toBeDisabled();
    await items.nth(1).locator('[data-history-action="compare-pick"]').click();
    await expect(page.locator("#compare-launch")).toBeEnabled();
    await items.nth(2).locator('[data-history-action="compare-pick"]').click();
    await expect(page.locator("#compare-launch")).toHaveText(/Compare Now \(3\)/);

    /* Launch the modal. */
    await page.locator("#compare-launch").click();
    await expect(page.locator("#compare-overlay")).toHaveClass(/is-open/);
    await expect(page.locator("#compare-overlay .compare-grid")).toHaveClass(/is-many/);
    await expect(
      page.locator("#compare-overlay .compare-grid .compare-col-many"),
    ).toHaveCount(3);
    await expect(page.locator("#compare-title")).toHaveText("Compare 3 prompts");

    /* Close and verify legacy two-column layout is restored (no
       leftover .compare-col-many nodes; .is-many class removed). */
    await page.locator("#compare-close").click();
    await expect(page.locator("#compare-overlay")).not.toHaveClass(/is-open/);
    await expect(page.locator("#compare-overlay .compare-grid")).not.toHaveClass(
      /is-many/,
    );
    await expect(
      page.locator("#compare-overlay .compare-grid .compare-col-many"),
    ).toHaveCount(0);
  });

  test("Compare Many caps selections at 5", async ({ page }) => {
    /* Seed 6 items so we can attempt to over-pick. */
    await page.addInitScript(
      ({ key }) => {
        const now = Date.now();
        const six = Array.from({ length: 6 }).map((_, i) => ({
          id: "p_cap_" + i,
          savedAt: now - i * 1000,
          data: { goal: "Cap goal " + i, category: "business", skillLevel: "beginner" },
          prompt: "Cap prompt body " + i,
          favorite: false,
          tags: ["capped"],
        }));
        localStorage.setItem(key, JSON.stringify(six));
        localStorage.setItem("promptmegood:tour:v1:done", "1");
        sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
      },
      { key: HISTORY_KEY },
    );
    await page.goto(BASE_URL + "/app", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#history-list");
    await dismissOnboarding(page);
    await page.waitForTimeout(150);

    await page.locator("#compare-two").click();
    const items = page.locator("#history-list .history-item");
    /* Expand all 6 first (Pick button is hidden when collapsed). */
    for (let i = 0; i < 6; i++) {
      await items.nth(i).locator('[data-history-action="toggle-expand"]').click();
    }
    /* Pick 5. */
    for (let i = 0; i < 5; i++) {
      await items.nth(i).locator('[data-history-action="compare-pick"]').click();
    }
    await expect(page.locator("#compare-launch")).toHaveText(/Compare Now \(5\)/);

    /* Try to pick a 6th — should be capped (toast appears, count
       stays at 5). */
    await items.nth(5).locator('[data-history-action="compare-pick"]').click();
    await expect(page.locator("#compare-launch")).toHaveText(/Compare Now \(5\)/);
  });
});
