import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../state/appStore';

export function TaskPanel(): JSX.Element | null {
  const { taskPanelOpen, tasks, addTask, toggleTask, deleteTask, setTaskPanelOpen } = useAppStore();
  const [title, setTitle] = useState('');
  if (!taskPanelOpen) return null;
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex h-12 items-center justify-between border-b border-line px-3">
        <div className="text-sm font-semibold">Tasks</div>
        <button className="icon-button" title="Close" onClick={() => setTaskPanelOpen(false)}>
          <X size={16} />
        </button>
      </header>
      <div className="flex gap-2 border-b border-line p-3">
        <input className="field min-w-0 flex-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task" />
        <button
          className="icon-button"
          title="Add task"
          disabled={!title.trim()}
          onClick={() => {
            void addTask(title).then(() => setTitle(''));
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tasks.map((task) => (
          <div key={task.id} className="mb-1 flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-shell">
            <input type="checkbox" checked={task.done} onChange={() => void toggleTask(task)} />
            <span className={`min-w-0 flex-1 text-sm ${task.done ? 'text-muted line-through' : ''}`}>{task.title}</span>
            <button className="text-muted hover:text-white" title="Delete task" onClick={() => void deleteTask(task.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
