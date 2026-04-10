import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/workstreams", () => ({
  ProgramWorkstreamDetailRoute: () => (
    <div data-testid="shared-workstream-detail-route">Shared Workstream Detail Route</div>
  ),
}));

import WorkstreamDetailPage from "./page";

describe("WorkstreamDetailPage wrapper", () => {
  it("renders shared ProgramWorkstreamDetailRoute", () => {
    render(<WorkstreamDetailPage />);

    expect(screen.getByTestId("shared-workstream-detail-route")).toHaveTextContent(
      "Shared Workstream Detail Route",
    );
  });
});
