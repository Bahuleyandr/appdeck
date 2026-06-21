import { test, expect, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('launches the AppDeck shell', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'appdeck-e2e-'));
  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${userData}`]
  });
  try {
    const window = await app.firstWindow();
    await expect(window.locator('text=Services')).toBeVisible();
    await expect(window.locator('button[title="Add service"]').first()).toBeVisible();
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
