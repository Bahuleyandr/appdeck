import type Database from 'better-sqlite3';
import { DEFAULT_SLEEP_IDLE_MINUTES } from '../../shared/constants.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { ServiceViewManager } from '../views/serviceViewManager.js';

export class SleepManager {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly viewManager: ServiceViewManager,
    private readonly intervalMs = 30_000
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  tick(): void {
    const now = Date.now();
    this.viewManager.trimHiddenViews(undefined, now);
    for (const instance of listServiceInstances(this.db)) {
      const idleMinutes = instance.sleep_policy.idleMinutes ?? DEFAULT_SLEEP_IDLE_MINUTES;
      if (idleMinutes === null) {
        continue;
      }
      const lastActiveAt = this.viewManager.getLastActiveAt(instance.id);
      if (!lastActiveAt) {
        continue;
      }
      if (this.viewManager.isFocused(instance.id) || this.viewManager.isAudible(instance.id)) {
        continue;
      }
      if (now - lastActiveAt >= idleMinutes * 60_000) {
        this.viewManager.sleep(instance.id);
      }
    }
  }
}
