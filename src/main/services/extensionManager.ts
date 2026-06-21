import type { Session } from 'electron';
import type Database from 'better-sqlite3';
import { listExtensions } from '../db/repositories/extensions.js';

// Loads enabled unpacked Chrome extensions (uBlock Origin, password managers, …) into each
// service partition. Electron supports MV2 and a growing subset of MV3 via session.loadExtension.
export class ExtensionManager {
  private readonly applied = new WeakSet<Session>();

  constructor(private readonly db: Database.Database) {}

  async applyTo(session: Session): Promise<void> {
    if (this.applied.has(session)) {
      return;
    }
    this.applied.add(session);
    for (const extension of listExtensions(this.db, true)) {
      try {
        await session.loadExtension(extension.path, { allowFileAccess: true });
      } catch {
        // Skip invalid/unsupported extensions rather than blocking the service from loading.
      }
    }
  }
}
