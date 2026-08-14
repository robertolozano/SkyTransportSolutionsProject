import { defineConfig } from 'vitest/config'

/**
 * Unit tests only.
 *
 * Vitest's default glob also matches `e2e/*.spec.ts`, which are Playwright tests
 * — they import `@playwright/test` and fail to load under Vitest. Scoping the
 * include to `src/` keeps the two runners apart: `npm test` is fast and needs
 * nothing running, `npm run test:e2e` drives a browser against the real app.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
