import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskCard } from "../TaskCard";

const mockPush = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateStatus,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: { tasks: { updateStatus: "tasks:updateStatus" } },
}));

function makeTask(overrides: Partial<Parameters<typeof TaskCard>[0]["task"]> = {}) {
  return {
    _id: "task-1",
    title: "Implement checkout flow",
    priority: "medium" as const,
    status: "todo" as const,
    ...overrides,
  };
}

describe("TaskCard", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUpdateStatus.mockReset();
  });

  it("renders task title", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" />);
    expect(screen.getByText("Implement checkout flow")).toBeInTheDocument();
  });

  it("shows priority badge with correct label", () => {
    const { rerender } = render(
      <TaskCard task={makeTask({ priority: "critical" })} programId="prog-1" />,
    );
    expect(screen.getByText("Critical")).toBeInTheDocument();

    rerender(<TaskCard task={makeTask({ priority: "high" })} programId="prog-1" />);
    expect(screen.getByText("High")).toBeInTheDocument();

    rerender(<TaskCard task={makeTask({ priority: "low" })} programId="prog-1" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("shows current status in badge", () => {
    render(<TaskCard task={makeTask({ status: "in_progress" })} programId="prog-1" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("opens status dropdown when status badge clicked, shows all options", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={makeTask({ status: "todo" })} programId="prog-1" />);

    // Click the status badge button
    await user.click(screen.getByRole("button", { name: "To Do" }));

    // All 5 status options should appear in the dropdown
    // "To Do" appears twice: once in the badge, once in the dropdown
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows workstream shortCode when present", () => {
    render(<TaskCard task={makeTask({ workstreamShortCode: "PYMT" })} programId="prog-1" />);
    expect(screen.getByText("PYMT")).toBeInTheDocument();
  });

  it("shows assignee name when present", () => {
    render(<TaskCard task={makeTask({ assigneeName: "Jane Doe" })} programId="prog-1" />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows sprint name when present", () => {
    render(<TaskCard task={makeTask({ sprintName: "Sprint 3" })} programId="prog-1" />);
    expect(screen.getByText("Sprint 3")).toBeInTheDocument();
  });

  it("shows due date formatted", () => {
    // Use a fixed date: Jan 15, 2026
    const dueDate = new Date("2026-01-15T12:00:00Z").getTime();
    render(<TaskCard task={makeTask({ dueDate })} programId="prog-1" />);
    expect(screen.getByText("Jan 15")).toBeInTheDocument();
  });

  it("shows overdue styling when past due and not done", () => {
    const pastDate = new Date("2020-06-15T12:00:00Z").getTime();
    render(
      <TaskCard task={makeTask({ dueDate: pastDate, status: "in_progress" })} programId="prog-1" />,
    );
    const dateEl = screen.getByText("Jun 15");
    // The parent span should have red text class
    expect(dateEl.closest("span")).toHaveClass("text-red-500");
  });

  it("hides description in compact mode, shows in non-compact mode", () => {
    const task = makeTask({ description: "Detailed task description here" });

    const { rerender } = render(<TaskCard task={task} programId="prog-1" compact />);
    expect(screen.queryByText("Detailed task description here")).not.toBeInTheDocument();

    rerender(<TaskCard task={task} programId="prog-1" />);
    expect(screen.getByText("Detailed task description here")).toBeInTheDocument();
  });
});
