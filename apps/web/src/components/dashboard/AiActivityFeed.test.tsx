import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiActivityFeed } from "./AiActivityFeed";

vi.mock("@untitledui/icons", () => ({
  Stars01: (props: any) => <span data-testid="stars-icon" {...props} />,
}));

describe("AiActivityFeed", () => {
  it("shows empty state when no executions", () => {
    render(<AiActivityFeed executions={[]} />);
    expect(screen.getByText("No agent executions yet")).toBeInTheDocument();
    expect(screen.getByText("AI agents will appear here once they run.")).toBeInTheDocument();
  });

  it("renders execution items with skill names", () => {
    const executions = [
      {
        _id: "e-1",
        _creationTime: Date.now() - 120000,
        skillName: "Checkout Taxes",
        taskType: "code_generation",
        status: "completed",
      },
    ];
    render(<AiActivityFeed executions={executions} />);
    expect(screen.getByText("Checkout Taxes")).toBeInTheDocument();
    expect(screen.getByText("code_generation")).toBeInTheDocument();
  });

  it("falls back to Agent Task when skillName is missing", () => {
    const executions = [{ _id: "e-1", _creationTime: Date.now(), status: "running" }];
    render(<AiActivityFeed executions={executions as any} />);
    expect(screen.getByText("Agent Task")).toBeInTheDocument();
  });

  it("displays status badges", () => {
    const executions = [
      { _id: "e-1", _creationTime: Date.now(), skillName: "Task A", status: "completed" },
      { _id: "e-2", _creationTime: Date.now(), skillName: "Task B", status: "failed" },
    ];
    render(<AiActivityFeed executions={executions as any} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("shows relative time", () => {
    const executions = [
      { _id: "e-1", _creationTime: Date.now() - 5000, skillName: "Recent", status: "completed" },
    ];
    render(<AiActivityFeed executions={executions as any} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });
});
