# AppDeck Sync Backend

Optional end-to-end-encrypted sync server (Cloudflare Worker + D1). Lets AppDeck sync config across
devices via an **account login** instead of a shared folder. It is **zero-knowledge**: it stores only
an auth hash, a passphrase-wrapped key it can't open, and the vault ciphertext. It never sees your
password, encryption key, service list, URLs, or cookies.

## Deploy

```sh
cd server
npm install
npx wrangler login

# 1. Create the D1 database, paste the printed database_id into wrangler.toml
npm run db:create

# 2. Apply the schema
npm run db:migrate

# 3. Set the token-signing secret (any long random string)
npx wrangler secret put TOKEN_SECRET

# 4. Deploy
npm run deploy
```

Wrangler prints the Worker URL, e.g. `https://appdeck-sync.<you>.workers.dev`. Put that URL in
AppDeck → Settings → Account, then Sign up / Log in.

## API

All JSON. Auth via `Authorization: Bearer <token>`.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/signup` | `{email, authSalt, authHash, wrappedKey}` | 409 if email taken → `{token}` |
| GET | `/api/auth-params?email=` | — | `{authSalt, wrappedKey}` (404 if unknown) |
| POST | `/api/login` | `{email, authHash}` | `{token}` |
| GET | `/api/vault` | — | `{ciphertext, revision}` |
| PUT | `/api/vault` | `{ciphertext, revision}` | LWW; 409 if `revision <= stored` |

## Security model

- The account password never leaves the device. The client derives two **independent** values
  (different KDF salts): an `authHash` sent for login, and a key-wrapping key used only locally to
  wrap the random root key. The server can't recover the root key from either.
- The vault `ciphertext` is XChaCha20-Poly1305 over the same allowlisted config the file-vault uses
  (no cookies/tokens/passwords — see the app's vault allowlist).
- Tokens are stateless HMAC-SHA256 (`TOKEN_SECRET`), 30-day expiry.
- Rotating `TOKEN_SECRET` invalidates all sessions.
