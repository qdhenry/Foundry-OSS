import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/activity", () => ({
  ProgramActivityRoute: () => <div data-testid="shared-activity-route">Shared Activity Route</div>,
}));

import ActivityPage from "./page";

describe("ActivityPage wrapper", () => {
  it("renders shared ProgramActivityRoute", () => {
    render(<ActivityPage />);

    expect(screen.getByTestId("shared-activity-route")).toHaveTextContent("Shared Activity Route");
  });
});
