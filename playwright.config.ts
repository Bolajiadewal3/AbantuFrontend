import { defineConfig } from "@playwright/test";

const apiPort = process.env.CAREAPP_E2E_API_PORT ?? "5144";
const frontendPort = process.env.CAREAPP_E2E_FRONTEND_PORT ?? "5175";
const frontendUrl = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.cjs",
  reporter: "list",
  use: {
    baseURL: frontendUrl,
    headless: true,
    trace: "retain-on-failure",
    channel: "chrome",
    
  },
  webServer: {
    command: `npm run dev -- --host localhost --port ${frontendPort} --strictPort`,
    url: frontendUrl,
    reuseExistingServer: process.env.CAREAPP_E2E_REUSE_SERVER === "true",
    timeout: 30_000,
    env: {
      VITE_API_URL: `http://localhost:${apiPort}`,
      CAREAPP_E2E_API_PORT: apiPort,
      CAREAPP_E2E_FRONTEND_PORT: frontendPort,
    },
  },
});