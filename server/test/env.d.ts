import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import type { Env } from '../src/index';

declare module 'cloudflare:test' {
  // Bindings the vitest config provisions for the test runtime.
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
