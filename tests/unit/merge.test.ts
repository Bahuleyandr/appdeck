import { describe, expect, it } from 'vitest';
import type { SyncRecord } from '../../src/shared/types.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { mergeVaultPlaintext } from '../../src/main/sync/merge.js';
import { createTestDb } from './helpers.js';

function workspaceRecord(base: { id: string; updatedAt: number; name: string; origin: string; rev: number }): SyncRecord {
  return {
    type: 'workspace',
    id: base.id,
    rev: base.rev,
    updatedAt: base.updatedAt,
    deletedAt: null,
    originDevice: base.origin,
    data: { id: base.id, name: base.name, icon: null, color: null, position: 0, focus_rules: {}, sleep_defaults: {} }
  };
}

describe('sync merge (last-write-wins)', () => {
  it('applies a strictly newer incoming record without spawning conflict copies', () => {
    const { db } = createTestDb();
    const current = listWorkspaces(db)[0];
    if (!current) throw new Error('Expected default workspace');

    const result = mergeVaultPlaintext(db, {
      schemaVersion: 1,
      records: [workspaceRecord({ id: current.id, updatedAt: current.updated_at + 10, name: 'Remote Personal', origin: 'other-device', rev: current.rev })]
    });

    const names = listWorkspaces(db, true).map((workspace) => workspace.name);
    expect(result.applied).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(names).toContain('Remote Personal');
    expect(names.some((name) => name.includes('(conflict)'))).toBe(false);
  });

  it('ignores an older incoming record', () => {
    const { db } = createTestDb();
    const current = listWorkspaces(db)[0];
    if (!current) throw new Error('Expected default workspace');

    const result = mergeVaultPlaintext(db, {
      schemaVersion: 1,
      records: [workspaceRecord({ id: current.id, updatedAt: current.updated_at - 10, name: 'Stale', origin: 'other-device', rev: current.rev + 5 })]
    });

    expect(result.applied).toBe(0);
    expect(listWorkspaces(db)[0]?.name).toBe(current.name);
  });
});
