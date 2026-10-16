import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.QA_URL || 'http://127.0.0.1:8093';
const folder = new URL('../../docs/qa/redesign/', import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['/', '/kitaplar/', '/yazarlar/', '/kitap/sen-neden-kor-edildin/']) {
      const response = await page.goto(origin + path);
      assert.equal(response.status(), 200, `${width} ${path} HTTP`);
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        h1: document.querySelectorAll('h1').length,
        broken: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
      }));
      assert.equal(metrics.h1, 1, `${path} has one h1`);
      assert.ok(metrics.scrollWidth <= metrics.width, `${width} ${path} overflow ${metrics.scrollWidth}`);
      assert.deepEqual(metrics.broken, [], `${path} broken images`);
      results.push({ width, path, ...metrics });
      if (path === '/') {
        await page.screenshot({ path: fileURLToPath(new URL(`home-${width}.png`, folder)), fullPage: true });
        const count = await page.locator('[data-slide]').count();
        if (count > 1) {
          await page.getByRole('button', { name: 'Sonraki duyuru', exact: true }).click();
          assert.ok(await page.locator('[data-slide]').nth(1).isVisible());
        }
        if (width >= 1000) {
          await page.getByRole('searchbox').fill('Mizaç');
          await page.getByRole('searchbox').press('Enter');
          await page.waitForURL('**/kitaplar/?q=*');
          assert.equal(await page.locator('.kitap-karti:visible').count(), 1);
        } else {
          await page.locator('.ust__menu-dugme').click();
          assert.equal(await page.locator('.ust__menu-dugme').getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.ust__menu-dugme').getAttribute('aria-expanded'), 'false');
        }
      }
      if (path === '/kitap/sen-neden-kor-edildin/' && width === 1440) {
        await page.locator('[data-onizleme]').first().click();
        await page.waitForSelector('.stf__parent', { timeout: 15000 });
        assert.ok(await page.locator('dialog[open]').count() >= 1);
        await page.screenshot({ path: fileURLToPath(new URL('preview-1440.png', folder)), fullPage: false });
        await page.keyboard.press('Escape');
      }
    }
    assert.deepEqual(errors, [], `${width} page errors`);
    await page.close();
  }
  await writeFile(new URL('layout-results.json', folder), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} responsive pages, search, menu, slider and book preview.`);
} finally { await browser.close(); }
