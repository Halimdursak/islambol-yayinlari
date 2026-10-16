// Publisher reference inspection; saves only QA evidence, never site content.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const folder = new URL('../../docs/qa/redesign/', import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto('https://www.alfakitap.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.screenshot({ path: new URL('alfa-reference.png', folder).pathname.replace(/^\/(\w:)/, '$1'), fullPage: false });
  const summary = await page.evaluate(() => ({
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 35),
    navigation: [...document.querySelectorAll('nav a,header a')].map((e) => ({ text: e.textContent.trim(), href: e.getAttribute('href') })).filter((e) => e.text).slice(0, 45),
    imageCount: document.images.length,
    text: document.body.innerText.slice(0, 6000),
  }));
  await writeFile(new URL('alfa-inspection.json', folder), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} catch (error) {
  console.log(JSON.stringify({ referenceUnavailable: true, message: error.message }));
} finally { await browser.close(); }
