const { defineConfig } = require("cypress");
const fs = require("fs");

module.exports = defineConfig({
  e2e: {
    testIsolation: false,
    setupNodeEvents(on, config) {
      on("task", {
        readSealightsConfig() {
          const buildSessionId = fs.readFileSync(
            `${__dirname}/buildSessionId`,
            "utf-8"
          );
          const apiToken = fs.readFileSync(`${__dirname}/sltoken.txt`, "utf-8");
          return { buildSessionId, apiToken };
        },
      });
    },
  },
});
