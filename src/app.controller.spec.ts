import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';

describe('health', () => {
  it('reports actual memory storage, not a fictitious DB', () => {
    expect(new AppController().health()).toMatchObject({
      status: 'ok',
      service: 'auth',
      storage: 'memory',
    });
  });
});
