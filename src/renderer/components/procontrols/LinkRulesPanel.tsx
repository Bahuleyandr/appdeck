import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  LinkRule,
  LinkRuleTestResult,
  ServiceInstance,
  Workspace
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { useAppStore } from '../../state/appStore';
import { EmptyState, numberOrDefault, targetOptions } from './helpers';

export function LinkRulesPanel({
  rules,
  services,
  workspaces,
  profiles,
  refresh
}: {
  rules: LinkRule[];
  services: ServiceInstance[];
  workspaces: Workspace[];
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [priority, setPriority] = useState('100');
  const [matchType, setMatchType] = useState<LinkRule['match_type']>('domain');
  const [targetType, setTargetType] = useState<LinkRule['target_type']>('service');
  const [targetId, setTargetId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<LinkRuleTestResult | null>(null);

  const targets = targetOptions(targetType, services, workspaces, profiles);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Rule</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Rule name"
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="field w-full"
            value={pattern}
            placeholder="Domain, exact URL, text, or regex"
            onChange={(event) => setPattern(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="field"
              value={matchType}
              onChange={(event) => setMatchType(event.target.value as LinkRule['match_type'])}
            >
              {(['exact', 'domain', 'contains', 'regex'] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              className="field"
              value={priority}
              placeholder="Priority"
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="field"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as LinkRule['target_type']);
                setTargetId('');
              }}
            >
              {(['service', 'workspace', 'profile', 'external'] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={targetId}
              disabled={targetType === 'external'}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Auto</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled
          </label>
          <button
            className="app-button w-full border-accent text-white"
            disabled={!name.trim() || !pattern.trim()}
            onClick={() =>
              void api.linkRules
                .upsert({
                  name: name.trim(),
                  pattern: pattern.trim(),
                  priority: numberOrDefault(priority, 100),
                  match_type: matchType,
                  target_type: targetType,
                  target_id: targetType === 'external' ? null : targetId || null,
                  enabled
                })
                .then(() => {
                  setName('');
                  setPattern('');
                  refresh();
                })
            }
          >
            Save rule
          </button>
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="field"
            value={testUrl}
            placeholder="https://example.com/path"
            onChange={(event) => setTestUrl(event.target.value)}
          />
          <button
            className="app-button"
            disabled={!testUrl.trim()}
            onClick={() => void api.linkRules.test(testUrl.trim()).then(setTestResult)}
          >
            Test
          </button>
        </div>
        {testResult && (
          <div className="mb-3 rounded-md border border-line p-2 text-xs text-muted">
            {testResult.matched ? `Matched ${testResult.rule?.name ?? 'rule'}` : 'No rule matched'}
            {testResult.external
              ? ' -> external'
              : testResult.targetServiceId
                ? ` -> ${testResult.targetServiceId}`
                : ''}
          </div>
        )}
        <div className="space-y-2">
          {rules.length === 0 && <EmptyState label="No link rules yet." />}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{rule.name}</div>
                <div className="truncate text-xs text-muted">
                  {rule.priority} / {rule.match_type} / {rule.pattern} {'->'} {rule.target_type}
                </div>
              </div>
              <button
                className="icon-button"
                aria-label="Delete rule"
                title="Delete rule"
                onClick={() => void api.linkRules.delete(rule.id).then(refresh)}
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
