import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeGraphTab } from "./KnowledgeGraphTab";

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
}));

vi.mock("./GraphControls", () => ({
  GraphControls: () => <div data-testid="graph-controls">Controls</div>,
}));

vi.mock("./KnowledgeGraph", () => ({
  KnowledgeGraph: () => <div data-testid="knowledge-graph">Graph</div>,
}));

vi.mock("./NodeDetailPanel", () => ({
  NodeDetailPanel: () => <div data-testid="node-panel">NodePanel</div>,
}));

describe("KnowledgeGraphTab", () => {
  it("shows empty message when no nodes", () => {
    queryReturn = { nodes: [], edges: [] };
    render(<KnowledgeGraphTab analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("No graph data available for this analysis.")).toBeInTheDocument();
  });

  it("renders graph and controls when nodes present", () => {
    queryReturn = {
      nodes: [{ id: "n1", name: "UserService", layer: "service" }],
      edges: [],
    };
    render(<KnowledgeGraphTab analysisId="a-1" orgId="org-1" />);
    expect(screen.getByTestId("graph-controls")).toBeInTheDocument();
    expect(screen.getByTestId("knowledge-graph")).toBeInTheDocument();
  });
});
