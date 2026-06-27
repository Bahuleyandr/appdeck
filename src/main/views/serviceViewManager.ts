import { BrowserWindow, WebContentsView, shell, session, type Session } from 'electron';
import type Database from 'better-sqlite3';
import { MOBILE_USER_AGENT } from '../../shared/constants.js';
import { isHttpUrl } from '../../shared/ipc-contract.js';
import type {
  PermissionPolicy,
  Rect,
  ServiceInstance,
  ServiceProxy,
  ServiceState
} from '../../shared/types.js';
import { getServiceInstance, setServiceLastUrl } from '../db/repositories/serviceInstances.js';
import { ensureDefaultTab, getTab, setTabUrlTitle } from '../db/repositories/serviceTabs.js';
import { upsertDownload } from '../db/repositories/downloads.js';
import { permissionDecision } from '../db/repositories/permissionPolicies.js';
import { testFirewallRules } from '../db/repositories/privacyFirewall.js';
import { RecipeLoader } from '../recipes/loader.js';
import type { ExtensionManager } from '../services/extensionManager.js';
import { extensionRuntimeForDb } from '../services/extensionPack.js';
import type { TrackerBlocker } from '../services/trackerBlock.js';
import { normalizeRect } from './viewBounds.js';

function instanceIdOf(viewId: string): string {
  return viewId.split('#')[0] ?? viewId;
}
function tabIdOf(viewId: string): string | null {
  const parts = viewId.split('#');
  return parts.length > 1 ? (parts[1] ?? null) : null;
}

export type PushSender = (channel: string, payload?: unknown) => void;

export function resolvePermissionDecision(decision: PermissionPolicy['decision'] | null): boolean {
  return decision === 'allow';
}

// Injected into each service page's MAIN world via privileged executeJavaScript (bypasses the
// page's CSP). Replacing window.Notification in an isolated preload world has no effect on the
// page, so this must run in the page world. It routes every notification back to the isolated
// preload via postMessage, which forwards it to the main process for mute/DND handling.
const NOTIFICATION_SHIM = `(() => {
  if (window.__appdeckNotifyInstalled) return;
  window.__appdeckNotifyInstalled = true;
  class AppDeckNotification extends EventTarget {
    static permission = 'granted';
    static maxActions = 0;
    constructor(title, options) {
      super();
      this.title = String(title == null ? '' : title);
      this.body = (options && options.body) || '';
      this.icon = (options && options.icon) || '';
      this.onclick = null;
      try {
        window.postMessage({ __appdeck: 'notify', title: this.title, body: this.body, icon: this.icon }, '*');
      } catch (err) { /* ignore */ }
    }
    close() { try { this.dispatchEvent(new Event('close')); } catch (err) {} }
    static requestPermission(cb) { if (typeof cb === 'function') cb('granted'); return Promise.resolve('granted'); }
  }
  try {
    Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: AppDeckNotification });
  } catch (err) { /* ignore */ }
  // Many PWAs (Slack, WhatsApp) notify via the service worker registration rather than the
  // Notification constructor. Intercept the page-initiated path too. (Notifications fired from
  // INSIDE the service worker's own scope on push events cannot be intercepted from here.)
  try {
    if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype) {
      ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        try {
          window.postMessage({ __appdeck: 'notify', title: String(title == null ? '' : title), body: (options && options.body) || '', icon: (options && options.icon) || '' }, '*');
        } catch (err) { /* ignore */ }
        return Promise.resolve();
      };
    }
  } catch (err) { /* ignore */ }
})();`;

interface ManagedView {
  viewId: string;
  instanceId: string;
  tabId: string | null;
  view: WebContentsView;
  attached: boolean;
  lastActiveAt: number;
}

export class ServiceViewManager {
  // Keyed by viewId = `${instanceId}#${tabId}`. All tabs of an instance share its partition.
  private readonly views = new Map<string, ManagedView>();
  private readonly pendingNavigations = new Map<string, string>();
  private readonly configuredSessions = new WeakSet<Session>();
  private activeInstanceId: string | null = null;
  private visibleIds = new Set<string>();

