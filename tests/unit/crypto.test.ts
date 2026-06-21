import { describe, expect, it } from 'vitest';
import { generateRootKey, recoveryPhraseToRootKey, rootKeyToRecoveryPhrase, unwrapRootKey, wrapRootKey } from '../../src/main/sync/crypto.js';

describe('sync crypto', () => {
  it('round-trips root key through recovery phrase and passphrase wrap', async () => {
    const rootKey = await generateRootKey();
    const phrase = rootKeyToRecoveryPhrase(rootKey);
    expect(Buffer.from(recoveryPhraseToRootKey(phrase)).equals(Buffer.from(rootKey))).toBe(true);

    const wrapped = await wrapRootKey(rootKey, 'correct horse battery staple');
    const unwrapped = await unwrapRootKey(wrapped, 'correct horse battery staple');
    expect(Buffer.from(unwrapped).equals(Buffer.from(rootKey))).toBe(true);
    await expect(unwrapRootKey(wrapped, 'wrong passphrase')).rejects.toThrow();
  });
});
