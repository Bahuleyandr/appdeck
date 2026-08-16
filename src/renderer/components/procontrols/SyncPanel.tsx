import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../ipc/client';
import { useAppStore } from '../../state/appStore';

export function SyncPanel({
  syncStatus,
  syncNow
}: {
  syncStatus: ReturnType<typeof useAppStore.getState>['syncStatus'];
  syncNow: () => Promise<void>;
}): JSX.Element {
  const [account, setAccount] = useState<{
    configured: boolean;
    email?: string;
    lastSyncAt?: number;
    lastError?: string;
  }>({
    configured: false
  });
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.account.status().then(setAccount);
  }, []);

  const runAccount = async (fn: () => Promise<void>, done: string): Promise<void> => {
    try {
      setMessage(null);
      await fn();
      setAccount(await api.account.status());
      setMessage(done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const validServer = /^https?:\/\//.test(serverUrl.trim());

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Local Vault Sync</div>
        <div className="space-y-2 text-sm">
          <div className="rounded-md border border-line p-2 text-muted">
            {syncStatus.configured ? syncStatus.folderPath : 'File sync is not configured.'}
          </div>
          <div aria-live="polite" className="rounded-md border border-line p-2 text-muted">
            {syncStatus.lastError
              ? `Last sync failed: ${syncStatus.lastError}`
              : syncStatus.lastSyncAt
                ? `Healthy / Last sync ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
                : 'No sync has run yet.'}
          </div>
          <button
            className="app-button"
            onClick={() => void syncNow().then(() => setMessage('Synced.'))}
          >
            Sync now
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Self-host Server</div>
        <div className="space-y-2">
          <div className="rounded-md border border-line p-2 text-xs text-muted">
            {account.configured
              ? `Signed in as ${account.email ?? ''}${
                  account.lastError
                    ? ` / Last sync failed: ${account.lastError}`
                    : account.lastSyncAt
                      ? ` / Last sync ${new Date(account.lastSyncAt).toLocaleString()}`
                      : ''
                }`
              : 'Cloudflare Worker compatible, end-to-end encrypted.'}
          </div>
          <input
            className="field w-full"
            aria-label="Server URL"
            value={serverUrl}
            placeholder="https://your-worker.example.com"
            onChange={(event) => setServerUrl(event.target.value)}
          />
          <input
            className="field w-full"
            aria-label="Email"
            value={email}
            placeholder="Email"
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="field w-full"
            aria-label="Password"
            type="password"
            value={password}
            placeholder="Password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="app-button"
              disabled={!validServer || !email.trim() || password.length < 8}
              onClick={() =>
                void runAccount(
                  () => api.account.signup(serverUrl, email, password),
                  'Account created.'
                )
              }
            >
              Sign up
            </button>
            <button
              className="app-button"
              disabled={!validServer || !email.trim() || !password}
              onClick={() =>
                void runAccount(() => api.account.login(serverUrl, email, password), 'Logged in.')
              }
            >
              Log in
            </button>
            <button
              className="app-button"
              onClick={() => void runAccount(() => api.account.syncNow(), 'Server synced.')}
            >
              Server sync
            </button>
          </div>
          {serverUrl.trim() && !validServer && (
            <div className="text-xs text-red-300">
              Server URL must start with http:// or https://.
            </div>
          )}
          {message && (
            <div role="status" aria-live="polite" className="text-xs text-muted">
              {message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
