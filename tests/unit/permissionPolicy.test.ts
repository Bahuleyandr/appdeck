import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(),
  shell: {},
  session: {}
}));

import { resolvePermissionDecision } from '../../src/main/views/serviceViewManager.js';

describe('service view permissions', () => {
  it('denies permissions unless the user explicitly allows them', () => {
    expect(resolvePermissionDecision('allow')).toBe(true);
    expect(resolvePermissionDecision('deny')).toBe(false);
    expect(resolvePermissionDecision('ask')).toBe(false);
    expect(resolvePermissionDecision(null)).toBe(false);
  });
});
