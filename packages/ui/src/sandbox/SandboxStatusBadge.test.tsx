import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxStatusBadge } from "./SandboxStatusBadge";

vi.mock("./RuntimeModeBadge", () => ({
  RuntimeModeBadge: ({ mode }: { mode: string }) =>
    mode ? <span data-testid="runtime-badge">{mode}</span> : null,
}));

vi.mock("./StageProgress", () => ({
  summarizeSetupProgress: (p: unknown) =>
    p ? { totalStages: 10, completedStages: 5, skippedStages: 0, progressPercent: 50 } : null,
}));

describe("SandboxStatusBadge", () => {
  it("renders provisioning status", () => {
    render(<SandboxStatusBadge status="provisioning" />);
    expect(screen.getByText("Provisioning")).toBeInTheDocument();
  });

  it("renders completed status", () => {
    render(<SandboxStatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders failed status", () => {
    render(<SandboxStatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders unknown status with formatted label", () => {
    render(<SandboxStatusBadge status="custom_status" />);
    expect(screen.getByText("Custom Status")).toBeInTheDocument();
  });

  it("shows PR link when completed with prUrl", () => {
    render(<SandboxStatusBadge status="completed" prUrl="https://github.com/pr/1" />);
    expect(screen.getByText("View PR")).toBeInTheDocument();
  });

  it("hides PR link when not completed", () => {
    render(<SandboxStatusBadge status="executing" prUrl="https://github.com/pr/1" />);
    expect(screen.queryByText("View PR")).not.toBeInTheDocument();
  });

  it("shows setup progress when provided", () => {
    render(
      <SandboxStatusBadge
        status="provisioning"
        setupProgress={{ containerProvision: { status: "completed" } }}
      />,
    );
    expect(screen.getByText(/Setup 5\/10/)).toBeInTheDocument();
  });

  it("hides setup progress when showSetupProgress is false", () => {
    render(
      <SandboxStatusBadge
        status="provisioning"
        setupProgress={{ containerProvision: { status: "completed" } }}
        showSetupProgress={false}
      />,
    );
    expect(screen.queryByText(/Setup/)).not.toBeInTheDocument();
  });

  it("renders runtime mode badge when provided", () => {
    render(<SandboxStatusBadge status="ready" runtimeMode="interactive" />);
    expect(screen.getByTestId("runtime-badge")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<SandboxStatusBadge status="ready" className="custom" />);
    expect(container.firstChild).toHaveClass("custom");
  });
});
