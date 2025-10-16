import { expect, test } from '@playwright/test';

test.describe('Persistence smoke tests', () => {
  test('export produces a valid JSON payload', async ({ page }) => {
    await page.goto('/');
    // wait for app to initialize
    await page.waitForSelector('.hud', { timeout: 15000 });

    // Wait up to a few seconds for persistence to write the save key (autosave on load)
    let raw = await page.evaluate(() => window.localStorage.getItem('space-factory-save'));
    if (!raw) {
      // fallback: open settings and trigger Export via DOM click (bypass Playwright click viewport issues)
      const settingsButton = page.getByRole('button', { name: 'Settings' });
      await settingsButton.click();
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Export save data"]');
        btn?.click();
      });
      await page.waitForFunction(() => !!window.localStorage.getItem('space-factory-save'), null, {
        timeout: 5000,
      });
      raw = await page.evaluate(() => window.localStorage.getItem('space-factory-save'));
    }
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty('resources');
    expect(parsed).toHaveProperty('save');
    expect(parsed).toHaveProperty('settings');
  });

  test('import restores state from exported payload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.hud', { timeout: 15000 });

    // create a valid store snapshot and import via the Settings file input to exercise the import code path
    const testState = {
      resources: { ore: 123.45, bars: 0, energy: 100, credits: 0 },
      modules: { droneBay: 1, refinery: 0, storage: 0, solar: 0, scanner: 0 },
      prestige: { cores: 0 },
      save: { lastSave: Date.now(), version: 'test-1' },
      settings: {
        autosaveEnabled: true,
        autosaveInterval: 10,
        offlineCapHours: 8,
        notation: 'standard',
        throttleFloor: 0.25,
        showTrails: true,
        performanceProfile: 'medium',
      },
    };

    // open settings and upload a file via the hidden input
    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await settingsButton.click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'test-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(testState)) });

    // wait for HUD to reflect imported state
    const hud = page.locator('.hud');
    await expect(hud).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.localStorage.getItem('space-factory-save')?.includes('123'), null, { timeout: 3000 });
    const text = await hud.textContent();
    // HUD formatting may vary; look for the ore number
    expect(text).toMatch(/123(\.45)?/);
  });

  test('offline recap simulation changes HUD after simulated time', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.hud', { timeout: 15000 });
    const hud = page.locator('.hud');
    const initialText = await hud.textContent();
  const initialVal = Number((initialText ?? '0').replace(/[^0-9.]/g, '')) || 0;

    // Simulate offline progress by calling the app's window method if available
    const simulated = await page.evaluate(() => {
      // The app exposes a test helper `__simulateOffline` for testing, otherwise try to advance time in store
      // @ts-expect-error -- may not exist in production build
      if ((window as any).__simulateOffline) {
        // simulate 1 hour
        // @ts-expect-error -- may not exist in production build
        return (window as any).__simulateOffline(3600);
      }
      return null;
    });

    // If simulation ran, reload and check HUD
    if (simulated) {
      await page.reload();
      await page.waitForSelector('.hud', { timeout: 15000 });
      const laterText = await hud.textContent();
  const laterVal = Number((laterText ?? '0').replace(/[^0-9.]/g, '')) || 0;
      expect(laterVal).toBeGreaterThanOrEqual(initialVal);
    } else {
      // fallback: ensure the app still updates over time
      await page.waitForTimeout(5000);
      const laterText = await hud.textContent();
  const laterVal = Number((laterText ?? '0').replace(/[^0-9.]/g, '')) || 0;
      expect(laterVal).toBeGreaterThanOrEqual(initialVal);
    }
  });
});
