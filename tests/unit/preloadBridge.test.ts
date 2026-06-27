import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('preload bridge', () => {
  it('allows every renderer client invoke channel', () => {
    const bridgeSource = readFileSync(
      new URL('../../src/preload/bridge.ts', import.meta.url),
      'utf8'
    );
    const rendererClientSource = readFileSync(
      new URL('../../src/renderer/ipc/client.ts', import.meta.url),
      'utf8'
    );
    const rendererChannels = [
      ...rendererClientSource.matchAll(/invoke(?:<[^>]+>)?\('([^']+)'/g)
    ].map((match) => match[1]);

    for (const channel of rendererChannels) {
      expect(bridgeSource).toContain(`'${channel}'`);
    }
  });
});
