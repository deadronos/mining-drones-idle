import { expect, test } from '@playwright/test';

const extractValue = (text: string | null) => {
  if (!text) return 0;
  const [, value] = text.split(':');
  return Number.parseFloat(value.trim());
};

test('app boots and accrues ore', async ({ page }) => {
  page.on('pageerror', (error) => console.error('pageerror:', error));
  page.on('console', (message) => console.log('console:', message.text()));
  await page.goto('/');
  const hud = page.locator('.hud');
  await expect(hud).toBeVisible({ timeout: 15000 });
  const initial = extractValue(await hud.textContent());
  await page.waitForTimeout(12000);
  const later = extractValue(await hud.textContent());
  expect(later).toBeGreaterThan(initial);
  const upgradeButton = page.getByRole('button', { name: /Prestige Run/i });
  await expect(upgradeButton).toBeVisible();
});
