import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  PermissionPolicy,
  ServiceInstance
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { useAppStore } from '../../state/appStore';
import { EmptyState } from './helpers';

export function PrivacyPanel({
  permissions,
  services,
  settings,
  setSettingValue,
  refresh
}: {
  permissions: PermissionPolicy[];
  services: ServiceInstance[];
  settings: ReturnType<typeof useAppStore.getState>['settings'];
  setSettingValue: ReturnType<typeof useAppStore.getState>['setSettingValue'];
  refresh: () => void;
}): JSX.Element {
  const [serviceId, setServiceId] = useState('');
  const [permission, setPermission] = useState('notifications');
  const [decision, setDecision] = useState<PermissionPolicy['decision']>('ask');
  const [autoLock, setAutoLock] = useState(settings.auto_lock_minutes);

  useEffect(() => {
    setAutoLock(settings.auto_lock_minutes);
  }, [settings.auto_lock_minutes]);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Privacy Shield</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.tracker_block === 'true'}
              onChange={(event) =>
                void setSettingValue('tracker_block', event.target.checked ? 'true' : 'false')
              }
            />
            Tracker and email-pixel block
          </label>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.launch_at_login === 'true'}
              onChange={(event) =>
                void setSettingValue('launch_at_login', event.target.checked ? 'true' : 'false')
              }
            />
            Launch at login
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="field"
              value={autoLock}
              placeholder="Auto-lock minutes"
              onChange={(event) => setAutoLock(event.target.value)}
            />
            <button
              className="app-button"
              onClick={() => void setSettingValue('auto_lock_minutes', autoLock.trim())}
            >
              Save
            </button>
          </div>
          <div className="rounded-md border border-line p-2 text-xs text-muted">
            Syncs: workspaces, profiles, recipes, layouts, safe service metadata. Never syncs:
            cookies, tokens, AI keys, proxy passwords, downloads, permission decisions.
          </div>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_120px_auto]">
          <select
            className="field"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.display_name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={permission}
            onChange={(event) => setPermission(event.target.value)}
          >
            {[
              'notifications',
              'media',
              'geolocation',
              'camera',
              'microphone',
              'clipboard-read',
              'clipboard-sanitized-write'
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={decision}
            onChange={(event) => setDecision(event.target.value as PermissionPolicy['decision'])}
          >
            {(['ask', 'allow', 'deny'] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            className="app-button"
            onClick={() =>
              void api.permissions
                .upsert({ service_instance_id: serviceId || null, permission, decision })
                .then(refresh)
            }
          >
            Save
          </button>
        </div>
        <div className="space-y-2">
          {permissions.length === 0 && <EmptyState label="No permission policies yet." />}
          {permissions.map((policy) => (
            <div
              key={policy.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {policy.permission}: {policy.decision}
                </div>
                <div className="truncate text-xs text-muted">
                  {policy.service_instance_id ?? 'All services'}
                </div>
              </div>
              <button
                className="icon-button"
                aria-label="Delete policy"
                title="Delete policy"
                onClick={() => void api.permissions.delete(policy.id).then(refresh)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
