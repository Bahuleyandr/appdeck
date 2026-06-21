import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../state/appStore';

export function LockScreen(): JSX.Element | null {
  const { locked, unlock } = useAppStore();
  const [passphrase, setPassphrase] = useState('');
  const [failed, setFailed] = useState(false);
  if (!locked) return null;
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-shell">
      <form
        className="flex w-80 flex-col items-center gap-3 rounded-md border border-line bg-panel p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void unlock(passphrase).then((ok) => {
            setFailed(!ok);
            if (ok) setPassphrase('');
          });
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-line text-muted">
          <Lock size={22} />
        </div>
        <input className="field w-full" autoFocus type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        {failed ? <div className="text-xs text-red-300">Unlock failed</div> : null}
        <button className="app-button w-full" disabled={!passphrase}>
          Unlock
        </button>
      </form>
    </div>
  );
}
