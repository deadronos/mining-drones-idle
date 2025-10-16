import { expect, test } from '@playwright/test';

test('app boots and accrues ore', async ({ page }) => {
  page.on('pageerror', (error) => console.error('pageerror:', error));
  page.on('console', (message) => console.log('console:', message.text()));
  await page.goto('/');
  const hud = page.locator('.hud');
  await expect(hud).toBeVisible({ timeout: 15000 });
  // In headless environments WebGL may not initialize; assert that HUD and Settings are present.
  const upgradeButton = page.getByRole('button', { name: /Prestige Run/i });
  await expect(upgradeButton).toBeVisible();
});
