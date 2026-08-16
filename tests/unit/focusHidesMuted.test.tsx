// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ServiceRail } from '../../src/renderer/components/ServiceRail';
import { useAppStore } from '../../src/renderer/state/appStore';
import type { FocusModeStatus } from '../../src/shared/types';
import { installTestBridge } from './rendererBridge';
import { makeService } from './rendererFixtures';

function focusStatus(hideMutedServices: boolean): FocusModeStatus {
  return {
    activeMode: {
      id: 'fm-1',
      name: 'Deep Work',
      enabled: true,
      workspace_id: null,
      schedule: [],
      settings: { hideMutedServices },
      created_at: 1,
      updated_at: 1
    },
    nextMode: null,
    now: Date.now(),
    manuallyActivated: true
  };
}

describe('focus mode hides muted services', () => {
  beforeEach(() => {
    localStorage.clear();
    installTestBridge();
    useAppStore.setState({
      services: [
        makeService({ id: 'svc-loud', display_name: 'Loud' }),
        makeService({ id: 'svc-muted', display_name: 'Muted One', muted: true })
      ],
      selectedServiceIds: [],
      serviceStates: {},
      unread: {},
      focusStatus: null,
      settings: { ...useAppStore.getState().settings, show_memory_badges: 'false' }
    });
  });

  afterEach(cleanup);

  it('shows muted services when no focus mode is hiding them', () => {
    render(<ServiceRail />);

    expect(screen.getByText('Loud')).toBeInTheDocument();
    expect(screen.getByText('Muted One')).toBeInTheDocument();
  });

  it('hides muted services while an active mode sets hideMutedServices', async () => {
    useAppStore.setState({ focusStatus: focusStatus(true) });

    render(<ServiceRail />);

    await waitFor(() => expect(screen.queryByText('Muted One')).not.toBeInTheDocument());
    expect(screen.getByText('Loud')).toBeInTheDocument();
  });

  it('keeps them visible when the active mode does not ask to hide them', () => {
    useAppStore.setState({ focusStatus: focusStatus(false) });

    render(<ServiceRail />);

    expect(screen.getByText('Muted One')).toBeInTheDocument();
  });
});
