// Workspace interaction check against the running app (backend with demo data on 8091, `npm run dev` on 5180):
// the ⌘K / Ctrl+K command palette (keyboard and button), the colour theme switch, the reduced-motion preference and
// the mobile layout. It only reads.
const assert = require("node:assert/strict");
const { assertFits, assertNoErrors, expect, openPage, run, screenshot, signInStaff } = require("./smoke-support.cjs");

run("command palette (keyboard and button), theme switch, reduced motion, mobile layout", async (browser) => {
  const page = await openPage(browser);
  await signInStaff(page, "admin");
  await expect(page.getByRole("heading", { level: 1, name: /A good day to make a difference/ })).toBeVisible();

  // Ctrl+K opens the palette; typing filters it and Enter opens the first match.
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("combobox", { name: "Search workspace actions" });
  await expect(palette).toBeFocused();
  await palette.fill("work queue");
  await expect(page.getByRole("option", { name: /Work queue/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Work queue" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The launcher button opens it too; nothing matches nonsense, and Escape closes it.
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByRole("combobox", { name: "Search workspace actions" }).fill("impossible match");
  await expect(page.getByText(/No matching actions/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Colour theme: the switch sets data-theme on <html>.
  const themes = page.getByRole("radiogroup", { name: "Colour theme" });
  await themes.getByRole("radio", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await screenshot(page, "nsure-intelligence-dark.png");
  await themes.getByRole("radio", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Animation follows the operating system's reduced-motion setting, also when it changes while the app is open.
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

  await assertFits(page, 390, "Work queue");
  await page.getByRole("button", { name: "Open command palette" }).click();
  const box = await page.getByRole("dialog").boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390, "The command palette fits a phone");
  await page.keyboard.press("Escape");
  await screenshot(page, "nsure-intelligence-mobile.png");
  assertNoErrors(page);
});
