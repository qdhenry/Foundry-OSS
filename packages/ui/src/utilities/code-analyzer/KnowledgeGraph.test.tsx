import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeGraph } from "./KnowledgeGraph";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const MockComponent = () => <div data-testid="graph-inner">GraphInner</div>;
    return MockComponent;
  },
}));

describe("KnowledgeGraph", () => {
  it("renders inner graph component", () => {
    render(
      <KnowledgeGraph
        nodes={[]}
        edges={[]}
        onNodeSelect={vi.fn()}
        activeFilters={new Set(["api"])}
      />,
    );
    expect(screen.getByTestId("graph-inner")).toBeInTheDocument();
  });
});
