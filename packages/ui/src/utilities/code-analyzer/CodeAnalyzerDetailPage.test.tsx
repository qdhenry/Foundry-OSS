import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeAnalyzerDetailPage } from "./CodeAnalyzerDetailPage";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
}));

vi.mock("./AnalysisProgress", () => ({
  AnalysisProgress: () => <div data-testid="progress">Progress</div>,
}));

vi.mock("./AnalysisActivityLog", () => ({
  AnalysisActivityLog: () => <div data-testid="activity-log">ActivityLog</div>,
}));

vi.mock("./KnowledgeGraphTab", () => ({
  KnowledgeGraphTab: () => <div data-testid="graph-tab">Graph</div>,
}));

vi.mock("./ChatPanel", () => ({
  ChatPanel: () => <div data-testid="chat-panel">Chat</div>,
}));

vi.mock("./TourViewer", () => ({
  TourViewer: () => <div data-testid="tour-viewer">Tours</div>,
}));

describe("CodeAnalyzerDetailPage", () => {
  it("shows not found when analysis is null", () => {
    queryReturn = null;
    render(<CodeAnalyzerDetailPage analysisId="a-1" />);
    expect(screen.getByText("Analysis not found.")).toBeInTheDocument();
  });

  it("shows progress when not completed", () => {
    queryReturn = { status: "scanning", repoUrl: "https://github.com/o/r" };
    render(<CodeAnalyzerDetailPage analysisId="a-1" />);
    expect(screen.getByTestId("progress")).toBeInTheDocument();
    expect(screen.getByText("Analysis in progress...")).toBeInTheDocument();
  });

  it("shows tabs when completed", () => {
    queryReturn = { status: "completed", repoUrl: "https://github.com/o/r" };
    render(<CodeAnalyzerDetailPage analysisId="a-1" />);
    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Tours")).toBeInTheDocument();
  });

  it("renders repo name in heading", () => {
    queryReturn = { status: "completed", repoUrl: "https://github.com/acme/lib" };
    render(<CodeAnalyzerDetailPage analysisId="a-1" />);
    expect(screen.getByText("acme/lib")).toBeInTheDocument();
  });
});
