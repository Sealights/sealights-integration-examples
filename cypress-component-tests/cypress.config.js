const { defineConfig } = require('cypress');
const {registerSealightsTasks} = require('sealights-cypress-plugin');
const {} = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.js',
    async setupNodeEvents(on, config) {
      await registerSealightsTasks(on, config);
    }
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.js',
    async setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config);
      await registerSealightsTasks(on, config);
      return config;
    }
  },
});
