import { test } from '@playwright/test';

test('debug console errors with URL', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('requestfailed', (request) => {
    console.log(`FAILED REQUEST: ${request.url()} - ${request.failure()?.errorText}`);
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(1000);
});
