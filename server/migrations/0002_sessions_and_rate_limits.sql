-- Revocable sessions + D1-backed auth rate limiting.

-- One row per issued token. Tokens carry the `jti`; auth checks the row, so deleting or
-- revoking it kills the token immediately (no more irrevocable 30-day bearer tokens).
CREATE TABLE IF NOT EXISTS sessions (
  jti        TEXT PRIMARY KEY,  -- token id embedded in the signed token
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,  -- ms epoch
  expires_at INTEGER NOT NULL,  -- ms epoch; expired rows are pruned on token mint
  revoked_at INTEGER            -- ms epoch; NULL while the session is live
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Fixed-window rate-limit counters for the auth endpoints, keyed on "<route>:<client-ip>".
-- Rows are cheap: one per (route, IP) per active window; stale rows are deleted on write.
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key       TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL, -- ms epoch when the current window opened
  count        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);
