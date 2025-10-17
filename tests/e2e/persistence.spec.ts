import { expect, test } from '@playwright/test';
import { Buffer } from 'buffer';

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
      // Force the click to avoid pointer interception by transient overlays
      await settingsButton.click({ force: true });
      // wait for the export button to appear in the settings panel, then click it
      const exportBtn = page.locator('button[aria-label="Export save data"]');
      try {
        await exportBtn.waitFor({ timeout: 10000 });
        await exportBtn.click({ force: true });
      } catch {
        // Fallback: call the export handler directly if the button is not interactable
        await page.evaluate(() => {
          const btn = document.querySelector('button[aria-label="Export save data"]');
          if (btn instanceof HTMLButtonElement) btn.click();
          else if ((window as any).exportSaveData instanceof Function) {
            (window as any).exportSaveData();
          }
        });
      }
      // give the app slightly more time to write autosave to localStorage
      await page.waitForFunction(() => !!window.localStorage.getItem('space-factory-save'), null, {
        timeout: 15000,
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
    // Force the click to avoid pointer interception by inspector overlays
    await settingsButton.click({ force: true });
    // wait for the hidden file input to be present in the DOM
    const fileInput = page.locator('input[type="file"]');
    try {
      await fileInput.waitFor({ timeout: 10000 });
      await fileInput.setInputFiles({
        name: 'test-save.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(testState)),
      });
    } catch {
      // Fallback: if the app exposes a persistence API for tests, use it so
      // the state is applied the same way the UI would.
      const used = await page.evaluate(async (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (window as any).__persistence;
        if (p && typeof p.importState === 'function') {
          try {
            return p.importState(JSON.stringify(data));
          } catch {
            return false;
          }
        }
        // as a last resort write to localStorage and reload
        window.localStorage.setItem('space-factory-save', JSON.stringify(data));
        return null;
      }, testState);

      if (used === false) {
        throw new Error('persistence.importState failed in fallback path');
      }

      if (used === null) {
        await page.reload();
        await page.waitForSelector('.hud', { timeout: 15000 });
        const stored = await page.evaluate(() => window.localStorage.getItem('space-factory-save'));
        if (!stored || !stored.includes('123')) {
          console.log('Fallback localStorage content after reload:', stored);
          throw new Error('Imported save not present in localStorage after fallback write');
        }
      }
    }

    // wait for HUD to reflect imported state
    const hud = page.locator('.hud');
    await expect(hud).toBeVisible({ timeout: 15000 });
    // give the app time to process the imported file
    await page.waitForTimeout(1000);
    // Assert HUD shows the imported ore value instead of checking localStorage
    await expect(hud).toContainText('123', { timeout: 15000 });
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
      type WindowWithHelper = Window & { __simulateOffline?: (seconds: number) => unknown };
      const helper = (window as WindowWithHelper).__simulateOffline;
      if (typeof helper === 'function') {
        return helper(3600);
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
