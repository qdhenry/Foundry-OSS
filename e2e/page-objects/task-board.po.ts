import type { Page, Locator } from "@playwright/test";

/**
 * Page object for the task board (/[programId]/tasks).
 */
export class TaskBoardPO {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly taskCards: Locator;
  readonly columns: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /tasks/i });
    this.createButton = page.getByRole("button", { name: /create|add task/i });
    this.taskCards = page.locator('[data-testid="task-card"]');
    this.columns = page.locator('[data-testid="board-column"]');
  }

  async goto(programId: string) {
    await this.page.goto(`/${programId}/tasks`);
  }

  async getTaskCount(): Promise<number> {
    return this.taskCards.count();
  }

  async clickTask(title: string) {
    await this.page.getByText(title).click();
  }
}
