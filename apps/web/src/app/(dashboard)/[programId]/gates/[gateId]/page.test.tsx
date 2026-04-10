import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/gates", () => ({
  ProgramGateDetailRoute: () => (
    <div data-testid="shared-gate-detail-route">Shared Gate Detail Route</div>
  ),
}));

import GateDetailPage from "./page";

describe("GateDetailPage wrapper", () => {
  it("renders shared ProgramGateDetailRoute", () => {
    render(<GateDetailPage />);

    expect(screen.getByTestId("shared-gate-detail-route")).toHaveTextContent(
      "Shared Gate Detail Route",
    );
  });
});
