import { expect, test } from '@playwright/test';

test('import rejects invalid payloads gracefully', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.hud', { timeout: 15000 });

  // Open settings and attempt to import an invalid JSON file via the hidden input
  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await settingsButton.click({ force: true });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ timeout: 10000 });

  // Provide an intentionally invalid payload
  const invalidPayload = 'not-json';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bufferObj = (globalThis as any).Buffer
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Buffer.from(invalidPayload)
    : { type: 'Buffer', data: Array.from(new TextEncoder().encode(invalidPayload)) };

  await fileInput.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: bufferObj,
  });

  // The app should handle this gracefully: either show an error toast or not crash
  // Wait briefly and assert the app is still responsive and HUD present
  await page.waitForTimeout(1000);
  const hud = page.locator('.hud');
  await expect(hud).toBeVisible({ timeout: 5000 });

  // Optionally assert that an error notification is present
  const toast = page.locator('.toast, .notification, [role="alert"]');
  if (await toast.count() > 0) {
    await expect(toast.first()).toBeVisible();
  }
});
