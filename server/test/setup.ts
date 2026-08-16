import { applyD1Migrations, env } from 'cloudflare:test';

// Apply the real migration files (server/migrations/*.sql) to the test D1 database so tests
// exercise the exact schema a deployment gets. `applyD1Migrations` tracks applied migrations,
// so re-runs are no-ops.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
