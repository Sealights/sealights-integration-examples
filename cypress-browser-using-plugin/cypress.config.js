const { defineConfig } = require("cypress");
const { registerSealightsTasks } = require("sealights-cypress-plugin");

module.exports = defineConfig({
  e2e: {
    experimentalInteractiveRunEvents: true,
    setupNodeEvents(on, config) {
      registerSealightsTasks(on, config);
    },
  },
});
