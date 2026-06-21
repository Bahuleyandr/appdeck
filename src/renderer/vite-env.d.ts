/// <reference types="vite/client" />

import type { IpcChannel, PushChannel } from '../shared/ipc-contract';

declare global {
  interface Window {
    appdeck: {
      invoke(channel: IpcChannel, payload?: unknown): Promise<unknown>;
      on(channel: PushChannel, callback: (payload: unknown) => void): () => void;
    };
  }
}
