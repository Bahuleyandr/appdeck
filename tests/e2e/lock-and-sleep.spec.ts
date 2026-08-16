import { test, expect, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function launchApp(): Promise<{
  app: Awaited<ReturnType<typeof electron.launch>>;
  userData: string;
}> {
  const userData = mkdtempSync(join(tmpdir(), 'appdeck-e2e-'));
  const app = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [join(process.cwd(), 'out/main/index.js'), `--user-data-dir=${userData}`]
  });
  return { app, userData };
}

/** Dismiss onboarding so the main shell is reachable. */
async function skipOnboarding(window: Awaited<ReturnType<Awaited<ReturnType<typeof electron.launch>>['firstWindow']>>): Promise<void> {
  await expect(window.getByText('Welcome to AppDeck')).toBeVisible();
  await window.getByRole('button', { name: 'Skip' }).click();
}

test('app lock covers the workspace and unlocks with the right passphrase', async () => {
  const { app, userData } = await launchApp();
  try {
    const window = await app.firstWindow();
    await skipOnboarding(window);

    // First use sets the passphrase, which also engages the lock.
    await window.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(window.getByLabel('Create a passphrase')).toBeVisible();
    await window.getByLabel('New passphrase').fill('correct horse battery');
    await window.getByLabel('Confirm passphrase').fill('correct horse battery');
    await window.getByRole('button', { name: 'Set passphrase & lock' }).click();

    // Locked: the unlock prompt is up and the rail is covered.
    await expect(window.getByRole('button', { name: 'Unlock' })).toBeVisible();

    // A wrong passphrase is rejected and keeps the lock on.
    await window.getByLabel('Passphrase', { exact: true }).fill('not the passphrase');
    await window.getByRole('button', { name: 'Unlock' }).click();
    await expect(window.getByText('Incorrect passphrase.')).toBeVisible();
    await expect(window.getByRole('button', { name: 'Unlock' })).toBeVisible();

    // The real one lets us back in.
    await window.getByLabel('Passphrase', { exact: true }).fill('correct horse battery');
    await window.getByRole('button', { name: 'Unlock' }).click();
    await expect(window.getByRole('button', { name: 'Unlock' })).toHaveCount(0);
    await expect(window.getByText('Services', { exact: true })).toBeVisible();
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});

test('a service can be added, slept, and woken from the rail', async () => {
  const { app, userData } = await launchApp();
  try {
    const window = await app.firstWindow();
    await skipOnboarding(window);

    // Add a launcher-only service so the test needs no network.
    await window.locator('button[title="Add service"]').first().click();
    await window.getByPlaceholder('Search services').fill('signal');
    await window.getByText('Signal', { exact: true }).first().click();

    const rail = window.getByLabel('Services');
    await expect(rail.getByText('Signal', { exact: true })).toBeVisible();

    // Sleep it through the context menu, then wake it again. The menu label flips to reflect
    // the state, which is the observable proof the main-process state round-tripped.
    await rail.getByText('Signal', { exact: true }).click({ button: 'right' });
    await window.getByText('Sleep', { exact: true }).click();
    await rail.getByText('Signal', { exact: true }).click({ button: 'right' });
    await expect(window.getByText('Wake', { exact: true })).toBeVisible();
    await window.getByText('Wake', { exact: true }).click();

    await rail.getByText('Signal', { exact: true }).click({ button: 'right' });
    await expect(window.getByText('Sleep', { exact: true })).toBeVisible();
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
