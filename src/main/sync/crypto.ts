import sodium from 'libsodium-wrappers-sumo';
import * as bip39 from 'bip39';

export interface WrappedRootKey {
  salt: string;
  nonce: string;
  ciphertext: string;
}

export async function sodiumReady(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

export async function generateRootKey(): Promise<Uint8Array> {
  const s = await sodiumReady();
  return s.randombytes_buf(32);
}

export function rootKeyToRecoveryPhrase(rootKey: Uint8Array): string {
  return bip39.entropyToMnemonic(Buffer.from(rootKey).toString('hex'));
}

export function recoveryPhraseToRootKey(phrase: string): Uint8Array {
  const entropy = bip39.mnemonicToEntropy(phrase);
  return Uint8Array.from(Buffer.from(entropy, 'hex'));
}

export async function deriveKek(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const s = await sodiumReady();
  return s.crypto_pwhash(
    32,
    passphrase,
    salt,
    s.crypto_pwhash_OPSLIMIT_MODERATE,
    s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    s.crypto_pwhash_ALG_DEFAULT
  );
}

export async function wrapRootKey(rootKey: Uint8Array, passphrase: string): Promise<WrappedRootKey> {
  const s = await sodiumReady();
  const salt = s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const kek = await deriveKek(passphrase, salt);
  const ciphertext = s.crypto_secretbox_easy(rootKey, nonce, kek);
  return {
    salt: Buffer.from(salt).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64')
  };
}

export async function unwrapRootKey(wrapped: WrappedRootKey, passphrase: string): Promise<Uint8Array> {
  const s = await sodiumReady();
  const salt = Uint8Array.from(Buffer.from(wrapped.salt, 'base64'));
  const nonce = Uint8Array.from(Buffer.from(wrapped.nonce, 'base64'));
  const ciphertext = Uint8Array.from(Buffer.from(wrapped.ciphertext, 'base64'));
  const kek = await deriveKek(passphrase, salt);
  const rootKey = s.crypto_secretbox_open_easy(ciphertext, nonce, kek);
  if (!rootKey) {
    throw new Error('Invalid sync passphrase');
  }
  return rootKey;
}

export async function encryptWithRootKey(rootKey: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<{
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}> {
  const s = await sodiumReady();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, rootKey);
  return { nonce, ciphertext };
}

export async function decryptWithRootKey(
  rootKey: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<Uint8Array> {
  const s = await sodiumReady();
  const plaintext = s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, rootKey);
  if (!plaintext) {
    throw new Error('Unable to decrypt vault');
  }
  return plaintext;
}
