import { Briefcase, Home, Plus } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function WorkspaceRail(): JSX.Element {
  const { workspaces, selectedWorkspaceId, selectWorkspace } = useAppStore();
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-line bg-shell px-2 py-3">
      {workspaces.map((workspace) => {
        const selected = workspace.id === selectedWorkspaceId;
        return (
          <button
            key={workspace.id}
            className={`icon-button relative ${selected ? 'border-accent text-white' : ''}`}
            title={workspace.name}
            onClick={() => void selectWorkspace(workspace.id)}
          >
            {workspace.icon === 'home' ? <Home size={18} /> : <Briefcase size={18} />}
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full"
              style={{ backgroundColor: workspace.color ?? '#2dd4bf' }}
            />
          </button>
        );
      })}
      <button className="icon-button mt-auto" title="New workspace" disabled>
        <Plus size={18} />
      </button>
    </aside>
  );
}
