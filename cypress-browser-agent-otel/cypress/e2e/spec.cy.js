const SLService = require("../../services/sealightsService");
const jwtDecode = require("jwt-decode").default;

let testSession;
let testStartTime;

describe("Calculator app tests", async () => {
  before(() => {
    cy.task("readSealightsConfig").then(
      async ({ buildSessionId, apiToken }) => {
        const decoded = jwtDecode(apiToken); // Agent Token
        const baseUrl = decoded["x-sl-server"]; // Base url of the backend
        SLService.setConfig(baseUrl, apiToken, buildSessionId);

        // Start a test session
        const { testSessionId } = (await SLService.createTestSession()).data;
        testSession = testSessionId;

        cy.visit("http://localhost:3333");
      }
    );
  });

  beforeEach(() => {
    cy.window().then((win) => {
      // Set the correct baggage before a scenario runs with testName and the current testSessionId
      const testName = Cypress.currentTest.title;
      const customEvent = new CustomEvent("set:context", {
        detail: {
          baggage: {
            "x-sl-test-name": testName,
            "x-sl-test-session-id": testSession,
          },
        },
      });
      win.dispatchEvent(customEvent);
      testStartTime = Date.now();
    });
  });

  afterEach(async function () {
    const testState = this.currentTest.state;
    const testName = this.currentTest.title;
    // Send test event to Sealights
    await SLService.sendTestEvent(
      testSession,
      testName,
      testStartTime,
      Date.now(),
      testState
    );
    testStartTime = undefined;

    cy.window().then((win) => {
      // Delete context after scenario
      const customEvent = new CustomEvent("delete:context");
      win.dispatchEvent(customEvent);
    });
  });

  after((done) => {
    // End the current test session after the running suite using Sealights Public API
    SLService.endTestSession(testSession).finally(() => {
      cy.window().then(async (win) => {
        win.$SealightsAgent.sendAllFootprints().finally(done);
      });
    });
  });

  it("Sums two numbers", () => {
    cy.get("#number1").type(5);
    cy.get("#number2").type(5);
    cy.get("#addBtn").click();
    cy.get("#result").should("have.text", 10);
  });

  it("Subtract two numbers", () => {
    cy.get("#number1").clear();
    cy.get("#number2").clear();

    cy.get("#number1").type(5);
    cy.get("#number2").type(5);
    cy.get("#subtractBtn").click();
    cy.get("#result").should("have.text", 0);
  });
});
