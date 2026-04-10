---
description: Set up testing infrastructure with Clerk Authentication (OTP bypass, session tokens, Testing Tokens, Playwright/Cypress integration)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, MultiEdit, WebFetch
argument-hint: [playwright|cypress|unit] (default: playwright)
---

# Setup Clerk Testing

Configure testing infrastructure for a project using Clerk Authentication. Handles test environment setup, authentication bypasses, session token management, and E2E framework integration.

## Variables

TEST_FRAMEWORK: $ARGUMENTS
DEFAULT_FRAMEWORK: playwright

## Instructions

If `TEST_FRAMEWORK` is empty, default to `playwright`.

### Step 1: Assess Current State

- Read `package.json` to identify existing test dependencies and scripts
- Check for existing test config files (`vitest.config.*`, `playwright.config.*`, `cypress.config.*`, `jest.config.*`)
- Check for existing test directories (`__tests__/`, `tests/`, `e2e/`, `cypress/`)
- Identify Clerk configuration (`@clerk/nextjs` version, middleware setup)
- Read any existing `.env.test` or `.env.local` for Clerk env vars

### Step 2: Install Dependencies

Based on `TEST_FRAMEWORK`:

**For `playwright`:**
```bash
bun add -D @playwright/test @clerk/testing
bunx playwright install
```

**For `cypress`:**
```bash
bun add -D cypress @clerk/testing
```

**For `unit` (Vitest):**
```bash
bun add -D vitest @testing-library/react @testing-library/jest-dom @clerk/testing
```

### Step 3: Configure Test Environment

Create or update `.env.test` with required Clerk variables:

```env
# Clerk Test Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from .env.local>
CLERK_SECRET_KEY=<from .env.local>
```

> **IMPORTANT:** Never hardcode real keys. Copy references from existing `.env.local`.

### Step 4: Set Up Clerk Testing Helpers

#### OTP Test Bypass (All Frameworks)

Clerk supports fake email addresses and phone numbers with fixed OTP codes for testing. Document the pattern:

- **Test emails:** Use `+clerk_test@` format (e.g., `user+clerk_test@example.com`) with OTP code `424242`
- **Test phones:** Use Clerk's test phone numbers with fixed codes

#### Session Token Flow (API/Integration Tests)

For tests that need valid session tokens:

1. Create user via Clerk Backend API
2. Create session for that user
3. Generate session token (valid 60s)
4. Pass as `Authorization: Bearer <token>`
5. Refresh before expiry using interval or per-test refresh

#### Testing Tokens (Bot Detection Bypass)

Testing Tokens bypass Clerk's bot detection. Include via `__clerk_testing_token` query parameter on Frontend API requests.

### Step 5: Framework-Specific Setup

#### Playwright Setup

Create `playwright.config.ts` with Clerk integration:

```typescript
import { defineConfig, devices } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";

export default defineConfig({
  globalSetup: clerkSetup,  // Handles Testing Tokens automatically
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "bun run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

Create `e2e/auth.setup.ts` for authenticated test state:

```typescript
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  // Sign in with test credentials
  await page.getByLabel("Email").fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await page.context().storageState({ path: ".auth/user.json" });
});
```

#### Cypress Setup

Create `cypress.config.ts` with Clerk integration:

```typescript
import { clerkSetup } from "@clerk/testing/cypress";
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      return clerkSetup({ config }); // Handles Testing Tokens
    },
  },
});
```

Add Clerk commands to `cypress/support/commands.ts`:

```typescript
import { addClerkCommands } from "@clerk/testing/cypress";
addClerkCommands({ Cypress, cy });
```

#### Vitest (Unit Test) Setup

Create `vitest.config.ts` with React/Clerk mocking:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

Create `tests/setup.ts` with Clerk mocks:

```typescript
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Clerk hooks for unit tests
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "test-user", firstName: "Test", lastName: "User" },
  }),
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user",
    orgId: "test-org",
    getToken: vi.fn().mockResolvedValue("mock-token"),
  }),
  useOrganization: () => ({
    isLoaded: true,
    organization: { id: "test-org", name: "Test Org" },
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
}));
```

### Step 6: Add Scripts

Update `package.json` with test scripts appropriate to the chosen framework.

### Step 7: Create Example Test

Create one example test file demonstrating:
- Authentication setup/bypass
- A basic authenticated page test
- Proper test cleanup

## Production Testing Limitations

When using Testing Tokens in production:
- **Code-based auth (OTP, magic links) is NOT supported** in production with testing helpers
- Must use **email + password** or **direct email sign-in** for production test authentication
- Testing Tokens are instance-specific and short-lived

## Workflow

1. **Assess** — Read existing project configuration and Clerk setup
2. **Install** — Add required test dependencies for chosen framework
3. **Configure** — Set up test environment variables and config files
4. **Integrate** — Wire up Clerk testing helpers (OTP bypass, session tokens, Testing Tokens)
5. **Scaffold** — Create framework config, setup files, and example test
6. **Verify** — Run the example test to confirm setup works

## Report

After setup is complete, provide:

```
Setup Complete: Clerk Testing with [FRAMEWORK]

Files created/modified:
- <list of files>

Test commands:
- <bun script commands>

Next steps:
- <what the developer should do next>
```
