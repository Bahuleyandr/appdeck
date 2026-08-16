import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'exe' ? 'C:\\Apps\\AppDeck\\AppDeck.exe' : '/userdata'),
    setPath: vi.fn()
  }
}));

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PORTABLE_ENV_VAR, PORTABLE_MARKER, resolvePortableRoot } from '../../src/main/services/portableMode.js';

const originalEnv = process.env[PORTABLE_ENV_VAR];

/** vi.stubEnv handles set-and-restore without dynamically deleting keys off process.env. */
function setPortableEnv(value: string | undefined): void {
  vi.stubEnv(PORTABLE_ENV_VAR, value);
}

afterEach(() => {
  setPortableEnv(originalEnv);
  vi.unstubAllEnvs();
});

describe('portable mode root resolution', () => {
  it('is off when neither the env var nor a marker file is present', () => {
    setPortableEnv(undefined);
    expect(resolvePortableRoot(mkdtempSync(join(tmpdir(), 'appdeck-exe-')))).toBe(null);
  });

  it('uses the env var when set', () => {
    const root = mkdtempSync(join(tmpdir(), 'appdeck-portable-'));
    setPortableEnv(root);
    expect(resolvePortableRoot(mkdtempSync(join(tmpdir(), 'appdeck-exe-')))).toBe(root);
  });

  it('uses a marker file next to the executable', () => {
    const exeDir = mkdtempSync(join(tmpdir(), 'appdeck-exe-'));
    setPortableEnv(undefined);
    writeFileSync(join(exeDir, PORTABLE_MARKER), '');

    // An empty marker means "keep data beside the executable".
    expect(resolvePortableRoot(exeDir)).toBe(join(exeDir, 'AppDeckData'));
  });

  it('honours a path written inside the marker file', () => {
    const exeDir = mkdtempSync(join(tmpdir(), 'appdeck-exe-'));
    const target = mkdtempSync(join(tmpdir(), 'appdeck-target-'));
    setPortableEnv(undefined);
    writeFileSync(join(exeDir, PORTABLE_MARKER), `${target}\n`);

    expect(resolvePortableRoot(exeDir)).toBe(target);
  });

  it('prefers the env var over a marker file', () => {
    const exeDir = mkdtempSync(join(tmpdir(), 'appdeck-exe-'));
    const envRoot = mkdtempSync(join(tmpdir(), 'appdeck-env-'));
    writeFileSync(join(exeDir, PORTABLE_MARKER), 'C:\\ignored');
    setPortableEnv(envRoot);

    expect(resolvePortableRoot(exeDir)).toBe(envRoot);
  });
});
