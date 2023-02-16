const SLService = require("../services/sealightsService");

module.exports = async () => {
  // Start a test session
  const { testSessionId } = (await SLService.createTestSession()).data;
  process.env.testSessionId = testSessionId;
};
