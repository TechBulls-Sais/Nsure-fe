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
    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByRole("button", { name: "Configure products" }).click();
    await page
      .getByRole("button", { name: "Create product", exact: true })
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("alert")
      .getByText("Give your product a name.")
      .waitFor();
    await page
      .getByLabel("Product name", { exact: true })
      .fill("LifeCare Essential");
    await page.getByLabel("Product code", { exact: true }).fill("LC-ESS");
    await page
      .getByLabel("A short description")
      .fill("Flexible protection for a brighter tomorrow.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Minimum entry age").fill("70");
    await page.getByLabel("Maximum entry age").fill("60");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("alert")
      .getByText(/Entry ages must be/)
      .waitFor();
    await page.getByLabel("Minimum entry age").fill("18");
    await page.getByLabel("Maximum entry age").fill("65");
    await page.getByRole("checkbox", { name: /Accidental death/ }).check();
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-product-editor.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Sample premium (BWP)", { exact: true }).fill("350");
    await page
      .getByRole("checkbox", { name: "Customer portal", exact: true })
      .check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page
      .getByRole("alert")
      .getByText("Confirm that these are illustrative settings.")
      .waitFor();
    await page
      .getByRole("checkbox", {
        name: /I understand this is a dummy configuration/,
      })
      .check();
    await page.getByRole("button", { name: "Submit for review" }).click();
    const row = page.getByRole("row").filter({ hasText: "LifeCare Essential" });
    await row.getByText("In review", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: "Configure LifeCare Essential",
        exact: true,
      })
      .click();
    assert.equal(
      await page.getByLabel("Product code", { exact: true }).inputValue(),
      "LC-ESS",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    assert.equal(
      await page
        .getByLabel("Sample premium (BWP)", { exact: true })
        .inputValue(),
      "350",
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: /I understand this is a dummy configuration/,
      })
      .check();
    await page.getByRole("button", { name: "Activate demo" }).click();
    await row.getByText("Demo active", { exact: true }).waitFor();
    await row.getByText("v2.0", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: "Duplicate LifeCare Essential",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "LifeCare Essential copy" })
      .getByText("Draft", { exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page
      .getByRole("link", { name: "Product studio", exact: true })
      .click();
    await page.getByLabel("Search configurations").pressSequentially("LC-ESS");
    assert.equal(await page.locator("tbody tr").count(), 2);
    await page.getByLabel("Search configurations").fill("");
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Studio must fit mobile viewport",
    );
    await page
      .getByRole("button", { name: "Create product", exact: true })
      .click();
    await page.getByLabel("Product name", { exact: true }).fill("Mobile Cover");
    await page.getByLabel("Product code", { exact: true }).fill("TL-ESS");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("alert")
      .getByText("This code is already in use. Choose a unique code.")
      .waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Editor must fit mobile viewport",
    );
    await page.screenshot({
      path: path.join(os.tmpdir(), "nsure-product-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "All configurations" }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: product configuration creation, validation, benefit selection, pricing, review, activation, versioning, duplication, draft save, navigation persistence, search, mobile layout, and discard.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
