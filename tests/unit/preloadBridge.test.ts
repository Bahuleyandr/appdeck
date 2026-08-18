import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  invokeChannels,
  pushChannels,
  quickViewInvokeChannels,
  quickViewPushChannel,
  rendererInvokeChannels,
  serviceOnlyInvokeChannels
} from '../../src/shared/ipc-channels.js';
import { ipcSchemas } from '../../src/shared/ipc-contract.js';

describe('preload bridge', () => {
  it('allows every renderer client invoke channel', () => {
    const rendererClientSource = readFileSync(
      new URL('../../src/renderer/ipc/client.ts', import.meta.url),
      'utf8'
    );
    const rendererChannels = [
      ...rendererClientSource.matchAll(/invoke(?:<[^>]+>)?\('([^']+)'/g)
    ].map((match) => match[1]);

    expect(rendererChannels.length).toBeGreaterThan(0);
    for (const channel of rendererChannels) {
      expect(rendererInvokeChannels).toContain(channel);
    }
  });

  it('derives the bridge allowlists from the shared channel list', () => {
    const bridgeSource = readFileSync(
      new URL('../../src/preload/bridge.ts', import.meta.url),
      'utf8'
    );
    expect(bridgeSource).toContain('rendererInvokeChannels');
    expect(bridgeSource).toContain('pushChannels');
    expect(bridgeSource).toContain("from '../shared/ipc-channels.js'");
  });

  it('keeps service-preload-only channels out of the renderer bridge', () => {
    for (const channel of serviceOnlyInvokeChannels) {
      expect(invokeChannels).toContain(channel);
      expect(rendererInvokeChannels).not.toContain(channel);
    }
  });

  it('keeps quick-view channels out of the renderer bridge but in the contract', () => {
    for (const channel of quickViewInvokeChannels) {
      expect(invokeChannels).toContain(channel);
      expect(rendererInvokeChannels).not.toContain(channel);
    }
  });

  it('pins the quick-view preload to its channels without importing shared chunks', () => {
    // The quick-view preload uses literals: a shared import would make Rollup emit a common
    // chunk that a sandboxed preload cannot require() at runtime. This test keeps the literals
    // from drifting against the shared channel list.
    const quickViewPreloadSource = readFileSync(
      new URL('../../src/preload/quickview.ts', import.meta.url),
      'utf8'
    );
    expect(quickViewPreloadSource).not.toMatch(/from '\.\.\/shared\//);
    expect(quickViewPreloadSource).toContain(`'${quickViewPushChannel}'`);
    for (const channel of quickViewInvokeChannels) {
      expect(quickViewPreloadSource).toContain(`'${channel}'`);
    }
  });

  it('keeps the zod contract in lockstep with the channel list', () => {
    expect(Object.keys(ipcSchemas).sort()).toEqual([...invokeChannels].sort());
  });

  it('allowlists every contract push channel, including automation events', () => {
    expect(pushChannels).toEqual(
      expect.arrayContaining(['event:workspace-open-requested', 'event:focus-mode-requested'])
    );
  });
});
