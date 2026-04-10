import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GateCard } from "./GateCard";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const baseGate = {
  _id: "gate-1",
  name: "Foundation Gate",
  gateType: "foundation" as const,
  status: "pending" as const,
  criteria: [
    { title: "Schema defined", passed: true },
    { title: "Auth configured", passed: false },
    { title: "CI setup", passed: false },
  ],
  workstreamId: "ws-1",
};

describe("GateCard", () => {
  it("renders gate name", () => {
    render(<GateCard gate={baseGate} programId="prog-1" />);
    expect(screen.getByText("Foundation Gate")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<GateCard gate={baseGate} programId="prog-1" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders type badge", () => {
    render(<GateCard gate={baseGate} programId="prog-1" />);
    expect(screen.getByText("Foundation")).toBeInTheDocument();
  });

  it("shows criteria progress", () => {
    render(<GateCard gate={baseGate} programId="prog-1" />);
    expect(screen.getByText("1/3 passed")).toBeInTheDocument();
  });

  it("renders workstream name when provided", () => {
    render(<GateCard gate={baseGate} programId="prog-1" workstreamName="Commerce" />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
  });

  it("links to gate detail page", () => {
    render(<GateCard gate={baseGate} programId="prog-1" />);
    expect(screen.getByText("Foundation Gate").closest("a")).toHaveAttribute(
      "href",
      "/prog-1/gates/gate-1",
    );
  });

  it("renders passed status", () => {
    const gate = { ...baseGate, status: "passed" as const };
    render(<GateCard gate={gate} programId="prog-1" />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("renders failed status", () => {
    const gate = { ...baseGate, status: "failed" as const };
    render(<GateCard gate={gate} programId="prog-1" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("handles 100% criteria progress", () => {
    const gate = {
      ...baseGate,
      criteria: [
        { title: "A", passed: true },
        { title: "B", passed: true },
      ],
    };
    render(<GateCard gate={gate} programId="prog-1" />);
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
  });

  it("handles empty criteria", () => {
    const gate = { ...baseGate, criteria: [] };
    render(<GateCard gate={gate} programId="prog-1" />);
    expect(screen.getByText("0/0 passed")).toBeInTheDocument();
  });
});
