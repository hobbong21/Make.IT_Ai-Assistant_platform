import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for MaKIT E2E tests
 *
 * Run tests:
 *   npm test -- --project=chromium
 *   npm test -- --project=mobile-chrome
 *   MAKIT_BASE_URL=https://staging.makit.com npm test
 *
 * View results:
 *   npx playwright show-report
 */

export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files sequentially within a single worker (default parallel) */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Workers on CI, or default (unlimited) locally */
  workers: process.env.CI ? 1 : undefined,

  /* Shared settings for all reporters */
  reporter: [
    ['html'],
    ['list'],
    ['github'], // For GitHub Actions
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.MAKIT_BASE_URL || 'http://localhost:8080',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure for debugging */
    screenshot: 'only-on-failure',

    /* Timeout per action */
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile browsers */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests (optional) */
  webServer: process.env.CI ? undefined : {
    /* Assuming backend is already running on localhost:8080 */
    command: 'echo "Backend should already be running on localhost:8080"',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 5000,
  },

  /* Global test timeout */
  timeout: 30000,

  /* Expect assertion timeout */
  expect: {
    timeout: 10000,
  },
});
