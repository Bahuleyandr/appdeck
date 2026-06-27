import { describe, expect, it } from 'vitest';
import { listDashboards, upsertDashboard } from '../../src/main/db/repositories/dashboards.js';
import { createTestDb } from './helpers.js';

describe('dashboards', () => {
  it('round-trips widget arrays through sqlite', () => {
    const { db } = createTestDb();
    const dashboard = upsertDashboard(db, {
      name: 'Morning',
      workspace_id: null,
      widgets: [
        { id: 'w1', type: 'shortcuts', title: 'Shortcuts', config: {} },
        { id: 'w2', type: 'notes', title: 'Notes', config: { body: 'Plan' } }
      ]
    });

    expect(dashboard.widgets).toHaveLength(2);
    expect(listDashboards(db)[0]?.widgets[1]?.config).toEqual({ body: 'Plan' });
  });
});
