import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamFilterTabs } from "./WorkstreamFilterTabs";

const workstreams = [
  { id: "ws-1", name: "Frontend", shortCode: "FE", color: "#3b82f6", requirements: [] },
  { id: "ws-2", name: "Backend", shortCode: "BE", color: "#ef4444", requirements: [] },
];

describe("WorkstreamFilterTabs", () => {
  it("renders All tab and workstream tabs", () => {
    render(
      <WorkstreamFilterTabs
        workstreams={workstreams}
        activeFilter={null}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("highlights All tab when activeFilter is null", () => {
    render(
      <WorkstreamFilterTabs
        workstreams={workstreams}
        activeFilter={null}
        onFilterChange={vi.fn()}
      />,
    );
    const allTab = screen.getByText("All");
    expect(allTab.className).toContain("font-medium");
  });

  it("highlights specific workstream when active", () => {
    render(
      <WorkstreamFilterTabs
        workstreams={workstreams}
        activeFilter="ws-1"
        onFilterChange={vi.fn()}
      />,
    );
    const feTab = screen.getByText("Frontend").closest("button");
    expect(feTab?.className).toContain("font-medium");
  });

  it("calls onFilterChange with null when All is clicked", () => {
    const onChange = vi.fn();
    render(
      <WorkstreamFilterTabs
        workstreams={workstreams}
        activeFilter="ws-1"
        onFilterChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("All"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onFilterChange with workstream id when tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <WorkstreamFilterTabs
        workstreams={workstreams}
        activeFilter={null}
        onFilterChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Backend"));
    expect(onChange).toHaveBeenCalledWith("ws-2");
  });
});
