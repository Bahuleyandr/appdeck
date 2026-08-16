import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PortableModeStatus } from '../../shared/types.js';

/**
 * Portable mode moves ALL user data — database, vault, logs, and the Chromium partitions that
 * hold each service's cookies — next to the app instead of %APPDATA%/~/Library.
 *
 * It cannot be a stored setting: the database that would hold the setting lives inside the very
 * directory being chosen. So the switch is a marker file beside the executable (or an env var),
 * read before `app.whenReady()` and applied with `app.setPath('userData', …)`.
 */
export const PORTABLE_ENV_VAR = 'APPDECK_PORTABLE_ROOT';
export const PORTABLE_MARKER = 'appdeck-portable.txt';
/** Used when the marker file is empty: keep data in a folder beside the executable. */
const DEFAULT_PORTABLE_DIRNAME = 'AppDeckData';

/**
 * Resolves the portable data root, or null when portable mode is off. `exeDir` is the directory
 * holding the executable (injected so this is testable without a packaged app).
 */
export function resolvePortableRoot(exeDir: string): string | null {
  const fromEnv = process.env[PORTABLE_ENV_VAR]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const markerPath = join(exeDir, PORTABLE_MARKER);
  if (!existsSync(markerPath)) {
    return null;
  }
  try {
    const configured = readFileSync(markerPath, 'utf8').trim();
    return configured || join(exeDir, DEFAULT_PORTABLE_DIRNAME);
  } catch {
    // Unreadable marker still means "portable"; fall back to the default location.
    return join(exeDir, DEFAULT_PORTABLE_DIRNAME);
  }
}

/**
 * Applies portable mode. MUST run before anything reads `userData` (database, logs, sessions).
 * Returns the root when portable, null otherwise.
 */
export function applyPortableMode(): string | null {
  const root = resolvePortableRoot(dirname(app.getPath('exe')));
  if (!root) {
    return null;
  }
  app.setPath('userData', root);
  return root;
}

export function portableModeStatus(): PortableModeStatus {
  const exeDir = dirname(app.getPath('exe'));
  const root = resolvePortableRoot(exeDir);
  return {
    active: root !== null,
    dataDirectory: app.getPath('userData'),
    markerPath: join(exeDir, PORTABLE_MARKER),
    envVar: PORTABLE_ENV_VAR,
    notes: [
      root
        ? 'Portable mode is on: the database, encrypted vault, logs, and every service login live in the data directory above.'
        : `Portable mode is off. Create ${PORTABLE_MARKER} beside the executable (empty file = data in a "${DEFAULT_PORTABLE_DIRNAME}" folder next to it, or write an absolute path inside it).`,
      `Setting the ${PORTABLE_ENV_VAR} environment variable to a folder overrides the marker file.`,
      'The setting is deliberately a file rather than an in-app toggle: the database that would store it lives inside the folder being chosen.'
    ]
  };
}
