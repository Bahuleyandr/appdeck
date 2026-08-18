import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { buildQuickViewState } from '../../windows/quickViewState.js';
import type { Handler, IpcContext } from '../types.js';

/**
 * Channels for the tray quick-view popover. Only its dedicated preload can invoke these (they are
 * excluded from the main renderer bridge allowlist). Everything served here is main-process data —
 * no handler touches a service view.
 */
export function quickViewHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
    'quickview:get-state': () => buildQuickViewState(ctx.db, ctx.badgeService.snapshot()),
    'quickview:open-service': (payload) => {
      const input = parseIpcPayload('quickview:open-service', payload);
      ctx.quickView?.openApp(input.instanceId);
    },
    'quickview:close': () => ctx.quickView?.hide()
  };
}
