import type Database from 'better-sqlite3';
import type { LinkRule, LinkRuleTestResult } from '../../../shared/types.js';
import { listServiceInstances } from './serviceInstances.js';
import { toBool } from './json.js';

interface LinkRuleRow extends Omit<LinkRule, 'enabled'> {
  enabled: number;
}

function mapRule(row: LinkRuleRow): LinkRule {
  return { ...row, enabled: toBool(row.enabled) };
}

export function listLinkRules(db: Database.Database): LinkRule[] {
  return (
    db.prepare('SELECT * FROM link_rules ORDER BY priority ASC, name ASC').all() as LinkRuleRow[]
  ).map(mapRule);
}

export function upsertLinkRule(
  db: Database.Database,
  input: Partial<LinkRule> & Pick<LinkRule, 'name' | 'match_type' | 'pattern' | 'target_type'>
): LinkRule {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO link_rules
      (id, name, priority, match_type, pattern, target_type, target_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, priority = excluded.priority, match_type = excluded.match_type,
       pattern = excluded.pattern, target_type = excluded.target_type, target_id = excluded.target_id,
       enabled = excluded.enabled, updated_at = excluded.updated_at`
  ).run(
    id,
    input.name,
    input.priority ?? 100,
    input.match_type,
    input.pattern,
    input.target_type,
    input.target_id ?? null,
    input.enabled === false ? 0 : 1,
    input.created_at ?? now,
    now
  );
  const row = db.prepare('SELECT * FROM link_rules WHERE id = ?').get(id) as
    | LinkRuleRow
    | undefined;
  if (!row) throw new Error('Failed to save link rule');
  return mapRule(row);
}

export function deleteLinkRule(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM link_rules WHERE id = ?').run(id);
}

export function testLinkRules(db: Database.Database, url: string): LinkRuleTestResult {
  const rule = matchLinkRule(listLinkRules(db), url);
  if (!rule) {
    return { matched: false, external: true };
  }
  const services = listServiceInstances(db);
  const targetServiceId =
    rule.target_type === 'service'
      ? rule.target_id
      : rule.target_type === 'profile'
        ? services.find((service) => service.profile_id === rule.target_id)?.id
        : null;
  return { matched: true, rule, targetServiceId, external: rule.target_type === 'external' };
}

export function matchLinkRule(rules: LinkRule[], url: string): LinkRule | null {
  for (const rule of rules
    .filter((candidate) => candidate.enabled)
    .sort((a, b) => a.priority - b.priority)) {
    if (matches(rule, url)) {
      return rule;
    }
  }
  return null;
}

function matches(rule: LinkRule, rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (rule.match_type === 'exact')
      return parsed.toString() === rule.pattern || rawUrl === rule.pattern;
    if (rule.match_type === 'domain')
      return parsed.hostname === rule.pattern || parsed.hostname.endsWith(`.${rule.pattern}`);
    if (rule.match_type === 'contains') return rawUrl.includes(rule.pattern);
    if (rule.match_type === 'regex') return new RegExp(rule.pattern).test(rawUrl);
    return false;
  } catch {
    return false;
  }
}
