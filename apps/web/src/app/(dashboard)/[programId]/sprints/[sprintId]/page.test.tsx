import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/sprints", () => ({
  ProgramSprintDetailRoute: () => (
    <div data-testid="shared-sprint-detail-route">Shared Sprint Detail Route</div>
  ),
}));

import SprintDetailPage from "./page";

describe("SprintDetailPage wrapper", () => {
  it("renders shared ProgramSprintDetailRoute", () => {
    render(<SprintDetailPage />);

    expect(screen.getByTestId("shared-sprint-detail-route")).toHaveTextContent(
      "Shared Sprint Detail Route",
    );
  });
});
