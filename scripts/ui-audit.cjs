// Read-only visual coverage against the real demo backend. No business records are changed.
// PLAYWRIGHT_CHANNEL=chromium NSURE_SCREENSHOT_DIR=/tmp/nsure-audit node scripts/ui-audit.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");
const { BASE, signInStaff } = require("./smoke-support.cjs");

const OUT =
  process.env.NSURE_SCREENSHOT_DIR || path.join(os.tmpdir(), "nsure-ui-audit");
const routes = [
  "overview",
  "work-queue",
  "customers",
  "applications",
  "underwriting",
  "policies",
  "servicing",
  "credit-life",
  "claims",
  "care-cash",
  "collections",
  "service-desk",
  "communications",
  "schemes",
  "scheme-lifecycle",
  "products",
  "product-config",
  "rate-tables",
  "configuration",
  "finance",
  "distribution",
  "reinsurance",
  "reports",
  "integration",
  "data-assistants",
  "access",
  "controls",
  "settings",
];
const report = { screens: [], errors: [], failures: [] };
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80);

async function settle(page) {
  // Hash navigation can finish before React starts the next screen's requests.
  await page.waitForTimeout(120);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".nk-skeleton:visible")).toHaveCount(0, {
    timeout: 15000,
  });
  await page.evaluate(() => document.fonts.ready);
}

async function inspect(page, name, capture = false) {
  await settle(page);
  const metrics = await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        getComputedStyle(el).visibility !== "hidden" &&
        !el.closest('[aria-hidden="true"], [inert]')
      );
    };
    const elements = [
      ...document.querySelectorAll("main *, dialog[open] *, .customer-shell *"),
    ].filter(visible);
    const directText = (el) =>
      [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
      );
    const small = elements
      .filter(
        (el) =>
          directText(el) && parseFloat(getComputedStyle(el).fontSize) < 12,
      )
      .map((el) => ({
        cls: String(el.className),
        text: el.textContent.trim().slice(0, 65),
        size: getComputedStyle(el).fontSize,
      }));
    const overflow = document.documentElement.scrollWidth > innerWidth + 1;
    return {
      width: innerWidth,
      theme: document.documentElement.dataset.theme,
      overflow,
      small,
      offenders: overflow
        ? elements
            .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 12)
            .map((el) => ({
              cls: String(el.className),
              width: Math.round(el.getBoundingClientRect().width),
            }))
        : [],
      alerts: [...document.querySelectorAll(".ws-error, .rt-error")]
        .filter(visible)
        .map((el) => el.textContent.trim()),
    };
  });
  report.screens.push({ name, ...metrics });
  if (metrics.overflow)
    report.failures.push(name + ": horizontal page overflow");
  if (capture || metrics.overflow) {
    await page.screenshot({
      path: path.join(OUT, slug(name) + ".png"),
      animations: "disabled",
      fullPage: false,
    });
  }
  fs.writeFileSync(
    path.join(OUT, "audit.json"),
    JSON.stringify(report, null, 2),
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) =>
      report.errors.push({ route: page.url(), message: e.message }),
    );
    await signInStaff(page);
    for (const route of routes) {
      await page.goto(BASE + "/#/" + route);
      await expect(page.locator("main h1")).toBeVisible();
      await inspect(page, route + "-desktop", true);
      const tabs = await page
        .locator('main [role="tablist"]')
        .first()
        .getByRole("tab")
        .allTextContents();
      for (const label of tabs) {
        await page
          .locator('main [role="tablist"]')
          .first()
          .getByRole("tab", { name: label.trim(), exact: true })
          .click();
        await inspect(page, route + "-" + label + "-desktop", true);
        await page.setViewportSize({ width: 390, height: 844 });
        await inspect(page, route + "-" + label + "-mobile");
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await page.goto(BASE + "/#/" + route);
      await page.reload();
      await settle(page);
      await page.getByRole("radio", { name: "Dark theme" }).click();
      await inspect(page, route + "-dark", true);
      await page.getByRole("radio", { name: "Light theme" }).click();
      for (const width of [768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await inspect(page, route + "-" + width, width === 390);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log("Reviewed " + route + " (" + tabs.length + " tabs)");
    }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(OUT, "audit.json"),
      JSON.stringify(report, null, 2),
    );
  }
  console.log(
    JSON.stringify({
      screens: report.screens.length,
      failures: report.failures,
      errors: report.errors,
      report: path.join(OUT, "audit.json"),
    }),
  );
  if (report.failures.length || report.errors.length) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
