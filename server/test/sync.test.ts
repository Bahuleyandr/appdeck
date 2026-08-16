import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../src/index';

const BASE = 'https://sync.test';

// Unique emails/IPs per test so rate-limit counters and accounts never collide across tests.
let counter = 0;
function freshEmail(): string {
  counter += 1;
  return `user-${counter}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}
function freshIp(): string {
  counter += 1;
  return `203.0.${Math.floor(counter / 256) % 256}.${counter % 256}`;
}

function dispatch(
  path: string,
  init: RequestInit = {},
  options: { env?: Env; ip?: string } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', options.ip ?? freshIp());
  return worker.fetch(new Request(`${BASE}${path}`, { ...init, headers }), options.env ?? env);
}

function post(path: string, body: unknown, options: { env?: Env; ip?: string; token?: string } = {}) {
  return dispatch(
    path,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
      },
      body: JSON.stringify(body)
    },
    options
  );
}

async function signupUser(
  email: string,
  options: { env?: Env; ip?: string; authHash?: string } = {}
): Promise<string> {
  const res = await post(
    '/api/signup',
    {
      email,
      authSalt: 'salt-abc',
      authHash: options.authHash ?? 'hash-correct-value',
      wrappedKey: '{"wrapped":"key-blob"}'
    },
    options
  );
  expect(res.status).toBe(200);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function hmacBase64url(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  let binary = '';
  for (const byte of sig) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('signup', () => {
  it('creates an account and returns a revocable 4-part token', async () => {
    const token = await signupUser(freshEmail());
    expect(token.split('.')).toHaveLength(4);
  });

  it('rejects a duplicate email with 409', async () => {
    const email = freshEmail();
    await signupUser(email);
    const res = await post('/api/signup', {
      email,
      authSalt: 's',
      authHash: 'h',
      wrappedKey: 'w'
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'email_taken' });
  });

  it('rejects malformed bodies with 400', async () => {
    const res = await post('/api/signup', { email: freshEmail() });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('returns a token and the wrapped key for correct credentials', async () => {
    const email = freshEmail();
    await signupUser(email);
    const res = await post('/api/login', { email, authHash: 'hash-correct-value' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; wrappedKey: string };
    expect(body.token.split('.')).toHaveLength(4);
    expect(body.wrappedKey).toBe('{"wrapped":"key-blob"}');
  });

  it('rejects a wrong auth hash with 401 and no wrapped key', async () => {
    const email = freshEmail();
    await signupUser(email);
    const res = await post('/api/login', { email, authHash: 'hash-wrong---value' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('rejects an unknown email with the same 401 shape as a bad password', async () => {
    const res = await post('/api/login', { email: freshEmail(), authHash: 'hash-correct-value' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_credentials' });
  });
});

describe('auth-params', () => {
  it('returns the stored salt for a known email', async () => {
    const email = freshEmail();
    await signupUser(email);
    const res = await dispatch(`/api/auth-params?email=${encodeURIComponent(email)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authSalt: 'salt-abc' });
  });

  it('serves a deterministic decoy salt for unknown emails (no enumeration)', async () => {
    const email = freshEmail();
    const first = await dispatch(`/api/auth-params?email=${encodeURIComponent(email)}`);
    const second = await dispatch(`/api/auth-params?email=${encodeURIComponent(email)}`);
    expect(first.status).toBe(200);
    const a = (await first.json()) as { authSalt: string };
    const b = (await second.json()) as { authSalt: string };
    expect(a.authSalt).toBeTypeOf('string');
    expect(a.authSalt.length).toBeGreaterThan(0);
    // Same shape and same value as a real account's response: an attacker learns nothing.
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(['authSalt']);
  });
});

describe('vault', () => {
  it('roundtrips put/get and reports revision 0 before any put', async () => {
    const token = await signupUser(freshEmail());
    const empty = await dispatch('/api/vault', {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(await empty.json()).toEqual({ ciphertext: null, revision: 0 });

    const put = await dispatch('/api/vault', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ciphertext: 'ZW5jcnlwdGVk', revision: 1 })
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ revision: 1 });

    const get = await dispatch('/api/vault', {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(await get.json()).toEqual({ ciphertext: 'ZW5jcnlwdGVk', revision: 1 });
  });

  it('rejects stale revisions with 409 and the current revision', async () => {
    const token = await signupUser(freshEmail());
    const putRevision = (revision: number) =>
      dispatch('/api/vault', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ciphertext: 'YQ==', revision })
      });
    expect((await putRevision(3)).status).toBe(200);
    const stale = await putRevision(3);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'conflict', revision: 3 });
    expect((await putRevision(2)).status).toBe(409);
    expect((await putRevision(4)).status).toBe(200);
  });

  it('caps ciphertext size at 2MB with 413', async () => {
    const token = await signupUser(freshEmail());
    const res = await dispatch('/api/vault', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ciphertext: 'a'.repeat(2_000_001), revision: 1 })
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
  });

  it('rejects missing or malformed bearer tokens with 401', async () => {
    expect((await dispatch('/api/vault')).status).toBe(401);
    expect(
      (await dispatch('/api/vault', { headers: { authorization: 'Bearer not.a.token' } })).status
    ).toBe(401);
  });
});

