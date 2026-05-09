import { test, expect, Page } from "@playwright/test";
import { installApiMocks } from "./_mock-api";

/* Task #139 — End-to-end coverage for the Business Mode workspace.
 *
 * Behaviors covered:
 *  - The 💼 Business Mode tab is rendered in the chassis-v3 topbar.
 *  - ?panel=business deep-link auto-switches to the Business panel.
 *  - PMGBusiness exposes parseVariables / fillTemplate / loadBrand /
 *    saveBrand / buildBrandInjection — directly exercised in-page.
 *  - Brand Voice Vault round-trips through localStorage under the
 *    shared 'pmg-brand-voice-v1' key, preserving the Pro-only
 *    `name` and `useWords` fields written by pmg-pro.js.
 *  - Pack -> Template -> dynamic variable form drilldown renders
 *    one input per [BRACKETED] variable.
 *  - Generate Master Prompt fills the template AND appends the
 *    brand-rules SYSTEM INSTRUCTION block.
 *  - View Final Prompt | View AI Analysis toggle swaps content
 *    (and updates aria-pressed correctly).
 *  - Save to Vault appends an entry to 'promptmegood:history:v1'
 *    with the {id, savedAt, data:{goal,...}} shape that the Vault
 *    drawer's getLatestVaultItem filter requires.
 */

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";
const VIEWPORT = { width: 1280, height: 800 };

const BV_KEY = "pmg-brand-voice-v1";
const HISTORY_KEY = "promptmegood:history:v1";

type PMGBusinessApi = {
  packs: Array<{
    id: string;
    title: string;
    templates: Array<{ id: string; name: string; template: string; why?: string }>;
  }>;
  loadBrand: () => {
    audience: string;
    tone: string;
    negative: string;
    name: string;
    useWords: string;
  };
  saveBrand: (v: { audience: string; tone: string; negative: string }) => boolean;
  parseVariables: (template: string) => string[];
  fillTemplate: (template: string, values: Record<string, string>) => string;
  buildBrandInjection: (b: {
    audience?: string;
    tone?: string;
    negative?: string;
  }) => string;
};

type WindowWithBusiness = Window & { PMGBusiness?: PMGBusinessApi };

async function gotoBusiness(page: Page) {
  await page.setViewportSize(VIEWPORT);
  await installApiMocks(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
      // Start every test with a clean Business Mode state.
      localStorage.removeItem("pmg-brand-voice-v1");
      localStorage.removeItem("promptmegood:history:v1");
    } catch {}
  });
  await page.goto(BASE_URL + "/app?panel=business");
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {}
  // Business panel mounts via a 200ms poll for #pmgv3-panel-business
  // (pmg-business-mode.js whenPanelReady). Wait for the brand vault
  // to render, which is the first thing mount() draws.
  await page.waitForSelector("#biz-audience", { timeout: 10_000 });
  // Wait for the panel to actually be active.
  await page.waitForFunction(
    () => document.body.querySelector('[data-active-panel="business"]') !== null
        || document.querySelector('.pmgv3-body[data-active-panel="business"]') !== null,
    null,
    { timeout: 5000 },
  );
}

