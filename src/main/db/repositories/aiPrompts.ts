import type Database from 'better-sqlite3';
import type { AiPrompt } from '../../../shared/types.js';
import { toBool } from './json.js';

interface AiPromptRow extends Omit<AiPrompt, 'local_only'> {
  local_only: number;
}

function mapPrompt(row: AiPromptRow): AiPrompt {
  return { ...row, local_only: toBool(row.local_only) };
}

export function listAiPrompts(db: Database.Database): AiPrompt[] {
  return (db.prepare('SELECT * FROM ai_prompts ORDER BY title ASC').all() as AiPromptRow[]).map(
    mapPrompt
  );
}

export function getAiPrompt(db: Database.Database, id: string): AiPrompt | null {
  const row = db.prepare('SELECT * FROM ai_prompts WHERE id = ?').get(id) as
    | AiPromptRow
    | undefined;
  return row ? mapPrompt(row) : null;
}

export function upsertAiPrompt(
  db: Database.Database,
  input: Partial<AiPrompt> & Pick<AiPrompt, 'title' | 'prompt'>
): AiPrompt {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO ai_prompts
      (id, title, prompt, provider, model, local_only, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, prompt = excluded.prompt, provider = excluded.provider,
       model = excluded.model, local_only = excluded.local_only, updated_at = excluded.updated_at`
  ).run(
    id,
    input.title,
    input.prompt,
    input.provider ?? null,
    input.model ?? null,
    input.local_only ? 1 : 0,
    input.created_at ?? now,
    now
  );
  const saved = getAiPrompt(db, id);
  if (!saved) throw new Error('Failed to save AI prompt');
  return saved;
}

export function deleteAiPrompt(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM ai_prompts WHERE id = ?').run(id);
}
