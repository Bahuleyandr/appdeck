import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  getServiceInstance,
  setServiceLastUrl
} from '../../src/main/db/repositories/serviceInstances.js';
import { createTestDb } from './helpers.js';

describe('service instances', () => {
  it('updates last_url without changing synced metadata', () => {
    const { db, deviceId } = createTestDb();
    const workspace = (db.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string }).id;
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'gmail',
      workspaceId: workspace,
      displayName: 'Gmail'
    });
    const before = getServiceInstance(db, service.id);
    if (!before) throw new Error('Expected service instance');

    setServiceLastUrl(db, service.id, 'https://mail.google.com/mail/u/0/#inbox');

    const after = getServiceInstance(db, service.id);
    expect(after?.last_url).toBe('https://mail.google.com/mail/u/0/#inbox');
    expect(after?.updated_at).toBe(before.updated_at);
    expect(after?.rev).toBe(before.rev);
    expect(after?.origin_device).toBe(before.origin_device);
  });
});
