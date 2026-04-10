import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/gates", () => ({
  ProgramGateNewRoute: () => <div data-testid="shared-gate-new-route">Shared Gate New Route</div>,
}));

import CreateGatePage from "./page";

describe("CreateGatePage wrapper", () => {
  it("renders shared ProgramGateNewRoute", () => {
    render(<CreateGatePage />);

    expect(screen.getByTestId("shared-gate-new-route")).toHaveTextContent("Shared Gate New Route");
  });
});
