import { describe, expect, it, vi } from 'vitest';
import {
  restoreWindowForUserAttention,
  type AttentionWindow
} from '../../src/main/windows/attention.js';

function fakeWindow(state: {
  destroyed?: boolean;
  minimized?: boolean;
  visible?: boolean;
}): AttentionWindow & {
  restoreMock: ReturnType<typeof vi.fn>;
  showMock: ReturnType<typeof vi.fn>;
  focusMock: ReturnType<typeof vi.fn>;
} {
  const restoreMock = vi.fn();
  const showMock = vi.fn();
  const focusMock = vi.fn();
  const window: AttentionWindow = {
    isDestroyed: () => state.destroyed ?? false,
    isMinimized: () => state.minimized ?? false,
    isVisible: () => state.visible ?? true,
    restore: () => {
      restoreMock();
    },
    show: () => {
      showMock();
    },
    focus: () => {
      focusMock();
    }
  };
  return { ...window, restoreMock, showMock, focusMock };
}

describe('window attention restore', () => {
  it('restores minimized or hidden windows before focusing them', () => {
    const minimized = fakeWindow({ minimized: true, visible: true });
    restoreWindowForUserAttention(minimized);
    expect(minimized.restoreMock).toHaveBeenCalled();
    expect(minimized.showMock).not.toHaveBeenCalled();
    expect(minimized.focusMock).toHaveBeenCalled();

    const hidden = fakeWindow({ minimized: false, visible: false });
    restoreWindowForUserAttention(hidden);
    expect(hidden.restoreMock).not.toHaveBeenCalled();
    expect(hidden.showMock).toHaveBeenCalled();
    expect(hidden.focusMock).toHaveBeenCalled();

    const destroyed = fakeWindow({ destroyed: true, minimized: true, visible: false });
    restoreWindowForUserAttention(destroyed);
    expect(destroyed.restoreMock).not.toHaveBeenCalled();
    expect(destroyed.showMock).not.toHaveBeenCalled();
    expect(destroyed.focusMock).not.toHaveBeenCalled();
  });
});
