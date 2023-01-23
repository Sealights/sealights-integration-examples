/* globals gauge*/
"use strict";
const path = require("path");
const {
  openBrowser,
  write,
  closeBrowser,
  screenshot,
  click,
  into,
  textBox,
  goto,
  $,
  evaluate,
} = require("taiko");
const assert = require("assert");
const headless = process.env.headless_chrome.toLowerCase() === "true";
const SLService = require("../services/sealightsService");

let testSession;
let testStartTime;

beforeSuite(async () => {
  // Start a test session
  const { testSessionId } = (await SLService.createTestSession()).data.data;
  testSession = testSessionId;

  await openBrowser({
    headless,
    ignoreCertificateErrors: true,
    args: ["--disable-web-security"], // CORS
  });
  await goto("http://localhost:3333");
});

beforeScenario(async (scenario) => {
  // Set the correct baggage before a scenario runs with testName and the current testSessionId
  await evaluate(
    "",
    async (element, args) => {
      const testName = args.scenario.currentScenario.name;
      const customEvent = new CustomEvent("set:baggage", {
        detail: {
          "x-sl-test-name": testName,
          "x-sl-test-session-id": args.testSession,
        },
      });
      window.dispatchEvent(customEvent);
    },
    { args: { scenario, testSession } }
  );
  testStartTime = Date.now();
});

afterScenario(async (scenario) => {
  // Unset baggage after scenario
  await evaluate("", async () => {
    const customEvent = new CustomEvent("delete:baggage");
    window.dispatchEvent(customEvent);
  });
  // Send test event to Sealights
  await SLService.sendTestEvent(
    testSession,
    scenario.currentScenario.name,
    testStartTime,
    Date.now(),
    scenario.isFailed ? "failed" : "passed" // could also be "skipped" value, implement logic as needed
  );
  testStartTime = undefined;
});

afterSuite(async () => {
  // End the current test session after the running suite
  await SLService.endTestSession(testSession);
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  await sleep(5 * 1000);
  await closeBrowser();
});

// Return a screenshot file name
gauge.customScreenshotWriter = async function () {
  const screenshotFilePath = path.join(
    process.env["gauge_screenshots_dir"],
    `screenshot-${process.hrtime.bigint()}.png`
  );

  await screenshot({
    path: screenshotFilePath,
  });
  return path.basename(screenshotFilePath);
};

step("Click a button <text>", async function (text) {
  await click(text);
});

step("Write in first field <text>", async function (text) {
  await write(text, into(textBox({ id: "number1" }), { force: true }));
});

step("Write in second field <text>", async function (text) {
  await write(text, into(textBox({ id: "number2" }), { force: true }));
});

step("Assert result <text>", async function (text) {
  const value = await $("*[id='result']").text();
  assert.strictEqual(text, value);
});
