import { describe, expect, it } from 'vitest';
import { closeTab, createTab, ensureDefaultTab, getActiveTab, listTabs, setActiveTab } from '../../src/main/db/repositories/serviceTabs.js';
import { createTestDb } from './helpers.js';

describe('service tabs repo', () => {
  it('seeds a default tab and tracks the active tab across create/close', () => {
    const { db } = createTestDb();
    const instanceId = 'svc-1';

    const seeded = ensureDefaultTab(db, instanceId, 'https://a.example.com');
    expect(listTabs(db, instanceId)).toHaveLength(1);
    expect(getActiveTab(db, instanceId)?.id).toBe(seeded.id);

    const second = createTab(db, instanceId, 'https://b.example.com');
    expect(listTabs(db, instanceId)).toHaveLength(2);
    expect(getActiveTab(db, instanceId)?.id).toBe(second.id); // new tab becomes active

    setActiveTab(db, instanceId, seeded.id);
    expect(getActiveTab(db, instanceId)?.id).toBe(seeded.id);

    closeTab(db, seeded.id);
    expect(listTabs(db, instanceId)).toHaveLength(1);
    expect(getActiveTab(db, instanceId)?.id).toBe(second.id); // closing active promotes the survivor
  });

  it('ensureDefaultTab is idempotent', () => {
    const { db } = createTestDb();
    ensureDefaultTab(db, 'svc-2', 'https://x.example.com');
    ensureDefaultTab(db, 'svc-2', 'https://x.example.com');
    expect(listTabs(db, 'svc-2')).toHaveLength(1);
  });
});
