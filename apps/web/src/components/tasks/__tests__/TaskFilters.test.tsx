import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFilters } from "../TaskFilters";

const defaultProps = {
  status: "" as const,
  priority: "" as const,
  workstreamId: "",
  sprintId: "",
  viewMode: "board" as const,
  onStatusChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onWorkstreamChange: vi.fn(),
  onSprintChange: vi.fn(),
  onViewModeChange: vi.fn(),
};

function renderFilters(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<TaskFilters {...props} />);
}

describe("TaskFilters", () => {
  beforeEach(() => {
    defaultProps.onStatusChange.mockReset();
    defaultProps.onPriorityChange.mockReset();
    defaultProps.onWorkstreamChange.mockReset();
    defaultProps.onSprintChange.mockReset();
    defaultProps.onViewModeChange.mockReset();
  });

  it("renders status and priority select dropdowns", () => {
    renderFilters();

    expect(screen.getByText("All Statuses")).toBeInTheDocument();
    expect(screen.getByText("All Priorities")).toBeInTheDocument();
  });

  it("renders workstream dropdown when workstreams provided", () => {
    renderFilters({
      workstreams: [{ _id: "ws-1", name: "Payments", shortCode: "PYMT" }],
    });

    expect(screen.getByText("All Workstreams")).toBeInTheDocument();
    expect(screen.getByText("PYMT - Payments")).toBeInTheDocument();
  });

  it("renders sprint dropdown when sprints provided", () => {
    renderFilters({
      sprints: [{ _id: "sp-1", name: "Sprint 1", workstreamId: "ws-1" }],
    });

    expect(screen.getByText("All Sprints")).toBeInTheDocument();
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("calls onStatusChange when status filter changes", async () => {
    const user = userEvent.setup();
    renderFilters();

    const statusSelect = screen.getByDisplayValue("All Statuses");
    await user.selectOptions(statusSelect, "in_progress");

    expect(defaultProps.onStatusChange).toHaveBeenCalledWith("in_progress");
  });

  it("calls onPriorityChange when priority filter changes", async () => {
    const user = userEvent.setup();
    renderFilters();

    const prioritySelect = screen.getByDisplayValue("All Priorities");
    await user.selectOptions(prioritySelect, "high");

    expect(defaultProps.onPriorityChange).toHaveBeenCalledWith("high");
  });

  it("calls onWorkstreamChange when workstream filter changes", async () => {
    const user = userEvent.setup();
    renderFilters({
      workstreams: [{ _id: "ws-1", name: "Payments", shortCode: "PYMT" }],
    });

    const wsSelect = screen.getByDisplayValue("All Workstreams");
    await user.selectOptions(wsSelect, "ws-1");

    expect(defaultProps.onWorkstreamChange).toHaveBeenCalledWith("ws-1");
  });

  it("resets sprint when workstream changes", async () => {
    const user = userEvent.setup();
    renderFilters({
      workstreamId: "ws-1",
      workstreams: [
        { _id: "ws-1", name: "Payments", shortCode: "PYMT" },
        { _id: "ws-2", name: "Catalog", shortCode: "CAT" },
      ],
      sprints: [{ _id: "sp-1", name: "Sprint 1", workstreamId: "ws-1" }],
    });

    const wsSelect = screen.getByDisplayValue("PYMT - Payments");
    await user.selectOptions(wsSelect, "ws-2");

    expect(defaultProps.onSprintChange).toHaveBeenCalledWith("");
  });

  it("shows 'Clear filters' button when any filter is active", () => {
    renderFilters({ status: "done" });

    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("hides 'Clear filters' button when no filters are active", () => {
    renderFilters();

    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("clears all filters when 'Clear filters' clicked", async () => {
    const user = userEvent.setup();
    renderFilters({ status: "done", priority: "high" });

    await user.click(screen.getByText("Clear filters"));

    expect(defaultProps.onStatusChange).toHaveBeenCalledWith("");
    expect(defaultProps.onPriorityChange).toHaveBeenCalledWith("");
    expect(defaultProps.onWorkstreamChange).toHaveBeenCalledWith("");
    expect(defaultProps.onSprintChange).toHaveBeenCalledWith("");
  });

  it("renders Board and List view toggle buttons", () => {
    renderFilters();

    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
  });

  it("calls onViewModeChange when view toggle clicked", async () => {
    const user = userEvent.setup();
    renderFilters();

    await user.click(screen.getByText("List"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");

    await user.click(screen.getByText("Board"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("board");
  });
});
