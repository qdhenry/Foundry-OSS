import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockRouter = { push: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
}));

vi.mock("./RiskAssessmentPanel", () => ({
  RiskAssessmentPanel: () => <div data-testid="risk-assessment-panel" />,
}));

vi.mock("./RiskFilters", () => ({
  RiskFilters: ({ severity, status, onSeverityChange, onStatusChange }: any) => (
    <div data-testid="risk-filters" data-severity={severity} data-status={status} />
  ),
}));

vi.mock("./RiskCard", () => ({
  RiskCard: ({ risk }: any) => <div data-testid={`risk-${risk._id}`}>{risk.title}</div>,
}));

import { ProgramRisksRoute } from "./ProgramRisksRoute";

describe("ProgramRisksRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when risks are undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramRisksRoute />);
    expect(screen.getByText("Loading risks...")).toBeInTheDocument();
  });

  it("shows empty state when no risks exist", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ProgramRisksRoute />);
    expect(screen.getByText("No risks yet")).toBeInTheDocument();
  });

  it("renders risk cards when data is available", () => {
    mockUseQuery.mockReturnValue([
      { _id: "r1", title: "Auth Risk", severity: "high", probability: "likely", status: "open" },
      {
        _id: "r2",
        title: "Data Risk",
        severity: "low",
        probability: "unlikely",
        status: "resolved",
      },
    ]);
    render(<ProgramRisksRoute />);
    expect(screen.getByText("Auth Risk")).toBeInTheDocument();
    expect(screen.getByText("Data Risk")).toBeInTheDocument();
    expect(screen.getByText("2 risks registered")).toBeInTheDocument();
  });

  it("renders risk assessment panel", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ProgramRisksRoute />);
    expect(screen.getByTestId("risk-assessment-panel")).toBeInTheDocument();
  });

  it("renders risk filters", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ProgramRisksRoute />);
    expect(screen.getByTestId("risk-filters")).toBeInTheDocument();
  });

  it("navigates to new risk page on Add Risk click", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ProgramRisksRoute />);
    const addBtn = screen.getByText("Add Risk");
    addBtn.click();
    expect(mockRouter.push).toHaveBeenCalledWith("/my-prog/risks/new");
  });
});
