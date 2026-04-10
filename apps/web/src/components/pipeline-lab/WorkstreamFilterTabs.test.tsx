import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MockWorkstream } from "./pipeline-types";
import { WorkstreamFilterTabs } from "./WorkstreamFilterTabs";

const mockWorkstreams: MockWorkstream[] = [
  {
    id: "ws-1",
    name: "Storefront",
    shortCode: "SF",
    color: "#3B82F6",
    requirements: ["req-1", "req-2"],
  },
  {
    id: "ws-2",
    name: "Integration",
    shortCode: "INT",
    color: "#10B981",
    requirements: ["req-3"],
  },
];

describe("WorkstreamFilterTabs", () => {
  it("renders All tab and workstream tabs", () => {
    render(
      <WorkstreamFilterTabs
        workstreams={mockWorkstreams}
        activeFilter={null}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Storefront")).toBeInTheDocument();
    expect(screen.getByText("Integration")).toBeInTheDocument();
  });

  it("calls onFilterChange with null when All is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkstreamFilterTabs
        workstreams={mockWorkstreams}
        activeFilter="ws-1"
        onFilterChange={onChange}
      />,
    );
    await user.click(screen.getByText("All"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onFilterChange with workstream id when tab is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkstreamFilterTabs
        workstreams={mockWorkstreams}
        activeFilter={null}
        onFilterChange={onChange}
      />,
    );
    await user.click(screen.getByText("Storefront"));
    expect(onChange).toHaveBeenCalledWith("ws-1");
  });

  it("highlights active filter tab", () => {
    render(
      <WorkstreamFilterTabs
        workstreams={mockWorkstreams}
        activeFilter={null}
        onFilterChange={vi.fn()}
      />,
    );
    const allButton = screen.getByText("All");
    expect(allButton.className).toContain("font-medium");
  });
});
