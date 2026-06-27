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

test('launches the AppDeck shell', async () => {
  const { app, userData } = await launchApp();
  try {
    const window = await app.firstWindow();
    await expect(window.getByText('Services', { exact: true })).toBeVisible();
    await expect(window.locator('button[title="Add service"]').first()).toBeVisible();
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});

test('keeps onboarding actions visible in a short window', async () => {
  const { app, userData } = await launchApp();
  try {
    const window = await app.firstWindow();
    await window.setViewportSize({ width: 920, height: 620 });
    await expect(window.getByText('Welcome to AppDeck')).toBeVisible();
    await window.getByRole('button', { name: 'Start fresh' }).click();
    await expect(window.getByRole('button', { name: 'Start using AppDeck' })).toBeVisible();
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});

test('does not show synthetic seed variants in service search', async () => {
  const { app, userData } = await launchApp();
  try {
    const window = await app.firstWindow();
    await expect(window.getByText('Welcome to AppDeck')).toBeVisible();
    await window.getByRole('button', { name: 'Skip' }).click();
    await window.locator('button[title="Add service"]').first().click();
    await window.getByPlaceholder('Search services').fill('whats');

    await expect(window.getByText('WhatsApp Web', { exact: true })).toHaveCount(1);
    await expect(window.getByText('WhatsApp Web Admin')).toHaveCount(0);
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
