import type Database from 'better-sqlite3';
import { RecipeLoader } from '../recipes/loader.js';
import { AiService } from '../services/aiService.js';
import { AppLockService } from '../services/appLock.js';
import { AutomationRuntime } from '../services/automationRuntime.js';
import { BadgeService } from '../services/badges.js';
import { LinkRouter } from '../services/linkRouter.js';
import { NotificationService } from '../services/notifications.js';
import { PeerSyncRuntime } from '../services/peerSyncRuntime.js';
import { TrackerBlocker } from '../services/trackerBlock.js';
import { UpdaterService } from '../services/updater.js';
import { CloudSyncService } from '../sync/cloudSync.js';
import { FileSyncService } from '../sync/fileSync.js';
import { ServiceViewManager } from '../views/serviceViewManager.js';

/** Everything the IPC layer needs from main; passed to each handler group. */
export interface IpcContext {
  db: Database.Database;
  deviceId: string;
  recipeLoader: RecipeLoader;
  viewManager: ServiceViewManager;
  notificationService: NotificationService;
  automationRuntime: AutomationRuntime;
  badgeService: BadgeService;
  lockService: AppLockService;
  fileSyncService: FileSyncService;
  cloudSyncService: CloudSyncService;
  aiService: AiService;
  linkRouter: LinkRouter;
  trackerBlocker: TrackerBlocker;
  updaterService: UpdaterService;
  peerSyncRuntime: PeerSyncRuntime;
  sendPush: (channel: string, payload?: unknown) => void;
  sendDataChanged: () => void;
  onSettingsChanged: () => void;
}

export type Handler = (payload: unknown) => Promise<unknown> | unknown;
