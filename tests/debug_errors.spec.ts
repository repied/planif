import { test } from '@playwright/test';

test('debug console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    console.log(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
  });
  await page.goto('/');
  await page.waitForTimeout(1000);

  console.log('All errors found:', errors);
});
