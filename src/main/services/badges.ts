import { BrowserWindow, app, nativeImage, type NativeImage } from 'electron';
import type { UnreadCount } from '../../shared/types.js';

export class BadgeService {
  private readonly counts = new Map<string, UnreadCount>();
  private overlay: NativeImage | null = null;

  constructor(private readonly windowProvider: () => BrowserWindow | null) {}

  setCount(instanceId: string, count: UnreadCount): number {
    this.counts.set(instanceId, count);
    return this.apply();
  }

  clear(instanceId: string): number {
    this.counts.delete(instanceId);
    return this.apply();
  }

  reconcile(liveInstanceIds: string[]): number {
    const live = new Set(liveInstanceIds);
    for (const instanceId of this.counts.keys()) {
      if (!live.has(instanceId)) {
        this.counts.delete(instanceId);
      }
    }
    return this.apply();
  }

  totalDirect(): number {
    return [...this.counts.values()].reduce((sum, count) => sum + count.direct, 0);
  }

  private apply(): number {
    const total = this.totalDirect();
    app.setBadgeCount(total);
    const window = this.windowProvider();
    if (window && process.platform === 'win32') {
      window.setOverlayIcon(
        total > 0 ? this.overlayIcon() : null,
        total > 0 ? `${total} unread` : ''
      );
    }
    return total;
  }

  // app.setBadgeCount is a no-op on Windows; a taskbar overlay icon is the visible indicator.
  // Built as a raw bitmap (no canvas in the main process) — a filled red dot.
  private overlayIcon(): NativeImage {
    if (this.overlay) {
      return this.overlay;
    }
    const size = 16;
    const radius = 7;
    const center = (size - 1) / 2;
    const buffer = Buffer.alloc(size * size * 4); // Windows expects BGRA.
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const offset = (y * size + x) * 4;
        const inside = (x - center) ** 2 + (y - center) ** 2 <= radius ** 2;
        buffer[offset] = 0; // B
        buffer[offset + 1] = 0; // G
        buffer[offset + 2] = inside ? 235 : 0; // R
        buffer[offset + 3] = inside ? 255 : 0; // A
      }
    }
    this.overlay = nativeImage.createFromBitmap(buffer, { width: size, height: size });
    return this.overlay;
  }
}
