import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

// Runs the test suite inside workerd (the actual Workers runtime) with a real D1 (SQLite)
// binding via @cloudflare/vitest-pool-workers. Migrations are read here on the Node side and
// applied inside the runtime by test/setup.ts.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
      const migrations = await readD1Migrations(migrationsDir);
      return {
        miniflare: {
          compatibilityDate: '2026-01-01',
          d1Databases: { DB: 'appdeck-test' },
          bindings: {
            TOKEN_SECRET: 'test-token-secret',
            TEST_MIGRATIONS: migrations
          }
        }
      };
    })
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts']
  }
});
