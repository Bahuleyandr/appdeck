import { describe, expect, it, vi } from 'vitest';
import { listAiRuns } from '../../src/main/db/repositories/aiRuns.js';
import { upsertAiPrompt } from '../../src/main/db/repositories/aiPrompts.js';
import { getAutomation, upsertAutomation } from '../../src/main/db/repositories/automations.js';
import { listTasks } from '../../src/main/db/repositories/tasks.js';
import { AutomationRuntime } from '../../src/main/services/automationRuntime.js';
import { createTestDb } from './helpers.js';

const ALWAYS = [{ from: '00:00', to: '23:59', days: [0, 1, 2, 3, 4, 5, 6] }];

function makeRuntime(
  db: ReturnType<typeof createTestDb>['db'],
  extras: Partial<ConstructorParameters<typeof AutomationRuntime>[0]> = {}
) {
  const sendPush = vi.fn();
  const runtime = new AutomationRuntime({
    db,
    viewManager: { sleep: vi.fn(), wake: vi.fn(), focus: vi.fn() },
    sendPush,
    sendDataChanged: vi.fn(),
    ...extras
  });
  return { runtime, sendPush };
}

function fakeAi(overrides: Partial<{ configured: boolean; failPrompt: boolean }> = {}) {
  const brief = vi.fn(async () => ({ text: 'daily brief' }));
  const runPrompt = vi.fn(async (prompt: string) => {
    if (overrides.failPrompt) throw new Error('provider down');
    return { text: `ran:${prompt}` };
  });
  return {
    ai: {
      status: () => ({ configured: overrides.configured ?? true }),
      brief,
      runPrompt
    },
    brief,
    runPrompt
  };
}

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

  it('fires a schedule automation once per window occurrence, not every tick', () => {
    const { db } = createTestDb();
    upsertAutomation(db, {
      name: 'Hourly-ish',
      trigger: { type: 'schedule', schedule: ALWAYS },
      actions: [{ type: 'createTask', value: 'tick' }]
    });
    const { runtime } = makeRuntime(db);
    // 2026-07-06 is a Monday.
    const monday10 = new Date(2026, 6, 6, 10, 0).getTime();

    expect(runtime.handleSchedule(monday10).ran).toBe(1);
    expect(runtime.handleSchedule(monday10 + 60_000).ran).toBe(0);
    expect(runtime.handleSchedule(monday10 + 8 * 60 * 60_000).ran).toBe(0);

    const tuesday10 = new Date(2026, 6, 7, 10, 0).getTime();
    expect(runtime.handleSchedule(tuesday10).ran).toBe(1);
    expect(listTasks(db)).toHaveLength(2);
  });

  it('runAiPrompt runs a saved prompt and records the result', async () => {
    const { db } = createTestDb();
    const prompt = upsertAiPrompt(db, { title: 'Digest', prompt: 'Summarize my day' });
    upsertAutomation(db, {
      name: 'Digest on startup',
      trigger: { type: 'startup' },
      actions: [{ type: 'runAiPrompt', targetId: prompt.id }]
    });
    const { ai, runPrompt } = fakeAi();
    const { runtime, sendPush } = makeRuntime(db, { aiService: ai });

    runtime.handleStartup();
    await runtime.settle();

    expect(runPrompt).toHaveBeenCalledWith('Summarize my day');
    const runs = listAiRuns(db);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: 'prompt', title: 'Digest', text: 'ran:Summarize my day' });
    expect(sendPush).toHaveBeenCalledWith('event:ai-run', expect.objectContaining({ kind: 'prompt' }));
  });

  it('runAiPrompt falls back to the built-in briefing when no prompt is given', async () => {
    const { db } = createTestDb();
    upsertAutomation(db, {
      name: 'Morning briefing',
      trigger: { type: 'startup' },
      actions: [{ type: 'runAiPrompt' }]
    });
    const { ai, brief } = fakeAi();
    const { runtime } = makeRuntime(db, { aiService: ai });

    runtime.handleStartup();
    await runtime.settle();

    expect(brief).toHaveBeenCalled();
    expect(listAiRuns(db)[0]).toMatchObject({ kind: 'brief', text: 'daily brief' });
  });

  it('skips AI actions quietly when no provider is configured', async () => {
    const { db } = createTestDb();
    upsertAutomation(db, {
      name: 'No provider',
      trigger: { type: 'startup' },
      actions: [{ type: 'runAiPrompt' }, { type: 'createTask', value: 'still runs' }]
    });
    const { ai, brief } = fakeAi({ configured: false });
    const { runtime } = makeRuntime(db, { aiService: ai });

    runtime.handleStartup();
    await runtime.settle();

    expect(brief).not.toHaveBeenCalled();
    expect(listAiRuns(db)).toHaveLength(0);
    expect(listTasks(db).map((task) => task.title)).toEqual(['still runs']);
  });

  it('isolates AI failures from the rest of the rule', async () => {
    const { db } = createTestDb();
    upsertAutomation(db, {
      name: 'Flaky AI',
      trigger: { type: 'startup' },
      actions: [{ type: 'runAiPrompt', value: 'Explode' }, { type: 'createTask', value: 'safe' }]
    });
    const { ai } = fakeAi({ failPrompt: true });
    const { runtime } = makeRuntime(db, { aiService: ai });

    runtime.handleStartup();
    await expect(runtime.settle()).resolves.toBeUndefined();

    expect(listAiRuns(db)).toHaveLength(0);
    expect(listTasks(db).map((task) => task.title)).toEqual(['safe']);
  });
});
