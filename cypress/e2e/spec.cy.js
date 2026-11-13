describe('Todo-sovellus', () => {
  it('luo uuden tehtävän tehtävälistaan', () => {
    cy.visit('http://localhost:5173');
    cy.clearLocalStorage('todo_tasks_v1');
    cy.reload();

    cy.get('#topic').type('Kirjoita Cypress-testi');
    cy.get('#priority').select('high');
    cy.get('#description').type('Testaa tehtävän luomista.');
    cy.get('#save-btn').click();

    cy.get('#task-list .task')
      .should('have.length', 1)
      .and('contain', 'Kirjoita Cypress-testi')
      .and('contain', 'Testaa tehtävän luomista.');
  });
});