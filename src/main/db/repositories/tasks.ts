import type Database from 'better-sqlite3';
import type { Task } from '../../../shared/types.js';
import { toBool } from './json.js';

interface TaskRow {
  id: string;
  title: string;
  done: number;
  position: number;
  created_at: number;
}

function mapTask(row: TaskRow): Task {
  return { ...row, done: toBool(row.done) };
}

export function listTasks(db: Database.Database): Task[] {
  return (db.prepare('SELECT * FROM tasks ORDER BY position ASC, created_at ASC').all() as TaskRow[]).map(mapTask);
}

export function createTask(db: Database.Database, title: string): Task {
  const id = crypto.randomUUID();
  const positionRow = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM tasks').get() as { position: number };
  db.prepare('INSERT INTO tasks (id, title, done, position, created_at) VALUES (?, ?, 0, ?, ?)').run(
    id,
    title,
    positionRow.position,
    Date.now()
  );
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!row) throw new Error('Failed to create task');
  return mapTask(row);
}

export function updateTask(db: Database.Database, id: string, patch: Partial<Pick<Task, 'title' | 'done'>>): Task {
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!current) throw new Error(`Task not found: ${id}`);
  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(
    patch.title ?? current.title,
    typeof patch.done === 'boolean' ? (patch.done ? 1 : 0) : current.done,
    id
  );
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!row) throw new Error('Failed to update task');
  return mapTask(row);
}

export function deleteTask(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

export function reorderTasks(db: Database.Database, orderedIds: string[]): void {
  const stmt = db.prepare('UPDATE tasks SET position = ? WHERE id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, position) => stmt.run(position, id));
  })();
}
