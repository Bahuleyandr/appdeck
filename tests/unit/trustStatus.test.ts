import { describe, expect, it } from 'vitest';
import { buildTrustStatus } from '../../src/main/services/trustStatus.js';
import { createTestDb } from './helpers.js';

describe('trust status', () => {
  it('reports vault safety and release checklist shape', () => {
    const { db } = createTestDb();
    const status = buildTrustStatus(db, { enabled: true, blockedTotal: 3, topHosts: [] });

    expect(status.tracker.blockedTotal).toBe(3);
    expect(status.vault.safe).toBe(true);
    expect(status.vault.neverSyncs).toContain('AI keys');
    expect(status.release.length).toBeGreaterThan(0);
  });
});
