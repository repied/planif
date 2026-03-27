const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem('hasVisited', 'true');
    window.localStorage.setItem('selectedLang', 'en');
  });
  await page.goto('http://127.0.0.1:5500/');
  await page.waitForTimeout(600);
  await page.click('label[for="mode-gf"]');
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const modal = document.getElementById('saturation-modal');
    const table = document.getElementById('saturation-table-container');
    return {
      modalExists: !!modal,
      tableContent: table ? table.innerHTML.substring(0, 300) : 'N/A',
      modalHidden: modal ? modal.getAttribute('aria-hidden') : 'N/A',
      majDisplay: document.getElementById('majoration-display')
        ? window.getComputedStyle(document.getElementById('majoration-display')).display
        : 'N/A',
      majIconDisplay: document.getElementById('majoration-help-icon')
        ? window.getComputedStyle(document.getElementById('majoration-help-icon')).display
        : 'N/A',
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(console.error);
