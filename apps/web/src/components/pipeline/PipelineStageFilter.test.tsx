import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageFilter } from "./PipelineStageFilter";

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: ["discovery", "requirement", "implementation", "review"],
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
    review: { label: "Review", shortLabel: "Rev" },
  },
}));

describe("PipelineStageFilter", () => {
  const defaultProps = {
    activeStage: null as any,
    activePriority: null as string | null,
    searchQuery: "",
    onStageChange: vi.fn(),
    onPriorityChange: vi.fn(),
    onSearchChange: vi.fn(),
  };

  it("renders stage select with All Stages option", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toBeInTheDocument();
  });

  it("renders priority select", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(2);
  });

  it("renders search input with placeholder", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    expect(screen.getByPlaceholderText("Search requirements...")).toBeInTheDocument();
  });

  it("does not show Clear filters when no active filters", () => {
    render(<PipelineStageFilter {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows Clear filters when stage is active", () => {
    render(<PipelineStageFilter {...defaultProps} activeStage={"discovery" as any} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("shows Clear filters when search query is present", () => {
    render(<PipelineStageFilter {...defaultProps} searchQuery="login" />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("calls all clear handlers on Clear filters click", async () => {
    const onStageChange = vi.fn();
    const onPriorityChange = vi.fn();
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PipelineStageFilter
        {...defaultProps}
        activeStage={"discovery" as any}
        onStageChange={onStageChange}
        onPriorityChange={onPriorityChange}
        onSearchChange={onSearchChange}
      />,
    );
    await user.click(screen.getByText("Clear filters"));
    expect(onStageChange).toHaveBeenCalledWith(null);
    expect(onPriorityChange).toHaveBeenCalledWith(null);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("calls onSearchChange on input", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    render(<PipelineStageFilter {...defaultProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByPlaceholderText("Search requirements..."), "test");
    expect(onSearchChange).toHaveBeenCalled();
  });
});
