import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

vi.mock("@untitledui/icons", () => ({
  Stars01: (props: any) => <span data-testid="stars-icon" {...props} />,
}));

const baseExecution = {
  _id: "exec-1",
  _creationTime: Date.now() - 300000, // 5 min ago
  taskType: "code_generation",
  skillName: "Checkout Taxes",
  trigger: "manual",
  inputSummary: "Generate tax calculation logic",
  outputSummary: "Tax logic generated",
  tokensUsed: 1500,
  durationMs: 4500,
  reviewStatus: "pending" as const,
};

describe("ActivityFeed", () => {
  it("shows empty state when no executions", () => {
    render(<ActivityFeed executions={[]} />);
    expect(screen.getByText("No agent executions yet")).toBeInTheDocument();
    expect(screen.getByText("Execute a skill to see activity here.")).toBeInTheDocument();
  });

  it("renders execution with skill name", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("Checkout Taxes")).toBeInTheDocument();
  });

  it("falls back to Agent Task when skillName is null", () => {
    const exec = { ...baseExecution, skillName: null };
    render(<ActivityFeed executions={[exec]} />);
    expect(screen.getByText("Agent Task")).toBeInTheDocument();
  });

  it("displays review status badge", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows task type", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("code_generation")).toBeInTheDocument();
  });

  it("shows token count", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("1,500 tokens")).toBeInTheDocument();
  });

  it("shows duration", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("4.5s")).toBeInTheDocument();
  });

  it("shows input summary", () => {
    render(<ActivityFeed executions={[baseExecution]} />);
    expect(screen.getByText("Generate tax calculation logic")).toBeInTheDocument();
  });

  it("respects limit prop", () => {
    const executions = [
      { ...baseExecution, _id: "e-1" },
      { ...baseExecution, _id: "e-2", skillName: "Second Skill" },
      { ...baseExecution, _id: "e-3", skillName: "Third Skill" },
    ];
    render(<ActivityFeed executions={executions} limit={2} />);
    expect(screen.queryByText("Third Skill")).toBeNull();
  });

  it("calls onSelect when item clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ActivityFeed executions={[baseExecution]} onSelect={onSelect} />);
    await user.click(screen.getByText("Checkout Taxes"));
    expect(onSelect).toHaveBeenCalledWith("exec-1");
  });
});
