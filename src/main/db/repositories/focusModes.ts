import type Database from 'better-sqlite3';
import type { FocusMode, FocusModeStatus } from '../../../shared/types.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface FocusModeRow {
  id: string;
  name: string;
  enabled: number;
  workspace_id: string | null;
  schedule_json: string;
  settings_json: string;
  created_at: number;
  updated_at: number;
}

function mapFocusMode(row: FocusModeRow): FocusMode {
  return {
    id: row.id,
    name: row.name,
    enabled: toBool(row.enabled),
    workspace_id: row.workspace_id,
    schedule: parseJson<FocusMode['schedule']>(row.schedule_json, []),
    settings: parseJson<FocusMode['settings']>(row.settings_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function listFocusModes(db: Database.Database): FocusMode[] {
  return (
    db.prepare('SELECT * FROM focus_modes ORDER BY enabled DESC, name ASC').all() as FocusModeRow[]
  ).map(mapFocusMode);
}

export function getFocusMode(db: Database.Database, id: string): FocusMode | null {
  const row = db.prepare('SELECT * FROM focus_modes WHERE id = ?').get(id) as
    | FocusModeRow
    | undefined;
  return row ? mapFocusMode(row) : null;
}

export function upsertFocusMode(
  db: Database.Database,
  input: Partial<FocusMode> & Pick<FocusMode, 'name'>
): FocusMode {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO focus_modes
      (id, name, enabled, workspace_id, schedule_json, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       enabled = excluded.enabled,
       workspace_id = excluded.workspace_id,
       schedule_json = excluded.schedule_json,
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.name,
    input.enabled === false ? 0 : 1,
    input.workspace_id ?? null,
    stringifyJson(input.schedule ?? []),
    stringifyJson(input.settings ?? {}),
    input.created_at ?? now,
    now
  );
  const saved = getFocusMode(db, id);
  if (!saved) throw new Error('Failed to save focus mode');
  return saved;
}

export function deleteFocusMode(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM focus_modes WHERE id = ?').run(id);
}

export function focusModeStatus(db: Database.Database): FocusModeStatus {
  const now = new Date();
  const modes = listFocusModes(db).filter((mode) => mode.enabled);
  const activeMode = modes.find((mode) => isActive(mode.schedule, now)) ?? null;
  const nextMode =
    activeMode ??
    modes
      .map((mode) => ({ mode, next: nextOccurrence(mode.schedule, now) }))
      .filter((entry) => entry.next !== null)
      .sort((a, b) => Number(a.next) - Number(b.next))[0]?.mode ??
    null;
  return { activeMode, nextMode, now: now.getTime() };
}

function isActive(schedule: FocusMode['schedule'], now: Date): boolean {
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

function nextOccurrence(schedule: FocusMode['schedule'], now: Date): number | null {
  if (schedule.length === 0) return null;
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const day = date.getDay();
    const slot = schedule.find((candidate) => candidate.days.includes(day));
    if (!slot) continue;
    const from = timeToMinute(slot.from);
    date.setHours(Math.floor(from / 60), from % 60, 0, 0);
    if (date.getTime() > now.getTime()) return date.getTime();
  }
  return null;
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
