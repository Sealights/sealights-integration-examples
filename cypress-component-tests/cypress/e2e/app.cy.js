describe('Interactive Counter - E2E', () => {
  it('increments, decrements, changes step and resets', () => {
    cy.visit('/');

    cy.get('[data-cy=count]').should('have.text', '0');

    cy.get('[data-cy=step-input]').type('{selectall}2', { delay: 0 });

    cy.get('[data-cy=step-input]').should('have.value', '2');

    cy.get('[data-cy=increment]').click().click();

    cy.get('[data-cy=count]').should('have.text', '4');

    cy.get('[data-cy=decrement]').click();
    cy.get('[data-cy=count]').should('have.text', '2');

    cy.get('[data-cy=reset]').click();
    cy.get('[data-cy=count]').should('have.text', '0');
  });
});

