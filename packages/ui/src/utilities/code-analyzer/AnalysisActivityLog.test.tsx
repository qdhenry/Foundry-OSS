import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisActivityLog } from "./AnalysisActivityLog";

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
}));

describe("AnalysisActivityLog", () => {
  it("shows waiting message when no logs", () => {
    queryReturn = undefined;
    render(<AnalysisActivityLog analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Waiting for activity...")).toBeInTheDocument();
  });

  it("shows waiting when logs empty", () => {
    queryReturn = [];
    render(<AnalysisActivityLog analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Waiting for activity...")).toBeInTheDocument();
  });

  it("renders log messages", () => {
    queryReturn = [
      { step: "scan", message: "Scanning files", level: "info", timestamp: 1700000000000 },
      { step: "done", message: "Complete", level: "success", timestamp: 1700000001000 },
    ];
    render(<AnalysisActivityLog analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Scanning files")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
