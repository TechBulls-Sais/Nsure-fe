// Shared set-up for the browser smoke checks (scripts/*-smoke.cjs and smoke.cjs).
//
// They drive the real app: start the backend (nsure-be, port 8091, demo data) and `npm run dev` (port 5180) first.
// Environment: NSURE_BASE_URL (default http://127.0.0.1:5180), NSURE_SCREENSHOT_DIR (an existing directory, default
// the OS temp directory), PLAYWRIGHT_CHANNEL (default "chrome"; set it to "chromium" for Playwright's own browser),
// NSURE_PASSWORD (default "password", the demo password) and NSURE_ONE_TIME_CODE (only needed when the backend does
// not show a demo code on the sign-in screen).
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

const BASE = (process.env.NSURE_BASE_URL || "http://127.0.0.1:5180").replace(/\/+$/, "");
const OUT = process.env.NSURE_SCREENSHOT_DIR || os.tmpdir();
const PASSWORD = process.env.NSURE_PASSWORD || "password";

async function launch() {
  return chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
}

/** A new page that records uncaught browser errors in `page.errors`. */
async function openPage(browser, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...options });
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  return page;
}

/**
 * Staff (or partner) sign-in as the app does it: username and password on the Admin sign-in, then the one-time code.
 * A dev or demo backend shows its code on the screen ("Use the code 123456"); any other needs NSURE_ONE_TIME_CODE.
 */
async function signInStaff(page, username = "admin", password = PASSWORD) {
  await page.goto(BASE + "/#/login/admin");
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Enter workspace" }).click();
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await expect(codeInput, "the one-time code step (is the backend running?)").toBeVisible({ timeout: 15000 });
  const shown = page.locator(".login-hint strong");
  const code = process.env.NSURE_ONE_TIME_CODE || ((await shown.count()) ? (await shown.first().textContent()).trim() : "");
  assert.match(code, /^\d{6}$/, "No demo code on screen: set NSURE_ONE_TIME_CODE to the code that was sent");
  await codeInput.fill(code);
  await page.getByRole("button", { name: "Verify and enter" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 15000 });
}

/** Opens a workspace page by its route (#/work-queue …) and waits for its heading. */
async function goTo(page, route, heading) {
  await page.evaluate((key) => {
    window.location.hash = "#/" + key;
  }, route);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 15000 });
}

async function assertFits(page, width, what) {
  await page.setViewportSize({ width, height: 844 });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert(fits, `${what}: the page scrolls sideways at ${width}px`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true, animations: "disabled" });
}

/** Runs a check with a fresh browser; any failure or uncaught browser error exits non-zero. */
function run(name, check) {
  (async () => {
    const browser = await launch();
    try {
      await check(browser);
    } finally {
      await browser.close();
    }
    console.log("PASS: " + name);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function assertNoErrors(page) {
  assert.deepEqual(page.errors, [], "Uncaught browser errors");
}

module.exports = { BASE, OUT, assertFits, assertNoErrors, expect, goTo, openPage, run, screenshot, signInStaff };
