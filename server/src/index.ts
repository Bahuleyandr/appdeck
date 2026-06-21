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
}

interface UserRow {
  id: string;
  email: string;
  auth_salt: string;
  auth_hash: string;
  wrapped_key: string;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/api/signup') return await signup(request, env);
      if (request.method === 'GET' && url.pathname === '/api/auth-params') return await authParams(url, env);
      if (request.method === 'POST' && url.pathname === '/api/login') return await login(request, env);
      if (request.method === 'GET' && url.pathname === '/api/vault') return await getVault(request, env);
      if (request.method === 'PUT' && url.pathname === '/api/vault') return await putVault(request, env);
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      return json({ error: 'server_error', message: error instanceof Error ? error.message : String(error) }, 500);
    }
  }
};

async function signup(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { email?: string; authSalt?: string; authHash?: string; wrappedKey?: string };
  const email = normalizeEmail(body.email);
  if (!email || !body.authSalt || !body.authHash || !body.wrappedKey) {
    return json({ error: 'invalid_request' }, 400);
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return json({ error: 'email_taken' }, 409);
  }
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO users (id, email, auth_salt, auth_hash, wrapped_key, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, body.authSalt, body.authHash, body.wrappedKey, Date.now())
    .run();
  return json({ token: await mintToken(id, env) });
}

async function authParams(url: URL, env: Env): Promise<Response> {
  const email = normalizeEmail(url.searchParams.get('email'));
  if (!email) return json({ error: 'invalid_request' }, 400);
  const user = (await env.DB.prepare('SELECT auth_salt, wrapped_key FROM users WHERE email = ?').bind(email).first()) as
    | Pick<UserRow, 'auth_salt' | 'wrapped_key'>
    | null;
  if (!user) return json({ error: 'not_found' }, 404);
  return json({ authSalt: user.auth_salt, wrappedKey: user.wrapped_key });
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { email?: string; authHash?: string };
  const email = normalizeEmail(body.email);
  if (!email || !body.authHash) return json({ error: 'invalid_request' }, 400);
  const user = (await env.DB.prepare('SELECT id, auth_hash FROM users WHERE email = ?').bind(email).first()) as
    | Pick<UserRow, 'id' | 'auth_hash'>
    | null;
  if (!user || !timingSafeEqual(user.auth_hash, body.authHash)) {
    return json({ error: 'invalid_credentials' }, 401);
  }
  return json({ token: await mintToken(user.id, env) });
}

async function getVault(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const row = (await env.DB.prepare('SELECT ciphertext, revision FROM vaults WHERE user_id = ?').bind(userId).first()) as
    | { ciphertext: string; revision: number }
    | null;
  return json(row ? { ciphertext: row.ciphertext, revision: row.revision } : { ciphertext: null, revision: 0 });
}

async function putVault(request: Request, env: Env): Promise<Response> {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const body = (await request.json()) as { ciphertext?: string; revision?: number };
  if (typeof body.ciphertext !== 'string' || typeof body.revision !== 'number') {
    return json({ error: 'invalid_request' }, 400);
  }
  const current = (await env.DB.prepare('SELECT revision FROM vaults WHERE user_id = ?').bind(userId).first()) as
    | { revision: number }
    | null;
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

// --- tokens (stateless HMAC) ---

async function mintToken(userId: string, env: Env): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmac(payload, env.TOKEN_SECRET)}`;
}

async function requireUser(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts as [string, string, string];
  if (!timingSafeEqual(sig, await hmac(`${userId}.${exp}`, env.TOKEN_SECRET))) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return userId;
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
