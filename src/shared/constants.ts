export const APP_NAME = 'AppDeck';
export const DEFAULT_WORKSPACE_NAME = 'Personal';
export const APPDECK_VAULT_FILE = 'appdeck.vault';
export const VAULT_MAGIC = 'APPDECK1';
export const VAULT_VERSION = 2;
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_SLEEP_IDLE_MINUTES = 30;
export const SERVICE_PARTITION_PREFIX = 'persist:svc-';

/** Applied to custom recipes flagged mobile_mode (and no explicit UA override). */
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Default Claude model for the AI layer (BYO key). */
export const AI_DEFAULT_MODEL = 'claude-opus-4-8';
/** Custom protocol AppDeck registers for the link-routing engine. */
export const APP_PROTOCOL = 'appdeck';
/** Default global hotkey to toggle the window. */
export const DEFAULT_GLOBAL_HOTKEY = 'CommandOrControl+Shift+Space';
/** Keep captured notifications this long, then prune. */
export const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export type ThemePreference = 'system' | 'light' | 'dark';
