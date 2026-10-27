const { chromium, expect } = require("@playwright/test");
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
    page.on("pageerror", (error) => errors.push(error.message));
    const base = process.env.NSURE_BASE_URL || "http://127.0.0.1:5173";
    const out = process.env.NSURE_SCREENSHOT_DIR || os.tmpdir();
    await page.goto(base);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Life happens.",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#lp-main")).toBeFocused();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(
      page
        .locator("#portal-links")
        .getByRole("link", { name: /Customer login/ }),
    ).toBeVisible();
    await page
      .locator("#portal-links")
      .getByRole("link", { name: /Admin login/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Admin sign-in" }),
    ).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAttribute(
      "placeholder",
      "admin",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Admin sign-in" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Customer", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Customer sign-in" }),
    ).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAttribute(
      "placeholder",
      "customer",
    );
    await page.getByRole("link", { name: "Back to Nsure" }).click();
    await page
      .getByRole("link", { name: "Customer login", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Customer sign-in" }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Life happens.",
    );
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Admin", exact: true }),
    ).toBeFocused();
    await expect(page.locator("#portal-links")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Find your cover", exact: true })
      .click();
    for (const name of ["Term Life", "Family Funeral", "Care Cash"]) {
      const button = page.getByRole("button", {
        name: `Explore ${name}`,
        exact: true,
      });
      await button.focus();
      await page.keyboard.press("Enter");
      const card = page.getByRole("article", { name, exact: true });
      await expect(
        card.getByRole("link", { name: "View in customer portal" }),
      ).toBeFocused();
      await card.getByRole("button", { name: `Back to ${name}` }).click();
      await expect(button).toBeFocused();
    }
    const faq = page.getByRole("button", {
      name: "What do I need before I can buy cover?",
    });
    await faq.click();
    await expect(faq).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#answer-2")).toBeVisible();
    await faq.click();
    await expect(page.locator("#answer-2")).toBeHidden();
    await page
      .getByRole("button", { name: "Pause interface animations" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.goto(base + "/#/home");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.screenshot({
      path: path.join(out, "nsure-landing-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow at ${width}px`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.locator("#portal-links")).toBeVisible();
    const box = await page.locator("#portal-links").boundingBox();
    assert(
      box.x >= 0 && box.x + box.width <= 390,
      "Mobile admin dropdown must fit viewport",
    );
    await page
      .locator("#portal-links")
      .getByRole("link", { name: /Customer login/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Customer sign-in" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to Nsure" }).click();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "How it works", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("link", { name: "Back to top" }).click();
    await page.screenshot({
      path: path.join(out, "nsure-landing-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log(
      "Landing checks passed: login routes, keyboard focus, flip cards, FAQ, mobile navigation, responsive bounds, reduced motion.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
