import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskFilters } from "./TaskFilters";

const onStatusChange = vi.fn();
const onPriorityChange = vi.fn();
const onWorkstreamChange = vi.fn();
const onSprintChange = vi.fn();
const onViewModeChange = vi.fn();

describe("TaskFilters", () => {
  beforeEach(() => {
    onStatusChange.mockReset();
    onPriorityChange.mockReset();
    onWorkstreamChange.mockReset();
    onSprintChange.mockReset();
    onViewModeChange.mockReset();
  });

  it("resets sprint when workstream changes", async () => {
    const user = userEvent.setup();

    render(
      <TaskFilters
        status=""
        priority=""
        workstreamId="ws-1"
        sprintId="sp-1"
        viewMode="board"
        onStatusChange={onStatusChange}
        onPriorityChange={onPriorityChange}
        onWorkstreamChange={onWorkstreamChange}
        onSprintChange={onSprintChange}
        onViewModeChange={onViewModeChange}
        workstreams={[
          { _id: "ws-1", name: "Payments", shortCode: "PAY" },
          { _id: "ws-2", name: "Catalog", shortCode: "CAT" },
        ]}
        sprints={[
          { _id: "sp-1", name: "Sprint Payments", workstreamId: "ws-1" },
          { _id: "sp-2", name: "Sprint Catalog", workstreamId: "ws-2" },
        ]}
      />,
    );

    const workstreamSelect = screen.getByDisplayValue("PAY - Payments");
    await user.selectOptions(workstreamSelect, "ws-2");

    expect(onWorkstreamChange).toHaveBeenCalledWith("ws-2");
    expect(onSprintChange).toHaveBeenCalledWith("");
  });
});
