import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../.auth/user.json");

/**
 * Clerk auth setup — runs once before all tests.
 *
 * Uses Clerk Testing Tokens when CLERK_TESTING_TOKEN is set (bypasses UI).
 * Falls back to email/password sign-in via the Clerk UI.
 *
 * Required env vars (from .env.e2e):
 *   E2E_CLERK_USER_EMAIL
 *   E2E_CLERK_USER_PASSWORD
 *   CLERK_TESTING_TOKEN (optional — enables fast auth bypass)
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set in .env.e2e",
    );
  }

  // If Clerk Testing Token is set, inject it as a cookie to bypass UI auth
  const testingToken = process.env.CLERK_TESTING_TOKEN;
  if (testingToken) {
    await page.goto("/");
    await page.evaluate((token) => {
      window.__clerk_testing_token = token;
    }, testingToken);
  }

  // Navigate to sign-in
  await page.goto("/sign-in");

  // Fill Clerk sign-in form
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for redirect to authenticated area
  await page.waitForURL("**/programs**", { timeout: 30_000 });
  await expect(page).toHaveURL(/\/programs/);

  // Save auth state
  await page.context().storageState({ path: authFile });
});
