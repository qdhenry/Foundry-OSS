import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/sprints", () => ({
  ProgramSprintsRoute: () => <div data-testid="shared-sprints-route">Shared Sprints Route</div>,
}));

import SprintsPage from "./page";

describe("SprintsPage wrapper", () => {
  it("renders shared ProgramSprintsRoute", () => {
    render(<SprintsPage />);

    expect(screen.getByTestId("shared-sprints-route")).toHaveTextContent("Shared Sprints Route");
  });
});
