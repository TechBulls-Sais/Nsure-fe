const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.NSURE_BASE_URL || "http://127.0.0.1:5173");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    await page
      .getByRole("button", { name: "New application", exact: true })
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const product = page.getByRole("combobox", {
      name: "Product",
      exact: true,
    });
    await product.click();
    await page
      .getByRole("option", { name: "Family Funeral", exact: true })
      .click();
    assert.equal(await product.textContent(), "Family Funeral");
    await page.getByText("BWP 185", { exact: false }).waitFor();
    await product.click();
    assert.equal(
      await page
        .getByRole("option", { name: "Family Funeral", exact: true })
        .getAttribute("data-state"),
      "checked",
    );
    assert.equal(
      await page
        .getByRole("listbox")
        .evaluate((el) => getComputedStyle(el).borderRadius),
      "12px",
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-dropdown-desktop.png"),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(product).toBeFocused();
    await product.press("ArrowDown");
    await expect(
      page.getByRole("option", { name: "Family Funeral", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await expect(
      page.getByRole("option", { name: "Term Life", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("option", { name: "Whole of Life", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    assert.equal(await product.textContent(), "Whole of Life");
    await page.getByText("BWP 680", { exact: false }).waitFor();
    await product.click();
    await expect(page.getByRole("option", { name: "Whole of Life", exact: true })).toBeFocused();
    const headingBox = await page.locator(".modal-body h3").boundingBox();
    await page.mouse.move(headingBox.x + 20, headingBox.y + 10, { steps: 8 });
    await page.mouse.click(headingBox.x + 20, headingBox.y + 10);
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await product.click();
    const box = await page.getByRole("listbox").boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390, "Menu fits mobile width");
    assert(box.y >= 0 && box.y + box.height <= 844, "Menu fits mobile height");
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-dropdown-mobile.png"),
      fullPage: false,
    });
    await page.getByRole("option", { name: "Care Cash", exact: true }).click();
    assert.equal(await product.textContent(), "Care Cash");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("link", { name: "Claims", exact: true }).click();
    await page
      .getByRole("button", { name: "Register claim", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Product", exact: true }).click();
    await page
      .getByRole("option", { name: "Family Funeral", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Benefit type", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Funeral benefit", exact: true })
      .click();
    await page
      .getByLabel("Claimed amount (BWP)", { exact: true })
      .fill("25000");
    await page.getByLabel("Event date", { exact: true }).fill("2026-09-20");
    await page
      .getByLabel("Brief description", { exact: true })
      .fill("Test fictional claim");
    await page.getByRole("button", { name: "Register demo claim" }).click();
    const row = page.getByRole("row").filter({ hasText: "CLM-843" });
    await row.getByText("Family Funeral", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "View CLM-843", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByText("Funeral benefit", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: styled options, selected state, mouse/keyboard selection, premium synchronization, Escape/focus return, outside dismissal, mobile collision handling, and FormData submission.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
