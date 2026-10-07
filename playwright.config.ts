import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys on a phone. Run against a production build:
 *   npm run build && npm run e2e
 * or against any deployment: BASE_URL=https://… npm run e2e
 */
const PORT = 3200;
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npx next start -p ${PORT}`, url: `http://127.0.0.1:${PORT}/fr`, reuseExistingServer: true, timeout: 60_000 },
});
