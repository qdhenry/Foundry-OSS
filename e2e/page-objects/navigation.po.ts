import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the main navigation shell (sidebar, breadcrumbs, Cmd+K).
 */
export class NavigationPO {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly breadcrumbs: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], nav[role="navigation"]');
    this.breadcrumbs = page.locator('[data-testid="breadcrumbs"], nav[aria-label="Breadcrumb"]');
  }

  async navigateToPrograms() {
    await this.page.goto("/programs");
  }

  async navigateToProgram(programId: string) {
    await this.page.goto(`/${programId}`);
  }

  async clickSidebarLink(name: string) {
    await this.sidebar.getByRole("link", { name }).click();
  }

  async openCommandPalette() {
    await this.page.keyboard.press("Meta+k");
  }

  async searchCommand(query: string) {
    await this.openCommandPalette();
    await this.page.getByPlaceholder(/search/i).fill(query);
  }
}
