import { Lock, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAppStore } from '../state/appStore';

export function LockScreen(): JSX.Element | null {
  const { locked, lockConfigured, unlock, setupLock, lock, setLocked } = useAppStore();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!locked) return null;

  const setupMode = !lockConfigured;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (setupMode) {
      if (passphrase.length < 6) {
        setError('Use at least 6 characters.');
        return;
      }
      if (passphrase !== confirm) {
        setError('Passphrases do not match.');
        return;
      }
      setBusy(true);
      await setupLock(passphrase);
      await lock();
      setBusy(false);
      setPassphrase('');
      setConfirm('');
      return;
    }
    setBusy(true);
    const ok = await unlock(passphrase);
    setBusy(false);
    if (ok) {
      setPassphrase('');
      setError(null);
    } else {
      setError('Incorrect passphrase.');
    }
  };

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-shell/95 backdrop-blur">
      <form
        className="flex w-80 flex-col gap-3 rounded-xl border border-line bg-panel p-6 shadow-2xl"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line text-accent">
          {setupMode ? <ShieldCheck size={22} /> : <Lock size={22} />}
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-ink">
            {setupMode ? 'Create a passphrase' : 'AppDeck is locked'}
          </div>
          <div className="mt-1 text-xs text-muted">
            {setupMode
              ? 'Locks AppDeck now and whenever idle. Stored only on this device.'
              : 'Enter your passphrase to continue.'}
          </div>
        </div>
        <input
          className="field w-full"
          autoFocus
          type="password"
          placeholder={setupMode ? 'New passphrase' : 'Passphrase'}
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
        />
        {setupMode && (
          <input
            className="field w-full"
            type="password"
            placeholder="Confirm passphrase"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        )}
        {error ? <div className="text-xs text-red-300">{error}</div> : null}
        <button
          className="app-button w-full"
          disabled={busy || !passphrase || (setupMode && !confirm)}
        >
          {setupMode ? 'Set passphrase & lock' : 'Unlock'}
        </button>
        {setupMode && (
          <button
            type="button"
            className="text-xs text-muted hover:text-ink"
            onClick={() => {
              setLocked(false);
              setPassphrase('');
              setConfirm('');
              setError(null);
            }}
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
