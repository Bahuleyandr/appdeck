import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Renderer tests are .tsx. Set the automatic JSX runtime explicitly rather than relying on
  // which tsconfig esbuild happens to discover for files outside src/renderer.
  esbuild: { jsx: 'automatic' },
  test: {
    // Argon2id at MODERATE memory (256 MiB) is part of the product spec; several suites derive
    // keys concurrently, so the 5s default flakes under full-suite parallel load.
    testTimeout: 20_000,
    // Two projects instead of a per-file docblock: main-process/repository tests (.test.ts)
    // run in node, renderer component tests (.test.tsx) get jsdom + jest-dom matchers.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.tsx'],
          setupFiles: ['tests/unit/setup.renderer.ts']
        }
      }
    ]
  }
});
