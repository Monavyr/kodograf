import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8123",
    headless: true,
  },
  webServer: {
    command: "python3 -m http.server 8123",
    port: 8123,
    reuseExistingServer: !process.env.CI,
  },
});