test.describe("Business Mode workspace", () => {
  test("tab is rendered and ?panel=business activates the panel", async ({
    page,
  }) => {
    await gotoBusiness(page);

    const tab = page.locator('.pmgv3-tab[data-module="business"]');
    await expect(tab).toBeVisible();
    await expect(tab).toContainText(/Business Mode/);

    const panel = page.locator("#pmgv3-panel-business");
    await expect(panel).toBeAttached();
    // The chassis CSS hides inactive panels; the active one is shown.
    await expect(panel.locator("#pmgv3-business-left")).toBeVisible();
  });

  test("PMGBusiness pure helpers parse + fill + inject correctly", async ({
    page,
  }) => {
    await gotoBusiness(page);

    const result = await page.evaluate(() => {
      const api = (window as unknown as WindowWithBusiness).PMGBusiness!;
      const tpl =
        "Help me craft an offer for [PRODUCT/SERVICE]. Audience is [AUDIENCE]. Price is [PRICE]. Bonus: [PRODUCT/SERVICE].";
      const vars = api.parseVariables(tpl);
      const filled = api.fillTemplate(tpl, {
        "PRODUCT/SERVICE": "Acme Widget",
        AUDIENCE: "small business owners",
        // PRICE deliberately left out -> remains as [PRICE]
      });
      const injection = api.buildBrandInjection({
        audience: "founders",
        tone: "punchy",
        negative: "no emojis",
      });
      const emptyInjection = api.buildBrandInjection({});
      return { vars, filled, injection, emptyInjection };
    });

    // Variables are unique + ordered as first-seen.
    expect(result.vars).toEqual(["PRODUCT/SERVICE", "AUDIENCE", "PRICE"]);
    // Filled values substitute every occurrence; missing keys preserve
    // the original [TOKEN] so the user can spot what was skipped.
    expect(result.filled).toContain("Acme Widget");
    expect(result.filled).toContain("small business owners");
    expect(result.filled).toContain("[PRICE]");
    // Brand injection wraps everything in a SYSTEM INSTRUCTION block.
    expect(result.injection).toContain("[SYSTEM INSTRUCTION:");
    expect(result.injection).toContain("audience is founders");
    expect(result.injection).toContain("tone must be punchy");
    expect(result.injection).toContain("STRICT NEGATIVE CONSTRAINTS: no emojis");
    // Empty input -> empty string (no stray block).
    expect(result.emptyInjection).toBe("");
  });

  test("Brand Voice Vault round-trips through localStorage and preserves Pro-only fields", async ({
    page,
  }) => {
    await gotoBusiness(page);

    // Seed Pro-only fields so we can verify they survive a Business save.
    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({ name: "ProBrand", useWords: "delight, ship" }),
      );
    }, BV_KEY);

    await page.fill("#biz-audience", "B2B SaaS founders");
    await page.fill("#biz-tone", "Professional but witty");
    await page.fill("#biz-negative", "Never use buzzwords");
    await page.click("#biz-save-brand");

    // Saved indicator becomes visible.
    await expect(page.locator(".pmg-bv-saved-flag")).toHaveClass(/is-visible/);

    const stored = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, BV_KEY);

    expect(stored).toMatchObject({
      voice: "Professional but witty",
      audience: "B2B SaaS founders",
      avoidWords: "Never use buzzwords",
      // Pro-only fields preserved untouched
      name: "ProBrand",
      useWords: "delight, ship",
    });

    // loadBrand surfaces the Vault values back via the public API.
    const loaded = await page.evaluate(() => {
      return (window as unknown as WindowWithBusiness).PMGBusiness!.loadBrand();
    });
    expect(loaded.audience).toBe("B2B SaaS founders");
    expect(loaded.tone).toBe("Professional but witty");
    expect(loaded.negative).toBe("Never use buzzwords");
    expect(loaded.name).toBe("ProBrand");
    expect(loaded.useWords).toBe("delight, ship");
  });

  test("Pack -> template drilldown renders one input per [BRACKETED] variable", async ({
    page,
  }) => {
    await gotoBusiness(page);

    // Pick the Entrepreneur pack -> Offer Creation template.
    await page.click('.pmg-business-pack[data-pack="entrepreneur"]');
    await page.waitForSelector(
      '.pmg-business-template-item[data-template="offer-creation"]',
      { timeout: 3000 },
    );
    await page.click(
      '.pmg-business-template-item[data-template="offer-creation"]',
    );
    await page.waitForSelector("#biz-generate-prompt", { timeout: 3000 });

    // Offer Creation template:
    //   "Help me craft an irresistible offer for [PRODUCT/SERVICE].
    //    Target audience is [AUDIENCE]. Price point is [PRICE]. ..."
    const ids = await page.$$eval(
      ".pmg-business-execution input, .pmg-business-execution textarea",
      (els) => els.map((e) => (e as HTMLElement).id),
    );
    // slugify("PRODUCT/SERVICE") -> "product-service", "AUDIENCE" -> "audience", "PRICE" -> "price"
    expect(ids).toEqual(
      expect.arrayContaining(["var-product-service", "var-audience", "var-price"]),
    );
    expect(ids.length).toBe(3);
  });

  test("Generate Master Prompt fills the template and appends brand rules", async ({
    page,
  }) => {
    await gotoBusiness(page);

    // Save brand voice first so the injection has content.
    await page.fill("#biz-audience", "indie founders");
    await page.fill("#biz-tone", "warm and direct");
    await page.fill("#biz-negative", "no marketing fluff");
    await page.click("#biz-save-brand");

    await page.click('.pmg-business-pack[data-pack="entrepreneur"]');
    await page.waitForSelector(
      '.pmg-business-template-item[data-template="offer-creation"]',
    );
    await page.click(
      '.pmg-business-template-item[data-template="offer-creation"]',
    );
    await page.waitForSelector("#biz-generate-prompt");

    await page.fill("#var-product-service", "Acme Widget");
    await page.fill("#var-audience", "indie founders");
    await page.fill("#var-price", "$49/mo");

    await page.click("#biz-generate-prompt");

    const finalPrompt = await page
      .locator(".pmg-business-result-box")
      .textContent();
    expect(finalPrompt).toBeTruthy();
    expect(finalPrompt!).toContain("Acme Widget");
    expect(finalPrompt!).toContain("indie founders");
    expect(finalPrompt!).toContain("$49/mo");
    // No raw [TOKEN] should leak through when all 3 inputs are filled.
    expect(finalPrompt!).not.toMatch(/\[(PRODUCT\/SERVICE|AUDIENCE|PRICE)\]/);
    // Brand-rules block appended.
    expect(finalPrompt!).toContain("[SYSTEM INSTRUCTION:");
    expect(finalPrompt!).toContain("audience is indie founders");
    expect(finalPrompt!).toContain("tone must be warm and direct");
    expect(finalPrompt!).toContain(
      "STRICT NEGATIVE CONSTRAINTS: no marketing fluff",
    );
  });

  test("View Final Prompt | View AI Analysis toggle swaps content", async ({
    page,
  }) => {
    await gotoBusiness(page);

    await page.click('.pmg-business-pack[data-pack="entrepreneur"]');
    await page.click(
      '.pmg-business-template-item[data-template="offer-creation"]',
    );
    await page.waitForSelector("#biz-generate-prompt");
    await page.fill("#var-product-service", "X");
    await page.fill("#var-audience", "Y");
    await page.fill("#var-price", "Z");
    await page.click("#biz-generate-prompt");

    const finalBtn = page.locator(
      '.pmg-business-quality-toggle [data-view="final"]',
    );
    const analysisBtn = page.locator(
      '.pmg-business-quality-toggle [data-view="analysis"]',
    );
    const resultBox = page.locator(".pmg-business-result-box");
    const analysisBox = page.locator(".pmg-business-analysis-box");

    // Default: Final visible, Analysis hidden, aria-pressed reflects state.
    await expect(finalBtn).toHaveAttribute("aria-pressed", "true");
    await expect(analysisBtn).toHaveAttribute("aria-pressed", "false");
    await expect(resultBox).toBeVisible();
    await expect(analysisBox).toBeHidden();

    // Switch to Analysis.
    await analysisBtn.click();
    await expect(analysisBtn).toHaveAttribute("aria-pressed", "true");
    await expect(finalBtn).toHaveAttribute("aria-pressed", "false");
    await expect(analysisBox).toBeVisible();
    await expect(resultBox).toBeHidden();
    await expect(analysisBox).toContainText(/Why this prompt is powerful/);

    // Switch back to Final.
    await finalBtn.click();
    await expect(resultBox).toBeVisible();
    await expect(analysisBox).toBeHidden();
  });

  test("Save to Vault appends an entry with the correct vault contract", async ({
    page,
  }) => {
    await gotoBusiness(page);

    await page.click('.pmg-business-pack[data-pack="entrepreneur"]');
    await page.click(
      '.pmg-business-template-item[data-template="offer-creation"]',
    );
    await page.waitForSelector("#biz-generate-prompt");
    await page.fill("#var-product-service", "Acme Widget");
    await page.fill("#var-audience", "indie founders");
    await page.fill("#var-price", "$49/mo");
    await page.click("#biz-generate-prompt");

    // Click Save to Vault (it's the 2nd action button in the row).
    await page.click('.pmg-business-result-actions button:has-text("Save to Vault")');

    // Wait for the success label to flip.
    await expect(
      page.locator('.pmg-business-result-actions button:has-text("Saved to Vault")'),
    ).toBeVisible({ timeout: 2000 });

    const entries = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, HISTORY_KEY);

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBe(1);
    const entry = entries[0];
    // Required shape for the Vault drawer's getLatestVaultItem filter
    // (i.data && i.data.goal).
    expect(entry).toHaveProperty("id");
    expect(typeof entry.id).toBe("string");
    expect(entry.id).toMatch(/^biz-/);
    expect(entry).toHaveProperty("savedAt");
    expect(typeof entry.savedAt).toBe("number");
    expect(entry).toHaveProperty("data");
    expect(typeof entry.data).toBe("object");
    expect(entry.data).toHaveProperty("goal");
    expect(typeof entry.data.goal).toBe("string");
    expect(entry.data.goal).toContain("Offer Creation");
    expect(entry.data).toHaveProperty("prompt");
    expect(entry.data.prompt).toContain("Acme Widget");
    expect(entry.data.category).toBe("business");
    expect(entry.data.template).toBe("offer-creation");
    expect(entry.source).toBe("business-mode");
    // NOTE: a UI-level assertion that the saved entry surfaces in the
    // chassis Vault drawer cannot be added today — app.html's
    // renderHistory() lives inside an IIFE and is not exposed on
    // window, and there is no pmg:vault-saved listener that triggers
    // a re-render of the reparented #history list. See follow-up
    // task #146 for the production fix; once landed, this spec
    // should be extended to open the drawer and assert visibility.
  });
});
