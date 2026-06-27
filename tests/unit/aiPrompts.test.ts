import { describe, expect, it } from 'vitest';
import {
  deleteAiPrompt,
  listAiPrompts,
  upsertAiPrompt
} from '../../src/main/db/repositories/aiPrompts.js';
import { createTestDb } from './helpers.js';

describe('AI prompts repo', () => {
  it('saves, updates, and deletes prompts', () => {
    const { db } = createTestDb();
    const saved = upsertAiPrompt(db, {
      title: 'Draft reply',
      prompt: 'Draft a short reply',
      provider: 'ollama',
      model: 'llama3.1',
      local_only: true
    });

    expect(listAiPrompts(db)[0]?.local_only).toBe(true);
    upsertAiPrompt(db, { ...saved, title: 'Draft concise reply' });
    expect(listAiPrompts(db)[0]?.title).toBe('Draft concise reply');
    deleteAiPrompt(db, saved.id);
    expect(listAiPrompts(db)).toHaveLength(0);
  });
});
