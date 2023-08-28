const { defineConfig } = require("cypress");
const registerSealights =
  require("SL.Cypress.Plugin/dist/code-coverage/config").default;

module.exports = defineConfig({
  e2e: {
    experimentalInteractiveRunEvents: true,
    testIsolation: false,
    setupNodeEvents(on, config) {
      registerSealights(on, config);
    },
  },
});
