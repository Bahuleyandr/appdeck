import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Argon2id at MODERATE memory (256 MiB) is part of the product spec; several suites derive
    // keys concurrently, so the 5s default flakes under full-suite parallel load.
    testTimeout: 20_000
  }
});
