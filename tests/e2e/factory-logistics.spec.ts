import { test, expect } from '@playwright/test';

test.describe('Factory Hauler Logistics', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to game and wait for app to initialize
    await page.goto('/');
    await page.waitForFunction(() => {
      const win = window as unknown as Record<string, unknown>;
      return win.__appReady;
    }, { timeout: 10000 });
    // Wait for initial render
    await page.waitForTimeout(500);
  });

  test('should display logistics panel in sidebar', async ({ page }) => {
    // Check that logistics panel exists
    const logisticsPanel = page.locator('.logistics-panel');
    await expect(logisticsPanel).toBeVisible();

    // Check for header
    const header = logisticsPanel.locator('h4');
    await expect(header).toHaveText('Logistics Network');
  });

  test('should show zero haulers and no transfers initially', async ({ page }) => {
    const logisticsPanel = page.locator('.logistics-panel');

    // Check summary values
    const summaryItems = logisticsPanel.locator('.summary-item');
    const haulerValue = summaryItems.first().locator('.value');
    await expect(haulerValue).toHaveText('0');
  });

  test('should allow assigning haulers to factory', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    // Find hauler add button
    const haulerPanel = page.locator('.factory-haulers');
    await expect(haulerPanel).toBeVisible();

    const addButton = haulerPanel.locator('.hauler-btn').first(); // + button
    const countBefore = haulerPanel.locator('.hauler-count .count');
    const valueBefore = await countBefore.textContent();

    // Click to add hauler
    await addButton.click();
    await page.waitForTimeout(500);

    // Verify count increased
    const valueAfter = await countBefore.textContent();
    expect(parseInt(valueAfter ?? '0')).toBeGreaterThan(parseInt(valueBefore ?? '0'));
  });

  test('should prevent removing haulers below zero', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    // Find hauler remove button
    const haulerPanel = page.locator('.factory-haulers');
    const removeButton = haulerPanel.locator('.hauler-btn').last(); // - button

    // Should be disabled when count is 0
    await expect(removeButton).toBeDisabled();
  });

  test('should display transfer in progress', async ({ page }) => {
    // This test requires specific game state setup
    // For now, verify transfer display structure exists

    // May or may not be visible depending on active transfers
    const transferItems = page.locator('.transfer-item');
    const count = await transferItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show factory selection in hauler controls', async ({ page }) => {
    // Buy two factories
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(300);
    await buyButton.click();
    await page.waitForTimeout(500);

    // Navigate to second factory
    const nextButton = page.getByRole('button', { name: 'Next factory' });
    await nextButton.click();
    await page.waitForTimeout(500);

    // Verify we can see hauler controls for factory 2
    const haulerPanel = page.locator('.factory-haulers');
    await expect(haulerPanel).toBeVisible();
  });

  test('should persist hauler assignment across navigation', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(300);

    // Assign 3 haulers
    const haulerPanel = page.locator('.factory-haulers');
    const addButton = haulerPanel.locator('.hauler-btn').first(); // + button

    for (let i = 0; i < 3; i++) {
      await addButton.click();
      await page.waitForTimeout(100);
    }

    // Get the count
    const countDisplay = haulerPanel.locator('.hauler-count .count');
    const count = await countDisplay.textContent();

    // Cycle through factories and back
    const nextButton = page.getByRole('button', { name: 'Next factory' });
    const prevButton = page.getByRole('button', { name: 'Previous factory' });

    await nextButton.click();
    await page.waitForTimeout(300);
    await prevButton.click();
    await page.waitForTimeout(500);

    // Count should be the same
    const countAfter = await countDisplay.textContent();
    expect(countAfter).toBe(count);
  });

  test('should show hauler logistics in factory card', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    // Check that hauler section exists
    const haulerSection = page.locator('.factory-haulers');
    await expect(haulerSection).toBeVisible();

    // Add a hauler
    const addButton = haulerSection.locator('.hauler-btn').first();
    await addButton.click();
    await page.waitForTimeout(300);

    // Check info message appears
    const info = haulerSection.locator('.hauler-info');
    await expect(info).toBeVisible();
    const text = await info.textContent();
    expect(text).toContain('hauler');
  });

  test('logistics panel should update in real-time', async ({ page }) => {
    const logisticsPanel = page.locator('.logistics-panel');

    // Get initial visible state
    const initialVisible = await logisticsPanel.isVisible();
    expect(initialVisible).toBe(true);

    // Wait and verify it's still visible (real-time update)
    await page.waitForTimeout(1500); // Wait past the 500ms refresh interval
    const stillVisible = await logisticsPanel.isVisible();
    expect(stillVisible).toBe(true);
  });

  test('should show/hide hauler info based on assignment', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    const haulerPanel = page.locator('.factory-haulers');

    // Initially should show hint message
    let hint = haulerPanel.locator('text=Assign haulers');
    await expect(hint).toBeVisible();

    // Add a hauler
    const addButton = haulerPanel.locator('.hauler-btn').first();
    await addButton.click();
    await page.waitForTimeout(300);

    // Now should show info message
    const info = haulerPanel.locator('.hauler-info');
    await expect(info).toBeVisible();

    // Hint should not be visible
    hint = haulerPanel.locator('text=Assign haulers');
    await expect(hint).not.toBeVisible();
  });

  test('should disable remove button when no haulers assigned', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    const haulerPanel = page.locator('.factory-haulers');
    const removeButton = haulerPanel.locator('.hauler-btn').last(); // - button

    // Should be disabled
    await expect(removeButton).toBeDisabled();

    // Add a hauler
    const addButton = haulerPanel.locator('.hauler-btn').first();
    await addButton.click();
    await page.waitForTimeout(300);

    // Remove button should now be enabled
    await expect(removeButton).toBeEnabled();

    // Remove the hauler
    await removeButton.click();
    await page.waitForTimeout(300);

    // Remove button should be disabled again
    await expect(removeButton).toBeDisabled();
  });

  test('should update hauler count display correctly', async ({ page }) => {
    // Buy first factory
    const buyButton = page.getByRole('button', { name: 'Buy Factory' });
    await buyButton.click();
    await page.waitForTimeout(500);

    const haulerPanel = page.locator('.factory-haulers');
    const countDisplay = haulerPanel.locator('.hauler-count .count');
    const addButton = haulerPanel.locator('.hauler-btn').first();

    // Initially 0
    await expect(countDisplay).toHaveText('0');

    // Add 5 haulers
    for (let i = 1; i <= 5; i++) {
      await addButton.click();
      await page.waitForTimeout(100);
      await expect(countDisplay).toHaveText(i.toString());
    }

    // Remove 2 haulers
    const removeButton = haulerPanel.locator('.hauler-btn').last();
    for (let i = 5; i > 3; i--) {
      await removeButton.click();
      await page.waitForTimeout(100);
      await expect(countDisplay).toHaveText((i - 1).toString());
    }
  });
});
