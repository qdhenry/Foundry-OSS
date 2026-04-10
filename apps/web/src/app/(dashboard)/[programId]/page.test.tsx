import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/overview", () => ({
  ProgramOverviewRoute: () => <div data-testid="shared-overview-route">Shared Overview Route</div>,
}));

import ProgramOverviewPage from "./page";

describe("ProgramOverviewPage wrapper", () => {
  it("renders shared ProgramOverviewRoute", () => {
    render(<ProgramOverviewPage />);

    expect(screen.getByTestId("shared-overview-route")).toHaveTextContent("Shared Overview Route");
  });
});
