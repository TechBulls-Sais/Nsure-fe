// Product studio check against the running app (backend with demo data on 8091, `npm run dev` on 5180): the list of
// configurations with its filters and search, the create wizard's validation, leaving the editor without saving,
// and the phone layout. Nothing is saved.
const { assertFits, assertNoErrors, expect, goTo, openPage, run, screenshot, signInStaff } = require("./smoke-support.cjs");

run("product studio: list, filters, search, wizard validation, discard without saving, phone layout", async (browser) => {
  const page = await openPage(browser);
  await signInStaff(page, "admin");
  await goTo(page, "product-config", "A little configuration. A lot of possibility.");
  await expect(page.getByRole("heading", { name: "Your product configurations" })).toBeVisible();

  // Filters and search narrow the list.
  for (const filter of ["Draft", "In review", "Active", "All"]) {
    await page.getByRole("button", { name: filter, exact: true }).click();
  }
  const search = page.getByRole("textbox", { name: "Search configurations" });
  await search.fill("no product is called this");
  await search.fill("");
  await screenshot(page, "nsure-product-studio.png");

  // The wizard checks the essentials before it moves on.
  await page.getByRole("button", { name: "Create product", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Let’s bring your next product to life." })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert").getByText("Give your product a name.")).toBeVisible();
  await page.getByLabel("Product name", { exact: true }).fill("Smoke check product");
  await page.getByLabel("Product code", { exact: true }).fill("smoke-1");
  await expect(page.getByLabel("Product code", { exact: true })).toHaveValue("SMOKE-1");
  await assertFits(page, 390, "Product wizard");
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Leaving asks first, then discards: nothing was saved.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Leave the editor?")).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "A little configuration. A lot of possibility." })).toBeVisible();
  await search.fill("Smoke check product");
  await expect(page.getByText("Smoke check product")).toHaveCount(0);
  await assertFits(page, 390, "Product studio");
  assertNoErrors(page);
});
