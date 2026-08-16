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
| GET | `/api/auth-params?email=` | — | `{authSalt}` (decoy salt for unknown emails) |
| POST | `/api/login` | `{email, authHash}` | `{token, wrappedKey}` |
| POST | `/api/logout` | — (Bearer token) | Revokes the presented token → `{ok: true}`; idempotent |
| GET | `/api/vault` | — | `{ciphertext, revision}` |
| PUT | `/api/vault` | `{ciphertext, revision}` | LWW; 409 if `revision <= stored`; 413 above 2 MB |

Auth endpoints return **429** with a `Retry-After` header (and `{error: "rate_limited",
retryAfter}`) when an IP exceeds its budget — see below.

## Rate limiting

Signup, login, and auth-params are rate limited with a D1-backed fixed window keyed on
`CF-Connecting-IP` + route, so it works on a plain free-tier Worker + D1 (no Durable Objects).
Stale counter rows are pruned on each write; nothing else to operate.

Configure via `[vars]` in `wrangler.toml` (defaults shown):

| Var | Default | Meaning |
|---|---|---|
| `RATE_LIMIT_WINDOW_SECONDS` | `600` | Window length |
| `RATE_LIMIT_AUTH_MAX` | `10` | Login / auth-params attempts per IP per window (per route) |
| `RATE_LIMIT_SIGNUP_MAX` | `5` | Signups per IP per window |

**Belt and suspenders for real deployments:** put Cloudflare's own [WAF rate-limiting
rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) (free plan includes one rule)
in front of `/api/signup` and `/api/login` too. The edge rule absorbs floods before they consume
Worker invocations and D1 writes; the in-Worker limiter enforces the precise per-route budgets.

## Sessions & token revocation

- Tokens are HMAC-SHA256-signed (`TOKEN_SECRET`), 30-day expiry, and carry a `jti` that
  references a row in the `sessions` table. Format: `userId.jti.exp.sig`.
- Every authenticated request checks the session row: a missing or revoked row → 401, even
  before the token's expiry. `POST /api/logout` revokes the presented token; the desktop app
  calls it on sign-out (best effort — local sign-out works offline too).
- Expired session rows are pruned opportunistically whenever a new token is minted.
- To revoke **all** sessions for one account: `UPDATE sessions SET revoked_at =
  strftime('%s','now')*1000 WHERE user_id = ?` (there is no password-change endpoint yet; when
  one is added it must do this).
- Rotating `TOKEN_SECRET` still invalidates every token at once.
- Legacy pre-`jti` 3-part tokens are **rejected**; clients from before this scheme simply log in
  again (the app treats 401 as "session expired").

## Deploy hardening

- Apply migrations before deploying new code (`npm run db:migrate`); the current Worker requires
  the `sessions` and `rate_limits` tables from migration `0002`. **Existing deployments:** after
  this upgrade every device must log in again once (old stateless tokens are rejected).
- Set a strong random `TOKEN_SECRET` (32+ bytes); it signs tokens **and** derives the decoy
  auth-salts that prevent account enumeration.
- Add a Cloudflare WAF rate-limiting rule for `/api/*` as described above; consider Bot Fight
  Mode on the zone.
- D1 growth is bounded: one row per user, one vault row per user (≤2 MB ciphertext), sessions
  pruned on mint, rate-limit rows pruned on write.

## Tests

`npm test` runs the Vitest suite inside workerd (the real Workers runtime) with a real D1
binding via `@cloudflare/vitest-pool-workers`, applying the actual `migrations/*.sql`. Covered:
signup/login/auth-params (including decoy salts and constant-time failures), vault
roundtrip/conflict/size-cap, rate limiting, and token revocation.

## Security model

- The account password never leaves the device. The client derives two **independent** values
  (different KDF salts): an `authHash` sent for login, and a key-wrapping key used only locally to
  wrap the random root key. The server can't recover the root key from either.
- The vault `ciphertext` is XChaCha20-Poly1305 over the same allowlisted config the file-vault uses
  (no cookies/tokens/passwords — see the app's vault allowlist).
- Tokens are HMAC-SHA256 (`TOKEN_SECRET`), 30-day expiry, revocable server-side via the
  `sessions` table (see above).
- Unknown emails get a deterministic decoy `authSalt` (HMAC of the email), so `auth-params`
  can't be used for account enumeration.
