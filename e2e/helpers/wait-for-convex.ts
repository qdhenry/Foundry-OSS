import type { Page } from "@playwright/test";

/**
 * Wait for Convex reactive data to settle.
 * Useful after mutations that should cause UI updates.
 */
export async function waitForConvexUpdate(
  page: Page,
  opts: { timeout?: number } = {},
): Promise<void> {
  // Wait for network idle (Convex WebSocket messages settle)
  await page.waitForLoadState("networkidle", {
    timeout: opts.timeout ?? 10_000,
  });
}

/**
 * Wait for a loading spinner to disappear and content to render.
 */
export async function waitForContentLoad(
  page: Page,
  contentSelector: string,
  opts: { timeout?: number } = {},
): Promise<void> {
  // First wait for any loading indicators to vanish
  const spinner = page.locator('[data-testid="loading"], .animate-spin');
  if (await spinner.isVisible().catch(() => false)) {
    await spinner.waitFor({ state: "hidden", timeout: opts.timeout ?? 15_000 });
  }

  // Then wait for actual content
  await page.waitForSelector(contentSelector, {
    state: "visible",
    timeout: opts.timeout ?? 15_000,
  });
}
