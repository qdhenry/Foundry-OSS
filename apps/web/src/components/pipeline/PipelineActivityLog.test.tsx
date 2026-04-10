import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineActivityLog } from "./PipelineActivityLog";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    auditLog: {
      listByEntity: "auditLog:listByEntity",
    },
  },
}));

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
  },
}));

describe("PipelineActivityLog", () => {
  it("shows empty state when no events", () => {
    mockQueryReturn = [];
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("shows empty state when query returns undefined", () => {
    mockQueryReturn = undefined;
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("renders Activity heading", () => {
    mockQueryReturn = [];
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    expect(screen.getByText("Activity")).toBeInTheDocument();
  });

  it("renders event descriptions", () => {
    mockQueryReturn = [
      {
        _id: "e1",
        timestamp: new Date("2026-03-15").getTime(),
        description: "Requirement approved",
        userName: "Alice",
      },
    ];
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    expect(screen.getByText("Requirement approved")).toBeInTheDocument();
    expect(screen.getByText("by Alice")).toBeInTheDocument();
  });

  it("renders Current Stage and All Stages toggle buttons", () => {
    mockQueryReturn = [];
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    expect(screen.getByText("Current Stage")).toBeInTheDocument();
    expect(screen.getByText("All Stages")).toBeInTheDocument();
  });

  it("toggles to All Stages on click", async () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      _id: `e${i}`,
      timestamp: new Date("2026-03-15").getTime(),
      description: `Event ${i}`,
    }));
    mockQueryReturn = events;
    const user = userEvent.setup();
    render(
      <PipelineActivityLog
        programId={"prog-1" as any}
        requirementId={"req-1" as any}
        currentStage={"implementation" as any}
      />,
    );
    // Current Stage shows max 10
    expect(screen.queryByText("Event 10")).not.toBeInTheDocument();
    await user.click(screen.getByText("All Stages"));
    // All Stages shows up to 50
    expect(screen.getByText("Event 10")).toBeInTheDocument();
  });
});
