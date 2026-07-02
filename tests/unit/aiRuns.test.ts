import { describe, expect, it } from 'vitest';
import { insertAiRun, listAiRuns } from '../../src/main/db/repositories/aiRuns.js';
import { createTestDb } from './helpers.js';

describe('ai runs repository', () => {
  it('stores runs newest-first and caps history at 50', () => {
    const { db } = createTestDb();
    for (let i = 0; i < 55; i += 1) {
      insertAiRun(db, { kind: 'prompt', title: `Run ${i}`, text: `output ${i}` });
    }

    const runs = listAiRuns(db, 100);
    expect(runs).toHaveLength(50);
    expect(runs[0]?.title).toBe('Run 54');
    expect(runs.at(-1)?.title).toBe('Run 5');
  });
});
