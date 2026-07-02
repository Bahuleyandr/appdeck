import type Database from 'better-sqlite3';
import type {
  AutomationAction,
  AutomationRule,
  AutomationTestResult,
  AutomationTrigger
} from '../../../shared/types.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface AutomationRow {
  id: string;
  name: string;
  enabled: number;
  trigger_json: string;
  actions_json: string;
  last_run_at: number | null;
  created_at: number;
  updated_at: number;
}

function mapAutomation(row: AutomationRow): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    enabled: toBool(row.enabled),
    trigger: parseJson<AutomationTrigger>(row.trigger_json, { type: 'manual' }),
    actions: parseJson<AutomationAction[]>(row.actions_json, []),
    last_run_at: row.last_run_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function listAutomations(db: Database.Database): AutomationRule[] {
  return (
    db.prepare('SELECT * FROM automation_rules ORDER BY updated_at DESC').all() as AutomationRow[]
  ).map(mapAutomation);
}

export function getAutomation(db: Database.Database, id: string): AutomationRule | null {
  const row = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as
    | AutomationRow
    | undefined;
  return row ? mapAutomation(row) : null;
}

export function upsertAutomation(
  db: Database.Database,
  input: Partial<AutomationRule> & Pick<AutomationRule, 'name' | 'trigger' | 'actions'>
): AutomationRule {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO automation_rules
      (id, name, enabled, trigger_json, actions_json, last_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       enabled = excluded.enabled,
       trigger_json = excluded.trigger_json,
       actions_json = excluded.actions_json,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.name,
    input.enabled === false ? 0 : 1,
    stringifyJson(input.trigger),
    stringifyJson(input.actions),
    input.last_run_at ?? null,
    input.created_at ?? now,
    now
  );
  const saved = getAutomation(db, id);
  if (!saved) throw new Error('Failed to save automation');
  return saved;
}

export function deleteAutomation(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
}

export function markAutomationRun(db: Database.Database, id: string, at = Date.now()): void {
  db.prepare('UPDATE automation_rules SET last_run_at = ?, updated_at = ? WHERE id = ?').run(
    at,
    at,
    id
  );
}

export function testAutomation(
  rule: Pick<AutomationRule, 'trigger' | 'actions'>,
  sample: Record<string, unknown> = {}
): AutomationTestResult {
  const reasons: string[] = [];
  const trigger = rule.trigger;
  let matched = trigger.type === 'manual';
  if (trigger.type === 'manual') {
    reasons.push('Manual automations are always runnable.');
  }
  if (trigger.type === 'startup') {
    matched = sample.event === 'startup' || Object.keys(sample).length === 0;
    reasons.push(matched ? 'Startup event matches.' : 'Sample event is not startup.');
  }
  if (trigger.type === 'notification') {
    const text = `${sample.title ?? ''} ${sample.body ?? ''}`.toLowerCase();
    const needle = (trigger.matchText ?? '').toLowerCase();
    const serviceMatches = !trigger.serviceId || trigger.serviceId === sample.serviceId;
    matched = serviceMatches && (!needle || text.includes(needle));
    reasons.push(matched ? 'Notification sample matches.' : 'Notification sample did not match.');
  }
  if (trigger.type === 'unreadThreshold') {
    const unread = Number(sample.unread ?? 0);
    const threshold = trigger.unreadAtLeast ?? 1;
    matched = unread >= threshold;
    reasons.push(
      matched
        ? `Unread count ${unread} meets ${threshold}.`
        : `Unread count ${unread} is below ${threshold}.`
    );
  }
  if (trigger.type === 'schedule') {
    matched = isScheduleActive(trigger.schedule ?? [], new Date(Number(sample.now) || Date.now()));
    reasons.push(
      matched ? 'Current time is inside schedule.' : 'Current time is outside schedule.'
    );
  }
  return { matched, reasons, actions: matched ? rule.actions : [] };
}

/**
 * Start timestamp of the schedule window that contains `now`, or null when none does. Used to
 * fire schedule automations once per occurrence instead of on every runtime tick inside the
 * window. Overnight windows (from > to) that we are in the early-morning tail of started
 * yesterday. With overlapping slots the most recent start wins.
 */
export function scheduleSlotStart(
  schedule: Array<{ from: string; to: string; days: number[] }>,
  now: Date
): number | null {
  let latest: number | null = null;
  const minute = now.getHours() * 60 + now.getMinutes();
  for (const slot of schedule) {
    const from = timeToMinute(slot.from);
    const to = timeToMinute(slot.to);
    const overnight = from > to;
    const inWindow =
      (!overnight && slot.days.includes(now.getDay()) && minute >= from && minute <= to) ||
      (overnight &&
        ((slot.days.includes(now.getDay()) && minute >= from) ||
          (slot.days.includes((now.getDay() + 6) % 7) && minute <= to)));
    if (!inWindow) {
      continue;
    }
    const start = new Date(now);
    if (overnight && minute <= to) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(Math.floor(from / 60), from % 60, 0, 0);
    latest = latest === null ? start.getTime() : Math.max(latest, start.getTime());
  }
  return latest;
}

function isScheduleActive(
  schedule: Array<{ from: string; to: string; days: number[] }>,
  now: Date
): boolean {
  if (schedule.length === 0) return false;
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  return schedule.some((slot) => {
    if (!slot.days.includes(day)) return false;
    const from = timeToMinute(slot.from);
    const to = timeToMinute(slot.to);
    return from <= to ? minute >= from && minute <= to : minute >= from || minute <= to;
  });
}

function timeToMinute(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  const parsedHour = hour ?? 0;
  const parsedMinute = minute ?? 0;
  return (
    (Number.isFinite(parsedHour) ? parsedHour : 0) * 60 +
    (Number.isFinite(parsedMinute) ? parsedMinute : 0)
  );
}
