import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockFinalize = vi.fn().mockResolvedValue(undefined);
const mockOverride = vi.fn().mockResolvedValue(undefined);
const mockRemove = vi.fn().mockResolvedValue(undefined);
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (name: string) => {
    if (name.includes("finalize")) return mockFinalize;
    if (name.includes("override")) return mockOverride;
    return mockRemove;
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ gateId: "gate_1" }),
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("./ApprovalPanel", () => ({
  ApprovalPanel: () => <div data-testid="approval-panel" />,
}));

vi.mock("./CriteriaChecklist", () => ({
  CriteriaChecklist: () => <div data-testid="criteria-checklist" />,
}));

vi.mock("./SprintGateEvaluator", () => ({
  SprintGateEvaluator: () => <div data-testid="sprint-gate-evaluator" />,
}));

vi.mock("./CodeEvidenceSection", () => ({
  CodeEvidenceSection: () => <div data-testid="code-evidence" />,
}));

import { ProgramGateDetailRoute } from "./ProgramGateDetailRoute";

describe("ProgramGateDetailRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when gate data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramGateDetailRoute />);
    expect(screen.getByText("Loading gate...")).toBeInTheDocument();
  });

  it("shows not found when gate is null", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get")) return null;
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    expect(screen.getByText("Gate not found")).toBeInTheDocument();
  });

  it("renders gate details with name and badges", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Release Gate",
          gateType: "release",
          status: "pending",
          workstreamId: "ws1",
          criteria: [{ title: "Test", passed: false }],
          approvals: [],
        };
      if (name.includes("workstreams:get")) return { name: "Frontend" };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    expect(screen.getByText("Release Gate")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Release")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("renders criteria checklist and approval panel", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Gate",
          gateType: "foundation",
          status: "pending",
          criteria: [],
          approvals: [],
        };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    expect(screen.getByTestId("criteria-checklist")).toBeInTheDocument();
    expect(screen.getByTestId("approval-panel")).toBeInTheDocument();
  });

  it("shows finalize and override buttons for pending gates", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Gate",
          gateType: "foundation",
          status: "pending",
          criteria: [{ title: "C1", passed: true }],
          approvals: [],
        };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    expect(screen.getByText("Finalize Gate")).toBeInTheDocument();
    expect(screen.getByText("Override Gate")).toBeInTheDocument();
  });

  it("does not show action buttons for passed gates", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Gate",
          gateType: "foundation",
          status: "passed",
          criteria: [],
          approvals: [],
        };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    expect(screen.queryByText("Finalize Gate")).not.toBeInTheDocument();
    expect(screen.queryByText("Override Gate")).not.toBeInTheDocument();
  });

  it("shows delete confirmation modal on delete click", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Gate",
          gateType: "foundation",
          status: "pending",
          criteria: [],
          approvals: [],
        };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("Delete Gate?")).toBeInTheDocument();
  });

  it("navigates back on All Gates click", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("sprintGates:get"))
        return {
          name: "Gate",
          gateType: "foundation",
          status: "pending",
          criteria: [],
          approvals: [],
        };
      return undefined;
    });
    render(<ProgramGateDetailRoute />);
    fireEvent.click(screen.getByText("All Gates"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-prog/gates");
  });
});