  constructor(
    private readonly db: Database.Database,
    private readonly deviceId: string,
    private readonly recipeLoader: RecipeLoader,
    private readonly servicePreloadPath: string,
    private readonly sendPush: PushSender,
    private readonly onActivity: () => void = () => {},
    private readonly extensionManager: ExtensionManager | null = null,
    private readonly trackerBlocker: TrackerBlocker | null = null,
    private window: BrowserWindow | null = null
  ) {}

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  setBounds(entries: Array<{ viewId: string; rect: Rect }>, visibleIds: string[]): void {
    this.visibleIds = new Set(visibleIds);
    const byId = new Map(entries.map((entry) => [entry.viewId, normalizeRect(entry.rect)]));
    this.detachHiddenViews();
    for (const viewId of visibleIds) {
      const rect = byId.get(viewId);
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const instance = getServiceInstance(this.db, instanceIdOf(viewId));
      if (!instance || instance.deleted_at) {
        continue;
      }
      const resolved = this.recipeLoader.resolveForInstance(instance);
      if (resolved.isLauncherOnly) {
        this.emitState(instance.id, 'ready');
        continue;
      }
      const managed = this.ensureView(viewId, instance);
      managed.view.setBounds(rect);
      this.attach(managed);
    }
  }

  /** Accepts a viewId or a bare instanceId (resolved to the instance's active tab). */
  focus(idOrViewId: string): void {
    const viewId = this.toViewId(idOrViewId);
    if (!viewId) return;
    this.activeInstanceId = instanceIdOf(viewId);
    this.markActive(viewId);
    this.views.get(viewId)?.view.webContents.focus();
  }

  reload(idOrViewId: string): void {
    const viewId = this.toViewId(idOrViewId);
    if (viewId) this.views.get(viewId)?.view.webContents.reload();
  }

  navigateBack(idOrViewId: string): void {
    const contents = this.contentsFor(idOrViewId);
    if (contents?.navigationHistory.canGoBack()) {
      contents.navigationHistory.goBack();
    }
  }

  navigateForward(idOrViewId: string): void {
    const contents = this.contentsFor(idOrViewId);
    if (contents?.navigationHistory.canGoForward()) {
      contents.navigationHistory.goForward();
    }
  }

  navigate(idOrViewId: string, url: string): void {
    if (!isHttpUrl(url)) return;
    const contents = this.contentsFor(idOrViewId);
    if (contents) void contents.loadURL(url);
  }

  routeNavigate(instanceId: string, url: string): void {
    if (!isHttpUrl(url)) return;
    const contents = this.contentsFor(instanceId);
    if (contents) {
      void contents.loadURL(url);
      return;
    }
    this.pendingNavigations.set(instanceId, url);
    this.wake(instanceId);
  }

  currentUrl(idOrViewId: string): string | null {
    return this.contentsFor(idOrViewId)?.getURL() ?? null;
  }

  openExternal(idOrViewId: string): void {
    const url = this.currentUrl(idOrViewId);
    if (url) void openExternalSafe(url);
  }

  setZoom(idOrViewId: string, zoomFactor: number): void {
    this.contentsFor(idOrViewId)?.setZoomFactor(zoomFactor);
  }

  find(idOrViewId: string, text: string, forward = true): void {
    if (!text.trim()) return;
    this.contentsFor(idOrViewId)?.findInPage(text, { forward });
  }

  stopFind(idOrViewId: string): void {
    this.contentsFor(idOrViewId)?.stopFindInPage('clearSelection');
  }

  /** Sleep destroys every tab view of the instance; the session lives on in the partition. */
  sleep(instanceId: string): void {
    for (const viewId of [...this.views.keys()]) {
      if (instanceIdOf(viewId) === instanceId) {
        this.destroyView(viewId);
      }
    }
    this.emitState(instanceId, 'sleeping');
  }

  wake(instanceId: string): void {
    // The renderer recreates the active tab on the next bounds sync; just flip the slot state.
    this.emitState(instanceId, 'loading');
  }

  hideAll(): void {
    for (const managed of this.views.values()) {
      this.detach(managed);
    }
  }

  isAudible(instanceId: string): boolean {
    return this.viewsForInstance(instanceId).some((managed) =>
      managed.view.webContents.isCurrentlyAudible()
    );
  }

