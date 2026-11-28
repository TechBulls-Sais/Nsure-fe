// Read-only workflow review using demo accounts. No create/save/approve/payment action is submitted.
// Customer eligibility and payment-result responses are browser fixtures for presentation coverage only.
// Start the demo backend and frontend, then set PLAYWRIGHT_CHANNEL / NSURE_SCREENSHOT_DIR as needed.
const { chromium, expect } = require("@playwright/test");
const { signInStaff, BASE } = require("./smoke-support.cjs");
const fs = require("fs");
const path = require("node:path");
const os = require("node:os");
const out =
  process.env.NSURE_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), "nsure-workflow-audit");
fs.mkdirSync(out, { recursive: true });
const report = { screens: [], failures: [], errors: [], skipped: [] };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
async function settle(page) {
  await page.waitForTimeout(120);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".nk-skeleton:visible")).toHaveCount(0);
}
async function capture(page, name) {
  await settle(page);
  const issue = await page.evaluate(() => {
    const visible = (e) =>
      e.getBoundingClientRect().width > 0 &&
      e.getBoundingClientRect().height > 0;
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      dialogs: [...document.querySelectorAll("dialog[open] .nk-dialog-body")]
        .filter(visible)
        .filter((e) => e.scrollWidth > e.clientWidth + 2)
        .map((e) => e.className),
      small: [
        ...document.querySelectorAll(
          'dialog[open] input:not([type="checkbox"],[type="radio"]),dialog[open] select,dialog[open] textarea',
        ),
      ]
        .filter(visible)
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 14)
        .map((e) => ({
          name: e.name || e.getAttribute("aria-label"),
          font: getComputedStyle(e).fontSize,
        })),
    };
  });
  report.screens.push({ name, ...issue });
  if (issue.overflow || issue.dialogs.length)
    report.failures.push(name + ": overflow");
  if (issue.small.length) report.failures.push(name + ": form text below 14px");
  await page.screenshot({
    path: out + "/" + slug(name) + ".png",
    animations: "disabled",
  });
  fs.writeFileSync(out + "/audit.json", JSON.stringify(report, null, 2));
}
async function variants(page, name) {
  for (const [width, theme] of [
    [1440, "light"],
    [1440, "dark"],
    [768, "light"],
    [390, "light"],
    [320, "light"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async (theme) => {
      (await import("/src/ui/theme.js")).setTheme(theme);
    }, theme);
    if (name.startsWith("customer-cover-application")) {
      await expect(page.locator(".customer-product-detail")).toBeVisible();
      await page
        .locator(".customer-product-detail")
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
    }
    await capture(page, name + "-" + width + "-" + theme);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function goto(page, route) {
  await page.goto(BASE + "/#/" + route);
  await page.reload();
  await settle(page);
}
async function main() {
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
    const forms = [
      ["credit-life", null, "Register loan"],
      ["credit-life", "Lenders", "Add lender"],
      ["schemes", null, "New scheme (set-up)"],
      ["scheme-lifecycle", null, "New quotation"],
      ["scheme-lifecycle", "Rate tables & sponsors", "New rate table"],
      ["scheme-lifecycle", "Rate tables & sponsors", "New prospect"],
      ["scheme-lifecycle", "Renewals & closures", "New request"],
      ["finance", "Manual journals", "New manual journal"],
      ["reinsurance", null, "Draft treaty"],
      ["communications", "Templates", "New template"],
      ["communications", "Messages", "Send a service message"],
      ["access", "Roles", "New role"],
      ["access", "Users", "New user"],
      ["configuration", null, "New release"],
      ["service-desk", null, "Log a case"],
      ["distribution", "Commission rules", "New rule"],
      ["distribution", "Agreements", "Draft agreement"],
      ["data-assistants", "Wording library", "New clause"],
      ["applications", null, "New application"],
      ["claims", null, "Register claim"],
    ];
    for (const [route, tab, button] of forms) {
      try {
        await goto(page, route);
        if (tab) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          await settle(page);
        }
        await page
          .getByRole("button", { name: button, exact: true })
          .first()
          .click({ timeout: 5000 });
        await variants(page, route + "-" + button);
        if (route === "applications") {
          for (const step of ["Protection", "Details", "Review"]) {
            if (step === "Review") {
              // Complete the demo disclosures to reach Review without submitting the application.
              for (const select of await page
                .locator("dialog[open] select[required]")
                .all()) {
                await select.selectOption("NO");
              }
              for (const input of await page
                .locator(
                  'dialog[open] input[required]:not([type="checkbox"],[type="radio"])',
                )
                .all()) {
                if (!(await input.inputValue()))
                  await input.fill("No additional disclosure");
              }
            }
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Continue", exact: true })
              .click();
            await expect(
              page.locator("dialog[open] .step.active"),
            ).toContainText(step);
            await page
              .locator("dialog[open] .nk-dialog-body")
              .evaluate((el) => (el.scrollTop = 0));
            await variants(page, "application-step-" + step);
          }
        }
        console.log("Reviewed form " + button);
      } catch (e) {
        report.failures.push(
          route + " " + button + ": " + e.message.split("\n")[0],
        );
      }
    }
    for (const [route, selector] of [
      ["policies", 'button[aria-label^="View POL"]'],
      ["claims", 'button[aria-label^="View CLM"]'],
      ["applications", 'button[aria-label^="View APP"]'],
      ["customers", ".cd-name"],
      ["rate-tables", ".rt-link"],
      ["schemes", 'button:has-text("Open scheme")'],
      ["servicing", ".data-table .ws-clickable"],
    ]) {
      try {
        await goto(page, route);
        await page.locator(selector).first().click({ timeout: 5000 });
        await settle(page);
        await variants(page, route + "-detail");
        const scope = (await page.getByRole("dialog").count())
          ? page.getByRole("dialog").last()
          : page.locator("main");
        const tabs = await scope
          .locator('[role="tablist"]')
          .first()
          .getByRole("tab")
          .allTextContents();
        // Legacy record drawers have visual tab buttons without role=tab.
        const legacy = await scope.locator(".tabs button").allTextContents();
        for (const label of tabs.length ? tabs : legacy) {
          const el = tabs.length
            ? scope.getByRole("tab", { name: label.trim(), exact: true })
            : scope
                .locator(".tabs")
                .getByRole("button", { name: label.trim(), exact: true });
          await el.first().click();
          await variants(page, route + "-detail-" + label);
        }
        console.log("Reviewed record " + route);
      } catch (e) {
        report.failures.push(route + " detail: " + e.message.split("\n")[0]);
      }
    }
    // Each partner has different data and available request forms.
    for (const user of ["agent", "employer", "lender"]) {
      const partner = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      partner.on("pageerror", (e) =>
        report.errors.push({ user, message: e.message }),
      );
      try {
        await signInStaff(partner, user);
        await variants(partner, user + "-portal");
        await partner
          .getByRole("button", { name: "Send data", exact: true })
          .click();
        await variants(partner, user + "-submission");
      } catch (e) {
        report.failures.push(user + ": " + e.message.split("\n")[0]);
      }
      await partner.close();
    }
    const customer = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    customer.on("pageerror", (e) =>
      report.errors.push({ user: "customer", message: e.message }),
    );
    await customer.goto(BASE + "/#/login/customer");
    await customer.locator('input[autocomplete="username"]').fill("customer");
    await customer
      .locator('input[autocomplete="current-password"]')
      .fill("password");
    await customer.locator('form button[type="submit"]').click();
    await expect(customer.locator(".customer-shell")).toBeVisible();
    await variants(customer, "customer-portal");
    if (await customer.locator(".customer-policy-toggle").count()) {
      await customer.locator(".customer-policy-toggle").click();
      await variants(customer, "customer-policies");
    }
    const details = customer.locator(".customer-policy-details summary");
    for (let i = 0; i < Math.min(await details.count(), 4); i++) {
      await details.nth(i).click();
      await capture(customer, "customer-policy-section-" + i);
    }
    const explore = customer.getByRole("button", {
      name: "Explore cover",
      exact: true,
    });
    if (await explore.count()) {
      await explore.first().click();
      await variants(customer, "customer-cover-application");
    } else {
      await customer.route("**/api/portfolio/shop", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const shop = body.data || body;
        shop.customer = {
          ...shop.customer,
          kycStatus: "VERIFIED",
          eddStatus: "CLEARED",
        };
        await route.fulfill({ response, json: body });
      });
      await customer.reload();
      await settle(customer);
      await customer
        .getByRole("button", { name: "Explore cover", exact: true })
        .first()
        .click();
      await variants(customer, "customer-cover-application-fixture");
      // Restore the real account response; no customer or payment is modified.
      await customer.unroute("**/api/portfolio/shop");
      await customer.reload();
      await settle(customer);
    }
    // Payment-result presentation only; responses are isolated to this browser, no payment is made.
    for (const [status, route] of [
      ["SETTLED", "buy/confirmation?policy=POL-10838&tx=ui-check"],
      ["FAILED", "buy/payment?status=failed&tx=ui-check"],
      ["EXPIRED", "buy/payment?status=expired&tx=ui-check"],
      ["PENDING", "buy/payment/pending?tx=ui-check"],
    ]) {
      await customer.route("**/api/checkout/transactions/ui-check", (r) =>
        r.fulfill({
          json: {
            status,
            transactionId: "ui-check",
            policyRef: "POL-10838",
            policyNumber: "POL-10838",
            amount: 210,
            currency: "BWP",
            method: "Card",
            failureReason:
              status === "FAILED" ? "Payment declined by provider" : null,
          },
        }),
      );
      await customer.goto(BASE + "/#/" + route);
      await variants(customer, "payment-" + status.toLowerCase());
      await customer.unroute("**/api/checkout/transactions/ui-check");
    }
    // Public account creation and recovery are separate from staff/customer sessions.
    const publicPage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await publicPage.goto(BASE + "/#/signup");
    await variants(publicPage, "signup");
    await publicPage.goto(BASE + "/#/login/customer");
    const recovery = publicPage.getByRole("button", { name: /forgot/i });
    if (await recovery.count()) {
      await recovery.click();
      await variants(publicPage, "password-recovery");
    }
  } finally {
    await browser.close();
    fs.writeFileSync(out + "/audit.json", JSON.stringify(report, null, 2));
  }
  console.log(
    JSON.stringify({
      screens: report.screens.length,
      failures: report.failures,
      errors: report.errors,
      skipped: report.skipped,
    }),
  );
  if (report.failures.length || report.errors.length) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
