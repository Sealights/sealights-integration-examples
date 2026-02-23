import React from 'react';
import App from '../../src/App.jsx';

describe('App component', () => {
  it('supports changing step and incrementing', () => {
    cy.mount(<App />);

    cy.get('[data-cy=count]').should('have.text', '0');

    // Use select-all to reliably replace the existing value in a controlled number input
    cy.get('[data-cy=step-input]').type('{selectall}3', { delay: 0 });
    cy.get('[data-cy=increment]').click();
    cy.get('[data-cy=count]').should('have.text', '3');

    cy.get('[data-cy=decrement]').click();
    cy.get('[data-cy=count]').should('have.text', '0');
  });
});

