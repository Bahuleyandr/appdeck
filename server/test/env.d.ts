import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import type { Env as WorkerEnv } from '../src/index';

// vitest-pool-workers types the `env` export as the global `Cloudflare.Env`, so the test
// bindings have to be declared there. Augmenting `ProvidedEnv` (the older pattern) compiles
// but binds to nothing, leaving `env` as an empty object type.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
