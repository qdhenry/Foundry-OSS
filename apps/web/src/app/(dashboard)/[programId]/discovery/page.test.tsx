import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/discovery", () => ({
  ProgramDiscoveryRoute: () => (
    <div data-testid="shared-discovery-route">Shared Discovery Route</div>
  ),
}));

import ProgramDiscoveryPage from "./page";

describe("ProgramDiscoveryPage wrapper", () => {
  it("renders shared ProgramDiscoveryRoute", () => {
    render(<ProgramDiscoveryPage />);

    expect(screen.getByTestId("shared-discovery-route")).toHaveTextContent(
      "Shared Discovery Route",
    );
  });
});
