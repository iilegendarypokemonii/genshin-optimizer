import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Dev-mode Vite transforms this monorepo on demand; first navigations on a
  // cold server can take 30s+, so give each test generous headroom.
  timeout: 90_000,
  expect: {
    timeout: 60_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config apps/frontend/vite.config.mts --host 127.0.0.1 --port 4200 --strictPort',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    cwd: '../../',
    timeout: 120_000,
  },
})
