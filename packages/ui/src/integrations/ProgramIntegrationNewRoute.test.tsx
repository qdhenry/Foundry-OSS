import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./NewIntegrationPage", () => ({
  default: () => <div data-testid="new-integration">New Integration</div>,
}));

import { ProgramIntegrationNewRoute } from "./ProgramIntegrationNewRoute";

describe("ProgramIntegrationNewRoute", () => {
  it("renders NewIntegrationPage", () => {
    render(<ProgramIntegrationNewRoute />);
    expect(screen.getByTestId("new-integration")).toBeInTheDocument();
  });
});
