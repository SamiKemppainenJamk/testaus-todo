const APP_URL = 'http://localhost:5173';
const STORAGE_KEY = 'todo_tasks_v1';

function createTask({ topic, priority = 'medium', status = 'todo', description = '' }) {
  cy.get('#topic').clear().type(topic);
  cy.get('#priority').select(priority);
  cy.get('#status').select(status);
  cy.get('#description').clear();
  if (description) {
    cy.get('#description').type(description);
  }
  cy.get('#save-btn').click();
  cy.get('#task-list .task')
    .contains('.title', topic)
    .should('be.visible');
}

function getTask(topic) {
  return cy
    .get('#task-list .task')
    .contains('.title', topic)
    .closest('.task');
}

describe('Todo application', () => {
  beforeEach(() => {
    cy.visit(APP_URL);
    cy.clearLocalStorage(STORAGE_KEY);
    cy.reload();
  });

  it('shows the initial form and empty state', () => {
    cy.contains('h1', 'Basic CRUD ToDo web app').should('be.visible');
    cy.contains('#form-title', 'Create Task').should('be.visible');
    cy.get('#save-btn').should('have.text', 'Save Task');
    cy.get('#topic').should('have.attr', 'required');
    cy.get('#topic').should('have.attr', 'maxlength', '120');
    cy.get('#priority').should('have.value', 'medium');
    cy.get('#status').should('have.value', 'todo');
    cy.get('#task-list .task').should('not.exist');
    cy.get('#empty-state')
      .should('be.visible')
      .and('contain', 'No tasks yet. Add your first task above.');
  });

  it('creates a task with priority and status, then persists it after reload', () => {
    createTask({
      topic: 'Write Cypress tests',
      priority: 'high',
      status: 'in-progress',
      description: 'Test task creation.',
    });

    getTask('Write Cypress tests').within(() => {
      cy.get('.title').should('have.text', 'Write Cypress tests');
      cy.get('.desc').should('have.text', 'Test task creation.');
      cy.get('.prio-high').should('contain', 'High');
      cy.contains('.badge', 'In progress').should('be.visible');
      cy.contains('button', 'Edit').should('be.visible');
      cy.contains('button', 'Complete').should('be.visible');
      cy.contains('button', 'Delete').should('be.visible');
    });

    cy.get('#form-title').should('have.text', 'Create Task');
    cy.get('#save-btn').should('have.text', 'Save Task');
    cy.get('#topic').should('have.value', '');
    cy.get('#priority').should('have.value', 'medium');
    cy.get('#status').should('have.value', 'todo');
    cy.get('#empty-state').should('not.be.visible');

    cy.reload();
    getTask('Write Cypress tests').should('be.visible');
  });

  it('trims topic and description whitespace and supports an empty description', () => {
    cy.get('#topic').type('  Trimmed task  ');
    cy.get('#description').type('  Trimmed description  ');
    cy.get('#save-btn').click();

    getTask('Trimmed task').within(() => {
      cy.get('.title').should('have.text', 'Trimmed task');
      cy.get('.desc').should('have.text', 'Trimmed description');
    });

    createTask({ topic: 'No description task' });
    getTask('No description task').find('.desc').should('have.text', '');
  });

  it('does not create a task without a topic and rejects more than 120 characters', () => {
    cy.get('#save-btn').click();
    cy.get('#task-list .task').should('not.exist');
    cy.get('#topic').should('be.focused');

    cy.get('#topic').type('a'.repeat(121));
    cy.get('#topic').invoke('val').should('have.length', 120);
  });

  it('orders incomplete tasks by priority and then newest first', () => {
    createTask({ topic: 'Low task', priority: 'low' });
    createTask({ topic: 'Medium task', priority: 'medium' });
    createTask({ topic: 'High task', priority: 'high' });
    createTask({ topic: 'Newest low task', priority: 'low' });

    cy.get('#task-list .title').then(($titles) => {
      const titles = [...$titles].map((element) => element.textContent);
      expect(titles.slice(0, 2)).to.deep.equal(['High task', 'Medium task']);
      expect(titles.indexOf('High task')).to.be.lessThan(titles.indexOf('Medium task'));
      expect(titles.indexOf('Medium task')).to.be.lessThan(titles.indexOf('Low task'));
      expect(titles.indexOf('Newest low task')).to.be.lessThan(titles.indexOf('Low task'));
    });
  });

  it('creates a done task in the completed section and visually marks it done', () => {
    createTask({ topic: 'Open task', priority: 'high', status: 'todo' });
    createTask({ topic: 'Finished task', priority: 'low', status: 'done' });

    getTask('Finished task').should('have.class', 'done');
    getTask('Finished task').find('.title').should(
      'have.css',
      'text-decoration-line',
      'line-through',
    );
    getTask('Finished task').find('.badge').should('contain', 'Done');
    getTask('Finished task').contains('button', 'Undo').should('be.visible');

    cy.get('#task-list .task')
      .first()
      .find('.title')
      .should('have.text', 'Open task');
  });

  it('edits every task field without creating a duplicate', () => {
    createTask({
      topic: 'Original task',
      priority: 'low',
      status: 'blocked',
      description: 'Original description',
    });

    getTask('Original task').contains('button', 'Edit').click();
    cy.get('#form-title').should('have.text', 'Edit Task');
    cy.get('#save-btn').should('have.text', 'Update Task');
    cy.get('#topic').should('have.value', 'Original task');
    cy.get('#priority').should('have.value', 'low');
    cy.get('#status').should('have.value', 'blocked');
    cy.get('#description').should('have.value', 'Original description');

    cy.get('#topic').clear().type('Updated task');
    cy.get('#priority').select('high');
    cy.get('#status').select('in-progress');
    cy.get('#description').clear().type('Updated description');
    cy.get('#save-btn').click();

    cy.get('#task-list .task').should('have.length', 1);
    cy.get('#form-title').should('have.text', 'Create Task');
    cy.get('#save-btn').should('have.text', 'Save Task');

    getTask('Updated task').within(() => {
      cy.get('.desc').should('have.text', 'Updated description');
      cy.get('.prio-high').should('contain', 'High');
      cy.contains('.badge', 'In progress').should('be.visible');
    });
    cy.contains('.title', 'Original task').should('not.exist');
  });

  it('resets create and edit forms without saving unsaved changes', () => {
    cy.get('#topic').type('Unsaved create');
    cy.get('#priority').select('high');
    cy.get('#status').select('blocked');
    cy.get('#description').type('Unsaved description');
    cy.get('#reset-btn').click();

    cy.get('#topic').should('have.value', '');
    cy.get('#priority').should('have.value', 'medium');
    cy.get('#status').should('have.value', 'todo');
    cy.get('#description').should('have.value', '');
    cy.get('#save-btn').should('have.text', 'Save Task');

    createTask({ topic: 'Editable task', priority: 'medium', status: 'todo' });
    getTask('Editable task').contains('button', 'Edit').click();
    cy.get('#topic').clear().type('Unsaved edit');
    cy.get('#priority').select('low');
    cy.get('#status').select('done');
    cy.get('#reset-btn').click();

    cy.get('#form-title').should('have.text', 'Create Task');
    cy.get('#save-btn').should('have.text', 'Save Task');
    cy.get('#topic').should('have.value', '');
    cy.get('#priority').should('have.value', 'medium');
    cy.get('#status').should('have.value', 'todo');
    getTask('Editable task').should('not.have.class', 'done');
  });

  it('completes and undoes a task, updating status, style and persistence', () => {
    createTask({ topic: 'Complete me', priority: 'medium', status: 'in-progress' });

    getTask('Complete me').contains('button', 'Complete').click();
    getTask('Complete me').should('have.class', 'done');
    getTask('Complete me').contains('.badge', 'Done').should('be.visible');
    getTask('Complete me').contains('button', 'Undo').should('be.visible');

    cy.reload();
    getTask('Complete me').should('have.class', 'done');
    getTask('Complete me').contains('button', 'Undo').should('be.visible');

    getTask('Complete me').contains('button', 'Undo').click();
    getTask('Complete me').should('not.have.class', 'done');
    getTask('Complete me').contains('.badge', 'To do').should('be.visible');
    getTask('Complete me').contains('button', 'Complete').should('be.visible');
  });

  it('preserves a non-done status when undoing a task that is also completed', () => {
    createTask({ topic: 'Non-done undo', priority: 'medium', status: 'in-progress' });

    getTask('Non-done undo').contains('button', 'Complete').click();
    getTask('Non-done undo').contains('button', 'Edit').click();
    cy.get('#status').select('blocked');
    cy.get('#save-btn').click();

    getTask('Non-done undo').should('have.class', 'done');
    getTask('Non-done undo').contains('button', 'Undo').click();
    getTask('Non-done undo').should('not.have.class', 'done');
    getTask('Non-done undo').contains('.badge', 'Blocked').should('be.visible');
  });

  it('cancels deletion or confirms deletion and restores the empty state', () => {
    createTask({ topic: 'Keep me', priority: 'low' });
    createTask({ topic: 'Delete me', priority: 'high' });

    cy.window().then((window) => {
      cy.stub(window, 'confirm')
        .onFirstCall()
        .returns(false)
        .onSecondCall()
        .returns(true)
        .onThirdCall()
        .returns(true);
    });

    getTask('Delete me').contains('button', 'Delete').click();
    getTask('Delete me').should('be.visible');

    getTask('Delete me').contains('button', 'Delete').click();
    cy.contains('.title', 'Delete me').should('not.exist');

    getTask('Keep me').contains('button', 'Delete').click();
    cy.get('#task-list .task').should('not.exist');
    cy.get('#empty-state').should('be.visible');

    cy.window().then((window) => {
      expect(window.confirm).to.have.been.calledWith('Delete this task?');
      expect(window.confirm.callCount).to.equal(3);
    });
  });

  it('renders topic and description HTML-looking text literally', () => {
    createTask({
      topic: '<b>Literal topic</b>',
      description: '<script>alert("literal")</script>',
    });

    getTask('<b>Literal topic</b>').within(() => {
      cy.get('.title').should('have.text', '<b>Literal topic</b>');
      cy.get('.desc').should(
        'have.text',
        '<script>alert("literal")</script>',
      );
      cy.get('.title b').should('not.exist');
    });
  });

  it('serves health and version metadata endpoints', () => {
    cy.request(`${APP_URL}/health`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal({ status: 'ok' });
    });

    cy.request(`${APP_URL}/version`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal({
        name: 'todo-training-app',
        version: '0.1.0',
      });
    });
  });
});
