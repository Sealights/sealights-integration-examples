describe("Calculator app tests", async () => {
  before(() => {
    cy.visit("http://localhost:3333");
  });

  it("Subtract two numbers", () => {
    cy.get("#number1").clear();
    cy.get("#number2").clear();

    cy.get("#number1").type(5);
    cy.get("#number2").type(5);
    cy.get("#subtractBtn").click();
    cy.get("#result").should("have.text", 0);
  });

  it("Sums two numbers", () => {
    cy.get("#number1").type(5);
    cy.get("#number2").type(5);
    cy.get("#addBtn").click();
    cy.get("#result").should("have.text", 10);
  });

  // Failing on purpose for demo
  it("Sums two numbers - expected fail", () => {
    cy.get("#number1").type(5);
    cy.get("#number2").type(5);
    cy.get("#addBtn").click();
    cy.get("#result").should("have.text", 32110);
  });
});
