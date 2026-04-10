import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageFilter } from "./PipelineStageFilter";

const defaultProps = {
  activeStage: null as any,
  activePriority: null as string | null,
  searchQuery: "",
  onStageChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onSearchChange: vi.fn(),
};

describe("PipelineStageFilter", () => {
  it("renders stage and priority selects", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    expect(screen.getByDisplayValue("All Stages")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Priorities")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search requirements...")).toBeInTheDocument();
  });

  it("shows clear filters when filters are active", () => {
    render(<PipelineStageFilter {...defaultProps} searchQuery="test" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("does not show clear filters when no filters active", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("calls onSearchChange when typing in search", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<PipelineStageFilter {...defaultProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText("Search requirements..."), "a");
    expect(onSearchChange).toHaveBeenCalled();
  });
});
