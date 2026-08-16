import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  PrivacyFirewallRule,
  ServiceInstance
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function FirewallPanel({
  rules,
  services,
  refresh
}: {
  rules: PrivacyFirewallRule[];
  services: ServiceInstance[];
  refresh: () => void;
}): JSX.Element {
  const [pattern, setPattern] = useState('tracker.example.com');
  const [ruleType, setRuleType] = useState<PrivacyFirewallRule['rule_type']>('domain');
  const [action, setAction] = useState<PrivacyFirewallRule['action']>('block');
  const [serviceId, setServiceId] = useState('');
  const [testUrl, setTestUrl] = useState('https://tracker.example.com/pixel.gif');
  const [result, setResult] = useState('');
  const save = async (): Promise<void> => {
    await api.firewall.upsert({
      pattern,
      rule_type: ruleType,
      action,
      service_instance_id: serviceId || null,
      enabled: true
    });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Rules-Based Privacy Firewall</div>
        <div className="grid gap-2 lg:grid-cols-5">
          <select
            className="field"
            value={ruleType}
            onChange={(event) =>
              setRuleType(event.target.value as PrivacyFirewallRule['rule_type'])
            }
          >
            <option value="domain">Domain</option>
            <option value="cookie">Cookie</option>
            <option value="permission">Permission</option>
            <option value="download">Download</option>
            <option value="clipboard">Clipboard</option>
            <option value="script">Script</option>
          </select>
          <input
            className="field lg:col-span-2"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
          <select
            className="field"
            value={action}
            onChange={(event) => setAction(event.target.value as PrivacyFirewallRule['action'])}
          >
            <option value="block">Block</option>
            <option value="ask">Ask</option>
            <option value="allow">Allow</option>
          </select>
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
        </div>
        <div className="mt-2 flex gap-2">
          <button className="app-button primary" onClick={() => void save()}>
            Save Rule
          </button>
          <input
            className="field flex-1"
            value={testUrl}
            onChange={(event) => setTestUrl(event.target.value)}
          />
          <button
            className="app-button"
            onClick={() =>
              void api.firewall
                .test(testUrl, serviceId || null)
                .then((test) => setResult(`${test.action}: ${test.rule?.pattern ?? 'no rule'}`))
            }
          >
            Test
          </button>
        </div>
        {result && (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">{result}</div>
        )}
      </div>
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{rule.pattern}</div>
            <div className="text-xs text-muted">
              {rule.action} {rule.rule_type} /{' '}
              {rule.service_instance_id ? 'service-scoped' : 'global'}
            </div>
          </div>
          <button
            className="icon-button"
            aria-label="Delete"
            title="Delete"
            onClick={() => void api.firewall.delete(rule.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}
