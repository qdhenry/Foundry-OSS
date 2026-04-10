import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/risks", () => ({
  ProgramRiskNewRoute: () => <div data-testid="shared-risk-new-route">Shared Risk New Route</div>,
}));

import NewRiskPage from "./page";

describe("NewRiskPage wrapper", () => {
  it("renders shared ProgramRiskNewRoute", () => {
    render(<NewRiskPage />);

    expect(screen.getByTestId("shared-risk-new-route")).toHaveTextContent("Shared Risk New Route");
  });
});
