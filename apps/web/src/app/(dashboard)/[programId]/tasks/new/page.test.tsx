import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/tasks", () => ({
  ProgramTaskNewRoute: () => <div data-testid="shared-task-new-route">Shared Task New Route</div>,
}));

import NewTaskPage from "./page";

describe("NewTaskPage wrapper", () => {
  it("renders shared ProgramTaskNewRoute", () => {
    render(<NewTaskPage />);

    expect(screen.getByTestId("shared-task-new-route")).toHaveTextContent("Shared Task New Route");
  });
});
