import { defineConfig, devices } from "@playwright/test";
import { CLOUDINARY_PORT } from "./e2e/support/fake-cloudinary";
import { DATABASE_URL } from "./e2e/support/pg-server";

const APP_PORT = 3200;
const BROKEN_APP_PORT = 3201;
const secrets = {
  BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
  CLOUDINARY_CLOUD_NAME: "e2e-cloud",
  CLOUDINARY_API_KEY: "e2e-key-123",
  CLOUDINARY_API_SECRET: "e2e-api-secret-do-not-leak",
  CLOUDINARY_UPLOAD_PREFIX: `http://127.0.0.1:${CLOUDINARY_PORT}`, // marker for next.config image hosts
  CLOUDINARY_URL: `cloudinary://e2e-key-123:e2e-api-secret-do-not-leak@e2e-cloud?upload_prefix=http://127.0.0.1:${CLOUDINARY_PORT}`,
};

// The test process itself talks to the same database (fixtures, assertions, concurrency tests).
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_DRIVER = "pg";
Object.assign(process.env, secrets);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${APP_PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure", locale: "ru-RU", timezoneId: "Europe/Moscow" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: /(responsive|auth\.setup)/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"], testMatch: /responsive\.spec\.ts/ },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 } }, dependencies: ["setup"], testMatch: /responsive\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    // 1. real PostgreSQL + fake Cloudinary (migrated, seeded, test users created)
    { command: "npx kill-port 54329 54330 3200 3201 && npx tsx e2e/support/serve-backends.ts", port: CLOUDINARY_PORT, timeout: 240_000, reuseExistingServer: false },
    // 2. production build of the app
    {
      command: `npx next build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      timeout: 600_000,
      env: { ...secrets, DATABASE_URL, DB_DRIVER: "pg", BETTER_AUTH_URL: `http://localhost:${APP_PORT}`, NODE_ENV: "production" },
    },
    // 3. same build, database unreachable: used to verify graceful degradation
    {
      command: `npx next start -p ${BROKEN_APP_PORT}`,
      url: `http://localhost:${BROKEN_APP_PORT}/login`,
      timeout: 120_000,
      env: { ...secrets, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:1/none", DB_DRIVER: "pg", BETTER_AUTH_URL: `http://localhost:${BROKEN_APP_PORT}`, NODE_ENV: "production" },
    },
  ],
});
