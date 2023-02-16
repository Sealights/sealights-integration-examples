const SLService = require("../services/sealightsService");

module.exports = async () => {
  // End the current test session after the running suite
  await SLService.endTestSession(process.env.testSessionId);
};
