// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { TileLayout } from '../../src/renderer/components/TileLayout';
import { useAppStore } from '../../src/renderer/state/appStore';
import type { ServiceInstance, ServiceTab } from '../../src/shared/types';

interface BoundsPayload {
  entries: Array<{ viewId: string }>;
  visibleIds: string[];
}

// The second parameter is unused here but must exist so mock.calls is typed as a 2-tuple —
// boundsCalls() reads the payload out of index 1.
const invoke = vi.fn((channel: string, payload?: unknown) => {
  void payload;
  if (channel === 'tab:list') return Promise.resolve([]);
  return Promise.resolve(undefined);
});

function service(id: string): ServiceInstance {
  return {
    id,
    recipe_id: 'whatsapp',
    profile_id: null,
    display_name: id,
    partition_key: `persist:svc-${id}`,
    color: null,
    icon_path: null,
    pinned: false,
    muted: false,
    disabled: false,
    sleep_policy: {},
    custom_css: null,
    custom_js: null,
    proxy: null,
    user_agent: null,
    last_url: null,
    zoom_factor: null,
    spellcheck: true,
    updated_at: 1,
    deleted_at: null,
    rev: 1,
    origin_device: 'dev'
  };
}

function tab(id: string): ServiceTab {
  return { id, service_instance_id: 'svc-1', url: 'https://example.com', title: null, active: true, position: 0 } as ServiceTab;
}

/** The bounds sync runs inside requestAnimationFrame; let one frame land. */
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function boundsCalls(): BoundsPayload[] {
  return invoke.mock.calls
    .filter(([channel]) => channel === 'view:setBounds')
    .map(([, payload]) => payload as BoundsPayload);
}

describe('TileLayout native view bounds', () => {
  beforeEach(() => {
    invoke.mockClear();
    Object.defineProperty(window, 'appdeck', {
      configurable: true,
      value: { invoke, on: vi.fn(() => () => undefined) }
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    useAppStore.setState({
      services: [service('svc-1')],
      selectedServiceIds: ['svc-1'],
      layoutMode: 'single',
      serviceStates: { 'svc-1': 'ready' },
      tabs: { 'svc-1': [tab('tab-1')] },
      settings: { ...useAppStore.getState().settings, onboarded: 'true' },
      locked: false,
      settingsOpen: false,
      catalogOpen: false,
      proControlsOpen: false,
      commandOpen: false,
      dashboardOpen: false,
      taskPanelOpen: false,
      inboxOpen: false
    });
  });

  afterEach(cleanup);

  it('publishes bounds for a visible service', async () => {
    render(<TileLayout />);
    await flushFrame();

    await waitFor(() => expect(boundsCalls().length).toBeGreaterThan(0));
    const latest = boundsCalls().at(-1);
    expect(latest?.visibleIds).toEqual(['svc-1#tab-1']);
  });

  it('clears bounds when the last visible service goes away', async () => {
    render(<TileLayout />);
    await flushFrame();
    expect(boundsCalls().at(-1)?.visibleIds).toEqual(['svc-1#tab-1']);

    // Removing the last service swaps in the empty state, which has no bounds container. The
    // previously attached native view must be told to detach, or it keeps painting on top.
    await act(async () => {
      useAppStore.setState({ services: [], selectedServiceIds: [] });
    });
    await flushFrame();

    await waitFor(() => {
      const latest = boundsCalls().at(-1);
      expect(latest?.entries).toEqual([]);
      expect(latest?.visibleIds).toEqual([]);
    });
  });
});
