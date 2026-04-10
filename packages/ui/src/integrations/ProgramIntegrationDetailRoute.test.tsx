import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./IntegrationDetailPage", () => ({
  default: () => <div data-testid="integration-detail">Detail</div>,
}));

import { ProgramIntegrationDetailRoute } from "./ProgramIntegrationDetailRoute";

describe("ProgramIntegrationDetailRoute", () => {
  it("renders IntegrationDetailPage", () => {
    render(<ProgramIntegrationDetailRoute />);
    expect(screen.getByTestId("integration-detail")).toBeInTheDocument();
  });
});
