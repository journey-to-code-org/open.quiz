import { defineConfig, devices } from "@playwright/test";

// Tests run against a production build by default so bundling, minification and
// asset loading match what learners actually hit. Set E2E_DEV_SERVER=1 to fall
// back to the Vite dev server for faster iteration.
const useDevServer = process.env.E2E_DEV_SERVER === "1";
const configuredPort = Number(process.env.E2E_PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0
  ? configuredPort
  : useDevServer
    ? 5173
    : 4173;
const baseURL = `http://127.0.0.1:${port}`;
const latencySuite = /.*\.latency\.spec\.js/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: useDevServer
      ? `npm --prefix frontend run dev -- --host 127.0.0.1 --port ${port} --strictPort`
      : `npm --prefix frontend run build && npm --prefix frontend run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: latencySuite,
    },
    {
      name: "chromium-slow-4g",
      use: { ...devices["Desktop Chrome"], networkProfile: "slow-4g" },
      testIgnore: latencySuite,
      timeout: 60_000,
      expect: { timeout: 10_000 },
    },
    {
      name: "chromium-fast-3g",
      use: { ...devices["Desktop Chrome"], networkProfile: "fast-3g" },
      testIgnore: latencySuite,
      timeout: 90_000,
      expect: { timeout: 15_000 },
    },
    {
      name: "chromium-slow-3g",
      use: { ...devices["Desktop Chrome"], networkProfile: "slow-3g" },
      testIgnore: latencySuite,
      // Throttled runs need far more headroom than the 30s default.
      timeout: 120_000,
      expect: { timeout: 20_000 },
    },
    {
      // Latency specs inject their own per-endpoint delays, so the transport
      // stays fast and only the API responses are slow.
      name: "learn-flow-latency",
      use: { ...devices["Desktop Chrome"] },
      testMatch: latencySuite,
      timeout: 120_000,
      expect: { timeout: 20_000 },
    },
  ],
});
