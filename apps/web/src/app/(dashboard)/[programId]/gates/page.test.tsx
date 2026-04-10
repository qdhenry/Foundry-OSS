import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/gates", () => ({
  ProgramGatesRoute: () => <div data-testid="shared-gates-route">Shared Gates Route</div>,
}));

import GatesPage from "./page";

describe("GatesPage wrapper", () => {
  it("renders shared ProgramGatesRoute", () => {
    render(<GatesPage />);

    expect(screen.getByTestId("shared-gates-route")).toHaveTextContent("Shared Gates Route");
  });
});
