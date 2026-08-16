// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/renderer/state/appStore';

const WORKSPACES = [
  { id: 'ws-a', name: 'A', disabled: false },
  { id: 'ws-b', name: 'B', disabled: false }
];

function layout(workspaceId: string) {
  return { workspace_id: workspaceId, mode: 'single', selected_service_ids: [], tile_sizing: {} };
}

/** Resolves `service:list` for `slowWorkspaceId` only when the returned release() is called. */
function makeBridge(slowWorkspaceId: string) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const invoke = vi.fn(async (channel: string, payload?: unknown) => {
    switch (channel) {
      case 'workspace:list':
        return WORKSPACES;
      case 'profile:list':
      case 'recipe:catalog':
      case 'task:list':
        return [];
      case 'lock:status':
        return { locked: false, configured: false };
      case 'sync:status':
        return { configured: false };
      case 'settings:get':
        return { ...useAppStore.getState().settings, onboarded: 'true' };
      case 'notification:unreadCount':
        return 0;
      case 'ai:status':
        return { configured: false };
      case 'service:list': {
        const { workspaceId } = payload as { workspaceId: string };
        if (workspaceId === slowWorkspaceId) await gate;
        return [];
      }
      case 'layout:get':
        return layout((payload as { workspaceId: string }).workspaceId);
      default:
        return undefined;
    }
  });
  return { invoke, release: () => release() };
}

describe('appStore load/selectWorkspace race', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    useAppStore.setState({ selectedWorkspaceId: 'ws-a', workspaces: [], loading: true });
  });

  it('does not revert a workspace switch that lands while load() is in flight', async () => {
    const { invoke, release } = makeBridge('ws-a');
    Object.defineProperty(window, 'appdeck', {
      configurable: true,
      value: { invoke, on: vi.fn(() => () => undefined) }
    });

    // load() resolves phase 1, computes selectedWorkspaceId = ws-a, then blocks on service:list.
    const loading = useAppStore.getState().load();
    // Meanwhile the user switches to ws-b, and that completes first.
    useAppStore.setState({ workspaces: WORKSPACES as never });
    await useAppStore.getState().selectWorkspace('ws-b');
    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-b');

    // The stale load now finishes. It must not drag the UI back to ws-a.
    release();
    await loading;

    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-b');
  });

  it('still applies a load when no switch intervened', async () => {
    const { invoke, release } = makeBridge('none');
    Object.defineProperty(window, 'appdeck', {
      configurable: true,
      value: { invoke, on: vi.fn(() => () => undefined) }
    });
    release();

    await useAppStore.getState().load();

    expect(useAppStore.getState().loading).toBe(false);
    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-a');
    expect(useAppStore.getState().workspaces).toHaveLength(2);
  });
});
