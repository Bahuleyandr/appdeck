import { test, expect, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Smoke test against the PACKAGED app rather than out/main/index.js. Only this exercises the
 * asar bundle, extraResources (the 3 MB adblock snapshot), and the native better-sqlite3 build
 * as they actually ship — a source run can pass while the installer is broken.
 *
 * Skipped unless `npm run dist` has produced dist/win-unpacked.
 */
const packagedExe = join(process.cwd(), 'dist', 'win-unpacked', 'AppDeck.exe');

test.skip(!existsSync(packagedExe), 'run `npm run dist` first');

test('the packaged application launches and reaches the shell', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'appdeck-packaged-'));
  const app = await electron.launch({
    executablePath: packagedExe,
    args: [`--user-data-dir=${userData}`]
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByText('Welcome to AppDeck')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Services', { exact: true })).toBeVisible();

    // The bundled blocklist ships via extraResources; if that path is wrong in the packaged
    // layout the engine silently never loads, which is invisible from a source run.
    const blocklistLoaded = await page.evaluate(async () => {
      // Inside evaluate this runs in the renderer, where the preload bridge lives on window.
      const bridge = (globalThis as unknown as {
        appdeck: { invoke: (channel: string) => Promise<unknown> };
      }).appdeck;
      const trust = (await bridge.invoke('trust:status')) as {
        tracker?: { blocklist?: { loaded?: boolean } };
      };
      return trust.tracker?.blocklist?.loaded ?? false;
    });
    expect(blocklistLoaded).toBe(true);
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
