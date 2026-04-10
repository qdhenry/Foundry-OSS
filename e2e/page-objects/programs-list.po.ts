import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the /programs listing page.
 */
export class ProgramsListPO {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly programCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /programs/i });
    this.createButton = page.getByRole("button", { name: /create|new program/i });
    this.programCards = page.locator('[data-testid="program-card"], [role="listitem"]');
  }

  async goto() {
    await this.page.goto("/programs");
  }

  async getProgramCount(): Promise<number> {
    return this.programCards.count();
  }

  async clickProgram(name: string) {
    await this.page.getByText(name).click();
  }
}
