import { Plus, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  Workspace
} from '../../../shared/types';
import {
  DEFAULT_SLEEP_IDLE_MINUTES
} from '../../../shared/constants';
import { DEFAULT_WORKSPACE_COLOR, ColorRow, EmptyState, sleepTimingChoice, sleepMinutesFrom } from './helpers';
import type { SleepTimingChoice } from './helpers';

export function WorkspacePanel({
  workspaces,
  activeWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
}: {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  createWorkspace: (input: {
    name: string;
    icon?: string | null;
    color?: string | null;
    parentId?: string | null;
  }) => Promise<void>;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [parentId, setParentId] = useState('');
  const [editName, setEditName] = useState(activeWorkspace?.name ?? '');
  const [editColor, setEditColor] = useState(activeWorkspace?.color ?? DEFAULT_WORKSPACE_COLOR);
  const [editParentId, setEditParentId] = useState(activeWorkspace?.parent_id ?? '');
  const [disabled, setDisabled] = useState(activeWorkspace?.disabled ?? false);
  const [dnd, setDnd] = useState(activeWorkspace?.focus_rules.dnd ?? false);
  const [scheduleFrom, setScheduleFrom] = useState(
    activeWorkspace?.focus_rules.schedule?.[0]?.from ?? ''
  );
  const [scheduleTo, setScheduleTo] = useState(
    activeWorkspace?.focus_rules.schedule?.[0]?.to ?? ''
  );
  const [idleChoice, setIdleChoice] = useState<SleepTimingChoice>(
    sleepTimingChoice(activeWorkspace?.sleep_defaults.idleMinutes)
  );
  const [idleMinutes, setIdleMinutes] = useState(
    String(activeWorkspace?.sleep_defaults.idleMinutes ?? '')
  );

  useEffect(() => {
    setEditName(activeWorkspace?.name ?? '');
    setEditColor(activeWorkspace?.color ?? DEFAULT_WORKSPACE_COLOR);
    setEditParentId(activeWorkspace?.parent_id ?? '');
    setDisabled(activeWorkspace?.disabled ?? false);
    setDnd(activeWorkspace?.focus_rules.dnd ?? false);
    setScheduleFrom(activeWorkspace?.focus_rules.schedule?.[0]?.from ?? '');
    setScheduleTo(activeWorkspace?.focus_rules.schedule?.[0]?.to ?? '');
    setIdleChoice(sleepTimingChoice(activeWorkspace?.sleep_defaults.idleMinutes));
    setIdleMinutes(String(activeWorkspace?.sleep_defaults.idleMinutes ?? ''));
    // Key the reset on identity + server-side edit time, not object identity: every data-changed
    // reload creates fresh objects and used to wipe the user's in-progress edits.
  }, [activeWorkspace?.id, activeWorkspace?.updated_at]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Workspace</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Workspace name"
            onChange={(event) => setName(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <select
            className="field w-full"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Top level</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            className="app-button w-full"
            disabled={!name.trim()}
            onClick={() =>
              void createWorkspace({
                name: name.trim(),
                icon: 'briefcase',
                color,
                parentId: parentId || null
              }).then(() => {
                setName('');
                setParentId('');
              })
            }
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Current Workspace</div>
        {activeWorkspace ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_150px] gap-2">
              <input
                className="field"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
              <input
                className="field"
                value={editColor}
                onChange={(event) => setEditColor(event.target.value)}
              />
            </div>
            <select
              className="field w-full"
              value={editParentId}
              onChange={(event) => setEditParentId(event.target.value)}
            >
              <option value="">Top level</option>
              {workspaces
                .filter((workspace) => workspace.id !== activeWorkspace.id)
                .map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
            </select>
            <ColorRow value={editColor} onChange={setEditColor} />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
                <input
                  type="checkbox"
                  checked={dnd}
                  onChange={(event) => setDnd(event.target.checked)}
                />
                Focus mode
              </label>
              <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
                <input
                  type="checkbox"
                  checked={disabled}
                  onChange={(event) => setDisabled(event.target.checked)}
                />
                Disabled
              </label>
              <select
                className="field"
                title="Default sleep-after-idle for services in this workspace"
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
                placeholder="Idle minutes"
                disabled={idleChoice !== 'custom'}
                onChange={(event) => setIdleMinutes(event.target.value)}
              />
              <input
                className="field"
                value={scheduleFrom}
                placeholder="Focus from 09:00"
                onChange={(event) => setScheduleFrom(event.target.value)}
              />
              <input
                className="field"
                value={scheduleTo}
                placeholder="Focus to 17:00"
                onChange={(event) => setScheduleTo(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="app-button"
                disabled={!editName.trim()}
                onClick={() =>
                  void updateWorkspace(activeWorkspace.id, {
                    name: editName.trim(),
                    parent_id: editParentId || null,
                    color: editColor.trim() || null,
                    disabled,
                    focus_rules: {
                      ...activeWorkspace.focus_rules,
                      dnd,
                      schedule:
                        scheduleFrom.trim() && scheduleTo.trim()
                          ? [
                              {
                                from: scheduleFrom.trim(),
                                to: scheduleTo.trim(),
                                days: [1, 2, 3, 4, 5]
                              }
                            ]
                          : undefined
                    },
                    // Merge on top of the stored defaults so fields this form doesn't manage
                    // survive the save.
                    sleep_defaults: {
                      ...activeWorkspace.sleep_defaults,
                      idleMinutes: sleepMinutesFrom(idleChoice, idleMinutes)
                    }
                  })
                }
              >
                Save
              </button>
              <button
                className="app-button"
                disabled={workspaces.length <= 1}
                onClick={() => void deleteWorkspace(activeWorkspace.id)}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <EmptyState label="No workspace selected." />
        )}
      </section>

      <section className="panel rounded-md p-3 lg:col-span-2">
        <div className="mb-3 text-sm font-semibold">All Workspaces</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="flex items-center gap-2 rounded-md border border-line p-2"
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{workspace.name}</span>
              {workspace.parent_id && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  nested
                </span>
              )}
              {workspace.disabled && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  disabled
                </span>
              )}
              {workspace.focus_rules.dnd && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  focus
                </span>
              )}
              <button
                className="app-button h-7 px-2 text-xs"
                onClick={() =>
                  void updateWorkspace(workspace.id, { disabled: !workspace.disabled })
                }
              >
                {workspace.disabled ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
