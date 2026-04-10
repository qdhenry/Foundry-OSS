import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./DiscoveryPage", () => ({
  DiscoveryPage: () => <div data-testid="discovery-page">Discovery</div>,
}));

import { ProgramDiscoveryRoute } from "./ProgramDiscoveryRoute";

describe("ProgramDiscoveryRoute", () => {
  it("renders DiscoveryPage", () => {
    render(<ProgramDiscoveryRoute />);
    expect(screen.getByTestId("discovery-page")).toBeInTheDocument();
  });
});
