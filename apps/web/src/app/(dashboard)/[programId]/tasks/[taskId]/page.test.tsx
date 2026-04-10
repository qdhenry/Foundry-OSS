import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/tasks", () => ({
  ProgramTaskDetailRoute: () => (
    <div data-testid="shared-task-detail-route">Shared Task Detail Route</div>
  ),
}));

import TaskDetailPage from "./page";

describe("TaskDetailPage wrapper", () => {
  it("renders shared ProgramTaskDetailRoute", () => {
    render(<TaskDetailPage />);

    expect(screen.getByTestId("shared-task-detail-route")).toHaveTextContent(
      "Shared Task Detail Route",
    );
  });
});
