import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusPageRoute } from "./StatusPageRoute";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("../resilience/ResilienceProvider", () => ({
  useResilienceState: () => ({
    services: {
      convex: { status: "healthy", circuitState: "closed", activeRetries: 0 },
      clerk: { status: "healthy", circuitState: "closed", activeRetries: 0 },
    },
    networkOnline: true,
  }),
}));

vi.mock("./ServiceHealthCard", () => ({
  ServiceHealthCard: ({ serviceName }: { serviceName: string }) => (
    <div data-testid={`health-card-${serviceName}`}>{serviceName}</div>
  ),
}));

vi.mock("./IncidentTimeline", () => ({
  IncidentTimeline: () => <div data-testid="incident-timeline" />,
}));

describe("StatusPageRoute", () => {
  it("renders page heading", () => {
    render(<StatusPageRoute />);
    expect(screen.getByText("System Status")).toBeInTheDocument();
  });

  it("renders service health cards", () => {
    render(<StatusPageRoute />);
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
  });

  it("renders incident history section", () => {
    render(<StatusPageRoute />);
    expect(screen.getByText("Incident History")).toBeInTheDocument();
  });
});
