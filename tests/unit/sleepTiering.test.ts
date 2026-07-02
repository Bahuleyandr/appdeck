import { describe, expect, it, vi } from 'vitest';
import {
  createServiceInstance,
  updateServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { SleepManager } from '../../src/main/services/sleepManager.js';
import { sleepTier } from '../../src/main/services/sleepPolicy.js';
import type { ServiceViewManager } from '../../src/main/views/serviceViewManager.js';
import { createTestDb } from './helpers.js';

function makeService(
  context: ReturnType<typeof createTestDb>,
  displayName: string,
  patch: Parameters<typeof updateServiceInstance>[3] = {}
) {
  const workspace = listWorkspaces(context.db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  const service = createServiceInstance(context.db, context.deviceId, {
    recipeId: 'whatsapp',
    workspaceId: workspace.id,
    displayName
  });
  return Object.keys(patch).length
    ? updateServiceInstance(context.db, context.deviceId, service.id, patch)
    : service;
}

interface FakeViewsOptions {
  lastActiveAgoMs?: number;
  dozing?: boolean;
  dozeStartedAgoMs?: number;
  visible?: boolean;
}

function fakeViews(options: FakeViewsOptions = {}) {
  const sleep = vi.fn();
  const doze = vi.fn();
  const views = {
    trimHiddenViews: vi.fn(),
    getLastActiveAt: () => Date.now() - (options.lastActiveAgoMs ?? 60 * 60_000),
    isFocused: () => false,
    isAudible: () => false,
    isDozing: () => options.dozing ?? false,
    dozeStartedAt: () =>
      options.dozing ? Date.now() - (options.dozeStartedAgoMs ?? 0) : null,
    isInstanceVisible: () => options.visible ?? false,
    sleep,
    doze
  };
  return { views: views as unknown as ServiceViewManager, sleep, doze };
}

describe('sleep tiering', () => {
  it('picks doze for unmuted services and deep sleep for muted ones in auto mode', () => {
    const context = createTestDb();
    const unmuted = makeService(context, 'Chatty');
    const muted = makeService(context, 'Quiet', { muted: true });

    expect(sleepTier(unmuted)).toBe('doze');
    expect(sleepTier(muted)).toBe('deep');
  });

  it('honors explicit doze/deep modes over the auto heuristic', () => {
    const context = createTestDb();
    const forcedDeep = makeService(context, 'Forced Deep', {
      sleep_policy: { mode: 'deep' }
    });
    const forcedDoze = makeService(context, 'Forced Doze', {
      muted: true,
      sleep_policy: { mode: 'doze' }
    });

    expect(sleepTier(forcedDeep)).toBe('deep');
    expect(sleepTier(forcedDoze)).toBe('doze');
  });

  it('dozes an idle unmuted service instead of destroying it', () => {
    const context = createTestDb();
    const service = makeService(context, 'Idle Chat');
    const { views, sleep, doze } = fakeViews();

    new SleepManager(context.db, views).tick();

    expect(doze).toHaveBeenCalledWith(service.id);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('deep-sleeps an idle muted service', () => {
    const context = createTestDb();
    const service = makeService(context, 'Muted Chat', { muted: true });
    const { views, sleep, doze } = fakeViews();

    new SleepManager(context.db, views).tick();

    expect(sleep).toHaveBeenCalledWith(service.id);
    expect(doze).not.toHaveBeenCalled();
  });

  it('never dozes a currently visible pane', () => {
    const context = createTestDb();
    makeService(context, 'On Screen');
    const { views, sleep, doze } = fakeViews({ visible: true });

    new SleepManager(context.db, views).tick();

    expect(doze).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('escalates a long-dozing service to deep sleep when deepAfterMinutes is set', () => {
    const context = createTestDb();
    const service = makeService(context, 'Escalate', {
      sleep_policy: { deepAfterMinutes: 1 }
    });
    const { views, sleep } = fakeViews({ dozing: true, dozeStartedAgoMs: 2 * 60_000 });

    new SleepManager(context.db, views).tick();

    expect(sleep).toHaveBeenCalledWith(service.id);
  });

  it('never escalates when deepAfterMinutes is unset', () => {
    const context = createTestDb();
    makeService(context, 'Doze Forever');
    const { views, sleep, doze } = fakeViews({ dozing: true, dozeStartedAgoMs: 8 * 60 * 60_000 });

    new SleepManager(context.db, views).tick();

    expect(sleep).not.toHaveBeenCalled();
    expect(doze).not.toHaveBeenCalled();
  });
});
