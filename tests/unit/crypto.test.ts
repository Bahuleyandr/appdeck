import { describe, expect, it } from 'vitest';
import {
  deriveAuthHash,
  generateRootKey,
  newAuthSalt,
  recoveryPhraseToRootKey,
  rootKeyToRecoveryPhrase,
  sodiumReady,
  unwrapRootKey,
  wrapRootKey
} from '../../src/main/sync/crypto.js';

describe('sync crypto', () => {
  it(
    'round-trips root key through recovery phrase and passphrase wrap',
    async () => {
      const rootKey = await generateRootKey();
      const phrase = rootKeyToRecoveryPhrase(rootKey);
      expect(Buffer.from(recoveryPhraseToRootKey(phrase)).equals(Buffer.from(rootKey))).toBe(true);

      const wrapped = await wrapRootKey(rootKey, 'correct horse battery staple');
      const unwrapped = await unwrapRootKey(wrapped, 'correct horse battery staple');
      expect(Buffer.from(unwrapped).equals(Buffer.from(rootKey))).toBe(true);
      await expect(unwrapRootKey(wrapped, 'wrong passphrase')).rejects.toThrow();
    },
    20_000
  );

  it(
    'persists key-derivation params in new passphrase wraps',
    async () => {
      const sodium = await sodiumReady();
      const wrapped = await wrapRootKey(await generateRootKey(), 'correct horse battery staple');

      expect(wrapped.opslimit).toBe(sodium.crypto_pwhash_OPSLIMIT_MODERATE);
      expect(wrapped.memlimit).toBe(sodium.crypto_pwhash_MEMLIMIT_MODERATE);
    },
    20_000
  );

  it(
    'unwraps legacy passphrase wraps without stored key-derivation params',
    async () => {
      const sodium = await sodiumReady();
      const rootKey = await generateRootKey();
      const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
      const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
      const legacyKek = sodium.crypto_pwhash(
        32,
        'correct horse battery staple',
        salt,
        sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
      );
      const legacyWrapped = {
        salt: Buffer.from(salt).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64'),
        ciphertext: Buffer.from(sodium.crypto_secretbox_easy(rootKey, nonce, legacyKek)).toString(
          'base64'
        )
      };

      const unwrapped = await unwrapRootKey(legacyWrapped, 'correct horse battery staple');
      expect(Buffer.from(unwrapped).equals(Buffer.from(rootKey))).toBe(true);
    },
    20_000
  );

  it(
    'derives a deterministic auth hash, domain-separated from the key wrap',
    async () => {
      const salt = await newAuthSalt();
      const h1 = await deriveAuthHash('correct horse battery staple', salt);
      const h2 = await deriveAuthHash('correct horse battery staple', salt);
      expect(h1).toBe(h2); // same password + salt → same hash (server can compare)
      expect(await deriveAuthHash('correct horse battery staple', await newAuthSalt())).not.toBe(
        h1
      ); // salt separates
      expect(await deriveAuthHash('different password', salt)).not.toBe(h1);

      // The auth hash sent to the server is not the key-wrapping ciphertext.
      const wrapped = await wrapRootKey(await generateRootKey(), 'correct horse battery staple');
      expect(h1).not.toBe(wrapped.ciphertext);
    },
    20_000
  );
});
