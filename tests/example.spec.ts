import { test, expect } from '@playwright/test';

test('app loads and shows main elements', async ({ page }) => {
  // Disable help modal for tests
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');

  // Check title
  await expect(page).toHaveTitle(/Tables/);

  // Check Gauges
  await expect(page.locator('#pressure-gauge-container')).toBeVisible();
  await expect(page.locator('#sac-gauge-container')).toBeVisible();
  await expect(page.locator('#volume-gauge-container')).toBeVisible();
  await expect(page.locator('#time-gauge-container')).toBeVisible();
  await expect(page.locator('#depth-gauge-container')).toBeVisible();

  // Check initial values
  await expect(page.locator('#pressure-display')).toHaveText('200');
  await expect(page.locator('#depth-display')).toHaveText('40');

  // Check footer contains expected text structure (gps, dtr, Pression fin)
  await expect(page.locator('#gps-display-1')).toContainText(/gps/i);
  await expect(page.locator('#dive-details')).toContainText('dtr');
  await expect(page.locator('#dive-details')).toContainText(/Pression.*fin/is);
});

test('mode switching between MN90 and GF', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(500);

  // Verify initial state is MN90
  const isGFModeInitial = await page.evaluate(() => {
    return document.body.classList.contains('gf-mode');
  });
  expect(isGFModeInitial).toBe(false);

  // Switch to GF Mode
  await page.click('label[for="mode-gf"]');
  await page.waitForTimeout(500);

  // Verify GF mode is active
  const isGFModeAfterSwitch = await page.evaluate(() => {
    return document.body.classList.contains('gf-mode');
  });
  expect(isGFModeAfterSwitch).toBe(true);

  // Verify GF controls are visible
  await expect(page.locator('#gf-low-gauge-container')).toBeVisible();
  await expect(page.locator('#gf-high-gauge-container')).toBeVisible();

  // Switch back to MN90
  await page.click('label[for="mode-mn90"]');
  await page.waitForTimeout(500);

  // Verify MN90 mode is active
  const isGFModeFinal = await page.evaluate(() => {
    return document.body.classList.contains('gf-mode');
  });
  expect(isGFModeFinal).toBe(false);
});

test('gas settings affect tank information display', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(500);

  // Check initial values
  await expect(page.locator('#pressure-display')).toHaveText('200');
  await expect(page.locator('#sac-display')).toHaveText(/\d+/);
  await expect(page.locator('#volume-display')).toHaveText(/\d+/);

  // All gas parameters should be visible
  await expect(page.locator('#pressure-gauge-container')).toBeVisible();
  await expect(page.locator('#sac-gauge-container')).toBeVisible();
  await expect(page.locator('#volume-gauge-container')).toBeVisible();
  await expect(page.locator('#o2-gauge-container')).toBeVisible();
});

test('successive dive controls are visible', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(500);

  // Check for second dive elements
  await expect(page.locator('#dive-details-2')).toBeVisible();
  await expect(page.locator('#time-display-2')).toBeVisible();
  await expect(page.locator('#depth-display-2')).toBeVisible();

  // Check for interval gauge
  await expect(page.locator('#interval-gauge-container')).toBeVisible();

  // Check for majoration display
  await expect(page.locator('#majoration-display')).toBeVisible();
});

test('dive results are properly formatted', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Check DTR formatting (should be HH:MM format)
  const dtrText = await page.locator('#dive-details .result-value').first().innerText();
  expect(dtrText).toMatch(/\d+:\d+/);

  // Check that reserve/gas info is displayed
  const reserveText = await page.locator('#dive-details').innerText();
  expect(reserveText.toLowerCase()).toMatch(/pression.*fin/s);
});

test('no console errors on page load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Check there are no critical errors in console
  const criticalErrors = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('analytics') &&
      !e.includes('gtag')
  );

  expect(criticalErrors.length).toBe(0);
});
