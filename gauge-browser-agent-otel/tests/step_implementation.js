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
const config = require("../config");
const jwtDecode = require("jwt-decode");
const axios = require("axios");

const decoded = jwtDecode(config.apiToken); // Agent Token
const baseUrl = decoded["x-sl-server"]; // Base url of the backend

const createTestSession = () => {
  return axios.post(
    baseUrl.replace("/api", "/sl-api/v1/test-sessions"), // Public API to start a test session
    {
      testStage: "Gauge Tests",
      bsid: "51721270-ead5-498b-b22f-c3f9861ea44e", // Better set from environment variable or get from window.$Sealights
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    }
  );
};

// Works the same with any test framework, before test starts emit event to set baggage
beforeScenario(async (scenario) => {
  // Start a test session
  const { testSessionId } = (await createTestSession()).data.data;

  await evaluate(
    "",
    async (element, args) => {
      const testName = args.scenario.currentScenario.name;
      const customEvent = new CustomEvent("set:baggage", {
        detail: {
          "x-sl-test-name": testName,
          "x-sl-test-session-id": args.testSessionId,
        },
      });
      window.dispatchEvent(customEvent);
    },
    { args: { scenario, testSessionId } }
  );
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
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  await sleep(10 * 1000);
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
