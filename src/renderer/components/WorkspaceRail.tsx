import type { JSX } from 'react';
import { Briefcase, Home, Plus } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../state/appStore';

export function WorkspaceRail(): JSX.Element {
  const { workspaces, selectedWorkspaceId, selectWorkspace, setProControlsOpen, reorderWorkspaces } =
    useAppStore();
  const [dragId, setDragId] = useState<string | null>(null);

  const dropOn = (targetId: string): void => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ids = workspaces.map((workspace) => workspace.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    void reorderWorkspaces(ids);
  };

  return (
    <aside
      aria-label="Workspaces"
      className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-line bg-shell px-2 py-3"
    >
      {workspaces.map((workspace) => {
        const selected = workspace.id === selectedWorkspaceId;
        return (
          <button
            key={workspace.id}
            draggable
            onDragStart={() => setDragId(workspace.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropOn(workspace.id)}
            className={`icon-button relative ${selected ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/60' : ''} ${workspace.disabled ? 'opacity-40' : ''} ${dragId === workspace.id ? 'opacity-50' : ''}`}
            aria-label={workspace.disabled ? `${workspace.name} disabled` : workspace.name}
            aria-current={selected ? 'true' : undefined}
            title={workspace.disabled ? `${workspace.name} disabled` : workspace.name}
            disabled={workspace.disabled}
            onClick={() => void selectWorkspace(workspace.id)}
          >
            {workspace.icon === 'home' ? (
              <Home size={18} aria-hidden="true" />
            ) : (
              <Briefcase size={18} aria-hidden="true" />
            )}
            <span
              aria-hidden="true"
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full"
              style={{ backgroundColor: workspace.color ?? '#2dd4bf' }}
            />
          </button>
        );
      })}
      <button
        className="icon-button mt-auto"
        aria-label="Manage workspaces"
        title="Manage workspaces"
        onClick={() => setProControlsOpen(true)}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </aside>
  );
}
