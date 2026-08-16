/**
 * AppDeck E2EE sync backend (Cloudflare Worker + D1).
 *
 * Zero-knowledge by design: the server stores an opaque `auth_hash` (an Argon2id digest the
 * client computed), a passphrase-`wrapped_key` blob it cannot open, and the AES/XChaCha
 * `ciphertext` of the vault. It never receives the account password, the encryption key, or any
 * plaintext (service names, URLs, cookies). Compromising the server leaks ciphertext only.
 */

export interface Env {
  DB: D1Database;
  TOKEN_SECRET: string;
  /** Fixed-window length for auth rate limiting, in seconds. Default 600 (10 minutes). */
  RATE_LIMIT_WINDOW_SECONDS?: string;
  /** Max login / auth-params attempts per IP per window. Default 10. */
  RATE_LIMIT_AUTH_MAX?: string;
  /** Max signups per IP per window (stricter: accounts are cheap D1 rows). Default 5. */
  RATE_LIMIT_SIGNUP_MAX?: string;
}

interface UserRow {
  id: string;
  email: string;
  auth_salt: string;
  auth_hash: string;
  wrapped_key: string;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_VAULT_CIPHERTEXT_CHARS = 2_000_000;
const DUMMY_AUTH_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/api/signup')
        return await signup(request, env);
      if (request.method === 'GET' && url.pathname === '/api/auth-params')
        return await authParams(request, url, env);
      if (request.method === 'POST' && url.pathname === '/api/login')
        return await login(request, env);
      if (request.method === 'POST' && url.pathname === '/api/logout')
        return await logout(request, env);
      if (request.method === 'GET' && url.pathname === '/api/vault')
        return await getVault(request, env);
      if (request.method === 'PUT' && url.pathname === '/api/vault')
        return await putVault(request, env);
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      console.error('Unhandled sync server error', error);
      return json({ error: 'server_error' }, 500);
    }
  }
};

async function signup(request: Request, env: Env): Promise<Response> {
  const limited = await enforceRateLimit(request, env, 'signup', rateLimits(env).signupMax);
  if (limited) return limited;
  const body = (await request.json()) as {
    email?: string;
    authSalt?: string;
    authHash?: string;
    wrappedKey?: string;
  };
  const email = normalizeEmail(body.email);
  if (!email || !body.authSalt || !body.authHash || !body.wrappedKey) {
    return json({ error: 'invalid_request' }, 400);
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return json({ error: 'email_taken' }, 409);
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO users (id, email, auth_salt, auth_hash, wrapped_key, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, email, body.authSalt, body.authHash, body.wrappedKey, Date.now())
    .run();
  return json({ token: await mintToken(id, env) });
}

async function authParams(request: Request, url: URL, env: Env): Promise<Response> {
  const limited = await enforceRateLimit(request, env, 'auth-params', rateLimits(env).authMax);
  if (limited) return limited;
  const email = normalizeEmail(url.searchParams.get('email'));
  if (!email) return json({ error: 'invalid_request' }, 400);
  const user = (await env.DB.prepare('SELECT auth_salt FROM users WHERE email = ?')
    .bind(email)
    .first()) as Pick<UserRow, 'auth_salt'> | null;
  return json({ authSalt: user?.auth_salt ?? (await decoyAuthSalt(email, env)) });
}

async function login(request: Request, env: Env): Promise<Response> {
  const limited = await enforceRateLimit(request, env, 'login', rateLimits(env).authMax);
  if (limited) return limited;
  const body = (await request.json()) as { email?: string; authHash?: string };
  const email = normalizeEmail(body.email);
  if (!email || !body.authHash) return json({ error: 'invalid_request' }, 400);
  const user = (await env.DB.prepare('SELECT id, auth_hash, wrapped_key FROM users WHERE email = ?')
    .bind(email)
    .first()) as Pick<UserRow, 'id' | 'auth_hash' | 'wrapped_key'> | null;
  const hashMatches = timingSafeEqual(user?.auth_hash ?? DUMMY_AUTH_HASH, body.authHash);
  if (!user || !hashMatches) {
    return json({ error: 'invalid_credentials' }, 401);
  }
  return json({ token: await mintToken(user.id, env), wrappedKey: user.wrapped_key });
}

/**
 * Revokes the presented token's session. Requires a validly signed, unexpired token but is
 * idempotent for already-revoked sessions — the client fires this on sign-out and clears local
 * state regardless of the outcome.
 */
async function logout(request: Request, env: Env): Promise<Response> {
  const claims = await verifyToken(request, env);
  if (!claims) return json({ error: 'unauthorized' }, 401);
  await env.DB.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE jti = ? AND user_id = ? AND revoked_at IS NULL'
  )
    .bind(Date.now(), claims.jti, claims.userId)
    .run();
  return json({ ok: true });
}

async function getVault(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const row = (await env.DB.prepare('SELECT ciphertext, revision FROM vaults WHERE user_id = ?')
    .bind(userId)
    .first()) as { ciphertext: string; revision: number } | null;
  return json(
    row ? { ciphertext: row.ciphertext, revision: row.revision } : { ciphertext: null, revision: 0 }
  );
}

