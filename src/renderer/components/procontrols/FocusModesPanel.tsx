import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  FocusMode,
  FocusModeStatus,
  ServiceInstance,
  Workspace
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { Metric } from './helpers';

export function FocusModesPanel({
  modes,
  status,
  workspaces,
  services,
  refresh
}: {
  modes: FocusMode[];
  status: FocusModeStatus | null;
  workspaces: Workspace[];
  services: ServiceInstance[];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('Deep Work');
  const [workspaceId, setWorkspaceId] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('17:00');
  const [mute, setMute] = useState(true);
  const save = async (): Promise<void> => {
    await api.focusModes.upsert({
      name,
      workspace_id: workspaceId || null,
      enabled: true,
      schedule: [{ from, to, days: [1, 2, 3, 4, 5] }],
      settings: { muteNotifications: mute, hideMutedServices: true, blockedServiceIds: [] }
    });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Metric
          label={status?.manuallyActivated ? 'Active (switched on)' : 'Active (scheduled)'}
          value={status?.activeMode?.name ?? 'None'}
        />
        <Metric label="Next" value={status?.nextMode?.name ?? 'None'} />
        <Metric label="Managed Services" value={String(services.length)} />
      </div>
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Smart Focus Mode</div>
        <div className="grid gap-2 lg:grid-cols-5">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="field"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            <option value="">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <input className="field" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="field" value={to} onChange={(event) => setTo(event.target.value)} />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={mute}
              onChange={(event) => setMute(event.target.checked)}
            />
            Mute
          </label>
        </div>
        <button className="app-button primary mt-3" onClick={() => void save()}>
          Save Focus Mode
        </button>
      </div>
      {modes.map((mode) => {
        const firstSchedule = mode.schedule[0];
        return (
          <div
            key={mode.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
          >
            <div>
              <div className="text-sm font-semibold">{mode.name}</div>
              <div className="text-xs text-muted">
                {firstSchedule ? `${firstSchedule.from}-${firstSchedule.to}` : 'Manual'} /{' '}
                {mode.settings.muteNotifications ? 'Muted' : 'Normal'}
              </div>
            </div>
            <div className="flex items-start gap-1">
              <button
                className={`app-button ${status?.activeMode?.id === mode.id ? 'border-accent text-white' : ''}`}
                title={
                  status?.activeMode?.id === mode.id
                    ? 'Stand this mode down'
                    : 'Switch this mode on now, regardless of its schedule'
                }
                onClick={() =>
                  void api.focusModes
                    .activate(status?.activeMode?.id === mode.id ? null : mode.id)
                    .then(refresh)
                }
              >
                {status?.activeMode?.id === mode.id ? 'Stand down' : 'Activate now'}
              </button>
              <button
                className="icon-button"
                aria-label="Delete"
                title="Delete"
                onClick={() => void api.focusModes.delete(mode.id).then(refresh)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
