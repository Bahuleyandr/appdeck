import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiProvider, AiStatus, AppMetrics, ExtensionRecord } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function Settings(): JSX.Element | null {
  const {
    settingsOpen,
    setSettingsOpen,
    settings,
    setSettingValue,
    aiConfigured,
    syncStatus,
    configureSync,
    syncNow,
    setupLock,
    load
  } = useAppStore();
  const [folder, setFolder] = useState('');
  const [syncPassphrase, setSyncPassphrase] = useState('');
  const [recovery, setRecovery] = useState<string | null>(null);
  const [lockPassphrase, setLockPassphrase] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiLocalOnly, setAiLocalOnly] = useState(false);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [extensionPath, setExtensionPath] = useState('');
  const [ferdium, setFerdium] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [account, setAccount] = useState<{ configured: boolean; email?: string }>({
    configured: false
  });
  const [serverUrl, setServerUrl] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accMsg, setAccMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    void api.extensions.list().then(setExtensions);
    void api.metrics.get().then(setMetrics);
    void api.ai.status().then((status) => {
      setAiStatus(status);
      setAiProvider(status.provider);
      setAiModel(status.model);
      setAiBaseUrl(status.baseUrl ?? '');
      setAiLocalOnly(status.localOnly);
    });
    void api.update.status().then((status) => setUpdateStatus(status.status));
    void api.account.status().then(setAccount);
    return api.on('event:update-status', (payload) =>
      setUpdateStatus((payload as { status?: string }).status ?? '')
    );
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const refreshExtensions = (): void => void api.extensions.list().then(setExtensions);
  const refreshAi = (): Promise<void> =>
    api.ai.status().then((status) => {
      setAiStatus(status);
      setAiProvider(status.provider);
      setAiModel(status.model);
      setAiBaseUrl(status.baseUrl ?? '');
      setAiLocalOnly(status.localOnly);
    });

  const runAccount = async (fn: () => Promise<void>, ok: string): Promise<void> => {
    setAccMsg(null);
    try {
      await fn();
      setAccMsg(ok);
      setAccount(await api.account.status());
      setAccPassword('');
    } catch (error) {
      setAccMsg(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55">
      <section className="flex max-h-[88vh] w-[680px] flex-col rounded-md border border-line bg-panel shadow-2xl">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="text-sm font-semibold">Settings</div>
          <button className="icon-button" title="Close" onClick={() => setSettingsOpen(false)}>
            <X size={16} />
          </button>
        </header>
        <div className="space-y-6 overflow-y-auto p-4">
          <section>
            <div className="mb-2 text-sm font-semibold">Appearance</div>
            <div className="flex items-center gap-2">
              <span className="w-28 text-xs text-muted">Theme</span>
              <select
                className="field flex-1"
                value={settings.theme}
                onChange={(event) => void setSettingValue('theme', event.target.value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </section>

          <Toggle
            label="Do Not Disturb"
            value={settings.global_dnd === 'true'}
            onChange={(v) => void setSettingValue('global_dnd', String(v))}
          />
          <Toggle
            label="Block trackers & ad pixels"
            value={settings.tracker_block === 'true'}
            onChange={(v) => void setSettingValue('tracker_block', String(v))}
          />
          <Toggle
            label="Close to tray"
            value={settings.close_to_tray === 'true'}
            onChange={(v) => void setSettingValue('close_to_tray', String(v))}
          />
          <Toggle
            label="Minimize to tray"
            value={settings.minimize_to_tray === 'true'}
            onChange={(v) => void setSettingValue('minimize_to_tray', String(v))}
          />

          <section>
            <div className="mb-2 text-sm font-semibold">Global hotkey</div>
            <input
              className="field w-full"
              value={settings.global_hotkey}
              placeholder="CommandOrControl+Shift+Space"
              onChange={(event) => void setSettingValue('global_hotkey', event.target.value)}
            />
          </section>

          <section>
            <div className="mb-1 text-sm font-semibold">AI assistant</div>
            <div className="mb-2 text-xs text-muted">
              {(aiStatus?.configured ?? aiConfigured)
                ? `${aiProvider} / ${aiModel}`
                : 'Not configured.'}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="field"
                value={aiProvider}
                onChange={(event) => setAiProvider(event.target.value as AiProvider)}
              >
                {(['anthropic', 'openai', 'gemini', 'ollama', 'compatible'] as const).map(
                  (provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  )
                )}
              </select>
              <input
                className="field"
                value={aiModel}
                placeholder="Model"
                onChange={(event) => setAiModel(event.target.value)}
              />
              <input
                className="field sm:col-span-2"
                value={aiBaseUrl}
                placeholder="Base URL for OpenAI-compatible, Gemini, or Ollama"
                onChange={(event) => setAiBaseUrl(event.target.value)}
              />
              <input
                className="field sm:col-span-2"
                type="password"
                value={aiKey}
                placeholder={aiProvider === 'ollama' ? 'Optional API key' : 'API key'}
                onChange={(event) => setAiKey(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
                <input
                  type="checkbox"
                  checked={aiLocalOnly}
                  onChange={(event) => setAiLocalOnly(event.target.checked)}
                />
                Local only
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="app-button"
                disabled={
                  !aiModel.trim() ||
                  (aiProvider !== 'ollama' &&
                    aiProvider !== 'compatible' &&
                    !aiKey.trim() &&
                    !(aiStatus?.configured ?? aiConfigured))
                }
                onClick={() =>
                  void api.ai
                    .configure({
                      apiKey: aiKey.trim() || undefined,
                      provider: aiProvider,
                      model: aiModel.trim(),
                      baseUrl: aiBaseUrl.trim() || undefined,
                      localOnly: aiLocalOnly
                    })
                    .then(() => {
                      setAiKey('');
                      void refreshAi();
                      void load();
                    })
                }
              >
                Save
              </button>
              {(aiStatus?.configured ?? aiConfigured) && (
                <button
                  className="app-button"
                  onClick={() =>
                    void api.ai.clearKey().then(() => {
                      void refreshAi();
                      void load();
                    })
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold">Chrome extensions</div>
            <div className="flex gap-2">
              <input
                className="field flex-1"
                value={extensionPath}
                placeholder="Path to unpacked extension folder"
                onChange={(event) => setExtensionPath(event.target.value)}
              />
              <button
                className="app-button"
                disabled={!extensionPath.trim()}
                onClick={() =>
                  void api.extensions.add(extensionPath).then(() => {
                    setExtensionPath('');
                    refreshExtensions();
                  })
                }
              >
                Add
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {extensions.map((extension) => (
                <div
                  key={extension.id}
                  className="flex items-center justify-between rounded-md border border-line px-2 py-1 text-xs"
                >
                  <span className="truncate">{extension.name}</span>
                  <button
                    className="text-muted hover:text-white"
                    onClick={() => void api.extensions.remove(extension.id).then(refreshExtensions)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {extensions.length === 0 && (
                <div className="text-xs text-muted">
                  None. Extensions load into services on next open.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold">Import from Ferdium / Rambox</div>
            <textarea
              className="field h-20 w-full py-2"
              value={ferdium}
              placeholder="Paste exported services JSON here"
              onChange={(event) => setFerdium(event.target.value)}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                className="app-button"
                disabled={!ferdium.trim()}
                onClick={() =>
                  void api.importer
                    .ferdium(ferdium)
                    .then((result) => {
                      setImportMsg(`Imported ${result.created}, skipped ${result.skipped}.`);
                      setFerdium('');
                    })
                    .catch((error: unknown) =>
                      setImportMsg(error instanceof Error ? error.message : String(error))
                    )
                }
              >
                Import
              </button>
              {importMsg && <span className="text-xs text-muted">{importMsg}</span>}
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold">Sync</div>
            <div className="mb-2 text-xs text-muted">
              {syncStatus.configured ? syncStatus.folderPath : 'Not configured'}
            </div>
            <div className="grid grid-cols-[1fr_160px] gap-2">
              <input
                className="field"
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="Folder path"
              />
              <input
                className="field"
                value={syncPassphrase}
                onChange={(event) => setSyncPassphrase(event.target.value)}
                placeholder="Passphrase"
                type="password"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="app-button"
                disabled={!folder.trim() || !syncPassphrase.trim()}
                onClick={() => void configureSync(folder, syncPassphrase).then(setRecovery)}
              >
                Configure
              </button>
              <button
                className="app-button"
                disabled={!syncStatus.configured}
                onClick={() => void syncNow()}
              >
                Sync now
              </button>
            </div>
            {recovery ? (
              <textarea className="field mt-2 h-20 w-full py-2" readOnly value={recovery} />
            ) : null}
          </section>

          <section>
            <div className="mb-1 text-sm font-semibold">Account (cloud sync)</div>
            <div className="mb-2 text-xs text-muted">
              {account.configured
                ? `Signed in as ${account.email ?? ''}`
                : 'Sign in to sync across devices via a server (end-to-end encrypted).'}
            </div>
            {account.configured ? (
              <div className="flex gap-2">
                <button
                  className="app-button"
                  onClick={() => void runAccount(() => api.account.syncNow(), 'Synced.')}
                >
                  Sync now
                </button>
                <button
                  className="app-button"
                  onClick={() => void runAccount(() => api.account.logout(), 'Signed out.')}
                >
                  Log out
                </button>
              </div>
            ) : (
              <>
                <input
                  className="field mb-2 w-full"
                  value={serverUrl}
                  placeholder="Server URL (https://appdeck-sync.you.workers.dev)"
                  onChange={(event) => setServerUrl(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field"
                    value={accEmail}
                    placeholder="Email"
                    onChange={(event) => setAccEmail(event.target.value)}
                  />
                  <input
                    className="field"
                    type="password"
                    value={accPassword}
                    placeholder="Password"
                    onChange={(event) => setAccPassword(event.target.value)}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="app-button"
                    disabled={!serverUrl.trim() || !accEmail.trim() || accPassword.length < 8}
                    onClick={() =>
                      void runAccount(
                        () => api.account.signup(serverUrl, accEmail, accPassword),
                        'Account created + synced.'
                      )
                    }
                  >
                    Sign up
                  </button>
                  <button
                    className="app-button"
                    disabled={!serverUrl.trim() || !accEmail.trim() || !accPassword}
                    onClick={() =>
                      void runAccount(
                        () => api.account.login(serverUrl, accEmail, accPassword),
                        'Logged in + synced.'
                      )
                    }
                  >
                    Log in
                  </button>
                </div>
              </>
            )}
            {accMsg && <div className="mt-2 text-xs text-muted">{accMsg}</div>}
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold">Lock</div>
            <div className="flex gap-2">
              <input
                className="field flex-1"
                value={lockPassphrase}
                onChange={(event) => setLockPassphrase(event.target.value)}
                placeholder="Passphrase or PIN"
                type="password"
              />
              <button
                className="app-button"
                disabled={lockPassphrase.length < 4}
                onClick={() => void setupLock(lockPassphrase).then(() => setLockPassphrase(''))}
              >
                Set lock
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold">Diagnostics</div>
            <div className="text-xs text-muted">
              Memory:{' '}
              {metrics
                ? `${metrics.totalMemoryMB} MB across ${metrics.processes.length} processes`
                : '—'}{' '}
              · Updates: {updateStatus || '—'}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="app-button"
                onClick={() => void api.metrics.get().then(setMetrics)}
              >
                Refresh memory
              </button>
              <button
                className="app-button"
                onClick={() =>
                  void api.update.check().then((status) => setUpdateStatus(status.status))
                }
              >
                Check for updates
              </button>
              {updateStatus === 'downloaded' && (
                <button
                  className="app-button border-accent text-white"
                  onClick={() => void api.update.install()}
                >
                  Restart &amp; install
                </button>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <section className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        className={`h-6 w-11 rounded-full border border-line transition ${value ? 'bg-accent' : 'bg-shell'}`}
        onClick={() => onChange(!value)}
        title={label}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </section>
  );
}
