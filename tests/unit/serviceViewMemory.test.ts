import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(),
  shell: {},
  session: {}
}));

import {
  HIDDEN_VIEW_MEMORY_TRIM_MS,
  shouldTrimHiddenView
} from '../../src/main/views/serviceViewManager.js';

describe('service view memory trimming', () => {
  it('trims only detached, idle, silent, inactive views', () => {
    const now = 1_000_000;
    const hiddenAt = now - HIDDEN_VIEW_MEMORY_TRIM_MS - 1;

    expect(
      shouldTrimHiddenView({ attached: false, hiddenAt, active: false, audible: false }, now)
    ).toBe(true);
    expect(
      shouldTrimHiddenView({ attached: true, hiddenAt, active: false, audible: false }, now)
    ).toBe(false);
    expect(
      shouldTrimHiddenView({ attached: false, hiddenAt: null, active: false, audible: false }, now)
    ).toBe(false);
    expect(
      shouldTrimHiddenView({ attached: false, hiddenAt, active: true, audible: false }, now)
    ).toBe(false);
    expect(
      shouldTrimHiddenView({ attached: false, hiddenAt, active: false, audible: true }, now)
    ).toBe(false);
    expect(
      shouldTrimHiddenView({
        attached: false,
        hiddenAt: now - HIDDEN_VIEW_MEMORY_TRIM_MS + 1,
        active: false,
        audible: false
      }, now)
    ).toBe(false);
  });
});
