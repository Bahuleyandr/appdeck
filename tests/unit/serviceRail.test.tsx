import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceRail } from '../../src/renderer/components/ServiceRail';
import { useAppStore } from '../../src/renderer/state/appStore';
import { installTestBridge } from './rendererBridge';
import { makeService } from './rendererFixtures';

describe('ServiceRail', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      services: [],
      selectedServiceIds: [],
      serviceStates: {},
      unread: {},
      settings: { ...useAppStore.getState().settings, show_memory_badges: 'false' }
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders services with unread badges and an add-service empty state', () => {
    installTestBridge();
    const chat = makeService({ id: 'svc-chat', display_name: 'Chat' });
    const mail = makeService({ id: 'svc-mail', display_name: 'Mail' });
    useAppStore.setState({
      services: [chat, mail],
      selectedServiceIds: ['svc-chat'],
      unread: { 'svc-mail': { direct: 120, indirect: 0 } }
    });

    render(<ServiceRail />);

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Mail')).toBeInTheDocument();
    // Direct-unread badge caps at 99+.
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.queryByText('Add your first service')).not.toBeInTheDocument();
  });

  it('polls memory badges every 10s and stops cleanly on unmount', async () => {
    vi.useFakeTimers();
    const bridge = installTestBridge({
      'metrics:get': () => ({
        appMB: 100,
        services: [{ instanceId: 'svc-chat', memoryMB: 123 }]
      })
    });
    useAppStore.setState({
      services: [makeService({ id: 'svc-chat', display_name: 'Chat' })],
      settings: { ...useAppStore.getState().settings, show_memory_badges: 'true' }
    });

    const { unmount } = render(<ServiceRail />);
    const metricCalls = (): number =>
      bridge.invoke.mock.calls.filter(([channel]) => channel === 'metrics:get').length;

    // Immediate poll on mount, then the badge appears once the promise flushes.
    expect(metricCalls()).toBe(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('123 MB')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(metricCalls()).toBe(2);

    // After unmount the interval must be cleared — no more polling.
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(metricCalls()).toBe(2);
  });

  it('does not poll metrics when memory badges are disabled', async () => {
    vi.useFakeTimers();
    const bridge = installTestBridge();
    useAppStore.setState({ services: [makeService()] });

    render(<ServiceRail />);
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    expect(
      bridge.invoke.mock.calls.filter(([channel]) => channel === 'metrics:get')
    ).toHaveLength(0);
  });
});
