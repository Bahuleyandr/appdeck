import { app } from 'electron';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

export type UpdateStatus = 'idle' | 'dev' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';

export type PushSender = (channel: string, payload?: unknown) => void;

export class UpdaterService {
  private lastStatus: UpdateStatus = 'idle';

  constructor(private readonly sendPush: PushSender) {}

  init(): void {
    if (!app.isPackaged) {
      this.lastStatus = 'dev';
      return;
    }
    autoUpdater.autoDownload = true;
    autoUpdater.on('checking-for-update', () => this.set('checking'));
    autoUpdater.on('update-available', () => this.set('available'));
    autoUpdater.on('update-not-available', () => this.set('up-to-date'));
    autoUpdater.on('download-progress', () => this.set('downloading'));
    autoUpdater.on('update-downloaded', () => this.set('downloaded'));
    autoUpdater.on('error', () => this.set('error'));
    void autoUpdater.checkForUpdatesAndNotify().catch(() => this.set('error'));
  }

  status(): { status: UpdateStatus } {
    return { status: this.lastStatus };
  }

  check(): { status: UpdateStatus } {
    if (!app.isPackaged) {
      return { status: 'dev' };
    }
    void autoUpdater.checkForUpdates().catch(() => this.set('error'));
    return { status: this.lastStatus };
  }

  /** Quit and install a downloaded update (no-op until status is 'downloaded'). */
  install(): void {
    if (app.isPackaged && this.lastStatus === 'downloaded') {
      autoUpdater.quitAndInstall();
    }
  }

  private set(status: UpdateStatus): void {
    this.lastStatus = status;
    this.sendPush('event:update-status', { status });
  }
}
