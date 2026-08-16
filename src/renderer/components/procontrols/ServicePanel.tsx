import { Moon, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  ServiceInstance,
  ServiceProxy,
  SleepPolicy
} from '../../../shared/types';
import {
  DEFAULT_DOZE_DEEP_AFTER_MINUTES,
  DEFAULT_SLEEP_IDLE_MINUTES
} from '../../../shared/constants';
import { api } from '../../ipc/client';
import { useAppStore } from '../../state/appStore';
import { DEFAULT_WORKSPACE_COLOR, ColorRow, EmptyState, sleepTimingChoice, sleepMinutesFrom, numberOrDefault, proxyFromFields } from './helpers';
import type { SleepTimingChoice } from './helpers';

export function ServicePanel({
  service,
  profiles,
  updateService,
  deleteService,
  sleepService,
  wakeService
}: {
  service: ServiceInstance | null;
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  updateService: (id: string, patch: Partial<ServiceInstance>) => Promise<void>;
  deleteService: (id: string, wipeData?: boolean) => Promise<void>;
  sleepService: (id: string) => Promise<void>;
  wakeService: (id: string) => Promise<void>;
}): JSX.Element {
  const [displayName, setDisplayName] = useState(service?.display_name ?? '');
  const [color, setColor] = useState(service?.color ?? DEFAULT_WORKSPACE_COLOR);
  const [profileId, setProfileId] = useState(service?.profile_id ?? '');
  const [muted, setMuted] = useState(service?.muted ?? false);
  const [pinned, setPinned] = useState(service?.pinned ?? false);
  const [disabled, setDisabled] = useState(service?.disabled ?? false);
  const [iconPath, setIconPath] = useState(service?.icon_path ?? '');
  const [idleChoice, setIdleChoice] = useState<SleepTimingChoice>(
    sleepTimingChoice(service?.sleep_policy.idleMinutes)
  );
  const [idleMinutes, setIdleMinutes] = useState(String(service?.sleep_policy.idleMinutes ?? ''));
  const [sleepMode, setSleepMode] = useState<NonNullable<SleepPolicy['mode']>>(
    service?.sleep_policy.mode ?? 'auto'
  );
  const [deepAfterChoice, setDeepAfterChoice] = useState<SleepTimingChoice>(
    sleepTimingChoice(service?.sleep_policy.deepAfterMinutes)
  );
  const [deepAfterMinutes, setDeepAfterMinutes] = useState(
    String(service?.sleep_policy.deepAfterMinutes ?? '')
  );
  const [zoomFactor, setZoomFactor] = useState(String(service?.zoom_factor ?? 1));
  const [spellcheck, setSpellcheck] = useState(service?.spellcheck ?? true);
  const [userAgent, setUserAgent] = useState(service?.user_agent ?? '');
  const [customCss, setCustomCss] = useState(service?.custom_css ?? '');
  const [customJs, setCustomJs] = useState(service?.custom_js ?? '');
  const [proxyMode, setProxyMode] = useState<ServiceProxy['mode']>(
    service?.proxy?.mode ?? 'direct'
  );
  const [proxyHost, setProxyHost] = useState(service?.proxy?.host ?? '');
  const [proxyPort, setProxyPort] = useState(String(service?.proxy?.port ?? ''));
  const [proxyBypass, setProxyBypass] = useState(service?.proxy?.bypassRules ?? '');
  const [findText, setFindText] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);

  useEffect(() => {
    if (!service) {
      setCodePending(false);
      return;
    }
    const serviceId = service.id;
    void api.services
      .pendingCustomCode()
      .then((pending) => setCodePending(pending.some((entry) => entry.instanceId === serviceId)));
    // Live update: main pushes this when synced/imported custom code starts needing approval.
    return api.on('event:custom-code-pending', (payload) => {
      const event = payload as { instanceId: string };
      if (event.instanceId === serviceId) setCodePending(true);
    });
    // Keyed on the id: data-changed reloads mint new objects for the same service and must not
    // re-run this (or wipe in-progress edits below).
  }, [service?.id]);

  useEffect(() => {
    setDisplayName(service?.display_name ?? '');
    setColor(service?.color ?? DEFAULT_WORKSPACE_COLOR);
    setProfileId(service?.profile_id ?? '');
    setMuted(service?.muted ?? false);
    setPinned(service?.pinned ?? false);
    setDisabled(service?.disabled ?? false);
    setIconPath(service?.icon_path ?? '');
    setIdleChoice(sleepTimingChoice(service?.sleep_policy.idleMinutes));
    setIdleMinutes(String(service?.sleep_policy.idleMinutes ?? ''));
    setSleepMode(service?.sleep_policy.mode ?? 'auto');
    setDeepAfterChoice(sleepTimingChoice(service?.sleep_policy.deepAfterMinutes));
    setDeepAfterMinutes(String(service?.sleep_policy.deepAfterMinutes ?? ''));
    setZoomFactor(String(service?.zoom_factor ?? 1));
    setSpellcheck(service?.spellcheck ?? true);
    setUserAgent(service?.user_agent ?? '');
    setCustomCss(service?.custom_css ?? '');
    setCustomJs(service?.custom_js ?? '');
    setProxyMode(service?.proxy?.mode ?? 'direct');
    setProxyHost(service?.proxy?.host ?? '');
    setProxyPort(String(service?.proxy?.port ?? ''));
    setProxyBypass(service?.proxy?.bypassRules ?? '');
    setCurrentUrl(null);
    // Key the reset on identity + server-side edit time, not object identity: every data-changed
    // reload creates fresh objects and used to wipe the user's in-progress edits.
  }, [service?.id, service?.updated_at]);

  if (!service) return <EmptyState label="Select a service first." />;

  const save = (): void => {
    void updateService(service.id, {
      display_name: displayName.trim(),
      color: color.trim() || null,
      icon_path: iconPath.trim() || null,
      profile_id: profileId || null,
      muted,
      pinned,
      disabled,
      // Merge on top of the stored policy so fields this form doesn't manage survive the save.
      sleep_policy: {
        ...service.sleep_policy,
        idleMinutes: sleepMinutesFrom(idleChoice, idleMinutes),
        mode: sleepMode,
        deepAfterMinutes: sleepMinutesFrom(deepAfterChoice, deepAfterMinutes)
      },
      proxy: proxyFromFields(proxyMode, proxyHost, proxyPort, proxyBypass),
      user_agent: userAgent.trim() || null,
      zoom_factor: numberOrDefault(zoomFactor, 1),
      spellcheck,
      custom_css: customCss.trim() || null,
      custom_js: customJs.trim() || null
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Identity</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            aria-label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <select
            className="field w-full"
            aria-label="Profile"
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
          >
            <option value="">No profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
          <input
            className="field w-full"
            value={iconPath}
            placeholder="Custom icon path"
            onChange={(event) => setIconPath(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
              />
              Muted
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
              />
              Pinned
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(event) => setDisabled(event.target.checked)}
              />
              Disabled
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={spellcheck}
                onChange={(event) => setSpellcheck(event.target.checked)}
              />
              Spellcheck
            </label>
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <select
              className="field"
              title="When an idle service goes to sleep"
              value={idleChoice}
              onChange={(event) => setIdleChoice(event.target.value as SleepTimingChoice)}
            >
              <option value="default">
                Sleep after idle: default ({DEFAULT_SLEEP_IDLE_MINUTES} min)
              </option>
              <option value="never">Sleep after idle: never</option>
              <option value="custom">Sleep after idle: custom</option>
            </select>
            <input
              className="field"
              value={idleMinutes}
              placeholder="Minutes"
              disabled={idleChoice !== 'custom'}
              onChange={(event) => setIdleMinutes(event.target.value)}
            />
          </div>
          <select
            className="field w-full"
            title="How a sleeping service is parked"
            value={sleepMode}
            onChange={(event) =>
              setSleepMode(event.target.value as NonNullable<SleepPolicy['mode']>)
            }
          >
            <option value="auto">Sleep style: auto (doze, then deep)</option>
            <option value="doze">Sleep style: doze (keeps notifications)</option>
            <option value="deep">Sleep style: deep (frees memory)</option>
          </select>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <select
              className="field"
              title="When a dozing service escalates to deep sleep"
              value={deepAfterChoice}
              onChange={(event) => setDeepAfterChoice(event.target.value as SleepTimingChoice)}
            >
              <option value="default">
                Deep sleep after: default ({DEFAULT_DOZE_DEEP_AFTER_MINUTES} min)
              </option>
              <option value="never">Deep sleep after: never</option>
              <option value="custom">Deep sleep after: custom</option>
            </select>
            <input
              className="field"
              value={deepAfterMinutes}
              placeholder="Minutes"
              disabled={deepAfterChoice !== 'custom'}
              onChange={(event) => setDeepAfterMinutes(event.target.value)}
            />
          </div>
          <input
            className="field w-full"
            value={zoomFactor}
            placeholder="Zoom factor, e.g. 1.1"
            onChange={(event) => setZoomFactor(event.target.value)}
          />
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Runtime</div>
        <div className="space-y-2">
          {codePending && (
            <div className="rounded-md border border-amber-400/50 bg-amber-400/10 p-2 text-xs">
              <div className="mb-1 font-semibold">Custom code needs your approval</div>
              <div className="text-muted">
                The custom CSS/JS on this service changed outside this device (sync or import). It
                will not run until you review and approve it here.
              </div>
              <button
                className="app-button mt-2"
                onClick={() =>
                  void api.services.approveCustomCode(service.id).then(() => {
                    setCodePending(false);
                  })
                }
              >
                Approve and run
              </button>
            </div>
          )}
          <input
            className="field w-full"
            value={userAgent}
            placeholder="User agent override"
            onChange={(event) => setUserAgent(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={customCss}
            placeholder="Custom CSS"
            onChange={(event) => setCustomCss(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={customJs}
            placeholder="Custom JS"
            onChange={(event) => setCustomJs(event.target.value)}
          />
        </div>
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-3 text-sm font-semibold">Network And Page</div>
        <div className="grid gap-2 lg:grid-cols-[140px_1fr_120px_1fr]">
          <select
            className="field"
            aria-label="Proxy mode"
            value={proxyMode}
            onChange={(event) => setProxyMode(event.target.value as ServiceProxy['mode'])}
          >
            {(['direct', 'http', 'socks', 'socks4', 'socks5'] as const).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <input
            className="field"
            value={proxyHost}
            placeholder="Proxy host"
            disabled={proxyMode === 'direct'}
            onChange={(event) => setProxyHost(event.target.value)}
          />
          <input
            className="field"
            value={proxyPort}
            placeholder="Port"
            disabled={proxyMode === 'direct'}
            onChange={(event) => setProxyPort(event.target.value)}
          />
          <input
            className="field"
            value={proxyBypass}
            placeholder="Bypass rules"
            onChange={(event) => setProxyBypass(event.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <input
            className="field"
            value={findText}
            placeholder="Find in page"
            onChange={(event) => setFindText(event.target.value)}
          />
          <button
            className="app-button"
            disabled={!findText.trim()}
            onClick={() => void api.services.find(service.id, findText.trim())}
          >
            Find
          </button>
          <button className="app-button" onClick={() => void api.services.stopFind(service.id)}>
            Stop find
          </button>
          <button
            className="app-button"
            onClick={() =>
              void api.services.currentUrl(service.id).then(async (result) => {
                setCurrentUrl(result.url);
                if (result.url) await navigator.clipboard.writeText(result.url);
              })
            }
          >
            Copy URL
          </button>
        </div>
        {currentUrl && (
          <div role="status" aria-live="polite" className="mt-2 truncate text-xs text-muted">
            {currentUrl}
          </div>
        )}
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="app-button border-accent text-white"
            disabled={!displayName.trim()}
            onClick={save}
          >
            Save service
          </button>
          <button className="app-button" onClick={() => void sleepService(service.id)}>
            <Moon size={15} />
            Sleep
          </button>
          <button className="app-button" onClick={() => void wakeService(service.id)}>
            <RefreshCw size={15} />
            Wake
          </button>
          <button className="app-button" onClick={() => void api.services.reload(service.id)}>
            Reload
          </button>
          <button className="app-button" onClick={() => void api.services.openExternal(service.id)}>
            Open external
          </button>
          <button className="app-button" onClick={() => void api.services.clearStorage(service.id)}>
            Clear storage
          </button>
          <button
            className="app-button"
            onClick={() => void api.services.setZoom(service.id, numberOrDefault(zoomFactor, 1))}
          >
            Apply zoom
          </button>
          <button className="app-button" onClick={() => void deleteService(service.id, false)}>
            Remove
          </button>
          <button className="app-button" onClick={() => void deleteService(service.id, true)}>
            Remove + wipe data
          </button>
        </div>
      </section>
    </div>
  );
}
