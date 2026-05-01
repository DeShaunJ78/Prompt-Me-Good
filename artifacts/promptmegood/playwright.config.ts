import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PMG_BASE_URL ?? "http://localhost:80",
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: false,
      },
    },
  ],
});