describe('token revocation', () => {
  it('rejects a revoked token on subsequent requests', async () => {
    const token = await signupUser(freshEmail());
    const before = await dispatch('/api/vault', { headers: { authorization: `Bearer ${token}` } });
    expect(before.status).toBe(200);

    const logout = await post('/api/logout', {}, { token });
    expect(logout.status).toBe(200);
    expect(await logout.json()).toEqual({ ok: true });

    const after = await dispatch('/api/vault', { headers: { authorization: `Bearer ${token}` } });
    expect(after.status).toBe(401);
  });

  it('logout is idempotent for an already-revoked token', async () => {
    const token = await signupUser(freshEmail());
    expect((await post('/api/logout', {}, { token })).status).toBe(200);
    expect((await post('/api/logout', {}, { token })).status).toBe(200);
  });

  it('only revokes the session that logged out, not the account\'s other sessions', async () => {
    const email = freshEmail();
    const tokenA = await signupUser(email);
    const loginRes = await post('/api/login', { email, authHash: 'hash-correct-value' });
    const { token: tokenB } = (await loginRes.json()) as { token: string };

    expect((await post('/api/logout', {}, { token: tokenA })).status).toBe(200);
    const a = await dispatch('/api/vault', { headers: { authorization: `Bearer ${tokenA}` } });
    const b = await dispatch('/api/vault', { headers: { authorization: `Bearer ${tokenB}` } });
    expect(a.status).toBe(401);
    expect(b.status).toBe(200);
  });

  it('rejects legacy 3-part tokens even when correctly signed', async () => {
    const email = freshEmail();
    await signupUser(email);
    // Forge a pre-upgrade token with the real secret: valid signature, no jti.
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = `some-user-id.${exp}`;
    const legacy = `${payload}.${await hmacBase64url(payload, env.TOKEN_SECRET)}`;
    const res = await dispatch('/api/vault', { headers: { authorization: `Bearer ${legacy}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a token with a tampered signature', async () => {
    const token = await signupUser(freshEmail());
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    const res = await dispatch('/api/vault', { headers: { authorization: `Bearer ${tampered}` } });
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  const strictEnv: Env = {
    ...env,
    RATE_LIMIT_AUTH_MAX: '3',
    RATE_LIMIT_SIGNUP_MAX: '2',
    RATE_LIMIT_WINDOW_SECONDS: '600'
  };

  it('returns 429 with Retry-After after too many login attempts from one IP', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i += 1) {
      const res = await post(
        '/api/login',
        { email: freshEmail(), authHash: 'nope' },
        { env: strictEnv, ip }
      );
      expect(res.status).toBe(401);
    }
    const limited = await post(
      '/api/login',
      { email: freshEmail(), authHash: 'nope' },
      { env: strictEnv, ip }
    );
    expect(limited.status).toBe(429);
    const retryAfter = Number(limited.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(600);
    expect(((await limited.json()) as { error: string }).error).toBe('rate_limited');
  });

  it('limits per IP: another IP is unaffected', async () => {
    const ip = freshIp();
    for (let i = 0; i < 4; i += 1) {
      await post('/api/login', { email: freshEmail(), authHash: 'nope' }, { env: strictEnv, ip });
    }
    const other = await post(
      '/api/login',
      { email: freshEmail(), authHash: 'nope' },
      { env: strictEnv, ip: freshIp() }
    );
    expect(other.status).toBe(401);
  });

  it('limits per route: hitting the login limit does not block vault sync', async () => {
    const ip = freshIp();
    const token = await signupUser(freshEmail(), { env: strictEnv, ip: freshIp() });
    for (let i = 0; i < 4; i += 1) {
      await post('/api/login', { email: freshEmail(), authHash: 'nope' }, { env: strictEnv, ip });
    }
    const vault = await dispatch(
      '/api/vault',
      { headers: { authorization: `Bearer ${token}` } },
      { env: strictEnv, ip }
    );
    expect(vault.status).toBe(200);
  });

  it('applies the stricter signup limit', async () => {
    const ip = freshIp();
    for (let i = 0; i < 2; i += 1) {
      const res = await post(
        '/api/signup',
        { email: freshEmail(), authSalt: 's', authHash: 'h', wrappedKey: 'w' },
        { env: strictEnv, ip }
      );
      expect(res.status).toBe(200);
    }
    const limited = await post(
      '/api/signup',
      { email: freshEmail(), authSalt: 's', authHash: 'h', wrappedKey: 'w' },
      { env: strictEnv, ip }
    );
    expect(limited.status).toBe(429);
  });

  it('rate limits auth-params lookups', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i += 1) {
      const res = await dispatch(
        `/api/auth-params?email=${encodeURIComponent(freshEmail())}`,
        {},
        { env: strictEnv, ip }
      );
      expect(res.status).toBe(200);
    }
    const limited = await dispatch(
      `/api/auth-params?email=${encodeURIComponent(freshEmail())}`,
      {},
      { env: strictEnv, ip }
    );
    expect(limited.status).toBe(429);
  });

  it('opens a fresh window once the previous one expires', async () => {
    const ip = freshIp();
    const shortEnv: Env = { ...env, RATE_LIMIT_AUTH_MAX: '1', RATE_LIMIT_WINDOW_SECONDS: '1' };
    const first = await post(
      '/api/login',
      { email: freshEmail(), authHash: 'nope' },
      { env: shortEnv, ip }
    );
    expect(first.status).toBe(401);
    const limited = await post(
      '/api/login',
      { email: freshEmail(), authHash: 'nope' },
      { env: shortEnv, ip }
    );
    expect(limited.status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const afterWindow = await post(
      '/api/login',
      { email: freshEmail(), authHash: 'nope' },
      { env: shortEnv, ip }
    );
    expect(afterWindow.status).toBe(401);
  });
});
