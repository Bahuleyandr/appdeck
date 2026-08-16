import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LockScreen } from '../../src/renderer/components/LockScreen';
import { useAppStore } from '../../src/renderer/state/appStore';
import { installTestBridge } from './rendererBridge';

describe('LockScreen busy/finally behavior', () => {
  beforeEach(() => {
    installTestBridge();
    useAppStore.setState({ locked: true, lockConfigured: true });
  });
  afterEach(cleanup);

  it('shows the error and re-enables the form when unlock rejects (finally resets busy)', async () => {
    const user = userEvent.setup();
    let release: (error: Error) => void = () => undefined;
    const unlock = vi.fn(
      () =>
        new Promise<boolean>((_, reject) => {
          release = reject;
        })
    );
    useAppStore.setState({ unlock });

    render(<LockScreen />);
    await user.type(screen.getByPlaceholderText('Passphrase'), 'hunter22');
    const button = screen.getByRole('button', { name: 'Unlock' });
    await user.click(button);

    // While the IPC call is in flight the submit button is disabled.
    expect(button).toBeDisabled();

    release(new Error('vault unavailable'));
    await waitFor(() => expect(screen.getByText('vault unavailable')).toBeInTheDocument());
    // A rejected IPC call must never leave the form disabled forever.
    expect(button).toBeEnabled();
    // The typed passphrase is kept so the user can retry without retyping.
    expect(screen.getByPlaceholderText<HTMLInputElement>('Passphrase').value).toBe('hunter22');
  });

  it('shows "Incorrect passphrase." when unlock resolves false and re-enables the button', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ unlock: vi.fn(async () => false) });

    render(<LockScreen />);
    await user.type(screen.getByPlaceholderText('Passphrase'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(screen.getByText('Incorrect passphrase.')).toBeInTheDocument());
    // Button is disabled only because the field still holds text — clearing it proves busy reset.
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeEnabled();
  });

  it('clears the passphrase and error on a successful unlock', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ unlock: vi.fn(async () => true) });

    render(<LockScreen />);
    const input = screen.getByPlaceholderText<HTMLInputElement>('Passphrase');
    await user.type(input, 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.queryByText('Incorrect passphrase.')).not.toBeInTheDocument();
  });

  it('validates passphrase length and match in setup mode without calling setupLock', async () => {
    const user = userEvent.setup();
    const setupLock = vi.fn(async () => undefined);
    useAppStore.setState({ lockConfigured: false, setupLock });

    render(<LockScreen />);
    await user.type(screen.getByPlaceholderText('New passphrase'), 'short');
    await user.type(screen.getByPlaceholderText('Confirm passphrase'), 'short');
    await user.click(screen.getByRole('button', { name: 'Set passphrase & lock' }));
    expect(screen.getByText('Use at least 6 characters.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('New passphrase'), 'er-still-mismatched');
    await user.click(screen.getByRole('button', { name: 'Set passphrase & lock' }));
    expect(screen.getByText('Passphrases do not match.')).toBeInTheDocument();
    expect(setupLock).not.toHaveBeenCalled();
  });
});
