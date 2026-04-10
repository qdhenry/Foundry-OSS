import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InstanceCard } from "./InstanceCard";

describe("InstanceCard", () => {
  const defaultInstance = {
    _id: "inst-1",
    name: "Sprint 3 Migration",
    status: "active" as const,
    startedAt: new Date("2026-03-01").getTime(),
    totalTasks: 10,
    doneTasks: 4,
    taskSummaries: [
      { _id: "t-1", title: "Setup database", status: "done" },
      { _id: "t-2", title: "Migrate users", status: "in_progress" },
    ],
  };

  it("renders instance name", () => {
    render(<InstanceCard instance={defaultInstance} />);
    expect(screen.getByText("Sprint 3 Migration")).toBeInTheDocument();
  });

  it("renders Active status badge", () => {
    render(<InstanceCard instance={defaultInstance} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Completed status badge", () => {
    render(<InstanceCard instance={{ ...defaultInstance, status: "completed" }} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders progress count", () => {
    render(<InstanceCard instance={defaultInstance} />);
    expect(screen.getByText("4/10 tasks done")).toBeInTheDocument();
  });

  it("renders progress percentage", () => {
    render(<InstanceCard instance={defaultInstance} />);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("renders Show tasks button", () => {
    render(<InstanceCard instance={defaultInstance} />);
    expect(screen.getByText("Show tasks")).toBeInTheDocument();
  });

  it("shows task list when expanded", async () => {
    render(<InstanceCard instance={defaultInstance} />);
    await userEvent.click(screen.getByText("Show tasks"));
    expect(screen.getByText("Setup database")).toBeInTheDocument();
    expect(screen.getByText("Migrate users")).toBeInTheDocument();
    expect(screen.getByText("Hide tasks")).toBeInTheDocument();
  });

  it("hides Show tasks when no task summaries", () => {
    render(<InstanceCard instance={{ ...defaultInstance, taskSummaries: [] }} />);
    expect(screen.queryByText("Show tasks")).not.toBeInTheDocument();
  });
});
