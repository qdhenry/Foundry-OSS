import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/risks", () => ({
  ProgramRisksRoute: () => <div data-testid="shared-risks-route">Shared Risks Route</div>,
}));

import RisksPage from "./page";

describe("RisksPage wrapper", () => {
  it("renders shared ProgramRisksRoute", () => {
    render(<RisksPage />);

    expect(screen.getByTestId("shared-risks-route")).toHaveTextContent("Shared Risks Route");
  });
});
