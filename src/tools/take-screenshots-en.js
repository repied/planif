/**
 * Script to take English-language screenshots of the dive planner app.
 * Run with: node src/tools/take-screenshots-en.js
 * Requires the dev server to be running on port 5500.
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5500';
const OUT_DIR = path.resolve(__dirname, '../../assets/screenshots');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  async function newPage(width = 1280, height = 720) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem('hasVisited', 'true');
      window.localStorage.setItem('selectedLang', 'en');
    });
    return page;
  }

  try {
    // ── 1. Desktop MN90 (light mode) ─────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT_DIR, 'desktop-mn90-en.png'), fullPage: false });
      await page.context().close();
      console.log('✓ desktop-mn90-en.png');
    }

    // ── 2. Desktop GF (light mode) ────────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(600);
      // Switch to GF mode
      await page.click('label[for="mode-gf"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, 'desktop-gf-en.png'), fullPage: false });
      await page.context().close();
      console.log('✓ desktop-gf-en.png');
    }

    // ── 3. Mobile MN90 ────────────────────────────────────────────
    {
      const page = await newPage(390, 844);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT_DIR, 'mobile-mn90-en.png'), fullPage: false });
      await page.context().close();
      console.log('✓ mobile-mn90-en.png');
    }

    // ── 4. Mobile GF ──────────────────────────────────────────────
    {
      const page = await newPage(390, 844);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(600);
      await page.click('label[for="mode-gf"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT_DIR, 'mobile-gf-en.png'), fullPage: false });
      await page.context().close();
      console.log('✓ mobile-gf-en.png');
    }

    // ── 5. Share modal ────────────────────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      await page.click('#share-link');
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, 'desktop-share-modal-en.png'),
        fullPage: false,
      });
      await page.context().close();
      console.log('✓ desktop-share-modal-en.png');
    }

    // ── 6. Gas breakdown modal ────────────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      // The reserve-box is in #dive-details; click to open gas modal
      const reserveBox = page.locator('#dive-details .reserve-box').first();
      await reserveBox.waitFor({ state: 'visible', timeout: 5000 });
      await reserveBox.click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, 'desktop-gas-breakdown-en.png'),
        fullPage: false,
      });
      await page.context().close();
      console.log('✓ desktop-gas-breakdown-en.png');
    }

    // ── 7. Time breakdown modal ───────────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      const dtrBox = page.locator('#dive-details .dtr-box').first();
      await dtrBox.waitFor({ state: 'visible', timeout: 5000 });
      await dtrBox.click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, 'desktop-time-breakdown-en.png'),
        fullPage: false,
      });
      await page.context().close();
      console.log('✓ desktop-time-breakdown-en.png');
    }

    // ── 8. Penalisation (surpénalisation) ─────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(600);
      // Switch to GF mode so the saturation/penalisation modal is available
      await page.click('label[for="mode-gf"]');
      await page.waitForTimeout(1000);
      // Open the saturation-modal directly (it is populated after GF calculation)
      await page.evaluate(() => {
        const modal = document.getElementById('saturation-modal');
        if (modal && window.__openModal) window.__openModal(modal);
      });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, 'desktop-penalisation-en.png'),
        fullPage: false,
      });
      await page.context().close();
      console.log('✓ desktop-penalisation-en.png');
    }

    // ── 9. Dark mode ──────────────────────────────────────────────
    {
      const page = await newPage(1280, 720);
      await page.addInitScript(() => {
        window.localStorage.setItem('hasVisited', 'true');
        window.localStorage.setItem('selectedLang', 'en');
        // Set dark theme in saved state
        try {
          const s = { theme: 'dark' };
          window.localStorage.setItem('divePlannerState', JSON.stringify(s));
        } catch (_) {}
      });
      await page.goto(BASE_URL + '/');
      await page.waitForTimeout(800);
      // Toggle dark mode via JS if not active
      await page.evaluate(() => {
        const toggle = document.getElementById('theme-toggle');
        if (toggle && !document.body.classList.contains('dark-mode')) {
          toggle.checked = true;
          toggle.dispatchEvent(new Event('change'));
        }
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, 'desktop-dark-en.png'), fullPage: false });
      await page.context().close();
      console.log('✓ desktop-dark-en.png');
    }

    console.log('\nAll English screenshots saved to', OUT_DIR);
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch((err) => {
  console.error(err);
  process.exit(1);
});
