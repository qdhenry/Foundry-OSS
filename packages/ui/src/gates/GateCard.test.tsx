import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string } & Record<string, any>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { GateCard } from "./GateCard";

const baseGate = {
  _id: "gate_1",
  name: "Foundation Quality Gate",
  gateType: "foundation" as const,
  status: "pending" as const,
  criteria: [
    { title: "Tests passing", passed: true },
    { title: "Code review", passed: false },
    { title: "Performance", passed: false },
  ],
  workstreamId: "ws1",
};

describe("GateCard", () => {
  it("renders gate name as link", () => {
    render(<GateCard gate={baseGate} programId="prog_1" />);
    expect(screen.getByText("Foundation Quality Gate")).toBeInTheDocument();
    const link = screen.getByText("Foundation Quality Gate").closest("a");
    expect(link).toHaveAttribute("href", "/my-prog/gates/gate_1");
  });

  it("shows type and status badges", () => {
    render(<GateCard gate={baseGate} programId="prog_1" />);
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows criteria progress fraction", () => {
    render(<GateCard gate={baseGate} programId="prog_1" />);
    expect(screen.getByText("1/3 passed")).toBeInTheDocument();
  });

  it("displays workstream name when provided", () => {
    render(<GateCard gate={baseGate} programId="prog_1" workstreamName="Frontend" />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("renders passed status badge for passed gate", () => {
    render(<GateCard gate={{ ...baseGate, status: "passed" }} programId="prog_1" />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("shows 100% progress when all criteria pass", () => {
    const allPassed = {
      ...baseGate,
      criteria: baseGate.criteria.map((c) => ({ ...c, passed: true })),
    };
    render(<GateCard gate={allPassed} programId="prog_1" />);
    expect(screen.getByText("3/3 passed")).toBeInTheDocument();
  });
});
