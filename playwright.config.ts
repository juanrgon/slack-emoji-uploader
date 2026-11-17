import { defineConfig } from "@playwright/test";

// The tests load the built extension from dist/, so build first
// (`npm run test:e2e` does). Set CHROMIUM_PATH to test against an installed
// Chromium instead of the one from `npx playwright install chromium`.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Every test starts its own browser, and about one start in a hundred
  // dies for reasons unrelated to the test. One retry absorbs that.
  retries: 1,
  reporter: "list",
});
