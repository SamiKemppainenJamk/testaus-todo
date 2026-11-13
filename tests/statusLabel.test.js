import { describe, expect, it } from 'vitest';
import { statusLabel } from '../public/taskStore.js';

describe('statusLabel', () => {
  it('muuttaa done-tilan käyttäjälle näkyväksi tekstiksi', () => {
    expect(statusLabel('done')).toBe('Done');
  });
});
