const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const out = process.env.NSURE_SCREENSHOT_DIR || os.tmpdir();
(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.NSURE_BASE_URL || "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page
    .getByRole("heading", { name: "A good day to make a difference." })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "nsure-dashboard.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search records" })
    .pressSequentially("Amara");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search records" }).fill("");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Full name").fill("Dineo Motsumi");
  await page.getByLabel("Email address").fill("dineo@example.com");
  await page.getByLabel("Phone number").fill("+267 71 555 111");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add customer" })
    .click();
  await page.getByRole("button", { name: "View Dineo Motsumi" }).waitFor();
  await page.getByRole("link", { name: /Applications/ }).click();
  await page.getByRole("button", { name: "New application" }).click();
  await page.getByRole("combobox", { name: "Customer", exact: true }).click();
  await page
    .getByRole("option", { name: "Dineo Motsumi", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("combobox", { name: "Product", exact: true }).click();
  await page
    .getByRole("option", { name: "Family Funeral", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.getByRole("button", { name: "View APP-2049" }).click();
  await page
    .getByRole("button", { name: "Simulate underwriting acceptance" })
    .click();
  await page.getByRole("button", { name: "Simulate policy issue" }).click();
  await page
    .getByRole("dialog")
    .getByText("POL-10843", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Policies", exact: true }).click();
  await page.getByRole("button", { name: "View POL-10843" }).waitFor();
  await page.getByRole("link", { name: "Claims", exact: true }).click();
  await page.getByRole("button", { name: "View CLM-0841" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Simulate approval" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate evidence received" })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Simulate approval" }).click();
  await page.getByRole("button", { name: "Simulate settlement" }).click();
  await page
    .getByRole("dialog")
    .getByText("Settled", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Group schemes", exact: true }).click();
  await page.getByRole("button", { name: "Demo census import" }).click();
  await page.getByRole("button", { name: /Try a sample census file/ }).click();
  await page.getByText("Unknown category", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Finish preview" }).click();
  await page.getByRole("link", { name: /AI assistant/ }).click();
  await page.getByRole("button", { name: /Summarize an application/ }).click();
  await page.getByText(/Source: seeded demo application APP-2048/).waitFor();
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Quote Family Funeral" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Product", exact: true })
      .textContent(),
    "Family Funeral",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("BWP 185", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  await dl;
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(out, "nsure-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile horizontal overflow",
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page
    .getByRole("heading", { name: "People, not just policy numbers." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Customer mobile overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login; multi-character search; customer creation; application to policy; evidence/claim/settlement; census; scripted AI; product defaults; CSV; mobile navigation; no runtime errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
