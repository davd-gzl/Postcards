import { defineConfig, devices } from "@playwright/test";

// Uses the preinstalled Chromium in this environment.
// Run with: pnpm --filter placebeen test:e2e
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the environment's preinstalled Chromium instead of downloading.
        launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" },
      },
    },
  ],
});
