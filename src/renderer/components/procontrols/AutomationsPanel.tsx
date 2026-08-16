import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  AiPrompt,
  AutomationRule,
  ServiceInstance,
  Workspace
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function AutomationsPanel({
  automations,
  services,
  workspaces,
  aiPrompts,
  refresh
}: {
  automations: AutomationRule[];
  services: ServiceInstance[];
  workspaces: Workspace[];
  aiPrompts: AiPrompt[];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('New automation');
  const [triggerType, setTriggerType] = useState<AutomationRule['trigger']['type']>('notification');
  const [matchText, setMatchText] = useState('');
  const [actionType, setActionType] =
    useState<AutomationRule['actions'][number]['type']>('createTask');
  const [targetId, setTargetId] = useState('');
  const [taskTitle, setTaskTitle] = useState('Follow up');
  const [unreadAtLeast, setUnreadAtLeast] = useState('5');
  const [result, setResult] = useState('');
  const unreadThreshold = (): number => {
    const parsed = Number.parseInt(unreadAtLeast, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
  };
  const save = async (): Promise<void> => {
    await api.automations.upsert({
      name,
      enabled: true,
      trigger: {
        type: triggerType,
        matchText: matchText.trim() || undefined,
        unreadAtLeast: triggerType === 'unreadThreshold' ? unreadThreshold() : undefined
      },
      actions: [
        // createTask carries the task title as its value; every other action targets an entity.
        actionType === 'createTask'
          ? { type: actionType, targetId: null, value: taskTitle.trim() || 'Follow up' }
          : { type: actionType, targetId: targetId || null }
      ]
    });
    setResult('Automation saved.');
    refresh();
  };
  const testDraft = async (): Promise<void> => {
    const test = await api.automations.test({
      trigger: {
        type: triggerType,
        matchText: matchText || undefined,
        unreadAtLeast: unreadThreshold()
      },
      sample: { title: matchText || 'Sample notification', body: 'Sample body', unread: 7 }
    });
    setResult(`${test.matched ? 'Matched' : 'No match'}: ${test.reasons.join(' ')}`);
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Local Automation Builder</div>
        <div className="grid gap-2 lg:grid-cols-2">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="field"
            value={triggerType}
            onChange={(event) =>
              setTriggerType(event.target.value as AutomationRule['trigger']['type'])
            }
          >
            <option value="notification">Notification contains</option>
            <option value="unreadThreshold">Unread threshold</option>
            <option value="schedule">Schedule</option>
            <option value="startup">Startup</option>
            <option value="manual">Manual</option>
          </select>
          <input
            className="field"
            placeholder="Trigger text"
            value={matchText}
            onChange={(event) => setMatchText(event.target.value)}
          />
          {triggerType === 'unreadThreshold' && (
            <input
              className="field"
              placeholder="Unread at least"
              value={unreadAtLeast}
              onChange={(event) => setUnreadAtLeast(event.target.value)}
            />
          )}
          <select
            className="field"
            value={actionType}
            onChange={(event) =>
              setActionType(event.target.value as AutomationRule['actions'][number]['type'])
            }
          >
            <option value="createTask">Create task</option>
            <option value="openWorkspace">Open workspace</option>
            <option value="openService">Open service</option>
            <option value="runAiPrompt">Run AI prompt</option>
            <option value="sleepService">Sleep service</option>
            <option value="wakeService">Wake service</option>
          </select>
          {actionType === 'createTask' ? (
            <input
              className="field"
              placeholder="Task title"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
            />
          ) : (
            <select
              className="field"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Target</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  Workspace: {workspace.name}
                </option>
              ))}
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  Service: {service.display_name}
                </option>
              ))}
              {aiPrompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  Prompt: {prompt.title}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button className="app-button" onClick={() => void testDraft()}>
              Test
            </button>
            <button className="app-button primary" onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
        {result && (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">{result}</div>
        )}
      </div>
      <div className="grid gap-2">
        {automations.length === 0 && <EmptyState label="No automations yet." />}
        {automations.map((automation) => (
          <div
            key={automation.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
          >
            <div>
              <div className="text-sm font-semibold">{automation.name}</div>
              <div className="text-xs text-muted">
                {automation.enabled ? automation.trigger.type : 'Disabled'} /{' '}
                {automation.actions.length} actions
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="Delete"
              title="Delete"
              onClick={() => void api.automations.delete(automation.id).then(refresh)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
