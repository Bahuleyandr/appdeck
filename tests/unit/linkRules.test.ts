import { describe, expect, it } from 'vitest';
import {
  matchLinkRule,
  testLinkRules,
  upsertLinkRule
} from '../../src/main/db/repositories/linkRules.js';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { createTestDb } from './helpers.js';

describe('link rules', () => {
  it('matches enabled rules by ascending priority', () => {
    const domain = upsertLinkRule(createTestDb().db, {
      name: 'All GitHub',
      priority: 50,
      match_type: 'domain',
      pattern: 'github.com',
      target_type: 'external'
    });
    const exact = {
      ...domain,
      id: 'exact',
      name: 'Repo',
      priority: 10,
      match_type: 'exact' as const,
      pattern: 'https://github.com/Bahuleyandr/appdeck',
      target_type: 'service' as const,
      target_id: 'svc'
    };

    expect(matchLinkRule([domain, exact], 'https://github.com/Bahuleyandr/appdeck')?.name).toBe(
      'Repo'
    );
    expect(
      matchLinkRule(
        [{ ...exact, enabled: false }, domain],
        'https://github.com/Bahuleyandr/appdeck'
      )?.name
    ).toBe('All GitHub');
  });

  it('resolves service targets for rule tests', () => {
    const { db, deviceId } = createTestDb();
    const workspace = listWorkspaces(db)[0];
    if (!workspace) throw new Error('Expected default workspace');
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'github',
      workspaceId: workspace.id,
      displayName: 'GitHub'
    });
    upsertLinkRule(db, {
      name: 'GitHub to AppDeck',
      priority: 1,
      match_type: 'domain',
      pattern: 'github.com',
      target_type: 'service',
      target_id: service.id
    });

    const result = testLinkRules(db, 'https://github.com/Bahuleyandr/appdeck');
    expect(result.matched).toBe(true);
    expect(result.external).toBe(false);
    expect(result.targetServiceId).toBe(service.id);
  });
});
