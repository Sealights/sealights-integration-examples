const SLService = require("../services/sealightsService");

module.exports = async () => {
  // Start a test session
  const { testSessionId } = (await SLService.createTestSession()).data;
  process.env.SEALIGHTS_TEST_SESSION_ID = testSessionId;
};
