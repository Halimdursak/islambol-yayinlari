import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.QA_PORT ?? 8092);
const DIST_DIZINI = process.env.QA_DIST ?? 'dist';
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Q2 QA & Görsel Regresyon. Bu makinede yalnızca channel 'msedge' çalışır (ADR-008).
 * Sunucu: scripts/qa/sunucu.mjs (dist/). Önce `npm run build`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  forbidOnly: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    channel: 'msedge',
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node scripts/qa/sunucu.mjs --dir ${DIST_DIZINI} --port ${PORT}`,
    url: `${BASE_URL}/`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'masaustu',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobil',
      // Tarayıcısız (dosya sistemi) ve genişlik taramaları yalnız masaüstü projesinde koşar.
      testIgnore: [/baglantilar.spec/, /seo.spec.ts/, /gorsel.spec/],
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
