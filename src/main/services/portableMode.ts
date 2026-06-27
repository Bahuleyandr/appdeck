import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { PortableModeStatus } from '../../shared/types.js';
import { getSetting, setSetting } from '../db/repositories/settings.js';

export function portableModeStatus(db: Database.Database): PortableModeStatus {
  const enabled = getSetting(db, 'portable_mode_enabled') === 'true';
  const rootPath = getSetting(db, 'portable_mode_root') || null;
  return {
    enabled,
    rootPath,
    recommendedPaths: [
      path.join(os.homedir(), 'AppDeckPortable'),
      'D:\\AppDeckPortable',
      'E:\\AppDeckPortable'
    ],
    notes: [
      'Portable mode keeps future exports, vault files, recipe packs, and recovery bundles under one chosen root.',
      'Cookies and service partitions remain Electron-managed unless a packaged portable build overrides userData.',
      'Secrets stay local and are not added to sync payloads.'
    ]
  };
}

export function configurePortableMode(
  db: Database.Database,
  enabled: boolean,
  rootPath?: string | null
): PortableModeStatus {
  setSetting(db, 'portable_mode_enabled', enabled ? 'true' : 'false');
  setSetting(db, 'portable_mode_root', rootPath?.trim() ?? '');
  return portableModeStatus(db);
}
