import type Database from 'better-sqlite3';
import type { AiRun } from '../../../shared/types.js';

const MAX_AI_RUNS = 50;

/** Outputs of scheduled/manual AI runs (briefings, saved prompts). Local-only, never synced. */
export function insertAiRun(
  db: Database.Database,
  input: { kind: AiRun['kind']; title: string; text: string }
): AiRun {
  const now = Date.now();
  const info = db
    .prepare('INSERT INTO ai_runs (kind, title, text, created_at) VALUES (?, ?, ?, ?)')
    .run(input.kind, input.title, input.text, now);
  db.prepare(
    `DELETE FROM ai_runs WHERE id NOT IN (
       SELECT id FROM ai_runs ORDER BY created_at DESC, id DESC LIMIT ?
     )`
  ).run(MAX_AI_RUNS);
  return {
    id: Number(info.lastInsertRowid),
    kind: input.kind,
    title: input.title,
    text: input.text,
    created_at: now
  };
}

export function listAiRuns(db: Database.Database, limit = 20): AiRun[] {
  return db
    .prepare('SELECT * FROM ai_runs ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(limit) as AiRun[];
}
