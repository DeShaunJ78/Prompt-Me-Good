import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.PMG_BASE_URL ?? "http://localhost:80";

type UndoApi = {
  push: (entry: { undo: () => void; redo: () => void; label?: string }) => void;
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getStack: () => Array<{ label?: string }>;
  getCursor: () => number;
  _pipId: string;
};

type Win = Window & {
  __pmgUndo?: UndoApi;
  __pmgText?: { setPromptText: (s: string) => void };
  setMode?: (m: string) => void;
};

async function gotoApp(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("promptmegood:tour:v1:done", "1");
      sessionStorage.setItem("promptmegood:t42-banner-dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as Win).__pmgUndo,
    undefined,
    { timeout: 10_000 },
  );
  /* Skip the inactivity assist if it surfaces. */
  const skip = page.locator("#tour-skip");
  try {
    if (await skip.isVisible({ timeout: 500 })) await skip.click({ timeout: 500 });
  } catch {
    /* nothing to dismiss */
  }
  /* Always start tests with an empty stack so previous app activity
     (boot-time setMode/pill init from other modules) doesn't leak. */
  await page.evaluate(() => {
    (window as unknown as Win).__pmgUndo!.clear();
  });
}

test.describe("Global undo stack @ mobile-360", () => {
  test("public API surface and bare push/undo/redo work", async ({ page }) => {
    await gotoApp(page);
    const result = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgUndo!;
      const log: string[] = [];
      api.push({
        label: "test op",
        undo: () => log.push("undo:1"),
        redo: () => log.push("redo:1"),
      });
      const beforeUndo = { canUndo: api.canUndo(), canRedo: api.canRedo(), cursor: api.getCursor() };
      api.undo();
      const afterUndo = { canUndo: api.canUndo(), canRedo: api.canRedo(), cursor: api.getCursor() };
      api.redo();
      const afterRedo = { canUndo: api.canUndo(), canRedo: api.canRedo(), cursor: api.getCursor() };
      return { log, beforeUndo, afterUndo, afterRedo, stackLen: api.getStack().length };
    });
    expect(result.log).toEqual(["undo:1", "redo:1"]);
    expect(result.beforeUndo).toEqual({ canUndo: true, canRedo: false, cursor: 1 });
    expect(result.afterUndo).toEqual({ canUndo: false, canRedo: true, cursor: 0 });
    expect(result.afterRedo).toEqual({ canUndo: true, canRedo: false, cursor: 1 });
    expect(result.stackLen).toBe(1);
  });

  test("Cmd/Ctrl+Z undoes a setPromptText edit and shows the pip", async ({ page }) => {
    await gotoApp(page);
    /* Drive a real prompt edit through the wrapped bridge. */
    const initialText = await page.evaluate(() => {
      const rb = document.getElementById("resultBox");
      const original = (rb?.textContent || "").replace(/\u00A0/g, " ");
      (window as unknown as Win).__pmgText!.setPromptText("First version of the prompt");
      return original;
    });
    await expect(page.locator("#resultBox")).toHaveText("First version of the prompt");

    const isMac = await page.evaluate(() =>
      /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    );
    /* Send the keyboard chord from outside the contenteditable result
       box — page-level focus, not inside the editor. */
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(isMac ? "Meta+KeyZ" : "Control+KeyZ");

    /* Result box reverts to original text. */
    await expect(page.locator("#resultBox")).toHaveText(initialText);
    /* Pip indicator shows up. */
    const pip = page.locator("#pmg-undo-pip");
    await expect(pip).toBeVisible();
    await expect(pip).toContainText(/Undid/);

    /* Redo via Shift+Cmd+Z (mac) or Ctrl+Y (others). */
    if (isMac) {
      await page.keyboard.press("Shift+Meta+KeyZ");
    } else {
      await page.keyboard.press("Control+KeyY");
    }
    await expect(page.locator("#resultBox")).toHaveText("First version of the prompt");
    await expect(pip).toContainText(/Redid/);
  });

  test("mode switches are undoable across both modes", async ({ page }) => {
    await gotoApp(page);
    /* Image -> Write -> Image, expecting undo to walk back two steps. */
    await page.evaluate(() => (window as unknown as Win).setMode!("image"));
    await page.evaluate(() => (window as unknown as Win).setMode!("write"));
    await page.evaluate(() => (window as unknown as Win).setMode!("image"));
    expect(await page.evaluate(() => document.body.classList.contains("image-mode"))).toBe(true);

    const stackLen = await page.evaluate(
      () => (window as unknown as Win).__pmgUndo!.getStack().length,
    );
    expect(stackLen).toBe(3);

    /* Programmatic undo (avoids any keyboard plumbing surprises). */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    expect(await page.evaluate(() => document.body.classList.contains("image-mode"))).toBe(false);
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    expect(await page.evaluate(() => document.body.classList.contains("image-mode"))).toBe(true);
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    expect(await page.evaluate(() => document.body.classList.contains("image-mode"))).toBe(false);

    /* Stack/cursor consistent with three undoable items. */
    const after = await page.evaluate(() => {
      const a = (window as unknown as Win).__pmgUndo!;
      return { cursor: a.getCursor(), len: a.getStack().length, canRedo: a.canRedo() };
    });
    expect(after).toEqual({ cursor: 0, len: 3, canRedo: true });
  });

  test("photo pill toggle is captured and undone", async ({ page }) => {
    await gotoApp(page);
    /* Inject a fake photo pill so the test doesn't depend on the
       Photography Suite being scaffolded by any particular code path.
       The undo module's capture-phase listener targets the
       `.pmg-photo-pill` class with `data-group`/`data-value`, exactly
       like the real suite's pills. The bubble-phase handler that
       toggles `.is-active` is what pmg-ux installs on every real pill
       — we replicate it here so a click flips the state. */
    await page.evaluate(() => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "pmg-photo-pill";
      pill.setAttribute("data-group", "style");
      pill.setAttribute("data-value", "Cinematic");
      pill.id = "pmg-test-pill";
      pill.textContent = "Cinematic";
      pill.addEventListener("click", () => {
        pill.classList.toggle("is-active");
      });
      document.body.appendChild(pill);
    });

    /* Activate the pill via a real user click. */
    await page.locator("#pmg-test-pill").click();
    await expect(page.locator("#pmg-test-pill.is-active")).toBeVisible();

    /* Wait for the capture-phase listener's setTimeout(0) snapshot/diff
       to land its entry on the stack. Without this wait the pill
       click may race the undo call. */
    await page.waitForFunction(
      () => (window as unknown as Win).__pmgUndo!.getStack().length >= 1,
      undefined,
      { timeout: 2000 },
    );

    /* Undo should remove .is-active. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    await expect(page.locator("#pmg-test-pill.is-active")).toHaveCount(0);

    /* Redo restores it. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.redo());
    await expect(page.locator("#pmg-test-pill.is-active")).toBeVisible();
  });

  test("new push truncates pending redo branch", async ({ page }) => {
    await gotoApp(page);
    const result = await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgUndo!;
      const trail: string[] = [];
      api.push({ label: "A", undo: () => trail.push("u:A"), redo: () => trail.push("r:A") });
      api.push({ label: "B", undo: () => trail.push("u:B"), redo: () => trail.push("r:B") });
      api.undo(); /* trail += u:B, cursor 1, B is redoable */
      const beforePush = { len: api.getStack().length, cursor: api.getCursor(), canRedo: api.canRedo() };
      api.push({ label: "C", undo: () => trail.push("u:C"), redo: () => trail.push("r:C") });
      const afterPush = { len: api.getStack().length, cursor: api.getCursor(), canRedo: api.canRedo() };
      /* B should be gone — only A and C remain. */
      const labels = api.getStack().map((e) => e.label);
      return { trail, beforePush, afterPush, labels };
    });
    expect(result.trail).toEqual(["u:B"]);
    expect(result.beforePush).toEqual({ len: 2, cursor: 1, canRedo: true });
    expect(result.afterPush).toEqual({ len: 2, cursor: 2, canRedo: false });
    expect(result.labels).toEqual(["A", "C"]);
  });

  test("undo is a no-op while typing in an editable field (lets browser handle it)", async ({
    page,
  }) => {
    await gotoApp(page);
    /* Push one entry so undo() WOULD have something to do if called. */
    await page.evaluate(() => {
      const api = (window as unknown as Win).__pmgUndo!;
      api.push({
        label: "guarded",
        undo: () => {
          (window as unknown as { __pmgUndoFired?: boolean }).__pmgUndoFired = true;
        },
        redo: () => {
          /* noop */
        },
      });
    });

    /* Focus the goal textarea (a real input on the page) and press the
       chord. Our handler must NOT fire because the user is typing. */
    const goal = page.locator("#goal");
    await goal.click();
    await goal.fill("Some draft text");
    const isMac = await page.evaluate(() =>
      /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    );
    await page.keyboard.press(isMac ? "Meta+KeyZ" : "Control+KeyZ");

    const fired = await page.evaluate(
      () => !!(window as unknown as { __pmgUndoFired?: boolean }).__pmgUndoFired,
    );
    expect(fired).toBe(false);
    /* Stack still has the entry — cursor unchanged. */
    expect(
      await page.evaluate(() => (window as unknown as Win).__pmgUndo!.getCursor()),
    ).toBe(1);
  });

  test("image generation snapshots restore wrap markup AND download-button state", async ({
    page,
  }) => {
    await gotoApp(page);

    /* Mutate #imageResultWrap directly to simulate an image generation
       — the MutationObserver fires on any childList mutation that
       lands a real <img>. We pair it with the same #imageDownloadBtn
       flips that pmg-image-fix.js performs in production so the
       snapshot has something to roll back. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap");
      const dl = document.getElementById("imageDownloadBtn") as HTMLAnchorElement | null;
      if (!wrap || !dl) throw new Error("missing image targets");
      wrap.innerHTML =
        '<img src="https://example.invalid/v1.png" alt="v1" style="max-width:100%">';
      dl.setAttribute("href", "https://example.invalid/v1.png");
      dl.style.display = "inline-flex";
      dl.className = "btn btn-primary pmg-ready";
    });

    /* Wait for the observer + microtask chain to push the entry. */
    await page.waitForFunction(
      () => (window as unknown as Win).__pmgUndo!.getStack().length >= 1,
      undefined,
      { timeout: 2000 },
    );

    /* Now do a "second generation" so undo has somewhere to roll back to. */
    await page.evaluate(() => {
      const wrap = document.getElementById("imageResultWrap")!;
      const dl = document.getElementById("imageDownloadBtn") as HTMLAnchorElement;
      wrap.innerHTML =
        '<img src="https://example.invalid/v2.png" alt="v2" style="max-width:100%">';
      dl.setAttribute("href", "https://example.invalid/v2.png");
      dl.style.display = "inline-flex";
      dl.className = "btn btn-primary pmg-ready";
    });
    await page.waitForFunction(
      () => (window as unknown as Win).__pmgUndo!.getStack().length >= 2,
      undefined,
      { timeout: 2000 },
    );

    /* Undo: download button should now point at v1, not v2. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    const after = await page.evaluate(() => {
      const dl = document.getElementById("imageDownloadBtn") as HTMLAnchorElement;
      const wrap = document.getElementById("imageResultWrap")!;
      return { href: dl.getAttribute("href"), wrap: wrap.innerHTML };
    });
    expect(after.href).toBe("https://example.invalid/v1.png");
    expect(after.wrap).toContain("v1.png");

    /* Redo: should land back on v2 and the download button follows. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.redo());
    const after2 = await page.evaluate(() => {
      const dl = document.getElementById("imageDownloadBtn") as HTMLAnchorElement;
      const wrap = document.getElementById("imageResultWrap")!;
      return { href: dl.getAttribute("href"), wrap: wrap.innerHTML };
    });
    expect(after2.href).toBe("https://example.invalid/v2.png");
    expect(after2.wrap).toContain("v2.png");
  });

  test("undo / redo do not self-record under suppression", async ({ page }) => {
    await gotoApp(page);
    /* Drive a setMode change through the wrapped API. */
    await page.evaluate(() => (window as unknown as Win).setMode!("image"));
    const startLen = await page.evaluate(
      () => (window as unknown as Win).__pmgUndo!.getStack().length,
    );
    expect(startLen).toBe(1);
    /* Flip back via undo (which calls setMode under suppression). The
       stack length must stay the same — undo must not self-record. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.undo());
    expect(
      await page.evaluate(() => (window as unknown as Win).__pmgUndo!.getStack().length),
    ).toBe(startLen);
    /* Redo: same — no self-record. */
    await page.evaluate(() => (window as unknown as Win).__pmgUndo!.redo());
    expect(
      await page.evaluate(() => (window as unknown as Win).__pmgUndo!.getStack().length),
    ).toBe(startLen);
  });

  test("cheatsheet documents the undo / redo shortcuts", async ({ page }) => {
    await gotoApp(page);
    /* Cheatsheet is gated behind first generation. Open the panel
       directly via the public API to read the rendered key labels. */
    await page.evaluate(() => {
      try {
        localStorage.setItem("pmg_has_generated", "1");
        document.body.classList.add("pmg-has-generated");
      } catch {
        /* ignore */
      }
      const api = (window as unknown as { __pmgShortcuts?: { open: () => void } })
        .__pmgShortcuts;
      if (api && typeof api.open === "function") api.open();
    });
    /* The panel may be opened by any path. If the test surface isn't
       exposed, click the trigger button as a fallback. */
    const panel = page.locator("#pmg-shortcuts-panel");
    if (!(await panel.isVisible().catch(() => false))) {
      const trigger = page.locator("#pmg-shortcuts-trigger");
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.click();
      }
    }
    await expect(panel).toBeVisible();
    /* Both rows are rendered with their human label. */
    await expect(panel).toContainText("Undo Last Change");
    await expect(panel).toContainText("Redo");
  });
});
