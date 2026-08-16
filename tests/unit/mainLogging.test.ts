import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', async () => {
  const { mkdtempSync: makeTemp } = await import('node:fs');
  const { tmpdir: osTmp } = await import('node:os');
  const { join: joinPath } = await import('node:path');
  const dir = makeTemp(joinPath(osTmp(), 'appdeck-log-test-'));
  return { app: { getPath: () => dir } };
});

import { app } from 'electron';
import { backupBeforeMigration } from '../../src/main/db/connection.js';
import { LATEST_SCHEMA_VERSION } from '../../src/main/db/migrate.js';
import { logError, logLine } from '../../src/main/services/log.js';

const LOG_PATH = join(app.getPath('userData'), 'logs', 'main.log');

describe('main-process file logger', () => {
  it('appends structured lines and error details', () => {
    logLine('info', 'startup', 'hello');
    logError('updater', new Error('download failed'));

    const contents = readFileSync(LOG_PATH, 'utf8');
    expect(contents).toContain('[info] startup: hello');
    expect(contents).toContain('[error] updater: download failed');
  });

  it('rotates the log once it grows past the size cap', () => {
    writeFileSync(LOG_PATH, 'x'.repeat(1024 * 1024 + 1));
    logLine('warn', 'rotation', 'fresh line');

    expect(existsSync(`${LOG_PATH}.1`)).toBe(true);
    const contents = readFileSync(LOG_PATH, 'utf8');
    expect(contents).toContain('[warn] rotation: fresh line');
    expect(contents.length).toBeLessThan(1024);
  });
});

describe('pre-migration backup', () => {
  function dbWithSchemaVersion(version: number): { db: Database.Database; path: string } {
    const dir = mkdtempSync(join(tmpdir(), 'appdeck-backup-test-'));
    const path = join(dir, 'appdeck.sqlite');
    const db = new Database(path);
    db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(version)
    );
    return { db, path };
  }

  it('copies an existing outdated database before migrations run', () => {
    const { db, path } = dbWithSchemaVersion(3);
    backupBeforeMigration(db, path);
    db.close();

    expect(existsSync(`${path}.bak-v3`)).toBe(true);
  });

  it('skips fresh databases and already-current databases', () => {
    const { db, path } = dbWithSchemaVersion(LATEST_SCHEMA_VERSION);
    backupBeforeMigration(db, path);
    db.close();
    expect(existsSync(`${path}.bak-v${LATEST_SCHEMA_VERSION}`)).toBe(false);

    const freshDir = mkdtempSync(join(tmpdir(), 'appdeck-backup-test-'));
    const freshPath = join(freshDir, 'appdeck.sqlite');
    const fresh = new Database(freshPath);
    backupBeforeMigration(fresh, freshPath);
    fresh.close();
    expect(existsSync(`${freshPath}.bak-v0`)).toBe(false);
  });
});
