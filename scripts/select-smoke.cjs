// Themed dropdown (Radix Select) check against the running app (backend with demo data on 8091, `npm run dev` on
// 5180), in the New application form: opening, the selected checkmark state, keyboard choice, Escape returning focus
// without closing the dialog, a click outside, and the menu staying on screen on a phone. The form is cancelled, so
// nothing is saved.
const assert = require("node:assert/strict");
const { assertNoErrors, expect, openPage, run, screenshot, signInStaff } = require("./smoke-support.cjs");

run("dropdown: open, selected state, keyboard and mouse choice, Escape and focus, outside click, phone bounds", async (browser) => {
  const page = await openPage(browser, { reducedMotion: "reduce" });
  await signInStaff(page, "admin");
  await page.getByRole("button", { name: "New application", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Who are we looking after?" })).toBeVisible();

  // Customer: the open menu marks the current choice; Escape closes the menu, not the dialog.
  const customer = dialog.getByRole("combobox", { name: "Customer", exact: true });
  await customer.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const options = listbox.getByRole("option");
  assert((await options.count()) >= 2, "The demo data has at least two customers");
  await expect(listbox.locator('[role="option"][data-state="checked"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toHaveCount(1);
  await expect(customer).toBeFocused();

  // Keyboard: open, move down one, choose. The trigger shows the choice.
  await customer.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  const second = (await page.getByRole("listbox").getByRole("option").nth(1).textContent()).trim();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(customer).toHaveText(second);

  // Product (next step): a mouse choice, then a click outside closes the menu but keeps the dialog.
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  const product = dialog.getByRole("combobox", { name: "Product", exact: true });
  await product.click();
  const products = page.getByRole("listbox").getByRole("option");
  const last = (await products.last().textContent()).trim();
  await products.last().click();
  await expect(product).toHaveText(last);
  await product.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await screenshot(page, "nsure-dropdown-desktop.png");
  const heading = await dialog.getByRole("heading", { name: "A little protection goes a long way." }).boundingBox();
  await page.mouse.click(heading.x + 10, heading.y + 5);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toHaveCount(1);

  // Phone: the open menu stays inside the screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await product.click();
  const box = await page.getByRole("listbox").boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390, "Menu fits the phone's width");
  assert(box.y >= 0 && box.y + box.height <= 844, "Menu fits the phone's height");
  await screenshot(page, "nsure-dropdown-mobile.png");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assertNoErrors(page);
});
