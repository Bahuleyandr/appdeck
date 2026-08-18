import { describe, expect, it } from 'vitest';
import {
  computeQuickViewPosition,
  isUsableTrayBounds,
  type QuickViewPositionInput
} from '../../src/main/windows/quickViewPosition.js';

const windowSize = { width: 360, height: 500 };

function input(overrides: Partial<QuickViewPositionInput>): QuickViewPositionInput {
  return {
    platform: 'win32',
    trayBounds: null,
    cursor: { x: 0, y: 0 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    windowSize,
    ...overrides
  };
}

describe('quick view positioning', () => {
  it('treats null and zero-sized tray bounds as unusable', () => {
    expect(isUsableTrayBounds(null)).toBe(false);
    expect(isUsableTrayBounds({ x: 10, y: 10, width: 0, height: 0 })).toBe(false);
    expect(isUsableTrayBounds({ x: 10, y: 10, width: 24, height: 24 })).toBe(true);
  });

  it('opens above a Windows bottom taskbar, centered on the icon and inside the work area', () => {
    // Taskbar occupies y 1040..1080; tray icon near the bottom-right corner.
    const position = computeQuickViewPosition(
      input({ trayBounds: { x: 1200, y: 1048, width: 24, height: 24 } })
    );
    expect(position.y).toBe(1040 - windowSize.height);
    // Centered on the icon: 1212 - 180 = 1032; fits, no clamping needed.
    expect(position.x).toBe(1032);
  });

  it('clamps horizontally when the tray icon sits at the screen edge', () => {
    const position = computeQuickViewPosition(
      input({ trayBounds: { x: 1900, y: 1048, width: 20, height: 20 } })
    );
    expect(position.x).toBe(1920 - windowSize.width);
    expect(position.x + windowSize.width).toBeLessThanOrEqual(1920);
  });

  it('opens below the macOS menu-bar icon', () => {
    const position = computeQuickViewPosition(
      input({
        platform: 'darwin',
        trayBounds: { x: 1500, y: 0, width: 24, height: 24 },
        workArea: { x: 0, y: 25, width: 1920, height: 1055 }
      })
    );
    expect(position.y).toBe(30); // icon bottom (24) + 6px gap
    expect(position.x).toBe(Math.round(1512 - windowSize.width / 2));
  });

  it('handles a top taskbar on Windows by opening downward', () => {
    const position = computeQuickViewPosition(
      input({
        trayBounds: { x: 1800, y: 8, width: 24, height: 24 },
        workArea: { x: 0, y: 40, width: 1920, height: 1040 }
      })
    );
    expect(position.y).toBe(40);
  });

  it('handles left and right vertical taskbars', () => {
    const left = computeQuickViewPosition(
      input({
        trayBounds: { x: 8, y: 900, width: 24, height: 24 },
        workArea: { x: 48, y: 0, width: 1872, height: 1080 }
      })
    );
    expect(left.x).toBe(48);

    const right = computeQuickViewPosition(
      input({
        trayBounds: { x: 1888, y: 900, width: 24, height: 24 },
        workArea: { x: 0, y: 0, width: 1872, height: 1080 }
      })
    );
    expect(right.x).toBe(1872 - windowSize.width);
  });

  it('falls back to the cursor when tray bounds are empty (Linux)', () => {
    const position = computeQuickViewPosition(
      input({
        platform: 'linux',
        trayBounds: { x: 0, y: 0, width: 0, height: 0 },
        cursor: { x: 1900, y: 1030 }
      })
    );
    // Anchored up-left of the cursor, clamped inside the work area.
    expect(position.x).toBeLessThanOrEqual(1920 - windowSize.width);
    expect(position.y).toBeLessThanOrEqual(1040 - windowSize.height);
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);
  });

  it('falls back to the bottom-right work-area corner when the cursor is off-display', () => {
    const position = computeQuickViewPosition(
      input({ platform: 'linux', cursor: { x: -5000, y: -5000 } })
    );
    expect(position.x).toBe(1920 - windowSize.width - 6);
    expect(position.y).toBe(1040 - windowSize.height - 6);
  });

  it('never places the window outside a work area smaller than the window', () => {
    const tiny = { x: 100, y: 100, width: 300, height: 400 };
    const position = computeQuickViewPosition(
      input({ workArea: tiny, trayBounds: { x: 200, y: 520, width: 24, height: 24 } })
    );
    // Degenerate case: pinned to the work-area origin rather than off-screen negative.
    expect(position.x).toBe(100);
    expect(position.y).toBe(100);
  });
});
