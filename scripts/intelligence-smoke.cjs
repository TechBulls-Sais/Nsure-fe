const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.NSURE_BASE_URL || "http://127.0.0.1:5173");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    await page
      .getByRole("button", { name: "Pause interface animations" })
      .click();
    assert.equal(await page.locator("html").getAttribute("data-motion"), "off");
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-intelligence-dashboard.png"),
      fullPage: true,
    });
    await page.keyboard.press("Control+k");
    await page
      .getByRole("combobox", { name: "Search workspace actions" })
      .fill("product studio");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.getByText("From an idea to a ready-to-review product.").waitFor();
    await page
      .getByRole("button", { name: "Enable interface animations" })
      .click();
    assert.equal(await page.locator("html").getAttribute("data-motion"), "on");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => document.documentElement.dataset.motion === "off",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Workspace fits mobile",
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-intelligence-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open command palette" }).click();
    await page
      .getByRole("combobox", { name: "Search workspace actions" })
      .fill("impossible match");
    await page.getByText(/No matching actions/).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: keyboard command palette, motion toggle, reduced-motion preference, mobile layout, and no runtime errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