  isFocused(instanceId: string): boolean {
    return this.activeInstanceId === instanceId;
  }

  getLastActiveAt(instanceId: string): number {
    return this.viewsForInstance(instanceId).reduce(
      (max, managed) => Math.max(max, managed.lastActiveAt),
      0
    );
  }

  markActive(viewId: string): void {
    const managed = this.views.get(viewId);
    if (managed) {
      managed.lastActiveAt = Date.now();
    }
    this.onActivity();
  }

  destroyAll(): void {
    for (const viewId of [...this.views.keys()]) {
      this.destroyView(viewId);
    }
  }

  private contentsFor(idOrViewId: string): Electron.WebContents | undefined {
    const viewId = this.toViewId(idOrViewId);
    return viewId ? this.views.get(viewId)?.view.webContents : undefined;
  }

  private viewsForInstance(instanceId: string): ManagedView[] {
    return [...this.views.values()].filter((managed) => managed.instanceId === instanceId);
  }

  // Resolve a bare instanceId to its active tab's viewId, materializing a default tab if needed.
  private toViewId(idOrViewId: string): string | null {
    if (idOrViewId.includes('#')) {
      return idOrViewId;
    }
    const instance = getServiceInstance(this.db, idOrViewId);
    if (!instance) return null;
    const resolved = this.recipeLoader.resolveForInstance(instance);
    if (resolved.isLauncherOnly || !resolved.startUrl) return null;
    const tab = ensureDefaultTab(this.db, instance.id, instance.last_url ?? resolved.startUrl);
    return `${instance.id}#${tab.id}`;
  }

  private ensureView(viewId: string, instance: ServiceInstance): ManagedView {
    const existing = this.views.get(viewId);
    if (existing) {
      return existing;
    }
    const resolved = this.recipeLoader.resolveForInstance(instance);
    if (!resolved.startUrl) {
      throw new Error(`Cannot create launcher-only service view for ${instance.id}`);
    }
    const tabId = tabIdOf(viewId);
    const tab = tabId ? getTab(this.db, tabId) : null;
    const pendingUrl = this.pendingNavigations.get(instance.id);
    this.pendingNavigations.delete(instance.id);
    const requestedStartUrl = pendingUrl ?? tab?.url ?? instance.last_url ?? resolved.startUrl;
    const startUrl = isHttpUrl(requestedStartUrl)
      ? requestedStartUrl
      : isHttpUrl(resolved.startUrl)
        ? resolved.startUrl
        : null;
    const partition = session.fromPartition(instance.partition_key);
    this.configureSession(partition, instance);
    this.trackerBlocker?.apply(partition);
    void this.extensionManager?.applyTo(partition);
    const view = new WebContentsView({
      webPreferences: {
        partition: instance.partition_key,
        preload: this.servicePreloadPath,
        additionalArguments: [`--appdeck-instance=${instance.id}`],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: instance.spellcheck
      }
    });
    const managed: ManagedView = {
      viewId,
      instanceId: instance.id,
      tabId,
      view,
      attached: false,
      lastActiveAt: Date.now()
    };
    this.views.set(viewId, managed);
    this.configureWebContents(instance, managed);
    const userAgent =
      resolved.defaultUserAgent ?? (resolved.mobileMode ? MOBILE_USER_AGENT : undefined);
    if (userAgent) {
      view.webContents.setUserAgent(userAgent);
    }
    if (instance.zoom_factor) {
      view.webContents.setZoomFactor(instance.zoom_factor);
    }
    if (startUrl) {
      void view.webContents.loadURL(startUrl, userAgent ? { userAgent } : undefined);
    } else {
      this.emitState(instance.id, 'crashed');
    }
    return managed;
  }

