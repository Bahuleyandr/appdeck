// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommandPalette } from '../../src/renderer/components/CommandPalette';
import { useAppStore } from '../../src/renderer/state/appStore';
import type { PaletteItem } from '../../src/shared/types';

const ITEMS: PaletteItem[] = Array.from({ length: 20 }, (_, index) => ({
  type: 'service',
  id: `svc-${index}`,
  label: `Service ${index}`,
  action: 'select-service'
}));

const invoke = vi.fn((channel: string, payload?: unknown) => {
  void payload;
  if (channel === 'palette:query') return Promise.resolve(ITEMS);
  return Promise.resolve(undefined);
});

const scrollIntoView = vi.fn();

describe('CommandPalette keyboard and a11y', () => {
  beforeEach(() => {
    invoke.mockClear();
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, 'appdeck', {
      configurable: true,
      value: { invoke, on: vi.fn(() => () => undefined) }
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    useAppStore.setState({ commandOpen: true });
  });

  afterEach(cleanup);

  async function renderPalette(): Promise<HTMLInputElement> {
    render(<CommandPalette />);
    const input = await screen.findByRole('combobox');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    return input as HTMLInputElement;
  }

  it('exposes combobox/listbox/option semantics', async () => {
    const input = await renderPalette();
    const listbox = screen.getByRole('listbox');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(listbox.id).toBeTruthy();

    const options = screen.getAllByRole('option');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
    // The input must point a screen reader at the active option.
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
  });

  it('moves aria-activedescendant with the arrow keys', async () => {
    const input = await renderPalette();

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
  });

  it('keeps the selected row scrolled into view', async () => {
    const input = await renderPalette();
    scrollIntoView.mockClear();

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Without this, arrowing past the ~9 visible rows moves the highlight off-screen and Enter
    // activates something the user cannot see.
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('closes on Escape even when focus has moved off the input', async () => {
    await renderPalette();
    const option = screen.getAllByRole('option')[0];
    if (!option) throw new Error('Expected an option');

    fireEvent.keyDown(option, { key: 'Escape' });

    await waitFor(() => expect(useAppStore.getState().commandOpen).toBe(false));
  });
});
