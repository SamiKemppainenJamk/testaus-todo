import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  escapeHtml,
  generateId,
  loadTasks,
  saveTasks,
  sortTasks,
  statusLabel,
  toggleTaskCompletion,
  updateTask,
} from '../public/taskStore.js';

const STORAGE_KEY = 'todo_tasks_v1';

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    topic: 'Test task',
    priority: 'medium',
    status: 'todo',
    description: 'Test description',
    completed: false,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe('task localStorage operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads an empty array when no tasks are stored', () => {
    expect(loadTasks()).toEqual([]);
  });

  it('loads saved task data', () => {
    const tasks = [makeTask()];
    saveTasks(tasks);

    expect(loadTasks()).toEqual(tasks);
  });

  it('returns an empty array for invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid');

    expect(loadTasks()).toEqual([]);
  });

  it('returns an empty array when stored data is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ topic: 'Not an array' }));

    expect(loadTasks()).toEqual([]);
  });

  it('saves the task array to the todo_tasks_v1 key', () => {
    const tasks = [makeTask({ topic: 'Persisted task' })];

    saveTasks(tasks);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(tasks);
  });
});

describe('generateId', () => {
  it('creates an id with the expected prefix', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);

    const id = generateId();

    expect(id).toMatch(/^t_[a-z0-9]+[a-z0-9]+$/);

    vi.restoreAllMocks();
  });

  it('uses a pseudo-unique value for separate calls', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.9);

    const first = generateId();
    const second = generateId();

    expect(first).not.toBe(second);

    vi.restoreAllMocks();
  });
});

describe('escapeHtml', () => {
  it('escapes text used in task cards so it renders literally', () => {
    expect(escapeHtml(`<b>Rock & "Roll"</b>'`)).toBe(
      '&lt;b&gt;Rock &amp; &quot;Roll&quot;&lt;/b&gt;&#039;',
    );
  });

  it('converts non-string values to strings before escaping', () => {
    expect(escapeHtml(123)).toBe('123');
  });
});

describe('statusLabel', () => {
  it.each([
    ['todo', 'To do'],
    ['in-progress', 'In progress'],
    ['blocked', 'Blocked'],
    ['done', 'Done'],
  ])('maps %s to %s', (status, expected) => {
    expect(statusLabel(status)).toBe(expected);
  });

  it('leaves unknown statuses unchanged', () => {
    expect(statusLabel('custom-status')).toBe('custom-status');
  });
});