async function putVault(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const body = (await request.json()) as { ciphertext?: string; revision?: number };
  if (typeof body.ciphertext !== 'string' || typeof body.revision !== 'number') {
    return json({ error: 'invalid_request' }, 400);
  }
  if (body.ciphertext.length > MAX_VAULT_CIPHERTEXT_CHARS) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const current = (await env.DB.prepare('SELECT revision FROM vaults WHERE user_id = ?')
    .bind(userId)
    .first()) as { revision: number } | null;
  // Optimistic concurrency: reject stale writes so a device must pull+merge first.
  if (current && body.revision <= current.revision) {
    return json({ error: 'conflict', revision: current.revision }, 409);
  }
  await env.DB.prepare(
    'INSERT INTO vaults (user_id, ciphertext, revision, updated_at) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(user_id) DO UPDATE SET ciphertext = excluded.ciphertext, revision = excluded.revision, updated_at = excluded.updated_at'
  )
    .bind(userId, body.ciphertext, body.revision, Date.now())
    .run();
  return json({ revision: body.revision });
}

// --- rate limiting (D1-backed fixed window; no Durable Objects, free-tier friendly) ---
//
// Keyed on "<route>:<client-ip>". One UPSERT atomically opens/advances the window and bumps the
// counter; stale rows (older than two windows) are deleted on the same request, so the table
// stays bounded without cron triggers. For real deployments, Cloudflare's WAF rate-limiting
// rules are the recommended belt-and-suspenders outer layer (see server/README.md).

interface RateLimitConfig {
  windowMs: number;
  authMax: number;
  signupMax: number;
}

function rateLimits(env: Env): RateLimitConfig {
  return {
    windowMs: positiveInt(env.RATE_LIMIT_WINDOW_SECONDS, 600) * 1000,
    authMax: positiveInt(env.RATE_LIMIT_AUTH_MAX, 10),
    signupMax: positiveInt(env.RATE_LIMIT_SIGNUP_MAX, 5)
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Returns a 429 response when the caller is over budget for `route`, else null. */
async function enforceRateLimit(
  request: Request,
  env: Env,
  route: string,
  max: number
): Promise<Response | null> {
  const { windowMs } = rateLimits(env);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const now = Date.now();
  // Cheap cleanup on write: anything older than two windows can never be consulted again.
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?')
    .bind(now - 2 * windowMs)
    .run();
  const row = (await env.DB.prepare(
    'INSERT INTO rate_limits (rl_key, window_start, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(rl_key) DO UPDATE SET ' +
      'count = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END, ' +
      'window_start = CASE WHEN rate_limits.window_start <= ? THEN excluded.window_start ELSE rate_limits.window_start END ' +
      'RETURNING window_start, count'
  )
    .bind(`${route}:${ip}`, now, now - windowMs, now - windowMs)
    .first()) as { window_start: number; count: number };
  if (row.count > max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000));
    return json({ error: 'rate_limited', retryAfter: retryAfterSeconds }, 429, {
      'retry-after': String(retryAfterSeconds)
    });
  }
  return null;
}

// --- tokens (HMAC-signed, revocable via the sessions table) ---
//
// Format: `<userId>.<jti>.<exp>.<sig>` where sig = HMAC-SHA256(TOKEN_SECRET, "userId.jti.exp").
// The jti references a `sessions` row; a missing or revoked row invalidates the token even
// before `exp`. Legacy 3-part tokens (pre-jti) are rejected — clients re-login once.

interface TokenClaims {
  userId: string;
  jti: string;
}

async function mintToken(userId: string, env: Env): Promise<string> {
  const now = Date.now();
  const jti = crypto.randomUUID();
  const exp = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  // Opportunistic pruning: expired sessions can never authenticate again, drop them here so the
  // table stays bounded without cron triggers.
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  await env.DB.prepare(
    'INSERT INTO sessions (jti, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(jti, userId, now, exp * 1000)
    .run();
  const payload = `${userId}.${jti}.${exp}`;
  return `${payload}.${await hmac(payload, env.TOKEN_SECRET)}`;
}

/** Checks signature + expiry only (no revocation lookup). Used by logout for idempotency. */
async function verifyToken(request: Request, env: Env): Promise<TokenClaims | null> {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null; // includes legacy 3-part tokens: force a re-login
  const [userId, jti, exp, sig] = parts as [string, string, string, string];
  if (!timingSafeEqual(sig, await hmac(`${userId}.${jti}.${exp}`, env.TOKEN_SECRET))) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return { userId, jti };
}

async function requireUser(request: Request, env: Env): Promise<string | null> {
  const claims = await verifyToken(request, env);
  if (!claims) return null;
  const session = (await env.DB.prepare(
    'SELECT revoked_at FROM sessions WHERE jti = ? AND user_id = ?'
  )
    .bind(claims.jti, claims.userId)
    .first()) as { revoked_at: number | null } | null;
  if (!session || session.revoked_at !== null) return null;
  return claims.userId;
}

async function hmac(data: string, secret: string): Promise<string> {
  return base64url(await hmacBytes(data, secret));
}

async function hmacBytes(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function decoyAuthSalt(email: string, env: Env): Promise<string> {
  return base64((await hmacBytes(email, env.TOKEN_SECRET)).slice(0, 16));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64url(bytes: Uint8Array): string {
  return base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}
