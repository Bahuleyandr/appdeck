import type Database from 'better-sqlite3';
import type { PrivacyFirewallRule, PrivacyFirewallTestResult } from '../../../shared/types.js';
import { toBool } from './json.js';

interface FirewallRow {
  id: string;
  service_instance_id: string | null;
  rule_type: PrivacyFirewallRule['rule_type'];
  pattern: string;
  action: PrivacyFirewallRule['action'];
  enabled: number;
  created_at: number;
  updated_at: number;
}

function mapRule(row: FirewallRow): PrivacyFirewallRule {
  return { ...row, enabled: toBool(row.enabled) };
}

export function listFirewallRules(db: Database.Database): PrivacyFirewallRule[] {
  return (
    db
      .prepare(
        'SELECT * FROM privacy_firewall_rules ORDER BY enabled DESC, service_instance_id ASC, rule_type ASC, pattern ASC'
      )
      .all() as FirewallRow[]
  ).map(mapRule);
}

export function getFirewallRule(db: Database.Database, id: string): PrivacyFirewallRule | null {
  const row = db.prepare('SELECT * FROM privacy_firewall_rules WHERE id = ?').get(id) as
    | FirewallRow
    | undefined;
  return row ? mapRule(row) : null;
}

export function upsertFirewallRule(
  db: Database.Database,
  input: Partial<PrivacyFirewallRule> &
    Pick<PrivacyFirewallRule, 'rule_type' | 'pattern' | 'action'>
): PrivacyFirewallRule {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO privacy_firewall_rules
      (id, service_instance_id, rule_type, pattern, action, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       service_instance_id = excluded.service_instance_id,
       rule_type = excluded.rule_type,
       pattern = excluded.pattern,
       action = excluded.action,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.service_instance_id ?? null,
    input.rule_type,
    input.pattern.trim(),
    input.action,
    input.enabled === false ? 0 : 1,
    input.created_at ?? now,
    now
  );
  const saved = getFirewallRule(db, id);
  if (!saved) throw new Error('Failed to save firewall rule');
  return saved;
}

export function deleteFirewallRule(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM privacy_firewall_rules WHERE id = ?').run(id);
}

export function testFirewallRules(
  db: Database.Database,
  url: string,
  serviceInstanceId?: string | null
): PrivacyFirewallTestResult {
  const rules = listFirewallRules(db).filter(
    (rule) =>
      rule.enabled &&
      (!rule.service_instance_id ||
        !serviceInstanceId ||
        rule.service_instance_id === serviceInstanceId)
  );
  const target = new URL(url);
  const matched =
    rules.find((rule) => {
      const pattern = rule.pattern.toLowerCase();
      if (rule.rule_type === 'domain') {
        return target.hostname.toLowerCase().includes(pattern);
      }
      return url.toLowerCase().includes(pattern);
    }) ?? null;
  return {
    matched: Boolean(matched),
    action: matched?.action ?? 'allow',
    rule: matched
  };
}
