import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Renderer tests are .tsx. Set the automatic JSX runtime explicitly rather than relying on
  // which tsconfig esbuild happens to discover for files outside src/renderer.
  esbuild: { jsx: 'automatic' },
  test: {
    // Main-process/repository tests run in node; renderer tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // Argon2id at MODERATE memory (256 MiB) is part of the product spec; several suites derive
    // keys concurrently, so the 5s default flakes under full-suite parallel load.
    testTimeout: 20_000
  }
});
