import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineActivityLog } from "./PipelineActivityLog";

vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

describe("PipelineActivityLog", () => {
  it("renders activity heading", () => {
    render(
      <PipelineActivityLog programId="prog-1" requirementId="req-1" currentStage="discovery" />,
    );
    expect(screen.getByText("Activity")).toBeInTheDocument();
  });

  it("shows no activity message when events empty", () => {
    render(
      <PipelineActivityLog programId="prog-1" requirementId="req-1" currentStage="requirement" />,
    );
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("renders stage toggle buttons", () => {
    render(
      <PipelineActivityLog
        programId="prog-1"
        requirementId="req-1"
        currentStage="implementation"
      />,
    );
    expect(screen.getByText("Current Stage")).toBeInTheDocument();
    expect(screen.getByText("All Stages")).toBeInTheDocument();
  });
});
