// Workspace smoke check against the running app (backend with demo data on 8091, `npm run dev` on 5180). It only
// reads: staff sign-in with the one-time code, the overview, sidebar navigation, customer search, the work queue,
// access administration and the service desk, the mobile layout, sign-out, and that a read-only role gets no work
// to take (D-24). Fails on any uncaught browser error or sideways scrolling on a phone.
const { assertFits, assertNoErrors, expect, goTo, openPage, run, screenshot, signInStaff } = require("./smoke-support.cjs");

run("staff sign-in with one-time code; overview; navigation; customer search; work queue; access; service desk; mobile; sign-out; read-only queue", async (browser) => {
  const page = await openPage(browser);
  await signInStaff(page, "admin");
  await expect(page.getByRole("heading", { level: 1, name: /A good day to make a difference/ })).toBeVisible();
  await screenshot(page, "nsure-dashboard.png");

  // The sidebar: the Customers group opens the customer directory.
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Customers", exact: true })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search records" });
  await search.fill("Neo");
  await expect(page.getByText(/Neo Modise/).first()).toBeVisible();
  await search.fill("");

  // The work queue: open work with priority, owner and next action, and the SLA position by team.
  await nav.getByRole("link", { name: "Work queue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Work queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SLA by team" })).toBeVisible();
  await page.getByRole("tab", { name: "Workflows & calendar" }).click();
  await expect(page.getByRole("heading", { name: "Workflow definitions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business calendar" })).toBeVisible();

  // Access administration: users, the approvals inbox and emergency access.
  await goTo(page, "access", "Access");
  await page.getByRole("tab", { name: "Users", exact: true }).click();
  await expect(page.getByRole("cell", { name: "secadmin", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Approvals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();
  await page.getByRole("tab", { name: "Emergency access", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Emergency access register" })).toBeVisible();

  await goTo(page, "service-desk", "Service desk");
  await expect(page.getByRole("tab", { name: /Complaint register/ })).toBeVisible();

  // Phone width: no sideways scrolling, and the menu still navigates.
  await goTo(page, "overview", /A good day to make a difference/);
  await assertFits(page, 390, "Overview");
  await screenshot(page, "nsure-mobile.png");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await nav.getByRole("link", { name: "Work queue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Work queue" })).toBeVisible();
  await assertFits(page, 390, "Work queue");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Life happens.");
  assertNoErrors(page);

  // A read-only role (Compliance & Auditor) has nothing it may act on, so nothing to take (D-24).
  const auditor = await openPage(browser);
  await signInStaff(auditor, "compliance");
  await goTo(auditor, "work-queue", "Work queue");
  await expect(auditor.getByText("Nothing waiting for you")).toBeVisible();
  await expect(auditor.getByRole("button", { name: "Take", exact: true })).toHaveCount(0);
  assertNoErrors(auditor);
});
