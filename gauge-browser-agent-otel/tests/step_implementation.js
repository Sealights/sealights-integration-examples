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

// Works the same with any test framework, before test starts emit event to set baggage
beforeScenario(async (scenario) => {
  const slbaggage = await evaluate(
    "",
    (element, args) => {
      window.emitter.emit("set:baggage", {
        "x-sl-test-name": args.currentScenario.name,
        "x-sl-test-session-id": "sessionId",
      });
      return window.getSlBaggage();
    },
    { args: scenario }
  );
  console.log("baggage", slbaggage);
});

beforeSuite(async () => {
  await openBrowser({
    headless,
    ignoreCertificateErrors: true,
    args: ["--disable-web-security"], // CORS
  });
  await goto("http://localhost:3333");
});

afterSuite(async () => {
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
