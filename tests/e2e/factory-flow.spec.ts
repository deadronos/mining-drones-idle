import { expect, test } from '@playwright/test';

test.describe('Factory management flow', () => {
  test('player can purchase factories and trigger camera autofit', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.hud', { timeout: 15000 });
    await page.waitForSelector('.factory-panel', { timeout: 15000 });

    // Export the current state, boost resources, and re-import so we can afford purchases.
    const snapshot = await page.evaluate(() => {
      const helper = window as Window & {
        __persistence?: {
          exportState: () => string;
          importState: (payload: string) => boolean;
        };
      };
      if (!helper.__persistence || typeof helper.__persistence.exportState !== 'function') {
        throw new Error('persistence manager not available on window');
      }
      return JSON.parse(helper.__persistence.exportState());
    });

    snapshot.resources.metals = 1_000;
    snapshot.resources.crystals = 1_000;
    snapshot.resources.energy = 500;

    const importSucceeded = await page.evaluate((payload) => {
      const helper = window as Window & {
        __persistence?: { importState: (value: string) => boolean };
      };
      if (!helper.__persistence || typeof helper.__persistence.importState !== 'function') {
        return false;
      }
      return helper.__persistence.importState(JSON.stringify(payload));
    }, snapshot);

    expect(importSucceeded).toBe(true);

    const ownedCounter = page.locator('.factory-panel p strong');
    await expect(ownedCounter).toHaveText('1', { timeout: 15000 });

    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await expect(buyButton).toBeEnabled({ timeout: 10000 });
    await buyButton.click();

    await expect(ownedCounter).toHaveText('2', { timeout: 15000 });
    await expect(page.locator('.factory-card')).toHaveCount(2, { timeout: 15000 });

    const autofitButton = page.getByRole('button', { name: 'Autofit Camera' });
    await expect(autofitButton).toBeEnabled();
    await autofitButton.click();

    // Re-export snapshot to confirm purchase persisted and ore throughput is tracked.
    const updatedSnapshot = await page.evaluate(() => {
      const helper = window as Window & {
        __persistence?: { exportState: () => string };
      };
      if (!helper.__persistence || typeof helper.__persistence.exportState !== 'function') {
        throw new Error('persistence manager not available on window (post-purchase)');
      }
      return JSON.parse(helper.__persistence.exportState());
    });

    expect(updatedSnapshot.factories?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(updatedSnapshot.resources.metals).toBeLessThan(snapshot.resources.metals);
    expect(updatedSnapshot.resources.crystals).toBeLessThan(snapshot.resources.crystals);
  });
});
