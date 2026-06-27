import { describe, expect, it, vi } from 'vitest';
import { BadgeService } from '../../src/main/services/badges.js';

vi.mock('electron', () => ({
  app: {
    setBadgeCount: vi.fn()
  },
  nativeImage: {
    createFromBitmap: vi.fn()
  }
}));

describe('badge service', () => {
  it('reconciles badge counts against live service ids', () => {
    const badges = new BadgeService(() => null);
    badges.setCount('live-service', { direct: 2, indirect: 0 });
    badges.setCount('deleted-service', { direct: 3, indirect: 0 });

    expect(
      (badges as unknown as { reconcile: (ids: string[]) => number }).reconcile(['live-service'])
    ).toBe(2);
    expect(badges.totalDirect()).toBe(2);
  });
});
