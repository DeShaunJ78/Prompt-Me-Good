import { test, expect } from "@playwright/test";

const VIEWPORT_WIDTH = 360;
const TOLERANCE_PX = 1;

const PAGES: { name: string; path: string }[] = [
  { name: "homepage", path: "/" },
];

type Offender = {
  selector: string;
  tag: string;
  cls: string;
  id: string;
  rectRight: number;
  rectWidth: number;
  text: string;
};

async function dismissOnboarding(page: import("@playwright/test").Page) {
  const tourSkip = page.locator("#tour-skip");
  try {
    if (await tourSkip.isVisible({ timeout: 1500 })) {
      await tourSkip.click({ timeout: 1500 });
    }
  } catch {
  }
}

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
  }
  await page.waitForTimeout(500);
}

for (const { name, path } of PAGES) {
  test.describe(`horizontal overflow @ ${VIEWPORT_WIDTH}px (${name})`, () => {
    test(`${name} does not overflow viewport horizontally`, async ({
      page,
    }) => {
      await page.goto(path);
      await settle(page);
      await dismissOnboarding(page);
      await page.waitForTimeout(400);

      const measurements = await page.evaluate(() => {
        return {
          viewportWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          docClientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
          bodyOverflowX: document.body
            ? getComputedStyle(document.body).overflowX
            : "",
          htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
        };
      });

      const offenders: Offender[] = await page.evaluate((vw) => {
        const out: Offender[] = [];
        const all = document.querySelectorAll<HTMLElement>("body *");
        const seen = new Set<HTMLElement>();
        for (const el of Array.from(all)) {
          if (seen.has(el)) continue;
          const style = getComputedStyle(el);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            parseFloat(style.opacity || "1") === 0
          ) {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (rect.right <= vw + 1) continue;

          let clipped = false;
          let parent: HTMLElement | null = el.parentElement;
          while (parent && parent !== document.body) {
            const ps = getComputedStyle(parent);
            if (
              ps.overflowX === "hidden" ||
              ps.overflowX === "clip" ||
              ps.overflow === "hidden" ||
              ps.overflow === "clip" ||
              ps.overflow === "scroll" ||
              ps.overflow === "auto" ||
              ps.overflowX === "scroll" ||
              ps.overflowX === "auto"
            ) {
              const pr = parent.getBoundingClientRect();
              if (pr.right <= vw + 1) {
                clipped = true;
                break;
              }
            }
            parent = parent.parentElement;
          }
          if (clipped) continue;

          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls =
            el.className && typeof el.className === "string"
              ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
              : "";
          const selector = `${tag}${id}${cls}`;
          out.push({
            selector,
            tag,
            cls: typeof el.className === "string" ? el.className : "",
            id: el.id,
            rectRight: Math.round(rect.right * 100) / 100,
            rectWidth: Math.round(rect.width * 100) / 100,
            text: (el.textContent || "").trim().slice(0, 60),
          });
          if (out.length >= 25) break;
        }
        return out;
      }, measurements.viewportWidth);

      const scrollOverflow =
        measurements.docScrollWidth - measurements.viewportWidth;
      const hasScrollOverflow = scrollOverflow > TOLERANCE_PX;
      const hasOffenders = offenders.length > 0;
      const hasBandaid =
        measurements.bodyOverflowX === "hidden" ||
        measurements.htmlOverflowX === "hidden";

      if (hasScrollOverflow || hasOffenders || hasBandaid) {
        const lines: string[] = [];
        lines.push("");
        lines.push("=== Horizontal overflow check FAILED ===");
        lines.push(`Page: ${name} (${path})`);
        lines.push(`Viewport width:              ${measurements.viewportWidth}px`);
        lines.push(`documentElement.scrollWidth: ${measurements.docScrollWidth}px`);
        lines.push(
          `Scroll overflow (excess):    ${scrollOverflow}px (tolerance ${TOLERANCE_PX}px) ${hasScrollOverflow ? "← TRIGGERED" : ""}`,
        );
        lines.push(
          `html overflow-x: ${measurements.htmlOverflowX} | body overflow-x: ${measurements.bodyOverflowX} ${hasBandaid ? "← BAND-AID DETECTED" : ""}`,
        );
        lines.push("");

        if (hasOffenders) {
          lines.push(
            `Offending elements (right edge > viewport, ${offenders.length} shown, max 25):`,
          );
          for (const o of offenders) {
            lines.push(
              `  - ${o.selector}  right=${o.rectRight}px width=${o.rectWidth}px${o.text ? `  text="${o.text}"` : ""}`,
            );
          }
        } else if (hasScrollOverflow) {
          lines.push(
            "No individual offenders found, but documentElement.scrollWidth still exceeds the viewport.",
          );
          lines.push(
            "Likely causes: a transformed/fixed element extending right; a pseudo-element (::before/::after); a too-wide background-image; a margin/padding leak on <html>/<body>.",
          );
        }

        lines.push("");
        lines.push("Fix guidance:");
        lines.push(
          "  - Constrain element widths; add `min-width: 0` to flex items that contain wide content.",
        );
        lines.push(
          "  - Use `overflow-wrap: anywhere` for long unbreakable strings (URLs, IDs).",
        );
        lines.push(
          "  - Avoid stray absolutely-positioned inputs/icons sitting outside the viewport.",
        );
        lines.push(
          "  - Do NOT add `overflow-x: hidden` to <body> or <html> as a band-aid — it hides the symptom and breaks sticky positioning.",
        );

        const message = lines.join("\n");
        console.error(message);
        throw new Error(message);
      }

      expect(
        measurements.docScrollWidth,
        `documentElement.scrollWidth (${measurements.docScrollWidth}px) should be <= viewport width (${measurements.viewportWidth}px) within ${TOLERANCE_PX}px`,
      ).toBeLessThanOrEqual(measurements.viewportWidth + TOLERANCE_PX);
      expect(
        offenders.length,
        "no element's right edge should extend past the viewport (after skipping ones clipped by an overflow-controlled ancestor)",
      ).toBe(0);
      expect(
        measurements.bodyOverflowX,
        "body must not use `overflow-x: hidden` as a band-aid for horizontal overflow (it hides the underlying bug and breaks sticky positioning)",
      ).not.toBe("hidden");
      expect(
        measurements.htmlOverflowX,
        "html must not use `overflow-x: hidden` as a band-aid for horizontal overflow",
      ).not.toBe("hidden");
    });
  });
}
