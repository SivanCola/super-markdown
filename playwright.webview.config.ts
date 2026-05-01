import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/webview-toolbar",
  fullyParallel: false,
  retries: 0,
  reporter: [["line"]],
  outputDir: ".dev/playwright-results",
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
