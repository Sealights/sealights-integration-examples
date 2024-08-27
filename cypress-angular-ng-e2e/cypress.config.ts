import { defineConfig } from "cypress";
import { registerSealightsTasks } from "sealights-cypress-plugin";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4200",
    setupNodeEvents(on, config) {
      registerSealightsTasks(on, config);
    },
  },

  component: {
    devServer: {
      framework: "angular",
      bundler: "webpack",
    },
    specPattern: "**/*.cy.ts",
  },
});
