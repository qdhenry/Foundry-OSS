import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeAnalyzerPage } from "./CodeAnalyzerPage";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("../../programs/ProgramContext", () => ({
  useProgramContext: () => ({ programId: "prog-1", slug: "test-prog" }),
}));

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
}));

vi.mock("./AnalysisLauncher", () => ({
  AnalysisLauncher: () => <div data-testid="launcher">Launcher</div>,
}));

vi.mock("./AnalysisList", () => ({
  AnalysisList: () => <div data-testid="list">List</div>,
}));

describe("CodeAnalyzerPage", () => {
  it("renders heading", () => {
    queryReturn = [];
    render(<CodeAnalyzerPage />);
    expect(screen.getByText("Code Analyzer")).toBeInTheDocument();
  });

  it("renders launcher", () => {
    queryReturn = [];
    render(<CodeAnalyzerPage />);
    expect(screen.getByTestId("launcher")).toBeInTheDocument();
  });

  it("shows empty message when no analyses", () => {
    queryReturn = [];
    render(<CodeAnalyzerPage />);
    expect(
      screen.getByText("No analyses yet. Start one above to get started."),
    ).toBeInTheDocument();
  });

  it("shows analysis list when analyses exist", () => {
    queryReturn = [{ _id: "a-1" }];
    render(<CodeAnalyzerPage />);
    expect(screen.getByTestId("list")).toBeInTheDocument();
  });
});
