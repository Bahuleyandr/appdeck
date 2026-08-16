import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxPanel } from '../../src/renderer/components/InboxPanel';
import { useAppStore } from '../../src/renderer/state/appStore';
import { installTestBridge, type TestBridge } from './rendererBridge';
import { makeNotification, makeService } from './rendererFixtures';

describe('InboxPanel archive search debounce/cancel', () => {
  let bridge: TestBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = installTestBridge({
      'notification:lastSeen': () => ({ at: null }),
      'aiRun:list': () => [],
      'notification:list': () => [makeNotification({ title: 'Browsed' })],
      'notification:search': (payload) => {
        const { q } = payload as { q: string };
        return [makeNotification({ title: `Match for ${q}` })];
      }
    });
    useAppStore.setState({
      inboxOpen: true,
      notifications: [],
      services: [makeService({ id: 'svc-1', display_name: 'Chat' })],
      aiConfigured: false
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const searchCalls = (): unknown[][] =>
    bridge.invoke.mock.calls.filter(([channel]) => channel === 'notification:search');

  async function openArchive(): Promise<void> {
    render(<InboxPanel />);
    fireEvent.click(screen.getByTitle('Archive — everything, searchable'));
    // Entering archive mode debounces an initial browse (list) fetch.
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
  }

  it('debounces typing: rapid keystrokes produce one search with the final query', async () => {
    await openArchive();
    const input = screen.getByPlaceholderText('Search every notification…');

    // Three keystrokes inside the 150ms window: earlier timers are cancelled.
    fireEvent.change(input, { target: { value: 'i' } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: 'in' } });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: 'invoice' } });
    expect(searchCalls()).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0]?.[1]).toEqual({ q: 'invoice' });
    expect(screen.getByText('Match for invoice')).toBeInTheDocument();
  });

  it('a stale in-flight result is dropped after the query changes (cancelled effect)', async () => {
    let releaseSlow: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const results: Record<string, string> = { slow: 'Stale result', fast: 'Fresh result' };
    bridge = installTestBridge({
      'notification:lastSeen': () => ({ at: null }),
      'aiRun:list': () => [],
      'notification:list': () => [],
      'notification:search': async (payload) => {
        const { q } = payload as { q: string };
        if (q === 'slow') await slow;
        return [makeNotification({ title: results[q] ?? q })];
      }
    });

    await openArchive();
    const input = screen.getByPlaceholderText('Search every notification…');

    fireEvent.change(input, { target: { value: 'slow' } });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    // Query changes while the slow search is still in flight.
    fireEvent.change(input, { target: { value: 'fast' } });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText('Fresh result')).toBeInTheDocument();

    // The slow response lands late: the cancelled effect must not overwrite the fresh list.
    releaseSlow();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh result')).toBeInTheDocument();
  });

  it('leaving archive mode before the debounce fires cancels the pending fetch', async () => {
    render(<InboxPanel />);
    fireEvent.click(screen.getByTitle('Archive — everything, searchable'));
    // Toggle straight back out before the 150ms debounce elapses.
    fireEvent.click(screen.getByTitle('Archive — everything, searchable'));
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    const listCalls = bridge.invoke.mock.calls.filter(
      ([channel]) => channel === 'notification:list'
    );
    expect(listCalls).toHaveLength(0);
    expect(searchCalls()).toHaveLength(0);
  });
});
