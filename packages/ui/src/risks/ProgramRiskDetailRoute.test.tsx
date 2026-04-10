import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockUpdateRisk = vi.fn().mockResolvedValue(undefined);
const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
const mockRemoveRisk = vi.fn().mockResolvedValue(undefined);
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (name: string) => {
    if (name.includes("update") && !name.includes("Status")) return mockUpdateRisk;
    if (name.includes("updateStatus")) return mockUpdateStatus;
    return mockRemoveRisk;
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ riskId: "risk_1" }),
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("./RiskMatrix", () => ({
  RiskMatrix: () => <div data-testid="risk-matrix" />,
}));

import { ProgramRiskDetailRoute } from "./ProgramRiskDetailRoute";

const baseRisk = {
  _id: "risk_1",
  _creationTime: Date.now(),
  title: "Data Migration Risk",
  description: "May exceed timeline",
  mitigation: "Add buffer time",
  severity: "high",
  probability: "likely",
  status: "open",
  ownerName: "Alice",
  workstreamIds: ["ws1"],
};

describe("ProgramRiskDetailRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when risk is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByText("Loading risk...")).toBeInTheDocument();
  });

  it("shows not found when risk is null", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return null;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByText("Risk not found")).toBeInTheDocument();
  });

  it("renders risk details with title and badges", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      if (name.includes("workstreams")) return [{ _id: "ws1", name: "Frontend", shortCode: "FE" }];
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByText("Data Migration Risk")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders description and mitigation sections", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByText("May exceed timeline")).toBeInTheDocument();
    expect(screen.getByText("Add buffer time")).toBeInTheDocument();
  });

  it("renders risk matrix", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByTestId("risk-matrix")).toBeInTheDocument();
  });

  it("shows delete button for open risks", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    expect(screen.getByTitle("Delete risk")).toBeInTheDocument();
  });

  it("shows delete confirmation on delete click", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    fireEvent.click(screen.getByTitle("Delete risk"));
    expect(screen.getByText("Delete Risk")).toBeInTheDocument();
  });

  it("enables inline title editing on click", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name.includes("risks:get")) return baseRisk;
      return undefined;
    });
    render(<ProgramRiskDetailRoute />);
    fireEvent.click(screen.getByText("Data Migration Risk"));
    expect(screen.getByDisplayValue("Data Migration Risk")).toBeInTheDocument();
  });
});
