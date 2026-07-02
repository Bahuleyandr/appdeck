import { describe, expect, it } from 'vitest';
import { deleteMeta, getMeta } from '../../src/main/db/repositories/meta.js';
import {
  createServiceInstance,
  getServiceInstance,
  updateServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import {
  approveCustomCode,
  grandfatherExistingCustomCode,
  isCustomCodeApproved,
  listPendingCustomCode
} from '../../src/main/services/customCode.js';
import { mergeVaultPlaintext } from '../../src/main/sync/merge.js';
import { buildVaultPlaintext } from '../../src/main/sync/vault.js';
import { createTestDb } from './helpers.js';

function makeService(context: ReturnType<typeof createTestDb>, displayName: string) {
  const workspace = listWorkspaces(context.db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return createServiceInstance(context.db, context.deviceId, {
    recipeId: 'whatsapp',
    workspaceId: workspace.id,
    displayName
  });
}

describe('custom code provenance gate', () => {
  it('treats services without custom code as approved', () => {
    const context = createTestDb();
    const service = makeService(context, 'Plain');

    expect(isCustomCodeApproved(context.db, service)).toBe(true);
    expect(listPendingCustomCode(context.db)).toEqual([]);
  });

  it('marks locally edited custom code as approved via approveCustomCode', () => {
    const context = createTestDb();
    const service = makeService(context, 'Styled');
    const updated = updateServiceInstance(context.db, context.deviceId, service.id, {
      custom_js: 'console.log("hi")'
    });

    expect(isCustomCodeApproved(context.db, updated)).toBe(false);
    approveCustomCode(context.db, service.id);
    const fresh = getServiceInstance(context.db, service.id);
    if (!fresh) throw new Error('Service vanished');
    expect(isCustomCodeApproved(context.db, fresh)).toBe(true);
  });

  it('un-approves custom code that arrives changed via sync merge', () => {
    const context = createTestDb();
    const service = makeService(context, 'Synced');
    updateServiceInstance(context.db, context.deviceId, service.id, {
      custom_js: 'console.log("local")'
    });
    approveCustomCode(context.db, service.id);

    // Simulate another device pushing different custom_js for the same instance.
    const vault = buildVaultPlaintext(context.db);
    const record = vault.records.find(
      (candidate) => candidate.type === 'serviceInstance' && candidate.id === service.id
    );
    if (!record) throw new Error('Expected service record in vault');
    record.data.custom_js = 'document.title = "owned"';
    record.updatedAt += 10_000;
    record.rev += 1;
    record.originDevice = 'other-device';
    mergeVaultPlaintext(context.db, vault);

    const merged = getServiceInstance(context.db, service.id);
    if (!merged) throw new Error('Service vanished');
    expect(merged.custom_js).toBe('document.title = "owned"');
    expect(isCustomCodeApproved(context.db, merged)).toBe(false);
    expect(listPendingCustomCode(context.db).map((entry) => entry.instanceId)).toEqual([
      service.id
    ]);

    approveCustomCode(context.db, service.id);
    expect(isCustomCodeApproved(context.db, merged)).toBe(true);
    expect(listPendingCustomCode(context.db)).toEqual([]);
  });

  it('grandfathers pre-gate custom code exactly once', () => {
    const context = createTestDb();
    const service = makeService(context, 'Legacy');
    updateServiceInstance(context.db, context.deviceId, service.id, {
      custom_css: 'body { background: black; }'
    });

    // Reset the one-time flag that migrate() set when the DB was created, then re-run.
    deleteMeta(context.db, 'custom_code_grandfathered');
    grandfatherExistingCustomCode(context.db);

    const fresh = getServiceInstance(context.db, service.id);
    if (!fresh) throw new Error('Service vanished');
    expect(isCustomCodeApproved(context.db, fresh)).toBe(true);
    expect(getMeta(context.db, 'custom_code_grandfathered')).toBe('1');

    // A later change is NOT auto-approved: the flag prevents re-grandfathering.
    updateServiceInstance(context.db, context.deviceId, service.id, {
      custom_css: 'body { background: red; }'
    });
    grandfatherExistingCustomCode(context.db);
    const changed = getServiceInstance(context.db, service.id);
    if (!changed) throw new Error('Service vanished');
    expect(isCustomCodeApproved(context.db, changed)).toBe(false);
  });
});