describe('sortTasks', () => {
  it('orders incomplete tasks before completed tasks', () => {
    const lowIncomplete = makeTask({
      id: 'low-incomplete',
      priority: 'low',
      completed: false,
    });
    const highCompleted = makeTask({
      id: 'high-completed',
      priority: 'high',
      completed: true,
    });

    expect(sortTasks([highCompleted, lowIncomplete]).map((task) => task.id)).toEqual([
      'low-incomplete',
      'high-completed',
    ]);
  });

  it('orders by high, medium, then low priority', () => {
    const low = makeTask({ id: 'low', priority: 'low', createdAt: 300 });
    const medium = makeTask({ id: 'medium', priority: 'medium', createdAt: 300 });
    const high = makeTask({ id: 'high', priority: 'high', createdAt: 300 });

    expect(sortTasks([low, medium, high]).map((task) => task.id)).toEqual([
      'high',
      'medium',
      'low',
    ]);
  });

  it('orders equal completion and priority tasks newest first', () => {
    const oldest = makeTask({ id: 'oldest', createdAt: 100 });
    const newest = makeTask({ id: 'newest', createdAt: 300 });
    const middle = makeTask({ id: 'middle', createdAt: 200 });

    expect(sortTasks([oldest, middle, newest]).map((task) => task.id)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('does not mutate the input array', () => {
    const tasks = [
      makeTask({ id: 'low', priority: 'low', createdAt: 100 }),
      makeTask({ id: 'high', priority: 'high', createdAt: 100 }),
    ];

    const ordered = sortTasks(tasks);

    expect(tasks.map((task) => task.id)).toEqual(['low', 'high']);
    expect(ordered.map((task) => task.id)).toEqual(['high', 'low']);
  });
});

describe('createTask', () => {
  it('creates a task with payload fields and matching timestamps', () => {
    const payload = {
      topic: 'New task',
      priority: 'high',
      status: 'in-progress',
      description: 'New description',
    };

    const task = createTask(payload, 12345);

    expect(task).toMatchObject({
      ...payload,
      completed: false,
      createdAt: 12345,
      updatedAt: 12345,
    });
    expect(task.id).toMatch(/^t_/);
  });

  it('creates a done task in the completed state', () => {
    const task = createTask(
      {
        topic: 'Finished task',
        priority: 'low',
        status: 'done',
        description: '',
      },
      200,
    );

    expect(task.completed).toBe(true);
  });

  it('creates an incomplete task for non-done statuses', () => {
    for (const status of ['todo', 'in-progress', 'blocked']) {
      const task = createTask(
        {
          topic: status,
          priority: 'medium',
          status,
          description: '',
        },
        200,
      );

      expect(task.completed).toBe(false);
    }
  });
});

describe('updateTask', () => {
  it('updates all editable fields while retaining identity and creation time', () => {
    const existing = makeTask({ id: 'stable-id', createdAt: 100 });
    const payload = {
      topic: 'Updated topic',
      priority: 'high',
      status: 'in-progress',
      description: 'Updated description',
    };

    const updated = updateTask(existing, payload, 500);

    expect(updated).toEqual({
      ...existing,
      ...payload,
      updatedAt: 500,
    });
  });

  it('marks a task completed when status is changed to done', () => {
    const existing = makeTask({ completed: false });

    const updated = updateTask(
      existing,
      {
        topic: existing.topic,
        priority: existing.priority,
        status: 'done',
        description: existing.description,
      },
      300,
    );

    expect(updated.completed).toBe(true);
  });

  it('preserves completed state for non-done statuses', () => {
    const existing = makeTask({ completed: true });

    const updated = updateTask(
      existing,
      {
        topic: existing.topic,
        priority: 'low',
        status: 'blocked',
        description: existing.description,
      },
      300,
    );

    expect(updated.completed).toBe(true);
    expect(updated.status).toBe('blocked');
  });

  it('does not change an incomplete task to completed for non-done statuses', () => {
    const existing = makeTask({ completed: false });

    const updated = updateTask(
      existing,
      {
        topic: existing.topic,
        priority: 'medium',
        status: 'in-progress',
        description: existing.description,
      },
      300,
    );

    expect(updated.completed).toBe(false);
  });
});

describe('toggleTaskCompletion', () => {
  it('marks an incomplete task complete and sets status to done', () => {
    const task = makeTask({ status: 'in-progress', completed: false });

    const toggled = toggleTaskCompletion(task, 400);

    expect(toggled.completed).toBe(true);
    expect(toggled.status).toBe('done');
    expect(toggled.updatedAt).toBe(400);
  });

  it('undoes a done task and resets status to todo', () => {
    const task = makeTask({ status: 'done', completed: true });

    const toggled = toggleTaskCompletion(task, 500);

    expect(toggled.completed).toBe(false);
    expect(toggled.status).toBe('todo');
    expect(toggled.updatedAt).toBe(500);
  });

  it('undoes a completed task with a non-done status without changing status', () => {
    const task = makeTask({ status: 'blocked', completed: true });

    const toggled = toggleTaskCompletion(task, 600);

    expect(toggled.completed).toBe(false);
    expect(toggled.status).toBe('blocked');
  });

  it('does not mutate the original task', () => {
    const task = makeTask({ status: 'todo', completed: false });

    const toggled = toggleTaskCompletion(task, 700);

    expect(task.completed).toBe(false);
    expect(task.status).toBe('todo');
    expect(task.updatedAt).toBe(100);
    expect(toggled).not.toBe(task);
  });
});
