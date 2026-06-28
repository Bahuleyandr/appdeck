import type Database from 'better-sqlite3';
import { getMeta, setMeta } from './meta.js';

// User-facing settings persisted in the meta table. Local-only (never synced).
export type SettingKey =
  | 'theme'
  | 'global_dnd'
  | 'tracker_block'
  | 'close_to_tray'
  | 'global_hotkey'
  | 'onboarded'
  | 'launch_at_login'
  | 'auto_lock_minutes'
  | 'portable_mode_enabled'
  | 'portable_mode_root'
  | 'peer_sync_serve';

const SETTING_KEYS: SettingKey[] = [
  'theme',
  'global_dnd',
  'tracker_block',
  'close_to_tray',
  'global_hotkey',
  'onboarded',
  'launch_at_login',
  'auto_lock_minutes',
  'portable_mode_enabled',
  'portable_mode_root',
  'peer_sync_serve'
];

const DEFAULTS: Record<SettingKey, string> = {
  theme: 'system',
  global_dnd: 'false',
  tracker_block: 'false',
  close_to_tray: 'true',
  global_hotkey: '',
  onboarded: 'false',
  launch_at_login: 'false',
  auto_lock_minutes: '',
  portable_mode_enabled: 'false',
  portable_mode_root: '',
  peer_sync_serve: 'false'
};

export function getSetting(db: Database.Database, key: SettingKey): string {
  return getMeta(db, `setting_${key}`) ?? DEFAULTS[key];
}

export function getBoolSetting(db: Database.Database, key: SettingKey): boolean {
  return getSetting(db, key) === 'true';
}

export function setSetting(db: Database.Database, key: SettingKey, value: string): void {
  setMeta(db, `setting_${key}`, value);
}

export function getAllSettings(db: Database.Database): Record<SettingKey, string> {
  const result = {} as Record<SettingKey, string>;
  for (const key of SETTING_KEYS) {
    result[key] = getSetting(db, key);
  }
  return result;
}
