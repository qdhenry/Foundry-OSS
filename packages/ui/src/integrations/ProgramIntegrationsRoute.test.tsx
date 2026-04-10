import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./IntegrationsPage", () => ({
  default: () => <div data-testid="integrations-page">Integrations</div>,
}));

import { ProgramIntegrationsRoute } from "./ProgramIntegrationsRoute";

describe("ProgramIntegrationsRoute", () => {
  it("renders IntegrationsPage", () => {
    render(<ProgramIntegrationsRoute />);
    expect(screen.getByTestId("integrations-page")).toBeInTheDocument();
  });
});