  private configureSession(partition: Session, instance: ServiceInstance): void {
    void partition.setProxy(proxyConfig(instance.proxy)).catch(() => undefined);
    partition.setPermissionRequestHandler((_webContents, permission, callback) => {
      const firewall = testFirewallRules(this.db, permission, instance.id, {
        ruleType: 'permission',
        permission
      });
      if (firewall.matched) {
        callback(firewall.action === 'allow');
        return;
      }
      callback(resolvePermissionDecision(permissionDecision(this.db, instance.id, permission)));
    });
    partition.setPermissionCheckHandler((_webContents, permission) => {
      const firewall = testFirewallRules(this.db, permission, instance.id, {
        ruleType: 'permission',
        permission
      });
      if (firewall.matched) {
        return firewall.action === 'allow';
      }
      return resolvePermissionDecision(permissionDecision(this.db, instance.id, permission));
    });
    if (this.configuredSessions.has(partition)) {
      return;
    }
    this.configuredSessions.add(partition);
    partition.webRequest.onBeforeRequest((details, callback) => {
      const script = testFirewallRules(this.db, details.url, instance.id, {
        ruleType: 'script',
        resourceType: details.resourceType
      });
      if (script.matched && script.action !== 'allow') {
        callback({ cancel: true });
        return;
      }
      const domain = testFirewallRules(this.db, details.url, instance.id, {
        ruleType: 'domain',
        resourceType: details.resourceType
      });
      callback({ cancel: domain.matched && domain.action !== 'allow' });
    });
    partition.webRequest.onBeforeSendHeaders((details, callback) => {
      const cookie = testFirewallRules(this.db, details.url, instance.id, { ruleType: 'cookie' });
      if (cookie.matched && cookie.action !== 'allow') {
        callback({ requestHeaders: withoutHeaders(details.requestHeaders, ['cookie']) });
        return;
      }
      callback({ requestHeaders: details.requestHeaders });
    });
    partition.webRequest.onHeadersReceived((details, callback) => {
      const cookie = testFirewallRules(this.db, details.url, instance.id, { ruleType: 'cookie' });
      if (cookie.matched && cookie.action !== 'allow') {
        callback({
          responseHeaders: withoutHeaders(details.responseHeaders ?? {}, ['set-cookie'])
        });
        return;
      }
      callback({ responseHeaders: details.responseHeaders });
    });
    partition.on('will-download', (_event, item) => {
      const download = testFirewallRules(this.db, item.getURL(), instance.id, {
        ruleType: 'download'
      });
      if (download.matched && download.action !== 'allow') {
        item.cancel();
        return;
      }
      const id = crypto.randomUUID();
      const startedAt = Date.now();
      const savePath = item.getSavePath();
      upsertDownload(this.db, {
        id,
        service_instance_id: instance.id,
        url: item.getURL(),
        filename: item.getFilename(),
        mime_type: item.getMimeType() || null,
        total_bytes: item.getTotalBytes() || null,
        received_bytes: item.getReceivedBytes(),
        state: 'progressing',
        path: savePath || null,
        started_at: startedAt
      });
      item.on('updated', (_event, state) => {
        upsertDownload(this.db, {
          id,
          service_instance_id: instance.id,
          url: item.getURL(),
          filename: item.getFilename(),
          mime_type: item.getMimeType() || null,
          total_bytes: item.getTotalBytes() || null,
          received_bytes: item.getReceivedBytes(),
          state: state === 'interrupted' ? 'interrupted' : 'progressing',
          path: item.getSavePath() || null,
          started_at: startedAt
        });
      });
      item.once('done', (_event, state) => {
        upsertDownload(this.db, {
          id,
          service_instance_id: instance.id,
          url: item.getURL(),
          filename: item.getFilename(),
          mime_type: item.getMimeType() || null,
          total_bytes: item.getTotalBytes() || null,
          received_bytes: item.getReceivedBytes(),
          state:
            state === 'completed'
              ? 'completed'
              : state === 'cancelled'
                ? 'cancelled'
                : 'interrupted',
          path: item.getSavePath() || null,
          started_at: startedAt,
          completed_at: Date.now()
        });
      });
    });
  }

