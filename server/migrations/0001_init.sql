-- AppDeck sync backend schema (Cloudflare D1).
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  auth_salt   TEXT NOT NULL,   -- client KDF salt for the auth hash
  auth_hash   TEXT NOT NULL,   -- Argon2id digest computed client-side; server only compares it
  wrapped_key TEXT NOT NULL,   -- passphrase-wrapped root key; server cannot open it
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id    TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,    -- base64 of the encrypted vault; opaque to the server
  revision   INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
