import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../src/renderer/state/appStore';
import { installTestBridge, mockMatchMedia, storeLoadHandlers } from './rendererBridge';

const WORKSPACES_A = [{ id: 'ws-a', name: 'A', disabled: false }];
const WORKSPACES_B = [{ id: 'ws-b', name: 'B', disabled: false }];

describe('appStore load error/retry and sequence guard', () => {
  beforeEach(() => {
    mockMatchMedia();
    useAppStore.setState({
      loading: true,
      loadError: null,
      workspaces: [],
      selectedWorkspaceId: null
    });
  });

  it('surfaces a load failure instead of stranding the splash, then recovers on retry', async () => {
    let fail = true;
    installTestBridge(
      storeLoadHandlers({
        'workspace:list': () => {
          if (fail) throw new Error('db locked');
          return WORKSPACES_A;
        }
      })
    );

    await useAppStore.getState().load();
    expect(useAppStore.getState().loading).toBe(false);
    expect(useAppStore.getState().loadError).toBe('db locked');

    // The retry button calls load() again; a success must clear the error state.
    fail = false;
    await useAppStore.getState().load();
    expect(useAppStore.getState().loadError).toBeNull();
    expect(useAppStore.getState().workspaces).toHaveLength(1);
    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-a');
  });

  it('an older load resolving late does not clobber a newer load (sequence guard)', async () => {
    let call = 0;
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    installTestBridge(
      storeLoadHandlers({
        'workspace:list': async () => {
          call += 1;
          if (call === 1) {
            await firstGate;
            return WORKSPACES_A;
          }
          return WORKSPACES_B;
        }
      })
    );

    // First load blocks; a second (newer) load starts and finishes with fresher data.
    const stale = useAppStore.getState().load();
    await useAppStore.getState().load();
    expect(useAppStore.getState().workspaces).toEqual(WORKSPACES_B);
    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-b');

    // Now the stale load resolves. Its data must be discarded wholesale.
    releaseFirst();
    await stale;
    expect(useAppStore.getState().workspaces).toEqual(WORKSPACES_B);
    expect(useAppStore.getState().selectedWorkspaceId).toBe('ws-b');
  });

  it('a stale failure does not overwrite a newer successful load', async () => {
    let call = 0;
    let rejectFirst: (error: Error) => void = () => undefined;
    const firstGate = new Promise<never>((_, reject) => {
      rejectFirst = reject;
    });
    installTestBridge(
      storeLoadHandlers({
        'workspace:list': async () => {
          call += 1;
          if (call === 1) return firstGate;
          return WORKSPACES_B;
        }
      })
    );

    const stale = useAppStore.getState().load();
    await useAppStore.getState().load();
    expect(useAppStore.getState().loadError).toBeNull();

    rejectFirst(new Error('stale failure'));
    await stale;
    // The old failure lost the race; it must not paint the retry screen over good data.
    expect(useAppStore.getState().loadError).toBeNull();
    expect(useAppStore.getState().workspaces).toEqual(WORKSPACES_B);
  });
});
