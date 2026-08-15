import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

import { AiService } from '../../src/main/services/aiService.js';
import { createTestDb } from './helpers.js';

describe('AI local-only guard', () => {
  it('rejects localOnly for remote providers', () => {
    const { db } = createTestDb();
    const service = new AiService(db);

    expect(() =>
      service.configure({ provider: 'anthropic', apiKey: 'sk-test', localOnly: true })
    ).toThrow(/Ollama or OpenAI-compatible/);
    expect(() =>
      service.configure({ provider: 'openai', apiKey: 'sk-test', localOnly: true })
    ).toThrow(/Ollama or OpenAI-compatible/);
  });

  it('rejects localOnly when the endpoint is not local', () => {
    const { db } = createTestDb();
    const service = new AiService(db);

    expect(() =>
      service.configure({
        provider: 'compatible',
        localOnly: true,
        baseUrl: 'https://api.example.com/v1'
      })
    ).toThrow(/localhost/);
  });

  it('accepts localOnly for a local Ollama endpoint', () => {
    const { db } = createTestDb();
    const service = new AiService(db);

    service.configure({ provider: 'ollama', localOnly: true });

    const status = service.status();
    expect(status.localOnly).toBe(true);
    expect(status.provider).toBe('ollama');
    expect(status.configured).toBe(true);
  });
});
