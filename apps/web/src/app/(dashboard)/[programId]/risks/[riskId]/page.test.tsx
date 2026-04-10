import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/risks", () => ({
  ProgramRiskDetailRoute: () => (
    <div data-testid="shared-risk-detail-route">Shared Risk Detail Route</div>
  ),
}));

import RiskDetailPage from "./page";

describe("RiskDetailPage wrapper", () => {
  it("renders shared ProgramRiskDetailRoute", () => {
    render(<RiskDetailPage />);

    expect(screen.getByTestId("shared-risk-detail-route")).toHaveTextContent(
      "Shared Risk Detail Route",
    );
  });
});
