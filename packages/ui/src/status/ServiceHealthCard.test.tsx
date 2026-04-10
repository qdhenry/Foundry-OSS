import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceHealthCard } from "./ServiceHealthCard";

describe("ServiceHealthCard", () => {
  it("renders service name", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="healthy"
        circuitState="closed"
        activeRetries={0}
      />,
    );
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("renders operational status for healthy", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="healthy"
        circuitState="closed"
        activeRetries={0}
      />,
    );
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("renders outage status", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="outage"
        circuitState="open"
        activeRetries={0}
      />,
    );
    expect(screen.getByText("Outage")).toBeInTheDocument();
  });

  it("shows Critical badge when critical", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="healthy"
        circuitState="closed"
        activeRetries={0}
        critical
      />,
    );
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("shows message when provided", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="outage"
        circuitState="open"
        activeRetries={0}
        message="Connection timeout"
      />,
    );
    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
  });

  it("shows active retries count", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="degraded"
        circuitState="closed"
        activeRetries={3}
      />,
    );
    expect(screen.getByText("3 active retries")).toBeInTheDocument();
  });

  it("shows singular retry text", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="degraded"
        circuitState="closed"
        activeRetries={1}
      />,
    );
    expect(screen.getByText("1 active retry")).toBeInTheDocument();
  });

  it("shows circuit state badge when not closed", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="degraded"
        circuitState="half-open"
        activeRetries={0}
      />,
    );
    expect(screen.getByText("Circuit half-open")).toBeInTheDocument();
  });

  it("hides circuit badge when closed", () => {
    render(
      <ServiceHealthCard
        serviceName="Database"
        status="healthy"
        circuitState="closed"
        activeRetries={0}
      />,
    );
    expect(screen.queryByText(/Circuit/)).not.toBeInTheDocument();
  });
});
