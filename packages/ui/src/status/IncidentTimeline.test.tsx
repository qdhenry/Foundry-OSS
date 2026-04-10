import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IncidentTimeline } from "./IncidentTimeline";

const mockIncident = {
  _id: "inc-1",
  service: "convex",
  title: "Database latency spike",
  status: "investigating" as const,
  severity: "major" as const,
  affectedComponents: ["API", "Dashboard"],
  timeline: [
    {
      timestamp: Date.now() - 300000,
      status: "investigating",
      message: "Investigating high latency",
    },
  ],
  startedAt: Date.now() - 300000,
};

describe("IncidentTimeline", () => {
  it("renders incident title", () => {
    render(<IncidentTimeline incidents={[mockIncident]} />);
    expect(screen.getByText("Database latency spike")).toBeInTheDocument();
  });

  it("renders incident status", () => {
    render(<IncidentTimeline incidents={[mockIncident]} />);
    expect(screen.getByText("investigating")).toBeInTheDocument();
  });

  it("renders severity badge", () => {
    render(<IncidentTimeline incidents={[mockIncident]} />);
    expect(screen.getByText("major")).toBeInTheDocument();
  });

  it("expands timeline details on click", () => {
    render(<IncidentTimeline incidents={[mockIncident]} />);
    fireEvent.click(screen.getByText("Database latency spike"));
    expect(screen.getByText("Investigating high latency")).toBeInTheDocument();
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("collapses timeline on second click", () => {
    render(<IncidentTimeline incidents={[mockIncident]} />);
    fireEvent.click(screen.getByText("Database latency spike"));
    expect(screen.getByText("Investigating high latency")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Database latency spike"));
    expect(screen.queryByText("Investigating high latency")).not.toBeInTheDocument();
  });

  it("renders multiple incidents", () => {
    const second = {
      ...mockIncident,
      _id: "inc-2",
      title: "Auth outage",
      status: "resolved" as const,
    };
    render(<IncidentTimeline incidents={[mockIncident, second]} />);
    expect(screen.getByText("Database latency spike")).toBeInTheDocument();
    expect(screen.getByText("Auth outage")).toBeInTheDocument();
  });
});
