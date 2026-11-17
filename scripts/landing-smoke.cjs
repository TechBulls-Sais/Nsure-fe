// Public landing page check against the running app (`npm run dev` on 5180; the backend serves the product cards).
// Covers the skip link, both sign-in entry points and the Admin/Customer switch, the product flip cards, the FAQ,
// reduced motion, responsive bounds and the mobile navigation. Signs nobody in.
const assert = require("node:assert/strict");
const { BASE, assertFits, assertNoErrors, expect, openPage, run, screenshot } = require("./smoke-support.cjs");

run("landing: skip link, sign-in routes, flip cards, FAQ, reduced motion, responsive bounds, mobile navigation", async (browser) => {
  const page = await openPage(browser);
  await page.goto(BASE + "/#/home");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Life happens.");

  // The first Tab reaches the skip link, which moves focus to the main content.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#lp-main")).toBeFocused();

  // Header: Admin login and Customer login lead to their sign-in forms; the switch moves between them.
  const header = page.locator("header.lp-header");
  await header.getByRole("link", { name: /Admin login/ }).click();
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toHaveAttribute("placeholder", "admin");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  await page.locator(".login-switch").getByRole("button", { name: "Customer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Customer sign-in" })).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toHaveAttribute("placeholder", "customer");
  await page.getByRole("link", { name: /Back to Nsure/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Life happens.");
  await header.getByRole("link", { name: /Customer login/ }).click();
  await expect(page.getByRole("heading", { name: "Customer sign-in" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Life happens.");

  // Product cards (from /public/products): Explore flips a card and focuses its action; Back returns focus.
  await page.goto(BASE + "/#/cover");
  const cards = page.locator(".lp-cover-grid article");
  await expect(cards.first(), "product cards (is the backend running with demo products?)").toBeVisible({
    timeout: 15000,
  });
  const count = await cards.count();
  assert(count > 0, "At least one product card");
  for (let i = 0; i < Math.min(count, 3); i++) {
    const name = await cards.nth(i).getAttribute("aria-label");
    const explore = page.getByRole("button", { name: `Explore ${name}`, exact: true });
    await explore.focus();
    await page.keyboard.press("Enter");
    const card = page.getByRole("article", { name, exact: true });
    await expect(card.getByRole("link", { name: /View in customer portal/ })).toBeFocused();
    await card.getByRole("button", { name: `Back to ${name}`, exact: true }).click();
    await expect(explore).toBeFocused();
  }

  // FAQ: a question opens and closes its answer.
  const faq = page.getByRole("button", { name: "What do I need before I can buy cover?" });
  await faq.click();
  await expect(faq).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#answer-2")).toBeVisible();
  await faq.click();
  await expect(page.locator("#answer-2")).toBeHidden();

  // Animation follows the operating system's reduced-motion setting (there is no in-app switch).
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.goto(BASE + "/#/home");
  await screenshot(page, "nsure-landing-desktop.png");
  for (const width of [320, 390, 768, 1024]) {
    await assertFits(page, width, "Landing page");
  }

  // Phone: the menu opens, its links fit the screen, and choosing a section closes it.
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  const menu = page.locator("#landing-navigation");
  const customerLogin = menu.getByRole("link", { name: /Customer login/ });
  await expect(customerLogin).toBeVisible();
  const box = await customerLogin.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390, "Mobile menu links must fit the viewport");
  await menu.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("link", { name: /Back to top/ }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#landing-navigation").getByRole("link", { name: /Customer login/ }).click();
  await expect(page.getByRole("heading", { name: "Customer sign-in" })).toBeVisible();
  await screenshot(page, "nsure-landing-mobile.png");
  assertNoErrors(page);
});
