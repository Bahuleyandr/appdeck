import { app } from 'electron';
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Minimal append-only file logger for the main process. Best-effort by design: logging must
// never take the app down, so every filesystem touch is swallowed on failure.
const MAX_LOG_BYTES = 1024 * 1024;

let resolvedPath: string | null | undefined;

function logFilePath(): string | null {
  if (resolvedPath !== undefined) {
    return resolvedPath;
  }
  try {
    const dir = join(app.getPath('userData'), 'logs');
    mkdirSync(dir, { recursive: true });
    resolvedPath = join(dir, 'main.log');
  } catch {
    resolvedPath = null;
  }
  return resolvedPath;
}

function rotateIfNeeded(path: string): void {
  try {
    if (statSync(path).size >= MAX_LOG_BYTES) {
      renameSync(path, `${path}.1`);
    }
  } catch {
    // Missing file or a failed rotation — either way, keep appending.
  }
}

export function logLine(level: 'info' | 'warn' | 'error', scope: string, message: string): void {
  const path = logFilePath();
  if (!path) {
    return;
  }
  try {
    rotateIfNeeded(path);
    appendFileSync(path, `${new Date().toISOString()} [${level}] ${scope}: ${message}\n`);
  } catch {
    // Never let logging break the caller.
  }
}

export function logError(scope: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : String(error);
  logLine('error', scope, detail);
}
