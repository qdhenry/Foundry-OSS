import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InstanceCard } from "./InstanceCard";

const mockInstance = {
  _id: "instance-1",
  name: "AcmeCorp — Q1 2026",
  status: "active" as const,
  startedAt: Date.now() - 14 * 24 * 3600 * 1000,
  totalTasks: 6,
  doneTasks: 2,
  taskSummaries: [
    { _id: "t1", title: "Discovery", status: "done" },
    { _id: "t2", title: "Data Mapping", status: "done" },
    { _id: "t3", title: "Integration Design", status: "in_progress" },
    { _id: "t4", title: "Sandbox Build", status: "todo" },
  ],
};

describe("InstanceCard", () => {
  it("renders instance name", () => {
    render(<InstanceCard instance={mockInstance} />);
    expect(screen.getByText("AcmeCorp — Q1 2026")).toBeInTheDocument();
  });

  it("renders active status badge", () => {
    render(<InstanceCard instance={mockInstance} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders progress percentage", () => {
    render(<InstanceCard instance={mockInstance} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("renders completed status badge", () => {
    render(
      <InstanceCard
        instance={{
          ...mockInstance,
          status: "completed",
          completedAt: Date.now(),
          doneTasks: 6,
        }}
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("expands to show task summaries on click", async () => {
    const user = userEvent.setup();
    render(<InstanceCard instance={mockInstance} />);
    // Find and click the expand toggle
    const toggleButton = screen.getByRole("button");
    await user.click(toggleButton);
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Data Mapping")).toBeInTheDocument();
  });
});
