/**
 * Pure positioning math for the tray quick-view popover, extracted so the cross-platform
 * placement rules are unit-testable without a display.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface QuickViewPositionInput {
  platform: NodeJS.Platform;
  /** From tray.getBounds(); empty/zero-sized on many Linux trays. */
  trayBounds: Rect | null;
  /** From screen.getCursorScreenPoint(); fallback anchor when tray bounds are unusable. */
  cursor: Point;
  /** Work area of the display the anchor is on (excludes taskbar/menu bar/dock). */
  workArea: Rect;
  windowSize: { width: number; height: number };
}

const TRAY_GAP = 6;

export function isUsableTrayBounds(bounds: Rect | null): bounds is Rect {
  return bounds !== null && bounds.width > 0 && bounds.height > 0;
}

/**
 * Place the popover next to its anchor, clamped to the work area:
 * - macOS: below the menu-bar icon, horizontally centered on it.
 * - Windows: centered on the tray icon, above/below/left/right of the taskbar depending on which
 *   edge the taskbar sits on (inferred from where the icon lies relative to the work area).
 * - Linux and anything without usable tray bounds: near the cursor, or the bottom-right work-area
 *   corner when the cursor is off the given display.
 */
export function computeQuickViewPosition(input: QuickViewPositionInput): Point {
  const { platform, trayBounds, cursor, workArea, windowSize } = input;

  if (!isUsableTrayBounds(trayBounds)) {
    return clampToWorkArea(fallbackAnchor(cursor, workArea, windowSize), workArea, windowSize);
  }

  const trayCenterX = trayBounds.x + trayBounds.width / 2;
  let x = Math.round(trayCenterX - windowSize.width / 2);
  let y: number;

  if (platform === 'darwin') {
    // Menu-bar icon: always open downward.
    y = trayBounds.y + trayBounds.height + TRAY_GAP;
  } else if (trayBounds.y >= workArea.y + workArea.height) {
    // Taskbar below the work area (the Windows default): open upward.
    y = workArea.y + workArea.height - windowSize.height;
  } else if (trayBounds.y + trayBounds.height <= workArea.y) {
    // Taskbar above the work area: open downward.
    y = workArea.y;
  } else if (trayBounds.x + trayBounds.width <= workArea.x) {
    // Taskbar on the left edge: open rightward, vertically near the icon.
    x = workArea.x;
    y = Math.round(trayBounds.y + trayBounds.height / 2 - windowSize.height / 2);
  } else if (trayBounds.x >= workArea.x + workArea.width) {
    // Taskbar on the right edge: open leftward.
    x = workArea.x + workArea.width - windowSize.width;
    y = Math.round(trayBounds.y + trayBounds.height / 2 - windowSize.height / 2);
  } else {
    // Icon inside the work area (odd tray implementations): open below the icon.
    y = trayBounds.y + trayBounds.height + TRAY_GAP;
  }

  return clampToWorkArea({ x, y }, workArea, windowSize);
}

function fallbackAnchor(
  cursor: Point,
  workArea: Rect,
  windowSize: { width: number; height: number }
): Point {
  const cursorOnDisplay =
    cursor.x >= workArea.x &&
    cursor.x <= workArea.x + workArea.width &&
    cursor.y >= workArea.y &&
    cursor.y <= workArea.y + workArea.height;
  if (cursorOnDisplay) {
    // Open up-left of the cursor so the popover stays clear of a bottom-right tray area.
    return { x: cursor.x - windowSize.width / 2, y: cursor.y - windowSize.height - TRAY_GAP };
  }
  return {
    x: workArea.x + workArea.width - windowSize.width - TRAY_GAP,
    y: workArea.y + workArea.height - windowSize.height - TRAY_GAP
  };
}

function clampToWorkArea(
  point: Point,
  workArea: Rect,
  windowSize: { width: number; height: number }
): Point {
  const maxX = workArea.x + workArea.width - windowSize.width;
  const maxY = workArea.y + workArea.height - windowSize.height;
  return {
    x: Math.round(Math.min(Math.max(point.x, workArea.x), Math.max(workArea.x, maxX))),
    y: Math.round(Math.min(Math.max(point.y, workArea.y), Math.max(workArea.y, maxY)))
  };
}
