const { chromium } = require("@playwright/test");
const SLService = require("../services/sealightsService");

module.exports = async (config) => {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  // Submit all footprints before closing the browser
  await page.evaluate(async () => {
    await window.$SealightsAgent.sendAllFootprints();
  });
  // End the current test session after the running suite
  await SLService.endTestSession(process.env.testSessionId);
  await browser.close();
};