  private configureWebContents(instance: ServiceInstance, managed: ManagedView): void {
    const contents = managed.view.webContents;
    const persist = (url: string): void => {
      setServiceLastUrl(this.db, instance.id, url);
      if (managed.tabId) {
        setTabUrlTitle(this.db, managed.tabId, url, contents.getTitle() || null);
      }
    };
    contents.on('did-start-loading', () => this.emitState(instance.id, 'loading'));
    contents.on('dom-ready', () => {
      void contents.executeJavaScript(NOTIFICATION_SHIM, true).catch(() => undefined);
    });
    contents.on('did-finish-load', () => {
      this.emitState(instance.id, 'ready');
      this.injectCustomCode(managed);
    });
    contents.on('page-title-updated', () => {
      if (managed.tabId)
        setTabUrlTitle(this.db, managed.tabId, contents.getURL(), contents.getTitle() || null);
    });
    contents.on('focus', () => this.focus(managed.viewId));
    contents.on('before-input-event', () => this.markActive(managed.viewId));
    contents.on('did-navigate', (_event, url) => persist(url));
    contents.on('did-navigate-in-page', (_event, url) => persist(url));
    contents.on('render-process-gone', () => {
      this.destroyView(managed.viewId);
      this.emitState(instance.id, 'crashed');
    });
    contents.on('will-navigate', (event, url) => {
      if (!this.isAllowedUrl(instance.id, url)) {
        event.preventDefault();
        void openExternalSafe(url);
      }
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (this.isAllowedUrl(instance.id, url)) {
        return { action: 'allow' };
      }
      void openExternalSafe(url);
      return { action: 'deny' };
    });
  }

  private injectCustomCode(managed: ManagedView): void {
    const instance = getServiceInstance(this.db, managed.instanceId);
    if (!instance) {
      return;
    }
    const extensionRuntime = extensionRuntimeForDb(this.db);
    if (extensionRuntime.css) {
      void managed.view.webContents.insertCSS(extensionRuntime.css);
    }
    if (extensionRuntime.js) {
      void managed.view.webContents.executeJavaScript(extensionRuntime.js, true);
    }
    if (instance.custom_css) {
      void managed.view.webContents.insertCSS(instance.custom_css);
    }
    if (instance.custom_js) {
      void managed.view.webContents.executeJavaScript(instance.custom_js, true);
    }
  }

  private isAllowedUrl(instanceId: string, value: string): boolean {
    const resolved = this.recipeLoader.resolveForInstance(instanceId);
    if (!resolved.allowedDomains.length) {
      return false;
    }
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      return resolved.allowedDomains.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  private attach(managed: ManagedView): void {
    if (!this.window || this.window.isDestroyed() || managed.attached) {
      return;
    }
    this.window.contentView.addChildView(managed.view);
    managed.attached = true;
  }

  private detach(managed: ManagedView): void {
    managed.attached = false;
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    this.window.contentView.removeChildView(managed.view);
  }

  private detachHiddenViews(): void {
    for (const managed of this.views.values()) {
      if (!this.visibleIds.has(managed.viewId)) {
        this.detach(managed);
      }
    }
  }

  private destroyView(viewId: string): void {
    const managed = this.views.get(viewId);
    if (!managed) {
      return;
    }
    this.detach(managed);
    managed.view.webContents.close();
    this.views.delete(viewId);
  }

  private emitState(instanceId: string, state: ServiceState): void {
    this.sendPush('event:service-state', { instanceId, state });
  }
}

async function openExternalSafe(value: string): Promise<void> {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return;
    }
    await shell.openExternal(parsed.toString());
  } catch {
    // Ignore malformed or blocked URLs.
  }
}

function withoutHeaders<T extends Record<string, string | string[]>>(
  headers: T,
  names: string[]
): T {
  const remove = new Set(names.map((name) => name.toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !remove.has(name.toLowerCase()))
  ) as T;
}

function proxyConfig(proxy: ServiceProxy | null): Electron.ProxyConfig {
  if (!proxy || proxy.mode === 'direct' || !proxy.host || !proxy.port) {
    return { proxyRules: '' };
  }
  const scheme =
    proxy.mode === 'socks4' || proxy.mode === 'socks5'
      ? proxy.mode
      : proxy.mode === 'socks'
        ? 'socks5'
        : 'http';
  const auth = proxy.username ? `${encodeURIComponent(proxy.username)}@` : '';
  return {
    proxyRules: `${scheme}://${auth}${proxy.host}:${proxy.port}`,
    proxyBypassRules: proxy.bypassRules
  };
}
