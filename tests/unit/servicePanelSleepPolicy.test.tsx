import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicePanel } from '../../src/renderer/components/procontrols/ServicePanel';
import type { ServiceInstance, SleepPolicy } from '../../src/shared/types';
import { installTestBridge } from './rendererBridge';
import { makeService } from './rendererFixtures';

function renderPanel(service: ServiceInstance) {
  const updateService = vi.fn(async () => undefined);
  render(
    <ServicePanel
      service={service}
      profiles={[]}
      updateService={updateService}
      deleteService={vi.fn(async () => undefined)}
      sleepService={vi.fn(async () => undefined)}
      wakeService={vi.fn(async () => undefined)}
    />
  );
  return { updateService };
}

function idleSelect(): HTMLSelectElement {
  return screen.getByTitle('When an idle service goes to sleep');
}
function deepSelect(): HTMLSelectElement {
  return screen.getByTitle('When a dozing service escalates to deep sleep');
}
function modeSelect(): HTMLSelectElement {
  return screen.getByTitle('How a sleeping service is parked');
}
function savedPolicy(updateService: ReturnType<typeof vi.fn>): SleepPolicy {
  fireEvent.click(screen.getByText('Save service'));
  expect(updateService).toHaveBeenCalledTimes(1);
  const patch = updateService.mock.calls[0]?.[1] as Partial<ServiceInstance>;
  return patch.sleep_policy as SleepPolicy;
}

describe('ServicePanel sleep-policy tri-state controls', () => {
  beforeEach(() => {
    installTestBridge({ 'service:pendingCustomCode': () => [] });
  });
  afterEach(cleanup);

  it('renders "default" for unset thresholds and disables the custom-minutes inputs', () => {
    renderPanel(makeService({ sleep_policy: {} }));

    expect(idleSelect().value).toBe('default');
    expect(deepSelect().value).toBe('default');
    const minuteInputs = screen.getAllByPlaceholderText('Minutes');
    expect(minuteInputs[0]).toBeDisabled();
    expect(minuteInputs[1]).toBeDisabled();
  });

  it('renders "never" for an explicit null and "custom" for a number without collapsing them', () => {
    renderPanel(
      makeService({ sleep_policy: { idleMinutes: null, deepAfterMinutes: 45, mode: 'doze' } })
    );

    expect(idleSelect().value).toBe('never');
    expect(deepSelect().value).toBe('custom');
    expect(modeSelect().value).toBe('doze');
    const minuteInputs = screen.getAllByPlaceholderText('Minutes');
    expect(minuteInputs[1]).toBeEnabled();
    expect((minuteInputs[1] as HTMLInputElement).value).toBe('45');
  });

  it('saves default as undefined, never as null, and merges on top of the stored policy', () => {
    // The stored policy may carry fields this form does not manage (added by a newer version,
    // synced from another device); a save must not strip them.
    const storedPolicy = {
      idleMinutes: 30,
      mode: 'auto',
      deepAfterMinutes: null,
      futureField: 'preserve-me'
    } as SleepPolicy;
    const { updateService } = renderPanel(makeService({ sleep_policy: storedPolicy }));

    fireEvent.change(idleSelect(), { target: { value: 'never' } });
    fireEvent.change(deepSelect(), { target: { value: 'default' } });

    const saved = savedPolicy(updateService);
    expect(saved.idleMinutes).toBeNull();
    expect(saved.deepAfterMinutes).toBeUndefined();
    expect((saved as Record<string, unknown>).futureField).toBe('preserve-me');
  });

  it('saves a custom threshold as the typed number and falls back to default when unparsable', () => {
    const { updateService } = renderPanel(makeService({ sleep_policy: {} }));

    fireEvent.change(idleSelect(), { target: { value: 'custom' } });
    const minuteInputs = screen.getAllByPlaceholderText('Minutes');
    expect(minuteInputs[0]).toBeEnabled();
    fireEvent.change(minuteInputs[0] as HTMLInputElement, { target: { value: '90' } });

    fireEvent.change(deepSelect(), { target: { value: 'custom' } });
    fireEvent.change(minuteInputs[1] as HTMLInputElement, { target: { value: 'not-a-number' } });

    const saved = savedPolicy(updateService);
    expect(saved.idleMinutes).toBe(90);
    // Unparsable custom input degrades to unset/default, never to "never".
    expect(saved.deepAfterMinutes).toBeUndefined();
    expect(saved.mode).toBe('auto');
  });
});
