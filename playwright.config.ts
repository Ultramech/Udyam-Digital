import { defineConfig, devices } from "@playwright/test";

/**
 * Browser journeys at phone size. Runs against a running app (default http://localhost:3000; set BASE for a deployed URL).
 *   npm run dev            # in another terminal
 *   npm run test:e2e
 * No API keys are required: every assertion holds whether or not Gemini/2Factor/Razorpay are configured.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000, // live AI calls can take ~90s while the provider is rate-limiting (free tier)
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE ?? "http://localhost:3000", ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
});
