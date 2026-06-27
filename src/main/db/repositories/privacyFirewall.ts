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

export interface FirewallMatchInput {
  url?: string;
  serviceInstanceId?: string | null;
  ruleType?: PrivacyFirewallRule['rule_type'];
  resourceType?: string;
  permission?: string;
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
  serviceInstanceId?: string | null,
  input: Omit<FirewallMatchInput, 'url' | 'serviceInstanceId'> = {}
): PrivacyFirewallTestResult {
  const matched = matchFirewallRule(listFirewallRules(db), {
    ...input,
    url,
    serviceInstanceId
  });
  return {
    matched: Boolean(matched),
    action: matched?.action ?? 'allow',
    rule: matched
  };
}

export function matchFirewallRule(
  rules: PrivacyFirewallRule[],
  input: FirewallMatchInput
): PrivacyFirewallRule | null {
  return (
    rules.find((rule) => {
      if (!rule.enabled) return false;
      if (rule.service_instance_id && rule.service_instance_id !== input.serviceInstanceId) {
        return false;
      }
      if (input.ruleType && rule.rule_type !== input.ruleType && rule.rule_type !== 'domain') {
        return false;
      }
      return ruleMatches(rule, input);
    }) ?? null
  );
}

function ruleMatches(rule: PrivacyFirewallRule, input: FirewallMatchInput): boolean {
  const pattern = rule.pattern.trim().toLowerCase();
  if (!pattern) return false;
  if (pattern === '*') return true;
  if (rule.rule_type === 'permission') {
    return (input.permission ?? '').toLowerCase().includes(pattern);
  }
  if (rule.rule_type === 'script' && input.resourceType && input.resourceType !== 'script') {
    return false;
  }
  if (rule.rule_type === 'clipboard' || rule.rule_type === 'download') {
    return valueMatches(input.url ?? input.permission ?? '', pattern);
  }
  if (rule.rule_type === 'domain') {
    return hostMatches(input.url, pattern);
  }
  return valueMatches(input.url ?? '', pattern);
}

function hostMatches(url: string | undefined, pattern: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === pattern || hostname.endsWith(`.${pattern}`) || hostname.includes(pattern);
  } catch {
    return false;
  }
}

function valueMatches(value: string, pattern: string): boolean {
  return value.toLowerCase().includes(pattern);
}
