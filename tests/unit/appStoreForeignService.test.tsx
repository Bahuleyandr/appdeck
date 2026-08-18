// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/renderer/state/appStore';

/**
 * `event:notification-clicked` can carry a service from a workspace that is not on screen — the
 * tray quick view lists every workspace's services, and OS-notification, link-routing and
 * automation clicks all arrive from background workspaces. Writing such an id into the current
 * workspace's layout leaves TileLayout unable to resolve it, so it falls back to displaying
 * arbitrary services (and persists the foreign id until the next load()).
 */
const OWN_SERVICE = { id: 'svc-a1', display_name: 'A1', disabled: false };

function installBridge(): ReturnType<typeof vi.fn> {
  const invoke = vi.fn(async () => undefined);
  Object.defineProperty(window, 'appdeck', {
    configurable: true,
    value: { invoke, on: vi.fn(() => () => undefined) }
  });
  return invoke;
}

function channelsCalled(invoke: ReturnType<typeof vi.fn>): string[] {
  return invoke.mock.calls.map((call) => call[0] as string);
}

describe('appStore.selectService workspace scoping', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    useAppStore.setState({
      selectedWorkspaceId: 'ws-a',
      services: [OWN_SERVICE] as never,
      selectedServiceIds: ['svc-a1'],
      layoutMode: 'single'
    });
  });

  it('ignores a service that belongs to another workspace', async () => {
    const invoke = installBridge();

    await useAppStore.getState().selectService('svc-b1');

    expect(channelsCalled(invoke)).not.toContain('layout:set');
    expect(channelsCalled(invoke)).not.toContain('view:focus');
    expect(useAppStore.getState().selectedServiceIds).toEqual(['svc-a1']);
  });

  it('still selects a service that belongs to the current workspace', async () => {
    // Positive control: without this the assertions above would also pass if selectService were
    // simply broken for every input.
    useAppStore.setState({ selectedServiceIds: [] });
    const invoke = installBridge();

    await useAppStore.getState().selectService('svc-a1');

    expect(channelsCalled(invoke)).toContain('layout:set');
    expect(useAppStore.getState().selectedServiceIds).toEqual(['svc-a1']);
  });

  it('ignores a disabled service in the current workspace', async () => {
    useAppStore.setState({ services: [{ ...OWN_SERVICE, disabled: true }] as never });
    const invoke = installBridge();

    await useAppStore.getState().selectService('svc-a1');

    expect(channelsCalled(invoke)).not.toContain('layout:set');
  });
});
