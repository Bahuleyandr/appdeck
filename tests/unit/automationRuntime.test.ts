import { describe, expect, it, vi } from 'vitest';
import { getAutomation, upsertAutomation } from '../../src/main/db/repositories/automations.js';
import { listTasks } from '../../src/main/db/repositories/tasks.js';
import { AutomationRuntime } from '../../src/main/services/automationRuntime.js';
import { createTestDb } from './helpers.js';

describe('automation runtime', () => {
  it('runs matching notification automations and marks them as executed', () => {
    const { db } = createTestDb();
    const rule = upsertAutomation(db, {
      name: 'Urgent notification to task',
      trigger: { type: 'notification', matchText: 'urgent' },
      actions: [
        { type: 'createTask', value: 'Follow up on urgent notification' },
        { type: 'sleepService', targetId: 'svc-1' }
      ]
    });
    const viewManager = {
      sleep: vi.fn(),
      wake: vi.fn(),
      focus: vi.fn()
    };
    const runtime = new AutomationRuntime({
      db,
      viewManager,
      sendPush: vi.fn(),
      sendDataChanged: vi.fn()
    });

    const result = runtime.handleNotification({
      instanceId: 'svc-1',
      title: 'Urgent customer escalation',
      body: ''
    });

    expect(result.ran).toBe(1);
    expect(listTasks(db).map((task) => task.title)).toEqual(['Follow up on urgent notification']);
    expect(viewManager.sleep).toHaveBeenCalledWith('svc-1');
    expect(getAutomation(db, rule.id)?.last_run_at).toEqual(expect.any(Number));
  });
});
