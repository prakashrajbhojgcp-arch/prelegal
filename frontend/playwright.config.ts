import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8001);
// Use "localhost" rather than "127.0.0.1": Next.js 16 dev blocks cross-origin
// requests from numeric hosts by default, which silently breaks client-side
// hydration even though SSR HTML still loads.
const BASE_URL = `http://localhost:${PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Ephemeral SQLite DB inside the test-results dir so it gets wiped between
// Playwright runs along with the rest of the test artifacts.
const TEST_DB_PATH = path.join(__dirname, "test-results", "e2e.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `uv --directory ../backend run uvicorn prelegal_backend.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PRELEGAL_DATABASE_PATH: TEST_DB_PATH,
        PRELEGAL_SESSION_SECRET: "test-secret-do-not-use-in-prod",
      },
    },
    {
      command: `npx next dev --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        BACKEND_URL,
      },
    },
  ],
});
