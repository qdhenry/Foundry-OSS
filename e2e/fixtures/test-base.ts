import { test as base, expect } from "@playwright/test";

/**
 * Extended test fixture with app-specific helpers.
 * Import this instead of @playwright/test in spec files.
 */
export const test = base.extend<{
  /** Wait for Convex reactive data to appear. */
  waitForConvex: (selector: string, opts?: { timeout?: number }) => Promise<void>;
}>({
  waitForConvex: async ({ page }, use) => {
    await use(async (selector, opts) => {
      await page.waitForSelector(selector, {
        state: "visible",
        timeout: opts?.timeout ?? 15_000,
      });
    });
  },
});

export { expect };
