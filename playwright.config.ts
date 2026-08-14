import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * These tests drive a real browser against a real database, so they cover the
 * things unit tests structurally cannot: does the upload actually round-trip
 * through a Server Action, is the view toggle reachable without scrolling, does
 * a sorted column actually change row order.
 *
 * `reuseExistingServer` means a dev server you already have running is used as
 * is — no waiting for a second one to boot, and no port fight.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared database; parallel writes would race
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/dashboard',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
