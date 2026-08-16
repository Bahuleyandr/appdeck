import { describe, expect, it } from 'vitest';
import { closeTab, createTab, ensureDefaultTab, listTabs, setActiveTab } from '../../src/main/db/repositories/serviceTabs.js';
import { createTestDb } from './helpers.js';

describe('service tabs repo', () => {
  it('seeds a default tab and tracks the active tab across create/close', () => {
    const { db } = createTestDb();
    const instanceId = 'svc-1';
    const activeTabId = (): string | undefined =>
      listTabs(db, instanceId).find((tab) => tab.active)?.id;

    const seeded = ensureDefaultTab(db, instanceId, 'https://a.example.com');
    expect(listTabs(db, instanceId)).toHaveLength(1);
    expect(activeTabId()).toBe(seeded.id);

    const second = createTab(db, instanceId, 'https://b.example.com');
    expect(listTabs(db, instanceId)).toHaveLength(2);
    expect(activeTabId()).toBe(second.id); // new tab becomes active

    setActiveTab(db, instanceId, seeded.id);
    expect(activeTabId()).toBe(seeded.id);

    closeTab(db, seeded.id);
    expect(listTabs(db, instanceId)).toHaveLength(1);
    expect(activeTabId()).toBe(second.id); // closing active promotes the survivor
  });

  it('ensureDefaultTab is idempotent', () => {
    const { db } = createTestDb();
    ensureDefaultTab(db, 'svc-2', 'https://x.example.com');
    ensureDefaultTab(db, 'svc-2', 'https://x.example.com');
    expect(listTabs(db, 'svc-2')).toHaveLength(1);
  });
});
