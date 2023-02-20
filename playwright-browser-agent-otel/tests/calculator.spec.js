const { test, expect } = require("@playwright/test");
const SLService = require("../services/sealightsService");

let testStartTime;

test.beforeEach(async ({ page }, testInfo) => {
  // Capture and output logs from browser console
  page.on("console", (msg) => console.log(msg.text()));

  const title = testInfo.title;
  await page.evaluate(
    ({ title, testSession }) => {
      const customEvent = new CustomEvent("set:baggage", {
        detail: {
          "x-sl-test-name": title,
          "x-sl-test-session-id": testSession,
        },
      });
      window.dispatchEvent(customEvent);
    },
    { title, testSession: process.env.testSessionId }
  );
  await page.goto("http://localhost:3333");
  testStartTime = Date.now();
});

test.afterEach(async ({ page }, testInfo) => {
  // Unset baggage after scenario
  await page.evaluate(() => {
    const customEvent = new CustomEvent("delete:baggage");
    window.dispatchEvent(customEvent);
  });
  // Send test event to Sealights
  const { title, status } = testInfo;
  console.log(
    process.env.testSessionId,
    title,
    testStartTime,
    Date.now(),
    status
  );

  await SLService.sendTestEvent(
    process.env.testSessionId,
    title,
    testStartTime,
    Date.now(),
    status
  );
  testStartTime = undefined;
});

test.afterAll(async ({ page }) => {
  // Submit all footprints
  await page.evaluate(async () => {
    await window.$SealightsAgent.sendAllFootprints();
  });
});

test("Sum two numbers", async ({ page }) => {
  await page.locator("#number1").fill("5");
  await page.locator("#number2").fill("3");
  await page.locator("#addBtn").click();
  await expect(page.locator("#result")).toHaveText("8");
});

test("Subtract two numbers", async ({ page }) => {
  await page.locator("#number1").fill("15");
  await page.locator("#number2").fill("5");
  await page.locator("#subtractBtn").click();
  await expect(page.locator("#result")).toHaveText("10");
});
