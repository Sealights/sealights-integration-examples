const SLService = require("../services/sealightsService");

module.exports = async () => {
  // Start a test session
  const { testSessionId } = (await SLService.createTestSession()).data;
  process.env.SEALIGHTS_TEST_SESSION_ID = testSessionId;

  // Demonstrate tests skip using process.env to store the recommended tests to run
  // The next step would be to fetch the recommended tests using Sealights Public API here
  process.env.SEALIGHTS_RECOMMENDED_TESTS_RUN = JSON.stringify([
    "Sum two numbers",
    "Subtract two numbers",
  ]);
};
