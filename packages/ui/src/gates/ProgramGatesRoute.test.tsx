import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-program" }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("./GateCard", () => ({
  GateCard: ({ gate }: any) => <div data-testid={`gate-${gate._id}`}>{gate.name}</div>,
}));

import { ProgramGatesRoute } from "./ProgramGatesRoute";

describe("ProgramGatesRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when gates are undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramGatesRoute />);
    expect(screen.getByText("Loading gates...")).toBeInTheDocument();
  });

  it("shows empty state when no gates exist", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates")) return [];
      if (name.includes("workstreams")) return [];
      return undefined;
    });
    render(<ProgramGatesRoute />);
    expect(screen.getByText("No sprint gates yet")).toBeInTheDocument();
    expect(screen.getByText("Create First Gate")).toBeInTheDocument();
  });

  it("renders gate cards grouped by workstream", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates"))
        return [
          {
            _id: "g1",
            name: "Foundation Gate",
            gateType: "foundation",
            status: "pending",
            workstreamId: "ws1",
            criteria: [],
          },
          {
            _id: "g2",
            name: "Release Gate",
            gateType: "release",
            status: "passed",
            workstreamId: "ws1",
            criteria: [],
          },
        ];
      if (name.includes("workstreams")) return [{ _id: "ws1", name: "Frontend" }];
      return undefined;
    });
    render(<ProgramGatesRoute />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Foundation Gate")).toBeInTheDocument();
    expect(screen.getByText("Release Gate")).toBeInTheDocument();
  });

  it("renders status badges for gate counts", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates"))
        return [
          {
            _id: "g1",
            name: "G1",
            gateType: "foundation",
            status: "pending",
            workstreamId: "ws1",
            criteria: [],
          },
          {
            _id: "g2",
            name: "G2",
            gateType: "release",
            status: "passed",
            workstreamId: "ws1",
            criteria: [],
          },
        ];
      if (name.includes("workstreams")) return [{ _id: "ws1", name: "WS" }];
      return undefined;
    });
    render(<ProgramGatesRoute />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("filters gates by type", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates"))
        return [
          {
            _id: "g1",
            name: "G1",
            gateType: "foundation",
            status: "pending",
            workstreamId: "ws1",
            criteria: [],
          },
          {
            _id: "g2",
            name: "G2",
            gateType: "release",
            status: "passed",
            workstreamId: "ws1",
            criteria: [],
          },
        ];
      if (name.includes("workstreams")) return [{ _id: "ws1", name: "WS" }];
      return undefined;
    });
    render(<ProgramGatesRoute />);
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "foundation" } });
    expect(screen.getByTestId("gate-g1")).toBeInTheDocument();
    expect(screen.queryByTestId("gate-g2")).not.toBeInTheDocument();
  });

  it("shows new gate link with correct slug", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramGatesRoute />);
    const link = screen.getByText("New Gate").closest("a");
    expect(link).toHaveAttribute("href", "/my-program/gates/new");
  });
});
