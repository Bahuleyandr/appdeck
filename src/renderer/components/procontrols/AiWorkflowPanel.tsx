import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  AiPrompt
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function AiWorkflowPanel({
  prompts,
  refresh
}: {
  prompts: AiPrompt[];
  refresh: () => void;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [briefingMessage, setBriefingMessage] = useState<string | null>(null);

  const enableMorningBriefing = async (): Promise<void> => {
    // Reuse the existing rule (looked up by name) so repeated clicks update it in place instead
    // of stacking duplicate automations.
    const existing = (await api.automations.list()).find(
      (rule) => rule.name === 'Morning briefing'
    );
    await api.automations.upsert({
      id: existing?.id,
      name: 'Morning briefing',
      enabled: true,
      trigger: {
        type: 'schedule',
        schedule: [{ from: '08:30', to: '08:45', days: [0, 1, 2, 3, 4, 5, 6] }]
      },
      actions: [{ type: 'runAiPrompt' }]
    });
    setBriefingMessage(
      'Morning briefing scheduled daily at 08:30. The result lands in your inbox; edit or disable it under Automations.'
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-2 text-sm font-semibold">Morning briefing</div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="app-button primary" onClick={() => void enableMorningBriefing()}>
            Enable morning briefing
          </button>
          <span className="text-xs text-muted">
            A daily AI summary of your notifications, delivered to the inbox at 08:30.
          </span>
        </div>
        {briefingMessage && <div className="mt-2 text-xs text-muted">{briefingMessage}</div>}
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Saved Prompt</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={title}
            placeholder="Title"
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="field h-32 w-full py-2"
            value={prompt}
            placeholder="Prompt"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={context}
            placeholder="Optional context"
            onChange={(event) => setContext(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="app-button"
              disabled={!title.trim() || !prompt.trim()}
              onClick={() =>
                void api.aiPrompts
                  .upsert({ title: title.trim(), prompt: prompt.trim(), local_only: false })
                  .then(() => {
                    setTitle('');
                    setPrompt('');
                    refresh();
                  })
              }
            >
              Save
            </button>
            <button
              className="app-button border-accent text-white"
              disabled={!prompt.trim()}
              onClick={() =>
                void api.aiPrompts
                  .run({ prompt: prompt.trim(), context: context.trim() })
                  .then((result) => setOutput(result.text))
                  .catch((error: unknown) =>
                    setOutput(error instanceof Error ? error.message : String(error))
                  )
              }
            >
              Run
            </button>
            <button
              className="app-button"
              onClick={() =>
                void api.aiPrompts
                  .extractTasks()
                  .then((result) => setOutput(result.text))
                  .catch((error: unknown) =>
                    setOutput(error instanceof Error ? error.message : String(error))
                  )
              }
            >
              Extract tasks
            </button>
          </div>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Prompts</div>
        <div className="space-y-2">
          {prompts.length === 0 && <EmptyState label="No prompts saved." />}
          {prompts.map((saved) => (
            <div key={saved.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{saved.title}</div>
                  <div className="truncate text-xs text-muted">{saved.prompt}</div>
                </div>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() =>
                    void api.aiPrompts
                      .run({ id: saved.id, context })
                      .then((result) => setOutput(result.text))
                      .catch((error: unknown) =>
                        setOutput(error instanceof Error ? error.message : String(error))
                      )
                  }
                >
                  Run
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete prompt"
                  title="Delete prompt"
                  onClick={() => void api.aiPrompts.delete(saved.id).then(refresh)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {output && (
          <textarea className="field mt-3 h-40 w-full py-2 text-xs" readOnly value={output} />
        )}
      </section>
    </div>
  );
}
